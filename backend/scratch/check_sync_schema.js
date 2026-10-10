const sql = require('mssql');
require('dotenv').config();

async function check() {
  const localConfig = {
    user: process.env.LOCAL_DB_USER || 'sa',
    password: process.env.LOCAL_DB_PASSWORD || 'Unipro@2026',
    server: '127.0.0.1',
    port: parseInt(process.env.LOCAL_DB_PORT || '1433'),
    database: process.env.LOCAL_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };

  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || 'ups',
    password: process.env.REMOTE_DB_PASSWORD || 'ups',
    server: process.env.REMOTE_DB_SERVER || 'myerpcloud.dyndns.org',
    port: parseInt(process.env.REMOTE_DB_PORT || '9199'),
    database: process.env.REMOTE_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
  };

  const localPool = await new sql.ConnectionPool(localConfig).connect();
  const remotePool = await new sql.ConnectionPool(remoteConfig).connect();

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
    const localCols = await localPool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity 
       FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}'`
    );
    const identities = localCols.recordset.filter(r => r.IsIdentity === 1).map(r => r.COLUMN_NAME);
    console.log(`${t}: Total Columns = ${localCols.recordset.length}, Identity = ${identities.join(', ') || 'None'}`);
  }

  await localPool.close();
  await remotePool.close();
}

check().catch(console.error);
