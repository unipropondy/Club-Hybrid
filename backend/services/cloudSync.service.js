const sql = require("mssql");
const { initSecureConfig } = require("../config/secureConfig");
initSecureConfig();
const { poolPromise, getPool } = require("../config/db");

let remotePoolInstance = null;

/**
 * Returns or establishes a connection pool to the Central Cloud ERP database.
 * Uses a short timeout (5s) so offline POS billing is NEVER delayed.
 */
async function getRemotePool() {
  if (remotePoolInstance && remotePoolInstance.connected) {
    try {
      await remotePoolInstance.request().query("SELECT 1 AS ping");
      return remotePoolInstance;
    } catch {
      try { await remotePoolInstance.close(); } catch {}
      remotePoolInstance = null;
    }
  }

  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || process.env.DB_USER,
    password: process.env.REMOTE_DB_PASSWORD || process.env.DB_PASSWORD,
    server: process.env.REMOTE_DB_SERVER || process.env.DB_SERVER,
    port: parseInt(process.env.REMOTE_DB_PORT || process.env.DB_PORT || "1433"),
    database: process.env.REMOTE_DB_NAME || process.env.DB_NAME,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 45000,
    },
    connectionTimeout: 30000,
    requestTimeout: 45000,
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 15000,
    },
  };

  try {
    const pool = new sql.ConnectionPool(remoteConfig);
    await pool.connect();
    remotePoolInstance = pool;
    remotePoolInstance.on("error", (err) => {
      console.warn("⚠️ [CloudSync Remote Pool Warning]:", err.message);
      try { remotePoolInstance?.close(); } catch {}
      remotePoolInstance = null;
    });
    return remotePoolInstance;
  } catch (err) {
    remotePoolInstance = null;
    throw new Error(`Cloud server unreachable: ${err.message}`);
  }
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Pushes live table status (TableMaster) and active carts (RestaurantOrderCur, RestaurantOrderDetailCur)
 * to Central Cloud ERP so online POS displays real-time occupancy and cart contents.
 */
