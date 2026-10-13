// frontend/src/components/UniversalPrinter.ts - COMPLETE WITH DISCOUNT SUPPORT ✅

import { format } from "date-fns";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import ThermalPrinterImport from "react-native-thermal-printer";

// Safe wrapper around react-native-thermal-printer to prevent null-reference crashes
const ThermalPrinter = {
  printTcp: async (args: any) => {
    if (!ThermalPrinterImport || typeof ThermalPrinterImport.printTcp !== "function") {
      throw new Error("ThermalPrinter module is not available on this device/platform");
    }
    return ThermalPrinterImport.printTcp(args);
  },
  printBluetooth: async (args: any) => {
    if (!ThermalPrinterImport || typeof ThermalPrinterImport.printBluetooth !== "function") {
      throw new Error("ThermalPrinter module is not available on this device/platform");
    }
    return ThermalPrinterImport.printBluetooth(args);
  },
  getBluetoothDeviceList: async () => {
    if (!ThermalPrinterImport || typeof (ThermalPrinterImport as any).getBluetoothDeviceList !== "function") {
      return [];
    }
    return (ThermalPrinterImport as any).getBluetoothDeviceList();
  }
};
import { API_URL } from "../constants/Config";
import { formatToSingaporeDate, formatToSingaporeTime, formatToSingaporeDateTime } from "../utils/timezoneHelper";
import BillPDFGenerator from "./BillPDFGenerator";
import { PrinterDetector } from "./PrinterDetector";
import SunmiPrinterService, { SunmiPrinterManager } from "./SunmiPrinterService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCompanySettingsStore } from "../stores/companySettingsStore";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";
import { useCartStore } from "../stores/cartStore";

// Printer types
export type PrinterType =
  | "thermal"
  | "receipt"
  | "label"
  | "laser"
  | "bluetooth"
  | "network"
  | "usb"
  | "unknown";

interface PrinterInfo {
  type: PrinterType;
  name: string;
  address?: string;
  isDefault: boolean;
  paperSize?: "58mm" | "80mm" | "A4" | "label";
}

interface DiscountInfo {
  applied: boolean;
  type: "percentage" | "fixed";
  value: number;
  amount: number;
}

class UniversalPrinter {
  private static detectedPrinters: PrinterInfo[] = [];
  private static defaultPrinter: PrinterInfo | null = null;
  private static cachedPrinters: any = null;
  private static lastPrintersFetchTime: number = 0;

  // ==================== DEDUPLICATION CACHE ====================
  // Cache key = "orderId:itemFingerprint" so that a legitimate additional-round
  // KOT (same orderId, different new items) is never blocked.
  // Only a byte-identical replay of the same orderId + same item set is rejected.
  // Entries older than 15 minutes are evicted to bound memory usage.
  private static printedOrdersCache = new Map<string, number>();
  private static printedReceiptsCache = new Map<string, number>();

  /**
   * Builds a stable, order-independent fingerprint from the items array.
   * Uses the most-specific ID available per item, then sorts so the key is
   * the same regardless of the order items arrive in the payload.
   */
  private static buildItemFingerprint(items: any[]): string {
    return items
      .map(
        (i: any) =>
          String(
            i.lineItemId ??
            i.LineItemId ??
            i.dishId ??
            i.DishId ??
            i.id ??
            i.name ??
            "?"
          )
      )
      .sort()
      .join(",");
  }

  private static isDuplicatePrint(orderId: string, items: any[]): boolean {
    const now = Date.now();
    const TTL = 15 * 60 * 1000; // 15 minutes
    // Evict stale entries to prevent unbounded memory growth
    for (const [key, ts] of this.printedOrdersCache.entries()) {
      if (now - ts > TTL) this.printedOrdersCache.delete(key);
    }
    // Composite key: orderId + exact item set — allows additional KOTs for the same order
    const cacheKey = `${orderId}:${this.buildItemFingerprint(items)}`;
    if (this.printedOrdersCache.has(cacheKey)) {
      console.log(
        `🛡️ [UniversalPrinter] Duplicate print blocked | Order: ${orderId} | Items: ${items.length}`
      );
      return true;
    }
    this.printedOrdersCache.set(cacheKey, now);
    return false;
  }

  private static isDuplicateReceiptPrint(orderId: string): boolean {
    const now = Date.now();
    const TTL = 15 * 60 * 1000; // 15 minutes
    for (const [key, ts] of this.printedReceiptsCache.entries()) {
      if (now - ts > TTL) this.printedReceiptsCache.delete(key);
    }
    if (this.printedReceiptsCache.has(orderId)) {
      console.log(`🛡️ [UniversalPrinter] Duplicate receipt print blocked for Order: ${orderId}`);
      return true;
    }
    this.printedReceiptsCache.set(orderId, now);
    return false;
  }

  static async detectAllPrinters(): Promise<PrinterInfo[]> {
    const printers: PrinterInfo[] = [];
    if (Platform.OS !== "android") return printers;

    try {
      // Android Print Service
      try {
        const hasPrintService = await this.checkAndroidPrintService();
        if (hasPrintService) {
          printers.push({
            type: "laser",
            name: "Android Print Service",
            isDefault: false,
            paperSize: "A4",
          });
        }
      } catch (e) {}

      this.detectedPrinters = printers;
      this.defaultPrinter =
        printers.find((p) => p.type === "thermal") || printers[0] || null;
      return printers;
    } catch (error) {
      return [];
    }
  }

  static async openCashDrawer(printerIpOverride?: string): Promise<boolean> {
    try {
      const { default: CashDrawerService } = await import('../services/CashDrawerService');
      const ip = printerIpOverride || await CashDrawerService.getCashierPrinterIp();
      return await CashDrawerService.openCashDrawer(ip);
    } catch (e) {
      console.warn('[UniversalPrinter] Cash drawer open failed:', e);
      return false;
    }
  }

  private static getPrintWidth(printer: PrinterInfo): number {
    switch (printer.paperSize) {
      case "58mm":
        return 164;
      case "80mm":
        return 226;
      case "A4":
        return 612;
      case "label":
        return 300;
      default:
        return 226;
    }
  }

