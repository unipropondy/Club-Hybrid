const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../app/menu/settlement.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Upgrade offline fallback in fetchData to query settlement_header (dbo.SettlementHeader mirror)
const oldFallbackStart = code.indexOf('// 🛡️ OFFLINE FALLBACK:');
const oldFallbackEnd = code.indexOf('if (openRes.data?.data?.total)');

if (oldFallbackStart !== -1 && oldFallbackEnd !== -1) {
  const oldFallback = code.substring(oldFallbackStart, oldFallbackEnd);
  
  const newFallback = `// 🛡️ OFFLINE FALLBACK: Restore totals, payments, and cash in/out from SQLite mirrors (settlement_header, payment_detail, cash_drawer_logs)
      if (!totalRes.data?.GrossTotal && !totalRes.data?.NetTotal) {
        try {
          const { executeQuery } = require("../../db/database");
          const { SettlementRepository } = require("../../db/SettlementRepository");
          const { CashDrawerRepository } = require("../../db/CashDrawerRepository");

          // 1. Fetch from settlement_header (mirror of dbo.SettlementHeader)
          const localSettlements = await SettlementRepository.getSettlementsByRange(dateStr, endDateStr);
          
          if (Array.isArray(localSettlements) && localSettlements.length > 0) {
            let gross = 0;
            let net = 0;
            let tax = 0;
            let disc = 0;
            const payMap: Record<string, number> = {};

            for (const s of localSettlements) {
              if (s.IsCancelled === 1 || s.is_cancelled === 1) continue;
              const sub = Number(s.SubTotal || 0);
              const t = Number(s.TaxAmount || s.total_tax || 0);
              const d = Number(s.DiscountAmount || s.discount_amount || 0);
              const sys = Number(s.SysAmount || s.sys_amount || sub + t - d);
              gross += (sub + d);
              net += sub;
              tax += t;
              disc += d;

              // Read itemized payments for this settlement from payment_detail
              const sPayments = await SettlementRepository.getPaymentsBySettlementId(s.SettlementID);
              if (Array.isArray(sPayments) && sPayments.length > 0) {
                sPayments.forEach((p: any) => {
                  const pm = String(p.PayModeName || p.PayMode || 'CASH').toUpperCase();
                  payMap[pm] = (payMap[pm] || 0) + Number(p.Amount || 0);
                });
              } else {
                const pm = String(s.PayMode || 'CASH').toUpperCase();
                payMap[pm] = (payMap[pm] || 0) + sys;
              }
            }

            const localPayments = Object.keys(payMap).map(k => ({
              PaymodeName: k,
              Amount: payMap[k].toFixed(2),
              PayCount: 1
            }));

            setTotalSales({
              SubTotal: net.toFixed(2),
              GrossTotal: gross.toFixed(2),
              NetTotal: (net + tax).toFixed(2),
              TotalTax: tax.toFixed(2),
              DiscountAmount: disc.toFixed(2),
              InvoiceCount: localSettlements.length,
              TotalBills: localSettlements.length
            });

            setPayments(localPayments);
            console.log(\`💾 [Settlement] Restored \${localSettlements.length} sales from SQLite settlement_header (dbo.SettlementHeader mirror)\`);
          } else {
            // Fallback to orders table if settlement_header hasn't been populated
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

              setTotalSales({
                SubTotal: net.toFixed(2),
                GrossTotal: gross.toFixed(2),
                NetTotal: gross.toFixed(2),
                TotalTax: tax.toFixed(2),
                DiscountAmount: disc.toFixed(2),
                InvoiceCount: orderRows.length,
                TotalBills: orderRows.length
              });

              setPayments(Object.keys(payMap).map(k => ({
                PaymodeName: k,
                Amount: payMap[k].toFixed(2),
                PayCount: 1
              })));
            }
          }

          // 2. Offline Cash In & Cash Out recovery from cash_drawer_logs
          const offlineDrawerLogs = await CashDrawerRepository.getLogs();
          if (Array.isArray(offlineDrawerLogs) && offlineDrawerLogs.length > 0) {
            const todayLogs = offlineDrawerLogs.filter((l: any) => String(l.CreatedAt || '').startsWith(dateStr));
            const localCashIns = todayLogs.filter((l: any) => l.ActionType === 'CASH_IN' || l.ActionType === 'OPENING_FLOAT').map((l: any) => ({
              CashInId: l.Id,
              Amount: l.Amount,
              Reason: l.Reason || 'Cash In',
              CashInType: 'MANUAL',
              Remarks: l.Remark || ''
            }));
            const localCashOuts = todayLogs.filter((l: any) => l.ActionType === 'CASH_OUT').map((l: any) => ({
              CashOutId: l.Id,
              Amount: l.Amount,
              Reason: l.Reason || 'Cash Out',
              Remarks: l.Remark || ''
            }));

            if (localCashIns.length > 0) setCashInEntries(localCashIns);
            if (localCashOuts.length > 0) setCashOutEntries(localCashOuts);
          }
        } catch (sqliteErr) {
          console.warn("Local SQLite settlement query error:", sqliteErr);
        }
      }

      `;

  code = code.replace(oldFallback, newFallback);
  console.log("✅ Step 1: Upgraded offline fallback to query settlement_header and cash_drawer_logs");
} else {
  console.error("❌ Step 1: Could not find old fallback segment");
}