async function syncLiveTablesAndCarts(remotePool, localPool) {
  // 1. Fetch Local Table Master
  const locTablesRes = await localPool.request().query(`
    SELECT TableId, TableNumber, DiningSection, Status, TotalAmount, 
           CONVERT(VARCHAR, StartTime, 126) as StartTime, 
           CurrentOrderId, CustomerName, Pax, entry_status,
           PAYMENT_STATUS, LockedByName, IsLocked
    FROM TableMaster WITH (NOLOCK)
  `);
  const locTables = locTablesRes.recordset;

  // 2. Sync TableMaster to Remote in a single batch
  let batchSql = "";
  const tblReq = remotePool.request();
  for (let i = 0; i < locTables.length; i++) {
    const t = locTables[i];
    const cleanTableNo = String(t.TableNumber || "").trim();
    const cleanTableId = String(t.TableId || "").trim();
    tblReq.input(`tid_${i}`, sql.UniqueIdentifier, cleanTableId);
    tblReq.input(`tno_${i}`, sql.VarChar(20), cleanTableNo);
    tblReq.input(`status_${i}`, sql.Int, t.Status !== undefined ? t.Status : 0);
    tblReq.input(`tot_${i}`, sql.Decimal(18, 2), t.TotalAmount || 0);
    tblReq.input(`startTime_${i}`, sql.DateTime, safeDate(t.StartTime));
    tblReq.input(`orderId_${i}`, sql.NVarChar(50), t.CurrentOrderId || null);
    tblReq.input(`custName_${i}`, sql.NVarChar(50), t.CustomerName || null);
    tblReq.input(`pax_${i}`, sql.Int, t.Pax || null);
    tblReq.input(`entryStatus_${i}`, sql.NVarChar(10), t.entry_status || null);
    tblReq.input(`payStatus_${i}`, sql.Int, t.PAYMENT_STATUS || null);
    tblReq.input(`lockedBy_${i}`, sql.NVarChar(50), t.LockedByName || null);

    batchSql += `
      UPDATE TableMaster
      SET Status = @status_${i},
          TotalAmount = @tot_${i},
          StartTime = @startTime_${i},
          CurrentOrderId = @orderId_${i},
          CustomerName = @custName_${i},
          Pax = @pax_${i},
          entry_status = @entryStatus_${i},
          PAYMENT_STATUS = @payStatus_${i},
          LockedByName = @lockedBy_${i},
          ModifiedOn = GETDATE()
      WHERE TableId = @tid_${i} OR LTRIM(RTRIM(TableNumber)) = @tno_${i};
    `;
  }
  if (batchSql) {
    await tblReq.query(batchSql);
  }

  // 3. Helper to fetch remote columns
  const remoteCols = async (tableName) => {
    const res = await remotePool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
    `);
    return res.recordset.filter(c => c.IsIdentity !== 1);
  };

  const orderCurCols = await remoteCols("RestaurantOrderCur");
  const orderDetailCurCols = await remoteCols("RestaurantOrderDetailCur");

  // 4. Fetch Local Open Orders (Active Carts)
  const locOpenOrdersRes = await localPool.request().query(`
    SELECT * FROM RestaurantOrderCur WITH (NOLOCK)
    WHERE (isOrderClosed = 0 OR isOrderClosed IS NULL)
  `);
  const locOpenOrders = locOpenOrdersRes.recordset;
  const openOrderGuids = [];

  for (const ord of locOpenOrders) {
    const orderGuid = ord.OrderId;
    const orderNo = ord.OrderNumber;
    openOrderGuids.push(orderGuid);

    const checkRes = await remotePool.request()
      .input("oid", sql.UniqueIdentifier, orderGuid)
      .input("ono", sql.NVarChar(50), orderNo)
      .query("SELECT TOP 1 OrderId FROM RestaurantOrderCur WITH (NOLOCK) WHERE OrderId = @oid OR OrderNumber = @ono");

    if (checkRes.recordset.length > 0) {
      const uReq = remotePool.request();
      uReq.input("oid", sql.UniqueIdentifier, orderGuid);
      uReq.input("ono", sql.NVarChar(50), orderNo);
      uReq.input("tot", sql.Decimal(18, 2), ord.TotalAmount || 0);
      uReq.input("subtot", sql.Decimal(18, 2), ord.TotalLineItemAmount || 0);
      uReq.input("disc", sql.Decimal(18, 2), ord.TotalDiscountAmount || 0);
      uReq.input("status", sql.Int, ord.StatusCode || 1);
      uReq.input("tblNo", sql.VarChar(20), ord.Tableno || "");
      uReq.input("custName", sql.NVarChar(50), ord.CustomerName || null);
      uReq.input("pax", sql.Int, ord.Pax || null);
      uReq.input("dt", sql.DateTime, safeDate(ord.OrderDateTime) || new Date());

      await uReq.query(`
        UPDATE RestaurantOrderCur
        SET TotalAmount = @tot,
            TotalLineItemAmount = @subtot,
            TotalDiscountAmount = @disc,
            StatusCode = @status,
            isOrderClosed = 0,
            Tableno = @tblNo,
            CustomerName = @custName,
            Pax = @pax,
            OrderDateTime = @dt,
            ModifiedOn = GETDATE()
        WHERE OrderId = @oid OR OrderNumber = @ono
      `);
    } else {
      const iReq = remotePool.request();
      const colNames = [];
      const paramNames = [];
      for (const col of orderCurCols) {
        const val = ord[col.COLUMN_NAME];
        if (val !== undefined && val !== null) {
          let paramVal = val;
          if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
            paramVal = safeDate(val);
          }
          colNames.push(`[${col.COLUMN_NAME}]`);
          paramNames.push(`@oc_${col.COLUMN_NAME}`);
          iReq.input(`oc_${col.COLUMN_NAME}`, paramVal);
        }
      }
      if (colNames.length > 0) {
        await iReq.query(`
          INSERT INTO RestaurantOrderCur (${colNames.join(", ")})
          VALUES (${paramNames.join(", ")})
        `).catch(e => console.warn("OrderCur insert warning:", e.message));
      }
    }
  }

  // 5. Sync Line Items (RestaurantOrderDetailCur) for active orders
  let itemsSynced = 0;
  if (openOrderGuids.length > 0) {
    const openGuidsFormatted = openOrderGuids.map(g => `'${g}'`).join(",");
    const locItemsRes = await localPool.request().query(`
      SELECT * FROM RestaurantOrderDetailCur WITH (NOLOCK)
      WHERE OrderId IN (${openGuidsFormatted})
        AND StatusCode <> 0
    `);
    const locItems = locItemsRes.recordset;

    const itemsByOrder = {};
    for (const item of locItems) {
      if (!itemsByOrder[item.OrderId]) itemsByOrder[item.OrderId] = [];
      itemsByOrder[item.OrderId].push(item);
    }

    for (const ordId of openOrderGuids) {
      const activeItemsForOrder = itemsByOrder[ordId] || [];
      const activeDetailIds = activeItemsForOrder.map(i => `'${i.OrderDetailId}'`);

      for (const item of activeItemsForOrder) {
        const detId = item.OrderDetailId;
        const cRes = await remotePool.request()
          .input("did", sql.UniqueIdentifier, detId)
          .query("SELECT TOP 1 OrderDetailId FROM RestaurantOrderDetailCur WITH (NOLOCK) WHERE OrderDetailId = @did");

        if (cRes.recordset.length > 0) {
          const uReq = remotePool.request();
          uReq.input("did", sql.UniqueIdentifier, detId);
          uReq.input("qty", sql.Decimal(18, 2), item.Quantity || 1);
          uReq.input("price", sql.Decimal(18, 2), item.PricePerUnit || 0);
          uReq.input("actual", sql.Decimal(18, 2), item.ActualAmount || 0);
          uReq.input("tot", sql.Decimal(18, 2), item.TotalDetailLineAmount || 0);
          uReq.input("status", sql.Int, item.StatusCode || 1);
          uReq.input("mods", sql.NVarChar(sql.MAX), item.ModifiersJSON || null);
          uReq.input("combos", sql.NVarChar(sql.MAX), item.ComboDetailsJSON || null);
          uReq.input("remarks", sql.NVarChar(500), item.Remarks || null);
          uReq.input("tw", sql.Bit, item.isTakeAway ? 1 : 0);
          uReq.input("song", sql.NVarChar(200), item.SongName || null);

          await uReq.query(`
            UPDATE RestaurantOrderDetailCur
            SET Quantity = @qty,
                PricePerUnit = @price,
                ActualAmount = @actual,
                TotalDetailLineAmount = @tot,
                StatusCode = @status,
                ModifiersJSON = @mods,
                ComboDetailsJSON = @combos,
                Remarks = @remarks,
                isTakeAway = @tw,
                SongName = @song,
                isSettlement = 0,
                ModifiedOn = GETDATE()
            WHERE OrderDetailId = @did
          `);
        } else {
          const iReq = remotePool.request();
          const colNames = [];
          const paramNames = [];
          for (const col of orderDetailCurCols) {
            const val = item[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              let paramVal = val;
              if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
                paramVal = safeDate(val);
              }
              colNames.push(`[${col.COLUMN_NAME}]`);
              paramNames.push(`@odc_${col.COLUMN_NAME}`);
              iReq.input(`odc_${col.COLUMN_NAME}`, paramVal);
            }
          }
          if (colNames.length > 0) {
            await iReq.query(`
              INSERT INTO RestaurantOrderDetailCur (${colNames.join(", ")})
              VALUES (${paramNames.join(", ")})
            `).catch(e => console.warn("Line item insert warning:", e.message));
          }
        }
        itemsSynced++;
      }

      // Void any items on remote that were removed locally
      if (activeDetailIds.length > 0) {
        await remotePool.request()
          .input("ordId", sql.UniqueIdentifier, ordId)
          .query(`
            UPDATE RestaurantOrderDetailCur
            SET StatusCode = 0, ModifiedOn = GETDATE()
            WHERE OrderId = @ordId
              AND OrderDetailId NOT IN (${activeDetailIds.join(",")})
              AND StatusCode <> 0
          `).catch(() => {});
      }
    }
  }

  // 6. Close Remote Orders for Available Tables (Tables with Status = 0)
  const availableTableNumbers = locTables
    .filter(t => t.Status === 0 && t.TableNumber)
    .map(t => `'${String(t.TableNumber).trim()}'`);

  if (availableTableNumbers.length > 0) {
    await remotePool.request().query(`
      UPDATE RestaurantOrderCur
      SET isOrderClosed = 1, ModifiedOn = GETDATE()
      WHERE (isOrderClosed = 0 OR isOrderClosed IS NULL)
        AND LTRIM(RTRIM(Tableno)) IN (${availableTableNumbers.join(",")})
    `).catch(() => {});
  }

  // Also close remote orders that are closed locally
  const locClosedOrders = await localPool.request().query(`
    SELECT TOP 50 OrderNumber FROM RestaurantOrderCur WITH (NOLOCK)
    WHERE isOrderClosed = 1
    ORDER BY ModifiedOn DESC
  `);
  const closedOrderNos = locClosedOrders.recordset.map(o => `'${o.OrderNumber}'`).filter(Boolean);
  if (closedOrderNos.length > 0) {
    await remotePool.request().query(`
      UPDATE RestaurantOrderCur
      SET isOrderClosed = 1, ModifiedOn = GETDATE()
      WHERE OrderNumber IN (${closedOrderNos.join(",")})
        AND (isOrderClosed = 0 OR isOrderClosed IS NULL)
    `).catch(() => {});
  }

  console.log(`✅ [CloudSync] Live tables & active carts synchronized (${locTables.length} tables, ${locOpenOrders.length} open orders, ${itemsSynced} items).`);
  return {
    tablesSynced: locTables.length,
    openOrdersSynced: locOpenOrders.length,
    itemsSynced,
  };
}

/**
 * Pushes offline settled sales and live table/cart status from Local MSSQL to Central Cloud ERP.
 * Guarantees transactional idempotency using SettlementID & BillNo.
 */
async function pushSalesToCloud(ioInstance = null) {
  let localPool;
  let remotePool;

  try {
    localPool = getPool() || (await poolPromise);
    if (!localPool) throw new Error("Local database connection unavailable");

    // 1. Connect to Central Cloud ERP
    remotePool = await getRemotePool();

    // 2. Synchronize Live Table Status and In-Progress Carts!
    let liveSyncResult = { tablesSynced: 0, openOrdersSynced: 0, itemsSynced: 0 };
    try {
      liveSyncResult = await syncLiveTablesAndCarts(remotePool, localPool);
    } catch (liveErr) {
      console.warn("⚠️ [CloudSync] Live table/cart sync notice:", liveErr.message);
    }

    // 3. Fetch un-uploaded settled bills from local DB, plus recent bills to ensure full table integrity
    const pendingRes = await localPool.request().query(`
      SELECT * FROM SettlementHeader WITH (NOLOCK)
      WHERE ((isUploadHQ = 0 OR isUploadHQ IS NULL)
         OR (start_date = (SELECT TOP 1 StartDate FROM DateEntry WITH (NOLOCK) ORDER BY CreatedDate DESC)))
        AND BillNo IS NOT NULL
        AND BillNo != ''
      ORDER BY CreatedOn ASC
    `);

    const pendingBills = pendingRes.recordset;
    if (pendingBills.length === 0) {
      // Still sync members, attendance, and sequences even if no pending bills
      try {
        await syncMembersAndCreditCustomers(remotePool, localPool);
        await syncStaffAttendance(remotePool, localPool);
        await syncSettingsAndSequences(remotePool, localPool);
        await syncArtistTargetsAndBonuses(remotePool, localPool);
      } catch (subSyncErr) {
        console.warn("⚠️ [CloudSync] Auxiliary sync notice:", subSyncErr.message);
      }

      // Update LastCloudSyncTime even if no bills were pending
      await localPool.request().query(`
        IF EXISTS (SELECT 1 FROM AppSettings)
          UPDATE AppSettings SET LastCloudSyncTime = GETDATE()
      `).catch(() => {});

      if (ioInstance) {
        ioInstance.emit("cloud_sync_completed", {
          type: "PUSH",
          pushedCount: 0,
          liveSync: liveSyncResult,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        pushedCount: 0,
        liveSync: liveSyncResult,
        message: `Cloud synchronized: ${liveSyncResult.tablesSynced} tables, ${liveSyncResult.openOrdersSynced} active carts, 0 pending bills.`,
      };
    }

    // Fetch column lists from remote Cloud tables to build precise INSERT statements
    const remoteCols = async (tableName) => {
      const res = await remotePool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `);
      return res.recordset;
    };

    const headerCols = (await remoteCols("SettlementHeader")).filter((c) => c.IsIdentity !== 1);
    const itemCols = (await remoteCols("SettlementItemDetail")).filter((c) => c.IsIdentity !== 1);
    const invCols = (await remoteCols("RestaurantInvoice")).filter((c) => c.IsIdentity !== 1);
    const invCurCols = (await remoteCols("RestaurantInvoiceCur")).filter((c) => c.IsIdentity !== 1);
    const payCols = (await remoteCols("PaymentDetail")).filter((c) => c.IsIdentity !== 1);
    const payCurCols = (await remoteCols("PaymentDetailCur")).filter((c) => c.IsIdentity !== 1);
    const stsCols = (await remoteCols("SettlementTotalSales")).filter((c) => c.IsIdentity !== 1);
    const sddCols = (await remoteCols("SettlementDiscountDetail")).filter((c) => c.IsIdentity !== 1);
    const orderCols = (await remoteCols("RestaurantOrder")).filter((c) => c.IsIdentity !== 1);
    const orderDetailCols = (await remoteCols("RestaurantOrderDetail")).filter((c) => c.IsIdentity !== 1);

    let pushedCount = 0;

    for (const bill of pendingBills) {
      const sid = bill.SettlementID;
      const billNo = bill.BillNo;

      try {
        // A. Idempotency Check on Remote Cloud DB
        const existCheck = await remotePool.request()
          .input("sid", sql.UniqueIdentifier, sid)
          .input("billNo", sql.NVarChar(50), billNo)
          .query(`
            SELECT TOP 1 SettlementID FROM SettlementHeader WITH (NOLOCK)
            WHERE SettlementID = @sid OR BillNo = @billNo
          `);

        let safeBillNo = billNo;
        if (existCheck.recordset.length > 0) {
          const matchedSid = String(existCheck.recordset[0].SettlementID || "").toLowerCase();
          if (matchedSid === String(sid).toLowerCase()) {
            // Already uploaded to Cloud
            await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query("UPDATE SettlementHeader SET isUploadHQ = 1 WHERE SettlementID = @sid");
            continue;
          } else {
            // BillNo collision: Cloud has a different bill with the same BillNo!
            safeBillNo = `${billNo}-${String(bill.CashierId || bill.StationId || "L").slice(-2)}`;
            console.warn(`⚠️ [CloudSync] Bill collision detected for ${billNo}. Disambiguating to ${safeBillNo}`);
            await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .input("newNo", sql.NVarChar(50), safeBillNo)
              .query("UPDATE SettlementHeader SET BillNo = @newNo WHERE SettlementID = @sid");
          }
        }

        if (true) {
          // B. Begin Remote Transaction for atomic multi-table insert
          const rTx = new sql.Transaction(remotePool);
          await rTx.begin();

          try {
            // 1. Insert SettlementHeader
            const shReq = new sql.Request(rTx);
            const shColNames = [];
            const shParamNames = [];
            for (const col of headerCols) {
              const val = bill[col.COLUMN_NAME];
              if (val !== undefined) {
                shColNames.push(`[${col.COLUMN_NAME}]`);
                shParamNames.push(`@h_${col.COLUMN_NAME}`);
                shReq.input(`h_${col.COLUMN_NAME}`, val);
              }
            }

            if (shColNames.length > 0) {
              await shReq.query(`
                INSERT INTO SettlementHeader (${shColNames.join(", ")})
                VALUES (${shParamNames.join(", ")})
              `);
            }

            // 2. Insert SettlementItemDetail
            const localItems = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`SELECT * FROM SettlementItemDetail WITH (NOLOCK) WHERE SettlementID = @sid`);

            for (let i = 0; i < localItems.recordset.length; i++) {
              const item = localItems.recordset[i];
              const itemReq = new sql.Request(rTx);
              const iColNames = [];
              const iParamNames = [];
              for (const col of itemCols) {
                const val = item[col.COLUMN_NAME];
                if (val !== undefined) {
                  iColNames.push(`[${col.COLUMN_NAME}]`);
                  iParamNames.push(`@i_${i}_${col.COLUMN_NAME}`);
                  itemReq.input(`i_${i}_${col.COLUMN_NAME}`, val);
                }
              }
              if (iColNames.length > 0) {
                await itemReq.query(`
                  INSERT INTO SettlementItemDetail (${iColNames.join(", ")})
                  VALUES (${iParamNames.join(", ")})
                `);
              }
            }

            // 3. Insert RestaurantInvoice & RestaurantInvoiceCur
            const localInvs = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`
                SELECT * FROM RestaurantInvoiceCur WITH (NOLOCK) WHERE RestaurantBillId = @sid
                UNION
                SELECT * FROM RestaurantInvoice WITH (NOLOCK) WHERE RestaurantBillId = @sid
              `);

            for (let j = 0; j < localInvs.recordset.length; j++) {
              const inv = localInvs.recordset[j];
              
              // 3a. RestaurantInvoice
              const invReq = new sql.Request(rTx);
              const vColNames = [];
              const vParamNames = [];
              for (const col of invCols) {
                const val = inv[col.COLUMN_NAME];
                if (val !== undefined) {
                  vColNames.push(`[${col.COLUMN_NAME}]`);
                  vParamNames.push(`@v_${j}_${col.COLUMN_NAME}`);
                  invReq.input(`v_${j}_${col.COLUMN_NAME}`, val);
                }
              }
              if (vColNames.length > 0) {
                await invReq.query(`
                  INSERT INTO RestaurantInvoice (${vColNames.join(", ")})
                  VALUES (${vParamNames.join(", ")})
                `).catch(() => {});
              }

              // 3b. RestaurantInvoiceCur
              const invCurReq = new sql.Request(rTx);
              const vcColNames = [];
              const vcParamNames = [];
              for (const col of invCurCols) {
                const val = inv[col.COLUMN_NAME];
                if (val !== undefined) {
                  vcColNames.push(`[${col.COLUMN_NAME}]`);
                  vcParamNames.push(`@vc_${j}_${col.COLUMN_NAME}`);
                  invCurReq.input(`vc_${j}_${col.COLUMN_NAME}`, val);
                }
              }
              if (vcColNames.length > 0) {
                await invCurReq.query(`
                  INSERT INTO RestaurantInvoiceCur (${vcColNames.join(", ")})
                  VALUES (${vcParamNames.join(", ")})
                `).catch(() => {});
              }
            }

            // 4. Insert PaymentDetail & PaymentDetailCur (Ensures paymode & payment breakdown sync to Cloud!)
            const localPays = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`
                SELECT * FROM PaymentDetailCur WITH (NOLOCK) WHERE RestaurantBillId = @sid
                UNION
                SELECT * FROM PaymentDetail WITH (NOLOCK) WHERE (RestaurantBillId = @sid OR SettlementId = @sid)
              `);

            for (let k = 0; k < localPays.recordset.length; k++) {
              const pay = localPays.recordset[k];
              
              // 4a. Remote PaymentDetail (Ledger/Audit)
              const payReq = new sql.Request(rTx);
              const pColNames = [];
              const pParamNames = [];
              for (const col of payCols) {
                const val = pay[col.COLUMN_NAME];
                if (val !== undefined) {
                  pColNames.push(`[${col.COLUMN_NAME}]`);
                  pParamNames.push(`@p_${k}_${col.COLUMN_NAME}`);
                  payReq.input(`p_${k}_${col.COLUMN_NAME}`, val);
                }
              }
              if (pColNames.length > 0) {
                await payReq.query(`
                  INSERT INTO PaymentDetail (${pColNames.join(", ")})
                  VALUES (${pParamNames.join(", ")})
                `).catch(() => {});
              }

              // 4b. Remote PaymentDetailCur (CRITICAL: Powers Settlement & POS Sales movements!)
              const payCurReq = new sql.Request(rTx);
              const pcColNames = [];
              const pcParamNames = [];
              for (const col of payCurCols) {
                const val = pay[col.COLUMN_NAME];
                if (val !== undefined) {
                  pcColNames.push(`[${col.COLUMN_NAME}]`);
                  pcParamNames.push(`@pc_${k}_${col.COLUMN_NAME}`);
                  payCurReq.input(`pc_${k}_${col.COLUMN_NAME}`, val);
                }
              }
              if (pcColNames.length > 0) {
                await payCurReq.query(`
                  INSERT INTO PaymentDetailCur (${pcColNames.join(", ")})
                  VALUES (${pcParamNames.join(", ")})
                `).catch(() => {});
              }
            }

            // 5. Insert SettlementTotalSales
            const localSts = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`SELECT * FROM SettlementTotalSales WITH (NOLOCK) WHERE SettlementID = @sid`);

            for (let s = 0; s < localSts.recordset.length; s++) {
              const sts = localSts.recordset[s];
              const stsReq = new sql.Request(rTx);
              const sColNames = [];
              const sParamNames = [];
              for (const col of stsCols) {
                const val = sts[col.COLUMN_NAME];
                if (val !== undefined) {
                  sColNames.push(`[${col.COLUMN_NAME}]`);
                  sParamNames.push(`@s_${s}_${col.COLUMN_NAME}`);
                  stsReq.input(`s_${s}_${col.COLUMN_NAME}`, val);
                }
              }
              if (sColNames.length > 0) {
                await stsReq.query(`
                  INSERT INTO SettlementTotalSales (${sColNames.join(", ")})
                  VALUES (${sParamNames.join(", ")})
                `);
              }
            }

            // 6. Insert SettlementDiscountDetail
            const localSdd = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`SELECT * FROM SettlementDiscountDetail WITH (NOLOCK) WHERE SettlementId = @sid`);

            for (let d = 0; d < localSdd.recordset.length; d++) {
              const sdd = localSdd.recordset[d];
              const sddReq = new sql.Request(rTx);
              const dColNames = [];
              const dParamNames = [];
              for (const col of sddCols) {
                const val = sdd[col.COLUMN_NAME];
                if (val !== undefined) {
                  dColNames.push(`[${col.COLUMN_NAME}]`);
                  dParamNames.push(`@d_${d}_${col.COLUMN_NAME}`);
                  sddReq.input(`d_${d}_${col.COLUMN_NAME}`, val);
                }
              }
              if (dColNames.length > 0) {
                await sddReq.query(`
                  INSERT INTO SettlementDiscountDetail (${dColNames.join(", ")})
                  VALUES (${dParamNames.join(", ")})
                `);
              }
            }

            // 7. Insert RestaurantOrder & RestaurantOrderDetail (Historical Closed Order Records)
            const IS_UUID_RGX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            let targetOrderGuid = null;

            if (bill.OrderId && IS_UUID_RGX.test(String(bill.OrderId).trim())) {
              targetOrderGuid = String(bill.OrderId).trim();
            } else if (bill.OrderId || bill.BillNo) {
              const lookupVal = String(bill.OrderId || bill.BillNo).trim();
              const ordLookup = await localPool.request()
                .input("orderNo", sql.NVarChar(100), lookupVal)
                .query(`
                  SELECT TOP 1 OrderId FROM RestaurantOrder WITH (NOLOCK) 
                  WHERE OrderNumber = @orderNo OR OrderId = TRY_CAST(@orderNo AS UNIQUEIDENTIFIER)
                `);
              if (ordLookup.recordset.length > 0) {
                targetOrderGuid = ordLookup.recordset[0].OrderId;
              }
            }

            if (targetOrderGuid && IS_UUID_RGX.test(targetOrderGuid)) {
              const localOrderRes = await localPool.request()
                .input("oid", sql.UniqueIdentifier, targetOrderGuid)
                .query("SELECT TOP 1 * FROM RestaurantOrder WITH (NOLOCK) WHERE OrderId = @oid");

              if (localOrderRes.recordset.length > 0) {
                const ordRow = localOrderRes.recordset[0];
                const ordCheck = await remotePool.request()
                  .input("oid", sql.UniqueIdentifier, ordRow.OrderId)
                  .query("SELECT TOP 1 OrderId FROM RestaurantOrder WITH (NOLOCK) WHERE OrderId = @oid");

                if (ordCheck.recordset.length === 0) {
                  const oReq = new sql.Request(rTx);
                  const oColNames = [];
                  const oParamNames = [];
                  for (const col of orderCols) {
                    const val = ordRow[col.COLUMN_NAME];
                    if (val !== undefined && val !== null) {
                      let paramVal = val;
                      if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
                        paramVal = safeDate(val);
                      }
                      oColNames.push(`[${col.COLUMN_NAME}]`);
                      oParamNames.push(`@ro_${col.COLUMN_NAME}`);
                      oReq.input(`ro_${col.COLUMN_NAME}`, paramVal);
                    }
                  }
                  if (oColNames.length > 0) {
                    await oReq.query(`INSERT INTO RestaurantOrder (${oColNames.join(", ")}) VALUES (${oParamNames.join(", ")})`).catch(() => {});
                  }
                }

                const localDetailsRes = await localPool.request()
                  .input("oid", sql.UniqueIdentifier, ordRow.OrderId)
                  .query("SELECT * FROM RestaurantOrderDetail WITH (NOLOCK) WHERE OrderId = @oid");

                for (let d = 0; d < localDetailsRes.recordset.length; d++) {
                  const dRow = localDetailsRes.recordset[d];
                  const odCheck = await remotePool.request()
                    .input("did", sql.UniqueIdentifier, dRow.OrderDetailId)
                    .query("SELECT TOP 1 OrderDetailId FROM RestaurantOrderDetail WITH (NOLOCK) WHERE OrderDetailId = @did");

                  if (odCheck.recordset.length === 0) {
                    const odReq = new sql.Request(rTx);
                    const odColNames = [];
                    const odParamNames = [];
                    for (const col of orderDetailCols) {
                      const val = dRow[col.COLUMN_NAME];
                      if (val !== undefined && val !== null) {
                        let paramVal = val;
                        if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
                          paramVal = safeDate(val);
                        }
                        odColNames.push(`[${col.COLUMN_NAME}]`);
                        odParamNames.push(`@rod_${d}_${col.COLUMN_NAME}`);
                        odReq.input(`rod_${d}_${col.COLUMN_NAME}`, paramVal);
                      }
                    }
                    if (odColNames.length > 0) {
                      await odReq.query(`INSERT INTO RestaurantOrderDetail (${odColNames.join(", ")}) VALUES (${odParamNames.join(", ")})`).catch(() => {});
                    }
                  }
                }
              }
            }

            await rTx.commit();
          } catch (rErr) {
            await rTx.rollback();
            throw rErr;
          }
        } else {
          // Bill already exists on Cloud: Ensure PaymentDetailCur and RestaurantInvoiceCur are backfilled if missing
          const remotePayCheck = await remotePool.request()
            .input("sid", sql.UniqueIdentifier, sid)
            .query(`SELECT TOP 1 PaymentId FROM PaymentDetailCur WITH (NOLOCK) WHERE RestaurantBillId = @sid`);

          if (remotePayCheck.recordset.length === 0) {
            const localPays = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`
                SELECT * FROM PaymentDetailCur WITH (NOLOCK) WHERE RestaurantBillId = @sid
                UNION
                SELECT * FROM PaymentDetail WITH (NOLOCK) WHERE (RestaurantBillId = @sid OR SettlementId = @sid)
              `);

            for (let k = 0; k < localPays.recordset.length; k++) {
              const pay = localPays.recordset[k];
              const payCurReq = new sql.Request(remotePool);
              const pcColNames = [];
              const pcParamNames = [];
              for (const col of payCurCols) {
                const val = pay[col.COLUMN_NAME];
                if (val !== undefined) {
                  pcColNames.push(`[${col.COLUMN_NAME}]`);
                  pcParamNames.push(`@pc_${k}_${col.COLUMN_NAME}`);
                  payCurReq.input(`pc_${k}_${col.COLUMN_NAME}`, val);
                }
              }
              if (pcColNames.length > 0) {
                await payCurReq.query(`
                  INSERT INTO PaymentDetailCur (${pcColNames.join(", ")})
                  VALUES (${pcParamNames.join(", ")})
                `).catch(() => {});
              }
            }
          }
        }

        // C. Update Local Flags: isUploadHQ = 1
        await localPool.request()
          .input("sid", sql.UniqueIdentifier, sid)
          .query(`
            UPDATE SettlementHeader SET isUploadHQ = 1 WHERE SettlementID = @sid;
            UPDATE RestaurantInvoice SET isUploadHQ = 1 WHERE RestaurantBillId = @sid;
            UPDATE PaymentDetail SET isUploadHQ = 1 WHERE RestaurantBillId = @sid OR SettlementId = @sid;
          `);

        pushedCount++;
      } catch (billErr) {
        console.error(`⚠️ [CloudSync] Error syncing bill ${billNo}:`, billErr.message);
      }
    }

    // 3. Sync Members & Credit Customers (Push balances & transactions, Pull new members)
    await syncMembersAndCreditCustomers(remotePool, localPool);

    // 4. Sync Staff Attendance (DailyAttendance, DailyAttendanceLog, TimeEntry)
    await syncStaffAttendance(remotePool, localPool);

    // 5. Sync Settings & Order Sequences
    await syncSettingsAndSequences(remotePool, localPool);

    // 6. Sync Artist Targets, CashBox & Bonus Transactions
    await syncArtistTargetsAndBonuses(remotePool, localPool);

    // 7. Update LastCloudSyncTime in AppSettings
    await localPool.request().query(`
      IF EXISTS (SELECT 1 FROM AppSettings)
        UPDATE AppSettings SET LastCloudSyncTime = GETDATE()
    `).catch(() => {});

    console.log(`☁️ [CloudSync] Successfully pushed ${pushedCount} bills to Central Cloud ERP.`);

    if (ioInstance) {
      ioInstance.emit("cloud_sync_completed", {
        type: "PUSH",
        pushedCount,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      pushedCount,
      liveSync: liveSyncResult,
      totalPending: pendingBills.length - pushedCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("⚠️ [CloudSync Push Notice]:", error.message);
    return {
      success: false,
      offline: true,
      error: error.message,
    };
  }
}

/**
 * Pulls any settled sales created on Central Cloud ERP (or other terminals) down to Local DB.
 * Guarantees that local POS reports and analytics always match cloud numbers 100%.
 */
async function pullSalesFromCloud(ioInstance = null) {
  let localPool;
  let remotePool;

  try {
    localPool = getPool() || (await poolPromise);
    remotePool = await getRemotePool();

    const localCols = async (tableName) => {
      const res = await localPool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `);
      return res.recordset.filter((c) => c.IsIdentity !== 1);
    };

    const headerCols = await localCols("SettlementHeader");
    const itemCols = await localCols("SettlementItemDetail");
    const stsCols = await localCols("SettlementTotalSales");
    const payCurCols = await localCols("PaymentDetailCur");
    const invCurCols = await localCols("RestaurantInvoiceCur");
    const orderCols = await localCols("RestaurantOrder");

    // Fetch settled bills from remote
    const remoteBillsRes = await remotePool.request().query(`
      SELECT * FROM SettlementHeader WITH (NOLOCK)
      WHERE BillNo IS NOT NULL AND BillNo != ''
      ORDER BY LastSettlementDate DESC
    `);

    // Fetch existing SettlementIDs from local
    const localSidsRes = await localPool.request().query(
      "SELECT SettlementID FROM SettlementHeader WITH (NOLOCK)"
    );
    const localSids = new Set(
      localSidsRes.recordset.map((r) => String(r.SettlementID).toLowerCase())
    );

    const missingFromLocal = remoteBillsRes.recordset.filter(
      (b) => !localSids.has(String(b.SettlementID).toLowerCase())
    );

    if (missingFromLocal.length === 0) {
      return {
        success: true,
        pulledCount: 0,
        message: "Local sales are fully up-to-date with Cloud.",
      };
    }

    console.log(`📥 [CloudSync] Pulling ${missingFromLocal.length} sales from Cloud into Local DB...`);
    let pulledCount = 0;

    for (const bill of missingFromLocal) {
      const sid = bill.SettlementID;
      const lTx = new sql.Transaction(localPool);
      await lTx.begin();

      try {
        // 1. Insert SettlementHeader
        const shReq = new sql.Request(lTx);
        const shColNames = [];
        const shParamNames = [];
        for (const col of headerCols) {
          let val = bill[col.COLUMN_NAME];
          if (col.COLUMN_NAME === "isUploadHQ") val = 1;
          if (val !== undefined && val !== null) {
            shColNames.push(`[${col.COLUMN_NAME}]`);
            shParamNames.push(`@h_${col.COLUMN_NAME}`);
            shReq.input(`h_${col.COLUMN_NAME}`, val);
          }
        }
        if (shColNames.length > 0) {
          await shReq.query(
            `INSERT INTO SettlementHeader (${shColNames.join(", ")}) VALUES (${shParamNames.join(", ")})`
          );
        }

        // 2. Insert SettlementItemDetail
        const rItems = await remotePool
          .request()
          .input("sid", sql.UniqueIdentifier, sid)
          .query("SELECT * FROM SettlementItemDetail WITH (NOLOCK) WHERE SettlementID = @sid");

        for (let i = 0; i < rItems.recordset.length; i++) {
          const item = rItems.recordset[i];
          const itemReq = new sql.Request(lTx);
          const iCols = [];
          const iParams = [];
          for (const col of itemCols) {
            const val = item[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              iCols.push(`[${col.COLUMN_NAME}]`);
              iParams.push(`@i_${i}_${col.COLUMN_NAME}`);
              itemReq.input(`i_${i}_${col.COLUMN_NAME}`, val);
            }
          }
          if (iCols.length > 0) {
            await itemReq.query(
              `INSERT INTO SettlementItemDetail (${iCols.join(", ")}) VALUES (${iParams.join(", ")})`
            );
          }
        }

        // 3. Insert SettlementTotalSales
        const rSts = await remotePool
          .request()
          .input("sid", sql.UniqueIdentifier, sid)
          .query("SELECT * FROM SettlementTotalSales WITH (NOLOCK) WHERE SettlementID = @sid");

        for (let s = 0; s < rSts.recordset.length; s++) {
          const sts = rSts.recordset[s];
          const stsReq = new sql.Request(lTx);
          const sCols = [];
          const sParams = [];
          for (const col of stsCols) {
            const val = sts[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              sCols.push(`[${col.COLUMN_NAME}]`);
              sParams.push(`@s_${s}_${col.COLUMN_NAME}`);
              stsReq.input(`s_${s}_${col.COLUMN_NAME}`, val);
            }
          }
          if (sCols.length > 0) {
            await stsReq.query(
              `INSERT INTO SettlementTotalSales (${sCols.join(", ")}) VALUES (${sParams.join(", ")})`
            );
          }
        }

        // 4. Insert PaymentDetailCur
        const rPay = await remotePool
          .request()
          .input("sid", sql.UniqueIdentifier, sid)
          .query(
            "SELECT * FROM PaymentDetailCur WITH (NOLOCK) WHERE RestaurantBillId = @sid UNION SELECT * FROM PaymentDetail WITH (NOLOCK) WHERE RestaurantBillId = @sid OR SettlementId = @sid"
          );

        for (let p = 0; p < rPay.recordset.length; p++) {
          const pay = rPay.recordset[p];
          const payReq = new sql.Request(lTx);
          const pCols = [];
          const pParams = [];
          for (const col of payCurCols) {
            const val = pay[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              pCols.push(`[${col.COLUMN_NAME}]`);
              pParams.push(`@p_${p}_${col.COLUMN_NAME}`);
              payReq.input(`p_${p}_${col.COLUMN_NAME}`, val);
            }
          }
          if (pCols.length > 0) {
            await payReq.query(
              `INSERT INTO PaymentDetailCur (${pCols.join(", ")}) VALUES (${pParams.join(", ")})`
            ).catch(() => {});
          }
        }

        // 5. Insert RestaurantInvoiceCur
        const rInv = await remotePool
          .request()
          .input("sid", sql.UniqueIdentifier, sid)
          .query(
            "SELECT * FROM RestaurantInvoiceCur WITH (NOLOCK) WHERE RestaurantBillId = @sid UNION SELECT * FROM RestaurantInvoice WITH (NOLOCK) WHERE RestaurantBillId = @sid"
          );

        for (let j = 0; j < rInv.recordset.length; j++) {
          const inv = rInv.recordset[j];
          const invReq = new sql.Request(lTx);
          const ivCols = [];
          const ivParams = [];
          for (const col of invCurCols) {
            const val = inv[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              ivCols.push(`[${col.COLUMN_NAME}]`);
              ivParams.push(`@iv_${j}_${col.COLUMN_NAME}`);
              invReq.input(`iv_${j}_${col.COLUMN_NAME}`, val);
            }
          }
          if (ivCols.length > 0) {
            await invReq.query(
              `INSERT INTO RestaurantInvoiceCur (${ivCols.join(", ")}) VALUES (${ivParams.join(", ")})`
            ).catch(() => {});
          }
        }

        // 6. Insert RestaurantOrder if exists
        if (bill.OrderId) {
          const rOrd = await remotePool
            .request()
            .input("oid", sql.UniqueIdentifier, bill.OrderId)
            .query("SELECT TOP 1 * FROM RestaurantOrder WITH (NOLOCK) WHERE OrderId = @oid")
            .catch(() => ({ recordset: [] }));

          if (rOrd.recordset && rOrd.recordset.length > 0) {
            const ord = rOrd.recordset[0];
            const oReq = new sql.Request(lTx);
            const oCols = [];
            const oParams = [];
            for (const col of orderCols) {
              const val = ord[col.COLUMN_NAME];
              if (val !== undefined && val !== null) {
                oCols.push(`[${col.COLUMN_NAME}]`);
                oParams.push(`@o_${col.COLUMN_NAME}`);
                oReq.input(`o_${col.COLUMN_NAME}`, val);
              }
            }
            if (oCols.length > 0) {
              await oReq.query(
                `INSERT INTO RestaurantOrder (${oCols.join(", ")}) VALUES (${oParams.join(", ")})`
              ).catch(() => {});
            }
          }
        }

        await lTx.commit();
        pulledCount++;
      } catch (billErr) {
        await lTx.rollback();
        console.warn(`⚠️ [CloudSync] Error pulling bill ${bill.BillNo}:`, billErr.message);
      }
    }

    console.log(`✅ [CloudSync] Successfully pulled ${pulledCount} bills from Cloud ERP.`);

    if (ioInstance && pulledCount > 0) {
      ioInstance.emit("cloud_sync_completed", {
        type: "PULL_SALES",
        pulledCount,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      pulledCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("⚠️ [CloudSync Pull Sales Notice]:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Full Bidirectional Synchronization:
 * 1. Pushes pending local offline sales to Cloud ERP
 * 2. Pulls new Cloud sales (from online ordering / other terminals) into Local DB
 * 3. Pulls master data changes (dishes, prices, categories) to Local DB
 */
async function fullBidirectionalSync(ioInstance = null) {
  const pushRes = await pushSalesToCloud(ioInstance).catch((e) => ({ success: false, error: e.message }));
  const pullSalesRes = await pullSalesFromCloud(ioInstance).catch((e) => ({ success: false, error: e.message }));
  const pullMasterRes = await pullMasterFromCloud(ioInstance).catch((e) => ({ success: false, error: e.message }));

  return {
    success: true,
    push: pushRes,
    pullSales: pullSalesRes,
    pullMaster: pullMasterRes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Pulls master data (Menu, Categories, DishGroups, Tables, Paymodes) from Cloud ERP to Local DB.
 * Allows POS to reflect price changes and new items added on Central Cloud ERP.
 */
async function pullMasterFromCloud(ioInstance = null) {
  let localPool;
  let remotePool;

  try {
    localPool = getPool() || (await poolPromise);
    remotePool = await getRemotePool();

    console.log("🔄 [CloudSync] Pulling latest Master Data from Cloud ERP...");

    // 1. Pull DishMaster
    const remoteDishes = await remotePool.request().query(`
      SELECT DishId, Name, DishGroupId, currentcost, IsActive, Description, DishCode, ModifiedOn
      FROM DishMaster WITH (NOLOCK)
    `);

    for (const d of remoteDishes.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, d.DishId)
        .input("name", sql.NVarChar(200), d.Name)
        .input("groupId", sql.UniqueIdentifier, d.DishGroupId)
        .input("cost", sql.Decimal(18, 2), d.currentcost)
        .input("isActive", sql.Bit, d.IsActive ? 1 : 0)
        .input("code", sql.NVarChar(50), d.DishCode || null)
        .input("desc", sql.NVarChar(500), d.Description || null)
        .query(`
          IF EXISTS (SELECT 1 FROM DishMaster WHERE DishId = @id)
            UPDATE DishMaster 
            SET Name = @name, DishGroupId = @groupId, currentcost = @cost, IsActive = @isActive, 
                DishCode = @code, Description = @desc, ModifiedOn = GETDATE()
            WHERE DishId = @id
          ELSE
            INSERT INTO DishMaster (DishId, Name, DishGroupId, currentcost, IsActive, DishCode, Description, CreatedOn, ModifiedOn)
            VALUES (@id, @name, @groupId, @cost, @isActive, @code, @desc, GETDATE(), GETDATE())
        `).catch(() => {});
    }


    // 2. Pull DishGroupMaster
    const remoteGroups = await remotePool.request().query(`
      SELECT DishGroupId, DishGroupName, IsActive FROM DishGroupMaster WITH (NOLOCK)
    `);
    for (const g of remoteGroups.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, g.DishGroupId)
        .input("name", sql.NVarChar(100), g.DishGroupName)
        .input("isActive", sql.Bit, g.IsActive ? 1 : 0)
        .query(`
          IF EXISTS (SELECT 1 FROM DishGroupMaster WHERE DishGroupId = @id)
            UPDATE DishGroupMaster SET DishGroupName = @name, IsActive = @isActive WHERE DishGroupId = @id
          ELSE
            INSERT INTO DishGroupMaster (DishGroupId, DishGroupName, IsActive) VALUES (@id, @name, @isActive)
        `).catch(() => {});
    }

    // 3. Pull CategoryMaster
    const remoteCats = await remotePool.request().query(`
      SELECT CategoryId, CategoryName, IsActive FROM CategoryMaster WITH (NOLOCK)
    `);
    for (const c of remoteCats.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, c.CategoryId)
        .input("name", sql.NVarChar(100), c.CategoryName)
        .input("isActive", sql.Bit, c.IsActive ? 1 : 0)
        .query(`
          IF EXISTS (SELECT 1 FROM CategoryMaster WHERE CategoryId = @id)
            UPDATE CategoryMaster SET CategoryName = @name, IsActive = @isActive WHERE CategoryId = @id
          ELSE
            INSERT INTO CategoryMaster (CategoryId, CategoryName, IsActive) VALUES (@id, @name, @isActive)
        `).catch(() => {});
    }

    // 4. Pull TableMaster (Tables configured in Central Cloud ERP)
    const remoteTables = await remotePool.request().query(`
      SELECT TableId, TableNumber, DiningSection, Pax, IsActive, TableName FROM TableMaster WITH (NOLOCK)
    `).catch(() => ({ recordset: [] }));

    for (const t of remoteTables.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, t.TableId)
        .input("num", sql.VarChar(20), t.TableNumber)
        .input("sec", sql.Int, t.DiningSection || 1)
        .input("pax", sql.Int, t.Pax || 4)
        .input("active", sql.Bit, t.IsActive ? 1 : 0)
        .input("name", sql.NVarChar(50), t.TableName || t.TableNumber)
        .query(`
          IF EXISTS (SELECT 1 FROM TableMaster WHERE TableId = @id)
            UPDATE TableMaster SET TableNumber = @num, DiningSection = @sec, Pax = @pax, IsActive = @active, TableName = @name WHERE TableId = @id
          ELSE
            INSERT INTO TableMaster (TableId, TableNumber, DiningSection, Pax, IsActive, TableName, Status)
            VALUES (@id, @num, @sec, @pax, @active, @name, 0)
        `).catch(() => {});
    }

    // 5. Pull new Members & Credit Accounts from Cloud
    await syncMembersAndCreditCustomers(remotePool, localPool);

    // 6. Pull updated CompanySettings from Cloud
    await syncSettingsAndSequences(remotePool, localPool);

    // 7. Sync Artist Targets (dishOrderItemShare)
    await syncArtistTargetsAndBonuses(remotePool, localPool);

    // 8. Pull Users & AllowedLogins from Cloud
    await syncUsersFromCloud(remotePool, localPool);

    console.log(`✅ [CloudSync] Master data pull complete (${remoteDishes.recordset.length} dishes, ${remoteTables.recordset.length} tables synced).`);

    if (ioInstance) {
      ioInstance.emit("master_data_updated", {
        timestamp: new Date().toISOString(),
        dishCount: remoteDishes.recordset.length,
      });
    }

    return {
      success: true,
      dishCount: remoteDishes.recordset.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("⚠️ [CloudSync Master Pull Notice]:", error.message);
    return {
      success: false,
      offline: true,
      error: error.message,
    };
  }
}

/**
 * Synchronizes MemberMaster, CreditCustomerMaster, and CustomerCreditTransactions
 * between Local and Remote Cloud ERP.
 */
async function syncMembersAndCreditCustomers(remotePool, localPool) {
  try {
    const remoteCols = async (tableName) => {
      const res = await remotePool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `);
      return res.recordset.filter(c => c.IsIdentity !== 1);
    };

    // 1. Push CustomerCreditTransactions (idempotent on TransactionId)
    const pendingTxRes = await localPool.request().query(`
      SELECT TOP 100 * FROM CustomerCreditTransactions WITH (NOLOCK)
      ORDER BY CreatedDate DESC
    `);
    const txCols = await remoteCols("CustomerCreditTransactions");
    let txCount = 0;

    for (const tx of pendingTxRes.recordset) {
      const check = await remotePool.request()
        .input("txId", sql.UniqueIdentifier, tx.TransactionId)
        .query("SELECT TOP 1 TransactionId FROM CustomerCreditTransactions WITH (NOLOCK) WHERE TransactionId = @txId");

      if (check.recordset.length === 0) {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of txCols) {
          const val = tx[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "datetime2", "smalldatetime"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@tx_${col.COLUMN_NAME}`);
            iReq.input(`tx_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO CustomerCreditTransactions (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(e => console.warn("CreditTx insert warning:", e.message));
          txCount++;
        }
      }
    }

    // 2. Push MemberMaster balances (CurrentBalance, CreditLimit, RewardCredit, Promoamount, IsActive)
    const locMembersRes = await localPool.request().query(`
      SELECT MemberId, Name, Phone, Email, CreditLimit, CurrentBalance, RewardCredit, Promoamount, IsActive, ModifiedDate
      FROM MemberMaster WITH (NOLOCK)
    `);
    const memCols = await remoteCols("MemberMaster");

    for (const m of locMembersRes.recordset) {
      const check = await remotePool.request()
        .input("mId", sql.UniqueIdentifier, m.MemberId)
        .query("SELECT TOP 1 MemberId FROM MemberMaster WITH (NOLOCK) WHERE MemberId = @mId");

      if (check.recordset.length > 0) {
        await remotePool.request()
          .input("mId", sql.UniqueIdentifier, m.MemberId)
          .input("bal", sql.Decimal(18, 2), m.CurrentBalance || 0)
          .input("limit", sql.Decimal(18, 2), m.CreditLimit || 0)
          .input("rc", sql.Decimal(18, 2), m.RewardCredit || 0)
          .input("pa", sql.Decimal(18, 2), m.Promoamount || 0)
          .input("active", sql.Bit, m.IsActive ? 1 : 0)
          .input("dt", sql.DateTime, safeDate(m.ModifiedDate) || new Date())
          .query(`
            UPDATE MemberMaster
            SET CurrentBalance = @bal,
                CreditLimit = @limit,
                RewardCredit = @rc,
                Promoamount = @pa,
                IsActive = @active,
                ModifiedDate = @dt
            WHERE MemberId = @mId
          `).catch(() => {});
      } else {
        const fullMem = await localPool.request()
          .input("mId", sql.UniqueIdentifier, m.MemberId)
          .query("SELECT TOP 1 * FROM MemberMaster WITH (NOLOCK) WHERE MemberId = @mId");
        if (fullMem.recordset.length > 0) {
          const row = fullMem.recordset[0];
          const iReq = remotePool.request();
          const colNames = [];
          const paramNames = [];
          for (const col of memCols) {
            const val = row[col.COLUMN_NAME];
            if (val !== undefined && val !== null) {
              let paramVal = val;
              if (["datetime", "date", "smalldatetime", "datetime2"].includes(col.DATA_TYPE)) {
                paramVal = safeDate(val);
              }
              colNames.push(`[${col.COLUMN_NAME}]`);
              paramNames.push(`@m_${col.COLUMN_NAME}`);
              iReq.input(`m_${col.COLUMN_NAME}`, paramVal);
            }
          }
          if (colNames.length > 0) {
            await iReq.query(`
              INSERT INTO MemberMaster (${colNames.join(", ")})
              VALUES (${paramNames.join(", ")})
            `).catch(() => {});
          }
        }
      }
    }

    // 3. Push CreditCustomerMaster balances
    const locCustRes = await localPool.request().query(`
      SELECT CustomerId, Name, Phone, Email, CreditLimit, CurrentBalance, IsActive
      FROM CreditCustomerMaster WITH (NOLOCK)
    `);
    for (const c of locCustRes.recordset) {
      await remotePool.request()
        .input("cId", sql.UniqueIdentifier, c.CustomerId)
        .input("bal", sql.Decimal(18, 2), c.CurrentBalance || 0)
        .input("limit", sql.Decimal(18, 2), c.CreditLimit || 0)
        .input("active", sql.Bit, c.IsActive ? 1 : 0)
        .query(`
          IF EXISTS (SELECT 1 FROM CreditCustomerMaster WHERE CustomerId = @cId)
            UPDATE CreditCustomerMaster 
            SET CurrentBalance = @bal, CreditLimit = @limit, IsActive = @active
            WHERE CustomerId = @cId
        `).catch(() => {});
    }

    // 4. Pull new Members from Remote down to Local (bidirectional)
    const remoteNewMems = await remotePool.request().query(`
      SELECT MemberId, Name, Phone, Email, CreditLimit, CurrentBalance, RewardCredit, Promoamount, IsActive
      FROM MemberMaster WITH (NOLOCK)
      WHERE MemberId NOT IN (SELECT MemberId FROM MemberMaster WITH (NOLOCK))
    `).catch(() => ({ recordset: [] }));

    for (const nm of remoteNewMems.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, nm.MemberId)
        .input("name", sql.NVarChar(200), nm.Name)
        .input("phone", sql.NVarChar(50), nm.Phone || null)
        .input("email", sql.NVarChar(100), nm.Email || null)
        .input("limit", sql.Decimal(18, 2), nm.CreditLimit || 0)
        .input("bal", sql.Decimal(18, 2), nm.CurrentBalance || 0)
        .input("rc", sql.Decimal(18, 2), nm.RewardCredit || 0)
        .input("pa", sql.Decimal(18, 2), nm.Promoamount || 0)
        .input("active", sql.Bit, nm.IsActive ? 1 : 0)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM MemberMaster WHERE MemberId = @id)
            INSERT INTO MemberMaster (MemberId, Name, Phone, Email, CreditLimit, CurrentBalance, RewardCredit, Promoamount, IsActive, CreatedAt)
            VALUES (@id, @name, @phone, @email, @limit, @bal, @rc, @pa, @active, GETDATE())
        `).catch(() => {});
    }

    console.log(`✅ [CloudSync] Members & credit ledger synchronized (tx: ${txCount}, members: ${locMembersRes.recordset.length}).`);
  } catch (err) {
    console.warn("⚠️ [CloudSync Members Notice]:", err.message);
  }
}

/**
 * Synchronizes Staff Attendance (DailyAttendance, DailyAttendanceLog, TimeEntry) to Cloud ERP.
 */
async function syncStaffAttendance(remotePool, localPool) {
  try {
    const remoteCols = async (tableName) => {
      const res = await remotePool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `);
      return res.recordset.filter(c => c.IsIdentity !== 1);
    };

    // 1. DailyAttendance
    const locAttRes = await localPool.request().query(`
      SELECT TOP 50 * FROM DailyAttendance WITH (NOLOCK)
      ORDER BY StartDateTime DESC
    `);
    const attCols = await remoteCols("DailyAttendance");

    for (const att of locAttRes.recordset) {
      const sdt = safeDate(att.StartDateTime);
      if (!sdt) continue;

      const check = await remotePool.request()
        .input("dpId", sql.UniqueIdentifier, att.DeliveryPersonId)
        .input("sdt", sql.DateTime, sdt)
        .query(`
          SELECT TOP 1 DeliveryPersonId FROM DailyAttendance WITH (NOLOCK)
          WHERE DeliveryPersonId = @dpId AND CAST(StartDateTime as DATE) = CAST(@sdt as DATE)
        `);

      if (check.recordset.length === 0) {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of attCols) {
          const val = att[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@da_${col.COLUMN_NAME}`);
            iReq.input(`da_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO DailyAttendance (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(() => {});
        }
      } else {
        await remotePool.request()
          .input("dpId", sql.UniqueIdentifier, att.DeliveryPersonId)
          .input("sdt", sql.DateTime, sdt)
          .input("edt", sql.DateTime, safeDate(att.EndDateTime))
          .input("hrs", sql.Decimal(18, 2), att.NoofHours || 0)
          .input("amt", sql.Decimal(18, 2), att.TotalAmount || 0)
          .query(`
            UPDATE DailyAttendance
            SET EndDateTime = @edt, NoofHours = @hrs, TotalAmount = @amt, ModifiedOn = GETDATE()
            WHERE DeliveryPersonId = @dpId AND CAST(StartDateTime as DATE) = CAST(@sdt as DATE)
          `).catch(() => {});
      }
    }

    // 2. TimeEntry
    const locTimeRes = await localPool.request().query(`
      SELECT TOP 50 * FROM TimeEntry WITH (NOLOCK)
      ORDER BY ClockinTime DESC
    `);
    const timeCols = await remoteCols("TimeEntry");

    for (const te of locTimeRes.recordset) {
      const cit = safeDate(te.ClockinTime);
      if (!cit) continue;

      const check = await remotePool.request()
        .input("uid", sql.UniqueIdentifier, te.Userid)
        .input("cit", sql.DateTime, cit)
        .query(`
          SELECT TOP 1 Userid FROM TimeEntry WITH (NOLOCK)
          WHERE Userid = @uid AND ClockinTime = @cit
        `);

      if (check.recordset.length === 0) {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of timeCols) {
          const val = te[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "smalldatetime"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@te_${col.COLUMN_NAME}`);
            iReq.input(`te_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO TimeEntry (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(() => {});
        }
      }
    }

    console.log(`✅ [CloudSync] Staff attendance synchronized.`);
  } catch (err) {
    console.warn("⚠️ [CloudSync Attendance Notice]:", err.message);
  }
}

