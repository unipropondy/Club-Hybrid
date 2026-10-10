const sql = require('mssql');
require('dotenv').config();

async function check() {
  const config = { user: 'sa', password: 'Unipro@2026', server: '127.0.0.1', port: 1433, database: 'UCSCLUB', options: { encrypt: false, trustServerCertificate: true } };
  const pool = await new sql.ConnectionPool(config).connect();
  const cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CompanySettings'");
  console.log('CompanySettings columns:', cols.recordset.map(c => c.COLUMN_NAME));
  await pool.close();
}

check().catch(console.error);
