const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');

// 1. UniversalPrinter.ts
const printerPath = path.join(frontendDir, 'components', 'UniversalPrinter.ts');
let printerCode = fs.readFileSync(printerPath, 'utf8');

// Fix isIpReachable
const target1 = `  private static async isIpReachable(ip: string, port: number = 80, timeoutMs: number = 600): Promise<boolean> {\n    if (!ip || ip.trim() === "") return false;\n    const cleanIp = ip.trim();`;
const target1Crlf = `  private static async isIpReachable(ip: string, port: number = 80, timeoutMs: number = 600): Promise<boolean> {\r\n    if (!ip || ip.trim() === "") return false;\r\n    const cleanIp = ip.trim();`;

const repl1 = `  private static async isIpReachable(ip: string, port: number = 80, timeoutMs: number = 600): Promise<boolean> {
    if (!ip || ip.trim() === "") return false;
    // 🛡️ CRITICAL: NEVER probe port 9100 with HTTP fetch!
    // Thermal printers interpret HTTP GET text bytes as print data and print okhttp headers on receipts.
    if (port === 9100 || Platform.OS === "android") return true;
    const cleanIp = ip.trim();`;

if (printerCode.includes(target1Crlf)) {
  printerCode = printerCode.replace(target1Crlf, repl1);
  console.log("✅ UniversalPrinter.ts: Patched isIpReachable (CRLF)");
} else if (printerCode.includes(target1)) {
  printerCode = printerCode.replace(target1, repl1);
  console.log("✅ UniversalPrinter.ts: Patched isIpReachable (LF)");
} else {
  console.warn("⚠️ UniversalPrinter.ts target1 not found");
}

// Fix printKOT port 9100 probe
const target2 = `        if (isIp) {\n          isReachable = await this.isIpReachable(targetIp, 9100);\n        } else {`;
const target2Crlf = `        if (isIp) {\r\n          isReachable = await this.isIpReachable(targetIp, 9100);\r\n        } else {`;
const repl2 = `        if (isIp) {
          isReachable = Platform.OS === "android" ? true : await this.isIpReachable(targetIp);
        } else {`;

if (printerCode.includes(target2Crlf)) {
  printerCode = printerCode.replace(target2Crlf, repl2);
  console.log("✅ UniversalPrinter.ts: Patched printKOT (CRLF)");
} else if (printerCode.includes(target2)) {
  printerCode = printerCode.replace(target2, repl2);
  console.log("✅ UniversalPrinter.ts: Patched printKOT (LF)");
} else {
  console.warn("⚠️ UniversalPrinter.ts target2 not found");
}

fs.writeFileSync(printerPath, printerCode, 'utf8');

// 2. summary.tsx
const summaryPath = path.join(frontendDir, 'app', 'summary.tsx');
let summaryCode = fs.readFileSync(summaryPath, 'utf8');

// Replace permissions check in summary.tsx
const permTarget = `                    const canPay = permissions["OPRSET"]?.canAdd;`;
const permRepl = `                    const authState = useAuthStore.getState();
                    const isAdminOrStaff = authState.isAdmin() || authState.isManager() || authState.isSupervisor() || authState.isCashier() || !isWaiter();
                    const canPay = isAdminOrStaff || permissions["OPRSET"]?.canAdd === true || permissions["OPRSET"]?.canRead === true;`;

if (summaryCode.includes(permTarget)) {
  summaryCode = summaryCode.split(permTarget).join(permRepl);
  console.log("✅ summary.tsx: Patched canPay permission checks");
} else {
  console.warn("⚠️ summary.tsx permTarget not found");
}

// Wrap summary ID sync in fast timeout with SQLite fallback
const summarySyncTarget = `    // 1. Sync official Order ID from DB\n    if (context?.tableId) {\n      fetch(\`\${API_URL}/api/tables/\${context.tableId}\`)`;
const summarySyncTargetCrlf = `    // 1. Sync official Order ID from DB\r\n    if (context?.tableId) {\r\n      fetch(\`\${API_URL}/api/tables/\${context.tableId}\`)`;

const summarySyncRepl = `    // 1. Sync official Order ID from DB
    if (context?.tableId) {
      const localOid = useCartStore.getState().tableOrderIds[context.tableId]
        || useTableStatusStore.getState().tableMap[context.tableId.toLowerCase()]?.orderId;
      if (localOid && localOid !== "NEW" && localOid !== "#NEW") {
        useCartStore.getState().setTableOrderId(context.tableId, localOid);
      }

      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 600);
      fetch(\`\${API_URL}/api/tables/\${context.tableId}\`, { signal: ctrl.signal })`;

