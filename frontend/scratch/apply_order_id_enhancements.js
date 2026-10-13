const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');

// 1. CartSidebar.tsx: auto-assign order ID as soon as cart has items
const cartSidebarPath = path.join(frontendDir, 'components', 'CartSidebar.tsx');
let cartCode = fs.readFileSync(cartSidebarPath, 'utf8');

const targetEffect = `  // 🖥️ CUSTOMER DISPLAY — JOIN TERMINAL ROOM (POS device side)`;
const targetEffectCrlf = `  // 🖥️ CUSTOMER DISPLAY — JOIN TERMINAL ROOM (POS device side)\r\n`;

const newEffect = `  // 🏷️ INSTANT LOCAL ORDER ID GENERATION (0ms speed when offline)
  useEffect(() => {
    if (orderContext?.tableId && cart.length > 0) {
      const tId = orderContext.tableId;
      const existingOid = useCartStore.getState().tableOrderIds[tId]
        || useTableStatusStore.getState().tableMap[tId.toLowerCase()]?.orderId;
      if (!existingOid || existingOid === "NEW" || existingOid === "#NEW") {
        OfflineOrderSequence.getNextOrderNumber().then((newOid) => {
          useCartStore.getState().setTableOrderId(tId, newOid);
        }).catch(() => {});
      }
    }
  }, [orderContext?.tableId, cart.length]);

  // 🖥️ CUSTOMER DISPLAY — JOIN TERMINAL ROOM (POS device side)`;

if (!cartCode.includes('INSTANT LOCAL ORDER ID GENERATION')) {
  if (cartCode.includes(targetEffectCrlf)) {
    cartCode = cartCode.replace(targetEffectCrlf, newEffect.replace(/\n/g, '\r\n') + '\r\n');
    console.log("✅ CartSidebar.tsx: Added instant order ID generator hook (CRLF)");
  } else if (cartCode.includes(targetEffect)) {
    cartCode = cartCode.replace(targetEffect, newEffect);
    console.log("✅ CartSidebar.tsx: Added instant order ID generator hook (LF)");
  }
  fs.writeFileSync(cartSidebarPath, cartCode, 'utf8');
}

// 2. category.tsx: propagate existingOrderId upon table select
const categoryPath = path.join(frontendDir, 'app', '(tabs)', 'category.tsx');
let catCode = fs.readFileSync(categoryPath, 'utf8');

const targetSelect = `    setOrderContext(newContext);\n    const contextId = getContextId(newContext);`;
const targetSelectCrlf = `    setOrderContext(newContext);\r\n    const contextId = getContextId(newContext);`;

const newSelect = `    setOrderContext(newContext);
    const existingOrderId = item.currentOrderId || (item as any).orderId || tableData?.orderId;
    if (existingOrderId && newContext.tableId && existingOrderId !== "NEW" && existingOrderId !== "#NEW") {
      useCartStore.getState().setTableOrderId(newContext.tableId, existingOrderId);
    }
    const contextId = getContextId(newContext);`;

if (!catCode.includes('existingOrderId && newContext.tableId')) {
  if (catCode.includes(targetSelectCrlf)) {
    catCode = catCode.replace(targetSelectCrlf, newSelect.replace(/\n/g, '\r\n'));
    console.log("✅ category.tsx: Patched table select order ID propagation (CRLF)");
  } else if (catCode.includes(targetSelect)) {
    catCode = catCode.replace(targetSelect, newSelect);
    console.log("✅ category.tsx: Patched table select order ID propagation (LF)");
  }
  fs.writeFileSync(categoryPath, catCode, 'utf8');
}

console.log("🎉 Enhancements completed!");
