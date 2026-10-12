const sql = require('mssql');
require('dotenv').config();

async function check() {
  const localConfig = {
    user: process.env.DB_USER || 'ups',
    password: process.env.DB_PASSWORD || 'ups',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };

  const pool = await new sql.ConnectionPool(localConfig).connect();
  const tables = [
    'MemberMaster', 'CreditCustomerMaster', 'CustomerCreditTransactions',
    'CompanySettings', 'OrderSequences', 'RestaurantOrder', 'RestaurantOrderDetail',
    'DailyAttendance', 'DailyAttendanceLog', 'TimeEntry'
  ];

  for (const t of tables) {
    const colRes = await pool.request().query(
      "SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity " +
      "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '" + t + "'"
    );
    console.log('\n--- ' + t + ' ---');
    console.log(colRes.recordset.map(r => r.COLUMN_NAME + ' (' + r.DATA_TYPE + (r.IsIdentity ? ', ID' : '') + ')').join(', '));
  }
  await pool.close();
}

check().catch(console.error);