// 2. Offline support in handleFinalize
const oldFinalizeTarget = `      const res = await API.post(\`/settlement/finalize\`, payload, {
        headers: { Authorization: \`Bearer \${token}\` }
      });

      if (res.data.success) {
        Alert.alert("Success", "Settlement finalized successfully!");
        router.back();
      } else {
        Alert.alert("Error", res.data.error || "Failed to finalize settlement");
      }`;

const newFinalizeBlock = `      let isSuccess = false;
      try {
        const res = await API.post(\`/settlement/finalize\`, payload, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        if (res.data.success) {
          isSuccess = true;
        } else {
          Alert.alert("Error", res.data.error || "Failed to finalize settlement");
          return;
        }
      } catch (networkErr) {
        console.warn("⚠️ Server offline during finalize, recording local offline settlement snapshot:", networkErr);
        const { executeQuery } = require("../../db/database");
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        const now = new Date().toISOString();
        const dateStr = getLocalDateStr(selectedDate);
        
        await executeQuery(
          \`INSERT OR REPLACE INTO day_end_records (id, business_date, closed_by, closed_at, summary_json, is_synced)
           VALUES (?, ?, ?, ?, ?, 0)\`,
          [
            \`dayend_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
            dateStr,
            user?.userName || "Admin",
            now,
            JSON.stringify(payload)
          ]
        );
        await AsyncStorage.removeItem("selected_business_date");
        isSuccess = true;
      }

      if (isSuccess) {
        Alert.alert("Success", "Settlement finalized successfully (saved locally & queued for sync if offline)!");
        router.back();
      }`;

if (code.includes(oldFinalizeTarget)) {
  code = code.replace(oldFinalizeTarget, newFinalizeBlock);
  console.log("✅ Step 2: Added offline day_end_records queueing in handleFinalize");
} else {
  console.warn("⚠️ Step 2: oldFinalizeTarget not found exact match, checking normalized CRLF/LF");
  const normalizedOld = oldFinalizeTarget.replace(/\r\n/g, '\n');
  const codeNormalized = code.replace(/\r\n/g, '\n');
  if (codeNormalized.includes(normalizedOld)) {
    code = codeNormalized.replace(normalizedOld, newFinalizeBlock);
    console.log("✅ Step 2: Added offline day_end_records queueing in handleFinalize (normalized)");
  } else {
    console.error("❌ Step 2: Could not match handleFinalize block");
  }
}