  private static async isIpReachable(ip: string, port: number = 80, timeoutMs: number = 600): Promise<boolean> {
    if (!ip || ip.trim() === "") return false;
    // 🛡️ CRITICAL: NEVER probe port 9100 with HTTP fetch!
    // Thermal printers interpret HTTP GET text bytes as print data and print okhttp headers on receipts.
    if (port === 9100 || Platform.OS === "android") return true;
    const cleanIp = ip.trim();
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanIp);
    if (!isIp) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await fetch(`http://${cleanIp}:${port}`, {
        method: "GET",
        signal: controller.signal,
        mode: "no-cors",
        headers: { "Cache-Control": "no-cache" }
      });
      clearTimeout(timer);
      console.log(`🔌 [isIpReachable] Connected/Alive: ${cleanIp}`);
      return true;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        console.log(`🔌 [isIpReachable] Offline/Timeout on ${cleanIp}`);
        return false;
      }
      console.log(`🔌 [isIpReachable] Host responded (alive): ${cleanIp}`);
      return true;
    }
  }

  // ==================== SALES REPORT ====================
  static async printSalesReport(
    reportData: any,
    userId?: string | number,
    t?: any,
  ): Promise<boolean> {
    try {
      const company = await BillPDFGenerator.loadSettings(userId);
      const html = this.generateSalesReportHTML(reportData, company);

      // ✅ Save as PDF (no preview)
      const { uri } = await Print.printToFileAsync({ html });
      console.log("📄 Sales report saved at:", uri);

      // ✅ Optionally share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }

      return true;
    } catch (error) {
      console.log("Sales report error:", error);
      return false;
    }
  }
  private static generateSalesReportHTML(data: any, company: any): string {
    const symbol = company.currencySymbol || "$";
    return `<!DOCTYPE html><html><head><style>
      body { font-family: monospace; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .company-name { font-size: 24px; font-weight: bold; }
      .report-title { font-size: 20px; font-weight: bold; margin: 15px 0; text-align: center; }
      .section-title { font-size: 16px; font-weight: bold; margin: 15px 0 10px; background: #f0f0f0; padding: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
      .amount { text-align: right; }
      .summary-box { display: inline-block; width: 30%; padding: 10px; margin: 5px; background: #f9f9f9; text-align: center; border-radius: 5px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || "POS SYSTEM"}</div><div>${company.address || ""}</div><div>GST: ${company.gstNo || "N/A"}</div><div class="report-title">SALES REPORT</div><div>Period: ${data.period || "Today"}</div></div>
      <div style="text-align:center"><div class="summary-box"><div>Total Sales</div><div style="font-size:24px">${data.summary?.totalSales || 0}</div></div>
      <div class="summary-box"><div>Total Items</div><div style="font-size:24px">${data.summary?.totalItems || 0}</div></div>
      <div class="summary-box"><div>Total Revenue</div><div style="font-size:24px">${symbol}${(data.summary?.totalRevenue || 0).toFixed(2)}</div></div></div>
      <div class="section-title">💳 PAYMENT BREAKDOWN</div>${this.generateTableFromObject(data.paymentBreakdown || {}, symbol)}</div>
      ${data.items && data.items.length > 0 ? `<div class="section-title">📋 ITEM WISE SALES</div>${this.generateItemsTable(data.items, symbol)}` : ""}
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  // ==================== CATEGORY REPORT ====================
  static async printCategoryReport(
    categories: any[],
    selectedCategory: string | null,
    categoryItems: any[],
    categoryTransactions: any[],
    userId?: string | number,
    t?: any,
    options?: any,
  ): Promise<boolean> {
    try {
      const company = await BillPDFGenerator.loadSettings(userId);
      const html = selectedCategory
        ? this.generateCategoryDetailHTML(
            selectedCategory,
            categoryItems,
            categoryTransactions,
            company,
            options,
          )
        : this.generateAllCategoriesHTML(categories, company, options);

      // ✅ Save as PDF (no preview)
      const { uri } = await Print.printToFileAsync({ html });
      console.log("📄 Category report saved at:", uri);

      // ✅ Optionally share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }

      return true;
    } catch (error) {
      console.log("Category report error:", error);
      return false;
    }
  }
  private static generateCategoryDetailHTML(
    categoryName: string,
    items: any[],
    transactions: any[],
    company: any,
    options?: any,
  ): string {
    const symbol = company.currencySymbol || "$";
    const groupTransactions = (tx: any[]) => {
      const grouped: any = {};
      tx.forEach((t) => {
        if (!grouped[t.saleId])
          grouped[t.saleId] = {
            id: t.saleId,
            date: t.saleDate,
            items: [],
            total: 0,
          };
        grouped[t.saleId].items.push({
          name: t.name,
          quantity: t.quantity,
          price: t.price,
        });
        grouped[t.saleId].total += t.price * t.quantity;
      });
      return Object.values(grouped).sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .category-title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; }
      .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; background: #f0f0f0; padding: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .transaction-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || "Store"}</div><div>${company.address || ""}</div><div>GST: ${company.gstNo || "N/A"}</div></div>
      <div class="category-title">📦 ${categoryName}</div>
      <div style="display:flex;justify-content:space-around;margin:20px 0;padding:15px;background:#f9f9f9;border-radius:5px">
        <div><div>Total Items</div><div style="font-size:18px;font-weight:bold">${items.length}</div></div>
        <div><div>Quantity Sold</div><div style="font-size:18px;font-weight:bold">${items.reduce((s, i) => s + (i.quantity || 0), 0)}</div></div>
        <div><div>Total Revenue</div><div style="font-size:18px;font-weight:bold">${symbol}${items.reduce((s, i) => s + (i.revenue || 0), 0).toFixed(2)}</div></div>
      </div>
      <div class="section-title">📋 Items Sold</div>${this.generateItemsTable(items, symbol)}
      <div class="section-title">📄 Transaction History</div>${
        transactions.length
          ? groupTransactions(transactions)
              .map(
                (sale: any) =>
                  `<div class="transaction-card"><div><strong>#${sale.id}</strong> - ${symbol}${sale.total.toFixed(2)}</div><div>${formatToSingaporeDateTime(sale.date)}</div>${sale.items.map((item: any) => `<div>• ${item.name} x${item.quantity} - ${symbol}${(item.price * item.quantity).toFixed(2)}</div>`).join("")}</div>`,
              )
              .join("")
          : "<p>No transactions</p>"
      }
      <div class="footer"><p>End of Report</p></div>
    </body></html>`;
  }

  private static generateAllCategoriesHTML(
    categories: any[],
    company: any,
    options?: any,
  ): string {
    const symbol = company.currencySymbol || "$";
    const summary = options?.summary || {
      totalSales: 0,
      totalItems: 0,
      totalRevenue: 0,
      paymentBreakdown: {},
    };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .summary-section { display: flex; justify-content: space-between; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
      .category-card { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
      .category-name { font-size: 18px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || "Store"}</div><div>${company.address || ""}</div><div>GST: ${company.gstNo || "N/A"}</div><div class="report-title">📊 CATEGORY WISE SALES</div></div>
      <div class="summary-section"><div><div>Total Sales</div><div>${summary.totalSales}</div></div><div><div>Total Items</div><div>${summary.totalItems}</div></div><div><div>Total Revenue</div><div>${symbol}${summary.totalRevenue.toFixed(2)}</div></div></div>
      <div><h3>💳 PAYMENT BREAKDOWN</h3>${Object.entries(
        summary.paymentBreakdown,
      )
        .map(
          ([m, a]) => `<div>${m}: ${symbol}${(a as number).toFixed(2)}</div>`,
        )
        .join("")}</div>
      ${categories.map((cat) => `<div class="category-card"><div class="category-name">${cat.name}</div><div>Revenue: ${symbol}${(cat.totalRevenue || 0).toFixed(2)} | Items: ${cat.totalQuantity || 0}</div>${this.generateItemsTable(cat.items || [], symbol)}</div>`).join("")}
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  private static generateItemsTable(items: any[], symbol: string): string {
    if (!items.length) return "<p>No items</p>";
    return `<table><thead><tr><th>Item</th><th class="amount">Qty</th><th class="amount">Price</th><th class="amount">Total</th></tr></thead><tbody>${items.map((i) => `<tr><td>${i.name}</td><td class="amount">${i.quantity || 0}</td><td class="amount">${symbol}${(i.price || 0).toFixed(2)}</td><td class="amount">${symbol}${(i.revenue || 0).toFixed(2)}</td></tr>`).join("")}</tbody></table>`;
  }

  private static generateTableFromObject(
    obj: Record<string, any>,
    symbol: string,
  ): string {
    const entries = Object.entries(obj);
    if (!entries.length) return "<p>No data</p>";
    return `<table><tbody>${entries.map(([k, v]) => `<tr><td>${k}</td><td class="amount">${symbol}${(v as number).toFixed(2)}</td></tr>`).join("")}</tbody></table>`;
  }

  private static async isBridgeOnline(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/print-jobs/bridge-status`);
      const data = await response.json();
      return !!(data && data.success && data.online);
    } catch (e) {
      console.warn("[UniversalPrinter] Failed to check print bridge status:", e);
      return false;
    }
  }

  private static async queuePrintJob(
    printerType: number,
    kitchenTypeValue: string | number | undefined,
    content: string,
    targetIp?: string
  ): Promise<boolean> {
    try {
      const storeId = "STORE_001";
      const response = await fetch(`${API_URL}/api/print-jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer unipro-pos-bridge-token-2026",
          "x-store-id": storeId
        },
        body: JSON.stringify({
          printerType,
          kitchenTypeValue: kitchenTypeValue !== undefined ? String(kitchenTypeValue) : undefined,
          content,
          targetIp: targetIp || undefined
        })
      });
      const data = await response.json();
      if (data.success !== true || !data.jobId) {
        return false;
      }

      // Poll for bridge completion (up to 8 seconds - allows for bridge poll cycle + print + network latency)
      const jobId = data.jobId;
      const start = Date.now();
      while (Date.now() - start < 8000) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const statusRes = await fetch(`${API_URL}/api/print-jobs/status/${jobId}`);
          const statusData = await statusRes.json();
          if (statusData.success && statusData.status === 'COMPLETED') {
            console.log(`✅ [UniversalPrinter] Print job ${jobId} completed successfully on bridge`);
            return true;
          }
          if (statusData.success && statusData.status === 'FAILED') {
            console.warn(`❌ [UniversalPrinter] Print job ${jobId} failed on bridge side:`, statusData.error);
            return false;
          }
        } catch (err) {
          console.error("[UniversalPrinter] Status poll error:", err);
        }
      }
      console.warn(`[UniversalPrinter] Print job ${jobId} timed out after 8s (bridge offline/no printer)`);
      return false;
    } catch (e) {
      console.warn("[UniversalPrinter] Failed to queue print job:", e);
      return false;
    }
  }

  static async detectUsbPrinters(): Promise<Array<{ name: string; port: string; status: string; isUsb: boolean }>> {
    try {
      const res = await fetch(`http://localhost:3050/api/printers`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.printers)) {
        return data.printers;
      }
    } catch (e) {
      console.warn("[UniversalPrinter] Could not fetch USB printers from print bridge:", e);
    }
    return [];
  }

  // ==================== KOT PRINTING (80mm) ====================
  private static async logPrintJob(
    orderId: string,
    orderNo: string,
    type: "NEW" | "ADDITIONAL" | "REPRINT" | "KDS_PRINT"
  ): Promise<void> {
    try {
      const baseUrl = API_URL;
      await fetch(`${baseUrl}/api/orders/log-print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId && orderId.length > 30 ? orderId : null,
          orderNumber: orderNo,
          printType: 1, // KOT
          isEdit: type === "ADDITIONAL",
          isReprint: type === "REPRINT",
          isHold: false,
        }),
      });
      console.log("📝 Print job logged to PrintReport");
    } catch (logErr) {
      console.warn("Failed to log print to DB:", logErr);
    }
  }

  static async printKDSOrder(
    orderData: any,
    userId?: string | number,
    kdsPrinterIp?: string,
    isReprint: boolean = false,
  ): Promise<boolean> {
    if (Platform.OS === "web") {
      try {
        const isOnline = await this.isBridgeOnline();
        if (!isOnline) {
          console.log("ðŸ“¡ [Web Print Bridge] Bridge is OFFLINE. Direct fallback to preview.");
          const html = this.generateKOTHTML(orderData, "KDS_PRINT");
          let frame = document.getElementById("kot-print-iframe") as HTMLIFrameElement;
          if (!frame) {
            frame = document.createElement("iframe");
            frame.id = "kot-print-iframe";
            frame.style.display = "none";
            document.body.appendChild(frame);
          }

          const doc = frame.contentWindow?.document || frame.contentDocument;
          if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            const triggerPrint = () => {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            };

            frame.contentWindow?.addEventListener("load", triggerPrint);
            setTimeout(triggerPrint, 50);
          }
          await this.logPrintJob(orderData.orderId, orderData.orderNo, "REPRINT");
          return true;
        }

        const text = this.formatKOTThermalText(orderData, "KDS_PRINT");
        console.log(`ðŸ“¡ [Web Print Bridge] Queueing KDS print`);
        const success = await this.queuePrintJob(4, undefined, text);
        if (success) {
          await this.logPrintJob(orderData.orderId, orderData.orderNo, "REPRINT");
          return true;
        }

        // Web Fallback: If Print Bridge failed, trigger iframe preview
        console.log("âš ï¸ [Web KDS Print] Print Bridge queue failed. Falling back to iframe print preview.");
        const html = this.generateKOTHTML(orderData, "KDS_PRINT");
        let frame = document.getElementById("kot-print-iframe") as HTMLIFrameElement;
        if (!frame) {
          frame = document.createElement("iframe");
          frame.id = "kot-print-iframe";
          frame.style.display = "none";
          document.body.appendChild(frame);
        }

        const doc = frame.contentWindow?.document || frame.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();

          const triggerPrint = () => {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          };

          frame.contentWindow?.addEventListener("load", triggerPrint);
          setTimeout(triggerPrint, 800);
        }
        await this.logPrintJob(orderData.orderId, orderData.orderNo, "REPRINT");
        return true;
      } catch (err) {
        console.warn("[Web Print Bridge] KDS Print failed, falling back to iframe print preview:", err);
        try {
          const html = this.generateKOTHTML(orderData, "KDS_PRINT");
          let frame = document.getElementById("kot-print-iframe") as HTMLIFrameElement;
          if (!frame) {
            frame = document.createElement("iframe");
            frame.id = "kot-print-iframe";
            frame.style.display = "none";
            document.body.appendChild(frame);
          }

          const doc = frame.contentWindow?.document || frame.contentDocument;
          if (doc) {
            doc.open();
            doc.write(html);
            doc.close();

            const triggerPrint = () => {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            };

            frame.contentWindow?.addEventListener("load", triggerPrint);
            setTimeout(triggerPrint, 800);
          }
          await this.logPrintJob(orderData.orderId, orderData.orderNo, "REPRINT");
          return true;
        } catch (fallbackErr) {
          console.error("Web KDS print fallback failed:", fallbackErr);
          return false;
        }
      }
    }

    // Mobile/Native
    return this.printKOT(orderData, userId, "KDS_PRINT", kdsPrinterIp);
  }

  /** Create a uniquely-named hidden iframe for each KOT print to avoid concurrent overwrites */
  private static createKOTFrame(): HTMLIFrameElement {
    const frameId = `kot-print-iframe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const frame = document.createElement("iframe");
    frame.id = frameId;
    frame.style.display = "none";
    document.body.appendChild(frame);
    // Auto-remove after 15s
    setTimeout(() => { try { frame.remove(); } catch (_) {} }, 15000);
    return frame;
  }

  /** Print KOT HTML via a fresh hidden iframe */
  private static printKOTViaFrame(html: string, delay = 50): void {
    const frame = this.createKOTFrame();
    const doc = frame.contentWindow?.document || frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    };
    frame.contentWindow?.addEventListener("load", triggerPrint);
    setTimeout(triggerPrint, delay);
  }

  static async printKOT(
    orderData: any,
    userId?: string | number,
    type: "NEW" | "ADDITIONAL" | "REPRINT" | "KDS_PRINT" = "NEW",
    printerIpOverride?: string,
  ): Promise<boolean> {
    if (Platform.OS === "web") {
      try {
        const isOnline = await this.isBridgeOnline();
        if (!isOnline) {
          console.log("ðŸ“¡ [Web Print Bridge] Bridge is OFFLINE. Direct fallback to preview.");
          this.printKOTViaFrame(this.generateKOTHTML(orderData, type), 50);
          await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
          return true;
        }

        const text = this.formatKOTThermalText(orderData, type);
        // Map kitchenCode or kitchenTypeValue
        const kitchenTypeValue = orderData.kitchenCode || orderData.KitchenCode || orderData.kitchenTypeValue || orderData.KitchenTypeValue || "0";
        console.log(`ðŸ“¡ [Web Print Bridge] Queueing KOT to Kitchen type: ${kitchenTypeValue}`);
        const success = await this.queuePrintJob(2, kitchenTypeValue, text);
        if (success) {
          await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
          return true;
        }

        // ðŸš€ Fallback: If Print Bridge failed or printer not detected on web, trigger iframe print preview immediately
        console.log("âš ï¸  [Web KOT Print] Print Bridge queue failed. Falling back to iframe print preview.");
        this.printKOTViaFrame(this.generateKOTHTML(orderData, type), 800);
        await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
        return true;
      } catch (err) {
        console.warn("[Web Print Bridge] KOT Queue failed, falling back to iframe print preview:", err);
        try {
          this.printKOTViaFrame(this.generateKOTHTML(orderData, type), 800);
          await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
          return true;
        } catch (fallbackErr) {
          console.error("Web KOT print fallback failed:", fallbackErr);
          return false;
        }
      }
    }

    try {
      const company = await BillPDFGenerator.loadSettings(userId);
      const html = this.generateKOTHTML(orderData, type);
      
      let targetIp: string = printerIpOverride || "";
      if (!targetIp) {
        if (type === "KDS_PRINT") {
          try {
            const res = await fetch(`${API_URL}/api/settings/kitchen-printers`);
            const printers = await res.json();
            const kdsPrinter = printers.find((p: any) => p.PrinterType === 4);
            targetIp = kdsPrinter?.PrinterPath || kdsPrinter?.PrinterIP || "";
          } catch (err) {
            console.warn("Failed to fetch KDS printer IP:", err);
          }
        }
        if (!targetIp && type !== "KDS_PRINT") {
          targetIp = company.printerIp || "";
        }
      }

      // âœ… 1. Try Hardware Printer (WiFi or Bluetooth)
      const hasConfiguredIp = targetIp && targetIp.trim().length > 0;
      if (hasConfiguredIp) {
        let isReachable = false;
        const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(targetIp.trim());
        if (isIp) {
          isReachable = Platform.OS === "android" ? true : await this.isIpReachable(targetIp);
        } else {
          isReachable = true;
        }

        if (isReachable) {
          try {
            const text = this.formatKOTThermalText(orderData, type);

            if (isIp) {
              console.log(`ðŸŒ KOT WiFi print to: ${targetIp}`);
              const printPromise = ThermalPrinter.printTcp({
                ip: targetIp,
                port: 9100,
                payload: text,
                mmFeedPaper: 25,
              });
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("WiFi Timeout")), 1500),
              );
              await Promise.race([printPromise, timeoutPromise]);
            } else {
              console.log(`🔵 KOT Bluetooth print to: ${targetIp}`);
              await ThermalPrinterImport?.getBluetoothDeviceList?.().catch(() => {});
              const printPromise = ThermalPrinter.printBluetooth({
                macAddress: targetIp,
                payload: text,
                mmFeedPaper: 25,
              });
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("BT Timeout")), 12000),
              );
              await Promise.race([printPromise, timeoutPromise]);
            }
            await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
            return true;
          } catch (printError) {
            console.warn("âŒ Hardware KOT failed/timeout, falling back directly to PDF...");
          }
        } else {
          console.warn(`âŒ configured printer IP ${targetIp} not reachable, falling back directly to PDF...`);
        }
      } else {
        // âœ… 2. Try Sunmi direct print (Silent) (Only if IP is NOT entered)
        const sunmiReady = await SunmiPrinterService.init().catch(() => false);
        if (sunmiReady) {
          try {
            const printPromise = SunmiPrinterService.printKOT(orderData, type);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Sunmi Timeout")), 2000),
            );
            const printed = await Promise.race([printPromise, timeoutPromise]);

            if (printed) {
              console.log("âœ… KOT Printed with Sunmi - NO PREVIEW");
              await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
              return true;
            }
          } catch (sunmiErr) {
            console.warn("âŒ Sunmi KOT failed/timeout:", sunmiErr);
          }
        }
      }

      // âœ… 3. Mobile Fallback (Android/iOS)
      const { uri } = await Print.printToFileAsync({
        html,
        width: 302, // 80mm at 96dpi (80 Ã— 3.7795 â‰ˆ 302px)
      });

      if (Platform.OS === "android" || Platform.OS === "ios") {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }

      // âœ… 4. LOG TO DATABASE (Audit Trail)
      await this.logPrintJob(orderData.orderId, orderData.orderNo, type);
      return true;
    } catch (error) {
      console.log("KOT Print Error:", error);
      return false;
    }
  }

  private static generateKOTHTML(data: any, type: string): string {
    let title =
      type === "KDS_PRINT"
        ? "KDS PRINT"
        : type === "REPRINT"
          ? "REPRINT"
          : type === "ADDITIONAL"
            ? "ADDITIONAL"
            : "NEW ORDER";
    title = title.replace(/\s*KOT\s*/gi, "").trim();

    const items = (data.items || []).filter((item: any) => (item.status || item.Status || "").toUpperCase() !== "VOIDED");
    const tableNo = data.tableNo || "N/A";
    const deviceNo = data.deviceNo || "1";
    const orderNo = data.orderNo || data.orderId || "N/A";
    const rawWaiter = data.waiterName || "Staff";
    const isQuick = !!(data.isQuickServe || data.isQuick || data.isQuickServeMode || data.orderContext?.isQuickServe || data.context?.orderType === "QUICK_SERVE" || data.orderType === "QUICK_SERVE" || data.section === "QUICK_SERVE" || (typeof rawWaiter === "string" && rawWaiter.toLowerCase().includes("(quick serve)")));
    const cleanTableNo = (tableNo || "").replace(/^table\s+/gi, "").trim() || tableNo;
    const displayTable = isQuick ? (cleanTableNo.toLowerCase().includes("(quick serve)") ? cleanTableNo : `${cleanTableNo} (quick serve)`) : tableNo;
    const waiter = isQuick ? (rawWaiter.replace(/\s*\(quick serve\)/gi, '').trim() || "Staff") : rawWaiter;
    const kotDateStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const kotTimeStr = formatToSingaporeTime(new Date(), { hour: '2-digit', minute: '2-digit', hour12: false });
    const timestamp = `${kotDateStr} ${kotTimeStr}`;
    const kitchenName = data.kitchenName || "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { 
            size: 80mm auto; 
            margin: 0; 
          }
          body { 
            font-family: 'Arial', sans-serif; 
            width: 80mm; 
            padding: 0; 
            margin: 0; 
            color: #000; 
            background: #fff;
          }
          .kot-container { 
            padding: 15mm 2mm 1mm 2mm; 
            width: 76mm;
          }
          
          .header-box { 
            background: #000 !important; 
            color: #fff !important; 
            padding: 3px 5px; 
            text-align: center; 
            font-weight: bold; 
            font-size: 15px; 
            display: block;
            margin-bottom: 2px;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
          }
          
          .timestamp {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 3px;
            color: #333;
            text-align: center;
          }
          
          .table-info {
            display: flex;
            justify-content: space-between;
            border-bottom: 1.5px dashed #000;
            padding: 1px 0;
            margin-bottom: 2px;
            font-size: 14px;
            font-weight: 900;
          }
          
          .headers {
            display: flex;
            border-bottom: 1px dashed #000;
            padding: 1px 0;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .qty-head { width: 30px; margin-right: 4px; }
          
          .item-row {
            border-bottom: 1px solid #000;
            padding: 3px 0;
          }
          
          .item-main {
            display: flex;
            align-items: flex-start;
          }
          
          .item-qty {
            font-size: 22px;
            font-weight: 900;
            width: 30px;
            line-height: 1;
            margin-right: 4px;
          }
          
          .item-name {
            font-size: 20px;
            font-weight: 900;
            flex: 1;
            line-height: 1.1;
          }
          
          .modifier-list {
            margin-left: 34px;
            margin-top: 1px;
          }
          
          .modifier-item {
            font-size: 16px;
            font-weight: 900;
            color: #000;
            display: block;
          }
          
          .remarks {
            margin-left: 34px;
            font-size: 16px;
            font-weight: 900;
            margin-top: 2px;
          }
          
          .footer {
            margin-top: 4px;
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
          }
          
          .kitchen-name {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-top: 6px;
            text-transform: uppercase;
            border-top: 1.5px dashed #000;
            border-bottom: 1.5px dashed #000;
            padding: 3px 0;
          }
          
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body { width: 80mm; }
            .header-box { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="kot-container">
          <div class="header-box">${title}</div>
          <div class="timestamp">${timestamp}</div>
          
          <div class="table-info" style="font-size: 18px; font-weight: 900; white-space: nowrap;">
            <span>TABLE: ${displayTable}</span>
          </div>
          
          <div class="headers">
            <div class="qty-head">Qty</div>
            <div>Item</div>
          </div>

          <div class="item-list">
            ${(() => {
              if (type === "KDS_PRINT") {
                const kitchenGroups: Record<string, any[]> = {};
                items.forEach((item: any) => {
                  const kName = (item.KitchenTypeName || item.kitchenTypeName || item.dishGroupName || item.categoryName || "KITCHEN").toUpperCase().trim();
                  if (!kitchenGroups[kName]) kitchenGroups[kName] = [];
                  kitchenGroups[kName].push(item);
                });

                return Object.entries(kitchenGroups).map(([kName, groupItems]) => {
                  return `
                    <div style="font-size: 18px; font-weight: bold; margin-top: 10px; border-bottom: 1.5px solid #000; padding-bottom: 2px; text-transform: uppercase;">
                      <b>${kName}</b>
                    </div>
                    ${groupItems.map((item: any) => {
                      const noteText = item.note || item.notes || item.Remarks || item.remarks;
                      const rawCombo = item.comboSelections || item.selectedCombos || item.combos ||
                        (typeof item.ComboDetailsJSON === 'string' && item.ComboDetailsJSON 
                          ? (() => { try { const p = JSON.parse(item.ComboDetailsJSON); return Array.isArray(p) ? p : (p.groups || p.items || p.selections || []); } catch { return undefined; } })() 
                          : (Array.isArray(item.ComboDetailsJSON) ? item.ComboDetailsJSON : (typeof item.ComboDetailsJSON === 'object' && item.ComboDetailsJSON ? (item.ComboDetailsJSON.groups || item.ComboDetailsJSON.items || []) : undefined)));
                      const comboSels = Array.isArray(rawCombo) ? rawCombo : [];
                      const hasCombo = comboSels.length > 0;

                      return `
                        <div class="item-row">
                          <div class="item-main">
                            <div class="item-qty">${item.quantity || item.qty || 1}</div>
                            <div class="item-name">
                              <b>${(item.name || "").replace(/\n/g, '<br/>')}</b>
                              ${item.songName || item.SongName ? `<div style="font-size: 12px; font-weight: normal; color: #555; margin-top: 4px;">🎵 ${item.songName || item.SongName}</div>` : ''}
                            </div>
                          </div>
                          ${
                            item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway
                              ? `<div class="modifier-list"><span class="modifier-item">- Takeaway</span></div>`
                              : ""
                          }
                          ${
                            item.modifiers && item.modifiers.length > 0
                              ? `<div class="modifier-list">${item.modifiers.map((m: any) => `<span class="modifier-item">+ ${m.name || m.ModifierName}</span>`).join("")}</div>`
                              : ""
                          }
                          ${
                            hasCombo
                              ? `<div class="modifier-list">${comboSels.map((g: any) => {
                                  const choices = g.items || g.dishes || g.selections || g.selectedDishes || (Array.isArray(g) ? g : (g.name || g.DishName || g.itemName ? [g] : []));
                                  if (Array.isArray(choices)) {
                                    return choices.map((opt: any) => {
                                      const optName = opt.name || opt.DishName || opt.itemName || "";
                                      return optName ? `<span class="modifier-item">- ${optName}</span>` : "";
                                    }).join("");
                                  }
                                  return "";
                                }).join("")}</div>`
                              : ""
                          }
                          ${noteText ? `<div class="remarks">* ${noteText}</div>` : ""}
                        </div>
                      `;
                    }).join("")}
                  `;
                }).join("");
              }

              return items.map((item: any) => {
                const noteText = item.note || item.notes || item.Remarks || item.remarks;
                const rawCombo = item.comboSelections || item.selectedCombos || item.combos || 
                  (typeof item.ComboDetailsJSON === 'string' && item.ComboDetailsJSON 
                    ? (() => { try { const p = JSON.parse(item.ComboDetailsJSON); return Array.isArray(p) ? p : (p.groups || p.items || p.selections || []); } catch { return undefined; } })() 
                    : (Array.isArray(item.ComboDetailsJSON) ? item.ComboDetailsJSON : (typeof item.ComboDetailsJSON === 'object' && item.ComboDetailsJSON ? (item.ComboDetailsJSON.groups || item.ComboDetailsJSON.items || []) : undefined)));
                const comboSels = Array.isArray(rawCombo) ? rawCombo : [];
                const hasCombo = comboSels.length > 0;

                return `
                  <div class="item-row">
                    <div class="item-main">
                      <div class="item-qty">${item.quantity || item.qty || 1}</div>
                      <div class="item-name">
                        <b>${(item.name || "").replace(/\n/g, '<br/>')}</b>
                        ${item.songName || item.SongName ? `<div style="font-size: 12px; font-weight: normal; color: #555; margin-top: 4px;">🎵 ${item.songName || item.SongName}</div>` : ''}
                      </div>
                    </div>
                    ${
                      item.isTakeaway ||
                      item.IsTakeaway ||
                      item.isTakeAway ||
                      item.IsTakeAway
                        ? `
                      <div class="modifier-list">
                        <span class="modifier-item">- Takeaway</span>
                      </div>
                    `
                        : ""
                    }
                    ${
                      item.modifiers && item.modifiers.length > 0
                        ? `
                      <div class="modifier-list">
                        ${item.modifiers
                          .map(
                            (m: any) => `
                          <span class="modifier-item">+ ${m.name || m.ModifierName}</span>
                        `,
                          )
                          .join("")}
                      </div>
                    `
                        : ""
                    }
                    ${
                      hasCombo
                        ? `
                      <div class="modifier-list">
                        ${comboSels
                          .map((g: any) => {
                            const choices = g.items || g.dishes || g.selections || g.selectedDishes || (Array.isArray(g) ? g : (g.name || g.DishName || g.itemName ? [g] : []));
                            if (Array.isArray(choices)) {
                              return choices.map((opt: any) => {
                                const optName = opt.name || opt.DishName || opt.itemName || "";
                                return optName ? `<span class="modifier-item">- ${optName}</span>` : "";
                              }).join("");
                            }
                            return "";
                          })
                          .join("")}
                      </div>
                    `
                        : ""
                    }
                    ${
                      noteText
                        ? `
                      <div class="remarks">
                        * ${noteText}
                      </div>
                    `
                        : ""
                    }
                  </div>
                `;
              }).join("");
            })()}
          </div>

          <div class="footer">
            Order By : ${waiter} #OR-${orderNo}
          </div>

          ${kitchenName && kitchenName !== "KDS" ? `<div class="kitchen-name">${kitchenName.toUpperCase()}${tableNo && tableNo !== "N/A" ? `  /  T.NO: ${tableNo}` : ""}</div>` : ""}
        </div>
      </body>
      </html>
    `;
  }

  private static formatKOTThermalText(data: any, type: string = "NEW"): string {
    const title =
      type === "KDS_PRINT"    ? "KDS PRINT"
      : type === "REPRINT"    ? "REPRINT"
      : type === "ADDITIONAL" ? "ADDITIONAL ORDER"
      : "NEW ORDER";

    const items       = (data.items || []).filter((i: any) => (i.status || i.Status || "").toUpperCase() !== "VOIDED");
    const tableNo     = data.tableNo || "N/A";
    const rawWaiter   = data.waiterName || "Staff";
    const isQuick     = !!(data.isQuickServe || data.isQuick || data.isQuickServeMode || data.orderContext?.isQuickServe || data.context?.orderType === "QUICK_SERVE" || data.orderType === "QUICK_SERVE" || data.section === "QUICK_SERVE" || (typeof rawWaiter === "string" && rawWaiter.toLowerCase().includes("(quick serve)")));
    const cleanTableNo = (tableNo || "").replace(/^table\s+/gi, "").trim() || tableNo;
    const displayTable = isQuick ? (cleanTableNo.toLowerCase().includes("(quick serve)") ? cleanTableNo : `${cleanTableNo} (quick serve)`) : tableNo;
    const waiter      = isQuick ? (rawWaiter.replace(/\s*\(quick serve\)/gi, '').trim() || "Staff") : rawWaiter;
    const orderNo     = data.orderNo || data.orderId || "";
    const kitchenName = data.kitchenName || "";

    const kotDateStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/[\u202F\u00A0\uFEFF]/g, ' ');
    const kotTimeStr = formatToSingaporeTime(new Date(), { hour: "2-digit", minute: "2-digit", hour12: false }).replace(/[\u202F\u00A0\uFEFF]/g, ' ');

    const DIV = "[L]------------------------------------------------\n";

    const DISH_WRAP = 20;
    const BIG_MOD_WRAP = 20;

    const wrapText = (str: string, maxChars: number): string[] => {
      const words = String(str || "").split(" ");
      const result: string[] = [];
      let current = "";
      for (const word of words) {
        if (!word) continue;
        if (!current) {
          current = word;
        } else if ((current + " " + word).length <= maxChars) {
          current += " " + word;
        } else {
          result.push(current);
          current = word;
        }
      }
      if (current) result.push(current);
      return result.length ? result : [""];
    };

    const formatItem = (item: any): string => {
      let t = "";
      const qtyNum   = item.quantity || item.qty || 1;
      const itemName = item.name || item.DishName || "";

      wrapText(itemName.replace(/\n/g, " "), DISH_WRAP).forEach((chunk: string, idx: number) => {
        if (idx === 0) t += `[L]<font size='big'><B>[${qtyNum}] ${chunk}</B></font>\n`;
        else           t += `[L]<font size='big'><B>    ${chunk}</B></font>\n`;
      });

      const songName = item.songName || item.SongName || "";
      if (songName) t += `[L]<font size='big'><B>  ♪ ${songName}</B></font>\n`;

      const isTw = !!(item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway);
      if (isTw) t += `[L]<font size='big'><B>  >> TAKEAWAY <<</B></font>\n`;

      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach((m: any) => {
          const modName = m.ModifierName || m.modifierName || m.name || m.ModifierNameEn || "";
          if (modName) {
            wrapText(modName, BIG_MOD_WRAP).forEach((chunk: string, idx: number) => {
              t += idx === 0 ? `[L]<font size='big'><B>  + ${chunk}</B></font>\n` : `[L]<font size='big'><B>    ${chunk}</B></font>\n`;
            });
          }
        });
      }

      let comboSels = item.comboSelections || item.selectedCombos || item.combos;
      if (!comboSels || (Array.isArray(comboSels) && comboSels.length === 0)) {
        const rawCombo = item.ComboDetailsJSON || item.comboDetailsJSON || item.ComboDetails || item.comboDetails;
        if (rawCombo) {
          if (typeof rawCombo === 'string') {
            try {
              const parsed = JSON.parse(rawCombo);
              comboSels = Array.isArray(parsed) ? parsed : (parsed.groups || parsed.items || parsed.selections || []);
            } catch (e) {
              comboSels = [];
            }
          } else if (Array.isArray(rawCombo)) {
            comboSels = rawCombo;
          } else if (typeof rawCombo === 'object') {
            comboSels = rawCombo.groups || rawCombo.items || rawCombo.selections || [];
          }
        }
      }

      if (Array.isArray(comboSels) && comboSels.length > 0) {
        comboSels.forEach((g: any) => {
          const choices = g.items || g.dishes || g.selections || g.selectedDishes || (Array.isArray(g) ? g : (g.name || g.DishName || g.itemName ? [g] : []));
          if (Array.isArray(choices)) {
            choices.forEach((opt: any) => {
              const optName = opt.name || opt.DishName || opt.itemName || "";
              if (optName) {
                wrapText(optName, BIG_MOD_WRAP).forEach((chunk: string, idx: number) => {
                  t += idx === 0 ? `[L]<font size='big'><B>  - ${chunk}</B></font>\n` : `[L]<font size='big'><B>    ${chunk}</B></font>\n`;
                });
              }
            });
          }
        });
      }

      const noteText = item.note || item.notes || item.Remarks || item.remarks;
      if (noteText) {
        wrapText(noteText, BIG_MOD_WRAP).forEach((chunk: string, idx: number) => {
          t += idx === 0 ? `[L]<font size='big'><B>  * ${chunk}</B></font>\n` : `[L]<font size='big'><B>    ${chunk}</B></font>\n`;
        });
      }

      return t;
    };

    let text = "";
    text += "[L]\n".repeat(4);
    text += `[C]<font size='big'><B>${title}</B></font>\n`;
    text += `[C]<B>${kotDateStr}  ${kotTimeStr}</B>\n`;
    text += DIV;

    text += `[C]<font size='big'><B>TABLE: ${displayTable}</B></font>\n`;
    text += DIV;

    text += "[L]<B>QTY  ITEM</B>\n";
    text += DIV;

    if (type === "KDS_PRINT") {
      const groups: Record<string, any[]> = {};
      items.forEach((item: any) => {
        const k = (item.KitchenTypeName || item.kitchenTypeName || item.dishGroupName || item.categoryName || "KITCHEN").toUpperCase().trim();
        if (!groups[k]) groups[k] = [];
        groups[k].push(item);
      });

      for (const [kName, groupItems] of Object.entries(groups)) {
        text += `[C]<B>--- ${kName} ---</B>\n`;
        text += DIV;
        groupItems.forEach((item: any, idx: number) => {
          text += formatItem(item);
          if (idx < groupItems.length - 1) text += "[L]\n";
        });
        text += DIV;
      }
    } else {
      const kotGroups: Record<string, any[]> = {};
      items.forEach((item: any) => {
        const k = (item.KitchenTypeName || item.kitchenTypeName || item.dishGroupName || item.categoryName || "KITCHEN").toUpperCase().trim();
        if (!kotGroups[k]) kotGroups[k] = [];
        kotGroups[k].push(item);
      });

      const kotGroupEntries = Object.entries(kotGroups);
      kotGroupEntries.forEach(([kName, groupItems]: [string, any[]], gIdx: number) => {
        if (kotGroupEntries.length > 1) {
          text += `[C]<B>--- ${kName} ---</B>\n`;
          text += DIV;
        }
        groupItems.forEach((item: any, idx: number) => {
          text += formatItem(item);
          if (idx < groupItems.length - 1) text += "[L]\n";
        });
        text += DIV;
      });
    }

    text += `[L]<B>Order By : ${waiter}</B>\n`;
    text += `[L]<B>Order No : ${orderNo}</B>\n`;

    if (type !== "KDS_PRINT") {
      const kotLabel = kitchenName && kitchenName !== "KDS"
        ? (tableNo && tableNo !== "N/A"
            ? `${kitchenName.toUpperCase()}  /  T.NO : ${tableNo}`
            : kitchenName.toUpperCase())
        : (tableNo && tableNo !== "N/A"
            ? `T.NO : ${tableNo}`
            : "");
      if (kotLabel) {
        text += DIV;
        text += `[C]<B>${kotLabel}</B>\n`;
        text += DIV;
      }
    }

    // ── FEED LINES at end ──
    text += "[L]\n";

    return text;
  }

  // ==================== MAIN SMART PRINT WITH DISCOUNT ====================
  static async smartPrint(
    saleData: any,
    outletId?: string | number,
    t?: any,
    discountInfo?: DiscountInfo,
    preferredType?: PrinterType,
    isReprint: boolean = false,
  ): Promise<boolean> {
    if (Platform.OS === "web") {
      try {
        // Try bridge directly — skip pre-flight isBridgeOnline() check which can falsely report offline

        const company = await BillPDFGenerator.loadSettings(outletId);
        const colWidth = this.getAutoColWidth();
        const text = this.formatThermalTextWithDiscount(
          saleData,
          company,
          discountInfo,
          colWidth,
        );
        const isTakeaway =
          !saleData.tableNo ||
          String(saleData.tableNo).trim() === "" ||
          String(saleData.tableNo).toUpperCase().startsWith("TW") ||
          String(saleData.tableNo).toUpperCase() === "TAKEAWAY" ||
          String(saleData.tableNo).toUpperCase() === "TAKE AWAY";

        const pType = isTakeaway ? 3 : 1;
        console.log(`📡 [Web Print Bridge] Queueing receipt to printer type: ${pType}`);
        const targetIp = isTakeaway
          ? (company.takeawayIp || company.printerIp || "")
          : (company.printerIp || "");
        console.log(`📡 [Web Print Bridge] Queueing receipt (Type ${pType}, Target: ${targetIp || "default"})`);
        const success = await this.queuePrintJob(pType, undefined, text, targetIp);
        if (success) return true;

        // 🚀 Fallback: If Print Bridge failed or printer not detected on web, trigger iframe print preview immediately
        console.log("⚠️ [Web Receipt Print] Print Bridge queue failed. Falling back to iframe print preview.");
        return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      } catch (err) {
        console.warn("[Web Print Bridge] Receipt Queue failed, falling back to iframe print preview:", err);
        return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      }
    }

    // 🚀 NON-BLOCKING BACKGROUND EXECUTION: Run printing in the background to prevent UI lag on APK
    (async () => {
      try {
        const company = await BillPDFGenerator.loadSettings(outletId);

        // Load printer IPs dynamically from PrintMaster with caching
        let cashierIp = "";
        let takeawayIp = "";
        try {
          const now = Date.now();
          let printers = this.cachedPrinters;
          if (!printers || (now - this.lastPrintersFetchTime > 30000)) {
            const response = await fetch(
              `${API_URL}/api/settings/kitchen-printers`,
            );
            printers = await response.json();
            this.cachedPrinters = printers;
            this.lastPrintersFetchTime = now;
          }
          if (Array.isArray(printers)) {
            const cashierPrinter = printers.find((p) => p.PrinterType === 1);
            const takeawayPrinter = printers.find((p) => p.PrinterType === 3);
            cashierIp = cashierPrinter?.PrinterPath || "";
            takeawayIp = takeawayPrinter?.PrinterPath || "";
          }
        } catch (err) {
          console.warn("Failed to fetch printer IPs from PrintMaster:", err);
        }

        // Determine target printer IP based on order type (Dine-in vs Takeaway)
        const isTakeaway =
          !saleData.tableNo ||
          String(saleData.tableNo).trim() === "" ||
          String(saleData.tableNo).toUpperCase().startsWith("TW") ||
          String(saleData.tableNo).toUpperCase() === "TAKEAWAY" ||
          String(saleData.tableNo).toUpperCase() === "TAKE AWAY";

        let targetIp = "";
        if (isTakeaway) {
          targetIp = takeawayIp || cashierIp || company.printerIp || "";
        } else {
          targetIp = cashierIp || company.printerIp || "";
        }

        // Check for device-specific local printer override
        try {
          const localOverride = await AsyncStorage.getItem('@local_printer_override');
          if (localOverride && localOverride.trim()) {
            targetIp = localOverride.trim();
          }
        } catch (_) {}

        const hasConfiguredIp = targetIp && targetIp.trim().length > 0;

        if (hasConfiguredIp) {
          console.log(`🌐 Trying configured printer: ${targetIp}`);
          const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(targetIp.trim());
          const isMac = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(targetIp.trim()) || targetIp.trim().length === 17;

          // 📲 Try Print Bridge if active on network (supports USB / Shared printers like TD80)
          const isBridge = await this.isBridgeOnline();
          if (isBridge) {
            try {
              console.log(`📡 [Print Bridge] Queueing receipt to Print Bridge for: ${targetIp}`);
              const colWidth = this.getAutoColWidth(targetIp);
              const text = this.formatThermalTextWithDiscount(saleData, company, discountInfo, colWidth);
              const pType = isTakeaway ? 3 : 1;
              const success = await this.queuePrintJob(pType, undefined, text, targetIp);
              if (success) return;
            } catch (bridgeErr) {
              console.warn("Print Bridge queue failed, trying direct connection:", bridgeErr);
            }
          }

          let isReachable = false;
          if (isIp) {
            // On Android native APK, thermal printers use raw TCP port 9100 without port 80 webserver
            isReachable = Platform.OS === "android" ? true : await this.isIpReachable(targetIp);
          } else {
            isReachable = true; // For Bluetooth MAC addresses
          }

          if (isReachable) {
            try {
              const printPromise = this.printNetwork(
                saleData,
                outletId,
                {
                  type: isIp ? "network" : "bluetooth",
                  address: targetIp,
                } as any,
                discountInfo,
              );

              const timeoutMs = isMac ? 12000 : 5000;
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(isMac ? "BT Timeout" : "WiFi Timeout")), timeoutMs),
              );
              const printed = await Promise.race([printPromise, timeoutPromise]);

              if (printed) return;
            } catch (err) {
              console.log("Printer failed/timeout:", err);
            }
          }
          const printerLabel = isMac ? "Bluetooth printer" : "LAN/Wi-Fi printer";
          Alert.alert(
            "Printer Connection Error",
            `Could not connect to the configured ${printerLabel} at ${targetIp}. Opening print preview...`,
          );
          await this.offerPDFFallback(saleData, outletId, t, discountInfo);
          return;
        }

        // If no IP is configured, print using the Sunmi built-in printer
        console.log("🖨️ No printer IP configured. Printing to Sunmi built-in printer.");
        try {
          const printed = await this.printThermalReceipt(
            saleData,
            outletId,
            undefined,
            discountInfo,
          );
          if (printed) return;
        } catch (e) {
          console.log("Sunmi failed/timeout", e);
        }

        // Fallback to PDF/Web (Guaranteed)
        console.log("🔄 Fallback to PDF Preview");
        await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      } catch (error) {
        console.log("SmartPrint error:", error);
        await this.offerPDFFallback(saleData, outletId, t, discountInfo);
      }
    })();

    return true;
  }

  /**
   * Print Checkout Bill (Guest Check)
   * Uses the same branding as the receipt but shows 'PAYMENT PENDING'
   */
  static async printCheckoutBill(
    saleData: any,
    outletId?: string | number,
    discountInfo?: DiscountInfo,
  ): Promise<boolean> {
    try {
      // ✅ FIX: Match the logic in PaymentSuccess by ensuring we have a valid ID
      const targetUserId = outletId || "1";
      const company = await BillPDFGenerator.loadSettings(targetUserId);

      // Set checkout flag for the template
      const enhancedSaleData = {
        ...saleData,
        isCheckout: true,
        // Ensure branding is present for the template
        shopName: company.name,
        shopAddress: company.address,
        shopPhone: company.phone,
        shopEmail: company.email,
        shopGst: company.gstNo,
      };

      // Use the standard smartPrint logic but with the checkout flag
      return await this.smartPrint(
        enhancedSaleData,
        targetUserId,
        undefined,
        discountInfo,
      );
    } catch (error: any) {
      console.error("❌ Checkout Print Error:", error);
      return false;
    }
  }

  // ==================== THERMAL PRINTING WITH DISCOUNT ====================
  private static async printThermalReceipt(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo,
    discountInfo?: DiscountInfo,
  ): Promise<boolean> {
    try {
      // ✅ STEP 1: Try Sunmi direct print (NO preview)
      const sunmiReady = await SunmiPrinterService.init();
      if (sunmiReady) {
        const company = await BillPDFGenerator.loadSettings(userId);

        // ✅ Pass discount to saleData for Sunmi printer
        const enhancedSaleData = { ...saleData };
        let discAmount = discountInfo?.amount;
        if (discountInfo?.applied && (!discAmount || discAmount === 0) && discountInfo.value > 0) {
          let grossTotal = 0;
          let totalItemDiscount = 0;
          (saleData.items || []).forEach((item: any) => {
            if (item.status === "VOIDED") return;
            const qtyNum = parseInt(String(item.qty || item.quantity || 1)) || 1;
            const isCombo = item.isCombo === true || String(item.isCombo) === "1" || item.isCombo === 1;
            const discountBasis = isCombo ? (item.basePrice ?? item.price ?? 0) : (item.price ?? 0);
            const baseTotal = (item.price || 0) * qtyNum;
            let itemDiscount = 0;
            const discAmt = Number(item.discountAmount ?? item.discount ?? 0);
            const discType = item.discountType || "percentage";
            if (discAmt > 0) {
              if (discType === "percentage") {
                itemDiscount = (discountBasis * (discAmt / 100)) * qtyNum;
              } else {
                itemDiscount = Math.min(discAmt, discountBasis) * qtyNum;
              }
            }
            grossTotal += baseTotal;
            totalItemDiscount += itemDiscount;
          });
          const subtotalPostItemDisc = grossTotal - totalItemDiscount;
          if (discountInfo.type === "percentage") {
             discAmount = (subtotalPostItemDisc * discountInfo.value) / 100;
          } else {
             discAmount = Math.min(discountInfo.value, subtotalPostItemDisc);
          }
        }
        if (discountInfo?.applied && discAmount && discAmount > 0) {
          enhancedSaleData.discountAmount = discAmount;
          enhancedSaleData.discountType = discountInfo.type;
          enhancedSaleData.discountValue = discountInfo.value;
          enhancedSaleData.originalTotal = saleData.total + discAmount;
        }

        const printed = await SunmiPrinterService.printReceipt(
          enhancedSaleData,
          company,
        );
        if (printed) {
          console.log("✅ Printed with Sunmi printer - NO PREVIEW");
          return true;
        }
      }

      // ✅ STEP 2: If Sunmi fails, return false so smartPrint falls back to PDF dialog/share
      return false;
    } catch (error: any) {
      console.log("Thermal print error:", error);
      return false;
    }
  }
  private static async getBase64LogoStr(logoUrl: string): Promise<string | null> {
    if (!logoUrl) return null;
    try {
      let url = logoUrl;
      if (url && !url.startsWith("http") && !url.startsWith("data:")) {
        url = url.startsWith("/") ? `${API_URL}${url}` : `${API_URL}/${url}`;
      }
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const FileSystem = require('expo-file-system');
        const filename = 'temp_logo_thermal_' + Date.now() + '.png';
        const fileUri = FileSystem.cacheDirectory + filename;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri);
        const base64 = await FileSystem.readAsStringAsync(downloadRes.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (_) {}
        return base64;
      }
    } catch (e) {
      console.warn("Failed to convert logo to base64 for thermal printer:", e);
    }
    return null;
  }


  public static getAutoColWidth(targetAddress?: string, printer?: PrinterInfo): number {
    // 1. Explicit paper size preference on printer object
    if (printer?.paperSize === "58mm") return 32;
    if (printer?.paperSize === "80mm") return 48;

    // 2. Intelligent prediction from printer name or address descriptor
    const descriptor = `${(printer as any)?.PrinterName || ''} ${(printer as any)?.name || ''} ${targetAddress || ''}`.toLowerCase();
    if (descriptor.includes("58mm") || descriptor.includes("pos-58") || descriptor.includes("pos58") || /\b58\b/.test(descriptor)) {
      return 32;
    }
    if (descriptor.includes("80mm") || descriptor.includes("pos-80") || descriptor.includes("pos80") || descriptor.includes("td80") || /\b80\b/.test(descriptor)) {
      return 48;
    }

    // 2.5 Lookup in cached kitchen printers list
    if (targetAddress && this.cachedPrinters && Array.isArray(this.cachedPrinters)) {
      const cleanTarget = targetAddress.trim().toLowerCase();
      const matched = this.cachedPrinters.find(
        (p: any) =>
          (p.PrinterPath && p.PrinterPath.trim().toLowerCase() === cleanTarget) ||
          (p.PrinterIP && p.PrinterIP.trim().toLowerCase() === cleanTarget),
      );
      if (matched) {
        const mDesc = `${matched.PrinterName || ''} ${matched.PrinterPath || ''}`.toLowerCase();
        if (mDesc.includes("58mm") || mDesc.includes("pos-58") || mDesc.includes("pos58") || /\b58\b/.test(mDesc)) return 32;
        if (mDesc.includes("80mm") || mDesc.includes("pos-80") || mDesc.includes("pos80") || mDesc.includes("td80") || /\b80\b/.test(mDesc)) return 48;
      }
    }

    // 3. External printer configured (LAN IP, Bluetooth, or Windows Print Bridge) -> standard POS 80mm
    if (targetAddress && targetAddress.trim().length > 0) {
      return 48;
    }

    // 4. Built-in device printer (e.g. Sunmi built-in handheld vs desktop terminal)
    if (Platform.OS === "android") {
      try {
        const sunmiSize = SunmiPrinterManager.getPaperSize();
        if (sunmiSize === "58mm") return 32;
        if (sunmiSize === "80mm") return 48;
      } catch (_) {}
    }

    // Default standard for POS thermal receipt printers: 80mm (48 columns)
    return 48;
  }

  // ==================== NETWORK PRINTING ====================
  private static async printNetwork(
    saleData: any,
    userId?: string | number,
    printer?: PrinterInfo,
    discountInfo?: DiscountInfo,
  ): Promise<boolean> {
    try {
      const company = await BillPDFGenerator.loadSettings(userId);
      const targetAddress = printer?.address || company.printerIp || "";
      if (!targetAddress) return false;

      const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(targetAddress);
      const colWidth = this.getAutoColWidth(targetAddress, printer);

      let text = this.formatThermalTextWithDiscount(
        saleData,
        company,
        discountInfo,
        colWidth,
      );

      // Prepend company logo if configured and visible
      if (company.showCompanyLogo && company.companyLogo) {
        const base64Logo = await this.getBase64LogoStr(company.companyLogo);
        if (base64Logo) {
          text = `[C]<img>${base64Logo}</img>\n\n` + text;
        }
      }

      // Append halal logo at the end if configured and visible
      if (company.showHalalLogo && company.halalLogo) {
        const base64Halal = await this.getBase64LogoStr(company.halalLogo);
        if (base64Halal) {
          text = text + `\n\n[C]<img>${base64Halal}</img>\n`;
        }
      }

      if (isIp) {
        await ThermalPrinter.printTcp({
          ip: targetAddress,
          port: 9100,
          payload: text,
          mmFeedPaper: 60,
        });
      } else {
        await ThermalPrinter.getBluetoothDeviceList().catch(() => {});
        await ThermalPrinter.printBluetooth({
          macAddress: targetAddress,
          payload: text,
          mmFeedPaper: 60,
        });
      }
      return true;
    } catch (error: any) {
      console.log("❌ Network print error:", error);
      return false;
    }
  }

  private static formatTwoCols(left: any, right: any, totalWidth: number = 48): string {
    const rawLeft = String(left || "");
    const rawRight = String(right || "");

    // Strip ESC/POS formatting tags for accurate line length calculation
    const cleanLeft = rawLeft.replace(/\[[CLRCB]\]|<[^>]*>/g, "");
    const cleanRight = rawRight.replace(/\[[CLRCB]\]|<[^>]*>/g, "");

    const spaceCount = totalWidth - cleanLeft.length - cleanRight.length;
    if (spaceCount > 0) {
      const leftPart = rawLeft.startsWith("[") || rawLeft.startsWith("<") ? rawLeft : `[L]${rawLeft}`;
      return `${leftPart}${" ".repeat(spaceCount)}${rawRight}\n`;
    } else {
      const leftPart = rawLeft.startsWith("[") || rawLeft.startsWith("<") ? rawLeft : `[L]${rawLeft}`;
      return `${leftPart}\n[L]${rawRight.padStart(totalWidth, " ")}\n`;
    }
  }

  private static formatThermalTextWithDiscount(
    saleData: any,
    company: any,
    discountInfo?: DiscountInfo,
    colWidth?: number,
  ): string {
    const effectiveWidth = colWidth || this.getAutoColWidth(company?.printerIp);
    const symbol = company.currencySymbol || "$";
    const isCheckout = !!saleData.isCheckout;
    const companySettings = useCompanySettingsStore.getState().settings;
    const takeawayRate = companySettings?.takeawayCharges || 0;

    const lineEq = "[C]" + "=".repeat(effectiveWidth) + "\n";
    const lineDash = "[L]" + "-".repeat(effectiveWidth) + "\n";

    let text = "\n\n" + lineEq;
    if (isCheckout) {
      text += "[C]<font size='big'><B>CHECKOUT BILL</B></font>\n";
      text += "[C]<B>PAYMENT PENDING</B>\n";
    } else {
      text += "[C]<font size='big'><B>PAYMENT RECEIPT</B></font>\n";
    }
    text += lineEq;

    // Header Info (Store Name in Big Bold)
    text += `[C]<font size='big'><B>${(company.name || "YOUR STORE").toUpperCase()}</B></font>\n`;
    if (company.address) text += `[C]${company.address}\n`;
    if (company.phone) text += `[C]Tel: ${company.phone}\n`;
    if (company.email) text += `[C]Email: ${company.email}\n`;
    if (company.gstNo) text += `[C]GST: ${company.gstNo}\n`;
    text += lineDash;

    const parseLocalDate = (d: any) => {
      if (!d) return new Date();
      if (d instanceof Date) return d;
      const { parseDatabaseDate } = require('../utils/timezoneHelper');
      return parseDatabaseDate(d);
    };

    const saleDate = saleData.originalDate ? parseLocalDate(saleData.originalDate) : 
                     saleData.date ? parseLocalDate(saleData.date) : 
                     new Date();

    const dateFormatted = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: '2-digit', year: 'numeric' }).format(saleDate);
    const { showBillTime } = useGeneralSettingsStore.getState().settings;
    const displayTime = showBillTime !== false;
    const timeFormatted = displayTime ? ` ${formatToSingaporeTime(saleDate)}` : "";

    if (saleData.tableNo) {
      const cleanTableNo = /^\d+$/.test(String(saleData.tableNo).trim()) 
        ? String(saleData.tableNo).trim().padStart(2, '0') 
        : saleData.tableNo;
      text += this.formatTwoCols(`<B>Bill No: ${saleData.invoiceNumber || saleData.id || saleData.orderId || ""}</B>`, `<B>TABLE: ${cleanTableNo}</B>`, effectiveWidth);
    } else {
      text += `[L]<B>Bill No: ${saleData.invoiceNumber || saleData.id || saleData.orderId || ""}</B>\n`;
    }
    text += `[L]<B>Date: ${dateFormatted}${timeFormatted}</B>\n`;
    if (saleData.waiterName && saleData.waiterName !== "Staff") {
      const isQuick = !!(saleData.isQuickServe || saleData.isQuick || saleData.isQuickServeMode || (typeof saleData.waiterName === "string" && saleData.waiterName.toLowerCase().includes("(quick serve)")));
      const displayWaiter = isQuick ? (saleData.waiterName.toLowerCase().includes("(quick serve)") ? saleData.waiterName : `${saleData.waiterName} (quick serve)`) : saleData.waiterName;
      text += `[L]<B>Waiter: ${displayWaiter}</B>\n`;
    }
    if (saleData.mobileNo) {
      text += `[L]<B>Member Phone: ${saleData.mobileNo}</B>\n`;
    }
    text += lineDash;

    // Items Header - Adopt column layout (48 cols for 80mm, 32 cols for 58mm)
    if (effectiveWidth === 32) {
      const itemH = "ITEM".padEnd(12, " ") + "QTY".padStart(3, " ") + "PRICE".padStart(7, " ") + "TOTAL".padStart(10, " ");
      text += `[L]<B>${itemH}</B>\n`;
    } else {
      const itemH = "ITEM".padEnd(24, " ") + "QTY".padStart(4, " ") + "PRICE".padStart(10, " ") + "TOTAL".padStart(10, " ");
      text += `[L]<B>${itemH}</B>\n`;
    }
    text += lineDash;

    const printItems = (saleData.items || []).filter(
      (i: any) => i.status !== "VOIDED",
    );
    const activeItems = (saleData.items || []).filter((i: any) => i.status !== "VOIDED" && i.statusCode !== 0);
    const allItemsHaveSC = activeItems.length > 0 && activeItems.every((item: any) => {
      const isTakeawayItem = item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway;
      return !isTakeawayItem && (Number(item.isServiceCharge) === 1 || item.isServiceCharge === true);
    });

    printItems.forEach((item: any) => {
      const isTW = item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway;
      const hasTWCharge = takeawayRate > 0 || (item.TakeawayCharge !== null && item.TakeawayCharge !== undefined && parseFloat(String(item.TakeawayCharge)) > 0);
      const rawName = item.name || item.DishName || item.ProductName || "";
      const fullName = isTW && hasTWCharge ? `${rawName} [TW]` : rawName;
      const qtyNum =
        parseFloat(String(item.qty || item.quantity || item.Quantity || 1)) || 1;
      const qtyStr = Number.isInteger(qtyNum) ? String(qtyNum) : qtyNum.toFixed(1);
      const qty = qtyStr;

      const priceNum =
        parseFloat(String(item.price || item.Price || item.Cost || 0)) || 0;
      const price = `${symbol}${priceNum.toFixed(2)}`;
      const totalNum = priceNum * qtyNum;
      const total = `${symbol}${totalNum.toFixed(2)}`;

      if (effectiveWidth === 32) {
        // Sunmi 58mm PrintFormatter Column Math (32 cols max)
        const nameWidth = 12;
        const qtyWidth = 3;
        const priceWidth = 7;
        const totalWidth = 10;

        if (fullName.length > nameWidth) {
          text += `[L]<B>${fullName}</B>\n`;
          let line = "".padEnd(nameWidth, " ");
          line += qty.padStart(qtyWidth, " ");
          line += price.padStart(priceWidth, " ");
          line += total.padStart(totalWidth, " ");
          text += `[L]<B>${line}</B>\n`;
        } else {
          let line = fullName.padEnd(nameWidth, " ");
          line += qty.padStart(qtyWidth, " ");
          line += price.padStart(priceWidth, " ");
          line += total.padStart(totalWidth, " ");
          text += `[L]<B>${line}</B>\n`;
        }
      } else {
        // 48-column layout (80mm)
        const name48 = fullName.substring(0, 24).padEnd(24);
        const qty48 = qty.padStart(4);
        const price48 = price.padStart(10);
        const total48 = total.padStart(10);
        text += `[L]<B>${name48}${qty48}${price48}${total48}</B>\n`;
        if (fullName.length > 24) {
          text += `[L]<B>   ${fullName.substring(24)}</B>\n`;
        }
      }

      const songName = item.songName || item.SongName || "";
      if (songName) {
        text += `[L]<B>   🎵 ${songName}</B>\n`;
      }

      // Modifiers
      if (item.modifiers && Array.isArray(item.modifiers)) {
        item.modifiers.forEach((m: any) => {
          const mName = (m.ModifierName || m.modifierName || m.name || m.ModifierNameEn || "").trim();
          if (!mName) return;
          if (mName.toUpperCase().startsWith('INSTR:')) return;
          if (/service\s*charge/i.test(mName)) return;
          text += `[L]<B>        + ${mName}</B>\n`;
        });
      }

      // Combo selections
      const comboSels = item.comboSelections || 
        (typeof item.ComboDetailsJSON === 'string' && item.ComboDetailsJSON 
          ? (() => { try { const p = JSON.parse(item.ComboDetailsJSON); return Array.isArray(p) ? p : p.groups || p.items || []; } catch { return undefined; } })() 
          : (Array.isArray(item.ComboDetailsJSON) ? item.ComboDetailsJSON : undefined)) || [];
      const hasCombo = Array.isArray(comboSels) && comboSels.length > 0;
      if (hasCombo) {
        comboSels.forEach((group: any) => {
          const choices = group.items || group.dishes || (Array.isArray(group) ? group : [group]);
          if (Array.isArray(choices)) {
            choices.forEach((opt: any) => {
              const optName = opt.name || opt.DishName || opt.itemName || "";
              if (optName) {
                text += `[L]<B>        - ${optName}</B>\n`;
              }
            });
          }
        });
      }

      // Item Discount
      const discAmt = Number(item.discountAmount ?? item.discount ?? 0);
      if (discAmt > 0) {
        const discType = item.discountType || "percentage";
        const isCombo = item.isCombo === true || String(item.isCombo) === "1" || item.isCombo === 1;
        const discountBasis = isCombo ? (item.basePrice ?? item.price ?? 0) : (item.price ?? 0);
        const effectiveDisc = discType === "percentage" ? discAmt : Math.min(discAmt, discountBasis);
        const discStr =
          discType === "percentage"
            ? `-${discAmt}%`
            : `-${symbol}${effectiveDisc.toFixed(2)}`;
        text += `[L]<B>      Discount: ${discStr}</B>\n`;
      }

      // VIP Discount
      const vipDiscAmt = Number(item.vipDiscountAmount || 0);
      if (vipDiscAmt > 0) {
        text += `[L]<B>      VIP Discount: -${symbol}${(vipDiscAmt).toFixed(2)}</B>\n`;
      }
    });

    text += lineDash;

    // Totals Calculation
    let grossTotal = 0;
    let totalItemDiscount = 0;
    let totalVipDiscount = parseFloat(String(saleData.vipDiscountAmount || 0)) || 0;
    (saleData.items || []).forEach((item: any) => {
      if (item.status === "VOIDED") return;
      const qtyNum = parseFloat(String(item.qty || item.quantity || 1)) || 1;
      const isCombo = item.isCombo === true || String(item.isCombo) === "1" || item.isCombo === 1;
      const discountBasis = isCombo ? (item.basePrice ?? item.price ?? 0) : (item.price ?? 0);
      const baseTotal = Math.round((item.price || 0) * qtyNum * 100) / 100;
      let itemDiscount = 0;
      const discAmt = Number(item.discountAmount ?? item.discount ?? 0);
      const discType = item.discountType || "percentage";
      if (discAmt > 0) {
        if (discType === "percentage") {
          itemDiscount = (discountBasis * (discAmt / 100)) * qtyNum;
        } else {
          itemDiscount = Math.min(discAmt, discountBasis) * qtyNum;
        }
      }
      itemDiscount = Math.round(itemDiscount * 100) / 100;
      grossTotal += baseTotal;
      totalItemDiscount += itemDiscount;
      if (!saleData.vipDiscountAmount && item.vipDiscountAmount > 0) {
        totalVipDiscount += parseFloat(String(item.vipDiscountAmount));
      }
    });

    const finalDiscountInfo =
      discountInfo ||
      (saleData.discount
        ? {
            applied: true,
            type: saleData.discount.type || "percentage",
            value: saleData.discount.value || 0,
            amount: saleData.discount.amount || 0,
          }
        : saleData.discountAmount && saleData.discountAmount > 0
          ? {
              applied: true,
              type: saleData.discountType || "percentage",
              value: saleData.discountValue || 0,
              amount: saleData.discountAmount,
            }
          : null);

    let orderDiscount = finalDiscountInfo?.amount || 0;
    if (finalDiscountInfo?.applied && orderDiscount === 0 && finalDiscountInfo.value > 0) {
      const subtotalPostItemDisc = grossTotal - totalItemDiscount;
      if (finalDiscountInfo.type === "percentage") {
         orderDiscount = (subtotalPostItemDisc * finalDiscountInfo.value) / 100;
      } else {
         orderDiscount = Math.min(finalDiscountInfo.value, subtotalPostItemDisc);
      }
      if (finalDiscountInfo) {
         finalDiscountInfo.amount = orderDiscount;
      }
    }
    
    if (saleData.isSplitChit && orderDiscount > 0) {
      const originalCart = useCartStore.getState().carts[useCartStore.getState().currentContextId!] || [];
      const originalSubtotal = originalCart.reduce((sum: number, item: any) => {
        if (item.status === "VOIDED") return sum;
        return sum + (item.price || 0) * item.qty;
      }, 0);
      
      if (originalSubtotal > 0 && Math.abs(originalSubtotal - grossTotal) > 0.05) {
        const ratio = grossTotal / originalSubtotal;
        orderDiscount = orderDiscount * ratio;
      }
    }
    orderDiscount = Math.round(orderDiscount * 100) / 100;

    const hasAnyDiscount = totalItemDiscount > 0 || orderDiscount > 0 || totalVipDiscount > 0;
    let currentSubtotal = grossTotal;

    text += this.formatTwoCols("<B>Sub Total:</B>", `<B>${symbol}${grossTotal.toFixed(2)}</B>`, effectiveWidth);

    if (totalItemDiscount > 0) {
      text += this.formatTwoCols("<B>Item Discounts:</B>", `<B>-${symbol}${totalItemDiscount.toFixed(2)}</B>`, effectiveWidth);
      currentSubtotal -= totalItemDiscount;
    }

    if (orderDiscount > 0) {
      const discLabel =
        finalDiscountInfo?.type === "percentage"
          ? `<B>Discount (${finalDiscountInfo.value}%):</B>`
          : "<B>Discount:</B>";
      text += this.formatTwoCols(discLabel, `<B>-${symbol}${orderDiscount.toFixed(2)}</B>`, effectiveWidth);
      currentSubtotal -= orderDiscount;
    }

    if (totalVipDiscount > 0) {
      text += this.formatTwoCols("<B>VIP Discount Savings:</B>", `<B>-${symbol}${totalVipDiscount.toFixed(2)}</B>`, effectiveWidth);
      currentSubtotal -= totalVipDiscount;
    }

    currentSubtotal = Math.round(currentSubtotal * 100) / 100;

    if (hasAnyDiscount) {
      text += lineDash;
      text += this.formatTwoCols("<B>Net Amount:</B>", `<B>${symbol}${currentSubtotal.toFixed(2)}</B>`, effectiveWidth);
    }

    let finalTotal = saleData.total || saleData.totalAmount || currentSubtotal;
    const hasGST = (company.gstPercentage || 0) > 0;
    const gstRate = company.gstPercentage || 0;
    const scPercentage = company.serviceChargePercentage || 0;
    const savedSC = saleData.serviceCharge != null ? parseFloat(String(saleData.serviceCharge)) : null;
    
    let serviceChargeAmount = 0;
    if (savedSC !== null) {
      serviceChargeAmount = savedSC;
    } else {
      let scEligibleSubtotal = 0;
      (saleData.items || []).forEach((item: any) => {
        if (item.status === "VOIDED") return;
        const qtyNum = parseFloat(String(item.qty || item.quantity || 1)) || 1;
        const isCombo = item.isCombo === true || String(item.isCombo) === "1" || item.isCombo === 1;
        const discountBasis = isCombo ? (item.basePrice ?? item.price ?? 0) : (item.price ?? 0);
        const baseTotal = (item.price || 0) * qtyNum;
        let itemDiscount = 0;
        const discAmt = Number(item.discountAmount ?? item.discount ?? 0);
        const discType = item.discountType || "percentage";
        if (discAmt > 0) {
          if (discType === "percentage") {
            itemDiscount = (discountBasis * (discAmt / 100)) * qtyNum;
          } else {
            itemDiscount = Math.min(discAmt, discountBasis) * qtyNum;
          }
        }
        const itemSubtotal = baseTotal - itemDiscount;
        const isTakeawayItem = item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway;
        const isSC = !isTakeawayItem && (Number(item.isServiceCharge) === 1 || item.isServiceCharge === true);
        if (isSC) {
          scEligibleSubtotal += itemSubtotal;
        }
      });
      let scEligibleNet = scEligibleSubtotal;
      if (grossTotal > 0 && orderDiscount > 0) {
        const subtotalPostItemDisc = grossTotal - totalItemDiscount;
        if (subtotalPostItemDisc > 0) {
          const proportion = scEligibleSubtotal / subtotalPostItemDisc;
          scEligibleNet = Math.max(0, scEligibleSubtotal - proportion * orderDiscount);
        }
      }
      serviceChargeAmount = scEligibleNet * (scPercentage / 100);
    }
    const hasSC = serviceChargeAmount > 0;

    let globalTakeawayQty = 0;
    let globalTakeawayCharge = 0;
    let specificTakeawayCharge = 0;

    const savedTakeawayCharge = saleData.takeawayCharge != null ? parseFloat(String(saleData.takeawayCharge)) : null;
    (saleData.items || []).forEach((item: any) => {
      const isTW = item.isTakeaway || item.IsTakeaway || item.isTakeAway || item.IsTakeAway;
      const isVoided = item.status === "VOIDED" || item.StatusCode === 0;
      if (isTW && !isVoided) {
        const qty = Number(item.qty || item.quantity || 1);
        const hasSpecific = item.TakeawayCharge !== null && item.TakeawayCharge !== undefined && !isNaN(parseFloat(String(item.TakeawayCharge))) && parseFloat(String(item.TakeawayCharge)) > 0;
        const isSpecific = hasSpecific && parseFloat(String(item.TakeawayCharge)) !== takeawayRate;
        if (isSpecific) {
          specificTakeawayCharge += qty * parseFloat(String(item.TakeawayCharge));
        } else {
          globalTakeawayQty += qty;
          globalTakeawayCharge += qty * takeawayRate;
        }
      }
    });
    const takeawayCharge = savedTakeawayCharge !== null && savedTakeawayCharge !== undefined ? savedTakeawayCharge : (globalTakeawayCharge + specificTakeawayCharge);
    
    const taxableAmount = currentSubtotal + serviceChargeAmount + takeawayCharge;
    const gstAmountRaw = hasGST ? taxableAmount * (gstRate / 100) : 0;
    const gstAmount = Math.round(gstAmountRaw * 100) / 100;
    
    if (saleData.isCheckout || finalTotal === 0) {
      finalTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
    }
    
    const storedRoundOff = saleData.roundOff !== undefined && saleData.roundOff !== null
      ? parseFloat(String(saleData.roundOff))
      : null;
    const difference = parseFloat((finalTotal - (taxableAmount + gstAmount)).toFixed(2));
    const printedRoundOff = (storedRoundOff !== null && !isNaN(storedRoundOff) && storedRoundOff !== 0)
      ? storedRoundOff
      : (!saleData.isCheckout && Math.abs(difference) >= 0.01 ? difference : 0);

    if (hasSC) {
      text += this.formatTwoCols(allItemsHaveSC ? "<B>Service Charge:</B>" : "<B>Item Service Charge:</B>", `<B>${symbol}${serviceChargeAmount.toFixed(2)}</B>`, effectiveWidth);
    }

    if (globalTakeawayCharge > 0) {
      text += this.formatTwoCols(`<B>Takeaway Charges (${symbol}${takeawayRate.toFixed(2)}*${globalTakeawayQty}):</B>`, `<B>${symbol}${globalTakeawayCharge.toFixed(2)}</B>`, effectiveWidth);
    }
    if (specificTakeawayCharge > 0) {
      text += this.formatTwoCols("<B>Takeaway Charges (Item-wise):</B>", `<B>${symbol}${specificTakeawayCharge.toFixed(2)}</B>`, effectiveWidth);
    }

    if (hasGST && gstAmount > 0) {
      text += this.formatTwoCols(`<B>GST (${gstRate}%):</B>`, `<B>${symbol}${gstAmount.toFixed(2)}</B>`, effectiveWidth);
      text += lineDash;
    }

    if (printedRoundOff && printedRoundOff !== 0) {
      const roSign = printedRoundOff > 0 ? "+" : (printedRoundOff < 0 ? "-" : "");
      text += this.formatTwoCols("<B>Round Off:</B>", `<B>${roSign}${symbol}${Math.abs(printedRoundOff).toFixed(2)}</B>`, effectiveWidth);
      text += lineDash;
    }

    // Payment Details (Hide on checkout bills, show on settled receipts)
    if (!isCheckout) {
      if (saleData.payments && Array.isArray(saleData.payments) && saleData.payments.length > 0) {
        text += "[L]<B>Payment Details:</B>\n";
        saleData.payments.forEach((p: any) => {
          let modeText = String(p.payMode || p.payModeName || p.Remarks || "Payment");
          if (modeText.toUpperCase().trim() === "FOC") modeText = "FOC (Discount)";
          const modeLabel = `  ${modeText}`;
          const amountVal = `${symbol}${parseFloat(p.amount).toFixed(2)}`;
          text += this.formatTwoCols(`<B>${modeLabel}</B>`, `<B>${amountVal}</B>`, effectiveWidth);
        });
        text += lineDash;
      } else {
        let methodText = String(saleData.paymentMethod || "Payment");
        if (methodText.toUpperCase().trim() === "FOC") methodText = "FOC (Discount)";
        const methodLabel = `  ${methodText}`;
        const amountVal = `${symbol}${parseFloat(finalTotal).toFixed(2)}`;
        text += this.formatTwoCols(`<B>${methodLabel}</B>`, `<B>${amountVal}</B>`, effectiveWidth);
        text += lineDash;
      }
    }

    // High visibility large bold TOTAL
    text += `[R]<font size='big'><B>TOTAL: ${symbol}${finalTotal.toFixed(2)}</B></font>\n`;

    // Reward points summary
    if (saleData.rewardPointsEarned && parseFloat(String(saleData.rewardPointsEarned)) > 0) {
      text += lineDash;
      text += this.formatTwoCols("<B>Reward Points Earned:</B>", `<B>+${symbol}${parseFloat(String(saleData.rewardPointsEarned)).toFixed(2)}</B>`, effectiveWidth);
      if (saleData.memberRewardBalance && parseFloat(String(saleData.memberRewardBalance)) > 0) {
        text += this.formatTwoCols("<B>Available Member Credit:</B>", `<B>${symbol}${parseFloat(String(saleData.memberRewardBalance)).toFixed(2)}</B>`, effectiveWidth);
      }
    }

    text += lineEq;
    if (isCheckout) {
      text += "[C]<B>*** PLEASE PAY AT THE COUNTER ***</B>\n";
    }
    text += "[C]<B>THANK YOU! COME AGAIN!</B>\n";
    text += "[C]SMART-CLUB BY UNIPR0SG\n\n\n\n";

    return text;
  }

  // ==================== PDF FALLBACK WITH DISCOUNT ====================
  static async offerPDFFallback(
    saleData: any,
    userId?: string | number,
    t?: any,
    discountInfo?: DiscountInfo,
  ): Promise<boolean> {
    if (Platform.OS === "web") {
      // ✅ WEB: Fail-proof Iframe printing
      try {
        const company = await BillPDFGenerator.loadSettings(userId);
        const html = await BillPDFGenerator.generateHTML(
          saleData,
          userId,
          discountInfo,
          company,
        );
        const invoiceName = `Invoice_${saleData.invoiceNumber || saleData.id}`;

        // ✅ CRITICAL: Temporarily change main document title for the browser's Save dialog
        const originalTitle = document.title;
        document.title = invoiceName;

        let frame = document.getElementById(
          "print-iframe",
        ) as HTMLIFrameElement;
        if (!frame) {
          frame = document.createElement("iframe");
          frame.id = "print-iframe";
          frame.style.display = "none";
          document.body.appendChild(frame);
        }

        const doc = frame.contentWindow?.document || frame.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();

          let printed = false;
          const triggerPrint = () => {
            if (printed) return;
            printed = true;
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            setTimeout(() => {
              document.title = originalTitle;
            }, 1000);
          };

          // Wait for images to load in the iframe
          frame.contentWindow?.addEventListener("load", triggerPrint);

          // Fallback if load event doesn't fire
          setTimeout(triggerPrint, 1000);
        }
        return true;
      } catch (err) {
        console.error("Web print error:", err);
        return false;
      }
    }

    // Native Silent PDF Fallback without Alert prompt
    try {
      console.log("Generating PDF fallback silently...");
      const company = await BillPDFGenerator.loadSettings(userId);
      const html = await BillPDFGenerator.generateHTML(
        saleData,
        userId,
        discountInfo,
        company,
      );

      if (Platform.OS === "ios") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          width: 226,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
      return true;
    } catch (error) {
      console.error("PDF Fallback Error:", error);
      return false;
    }
  }

  // ==================== UTILITIES ====================
  private static async checkAndroidPrintService(): Promise<boolean> {
    return Platform.OS === "android";
  }

  static async routeAndPrintOrderKOT(
    orderId: string,
    orderContext: { orderType?: string; tableNo?: string; takeawayNo?: string; section?: string },
    items: any[],
    isAdditional: boolean = false,
    waiterName: string = "Staff",
    skipDuplicateGuard: boolean = false
  ): Promise<boolean> {
    try {
      // 1. Duplicate-print guard (QR socket path only; cashier path passes skipDuplicateGuard=true)
      // Pass the raw items (pre-expansion) so the fingerprint reflects what the backend sent.
      if (!skipDuplicateGuard && this.isDuplicatePrint(orderId, items)) {
        return false;
      }

      // 2. Check enableKOT setting (same setting the cashier flow checks)
      const { useGeneralSettingsStore } = await import("../stores/generalSettingsStore");
      const { enableKOT, enableKDSPrint } = useGeneralSettingsStore.getState().settings;
      if (!enableKOT) {
        if (__DEV__) console.log("🖨️ [UniversalPrinter] KOT printing is disabled in General Settings.");
        return false;
      }

      // 3. Expand combo sub-items that belong to a different kitchen
      const expandedItems: any[] = [];
      items.forEach((item: any) => {
        expandedItems.push(item);
        if (item.comboSelections && item.comboSelections.length > 0) {
          item.comboSelections.forEach((g: any) => {
            if (Array.isArray(g.items)) {
              g.items.forEach((opt: any) => {
                const optKitchenCode =
                  opt.KitchenTypeCode || opt.kitchenCode || opt.kitchenTypeCode;
                const parentKitchenCode =
                  item.KitchenTypeCode || item.kitchenCode || item.kitchenTypeCode || "0";
                if (optKitchenCode && optKitchenCode !== parentKitchenCode) {
                  expandedItems.push({
                    ...opt,
                    id: opt.dishId,
                    qty: item.quantity || item.qty || 1,
                    price: 0,
                    name: `${opt.name}\n(Combo - ${item.name})`,
                    KitchenTypeCode: optKitchenCode,
                    KitchenTypeName: opt.KitchenTypeName || opt.kitchenTypeName,
                    PrinterIP: opt.PrinterIP || opt.printerIp,
                  });
                }
              });
            }
          });
        }
      });

      // 4. Group by KitchenTypeCode → one KOT per kitchen
      const kitchenGroups: Record<string, any[]> = {};
      expandedItems.forEach((item: any) => {
        const kCode = item.KitchenTypeCode || "0";
        if (!kitchenGroups[kCode]) kitchenGroups[kCode] = [];
        kitchenGroups[kCode].push(item);
      });

      // 5. Print one KOT per kitchen group
      const tableNo =
        orderContext.orderType === "DINE_IN"
          ? orderContext.tableNo
          : `TW-${orderContext.takeawayNo}`;

      for (const [kCode, groupItems] of Object.entries(kitchenGroups)) {
        const printerIp = groupItems[0].PrinterIP;
        const kotData = {
          orderId,
          orderNo: orderId,
          tableNo,
          waiterName,
          items: groupItems,
          kitchenName:
            groupItems[0].KitchenTypeName || (kCode === "0" ? "KITCHEN" : kCode),
          kitchenCode: kCode,
        };
        await this.printKOT(
          kotData,
          "SYSTEM",
          isAdditional ? "ADDITIONAL" : "NEW",
          printerIp
        );
      }

      // 6. KDS backup copy (respects enableKDSPrint setting)
      if (enableKDSPrint !== false) {
        try {
          const kdsData = {
            orderId,
            orderNo: orderId,
            tableNo,
            waiterName,
            items,
            kitchenName: "KDS",
          };
          await this.printKDSOrder(kdsData, "SYSTEM");
        } catch (kdsErr) {
          console.error("[UniversalPrinter] KDS backup print failed:", kdsErr);
        }
      }

      return true;
    } catch (err) {
      console.error("[UniversalPrinter] routeAndPrintOrderKOT error:", err);
      return false;
    }
  }

  static async printReceiptAuto(settlementData: any): Promise<boolean> {
    try {
      const header = settlementData?.header || {};
      const orderId = header.OrderId || header.SettlementID || "";
      if (orderId && this.isDuplicateReceiptPrint(orderId)) {
        return false;
      }

      const items = settlementData?.items || [];
      const payments = settlementData?.payments || [];

      const isPercentage = header.DiscountType === "percentage";
      const discountValue = isPercentage
        ? Number(header.DiscountPercentage ?? 0)
        : Number(header.DiscountAmount ?? 0);

      const discountInfo: DiscountInfo = {
        applied: Number(header.DiscountAmount ?? 0) > 0,
        type: (header.DiscountType || "fixed") as "fixed" | "percentage",
        value: discountValue,
        amount: Number(header.DiscountAmount ?? 0),
      };

      const saleData = {
        invoiceNumber: header.BillNo || header.SettlementID,
        tableNo: header.TableNo || "TAKEAWAY",
        total: Number(header.SysAmount ?? 0),
        paymentMethod: header.PayMode || "CASH",
        cashPaid: Number(header.SysAmount ?? 0),
        change: 0,
        items: items.map((i: any) => ({
          name: i.DishName || i.Description,
          price: Number(i.Price || i.PricePerUnit || 0),
          qty: Number(i.Qty || i.Quantity || 1),
          status: i.Status || "NORMAL",
          discountAmount: Number(i.DiscountAmount || 0),
          discountType: i.DiscountType || "fixed",
          modifiers: i.modifiers || [],
        })),
        payments: payments.map((p: any) => ({
          payMode: p.PayModeName || p.Remarks || "CASH",
          payModeName: p.PayModeName || p.Remarks || "CASH",
          amount: Number(p.Amount ?? 0),
          referenceNo: p.ReferenceNo || ""
        })),
        roundOff: Number(header.RoundedBy ?? 0),
        date: header.LastSettlementDate || new Date(),
        discountAmount: Number(header.DiscountAmount ?? 0),
        discountType: header.DiscountType || null,
        discountValue: discountValue,
        subTotal: Number(header.SubTotal ?? 0),
        serviceCharge: Number(header.ServiceCharge ?? 0),
        takeawayCharge: Number(header.TakeawayCharge ?? 0),
      };

      return await this.smartPrint(saleData, "1", {}, discountInfo);
    } catch (err) {
      console.error("[UniversalPrinter] printReceiptAuto failed:", err);
      return false;
    }
  }

  static async testAllPrinters(): Promise<void> {
    const printers = await this.detectAllPrinters();
    let message = `📋 Found ${printers.length} printer(s):\n\n`;
    printers.forEach((p, i) => {
      message += `${i + 1}. ${p.name}\n   Type: ${p.type}\n   Paper: ${p.paperSize || "Unknown"}\n   Default: ${p.isDefault ? "✅" : "❌"}\n\n`;
    });
    Alert.alert("Printer Detection", message);
  }
}

export default UniversalPrinter;
