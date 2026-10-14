const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { poolPromise } = require("../config/db");

async function applyDatabaseUniqueConstraints() {
  console.log("========================================================================");
  console.log("🛠️ ENFORCING REAL MSSQL DATABASE UNIQUENESS CONSTRAINTS");
  console.log("========================================================================\n");

  try {
    const pool = await poolPromise;

    // 1. Unique index on RestaurantOrderCur(ClientOrderID) where ClientOrderID is not null
    console.log("1. Creating unique filtered index on RestaurantOrderCur(ClientOrderID)...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_RestaurantOrderCur_ClientOrderID' AND object_id = OBJECT_ID('RestaurantOrderCur')
      )
      BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_RestaurantOrderCur_ClientOrderID
        ON RestaurantOrderCur(ClientOrderID)
        WHERE ClientOrderID IS NOT NULL;
        PRINT 'Created UQ_RestaurantOrderCur_ClientOrderID';
      END
      ELSE
      BEGIN
        PRINT 'UQ_RestaurantOrderCur_ClientOrderID already exists';
      END
    `);

    // 2. Unique index on SettlementHeader(SettlementID)
    console.log("2. Creating unique index on SettlementHeader(SettlementID)...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_SettlementHeader_SettlementID' AND object_id = OBJECT_ID('SettlementHeader')
      )
      BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_SettlementHeader_SettlementID
        ON SettlementHeader(SettlementID)
        WHERE SettlementID IS NOT NULL;
        PRINT 'Created UQ_SettlementHeader_SettlementID';
      END
      ELSE
      BEGIN
        PRINT 'UQ_SettlementHeader_SettlementID already exists';
      END
    `);

    // 3. Unique index on RestaurantInvoice(RestaurantBillId)
    console.log("3. Creating unique index on RestaurantInvoice(RestaurantBillId)...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'UQ_RestaurantInvoice_RestaurantBillId' AND object_id = OBJECT_ID('RestaurantInvoice')
      )
      BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_RestaurantInvoice_RestaurantBillId
        ON RestaurantInvoice(RestaurantBillId)
        WHERE RestaurantBillId IS NOT NULL;
        PRINT 'Created UQ_RestaurantInvoice_RestaurantBillId';
      END
      ELSE
      BEGIN
        PRINT 'UQ_RestaurantInvoice_RestaurantBillId already exists';
      END
    `);

    console.log("\n✅ All real database-enforced unique constraints are successfully applied!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to apply constraints:", err.message);
    process.exit(1);
  }
}

applyDatabaseUniqueConstraints();