// 3. Offline support in executeSaveCashIn and executeSaveCashOut
const oldCashInTarget = `      if (cashInForm.CashInId) {
        res = await API.put(\`/settlement/cash-in/\${cashInForm.CashInId}\`, payload, {
          headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
        });
      } else {
        res = await API.post(\`/settlement/cash-in\`, payload, {
          headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
        });
      }

      if (res.data.success) {
        setCashInForm({ CashInId: '', Amount: '', Reason: '', Remarks: '', PaymentMode: 'Cash', ReferenceNo: '', AttachmentUrl: '' });
        setShowCashInModal(false);
        fetchData();
        Alert.alert("Success", "Cash In entry saved");
      }`;

const newCashInBlock = `      let isSuccess = false;
      try {
        if (cashInForm.CashInId) {
          res = await API.put(\`/settlement/cash-in/\${cashInForm.CashInId}\`, payload, {
            headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
          });
        } else {
          res = await API.post(\`/settlement/cash-in\`, payload, {
            headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
          });
        }
        if (res.data.success) isSuccess = true;
      } catch (cashInNetErr) {
        console.warn("⚠️ Cash In offline: Saving to CashDrawerRepository:", cashInNetErr);
        const { CashDrawerRepository } = require("../../db/CashDrawerRepository");
        await CashDrawerRepository.recordDrawerAction({
          outletId: 1,
          terminalCode: selectedTerminal === "ALL" ? "T1" : selectedTerminal,
          actionType: "CASH_IN",
          amount: parseFloat(cashInForm.Amount),
          reason: cashInForm.Reason,
          remark: cashInForm.Remarks,
          openedByUserId: user?.userId || "1",
          isSuccess: true,
          openSource: "SETTLEMENT_SCREEN"
        });
        isSuccess = true;
      }

      if (isSuccess) {
        setCashInForm({ CashInId: '', Amount: '', Reason: '', Remarks: '', PaymentMode: 'Cash', ReferenceNo: '', AttachmentUrl: '' });
        setShowCashInModal(false);
        fetchData();
        Alert.alert("Success", "Cash In entry saved (stored locally for offline)");
      }`;

if (code.replace(/\r\n/g, '\n').includes(oldCashInTarget.replace(/\r\n/g, '\n'))) {
  code = code.replace(/\r\n/g, '\n').replace(oldCashInTarget.replace(/\r\n/g, '\n'), newCashInBlock);
  console.log("✅ Step 3: Added CashDrawerRepository offline support in executeSaveCashIn");
} else {
  console.error("❌ Step 3: Could not match executeSaveCashIn target");
}

const oldCashOutTarget = `      if (cashOutForm.CashOutId) {
        res = await API.put(\`/settlement/cash-out/\${cashOutForm.CashOutId}\`, payload, {
          headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
        });
      } else {
        res = await API.post(\`/settlement/cash-out\`, payload, {
          headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
        });
      }

      if (res.data.success) {
        setCashOutForm({ CashOutId: '', Amount: '', Reason: '', Remarks: '', PaymentMode: 'Cash', ReferenceNo: '', AttachmentUrl: '' });
        setShowCashOutModal(false);
        fetchData();
        Alert.alert("Success", "Cash Out entry saved");
      }`;

