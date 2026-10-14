const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { poolPromise } = require("../config/db");

async function checkRealMSSQLConstraints() {
  console.log("========================================================================");
  console.log("🔍 REAL MSSQL SCHEMA CONSTRAINT INSPECTION");
  console.log("========================================================================\n");

  try {
    const pool = await poolPromise;
    console.log(" Connected to real database:", pool.config.database, "on", pool.config.server);

    // 1. Check Primary Keys and Unique Constraints on RestaurantOrderCur
    console.log("\n--- RestaurantOrderCur Constraints & Indexes ---");
    const orderConstraints = await pool.request().query(`
      SELECT 
        i.name AS index_name,
        i.is_unique,
        i.is_primary_key,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('RestaurantOrderCur')
      ORDER BY i.name, ic.key_ordinal;
    `);
    console.table(orderConstraints.recordset);

    // 2. Check Primary Keys and Unique Constraints on SettlementHeader
    console.log("\n--- SettlementHeader Constraints & Indexes ---");
    const setConstraints = await pool.request().query(`
      SELECT 
        i.name AS index_name,
        i.is_unique,
        i.is_primary_key,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('SettlementHeader')
      ORDER BY i.name, ic.key_ordinal;
    `);
    console.table(setConstraints.recordset);

    // 3. Check RestaurantInvoice Constraints
    console.log("\n--- RestaurantInvoice Constraints & Indexes ---");
    const invConstraints = await pool.request().query(`
      SELECT 
        i.name AS index_name,
        i.is_unique,
        i.is_primary_key,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('RestaurantInvoice')
      ORDER BY i.name, ic.key_ordinal;
    `);
    console.table(invConstraints.recordset);

    // 4. Check PaymentDetail Constraints
    console.log("\n--- PaymentDetail Constraints & Indexes ---");
    const payConstraints = await pool.request().query(`
      SELECT 
        i.name AS index_name,
        i.is_unique,
        i.is_primary_key,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('PaymentDetail')
      ORDER BY i.name, ic.key_ordinal;
    `);
    console.table(payConstraints.recordset);

    // 5. Test uniqueness / index for ClientOrderID
    const clientOrderCol = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'RestaurantOrderCur' AND COLUMN_NAME = 'ClientOrderID';
    `);
    console.log("\n--- ClientOrderID Column Details ---");
    console.table(clientOrderCol.recordset);

    process.exit(0);
  } catch (err) {
    console.error("❌ MSSQL constraint check error:", err.message);
    process.exit(1);
  }
}

checkRealMSSQLConstraints();
