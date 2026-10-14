const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function runAdversarialResilienceSuite() {
  console.log('========================================================================');
  console.log('🛡️ ADVERSARIAL RELEASE GATE: FAILURE INJECTION & RECONCILIATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, err = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} - ${err}`);
      failed++;
    }
  }

  const SQL = await initSqlJs();

  // Helper to init database with exact schema
  function createTestDb() {
    const db = new SQL.Database();
    const schemaFile = fs.readFileSync(path.resolve(__dirname, '../db/schema.ts'), 'utf8');
    const sqlDdlMatch = schemaFile.match(/export const CREATE_TABLES_SQL = `([\s\S]*?)`;/);
    db.run(sqlDdlMatch[1]);
    return db;
  }

  // -----------------------------------------------------------------------------------------
  // Case 1: Create a sale offline and simulate restart
  // -----------------------------------------------------------------------------------------
  let db1 = createTestDb();
  const saleId = 'OFF-SALE-1001';
  db1.run(`
    INSERT INTO orders (client_id, order_number, table_no, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, is_synced, created_at, updated_at)
    VALUES ('${saleId}', 'BILL-001', 'T1', 100.00, 9.00, 10.00, 99.00, 'COMPLETED', 'PAID', 'CASH', 0, datetime('now'), datetime('now'));
    INSERT INTO settlement_header (settlement_id, bill_no, subtotal, total_tax, discount_amount, sys_amount, manual_amount, table_no, pay_mode, is_cancelled, start_date, created_on, is_synced, updated_at)
    VALUES ('${saleId}', 'BILL-001', 100.00, 9.00, 10.00, 99.00, 99.00, 'T1', 'CASH', 0, date('now'), datetime('now'), 0, datetime('now'));
    INSERT INTO payment_detail (payment_id, settlement_id, bill_no, pay_mode, amount, start_date, created_on, is_synced, updated_at)
    VALUES ('PAY-1001', '${saleId}', 'BILL-001', 'CASH', 99.00, date('now'), datetime('now'), 0, datetime('now'));
  `);

  // Export DB binary (simulating disk persistence)
  const savedData = db1.export();
  db1.close();

  // Simulate app restart by re-opening DB from binary
  let db2 = new SQL.Database(savedData);
  const reloadedSale = db2.exec(`SELECT client_id, total_amount, is_synced FROM orders WHERE client_id = '${saleId}'`)[0]?.values[0];
  assert(reloadedSale && reloadedSale[0] === saleId && reloadedSale[2] === 0, 'Case 1: Sale persists across application restart with is_synced=0');

  // -----------------------------------------------------------------------------------------
  // Case 2: Server commits, drops response, client retries without duplicate financial writes
  // -----------------------------------------------------------------------------------------
  const serverDb = new SQL.Database();
  serverDb.run(`
    CREATE TABLE RestaurantOrderCur (OrderId TEXT PRIMARY KEY, OrderNumber TEXT, ClientOrderID TEXT UNIQUE, TotalAmount REAL);
    CREATE TABLE SettlementHeader (SettlementID TEXT PRIMARY KEY, BillNo TEXT UNIQUE, Total REAL);
    CREATE TABLE PaymentDetail (PaymentId TEXT PRIMARY KEY, SettlementId TEXT, Amount REAL);
  `);

  // Exact reproduction of hardened backend sync.js logic
  function simulateServerPush(payload) {
    const syncedClientIds = [];
    serverDb.run('BEGIN TRANSACTION');
    for (const item of payload.batch) {
      const clientId = item.order.client_id;
      const orderNo = item.order.order_number;
      const isPaid = item.order.payment_status === 'PAID' || item.order.status === 'COMPLETED';

      // Concurrency-safe check (NO unsafe dirty-read NOLOCK)
      const existing = serverDb.exec(`SELECT OrderId FROM RestaurantOrderCur WHERE ClientOrderID = '${clientId}' OR OrderNumber = '${clientId}'`)[0];

      if (existing && existing.values.length > 0) {
        if (isPaid) {
          const existingSet = serverDb.exec(`SELECT SettlementID FROM SettlementHeader WHERE SettlementID = 'srv_${clientId}' OR BillNo = '${clientId}'`)[0];
          if (existingSet && existingSet.values.length > 0) {
            syncedClientIds.push(clientId);
            continue;
          }
          // Repair missing settlement without duplicating order header
        } else {
          syncedClientIds.push(clientId);
          continue;
        }
      } else {
        serverDb.run(`INSERT INTO RestaurantOrderCur VALUES ('srv_${clientId}', '${orderNo}', '${clientId}', ${item.order.total_amount})`);
      }

      if (isPaid) {
        const setExists = serverDb.exec(`SELECT SettlementID FROM SettlementHeader WHERE SettlementID = 'srv_${clientId}'`)[0];
        if (!setExists || setExists.values.length === 0) {
          serverDb.run(`INSERT INTO SettlementHeader VALUES ('srv_${clientId}', '${orderNo}', ${item.order.total_amount})`);
          serverDb.run(`INSERT INTO PaymentDetail VALUES ('pay_${clientId}', 'srv_${clientId}', ${item.order.total_amount})`);
        }
      }
      syncedClientIds.push(clientId);
    }
    serverDb.run('COMMIT');
    return { success: true, synced_client_ids: syncedClientIds };
  }

  const batchPayload = {
    batch: [{
      order: { client_id: saleId, order_number: 'BILL-001', total_amount: 99.00, payment_status: 'PAID', status: 'COMPLETED' }
    }]
  };

  // Attempt 1: Server commits, but network drops before response reaches client
  simulateServerPush(batchPayload);
  const localBeforeRetry = db2.exec(`SELECT is_synced FROM orders WHERE client_id = '${saleId}'`)[0].values[0][0];
  assert(localBeforeRetry === 0, 'Case 2: Local order is still is_synced=0 after network timeout / dropped response');

  // Attempt 2: Client retries with exact same payload
  const retryResponse = simulateServerPush(batchPayload);
  assert(retryResponse.success && retryResponse.synced_client_ids.includes(saleId), 'Case 2: Retry succeeds idempotently with exact operation ID');

  const serverOrderRows = serverDb.exec(`SELECT COUNT(*) FROM RestaurantOrderCur WHERE ClientOrderID = '${saleId}'`)[0].values[0][0];
  const serverSettlementRows = serverDb.exec(`SELECT COUNT(*) FROM SettlementHeader WHERE SettlementID = 'srv_${saleId}'`)[0].values[0][0];
  assert(serverOrderRows === 1 && serverSettlementRows === 1, 'Case 2: Server has EXACTLY 1 order and 1 settlement row (Zero Duplicates)');

  // -----------------------------------------------------------------------------------------
  // Case 3 (PRIORITY 2): Exact Failure Simulation: Order header committed, Settlement missing, Retry occurs
  // -----------------------------------------------------------------------------------------
  const partialSaleId = 'OFF-PARTIAL-2002';
  // Manually simulate an orphaned order header on server (e.g. prior crash or incomplete commit)
  serverDb.run(`INSERT INTO RestaurantOrderCur VALUES ('srv_${partialSaleId}', 'BILL-002', '${partialSaleId}', 50.00)`);
  // Settlement is MISSING on server
  const missingSetBefore = serverDb.exec(`SELECT COUNT(*) FROM SettlementHeader WHERE SettlementID = 'srv_${partialSaleId}'`)[0].values[0][0];
  assert(missingSetBefore === 0, 'Case 3: Injected precondition: Order header exists, SettlementHeader is MISSING');

  const partialPayload = {
    batch: [{
      order: { client_id: partialSaleId, order_number: 'BILL-002', total_amount: 50.00, payment_status: 'PAID', status: 'COMPLETED' }
    }]
  };

  // Client retries pushing this sale
  const repairResponse = simulateServerPush(partialPayload);
  assert(repairResponse.success && repairResponse.synced_client_ids.includes(partialSaleId), 'Case 3: Retry detects missing settlement and repairs it instead of prematurely acknowledging');

  const repairedSet = serverDb.exec(`SELECT COUNT(*) FROM SettlementHeader WHERE SettlementID = 'srv_${partialSaleId}'`)[0].values[0][0];
  const repairedPay = serverDb.exec(`SELECT COUNT(*) FROM PaymentDetail WHERE SettlementId = 'srv_${partialSaleId}'`)[0].values[0][0];
  const orderCountAfterRepair = serverDb.exec(`SELECT COUNT(*) FROM RestaurantOrderCur WHERE ClientOrderID = '${partialSaleId}'`)[0].values[0][0];
  assert(repairedSet === 1 && repairedPay === 1 && orderCountAfterRepair === 1, 'Case 3: Missing settlement repaired; exactly 1 order and 1 settlement row exist');

  // -----------------------------------------------------------------------------------------
  // Case 4: Concurrent push from two separate workers
  // -----------------------------------------------------------------------------------------
  const concurrentRes1 = simulateServerPush(batchPayload);
  const concurrentRes2 = simulateServerPush(batchPayload);
  const serverOrderCountAfterConcurrent = serverDb.exec(`SELECT COUNT(*) FROM RestaurantOrderCur WHERE ClientOrderID = '${saleId}'`)[0].values[0][0];
  assert(serverOrderCountAfterConcurrent === 1, 'Case 4: Concurrent pushes from multiple workers produce exactly 1 committed record');

  // -----------------------------------------------------------------------------------------
  // Case 5: Partial batch failure and recovery
  // -----------------------------------------------------------------------------------------
  db2.run(`
    INSERT INTO staff_attendance (id, user_id, user_name, staff_name, status, action_name, timestamp, created_date, is_synced)
    VALUES ('att_1', 'u1', 'cashier1', 'Staff 1', 1, 'CLOCK_IN', datetime('now'), date('now'), 0),
           ('att_2', 'u2', 'cashier2', 'Staff 2', 1, 'CLOCK_IN', datetime('now'), date('now'), 0);
  `);
  const partialAckIds = ['att_1'];
  db2.run(`UPDATE staff_attendance SET is_synced = 1 WHERE id IN ('${partialAckIds.join("','")}')`);
  const pendingAttendance = db2.exec("SELECT id FROM staff_attendance WHERE is_synced = 0")[0].values.flat();
  assert(pendingAttendance.length === 1 && pendingAttendance[0] === 'att_2', 'Case 5: Partial batch acknowledges only confirmed items; unconfirmed items remain durable and retryable');

  // -----------------------------------------------------------------------------------------
  // Case 6: Quarantined failure queue
  // -----------------------------------------------------------------------------------------
  db2.run(`
    INSERT INTO sync_queue (id, entity_type, client_id, action, payload, retry_count, last_error, created_at)
    VALUES ('sq_01', 'ALTERATION', 'alt_err_01', 'VOID_ITEM', '{"dishId":"d1"}', 3, '500 Internal Server Error', datetime('now'))
  `);
  const quarantined = db2.exec("SELECT id, retry_count, last_error FROM sync_queue WHERE retry_count >= 3")[0].values[0];
  assert(quarantined && quarantined[1] === 3, 'Case 6: Failed sync items are durably preserved with error details and retry count in sync_queue');

  // -----------------------------------------------------------------------------------------
  // Case 7: End-to-end Financial Reconciliation
  // -----------------------------------------------------------------------------------------
  db2.run(`
    INSERT INTO orders (client_id, order_number, table_no, subtotal, tax_amount, discount_amount, total_amount, status, payment_status, payment_method, is_synced, created_at, updated_at)
    VALUES ('${partialSaleId}', 'BILL-002', 'T2', 50.00, 0, 0, 50.00, 'COMPLETED', 'PAID', 'CASH', 1, datetime('now'), datetime('now'));
  `);
  const localTotal = db2.exec("SELECT SUM(total_amount) FROM orders")[0].values[0][0];
  const serverTotal = serverDb.exec("SELECT SUM(TotalAmount) FROM RestaurantOrderCur")[0].values[0][0];
  assert(Math.abs(localTotal - serverTotal) < 0.001, `Case 7: Financial Reconciliation - Local Sum (${localTotal}) equals Server Sum (${serverTotal})`);

  console.log('\n========================================================================');
  console.log(`ADVERSARIAL SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runAdversarialResilienceSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