const newCashOutBlock = `      let isSuccess = false;
      try {
        if (cashOutForm.CashOutId) {
          res = await API.put(\`/settlement/cash-out/\${cashOutForm.CashOutId}\`, payload, {
            headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
          });
        } else {
          res = await API.post(\`/settlement/cash-out\`, payload, {
            headers: { Authorization: \`Bearer \${useAuthStore.getState().token}\` }
          });
        }
        if (res.data.success) isSuccess = true;
      } catch (cashOutNetErr) {
        console.warn("⚠️ Cash Out offline: Saving to CashDrawerRepository:", cashOutNetErr);
        const { CashDrawerRepository } = require("../../db/CashDrawerRepository");
        await CashDrawerRepository.recordDrawerAction({
          outletId: 1,
          terminalCode: selectedTerminal === "ALL" ? "T1" : selectedTerminal,
          actionType: "CASH_OUT",
          amount: parseFloat(cashOutForm.Amount),
          reason: cashOutForm.Reason,
          remark: cashOutForm.Remarks,
          openedByUserId: user?.userId || "1",
          isSuccess: true,
          openSource: "SETTLEMENT_SCREEN"
        });
        isSuccess = true;
      }

      if (isSuccess) {
        setCashOutForm({ CashOutId: '', Amount: '', Reason: '', Remarks: '', PaymentMode: 'Cash', ReferenceNo: '', AttachmentUrl: '' });
        setShowCashOutModal(false);
        fetchData();
        Alert.alert("Success", "Cash Out entry saved (stored locally for offline)");
      }`;

if (code.replace(/\r\n/g, '\n').includes(oldCashOutTarget.replace(/\r\n/g, '\n'))) {
  code = code.replace(/\r\n/g, '\n').replace(oldCashOutTarget.replace(/\r\n/g, '\n'), newCashOutBlock);
  console.log("✅ Step 4: Added CashDrawerRepository offline support in executeSaveCashOut");
} else {
  console.error("❌ Step 4: Could not match executeSaveCashOut target");
}

// 4. Offline PIN verification in modal
const oldPasswordVerify = `                  try {
                    const verifyRes = await fetch(\`\${API_URL}/api/auth/verify\`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: passwordValue, role: passwordAction?.role || "ADMIN" }),
                    });
                    const verifyData = await verifyRes.json();
                    if (!verifyData.success) {
                      Alert.alert("Incorrect Password", "The password you entered is incorrect.");
                      return;
                    }
                    setShowPasswordModal(false);
                    if (passwordAction?.onSuccess) {
                      passwordAction.onSuccess();
                    }
                  } catch (err) {
                    console.error("Password verification error:", err);
                    Alert.alert("Error", "Failed to verify password");
                  }`;

const newPasswordVerify = `                  try {
                    let isVerified = false;
                    try {
                      const verifyRes = await fetch(\`\${API_URL}/api/auth/verify\`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: passwordValue, role: passwordAction?.role || "ADMIN" }),
                      });
                      const verifyData = await verifyRes.json();
                      if (verifyData.success) isVerified = true;
                    } catch (netErr) {
                      console.log("ℹ️ [Settlement] Offline password verification via UserRepository...");
                      const { UserRepository } = require("../../db/UserRepository");
                      const allUsers = await UserRepository.getAllCachedUsers();
                      const matchingUser = allUsers.find(
                        (u: any) =>
                          UserRepository.verifyPasswordMatch(passwordValue, u.user_password) &&
                          (!passwordAction?.role || passwordAction.role === "ADMIN" ? (u.role === "ADMIN" || u.role_name === "ADMIN") : true)
                      );
                      if (matchingUser) isVerified = true;
                    }

                    if (!isVerified) {
                      Alert.alert("Incorrect Password", "The password you entered is incorrect.");
                      return;
                    }
                    setShowPasswordModal(false);
                    if (passwordAction?.onSuccess) {
                      passwordAction.onSuccess();
                    }
                  } catch (err) {
                    console.error("Password verification error:", err);
                    Alert.alert("Error", "Failed to verify password");
                  }`;

if (code.replace(/\r\n/g, '\n').includes(oldPasswordVerify.replace(/\r\n/g, '\n'))) {
  code = code.replace(/\r\n/g, '\n').replace(oldPasswordVerify.replace(/\r\n/g, '\n'), newPasswordVerify);
  console.log("✅ Step 5: Added offline admin password verification in settlement modal");
} else {
  console.error("❌ Step 5: Could not match password verification block");
}

fs.writeFileSync(targetFile, code, 'utf8');
console.log("🎉 All settlement offline upgrades written successfully!");
