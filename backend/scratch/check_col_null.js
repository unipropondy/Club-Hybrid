const { poolPromise } = require("../config/db");

async function checkCols() {
  const pool = await poolPromise;
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE (TABLE_NAME = 'SettlementHeader' AND COLUMN_NAME = 'OrderId')
       OR (TABLE_NAME = 'SettlementItemDetail' AND COLUMN_NAME = 'ID')
       OR (TABLE_NAME = 'settlement' AND COLUMN_NAME = 'Id')
  `);
  console.log("Columns:", cols.recordset);
  process.exit(0);
}

checkCols();
