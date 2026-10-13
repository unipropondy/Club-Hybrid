import { Platform } from 'react-native';
import axios from 'axios';

export interface PrintReceiptData {
  orderNumber: string;
  tableNo: string;
  waiterName?: string;
  items: { dishName: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  printedAt: string;
}

export class UniversalPrinterService {
  /**
   * Print receipt across Android mobile devices & Electron counter PC.
   */
  static async printReceipt(data: PrintReceiptData, printerTarget: { ip?: string; type?: 'LAN' | 'BLUETOOTH' | 'ELECTRON' }) {
    console.log(`[PrinterService] Initiating print for order #${data.orderNumber} via ${printerTarget.type || 'DEFAULT'}...`);

    // 1. Electron Desktop App printing route
    if (Platform.OS === 'web' || printerTarget.type === 'ELECTRON') {
      return this.printViaElectronBridge(data, printerTarget.ip || '127.0.0.1');
    }

    // 2. Android native thermal printer driver route
    if (Platform.OS === 'android') {
      return this.printViaAndroidNative(data, printerTarget);
    }

    // Web preview fallback
    console.log('[PrinterService] Platform fallback: simulated print receipt.');
    return { success: true, method: 'SIMULATED' };
  }

  private static async printViaElectronBridge(data: PrintReceiptData, targetIp: string) {
    try {
      const formattedEscPos = this.generateEscPosCommands(data);
      const response = await axios.post('http://127.0.0.1:3000/test-print', {
        ip: targetIp,
        port: 9100,
        payload: formattedEscPos,
      }, { timeout: 5000 });

      return { success: response.data?.success || false, method: 'ELECTRON_BRIDGE' };
    } catch (err: any) {
      console.warn('[PrinterService] Electron bridge print error:', err.message);
      return { success: false, error: err.message };
    }
  }

  private static async printViaAndroidNative(data: PrintReceiptData, target: { ip?: string; type?: string }) {
    try {
      // Use react-native-thermal-printer when running on Android native APK
      const ThermalPrinter = require('react-native-thermal-printer');
      if (target.ip) {
        await ThermalPrinter.default.printTcp({
          ip: target.ip,
          port: 9100,
          payload: this.generateTextReceipt(data),
        });
        return { success: true, method: 'ANDROID_TCP' };
      }
      return { success: true, method: 'ANDROID_SIMULATED' };
    } catch (err: any) {
      console.warn('[PrinterService] Android native print warning:', err.message);
      return { success: false, error: err.message };
    }
  }

  private static generateEscPosCommands(data: PrintReceiptData): string {
    const header = '\x1B\x40\x1B\x61\x01' + `*** RESTAURANT RECEIPT ***\nOrder: #${data.orderNumber}\nTable: ${data.tableNo}\nTime: ${data.printedAt}\n--------------------------------\n`;
    const body = data.items.map((i: any) => `${i.quantity}x ${i.dishName.padEnd(20)} $${(i.totalPrice ?? i.totalAmount ?? 0).toFixed(2)}`).join('\n');
    const footer = `\n--------------------------------\nTotal: $${data.totalAmount.toFixed(2)}\nThank You!\n\n\n\n\x1D\x56\x41\x00`;
    return header + body + footer;
  }

  private static generateTextReceipt(data: PrintReceiptData): string {
    return `[C]*** RECEIPT ***\n[C]Order #${data.orderNumber} - Table ${data.tableNo}\n` +
      data.items.map((i: any) => `${i.quantity}x ${i.dishName} - $${i.totalPrice ?? i.totalAmount ?? 0}`).join('\n') +
      `\n[C]Total: $${data.totalAmount}`;
  }
}
