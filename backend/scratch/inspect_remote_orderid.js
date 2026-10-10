const sql = require("mssql");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function checkRemoteOrderId() {
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
    const rows = await remotePool.request().query(`
      SELECT TOP 10 SettlementID, BillNo, OrderId 
      FROM SettlementHeader 
      ORDER BY LastSettlementDate DESC
    `);
    console.log("Remote SettlementHeader recent rows:", rows.recordset);
    
    // Check if OrderId is identity or has triggers or defaults
    const meta = await remotePool.request().query(`
      SELECT 
        c.name AS column_name,
        c.is_identity,
        c.is_nullable,
        d.definition AS default_definition
      FROM sys.columns c
      LEFT JOIN sys.default_constraints d ON c.default_object_id = d.object_id
      WHERE c.object_id = OBJECT_ID('SettlementHeader') AND c.name = 'OrderId'
    `);
    console.log("Remote OrderId metadata:", meta.recordset);
    
    // Check triggers on SettlementHeader
    const triggers = await remotePool.request().query(`
      SELECT name, is_disabled FROM sys.triggers WHERE parent_id = OBJECT_ID('SettlementHeader')
    `);
    console.log("Remote triggers on SettlementHeader:", triggers.recordset);

    await remotePool.close();
  } catch (err) {
    console.error("Remote err:", err.message);
  }

  process.exit(0);
}

checkRemoteOrderId();
