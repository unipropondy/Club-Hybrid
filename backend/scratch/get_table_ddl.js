const sql = require("mssql");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

async function getCreateScript(remotePool, tableName) {
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
    WHERE c.object_id = OBJECT_ID('${tableName}')
    ORDER BY c.column_id
  `);

  console.log(`Columns for ${tableName}:`);
  cols.recordset.forEach(c => {
    let typeStr = c.type_name;
    if (['varchar', 'nvarchar', 'char', 'nchar', 'varbinary', 'binary'].includes(c.type_name)) {
      typeStr += `(${c.max_length === -1 ? 'MAX' : (c.type_name.startsWith('n') ? c.max_length / 2 : c.max_length)})`;
    } else if (['decimal', 'numeric'].includes(c.type_name)) {
      typeStr += `(${c.precision}, ${c.scale})`;
    }
    const ident = c.is_identity ? ` IDENTITY(${c.seed_value}, ${c.increment_value})` : '';
    const nullStr = c.is_nullable ? 'NULL' : 'NOT NULL';
    const def = c.default_val ? ` DEFAULT ${c.default_val}` : '';
    console.log(`  [${c.name}] ${typeStr}${ident} ${nullStr}${def},`);
  });
}

async function run() {
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || "ups",
    password: process.env.REMOTE_DB_PASSWORD || "ups",
    server: process.env.REMOTE_DB_SERVER || "myerpcloud.dyndns.org",
    port: parseInt(process.env.REMOTE_DB_PORT || "9199"),
    database: process.env.REMOTE_DB_NAME || "UCSCLUB",
    options: { encrypt: false, trustServerCertificate: true }
  };
  const remotePool = new sql.ConnectionPool(remoteConfig);
  await remotePool.connect();
  await getCreateScript(remotePool, 'SettlementHeader');
  await getCreateScript(remotePool, 'SettlementItemDetail');
  await remotePool.close();
  process.exit(0);
}

run().catch(console.error);