if (summaryCode.includes(summarySyncTargetCrlf)) {
  summaryCode = summaryCode.replace(summarySyncTargetCrlf, summarySyncRepl);
  console.log("✅ summary.tsx: Patched table ID sync (CRLF)");
} else if (summaryCode.includes(summarySyncTarget)) {
  summaryCode = summaryCode.replace(summarySyncTarget, summarySyncRepl);
  console.log("✅ summary.tsx: Patched table ID sync (LF)");
} else {
  console.warn("⚠️ summary.tsx summarySyncTarget not found");
}

fs.writeFileSync(summaryPath, summaryCode, 'utf8');

// 3. CartSidebar.tsx
const cartSidebarPath = path.join(frontendDir, 'components', 'CartSidebar.tsx');
let cartCode = fs.readFileSync(cartSidebarPath, 'utf8');

// Add OfflineOrderSequence import if not present
if (!cartCode.includes('OfflineOrderSequence')) {
  cartCode = `import { OfflineOrderSequence } from "../utils/OfflineOrderSequence";\n` + cartCode;
  console.log("✅ CartSidebar.tsx: Added OfflineOrderSequence import");
}

// Fast local check and SQLite fallback for sidebar table ID sync
const sidebarSyncTarget = `      fetch(\`\${API_URL}/api/tables/\${orderContext.tableId}\`)\n        .then((res) => res.json())`;
const sidebarSyncTargetCrlf = `      fetch(\`\${API_URL}/api/tables/\${orderContext.tableId}\`)\r\n        .then((res) => res.json())`;

const sidebarSyncRepl = `      // Instant local check first (0ms)
      const tId = orderContext.tableId;
      const cachedOid = useCartStore.getState().tableOrderIds[tId]
        || useTableStatusStore.getState().tableMap[tId.toLowerCase()]?.orderId;
      if (cachedOid && cachedOid !== "NEW" && cachedOid !== "#NEW") {
        useCartStore.getState().setTableOrderId(tId, cachedOid);
      } else {
        try {
          const { TableRepository } = require("../db/TableRepository");
          TableRepository.getCachedTables().then((tables: any[]) => {
            const row = tables.find((t: any) => t.id === tId.toLowerCase());
            if (row?.currentOrderId) {
              useCartStore.getState().setTableOrderId(tId, row.currentOrderId);
            }
          }).catch(() => {});
        } catch (_) {}
      }

      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 600);
      fetch(\`\${API_URL}/api/tables/\${orderContext.tableId}\`, { signal: ctrl.signal })
        .then((res) => res.json())`;

if (cartCode.includes(sidebarSyncTargetCrlf)) {
  cartCode = cartCode.replace(sidebarSyncTargetCrlf, sidebarSyncRepl);
  console.log("✅ CartSidebar.tsx: Patched table ID local sync (CRLF)");
} else if (cartCode.includes(sidebarSyncTarget)) {
  cartCode = cartCode.replace(sidebarSyncTarget, sidebarSyncRepl);
  console.log("✅ CartSidebar.tsx: Patched table ID local sync (LF)");
} else {
  console.warn("⚠️ CartSidebar.tsx sidebarSyncTarget not found");
}

// Fix offline generated order number format
const waiterTagTarget = `          const waiterTag = (user?.userCode || user?.userName || "TAB")
            .replace(/[^a-zA-Z0-9]/g, "")
            .substring(0, 4)
            .toUpperCase();
          const generatedOrderNo =
            currentOrderId && currentOrderId !== "NEW" && currentOrderId !== "#NEW"
              ? currentOrderId
              : \`W-\${waiterTag}-\${Date.now().toString().slice(-6)}\`;`;

const waiterTagTargetCrlf = waiterTagTarget.replace(/\n/g, '\r\n');

const waiterTagRepl = `          const generatedOrderNo =
            currentOrderId && currentOrderId !== "NEW" && currentOrderId !== "#NEW"
              ? currentOrderId
              : (currentTableOrderId || await OfflineOrderSequence.getNextOrderNumber());`;

if (cartCode.includes(waiterTagTargetCrlf)) {
  cartCode = cartCode.replace(waiterTagTargetCrlf, waiterTagRepl);
  console.log("✅ CartSidebar.tsx: Patched generatedOrderNo with OfflineOrderSequence (CRLF)");
} else if (cartCode.includes(waiterTagTarget)) {
  cartCode = cartCode.replace(waiterTagTarget, waiterTagRepl);
  console.log("✅ CartSidebar.tsx: Patched generatedOrderNo with OfflineOrderSequence (LF)");
} else {
  console.warn("⚠️ CartSidebar.tsx waiterTagTarget not found");
}

