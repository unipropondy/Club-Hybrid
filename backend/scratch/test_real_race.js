const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { poolPromise } = require("../config/db");
const crypto = require("crypto");

async function testConcurrentDuplicateInsertion() {
  console.log("========================================================================");
  console.log("🧪 REAL MSSQL CONCURRENCY RACE & CONSTRAINT ENFORCEMENT TEST");
  console.log("========================================================================\n");

  const pool = await poolPromise;
  const testClientId = "TEST-RACE-" + crypto.randomUUID().substring(0, 8);
  const testOrderId = crypto.randomUUID();

  console.log(`Simulating 2 concurrent workers attempting to insert ClientOrderID: ${testClientId}`);

  const insertQuery = `
    INSERT INTO RestaurantOrderCur (
      OrderId, OrderNumber, Tableno, CustomerName, TotalAmount,
      StatusCode, isOrderClosed, CreatedOn, ModifiedOn, OrderDateTime,
      ClientOrderID, BusinessUnitId, CreatedBy, PriorityCode, IsTakeAway, Pax, start_date
    ) VALUES (
      @orderId, 'BILL-RACE', 'T1', 'Tester', 25.00,
      1, 1, GETDATE(), GETDATE(), GETDATE(),
      @clientId, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 1, 0, 1, CAST(GETDATE() AS DATE)
    );
  `;

  // Worker 1 execution
  const worker1 = async () => {
    try {
      await pool.request()
        .input("orderId", testOrderId)
        .input("clientId", testClientId)
        .query(insertQuery);
      return { worker: 1, success: true };
    } catch (err) {
      return { worker: 1, success: false, error: err.message };
    }
  };

  // Worker 2 execution with a different OrderId GUID but same ClientOrderID
  const worker2 = async () => {
    try {
      await pool.request()
        .input("orderId", crypto.randomUUID())
        .input("clientId", testClientId)
        .query(insertQuery);
      return { worker: 2, success: true };
    } catch (err) {
      return { worker: 2, success: false, error: err.message };
    }
  };

  const results = await Promise.all([worker1(), worker2()]);
  console.log("Worker results:", results);

  const successfulWorkers = results.filter(r => r.success).length;
  const rejectedWorkers = results.filter(r => !r.success).length;

  console.log(`\nSuccessful inserts: ${successfulWorkers}`);
  console.log(`Rejected duplicate inserts: ${rejectedWorkers}`);

  // Query actual rows in database
  const countRes = await pool.request()
    .input("clientId", testClientId)
    .query("SELECT COUNT(*) as cnt FROM RestaurantOrderCur WHERE ClientOrderID = @clientId");

  const rowCount = countRes.recordset[0].cnt;
  console.log(`Actual committed rows in MSSQL for ClientOrderID: ${rowCount}`);

  // Clean up test row
  await pool.request()
    .input("clientId", testClientId)
    .query("DELETE FROM RestaurantOrderCur WHERE ClientOrderID = @clientId");

  if (successfulWorkers === 1 && rejectedWorkers === 1 && rowCount === 1) {
    console.log("\n✅ [PASS] Real MSSQL database constraint rejected the duplicate insertion!");
    process.exit(0);
  } else {
    console.error("\n❌ [FAIL] Database constraint failed to prevent duplicate insertion.");
    process.exit(1);
  }
}

testConcurrentDuplicateInsertion();
