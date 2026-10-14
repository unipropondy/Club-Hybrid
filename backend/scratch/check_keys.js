const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { poolPromise } = require("../config/db");

async function checkActualKeys() {
  const pool = await poolPromise;
  const res = await pool.request().query(`
    SELECT 
      t.name AS table_name,
      c.name AS column_name,
      i.is_unique,
      i.is_primary_key
    FROM sys.tables t
    LEFT JOIN sys.indexes i ON t.object_id = i.object_id
    LEFT JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    LEFT JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE t.name IN ('RestaurantOrderCur', 'SettlementHeader', 'RestaurantInvoice', 'PaymentDetail')
    ORDER BY t.name, i.name;
  `);
  console.table(res.recordset);
  process.exit(0);
}
checkActualKeys();