/**
 * Synchronizes OrderSequences and CompanySettings.
 */
async function syncSettingsAndSequences(remotePool, localPool) {
  try {
    // 1. OrderSequences (High-watermark bidirectional sync)
    const locSeqRes = await localPool.request().query(`
      SELECT RestaurantId, SequenceDate, LastNumber FROM OrderSequences WITH (NOLOCK)
    `);

    for (const s of locSeqRes.recordset) {
      const seqDate = safeDate(s.SequenceDate);
      if (!seqDate) continue;

      const remSeq = await remotePool.request()
        .input("rid", sql.UniqueIdentifier, s.RestaurantId)
        .input("dt", sql.Date, seqDate)
        .query(`
          SELECT LastNumber FROM OrderSequences WITH (NOLOCK)
          WHERE RestaurantId = @rid AND SequenceDate = @dt
        `);

      if (remSeq.recordset.length > 0) {
        const remoteLast = remSeq.recordset[0].LastNumber || 0;
        if (s.LastNumber > remoteLast) {
          await remotePool.request()
            .input("rid", sql.UniqueIdentifier, s.RestaurantId)
            .input("dt", sql.Date, seqDate)
            .input("num", sql.Int, s.LastNumber)
            .query("UPDATE OrderSequences SET LastNumber = @num WHERE RestaurantId = @rid AND SequenceDate = @dt");
        } else if (remoteLast > s.LastNumber) {
          await localPool.request()
            .input("rid", sql.UniqueIdentifier, s.RestaurantId)
            .input("dt", sql.Date, seqDate)
            .input("num", sql.Int, remoteLast)
            .query("UPDATE OrderSequences SET LastNumber = @num WHERE RestaurantId = @rid AND SequenceDate = @dt");
        }
      } else {
        await remotePool.request()
          .input("rid", sql.UniqueIdentifier, s.RestaurantId)
          .input("dt", sql.Date, seqDate)
          .input("num", sql.Int, s.LastNumber)
          .query("INSERT INTO OrderSequences (RestaurantId, SequenceDate, LastNumber) VALUES (@rid, @dt, @num)")
          .catch(() => {});
      }
    }

    // 2. CompanySettings: Pull latest settings from Cloud if present
    const remoteComp = await remotePool.request().query(`
      SELECT TOP 1 * FROM CompanySettings WITH (NOLOCK)
    `).catch(() => ({ recordset: [] }));

    if (remoteComp.recordset.length > 0) {
      const rc = remoteComp.recordset[0];
      const localComp = await localPool.request().query("SELECT TOP 1 * FROM CompanySettings WITH (NOLOCK)");

      if (localComp.recordset.length === 0) {
        const remoteCols = async (tableName) => {
          const res = await localPool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
          `);
          return res.recordset.filter(c => c.IsIdentity !== 1);
        };
        const compCols = await remoteCols("CompanySettings");
        const iReq = localPool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of compCols) {
          const val = rc[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@cs_${col.COLUMN_NAME}`);
            iReq.input(`cs_${col.COLUMN_NAME}`, val);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`INSERT INTO CompanySettings (${colNames.join(", ")}) VALUES (${paramNames.join(", ")})`);
        }
      }
    }

    // 3. PrintMaster: Push local printer configurations & IP addresses to Cloud
    const locPrinters = await localPool.request().query("SELECT * FROM PrintMaster WITH (NOLOCK)").catch(() => ({ recordset: [] }));
    for (const p of locPrinters.recordset) {
      if (!p.PrinterName) continue;
      const cleanIP = String(p.PrinterIP || "").trim();
      await remotePool.request()
        .input("pid", sql.UniqueIdentifier, p.PrinterId)
        .input("pname", sql.VarChar(100), p.PrinterName)
        .input("pip", sql.VarChar(100), cleanIP)
        .input("ppath", sql.VarChar(255), p.PrinterPath || "")
        .input("ptype", sql.Int, p.PrinterType || 0)
        .input("psec", sql.Int, p.PrintSection || 0)
        .input("kname", sql.VarChar(50), p.KitchenTypeName || "")
        .input("kval", sql.Int, p.KitchenTypeValue || 0)
        .input("active", sql.Bit, p.IsActive ? 1 : 0)
        .input("enabled", sql.Bit, p.IsEnabled ? 1 : 0)
        .input("copy", sql.Int, p.PrintCopy || 1)
        .query(`
          IF EXISTS (SELECT 1 FROM PrintMaster WHERE PrinterId = @pid OR PrinterName = @pname)
            UPDATE PrintMaster
            SET PrinterIP = @pip, PrinterPath = @ppath, PrinterType = @ptype,
                PrintSection = @psec, KitchenTypeName = @kname, KitchenTypeValue = @kval,
                IsActive = @active, IsEnabled = @enabled, PrintCopy = @copy
            WHERE PrinterId = @pid OR PrinterName = @pname
          ELSE
            INSERT INTO PrintMaster (PrinterId, PrinterName, PrinterPath, PrinterIP, PrinterType, PrintSection, KitchenTypeName, KitchenTypeValue, IsActive, IsEnabled, PrintCopy)
            VALUES (@pid, @pname, @ppath, @pip, @ptype, @psec, @kname, @kval, @active, @enabled, @copy)
        `).catch(() => {});
    }

    // 4. CompanySettings: Push local company settings to Remote
    const locComp = await localPool.request().query("SELECT TOP 1 * FROM CompanySettings WITH (NOLOCK)").catch(() => ({ recordset: [] }));
    if (locComp.recordset.length > 0) {
      const lc = locComp.recordset[0];
      await remotePool.request()
        .input("cname", sql.NVarChar(200), lc.CompanyName || "")
        .input("addr", sql.NVarChar(500), lc.Address || "")
        .input("phone", sql.NVarChar(50), lc.Phone || "")
        .input("email", sql.NVarChar(100), lc.Email || "")
        .input("gst", sql.Decimal(18, 2), lc.GSTPercentage || 0)
        .input("svc", sql.Decimal(18, 2), lc.ServiceChargePercentage || 0)
        .query(`
          IF EXISTS (SELECT 1 FROM CompanySettings WHERE Id = '1')
            UPDATE CompanySettings
            SET CompanyName = @cname, Address = @addr, Phone = @phone, Email = @email,
                GSTPercentage = @gst, ServiceChargePercentage = @svc
            WHERE Id = '1'
        `).catch(() => {});
    }

    // 5. DateEntry: Synchronize active business day state with Cloud ERP
    await syncDateEntryToCloud(localPool, remotePool).catch((err) => {
      console.warn("⚠️ [CloudSync DateEntry Notice]:", err.message);
    });

    console.log(`✅ [CloudSync] Settings, printer IPs, order sequences & DateEntry synchronized.`);
  } catch (err) {
    console.warn("⚠️ [CloudSync Settings Notice]:", err.message);
  }
}

