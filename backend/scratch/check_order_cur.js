const sql = require('mssql');
require('dotenv').config();

async function check() {
  const config = {
    user: 'sa', password: 'Unipro@2026', server: '127.0.0.1', port: 1433, database: 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };
  const pool = await new sql.ConnectionPool(config).connect();
  const ocols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RestaurantOrderCur'");
  console.log('RestaurantOrderCur columns:', ocols.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`));
  const dcols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RestaurantOrderDetailCur'");
  console.log('RestaurantOrderDetailCur columns:', dcols.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`));
  await pool.close();
}

check().catch(console.error);
