const sql = require('mssql');
require('dotenv').config();

async function check() {
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || 'ups',
    password: process.env.REMOTE_DB_PASSWORD || 'ups',
    server: process.env.REMOTE_DB_SERVER || 'myerpcloud.dyndns.org',
    port: parseInt(process.env.REMOTE_DB_PORT || '9199'),
    database: process.env.REMOTE_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
  };

  const pool = await new sql.ConnectionPool(remoteConfig).connect();
  const tables = [
    'SettlementHeader',
    'SettlementItemDetail',
    'PaymentDetail',
    'RestaurantInvoice',
    'SettlementTotalSales',
    'SettlementDiscountDetail',
    'RestaurantOrder',
    'RestaurantOrderDetail'
  ];

  for (const t of tables) {
    const pks = await pool.request().query(
      `SELECT ku.COLUMN_NAME 
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
       INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
         ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
         AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
         AND ku.TABLE_NAME = '${t}'`
    );
    console.log(`${t} PK:`, pks.recordset.map(r => r.COLUMN_NAME));
  }

  await pool.close();
}

check().catch(console.error);
