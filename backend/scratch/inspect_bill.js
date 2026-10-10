const sql = require('mssql');
require('dotenv').config();

async function inspect() {
  const localConfig = {
    user: 'sa', password: 'Unipro@2026', server: '127.0.0.1', port: 1433, database: 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };
  const pool = await new sql.ConnectionPool(localConfig).connect();
  const bill = '20261010-0002';
  
  const sh = await pool.request().query(`SELECT * FROM SettlementHeader WHERE BillNo = '${bill}'`);
  if (sh.recordset.length > 0) {
    const sid = sh.recordset[0].SettlementID;
    const inv = await pool.request().query(`SELECT OrderId, BillNumber FROM RestaurantInvoice WHERE RestaurantBillId = '${sid}'`);
    console.log('Invoice:', inv.recordset);
    if (inv.recordset.length > 0) {
      const oid = inv.recordset[0].OrderId;
      const ro = await pool.request().query(`SELECT OrderId, OrderNumber FROM RestaurantOrder WHERE OrderId = '${oid}'`);
      console.log('RestaurantOrder count:', ro.recordset.length);
      const rod = await pool.request().query(`SELECT OrderDetailId, DishName FROM RestaurantOrderDetail WHERE OrderId = '${oid}'`);
      console.log('RestaurantOrderDetail count:', rod.recordset.length);
    }
  }
  await pool.close();
}
inspect().catch(console.error);
