const sql = require("mssql");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function checkIdentityDifferences() {
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || "ups",
    password: process.env.REMOTE_DB_PASSWORD || "ups",
    server: process.env.REMOTE_DB_SERVER || "myerpcloud.dyndns.org",
    port: parseInt(process.env.REMOTE_DB_PORT || "9199"),
    database: process.env.REMOTE_DB_NAME || "UCSCLUB",
    options: { encrypt: false, trustServerCertificate: true }
  };

  const localConfig = {
    user: process.env.LOCAL_DB_USER || "sa",
    password: process.env.LOCAL_DB_PASSWORD || "Unipro@2026",
    server: process.env.LOCAL_DB_SERVER || "localhost",
    port: parseInt(process.env.LOCAL_DB_PORT || "1433"),
    database: process.env.LOCAL_DB_NAME || "UCSCLUB",
    options: { encrypt: false, trustServerCertificate: true }
  };

  const remotePool = new sql.ConnectionPool(remoteConfig);
  const localPool = new sql.ConnectionPool(localConfig);

  await Promise.all([remotePool.connect(), localPool.connect()]);

  const identityQuery = `
    SELECT 
      t.name AS TableName,
      c.name AS ColumnName,
      c.is_identity,
      c.is_nullable
    FROM sys.tables t
    INNER JOIN sys.columns c ON t.object_id = c.object_id
    WHERE c.is_identity = 1
    ORDER BY t.name, c.name
  `;

  const [remoteIdent, localIdent] = await Promise.all([
    remotePool.request().query(identityQuery),
    localPool.request().query(identityQuery)
  ]);

  const localSet = new Set(localIdent.recordset.map(r => `${r.TableName.toLowerCase()}.${r.ColumnName.toLowerCase()}`));

  console.log("=== IDENTITIES IN REMOTE BUT NOT IN LOCAL ===");
  const missingInLocal = [];
  remoteIdent.recordset.forEach(r => {
    const key = `${r.TableName.toLowerCase()}.${r.ColumnName.toLowerCase()}`;
    if (!localSet.has(key)) {
      missingInLocal.push(r);
      console.log(`Table: ${r.TableName}, Column: ${r.ColumnName}`);
    }
  });

  if (missingInLocal.length === 0) {
    console.log("None! All remote identities match local!");
  }

  await Promise.all([remotePool.close(), localPool.close()]);
  process.exit(0);
}

checkIdentityDifferences().catch(console.error);
