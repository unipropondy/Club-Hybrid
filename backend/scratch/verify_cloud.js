const sql = require('mssql');
require('dotenv').config();

async function verify() {
  const config = {
    user: 'ups', password: 'ups', server: 'myerpcloud.dyndns.org', port: 9199, database: 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };
  const pool = await new sql.ConnectionPool(config).connect();
  const res = await pool.request().query("SELECT BillNo, LastSettlementDate, SysAmount FROM SettlementHeader WHERE BillNo LIKE '%20261010%' ORDER BY LastSettlementDate DESC");
  console.log('Today bills on CLOUD ERP:', res.recordset);

  const items = await pool.request().query("SELECT COUNT(1) as count FROM SettlementItemDetail WHERE SettlementID IN (SELECT SettlementID FROM SettlementHeader WHERE BillNo LIKE '%20261010%')");
  console.log('Total items on CLOUD ERP for today:', items.recordset[0].count);

  const inv = await pool.request().query("SELECT COUNT(1) as count FROM RestaurantInvoice WHERE BillNumber LIKE '%20261010%'");
  console.log('Total invoices on CLOUD ERP for today:', inv.recordset[0].count);

  await pool.close();
}

verify().catch(console.error);
