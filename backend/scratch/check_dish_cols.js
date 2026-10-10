const sql = require('mssql');
require('dotenv').config();

async function check() {
  const config = {
    user: 'ups', password: 'ups', server: 'myerpcloud.dyndns.org', port: 9199, database: 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };
  const pool = await new sql.ConnectionPool(config).connect();
  const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DishMaster'");
  console.log('Remote DishMaster columns:', res.recordset.map(r => r.COLUMN_NAME));
  await pool.close();
}

check().catch(console.error);
