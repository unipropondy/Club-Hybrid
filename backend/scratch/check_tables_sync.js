const sql = require('mssql');
require('dotenv').config();

async function check() {
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || 'ups',
    password: process.env.REMOTE_DB_PASSWORD || 'ups',
    server: process.env.REMOTE_DB_SERVER || 'myerpcloud.dyndns.org',
    port: parseInt(process.env.REMOTE_DB_PORT || '9199'),
    database: process.env.REMOTE_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
  };

  const pool = await new sql.ConnectionPool(remoteConfig).connect();
  const tables = ['DailyAttendance', 'DailyAttendanceLog', 'TimeEntry', 'RestaurantOrderDetail'];

  for (const t of tables) {
    const colRes = await pool.request().query(
      "SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity " +
      "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '" + t + "'"
    );
    console.log(t, 'Cols:', colRes.recordset.map(r => r.COLUMN_NAME + (r.IsIdentity ? ' (ID)' : '')));
  }
  await pool.close();
}

check().catch(console.error);
