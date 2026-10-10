const { poolPromise } = require("../config/db");

async function check() {
  const pool = await poolPromise;
  const meta = await pool.request().query(`
    SELECT c.name, c.is_identity, c.is_nullable 
    FROM sys.columns c 
    WHERE c.object_id = OBJECT_ID('SettlementHeader') AND c.name = 'OrderId'
  `);
  console.log("Local OrderId metadata:", meta.recordset);
  process.exit(0);
}

check().catch(console.error);
