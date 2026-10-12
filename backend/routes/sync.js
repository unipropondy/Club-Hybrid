const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { poolPromise } = require("../config/db");

/**
 * POST /api/sync/push
 * Handles batch up-sync from offline clients (mobile APK & Electron desktop).
 * Guarantees transactional idempotency using client_id.
 */
const crypto = require("crypto");

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/sync/push
 * Handles batch up-sync from offline clients (mobile APK & waiter tablets).
 * Guarantees transactional idempotency using client_id and ClientOrderID.
 */
router.post("/push", async (req, res) => {
  const { batch } = req.body; // batch: Array of { order, items }

  if (!batch || !Array.isArray(batch) || batch.length === 0) {
    return res.json({ success: true, processed_count: 0, synced_client_ids: [] });
  }

  let pool;
  let transaction;

  try {
    pool = await poolPromise;
    const { getActiveOrganization } = require("../utils/organizationHelper");
    const activeOrg = await getActiveOrganization();
    const defaultBizId = activeOrg?.businessUnitId || "00000000-0000-0000-0000-000000000000";
    const defaultUserGuid = "00000000-0000-0000-0000-000000000000";

    // Get active start_date from DateEntry
    const dateRes = await pool.request().query("SELECT TOP 1 StartDate FROM DateEntry WITH (NOLOCK) ORDER BY CreatedDate DESC");
    const activeStartDate = dateRes.recordset[0]?.StartDate || new Date();

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const syncedClientIds = [];

    for (const item of batch) {
      const { order, items } = item;
      if (!order || !order.client_id) continue;

      const clientId = String(order.client_id).trim();
      const orderGuid = IS_UUID_REGEX.test(clientId) ? clientId : crypto.randomUUID();

      // 1. Idempotency Check: Verify if ClientOrderID or OrderNumber already exists
      const checkReq = new sql.Request(transaction);
      checkReq.input("clientId", sql.VarChar(100), clientId);
      const existing = await checkReq.query(`
        SELECT TOP 1 OrderId FROM RestaurantOrderCur WITH (NOLOCK)
        WHERE ClientOrderID = @clientId OR OrderNumber = @clientId
      `);

      if (existing.recordset.length > 0) {
        // Already processed, mark as synced idempotently
        syncedClientIds.push(clientId);
        continue;
      }

      // Safe column values strictly truncated to schema bounds
      const safeOrderNo = String(order.order_number || `W-${clientId.substring(0, 8)}`).substring(0, 20);
      const safeTableNo = String(order.table_no || "TA").substring(0, 10);
      const safeCustomerName = String(order.waiter_name || order.customer_name || "Waiter").substring(0, 9);
      const safeUserId = (order.waiter_id && IS_UUID_REGEX.test(order.waiter_id)) ? order.waiter_id : defaultUserGuid;

      // 2. Insert Order Header into RestaurantOrderCur
      const headerReq = new sql.Request(transaction);
      headerReq.input("orderId", sql.UniqueIdentifier, orderGuid);
      headerReq.input("orderNo", sql.VarChar(20), safeOrderNo);
      headerReq.input("tableNo", sql.VarChar(10), safeTableNo);
      headerReq.input("customerName", sql.NVarChar(9), safeCustomerName);
      headerReq.input("total", sql.Decimal(18, 2), parseFloat(order.total_amount) || 0);
      headerReq.input("isClosed", sql.Bit, order.status === "COMPLETED" ? 1 : 0);
      headerReq.input("createdAt", sql.DateTime, order.created_at ? new Date(order.created_at) : new Date());
      headerReq.input("clientId", sql.VarChar(100), clientId);
      headerReq.input("bizId", sql.UniqueIdentifier, defaultBizId);
      headerReq.input("userId", sql.UniqueIdentifier, safeUserId);
      headerReq.input("startDate", sql.Date, activeStartDate);

      await headerReq.query(`
        INSERT INTO RestaurantOrderCur (
          OrderId, OrderNumber, Tableno, CustomerName, TotalAmount,
          StatusCode, isOrderClosed, CreatedOn, ModifiedOn, OrderDateTime,
          ClientOrderID, BusinessUnitId, CreatedBy, PriorityCode, IsTakeAway, Pax, start_date
        ) VALUES (
          @orderId, @orderNo, @tableNo, @customerName, @total,
          1, @isClosed, @createdAt, GETDATE(), @createdAt,
          @clientId, @bizId, @userId, 1, 0, 1, @startDate
        )
      `);

      // 2.5 Update TableMaster and handle offline settlement
      const cleanTableNo = safeTableNo.replace(/^Table\s*/i, '').trim();
      const isPaid = order.payment_status === "PAID" || order.status === "COMPLETED";

      if (cleanTableNo && !safeTableNo.startsWith("TW")) {
        const tableReq = new sql.Request(transaction);
        tableReq.input("tblNo", sql.VarChar(20), cleanTableNo);
        tableReq.input("orderNo", sql.VarChar(20), safeOrderNo);
        tableReq.input("total", sql.Decimal(18, 2), parseFloat(order.total_amount) || 0);
        tableReq.input("custName", sql.NVarChar(9), safeCustomerName);

        if (isPaid) {
          // If already paid offline, clear and free table
          await tableReq.query(`
            UPDATE TableMaster 
            SET Status = 0, 
                CurrentOrderId = NULL, 
                TotalAmount = 0,
                CustomerName = NULL,
                ModifiedOn = GETDATE()
            WHERE (LTRIM(RTRIM(TableNumber)) = @tblNo OR CONVERT(VARCHAR(50), TableId) = @tblNo)
          `).catch((tErr) => console.warn("TableMaster free warning:", tErr.message));
        } else {
          await tableReq.query(`
            UPDATE TableMaster 
            SET Status = 2, 
                CurrentOrderId = @orderNo, 
                TotalAmount = @total,
                CustomerName = @custName,
                StartTime = ISNULL(StartTime, GETDATE()), 
                ModifiedOn = GETDATE()
            WHERE (LTRIM(RTRIM(TableNumber)) = @tblNo OR CONVERT(VARCHAR(50), TableId) = @tblNo)
          `).catch((tErr) => console.warn("TableMaster update warning:", tErr.message));
        }
      }

      // 2.6 If order was settled offline, insert official settlement records
      if (isPaid) {
        let rawPayload = {};
        try {
          rawPayload = typeof order.raw_payload === 'string' ? JSON.parse(order.raw_payload || '{}') : (order.raw_payload || {});
        } catch (_) {}

        const payMode = String(order.payment_method || rawPayload.paymentMethod || "CASH").toUpperCase();
        const totalAmt = parseFloat(order.total_amount) || 0;
        const subtotalAmt = parseFloat(order.subtotal) || totalAmt;
        const taxAmt = parseFloat(order.tax_amount) || 0;
        const discAmt = parseFloat(order.discount_amount) || 0;

        const setReq = new sql.Request(transaction);
        setReq.input("sid", sql.UniqueIdentifier, orderGuid);
        setReq.input("orderNo", sql.VarChar(50), safeOrderNo);
        setReq.input("tableNo", sql.VarChar(10), safeTableNo);
        setReq.input("subtotal", sql.Decimal(18, 2), subtotalAmt);
        setReq.input("total", sql.Decimal(18, 2), totalAmt);
        setReq.input("tax", sql.Decimal(18, 2), taxAmt);
        setReq.input("disc", sql.Decimal(18, 2), discAmt);
        setReq.input("bizId", sql.UniqueIdentifier, defaultBizId);
        setReq.input("userId", sql.UniqueIdentifier, safeUserId);
        setReq.input("startDate", sql.Date, activeStartDate);
        setReq.input("payMode", sql.VarChar(50), payMode);
        setReq.input("serverName", sql.VarChar(50), safeCustomerName);

        await setReq.query(`
          IF NOT EXISTS (SELECT 1 FROM SettlementHeader WHERE SettlementID = @sid OR BillNo = @orderNo)
          BEGIN
            INSERT INTO SettlementHeader (
              SettlementID, LastSettlementDate, LastDayEndDate, SubTotal, TotalTax, DiscountAmount,
              BillNo, OrderType, TableNo, Section, BusinessUnitId, SysAmount, ManualAmount,
              CreatedBy, CreatedOn, SER_NAME, start_date, isUploadHQ, IsCancelled
            ) VALUES (
              @sid, GETDATE(), GETDATE(), @subtotal, @tax, @disc,
              @orderNo, 'DINE-IN', @tableNo, 'MAIN', @bizId, @total, @total,
              @userId, GETDATE(), @serverName, @startDate, 0, 0
            );

            INSERT INTO RestaurantInvoice (
              BusinessUnitId, RestaurantBillId, OrderId, BillNumber, OrderDateTime, TimeBilled,
              TotalLineItemAmount, TotalTax, DiscountAmount, TotalAmount, StatusCode,
              CreatedBy, CreatedOn, InvoiceDate, PaymentTermCode, start_date, isUploadHQ
            ) VALUES (
              @bizId, @sid, @sid, @orderNo, GETDATE(), GETDATE(),
              @subtotal, @tax, @disc, @total, 5,
              @userId, GETDATE(), CAST(GETDATE() AS DATE), @payMode, @startDate, 0
            );

            INSERT INTO RestaurantInvoiceCur (
              BusinessUnitId, RestaurantBillId, OrderId, BillNumber, OrderDateTime, TimeBilled,
              TotalLineItemAmount, TotalTax, DiscountAmount, TotalAmount, StatusCode,
              CreatedBy, CreatedOn, InvoiceDate, PaymentTermCode, start_date
            ) VALUES (
              @bizId, @sid, @sid, @orderNo, GETDATE(), GETDATE(),
              @subtotal, @tax, @disc, @total, 5,
              @userId, GETDATE(), CAST(GETDATE() AS DATE), @payMode, @startDate
            );

            INSERT INTO PaymentDetailCur (
              RestaurantBillId, Paymode, Amount, start_date, CreatedOn
            ) VALUES (
              @sid, 1, @total, @startDate, GETDATE()
            );

            INSERT INTO PaymentDetail (
              RestaurantBillId, Paymode, Amount, start_date, CreatedOn, isUploadHQ
            ) VALUES (
              @sid, 1, @total, @startDate, GETDATE(), 0
            );

            INSERT INTO SettlementTotalSales (
              SettlementID, PayMode, SysAmount, ManualAmount, ReceiptCount, start_date
            ) VALUES (
              @sid, @payMode, @total, @total, 1, @startDate
            );
          END
        `).catch(sErr => console.warn("SettlementHeader insert warning:", sErr.message));
      }

      // 3. Insert Order Items into RestaurantOrderDetailCur
      if (items && Array.isArray(items)) {
        for (const lineItem of items) {
          const detailGuid = IS_UUID_REGEX.test(lineItem.item_id) ? lineItem.item_id : crypto.randomUUID();
          let dishGuid = IS_UUID_REGEX.test(lineItem.dish_id) ? lineItem.dish_id : null;

          // Lookup dish Guid if not a valid UUID
          if (!dishGuid && lineItem.dish_name) {
            const dishLookup = await pool.request()
              .input("dishName", sql.NVarChar(200), lineItem.dish_name)
              .query("SELECT TOP 1 DishId FROM DishMaster WITH (NOLOCK) WHERE Name = @dishName");
            dishGuid = dishLookup.recordset[0]?.DishId || "00000000-0000-0000-0000-000000000000";
          } else if (!dishGuid) {
            dishGuid = "00000000-0000-0000-0000-000000000000";
          }

          const qty = parseInt(lineItem.quantity) || 1;
          const unitPrice = parseFloat(lineItem.unit_price) || 0;
          const totalPrice = parseFloat(lineItem.total_price) || (qty * unitPrice);
          const safeDishName = String(lineItem.dish_name || "Item").substring(0, 150);

          const itemReq = new sql.Request(transaction);
          itemReq.input("detailId", sql.UniqueIdentifier, detailGuid);
          itemReq.input("orderId", sql.UniqueIdentifier, orderGuid);
          itemReq.input("dishId", sql.UniqueIdentifier, dishGuid);
          itemReq.input("dishName", sql.NVarChar(150), safeDishName);
          itemReq.input("qty", sql.Decimal(18, 2), qty);
          itemReq.input("unitPrice", sql.Decimal(18, 2), unitPrice);
          itemReq.input("totalPrice", sql.Decimal(18, 2), totalPrice);
          itemReq.input("clientItemId", sql.VarChar(100), String(lineItem.item_id || detailGuid));
          itemReq.input("bizId", sql.UniqueIdentifier, defaultBizId);
          itemReq.input("userId", sql.UniqueIdentifier, safeUserId);
          itemReq.input("startDate", sql.Date, activeStartDate);

          await itemReq.query(`
            INSERT INTO RestaurantOrderDetailCur (
              OrderDetailId, OrderId, DishId, Description, DishName, Quantity,
              PricePerUnit, ActualAmount, TotalDetailLineAmount, BaseAmount,
              StatusCode, CreatedOn, OrderDateTime, ClientItemID, BusinessUnitId, CreatedBy, start_date
            ) VALUES (
              @detailId, @orderId, @dishId, @dishName, @dishName, @qty,
              @unitPrice, @totalPrice, @totalPrice, @totalPrice,
              1, GETDATE(), GETDATE(), @clientItemId, @bizId, @userId, @startDate
            )
          `);

          // Insert into SettlementItemDetail if offline settled
          if (isPaid) {
            const sItemReq = new sql.Request(transaction);
            sItemReq.input("sid", sql.UniqueIdentifier, orderGuid);
            sItemReq.input("dishId", sql.UniqueIdentifier, dishGuid);
            sItemReq.input("qty", sql.Decimal(18, 2), qty);
            sItemReq.input("rate", sql.Decimal(18, 2), unitPrice);
            sItemReq.input("amt", sql.Decimal(18, 2), totalPrice);
            sItemReq.input("startDate", sql.Date, activeStartDate);
            await sItemReq.query(`
              INSERT INTO SettlementItemDetail (
                SettlementID, DishId, Quantity, Rate, ItemAmount, start_date
              ) VALUES (
                @sid, @dishId, @qty, @rate, @amt, @startDate
              )
            `).catch(iErr => console.warn("SettlementItemDetail insert warning:", iErr.message));
          }
        }
      }

      syncedClientIds.push(clientId);
    }

    await transaction.commit();
    console.log(`☁️ [TabletSync] Push succeeded. Processed ${syncedClientIds.length} batch orders.`);

    // Broadcast update to all active POS / KDS screens via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("new_order", {
        type: "OFFLINE_WAITER_SYNC",
        count: syncedClientIds.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ☁️ POST-SYNC CLOUD PUSH TRIGGER (Immediate background delta push to Central Cloud ERP)
    setImmediate(() => {
      try {
        const { pushSalesToCloud } = require("../services/cloudSync.service");
        pushSalesToCloud(io).catch(e => console.warn("⚠️ [TabletSync Cloud Push Notice]:", e.message));
      } catch (e) {
        console.warn("⚠️ [TabletSync Cloud Push Notice]:", e.message);
      }
    });

    return res.json({
      success: true,
      processed_count: syncedClientIds.length,
      synced_client_ids: syncedClientIds,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        console.error("❌ [TabletSync] Rollback failed:", rbErr.message);
      }
    }
    console.error("❌ [TabletSync Push Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sync/pull
 * Fetches updated master menu data from local MSSQL server for offline tablet SQLite cache.
 */
router.get("/pull", async (req, res) => {
  const { since } = req.query;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `
      SELECT 
        d.DishId as dish_id,
        d.Name as dish_name,
        d.DishGroupId as category_id,
        g.DishGroupName as category_name,
        ISNULL(d.currentcost, 0) as price,
        CASE WHEN d.IsActive = 1 THEN 1 ELSE 0 END as is_available,
        d.Imageid as image_url,
        CONVERT(VARCHAR, ISNULL(d.ModifiedOn, d.CreatedOn), 126) as updated_at
      FROM DishMaster d WITH (NOLOCK)
      LEFT JOIN DishGroupMaster g WITH (NOLOCK) ON d.DishGroupId = g.DishGroupId
    `;

    if (since) {
      request.input("sinceDate", sql.VarChar, since);
      query += ` WHERE d.ModifiedOn >= @sinceDate OR d.CreatedOn >= @sinceDate`;
    }

    query += ` ORDER BY g.DishGroupName, d.Name`;

    const result = await request.query(query);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      dishes: result.recordset || [],
    });
  } catch (error) {
    console.error("❌ [TabletSync Pull Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});


const {
  pushSalesToCloud,
  pullMasterFromCloud,
  getSyncStatus,
} = require("../services/cloudSync.service");

/**
 * GET /api/sync/status
 * Returns current Cloud Sync Status (pending offline bills count, cloud connection status, last sync timestamp).
 */
router.get("/status", async (req, res) => {
  try {
    const status = await getSyncStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    console.error("❌ [CloudSync Status Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sync/push-now
 * Manually or on-demand push all pending offline sales from local DB to Central Cloud ERP.
 */
router.post("/push-now", async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await pushSalesToCloud(io);
    return res.json(result);
  } catch (error) {
    console.error("❌ [CloudSync Push-Now Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sync/pull-now
 * Manually or on-demand pull updated Master Data (Dishes, Categories, Groups) from Central Cloud ERP to Local DB.
 */
router.post("/pull-now", async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await pullMasterFromCloud(io);
    return res.json(result);
  } catch (error) {
    console.error("❌ [CloudSync Pull-Now Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

