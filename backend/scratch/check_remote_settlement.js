const sql = require("mssql");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function compare() {
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || "ups",
    password: process.env.REMOTE_DB_PASSWORD || "ups",
    server: process.env.REMOTE_DB_SERVER || "myerpcloud.dyndns.org",
    port: parseInt(process.env.REMOTE_DB_PORT || "9199"),
    database: process.env.REMOTE_DB_NAME || "UCSCLUB",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 8000,
      requestTimeout: 15000,
    }
  };

  try {
    const remotePool = new sql.ConnectionPool(remoteConfig);
    await remotePool.connect();
    console.log("Connected to REMOTE DB!");
    const cols = await remotePool.request().query(`
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'SettlementHeader' AND COLUMN_NAME IN ('OrderId', 'OrderType', 'LegacyOrderId')
    `);
    console.log("Remote SettlementHeader Order cols:", cols.recordset);
    await remotePool.close();
  } catch (err) {
    console.error("Remote err:", err.message);
  }

  process.exit(0);
}

compare();
