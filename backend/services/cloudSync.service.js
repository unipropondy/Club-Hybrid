const sql = require("mssql");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { poolPromise, getPool } = require("../config/db");

let remotePoolInstance = null;

/**
 * Returns or establishes a connection pool to the Central Cloud ERP database.
 * Uses a short timeout (5s) so offline POS billing is NEVER delayed.
 */
async function getRemotePool() {
  if (remotePoolInstance && remotePoolInstance.connected) {
    return remotePoolInstance;
  }

  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || process.env.DB_USER || "ups",
    password: process.env.REMOTE_DB_PASSWORD || process.env.DB_PASSWORD || "ups",
    server: process.env.REMOTE_DB_SERVER || process.env.DB_SERVER || "myerpcloud.dyndns.org",
    port: parseInt(process.env.REMOTE_DB_PORT || process.env.DB_PORT || "9199"),
    database: process.env.REMOTE_DB_NAME || process.env.DB_NAME || "UCSCLUB",
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 5000,
      requestTimeout: 25000,
    },
    connectionTimeout: 5000,
    requestTimeout: 25000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  try {
    const pool = new sql.ConnectionPool(remoteConfig);
    await pool.connect();
    remotePoolInstance = pool;
    remotePoolInstance.on("error", (err) => {
      console.warn("⚠️ [CloudSync Remote Pool Warning]:", err.message);
      remotePoolInstance = null;
    });
    return remotePoolInstance;
  } catch (err) {
    remotePoolInstance = null;
    throw new Error(`Cloud server unreachable: ${err.message}`);
  }
}

/**
 * Pushes offline settled sales from Local MSSQL to Cloud ERP (myerpcloud.dyndns.org).
 * Guarantees transactional idempotency using SettlementID & BillNo.
 */
async function pushSalesToCloud(ioInstance = null) {
  let localPool;
  let remotePool;

  try {
    localPool = getPool() || (await poolPromise);
    if (!localPool) throw new Error("Local database connection unavailable");

    // 1. Fetch un-uploaded settled bills from local DB
    const pendingRes = await localPool.request().query(`
      SELECT * FROM SettlementHeader WITH (NOLOCK)
      WHERE (isUploadHQ = 0 OR isUploadHQ IS NULL)
        AND BillNo IS NOT NULL
        AND BillNo != ''
      ORDER BY CreatedOn ASC
    `);

    const pendingBills = pendingRes.recordset;
    if (pendingBills.length === 0) {
      return {
        success: true,
        pushedCount: 0,
        message: "All sales records are already synchronized with Cloud ERP.",
      };
    }

    // 2. Connect to Central Cloud ERP
    remotePool = await getRemotePool();

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
    const payCols = (await remoteCols("PaymentDetail")).filter((c) => c.IsIdentity !== 1);
    const stsCols = (await remoteCols("SettlementTotalSales")).filter((c) => c.IsIdentity !== 1);
    const sddCols = (await remoteCols("SettlementDiscountDetail")).filter((c) => c.IsIdentity !== 1);

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

        if (existCheck.recordset.length === 0) {
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

            // 3. Insert RestaurantInvoice
            const localInvs = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`SELECT * FROM RestaurantInvoice WITH (NOLOCK) WHERE RestaurantBillId = @sid`);

            for (let j = 0; j < localInvs.recordset.length; j++) {
              const inv = localInvs.recordset[j];
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
                `);
              }
            }

            // 4. Insert PaymentDetail
            const localPays = await localPool.request()
              .input("sid", sql.UniqueIdentifier, sid)
              .query(`SELECT * FROM PaymentDetail WITH (NOLOCK) WHERE RestaurantBillId = @sid OR SettlementId = @sid`);

            for (let k = 0; k < localPays.recordset.length; k++) {
              const pay = localPays.recordset[k];
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
                `);
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

            await rTx.commit();
          } catch (rErr) {
            await rTx.rollback();
            throw rErr;
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

    // 3. Update LastCloudSyncTime in AppSettings
    await localPool.request().query(`
      IF EXISTS (SELECT 1 FROM AppSettings)
        UPDATE AppSettings SET LastCloudSyncTime = GETDATE()
    `).catch(() => {});

    console.log(`☁️ [CloudSync] Successfully pushed ${pushedCount} bills to Cloud ERP (${process.env.REMOTE_DB_SERVER || "myerpcloud.dyndns.org"}).`);

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

    console.log(`✅ [CloudSync] Master data pull complete (${remoteDishes.recordset.length} dishes synced).`);

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

    // Check Cloud connectivity
    try {
      const rPool = await getRemotePool();
      await rPool.request().query("SELECT 1 as ping");
      isCloudReachable = true;
    } catch {
      isCloudReachable = false;
    }

    return {
      isCloudReachable,
      pendingCount,
      lastSyncTime,
      cloudHost: process.env.REMOTE_DB_SERVER || "myerpcloud.dyndns.org",
      cloudPort: process.env.REMOTE_DB_PORT || "9199",
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

module.exports = {
  pushSalesToCloud,
  pullMasterFromCloud,
  getSyncStatus,
  getRemotePool,
};