// In handleSendOrder offline catch: update useCartStore and useTableStatusStore
const dbSaveTarget = `          console.log(\`💾 [CartSidebar] Saved order \${generatedOrderNo} locally into SQLite!\`);`;
const dbSaveTargetCrlf = `          console.log(\`💾 [CartSidebar] Saved order \${generatedOrderNo} locally into SQLite!\`);\r\n`;

const dbSaveRepl = `          console.log(\`💾 [CartSidebar] Saved order \${generatedOrderNo} locally into SQLite!\`);
          if (orderContext.tableId) {
            useCartStore.getState().setTableOrderId(orderContext.tableId, generatedOrderNo);
            useTableStatusStore.getState().updateTableStatus(
              orderContext.tableId,
              orderContext.section || "",
              orderContext.tableNo || "",
              generatedOrderNo,
              "SENT",
              Date.now(),
              undefined,
              payableAmount
            );
          }`;

if (cartCode.includes(dbSaveTargetCrlf)) {
  cartCode = cartCode.replace(dbSaveTargetCrlf, dbSaveRepl + '\r\n');
  console.log("✅ CartSidebar.tsx: Patched local store update after offline send (CRLF)");
} else if (cartCode.includes(dbSaveTarget)) {
  cartCode = cartCode.replace(dbSaveTarget, dbSaveRepl);
  console.log("✅ CartSidebar.tsx: Patched local store update after offline send (LF)");
} else {
  console.warn("⚠️ CartSidebar.tsx dbSaveTarget not found");
}

// Ensure Order ID is displayed whenever available
const orderIdLabelTarget = `{orderContext.tableId &&\n            currentTableOrderId &&\n            (cart.length > 0 || currentTableStatus !== "EMPTY") && (`;
const orderIdLabelTargetCrlf = `{orderContext.tableId &&\r\n            currentTableOrderId &&\r\n            (cart.length > 0 || currentTableStatus !== "EMPTY") && (`;

const orderIdLabelRepl = `{orderContext.tableId &&\n            (currentTableOrderId || activeOrder?.orderId || tableData?.orderId) &&\n            (cart.length > 0 || currentTableStatus !== "EMPTY") && (`;

if (cartCode.includes(orderIdLabelTargetCrlf)) {
  cartCode = cartCode.replace(orderIdLabelTargetCrlf, orderIdLabelRepl.replace(/\n/g, '\r\n'));
  cartCode = cartCode.replace(`Order ID: {currentTableOrderId}`, `Order ID: {currentTableOrderId || activeOrder?.orderId || tableData?.orderId}`);
  console.log("✅ CartSidebar.tsx: Patched order ID display condition (CRLF)");
} else if (cartCode.includes(orderIdLabelTarget)) {
  cartCode = cartCode.replace(orderIdLabelTarget, orderIdLabelRepl);
  cartCode = cartCode.replace(`Order ID: {currentTableOrderId}`, `Order ID: {currentTableOrderId || activeOrder?.orderId || tableData?.orderId}`);
  console.log("✅ CartSidebar.tsx: Patched order ID display condition (LF)");
} else {
  console.warn("⚠️ CartSidebar.tsx orderIdLabelTarget not found");
}

fs.writeFileSync(cartSidebarPath, cartCode, 'utf8');

// 4. payment.tsx
const paymentPath = path.join(frontendDir, 'app', 'payment.tsx');
let paymentCode = fs.readFileSync(paymentPath, 'utf8');

if (!paymentCode.includes('OfflineOrderSequence')) {
  paymentCode = `import { OfflineOrderSequence } from "../utils/OfflineOrderSequence";\n` + paymentCode;
  console.log("✅ payment.tsx: Added OfflineOrderSequence import");
}

const payOffTarget = `\`OFF-\${(user?.userCode || "TAB").replace(/[^a-zA-Z0-9]/g, "").substring(0, 4)}-\${Date.now().toString().slice(-6)}\`;`;
const payOffRepl = `await OfflineOrderSequence.getNextOrderNumber();`;

if (paymentCode.includes(payOffTarget)) {
  paymentCode = paymentCode.replace(payOffTarget, payOffRepl);
  console.log("✅ payment.tsx: Patched offline bill number with OfflineOrderSequence");
} else {
  console.warn("⚠️ payment.tsx payOffTarget not found");
}

fs.writeFileSync(paymentPath, paymentCode, 'utf8');

console.log("🎉 All precision patches applied successfully!");