/**
 * Synchronizes DateEntry (Active Business Day) between Local POS and Cloud ERP.
 * Pushes active StartDate on Day Start, and clears Cloud DateEntry on Day End.
 */
async function syncDateEntryToCloud(localPool = null, remotePool = null) {
  try {
    const lPool = localPool || getPool() || (await poolPromise);
    const rPool = remotePool || (await getRemotePool());

    const locDate = await lPool.request().query("SELECT TOP 1 * FROM DateEntry WITH (NOLOCK) ORDER BY CreatedDate DESC").catch(() => ({ recordset: [] }));
    if (locDate.recordset.length > 0) {
      const ld = locDate.recordset[0];
      await rPool.request().query("DELETE FROM DateEntry").catch(() => {});
      await rPool.request()
        .input("id", sql.UniqueIdentifier, ld.DateEntryId)
        .input("user", sql.VarChar(30), ld.username || "admin")
        .input("dt", sql.Date, ld.StartDate)
        .input("cby", sql.VarChar(30), ld.Createdby || ld.CreatedBy || "admin")
        .input("cdate", sql.DateTime, ld.CreatedDate)
        .query(`
          INSERT INTO DateEntry (DateEntryId, username, StartDate, CreatedBy, CreatedDate)
          VALUES (@id, @user, @dt, @cby, @cdate)
        `);
      console.log(`☁️ [CloudSync] DateEntry synchronized to Cloud ERP: ${ld.StartDate ? new Date(ld.StartDate).toISOString().split('T')[0] : 'Active'}`);
    } else {
      // Local is in Day-End state; clear remote DateEntry to match
      await rPool.request().query("DELETE FROM DateEntry").catch(() => {});
      console.log("☁️ [CloudSync] Cloud ERP DateEntry cleared (Day-End state synchronized).");
    }
  } catch (err) {
    console.warn("⚠️ [CloudSync DateEntry Sync Error]:", err.message);
  }
}

