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
  const { batch, alterations, attendance, drawer_logs, day_end_records } = req.body;

  const hasOrders = Array.isArray(batch) && batch.length > 0;
  const hasAlt = Array.isArray(alterations) && alterations.length > 0;
  const hasAtt = Array.isArray(attendance) && attendance.length > 0;
  const hasDrawer = Array.isArray(drawer_logs) && drawer_logs.length > 0;
  const hasDayEnd = Array.isArray(day_end_records) && day_end_records.length > 0;

  if (!hasOrders && !hasAlt && !hasAtt && !hasDrawer && !hasDayEnd) {
    return res.json({
      success: true,
      processed_count: 0,
      synced_client_ids: [],
      synced_alteration_ids: [],
      synced_attendance_ids: [],
      synced_drawer_ids: [],
      synced_day_end_ids: [],
    });
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

      // 1. Idempotency Check: Concurrency-safe check (NO unsafe dirty-read NOLOCK)
      // For settled sales, verify that BOTH the order AND the settlement records exist.
      const isPaid = order.payment_status === "PAID" || order.status === "COMPLETED";
      const checkReq = new sql.Request(transaction);
      checkReq.input("clientId", sql.VarChar(100), clientId);
      const existing = await checkReq.query(`
        SELECT TOP 1 OrderId, isOrderClosed FROM RestaurantOrderCur WITH (UPDLOCK, ROWLOCK)
        WHERE ClientOrderID = @clientId OR OrderNumber = @clientId
      `);

      if (existing.recordset.length > 0) {
        // If it's a paid order, verify whether SettlementHeader exists before acknowledging as completely synced
        if (isPaid) {
          const checkSetReq = new sql.Request(transaction);
          checkSetReq.input("clientId", sql.VarChar(100), clientId);
          checkSetReq.input("orderGuid", sql.UniqueIdentifier, orderGuid);
          const existingSet = await checkSetReq.query(`
            SELECT TOP 1 SettlementID FROM SettlementHeader WITH (UPDLOCK, ROWLOCK)
            WHERE SettlementID = @orderGuid OR BillNo = @clientId
          `);

          if (existingSet.recordset.length > 0) {
            // Both order and settlement exist, safely acknowledge
            syncedClientIds.push(clientId);
            continue;
          }
          // If order exists but settlement is missing, do NOT skip! Fall through to repair/insert settlement and payment details.
          console.warn(`[Sync Push] Order ${clientId} found but missing SettlementHeader. Repairing settlement records...`);
        } else {
          // Unpaid order already exists, acknowledge idempotently
          syncedClientIds.push(clientId);
          continue;
        }
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
        IF NOT EXISTS (SELECT 1 FROM RestaurantOrderCur WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @orderId OR ClientOrderID = @clientId)
        BEGIN
          INSERT INTO RestaurantOrderCur (
            OrderId, OrderNumber, Tableno, CustomerName, TotalAmount,
            StatusCode, isOrderClosed, CreatedOn, ModifiedOn, OrderDateTime,
            ClientOrderID, BusinessUnitId, CreatedBy, PriorityCode, IsTakeAway, Pax, start_date
          ) VALUES (
            @orderId, @orderNo, @tableNo, @customerName, @total,
            1, @isClosed, @createdAt, GETDATE(), @createdAt,
            @clientId, @bizId, @userId, 1, 0, 1, @startDate
          );
        END
      `);

      // 2.5 Update TableMaster and handle offline settlement
      const cleanTableNo = safeTableNo.replace(/^Table\s*/i, '').trim();

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

          END
        `).catch(sErr => console.warn("SettlementHeader insert warning:", sErr.message));

        // Insert payment details (Supports Split Payments e.g. Cash + Card)
        const paymentList = (Array.isArray(rawPayload.payments) && rawPayload.payments.length > 0)
          ? rawPayload.payments
          : [{ payMode, amount: totalAmt }];

        for (const p of paymentList) {
          const pMode = String(p.payMode || p.payModeName || payMode || "CASH").toUpperCase();
          const pAmt = parseFloat(p.amount) || totalAmt;

          await transaction.request()
            .input("sid", sql.UniqueIdentifier, orderGuid)
            .input("payMode", sql.VarChar(50), pMode)
            .input("amount", sql.Decimal(18, 2), pAmt)
            .input("startDate", sql.Date, activeStartDate)
            .query(`
              DECLARE @pPos INT = 1;
              SELECT TOP 1 @pPos = Position FROM Paymode WITH (NOLOCK) 
              WHERE UPPER(LTRIM(RTRIM(PayMode))) = UPPER(LTRIM(RTRIM(@payMode))) 
                 OR UPPER(LTRIM(RTRIM(Description))) = UPPER(LTRIM(RTRIM(@payMode)));
              IF @pPos IS NULL SET @pPos = 1;

              INSERT INTO PaymentDetailCur (
                PaymentId, RestaurantBillId, Paymode, Amount, start_date, CreatedOn
              ) VALUES (
                NEWID(), @sid, @pPos, @amount, @startDate, GETDATE()
              );

              INSERT INTO PaymentDetail (
                PaymentId, RestaurantBillId, SettlementId, InvoiceId, OrderId, Paymode, Amount, start_date, CreatedOn, isUploadHQ, isSettlement
              ) VALUES (
                NEWID(), @sid, @sid, @sid, @sid, @pPos, @amount, @startDate, GETDATE(), 0, 1
              );

              INSERT INTO SettlementTotalSales (
                SettlementID, PayMode, SysAmount, ManualAmount, ReceiptCount, start_date
              ) VALUES (
                @sid, @payMode, @amount, @amount, 1, @startDate
              );
            `).catch(pErr => console.warn("Payment detail insert warning:", pErr.message));
        }
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

          // Insert into SettlementItemDetail and RestaurantOrderDetail if offline settled
          if (isPaid) {
            const sItemReq = new sql.Request(transaction);
            sItemReq.input("sid", sql.UniqueIdentifier, orderGuid);
            sItemReq.input("detailId", sql.UniqueIdentifier, detailGuid);
            sItemReq.input("dishId", sql.UniqueIdentifier, dishGuid);
            sItemReq.input("dishName", sql.NVarChar(150), safeDishName);
            sItemReq.input("qty", sql.Decimal(18, 2), qty);
            sItemReq.input("rate", sql.Decimal(18, 2), unitPrice);
            sItemReq.input("amt", sql.Decimal(18, 2), totalPrice);
            sItemReq.input("bizId", sql.UniqueIdentifier, defaultBizId);
            sItemReq.input("userId", sql.UniqueIdentifier, safeUserId);
            sItemReq.input("startDate", sql.Date, activeStartDate);
            await sItemReq.query(`
              DECLARE @cId UNIQUEIDENTIFIER = NULL;
              DECLARE @cName NVARCHAR(100) = NULL;
              DECLARE @gName NVARCHAR(100) = NULL;
              SELECT TOP 1 @cId = dg.CategoryId, @cName = cm.CategoryName, @gName = dg.DishGroupName
              FROM DishMaster d WITH (NOLOCK)
              LEFT JOIN DishGroupMaster dg WITH (NOLOCK) ON d.DishGroupId = dg.DishGroupId
              LEFT JOIN CategoryMaster cm WITH (NOLOCK) ON dg.CategoryId = cm.CategoryId
              WHERE d.DishId = @dishId;

              INSERT INTO SettlementItemDetail (
                SettlementID, DishId, DishName, SongName, Qty, Price, Status, OrderDateTime,
                CategoryId, CategoryName, SubCategoryName, start_date
              ) VALUES (
                @sid, @dishId, @dishName, '', @qty, @rate, 'NORMAL', GETDATE(),
                @cId, @cName, @gName, @startDate
              );

              INSERT INTO RestaurantOrderDetail (
                OrderDetailId, OrderId, DishId, Description, DishName, Quantity, PricePerUnit,
                ActualAmount, TotalDetailLineAmount, BaseAmount, StatusCode, CreatedBy, CreatedOn,
                BusinessUnitId, OrderDateTime, start_date
              ) VALUES (
                @detailId, @sid, @dishId, @dishName, @dishName, @qty, @rate,
                @amt, @amt, @amt, 1, @userId, GETDATE(),
                @bizId, GETDATE(), @startDate
              );
            `).catch(iErr => console.warn("SettlementItemDetail/RestaurantOrderDetail insert warning:", iErr.message));
          }
        }
      }

      // Archive order header to RestaurantOrder if paid
      if (isPaid) {
        await transaction.request()
          .input("orderId", sql.UniqueIdentifier, orderGuid)
          .input("orderNo", sql.VarChar(20), safeOrderNo)
          .input("tableNo", sql.VarChar(10), safeTableNo)
          .input("total", sql.Decimal(18, 2), parseFloat(order.total_amount) || 0)
          .input("bizId", sql.UniqueIdentifier, defaultBizId)
          .input("userId", sql.UniqueIdentifier, safeUserId)
          .input("startDate", sql.Date, activeStartDate)
          .input("createdAt", sql.DateTime, order.created_at ? new Date(order.created_at) : new Date())
          .query(`
            IF NOT EXISTS (SELECT 1 FROM RestaurantOrder WHERE OrderId = @orderId OR OrderNumber = @orderNo)
            BEGIN
              INSERT INTO RestaurantOrder (
                OrderId, OrderNumber, OrderDateTime, Tableno, StatusCode, CreatedBy, CreatedOn,
                BusinessUnitId, isOrderClosed, PriorityCode, TotalLineItemAmount, TotalAmount, start_date
              ) VALUES (
                @orderId, @orderNo, @createdAt, @tableNo, 3, @userId, GETDATE(),
                @bizId, 1, 1, @total, @total, @startDate
              );
            END
          `).catch(roErr => console.warn("RestaurantOrder archive warning:", roErr.message));
      }

      syncedClientIds.push(clientId);
    }

    // Process Alterations (Voids, Cancellations, Payment mode changes)
    const syncedAlterationIds = [];
    if (Array.isArray(alterations) && alterations.length > 0) {
      for (const alt of alterations) {
        try {
          const sid = alt.settlement_id;
          const payload = typeof alt.payload === 'string' ? JSON.parse(alt.payload) : (alt.payload || {});

          if (alt.action_type === 'CANCEL_ORDER') {
            await transaction.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .input("reason", sql.NVarChar(255), payload.reason || "Manual Cancellation")
              .query(`
                UPDATE SettlementHeader SET IsCancelled = 1, CancellationReason = @reason WHERE SettlementID = @sid;
                UPDATE RestaurantInvoice SET StatusCode = 4 WHERE RestaurantBillId = @sid;
                UPDATE RestaurantInvoiceCur SET StatusCode = 4 WHERE RestaurantBillId = @sid;
              `);
          } else if (alt.action_type === 'VOID_ITEM') {
            const itemIds = payload.orderDetailIds || [];
            for (const iId of itemIds) {
              await transaction.request()
                .input("detId", sql.UniqueIdentifier, iId)
                .query(`
                  UPDATE RestaurantOrderDetailCur SET isVoid = 1 WHERE OrderDetailId = @detId;
                  UPDATE RestaurantOrderDetail SET isVoid = 1 WHERE OrderDetailId = @detId;
                `);
            }
          } else if (alt.action_type === 'CHANGE_PAYMENT') {
            const pMode = String(payload.payMode || 'CASH').toUpperCase();
            await transaction.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .input("payMode", sql.VarChar(50), pMode)
              .query(`
                UPDATE SettlementHeader SET PayMode = @payMode WHERE SettlementID = @sid;
                UPDATE RestaurantInvoice SET PaymentTermCode = @payMode WHERE RestaurantBillId = @sid;
                UPDATE RestaurantInvoiceCur SET PaymentTermCode = @payMode WHERE RestaurantBillId = @sid;
                UPDATE SettlementTotalSales SET PayMode = @payMode WHERE SettlementID = @sid;
              `);
          }
          syncedAlterationIds.push(alt.id);
        } catch (altErr) {
          console.warn("⚠️ Alteration sync warning:", altErr.message);
        }
      }
    }

    // Process Attendance Punches
    const syncedAttendanceIds = [];
    if (Array.isArray(attendance) && attendance.length > 0) {
      for (const att of attendance) {
        try {
          await transaction.request()
            .input("userId", sql.UniqueIdentifier, att.user_id)
            .input("userName", sql.NVarChar(100), att.user_name || "")
            .input("staffName", sql.NVarChar(100), att.staff_name || "")
            .input("status", sql.Int, att.status)
            .input("actionName", sql.NVarChar(50), att.action_name || "")
            .input("logTime", sql.DateTime, att.timestamp ? new Date(att.timestamp) : new Date())
            .query(`
              INSERT INTO StaffAttendance (UserId, UserName, StaffName, Status, ActionName, LoginTime)
              VALUES (@userId, @userName, @staffName, @status, @actionName, @logTime)
            `);
          syncedAttendanceIds.push(att.id);
        } catch (attErr) {
          console.warn("⚠️ Attendance punch sync warning:", attErr.message);
        }
      }
    }

    // Process Cash Drawer Logs (Cash In, Cash Out, Float, etc.)
    const syncedDrawerIds = [];
    if (Array.isArray(drawer_logs) && drawer_logs.length > 0) {
      for (const log of drawer_logs) {
        try {
          const userGuid = (log.opened_by_user_id && IS_UUID_REGEX.test(log.opened_by_user_id))
            ? log.opened_by_user_id
            : defaultUserGuid;

          await transaction.request()
            .input("outletId", sql.Int, log.outlet_id || 1)
            .input("terminalCode", sql.VarChar(20), log.terminal_code || "T1")
            .input("actionType", sql.VarChar(50), log.action_type || "OTHER")
            .input("amount", sql.Decimal(18, 2), parseFloat(log.amount) || 0)
            .input("tendered", sql.Decimal(18, 2), parseFloat(log.tendered_amount) || 0)
            .input("change", sql.Decimal(18, 2), parseFloat(log.change_amount) || 0)
            .input("reason", sql.NVarChar(200), log.reason || null)
            .input("remark", sql.NVarChar(500), log.remark || null)
            .input("userId", sql.UniqueIdentifier, userGuid)
            .input("source", sql.VarChar(20), log.open_source || "MANUAL")
            .input("attUrl", sql.VarChar(500), log.attachment_url || null)
            .input("isSuccess", sql.Bit, log.is_success === 0 ? 0 : 1)
            .input("createdAt", sql.DateTime, log.created_at ? new Date(log.created_at) : new Date())
            .query(`
              INSERT INTO CashDrawerActivityLog (
                OutletId, TerminalCode, ActionType, Amount, TenderedAmount, ChangeAmount,
                Reason, Remark, OpenedByUserId, OpenSource, AttachmentUrl, IsSuccess, CreatedAt
              ) VALUES (
                @outletId, @terminalCode, @actionType, @amount, @tendered, @change,
                @reason, @remark, @userId, @source, @attUrl, @isSuccess, @createdAt
              )
            `);
          syncedDrawerIds.push(log.id);
        } catch (dlErr) {
          console.warn("⚠️ Cash drawer log sync warning:", dlErr.message);
        }
      }
    }

    // Process Day End Records
    const syncedDayEndIds = [];
    if (Array.isArray(day_end_records) && day_end_records.length > 0) {
      for (const der of day_end_records) {
        try {
          const bDate = der.business_date;
          const closedBy = der.closed_by || "admin";
          const closedAt = der.closed_at ? new Date(der.closed_at) : new Date();

          await transaction.request()
            .input("bDate", sql.Date, bDate)
            .input("closedBy", sql.VarChar(30), closedBy)
            .input("closedAt", sql.DateTime, closedAt)
            .query(`
              IF EXISTS (SELECT 1 FROM BusinessDayLog WHERE BusinessDate = @bDate)
                UPDATE BusinessDayLog 
                SET EndedAt = @closedAt, EndedBy = @closedBy 
                WHERE BusinessDate = @bDate
              ELSE
                INSERT INTO BusinessDayLog (BusinessDate, StartedAt, StartedBy, EndedAt, EndedBy)
                VALUES (@bDate, @closedAt, @closedBy, @closedAt, @closedBy);

              INSERT INTO BusinessDayAuditLog (BusinessDate, EventType, EventTime, ActionBy)
              VALUES (@bDate, 'DAY_END_OFFLINE_SYNC', @closedAt, @closedBy);
            `);
          syncedDayEndIds.push(der.id);
        } catch (deErr) {
          console.warn("⚠️ Day end sync warning:", deErr.message);
        }
      }
    }

    await transaction.commit();
    console.log(`☁️ [TabletSync] Push succeeded. Orders: ${syncedClientIds.length}, Alterations: ${syncedAlterationIds.length}, Attendance: ${syncedAttendanceIds.length}, Drawer Logs: ${syncedDrawerIds.length}, Day End: ${syncedDayEndIds.length}`);

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
      synced_alteration_ids: syncedAlterationIds,
      synced_attendance_ids: syncedAttendanceIds,
      synced_drawer_ids: syncedDrawerIds,
      synced_day_end_ids: syncedDayEndIds,
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

    // 1. Fetch Dishes
    let dishQuery = `
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
    const dishReq = pool.request();
    if (since) {
      dishReq.input("sinceDate", sql.VarChar, since);
      dishQuery += ` WHERE d.ModifiedOn >= @sinceDate OR d.CreatedOn >= @sinceDate`;
    }
    dishQuery += ` ORDER BY g.DishGroupName, d.Name`;

    const dishResult = await dishReq.query(dishQuery);

    // 1.1 Fetch Kitchens / Categories
    let categoriesData = [];
    try {
      const catRes = await pool.request().query(`
        SELECT cm.CategoryId, cm.CategoryName AS KitchenTypeName, ckt.KitchenTypeCode, cm.SortCode, cm.IsActive
        FROM CategoryMaster cm WITH (NOLOCK)
        LEFT JOIN CategoryKitchenType ckt WITH (NOLOCK) ON cm.CategoryId = ckt.CategoryId
        WHERE cm.IsActive = 1
        ORDER BY cm.SortCode ASC, cm.CategoryName ASC
      `);
      categoriesData = catRes.recordset || [];
    } catch (catErr) {
      console.warn("⚠️ [TabletSync Pull] Categories fetch warning:", catErr.message);
    }

    // 1.2 Fetch Dish Groups
    let dishGroupsData = [];
    try {
      const dgRes = await pool.request().query(`
        SELECT 
          dgm.DishGroupId,
          dgm.DishGroupName,
          dgm.CategoryId,
          dgm.SortCode,
          dgm.IsActive
        FROM DishGroupMaster dgm WITH (NOLOCK)
        WHERE dgm.IsActive = 1
        ORDER BY dgm.SortCode ASC, dgm.DishGroupName ASC
      `);
      dishGroupsData = dgRes.recordset || [];
    } catch (dgErr) {
      console.warn("⚠️ [TabletSync Pull] Dish groups fetch warning:", dgErr.message);
    }
    let tablesData = [];
    try {
      const tableRes = await pool.request().query(`
        SELECT 
          TableId AS id, 
          CAST(TableNumber AS VARCHAR(50)) AS label,
          CAST(DiningSection AS VARCHAR(10)) AS DiningSection, 
          LockedByName as lockedByName,
          Status, 
          CONVERT(VARCHAR, StartTime, 126) as StartTime, 
          ISNULL(TotalAmount, 0) as totalAmount, 
          CurrentOrderId as currentOrderId,
          entry_status AS entryStatus, 
          ISNULL(PAYMENT_STATUS, 0) AS paymentStatus, 
          CustomerName as customerName, 
          Pax as pax
        FROM TableMaster WITH (NOLOCK)
        ORDER BY SortCode, TableNumber
      `);
      tablesData = tableRes.recordset || [];
    } catch (tblErr) {
      console.warn("⚠️ [TabletSync Pull] Tables fetch warning:", tblErr.message);
    }

    // 3. Fetch Payment Modes
    let paymodesData = [];
    try {
      const pmRes = await pool.request().query(`
        SELECT 
          PayMode as payMode,
          ISNULL(Description, PayMode) as description,
          Position as position,
          1 as active
        FROM Paymode WITH (NOLOCK)
        ORDER BY Position
      `);
      paymodesData = pmRes.recordset || [];
    } catch (pmErr) {
      console.warn("⚠️ [TabletSync Pull] Paymode fetch warning:", pmErr.message);
    }

    // 4. Fetch Active Members
    let membersData = [];
    try {
      const memRes = await pool.request().query(`
        SELECT 
          MemberId, Name, Phone, Email, Address,
          ISNULL(CreditLimit, 0) as CreditLimit,
          ISNULL(CurrentBalance, 0) as CurrentBalance,
          ISNULL(Balance, 0) as Balance,
          CASE WHEN IsActive = 1 THEN 1 ELSE 0 END as IsActive,
          CASE WHEN IsVIP = 1 THEN 1 ELSE 0 END as IsVIP,
          VIPType,
          ISNULL(RewardCredit, 0) as RewardCredit,
          Promocode,
          ISNULL(Promoamount, 0) as Promoamount
        FROM MemberMaster WITH (NOLOCK)
        WHERE IsActive = 1
        ORDER BY Name
      `);
      membersData = memRes.recordset || [];
    } catch (memErr) {
      console.warn("⚠️ [TabletSync Pull] Members fetch warning:", memErr.message);
    }

    // 5. Fetch Credit Customers
    let creditCustomersData = [];
    try {
      const ccRes = await pool.request().query(`
        SELECT 
          CustomerId, Name, Phone, Email, Address,
          ISNULL(CreditLimit, 0) as CreditLimit,
          ISNULL(CurrentBalance, 0) as CurrentBalance,
          CASE WHEN IsActive = 1 THEN 1 ELSE 0 END as IsActive,
          CustomerType
        FROM CreditCustomerMaster WITH (NOLOCK)
        WHERE IsActive = 1
        ORDER BY Name
      `);
      creditCustomersData = ccRes.recordset || [];
    } catch (ccErr) {
      console.warn("⚠️ [TabletSync Pull] Credit Customers fetch warning:", ccErr.message);
    }

    // 6. Fetch Company Settings
    let companySettingsData = null;
    try {
      const csRes = await pool.request().query(`
        SELECT TOP 1 * FROM CompanySettings WITH (NOLOCK) WHERE Id = '1'
      `);
      companySettingsData = csRes.recordset[0] || null;
    } catch (csErr) {
      console.warn("⚠️ [TabletSync Pull] Company settings fetch warning:", csErr.message);
    }

    // 7. Fetch General Settings
    let generalSettingsData = null;
    try {
      const gsRes = await pool.request().query(`
        SELECT TOP 1 * FROM AppSettings WITH (NOLOCK)
      `);
      generalSettingsData = gsRes.recordset[0] || null;
    } catch (gsErr) {
      console.warn("⚠️ [TabletSync Pull] App settings fetch warning:", gsErr.message);
    }

    // 8. Fetch Users (UserMaster & UserGroupMaster) for 100% offline APK counter login
    let usersData = [];
    try {
      const usersRes = await pool.request().query(`
        SELECT 
          u.UserId as user_id, 
          u.UserCode as user_code, 
          u.UserName as user_name, 
          u.UserPassword as user_password, 
          u.FullName as full_name,
          CASE WHEN u.IsDisabled = 1 THEN 1 ELSE 0 END as is_disabled,
          u.UserGroupid as user_group_id,
          ISNULL(g.UserGroupCode, 'CASHIER') as role,
          ISNULL(g.UserGroupName, 'Cashier') as role_name
        FROM UserMaster u WITH (NOLOCK)
        LEFT JOIN UserGroupMaster g WITH (NOLOCK) ON u.UserGroupid = g.UserGroupId
        WHERE u.IsDisabled = 0 OR u.IsDisabled IS NULL
      `);
      usersData = usersRes.recordset || [];
    } catch (uErr) {
      console.warn("⚠️ [TabletSync Pull] Users fetch warning:", uErr.message);
    }

    // 9. Fetch User Permissions
    let permissionsData = [];
    try {
      const permRes = await pool.request().query(`
        SELECT 
          LTRIM(RTRIM(FormCode)) as form_code,
          LTRIM(RTRIM(UserGroupCode)) as role,
          CASE WHEN LTRIM(RTRIM(AllowAdd)) = 'A' THEN 1 ELSE 0 END as can_add,
          CASE WHEN LTRIM(RTRIM(AllowUpdate)) = 'U' THEN 1 ELSE 0 END as can_update,
          CASE WHEN LTRIM(RTRIM(AllowDelete)) = 'D' THEN 1 ELSE 0 END as can_delete,
          CASE WHEN LTRIM(RTRIM(AllowRead)) = 'R' THEN 1 ELSE 0 END as can_read
        FROM UserPermission WITH (NOLOCK)
      `);
      permissionsData = permRes.recordset || [];
    } catch (pErr) {
      console.warn("⚠️ [TabletSync Pull] Permissions fetch warning:", pErr.message);
    }

    // 10. Fetch Active Business Day (StartDate)
    let activeBusinessDayData = null;
    try {
      const deRes = await pool.request().query(`
        SELECT TOP 1 StartDate, username 
        FROM DateEntry WITH (NOLOCK) 
        ORDER BY CreatedDate DESC
      `);
      if (deRes.recordset.length > 0) {
        const sDate = deRes.recordset[0].StartDate;
        const formattedDate = sDate instanceof Date ? sDate.toISOString().split("T")[0] : String(sDate).split("T")[0];
        activeBusinessDayData = {
          startDate: formattedDate,
          active: true,
          username: deRes.recordset[0].username || "",
        };
      }
    } catch (deErr) {
      console.warn("⚠️ [TabletSync Pull] DateEntry fetch warning:", deErr.message);
    }

    // 11. Fetch License Info (Company Name, Address, Logo, FromDate, ToDate)
    let licenseData = null;
    try {
      const licRes = await pool.request().query(`
        SELECT TOP 1 
          (SELECT TOP 1 CompanyName FROM CompanySettings WITH (NOLOCK)) AS CompanyName,
          (SELECT TOP 1 Address FROM CompanySettings WITH (NOLOCK)) AS Address,
          (SELECT TOP 1 CompanyLogoUrl FROM CompanySettings WITH (NOLOCK)) AS CompanyLogoUrl,
          FromDate,
          ToDate
        FROM [dbo].[UserMaster] WITH (NOLOCK)
        WHERE FromDate IS NOT NULL OR ToDate IS NOT NULL
      `);
      if (licRes.recordset.length > 0) {
        licenseData = licRes.recordset[0];
      } else {
        const csFallback = await pool.request().query(`
          SELECT TOP 1 CompanyName, Address, CompanyLogoUrl FROM CompanySettings WITH (NOLOCK)
        `);
        const csRow = csFallback.recordset[0] || {};
        licenseData = {
          CompanyName: csRow.CompanyName || "Smart POS",
          Address: csRow.Address || "",
          CompanyLogoUrl: csRow.CompanyLogoUrl || "",
          FromDate: null,
          ToDate: null,
        };
      }
    } catch (licErr) {
      console.warn("⚠️ [TabletSync Pull] License fetch warning:", licErr.message);
    }

    // 12. Fetch All Modifiers & Dish Associations
    let modifiersData = [];
    try {
      const modRes = await pool.request().query(`
        SELECT 
          m.ModifierId as modifier_id,
          dm.DishId as dish_id,
          m.ModifierGroupId as group_id,
          m.ModifierCode as modifier_code,
          m.ModifierName as modifier_name,
          CASE WHEN m.isPriceAffect = 1 AND m.isDishPrice = 1 THEN ISNULL(m.DishCost, 0) ELSE 0 END as price,
          ISNULL(m.isOpenModifier, 0) as is_open_modifier,
          ISNULL(m.SortCode, 0) as sort_code
        FROM DishModifier dm WITH (NOLOCK)
        INNER JOIN ModifierMaster m WITH (NOLOCK) ON dm.ModifierId = m.ModifierId
      `);
      modifiersData = modRes.recordset || [];
    } catch (mErr) {
      console.warn("⚠️ [TabletSync Pull] Modifiers fetch warning:", mErr.message);
    }

    // 13. Fetch All Combo Configurations
    let combosData = [];
    try {
      const comboHeaderRes = await pool.request().query(`
        SELECT 
          ch.ComboId,
          ch.DishId,
          d.Name,
          ISNULL(d.currentcost, 0) as BasePrice
        FROM ComboHeader ch WITH (NOLOCK)
        INNER JOIN DishMaster d WITH (NOLOCK) ON ch.DishId = d.DishId
        WHERE ch.IsActive = 1
      `);

      for (const ch of (comboHeaderRes.recordset || [])) {
        const groupsRes = await pool.request()
          .input("comboId", sql.UniqueIdentifier, ch.ComboId)
          .query(`
            SELECT 
              cg.ComboGroupId,
              cg.GroupName,
              cg.DisplayOrder,
              cg.MinSelection,
              cg.MaxSelection,
              cg.IsMultiSelect
            FROM ComboGroup cg WITH (NOLOCK)
            WHERE cg.ComboId = @comboId AND cg.IsActive = 1
            ORDER BY cg.DisplayOrder
          `);

        const groups = [];
        for (const g of (groupsRes.recordset || [])) {
          const optRes = await pool.request()
            .input("groupId", sql.UniqueIdentifier, g.ComboGroupId)
            .query(`
              SELECT 
                cgo.MappingId,
                cgo.DishId,
                d.Name,
                cgo.Surcharge,
                cgo.IsDefault,
                cgo.SortOrder
              FROM ComboGroupOption cgo WITH (NOLOCK)
              INNER JOIN DishMaster d WITH (NOLOCK) ON cgo.DishId = d.DishId
              WHERE cgo.ComboGroupId = @groupId AND cgo.IsActive = 1
              ORDER BY cgo.SortOrder
            `);

          groups.push({
            comboGroupId: g.ComboGroupId,
            groupName: g.GroupName,
            displayOrder: g.DisplayOrder,
            minSelection: g.MinSelection,
            maxSelection: g.MaxSelection,
            isMultiSelect: g.IsMultiSelect,
            options: (optRes.recordset || []).map(o => ({
              mappingId: o.MappingId,
              dishId: o.DishId,
              name: o.Name,
              surcharge: o.Surcharge,
              isDefault: o.IsDefault,
              sortOrder: o.SortOrder
            }))
          });
        }

        combosData.push({
          combo_id: ch.ComboId,
          dish_id: ch.DishId,
          name: ch.Name,
          base_price: ch.BasePrice,
          raw_config: JSON.stringify({
            dishId: ch.DishId,
            name: ch.Name,
            basePrice: ch.BasePrice,
            groups
          })
        });
      }
    } catch (cErr) {
      console.warn("⚠️ [TabletSync Pull] Combos fetch warning:", cErr.message);
    }

    // 14. Fetch Recent Settlements & Invoices for Active Business Day
    let settlementsData = [];
    let orderDetailsData = [];
    let paymentDetailsData = [];
    try {
      const sDateFilter = activeBusinessDayData?.startDate || new Date().toISOString().split("T")[0];
      const setReq = pool.request();
      setReq.input("sDate", sql.Date, sDateFilter);

      const setRes = await setReq.query(`
        SELECT TOP 100
          SettlementID, BillNo, SubTotal, TotalTax, DiscountAmount, SysAmount,
          ManualAmount, TableNo, OrderType, Section, PayMode, SER_NAME,
          IsCancelled, CancellationReason, CONVERT(VARCHAR, start_date, 23) as start_date,
          CreatedOn, CreatedBy
        FROM SettlementHeader WITH (NOLOCK)
        WHERE start_date = @sDate
        ORDER BY CreatedOn DESC
      `);
      settlementsData = setRes.recordset || [];

      // Associated items from SettlementItemDetail / RestaurantOrderDetailCur
      const detReq = pool.request();
      detReq.input("sDate", sql.Date, sDateFilter);
      const detRes = await detReq.query(`
        SELECT TOP 500
          d.OrderDetailId, d.OrderId, d.DishId, d.Description as DishName,
          d.Quantity, d.PricePerUnit, d.ActualAmount, d.StatusCode,
          d.isVoid, d.CategoryId, d.CategoryName, d.SubCategoryName,
          d.ComboDetailsJSON, d.ModifiersJSON,
          CONVERT(VARCHAR, d.start_date, 23) as start_date, d.OrderDateTime as CreatedOn
        FROM RestaurantOrderDetailCur d WITH (NOLOCK)
        WHERE d.start_date = @sDate
      `);
      orderDetailsData = detRes.recordset || [];

      // Associated payment details
      const payReq = pool.request();
      payReq.input("sDate", sql.Date, sDateFilter);
      const payRes = await payReq.query(`
        SELECT TOP 200
          PaymentId, RestaurantBillId, Paymode as PayMode, Amount,
          CONVERT(VARCHAR, start_date, 23) as start_date, CreatedOn
        FROM PaymentDetailCur WITH (NOLOCK)
        WHERE start_date = @sDate
      `);
      paymentDetailsData = payRes.recordset || [];
    } catch (sErr) {
      console.warn("⚠️ [TabletSync Pull] Sales tables fetch warning:", sErr.message);
    }

    // 15. Fetch Staff Attendance for Today
    let attendanceData = [];
    try {
      const attRes = await pool.request().query(`
        SELECT TOP 50
          Id, UserId, UserName, StaffName, Status, ActionName, LoginTime
        FROM StaffAttendance WITH (NOLOCK)
        WHERE CAST(LoginTime AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY LoginTime DESC
      `);
      attendanceData = attRes.recordset || [];
    } catch (aErr) {
      console.warn("⚠️ [TabletSync Pull] Attendance fetch warning:", aErr.message);
    }

    // 16. Fetch Cash Drawer Logs for Today (Cash In / Out / Floats)
    let drawerLogsData = [];
    try {
      const cdlRes = await pool.request().query(`
        SELECT TOP 100
          Id, OutletId, TerminalCode, ActionType, Amount, TenderedAmount,
          ChangeAmount, Reason, Remark, OpenedByUserId, OpenSource, AttachmentUrl,
          IsSuccess, CreatedAt
        FROM CashDrawerActivityLog WITH (NOLOCK)
        WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY CreatedAt DESC
      `);
      drawerLogsData = cdlRes.recordset || [];
    } catch (cdlErr) {
      console.warn("⚠️ [TabletSync Pull] Cash drawer logs fetch warning:", cdlErr.message);
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      dishes: dishResult.recordset || [],
      categories: categoriesData,
      dish_groups: dishGroupsData,
      tables: tablesData,
      paymodes: paymodesData,
      members: membersData,
      credit_customers: creditCustomersData,
      company_settings: companySettingsData,
      general_settings: generalSettingsData,
      users: usersData,
      permissions: permissionsData,
      active_business_day: activeBusinessDayData,
      license: licenseData,
      modifiers: modifiersData,
      combos: combosData,
      settlements: settlementsData,
      order_details: orderDetailsData,
      payment_details: paymentDetailsData,
      attendance: attendanceData,
      drawer_logs: drawerLogsData,
    });

  } catch (error) {
    console.error("❌ [TabletSync Pull Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});



const {
  pushSalesToCloud,
  pullSalesFromCloud,
  pullMasterFromCloud,
  fullBidirectionalSync,
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
 * POST /api/sync/pull-sales
 * Pull any sales/bills made online or on another terminal down to local DB.
 */
router.post("/pull-sales", async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await pullSalesFromCloud(io);
    return res.json(result);
  } catch (error) {
    console.error("❌ [CloudSync Pull-Sales Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sync/pull-now
 * Comprehensive Manual Pull: Pulls both updated Master Catalog (Dishes, Categories, Tables, Printers)
 * AND pulls any online sales made on Cloud ERP to Local DB.
 */
router.post("/pull-now", async (req, res) => {
  try {
    const io = req.app.get("io");
    const {
      getRemotePool,
      syncMembersAndCreditCustomers,
      syncSettingsAndSequences,
    } = require("../services/cloudSync.service");
    const { getPool } = require("../config/db");

    const localPool = getPool() || (await poolPromise);
    const remotePool = await getRemotePool();

    // 1. Pull online sales from Cloud
    const salesResult = await pullSalesFromCloud(io).catch((e) => ({ success: false, error: e.message, pulledCount: 0 }));
    // 2. Pull master catalog (dishes, tables, paymodes) from Cloud
    const masterResult = await pullMasterFromCloud(io).catch((e) => ({ success: false, error: e.message, dishCount: 0 }));
    // 3. Sync members and settings bidirectional
    await syncMembersAndCreditCustomers(remotePool, localPool).catch(() => {});
    await syncSettingsAndSequences(remotePool, localPool).catch(() => {});

    return res.json({
      success: true,
      dishCount: masterResult?.dishCount || 0,
      pulledSalesCount: salesResult?.pulledCount || 0,
      salesResult,
      masterResult,
      message: `Pulled ${masterResult?.dishCount || 0} menu items and ${salesResult?.pulledCount || 0} online sales from Cloud ERP.`,
    });
  } catch (error) {
    console.error("❌ [CloudSync Pull-Now Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sync/bidirectional
 * Performs complete 2-way sync: pushes local sales, pulls online sales, pulls master catalog.
 */
router.post("/bidirectional", async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await fullBidirectionalSync(io);
    return res.json(result);
  } catch (error) {
    console.error("❌ [CloudSync Bidirectional Error]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

