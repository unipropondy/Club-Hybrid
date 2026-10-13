const fs = require('fs');
const path = require('path');

const settlementPath = path.resolve(__dirname, '../app/menu/settlement.tsx');
let code = fs.readFileSync(settlementPath, 'utf8');

// 1. Guard checkIpReachable in settlement.tsx
const targetReach = `      const checkIpReachable = async (ip: string, port = 80, timeoutMs = 600): Promise<boolean> => {\n        if (!ip || ip.trim() === "") return false;`;
const targetReachCrlf = `      const checkIpReachable = async (ip: string, port = 80, timeoutMs = 600): Promise<boolean> => {\r\n        if (!ip || ip.trim() === "") return false;`;

const replReach = `      const checkIpReachable = async (ip: string, port = 80, timeoutMs = 600): Promise<boolean> => {
        if (!ip || ip.trim() === "") return false;
        if (port === 9100 || Platform.OS === "android") return true;`;

if (code.includes(targetReachCrlf)) {
  code = code.replace(targetReachCrlf, replReach.replace(/\n/g, '\r\n'));
  console.log("✅ settlement.tsx: Patched checkIpReachable (CRLF)");
} else if (code.includes(targetReach)) {
  code = code.replace(targetReach, replReach);
  console.log("✅ settlement.tsx: Patched checkIpReachable (LF)");
} else {
  console.warn("⚠️ settlement.tsx: targetReach not found");
}

// 2. Add local SQLite fallback in fetchData for 100% offline settlement
const targetFetch = `      if (openRes.data?.data?.total) {\n        setOpeningCash(openRes.data.data.total.toString());`;
const targetFetchCrlf = `      if (openRes.data?.data?.total) {\r\n        setOpeningCash(openRes.data.data.total.toString());`;

const sqliteFallback = `      // 🛡️ OFFLINE FALLBACK: If total sales or payments are empty, calculate directly from local SQLite orders
      if (!totalRes.data?.GrossTotal && !totalRes.data?.NetTotal) {
        try {
          const { executeQuery } = require("../../db/database");
          const datePrefix = \`\${dateStr}%\`;
          const orderRows = await executeQuery(
            \`SELECT total_amount, subtotal, tax_amount, discount_amount, payment_method, status, payment_status, created_at 
             FROM orders 
             WHERE (payment_status = 'PAID' OR status = 'COMPLETED') 
             AND created_at LIKE ?\`,
            [datePrefix]
          );
          if (Array.isArray(orderRows) && orderRows.length > 0) {
            let gross = 0;
            let net = 0;
            let tax = 0;
            let disc = 0;
            const payMap: Record<string, number> = {};

            orderRows.forEach((r: any) => {
              const tot = Number(r.total_amount || 0);
              gross += tot;
              net += Number(r.subtotal || tot);
              tax += Number(r.tax_amount || 0);
              disc += Number(r.discount_amount || 0);
              const pm = (r.payment_method || "CASH").toUpperCase();
              payMap[pm] = (payMap[pm] || 0) + tot;
            });

            const localPayments = Object.keys(payMap).map(k => ({
              PaymodeName: k,
              Amount: payMap[k].toFixed(2)
            }));

            setTotalSales({
              GrossTotal: gross.toFixed(2),
              NetTotal: net.toFixed(2),
              TaxTotal: tax.toFixed(2),
              DiscountTotal: disc.toFixed(2),
              TotalBills: orderRows.length
            });

            setPayments(localPayments);
            console.log(\`💾 [Settlement] Loaded \${orderRows.length} offline orders from local SQLite for date \${dateStr}\`);
          }
        } catch (sqliteErr) {
          console.warn("Local SQLite settlement query error:", sqliteErr);
        }
      }

      if (openRes.data?.data?.total) {
        setOpeningCash(openRes.data.data.total.toString());`;

if (code.includes(targetFetchCrlf)) {
  code = code.replace(targetFetchCrlf, sqliteFallback.replace(/\n/g, '\r\n'));
  console.log("✅ settlement.tsx: Added SQLite offline fallback in fetchData (CRLF)");
} else if (code.includes(targetFetch)) {
  code = code.replace(targetFetch, sqliteFallback);
  console.log("✅ settlement.tsx: Added SQLite offline fallback in fetchData (LF)");
} else {
  console.warn("⚠️ settlement.tsx: targetFetch not found");
}

fs.writeFileSync(settlementPath, code, 'utf8');
console.log("🎉 settlement.tsx patches applied!");