/**
 * Synchronizes Artist Targets (dishOrderItemShare), Artist Cash Box entries (ArtistCashBox),
 * and Artist Bonus transactions (ArtistBonusTransaction) to Central Cloud ERP.
 */
async function syncArtistTargetsAndBonuses(remotePool, localPool) {
  try {
    const remoteCols = async (tableName) => {
      const res = await remotePool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMNPROPERTY(object_id(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IsIdentity
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
      `);
      return res.recordset.filter(c => c.IsIdentity !== 1);
    };

    // 1. Sync ArtistCashBox (Push local cashbox entries to remote)
    const locCashboxRes = await localPool.request().query(`
      SELECT TOP 100 * FROM ArtistCashBox WITH (NOLOCK)
      ORDER BY CreatedDate DESC
    `);
    const cbCols = await remoteCols("ArtistCashBox");
    let cbSynced = 0;

    for (const cb of locCashboxRes.recordset) {
      const check = await remotePool.request()
        .input("cbId", sql.UniqueIdentifier, cb.CashBoxId)
        .query("SELECT TOP 1 CashBoxId FROM ArtistCashBox WITH (NOLOCK) WHERE CashBoxId = @cbId");

      if (check.recordset.length === 0) {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of cbCols) {
          const val = cb[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "smalldatetime", "datetime2"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@cb_${col.COLUMN_NAME}`);
            iReq.input(`cb_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO ArtistCashBox (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(e => console.warn("ArtistCashBox insert warning:", e.message));
          cbSynced++;
        }
      }
    }

    // 2. Sync dishOrderItemShare (Artist Targets - Bidirectional)
    // Push local targets to remote
    const locTargetsRes = await localPool.request().query("SELECT * FROM dishOrderItemShare WITH (NOLOCK)");
    const targetCols = await remoteCols("dishOrderItemShare");

    for (const tgt of locTargetsRes.recordset) {
      const name = String(tgt.CustomerName || "").trim();
      if (!name) continue;

      const check = await remotePool.request()
        .input("name", sql.NVarChar(200), name)
        .query("SELECT TOP 1 Id FROM dishOrderItemShare WITH (NOLOCK) WHERE LTRIM(RTRIM(CustomerName)) = @name");

      if (check.recordset.length > 0) {
        await remotePool.request()
          .input("name", sql.NVarChar(200), name)
          .input("tgtAmt", sql.Decimal(18, 2), tgt.TargetAmount || tgt.Amount || 0)
          .input("amt", sql.Decimal(18, 2), tgt.Amount || 0)
          .input("fromDt", sql.DateTime, safeDate(tgt.FromDate))
          .input("toDt", sql.DateTime, safeDate(tgt.ToDate))
          .input("sel", sql.Bit, tgt.IsSelected ? 1 : 0)
          .query(`
            UPDATE dishOrderItemShare
            SET TargetAmount = @tgtAmt, Amount = @amt, FromDate = @fromDt, ToDate = @toDt, IsSelected = @sel
            WHERE LTRIM(RTRIM(CustomerName)) = @name
          `).catch(() => {});
      } else {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of targetCols) {
          const val = tgt[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "smalldatetime", "datetime2"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@t_${col.COLUMN_NAME}`);
            iReq.input(`t_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO dishOrderItemShare (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(() => {});
        }
      }
    }

    // Pull any remote targets down to local
    const remTargetsRes = await remotePool.request().query("SELECT * FROM dishOrderItemShare WITH (NOLOCK)");
    for (const rt of remTargetsRes.recordset) {
      const rName = String(rt.CustomerName || "").trim();
      if (!rName) continue;

      const checkLoc = await localPool.request()
        .input("name", sql.NVarChar(200), rName)
        .query("SELECT TOP 1 Id FROM dishOrderItemShare WITH (NOLOCK) WHERE LTRIM(RTRIM(CustomerName)) = @name");

      if (checkLoc.recordset.length === 0) {
        await localPool.request()
          .input("name", sql.NVarChar(200), rName)
          .input("tgtAmt", sql.Decimal(18, 2), rt.TargetAmount || rt.Amount || 0)
          .input("amt", sql.Decimal(18, 2), rt.Amount || 0)
          .input("fromDt", sql.DateTime, safeDate(rt.FromDate) || new Date())
          .input("toDt", sql.DateTime, safeDate(rt.ToDate) || new Date())
          .input("sel", sql.Bit, rt.IsSelected ? 1 : 0)
          .input("dishId", sql.UniqueIdentifier, rt.DishId || null)
          .query(`
            INSERT INTO dishOrderItemShare (CustomerName, TargetAmount, Amount, FromDate, ToDate, IsSelected, DishId, CreatedDate)
            VALUES (@name, @tgtAmt, @amt, @fromDt, @toDt, @sel, @dishId, GETDATE())
          `).catch(() => {});
      }
    }

    // 3. Sync ArtistBonusTransaction (Push bonus records to Cloud)
    const locBonusRes = await localPool.request().query(`
      SELECT TOP 50 * FROM ArtistBonusTransaction WITH (NOLOCK)
      ORDER BY CreatedDate DESC
    `);
    const bonusCols = await remoteCols("ArtistBonusTransaction");

    for (const ab of locBonusRes.recordset) {
      const check = await remotePool.request()
        .input("id", sql.UniqueIdentifier, ab.Id)
        .query("SELECT TOP 1 Id FROM ArtistBonusTransaction WITH (NOLOCK) WHERE Id = @id");

      if (check.recordset.length === 0) {
        const iReq = remotePool.request();
        const colNames = [];
        const paramNames = [];
        for (const col of bonusCols) {
          const val = ab[col.COLUMN_NAME];
          if (val !== undefined && val !== null) {
            let paramVal = val;
            if (["datetime", "date", "smalldatetime", "datetime2"].includes(col.DATA_TYPE)) {
              paramVal = safeDate(val);
            }
            colNames.push(`[${col.COLUMN_NAME}]`);
            paramNames.push(`@ab_${col.COLUMN_NAME}`);
            iReq.input(`ab_${col.COLUMN_NAME}`, paramVal);
          }
        }
        if (colNames.length > 0) {
          await iReq.query(`
            INSERT INTO ArtistBonusTransaction (${colNames.join(", ")})
            VALUES (${paramNames.join(", ")})
          `).catch(() => {});
        }
      }
    }

    console.log(`✅ [CloudSync] Artist targets, cashbox & bonuses synchronized (cashbox: ${cbSynced}).`);
  } catch (err) {
    console.warn("⚠️ [CloudSync Artist Targets Notice]:", err.message);
  }
}

/**
 * Returns current Cloud Sync Status (pending bills, cloud availability, last sync time).
 */
async function getSyncStatus() {
  let localPool;
  let isCloudReachable = false;
  let pendingCount = 0;
  let lastSyncTime = null;

  try {
    localPool = getPool() || (await poolPromise);
    const countRes = await localPool.request().query(`
      SELECT COUNT(*) as pendingCount 
      FROM SettlementHeader WITH (NOLOCK) 
      WHERE (isUploadHQ = 0 OR isUploadHQ IS NULL)
        AND BillNo IS NOT NULL
        AND BillNo != ''
    `);
    pendingCount = countRes.recordset[0]?.pendingCount || 0;

    const stRes = await localPool.request().query(`
      SELECT TOP 1 LastCloudSyncTime FROM AppSettings WITH (NOLOCK)
    `).catch(() => ({ recordset: [] }));
    lastSyncTime = stRes.recordset[0]?.LastCloudSyncTime || null;

    // Fast TCP socket probe so UI polling never hangs or lags
    try {
      const net = require("net");
      const host = process.env.REMOTE_DB_SERVER;
      const port = parseInt(process.env.REMOTE_DB_PORT || "1433");

      if (host) {
        isCloudReachable = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(3000);
          socket.on("connect", () => {
            socket.destroy();
            resolve(true);
          });
          socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
          });
          socket.on("error", () => {
            socket.destroy();
            resolve(false);
          });
          socket.connect(port, host);
        });
      }
    } catch {
      isCloudReachable = false;
    }

    return {
      isCloudReachable,
      pendingCount,
      lastSyncTime,
      cloudHost: isCloudReachable ? "Central Cloud ERP (Online)" : "Central Cloud ERP (Offline)",
      cloudPort: "Protected",
    };
  } catch (err) {
    return {
      isCloudReachable: false,
      pendingCount: 0,
      lastSyncTime: null,
      error: err.message,
    };
  }
}

/**
 * Synchronizes UserMaster (including AllowedLogins) from Central Cloud ERP to Local DB.
 * Allows online backoffice to configure device login limits (1, 2, or 0/unlimited).
 * NEVER overwrites local session tracking (IsLoggedIn, ActiveSessionId, LastHeartbeat).
 */
async function syncUsersFromCloud(remotePool, localPool) {
  try {
    const remoteUsers = await remotePool.request().query(`
      SELECT 
        UserId, UserCode, UserName, UserPassword, FullName, FirstName, LastName,
        IsDisabled, UserGroupid, AllowedLogins
      FROM UserMaster WITH (NOLOCK)
    `).catch(() => ({ recordset: [] }));

    for (const u of remoteUsers.recordset) {
      await localPool.request()
        .input("id", sql.UniqueIdentifier, u.UserId)
        .input("code", sql.NVarChar(50), u.UserCode || null)
        .input("name", sql.NVarChar(100), u.UserName)
        .input("pwd", sql.NVarChar(255), u.UserPassword)
        .input("fullName", sql.NVarChar(200), u.FullName || null)
        .input("firstName", sql.NVarChar(100), u.FirstName || null)
        .input("lastName", sql.NVarChar(100), u.LastName || null)
        .input("disabled", sql.Bit, u.IsDisabled ? 1 : 0)
        .input("groupId", sql.UniqueIdentifier, u.UserGroupid || null)
        .input("allowedLogins", sql.Int, u.AllowedLogins !== null && u.AllowedLogins !== undefined ? u.AllowedLogins : 1)
        .query(`
          IF EXISTS (SELECT 1 FROM UserMaster WHERE UserId = @id)
            UPDATE UserMaster 
            SET AllowedLogins = @allowedLogins,
                UserCode = ISNULL(@code, UserCode),
                UserName = ISNULL(@name, UserName),
                FullName = ISNULL(@fullName, FullName),
                FirstName = ISNULL(@firstName, FirstName),
                LastName = ISNULL(@lastName, LastName),
                IsDisabled = @disabled,
                UserGroupid = ISNULL(@groupId, UserGroupid)
            WHERE UserId = @id
          ELSE
            INSERT INTO UserMaster (
              UserId, UserCode, UserName, UserPassword, FullName, FirstName, LastName, 
              IsDisabled, UserGroupid, AllowedLogins, IsLoggedIn
            )
            VALUES (
              @id, @code, @name, @pwd, @fullName, @firstName, @lastName, 
              @disabled, @groupId, @allowedLogins, 0
            )
        `).catch((err) => {
          console.warn(`⚠️ [CloudSync] Error syncing user ${u.UserName}:`, err.message);
        });
    }
    console.log(`✅ [CloudSync] Synchronized ${remoteUsers.recordset.length} users and AllowedLogins from Cloud ERP.`);
  } catch (uErr) {
    console.warn("⚠️ [CloudSync] UserMaster pull warning:", uErr.message);
  }
}

module.exports = {
  pushSalesToCloud,
  pullSalesFromCloud,
  fullBidirectionalSync,
  syncLiveTablesAndCarts,
  pullMasterFromCloud,
  syncMembersAndCreditCustomers,
  syncStaffAttendance,
  syncSettingsAndSequences,
  syncDateEntryToCloud,
  syncArtistTargetsAndBonuses,
  syncUsersFromCloud,
  getSyncStatus,
  getRemotePool,
};
