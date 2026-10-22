const sql = require("mssql");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const remoteConfig = {
  server: process.env.REMOTE_DB_SERVER,
  port: parseInt(process.env.REMOTE_DB_PORT || "1433"),
  database: process.env.REMOTE_DB_NAME,
  user: process.env.REMOTE_DB_USER,
  password: process.env.REMOTE_DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
};

const localConfig = {
  server: process.env.LOCAL_DB_SERVER || "localhost",
  port: parseInt(process.env.LOCAL_DB_PORT || "1433"),
  database: process.env.LOCAL_DB_NAME || "UCSCLUB",
  user: process.env.LOCAL_DB_USER || "sa",
  password: process.env.LOCAL_DB_PASSWORD || "Unipro@2026",
  options: { encrypt: false, trustServerCertificate: true },
};

async function getRemoteTableDefinition(remotePool, tableName) {
  const cols = await remotePool.request().query(`
    SELECT 
      c.name,
      t.name AS type_name,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      ic.seed_value,
      ic.increment_value,
      dc.definition AS default_val
    FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    WHERE c.object_id = OBJECT_ID('[dbo].[${tableName}]')
    ORDER BY c.column_id
  `);
  return cols.recordset;
}

async function fixTableIdentity(remotePool, localPool, tableName) {
  console.log(`\n🔧 Fixing IDENTITY for [${tableName}]...`);
  
  // 1. Get column definitions from remote
  const remoteCols = await getRemoteTableDefinition(remotePool, tableName);
  if (!remoteCols.some(c => c.is_identity)) {
    console.log(`  Table [${tableName}] has no identity columns in remote. Skipping.`);
    return;
  }

  const identityCol = remoteCols.find(c => c.is_identity);
  console.log(`  Remote Identity column: [${identityCol.name}] IDENTITY(${identityCol.seed_value || 1}, ${identityCol.increment_value || 1})`);

  // Build column DDL for new table
  const colDefs = [];
  const colNames = [];

  for (const c of remoteCols) {
    let typeStr = c.type_name;
    if (['varchar', 'nvarchar', 'char', 'nchar', 'varbinary', 'binary'].includes(c.type_name)) {
      typeStr += `(${c.max_length === -1 ? 'MAX' : (c.type_name.startsWith('n') ? c.max_length / 2 : c.max_length)})`;
    } else if (['decimal', 'numeric'].includes(c.type_name)) {
      typeStr += `(${c.precision}, ${c.scale})`;
    }
    const ident = c.is_identity ? ` IDENTITY(${c.seed_value || 1}, ${c.increment_value || 1})` : '';
    const nullStr = c.is_nullable ? 'NULL' : 'NOT NULL';
    const def = c.default_val ? ` DEFAULT ${c.default_val}` : '';
    colDefs.push(`[${c.name}] ${typeStr}${ident} ${nullStr}${def}`);
    colNames.push(`[${c.name}]`);
  }

  // 2. Query current max value of the identity column in local table
  let maxVal = 0;
  try {
    const maxRes = await localPool.request().query(`
      SELECT ISNULL(MAX(CAST([${identityCol.name}] AS BIGINT)), 0) AS maxVal 
      FROM [dbo].[${tableName}]
    `);
    maxVal = Number(maxRes.recordset[0]?.maxVal || 0);
  } catch (e) {
    console.log(`  Could not get maxVal from local: ${e.message}`);
  }
  console.log(`  Current max [${identityCol.name}] in local: ${maxVal}`);

  // 3. Drop temp table if exists
  await localPool.request().query(`
    IF OBJECT_ID('dbo.[${tableName}_temp_fix]', 'U') IS NOT NULL 
      DROP TABLE dbo.[${tableName}_temp_fix];
  `);

  // 4. Create temp table with exact schema including IDENTITY
  const createSql = `CREATE TABLE dbo.[${tableName}_temp_fix] (\n  ${colDefs.join(',\n  ')}\n);`;
  await localPool.request().query(createSql);

  // 5. Transfer data from old table to temp table with IDENTITY_INSERT ON
  const countRes = await localPool.request().query(`SELECT COUNT(*) AS total FROM [dbo].[${tableName}]`);
  const rowCount = countRes.recordset[0].total;

  if (rowCount > 0) {
    const colListStr = colNames.join(', ');
    const copySql = `
      SET IDENTITY_INSERT dbo.[${tableName}_temp_fix] ON;
      INSERT INTO dbo.[${tableName}_temp_fix] (${colListStr})
      SELECT ${colListStr} FROM dbo.[${tableName}];
      SET IDENTITY_INSERT dbo.[${tableName}_temp_fix] OFF;
    `;
    await localPool.request().query(copySql);
    console.log(`  Transferred ${rowCount} rows with IDENTITY_INSERT ON.`);
  }

  // 6. Reseed identity if needed
  if (maxVal > 0) {
    await localPool.request().query(`
      DBCC CHECKIDENT ('dbo.[${tableName}_temp_fix]', RESEED, ${maxVal});
    `);
    console.log(`  Reseeded identity to ${maxVal}.`);
  }

  // 7. Drop old table and rename temp table
  // Drop any default constraints or indexes on old table if needed
  await localPool.request().query(`
    DROP TABLE dbo.[${tableName}];
    EXEC sp_rename 'dbo.[${tableName}_temp_fix]', '${tableName}';
  `);

  console.log(`  ✅ Successfully updated [${tableName}] with IDENTITY [${identityCol.name}]!`);
}

async function run() {
  const remotePool = new sql.ConnectionPool(remoteConfig);
  const localPool = new sql.ConnectionPool(localConfig);

  console.log("Connecting to Remote & Local databases...");
  await Promise.all([remotePool.connect(), localPool.connect()]);
  console.log("Connected!");

  // Tables to fix
  const tablesToFix = [
    'SettlementHeader',
    'SettlementItemDetail',
    'settlement',
    'RewardMaster',
    'PaymentGatewayTransactions',
    'OpeningCashDenomination',
    'ItemMaster',
    'server',
    'servermaster',
    'TvTakeAway',
    'ReceiptPrintCache',
    'QRMaster',
    'MasterSettings',
    'DishModifiers',
    'AppSettings'
  ];

  for (const t of tablesToFix) {
    try {
      await fixTableIdentity(remotePool, localPool, t);
    } catch (err) {
      console.error(`  ❌ Error fixing [${t}]:`, err.message);
    }
  }

  console.log("\nAll target tables processed!");
  await Promise.all([remotePool.close(), localPool.close()]);
  process.exit(0);
}

run().catch(console.error);
