const { sendToPrinter } = require('../dist/printer');

function formatTwoCols(left, right, width = 48) {
  const cleanLeft = left.replace(/\[[CLRCB]\]|<[^>]*>/g, "");
  const cleanRight = right.replace(/\[[CLRCB]\]|<[^>]*>/g, "");
  const spaceCount = Math.max(1, width - cleanLeft.length - cleanRight.length);
  return `${left}${" ".repeat(spaceCount)}${right}\n`;
}

function generateReceipt({ isCheckout, tableNo, billNo, items, subtotal, gst, total, cashReceived, changeReturn }) {
  const width = 48;
  const lineEq = "[C]" + "=".repeat(width) + "\n";
  const lineDash = "[L]" + "-".repeat(width) + "\n";

  let text = "\n" + lineEq;
  if (isCheckout) {
    text += "[C]<font size='big'><B>CHECKOUT BILL</B></font>\n";
    text += "[C]<B>PAYMENT PENDING</B>\n";
  } else {
    text += "[C]<font size='big'><B>PAYMENT RECEIPT</B></font>\n";
  }
  text += lineEq;

  text += "[C]<font size='big'><B>SMART-CLUB POS</B></font>\n";
  text += "[C]123 CLUB STREET, SINGAPORE\n";
  text += "[C]Tel: +65 6123 4567\n";
  text += lineDash;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  text += formatTwoCols(`<B>Bill No: ${billNo}</B>`, `<B>TABLE: ${tableNo}</B>`, width);
  text += `[L]<B>Date: ${dateStr} ${timeStr}</B>\n`;
  text += `[L]<B>Waiter: Staff 123</B>\n`;
  text += lineDash;

  text += formatTwoCols("<B>Item</B>", "<B>Qty    Price   Total</B>", width);
  text += lineDash;

  for (const it of items) {
    const itemTotal = (it.price * it.qty).toFixed(2);
    const rightCol = `${it.qty}    $${it.price.toFixed(2)}  $${itemTotal}`;
    text += formatTwoCols(it.name, rightCol, width);
  }

  text += lineDash;
  text += formatTwoCols("Subtotal:", `$${subtotal.toFixed(2)}`, width);
  text += formatTwoCols("GST (9%):", `$${gst.toFixed(2)}`, width);
  text += `[R]<font size='big'><B>TOTAL: $${total.toFixed(2)}</B></font>\n`;

  if (!isCheckout) {
    text += lineDash;
    text += formatTwoCols("<B>Payment Method:</B>", "<B>CASH</B>", width);
    text += formatTwoCols("<B>Cash Received:</B>", `<B>$${cashReceived.toFixed(2)}</B>`, width);
    text += formatTwoCols("<B>Change Return:</B>", `<B>$${changeReturn.toFixed(2)}</B>`, width);
  }

  text += lineEq;
  if (isCheckout) {
    text += "[C]<B>*** PLEASE PAY AT THE COUNTER ***</B>\n";
  }
  text += "[C]<B>THANK YOU! COME AGAIN!</B>\n";
  text += "[C]SMART-CLUB BY UNIPR0SG\n";

  return text;
}

async function main() {
  const printerIp = '192.168.0.199';
  const port = 9100;

  const sampleItems = [
    { name: 'Heineken Pint', qty: 2, price: 12.00 },
    { name: 'Truffle Fries', qty: 1, price: 14.00 }
  ];
  const subtotal = 38.00;
  const gst = 3.42;
  const total = 41.42;

  console.log(`🖨️ Printing 1. CHECKOUT BILL to ${printerIp}:${port}...`);
  const checkoutText = generateReceipt({
    isCheckout: true,
    tableNo: '06',
    billNo: 'CHK-20261022-0001',
    items: sampleItems,
    subtotal,
    gst,
    total,
    cashReceived: 0,
    changeReturn: 0
  });

  await sendToPrinter(printerIp, port, checkoutText, 'TEST-CHECKOUT');
  console.log('✅ CHECKOUT BILL printed successfully!');

  // Wait 2 seconds between cuts
  await new Promise(r => setTimeout(r, 2000));

  console.log(`🖨️ Printing 2. SETTLEMENT BILL to ${printerIp}:${port}...`);
  const settlementText = generateReceipt({
    isCheckout: false,
    tableNo: '06',
    billNo: 'POS-20261022-0001',
    items: sampleItems,
    subtotal,
    gst,
    total,
    cashReceived: 50.00,
    changeReturn: 8.58
  });

  await sendToPrinter(printerIp, port, settlementText, 'TEST-SETTLEMENT');
  console.log('✅ SETTLEMENT BILL printed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Print error:', err.message);
  process.exit(1);
});
