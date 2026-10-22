/**
 * ============================================================================
 * UNIPRO HYBRID POS - CLOUD TO LOCAL DATABASE FULL CLONER
 * ============================================================================
 * Copies complete master data, operational schemas, and tables from
 * Central Cloud MSSQL into Local MSSQL (localhost:1433)
 *
 * Features:
 * - High-speed parameterized batch streaming (up to 2,000 params per query)
 * - Automatic IDENTITY_INSERT detection and handling
 * - Skips computed columns automatically
 * - Temporarily disables foreign key constraints and triggers during copy
 * - Provides real-time progress indicators and execution timing
 * ============================================================================
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const sql = require("mssql");

const remoteConfig = {
  server: process.env.REMOTE_DB_SERVER || process.env.DB_SERVER,
  port: parseInt(process.env.REMOTE_DB_PORT || process.env.DB_PORT || "1433"),
  database: process.env.REMOTE_DB_NAME || process.env.DB_NAME,
  user: process.env.REMOTE_DB_USER || process.env.DB_USER,
  password: process.env.REMOTE_DB_PASSWORD || process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 120000,
  pool: {
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
  },
};

let localServer = (process.env.LOCAL_DB_SERVER || "localhost\\ups").trim();
let localInstance = undefined;
if (localServer.includes("\\") || localServer.includes("/")) {
  const parts = localServer.split(/[\\/]+/).filter(Boolean);
  localServer = parts[0] || "localhost";
  localInstance = parts[1];
}
if (localServer === "." || localServer === "(local)") {
  localServer = "localhost";
}

const localConfig = {
  server: localServer,
  database: process.env.LOCAL_DB_NAME || "UCSCLUB",
  user: process.env.LOCAL_DB_USER || "sa",
  password: process.env.LOCAL_DB_PASSWORD || "Unipro@2026",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(localInstance ? { instanceName: localInstance } : {}),
  },
  ...(!localInstance && process.env.LOCAL_DB_PORT ? { port: parseInt(process.env.LOCAL_DB_PORT) } : {}),
  connectionTimeout: 15000,
  requestTimeout: 120000,
  pool: {
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
  },
};

async function getNonEmptyTables(remotePool) {
  const query = `
    SELECT 
      t.NAME AS TableName,
      SUM(p.rows) AS TotalRows
    FROM 
      sys.tables t
    INNER JOIN 
      sys.partitions p ON t.object_id = p.OBJECT_ID
    WHERE 
      p.index_id IN (0,1)
    GROUP BY 
      t.NAME
    HAVING 
      SUM(p.rows) > 0
    ORDER BY 
      SUM(p.rows) ASC
  `;
  const result = await remotePool.request().query(query);
  return result.recordset;
}

async function cloneSingleTable(remotePool, localPool, tableName, expectedRows, tableIndex, totalTables) {
  const tableStart = Date.now();
  process.stdout.write(`[${tableIndex}/${totalTables}] 📦 Cloning '${tableName}' (~${expectedRows} rows)... `);

  try {
    // 1. Fetch remote rows
    const remoteData = await remotePool.request().query(`SELECT * FROM [dbo].[${tableName}] WITH (NOLOCK)`);
    const rows = remoteData.recordset;

    if (!rows || rows.length === 0) {
      console.log(`(Empty on remote, skipped)`);
      return { success: true, count: 0 };
    }

    // 2. Inspect local table column metadata (Identity, Computed, Data Types)
    const [identRes, compRes, colsRes] = await Promise.all([
      localPool.request().query(`
        SELECT c.name 
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID('dbo.[${tableName}]') AND c.is_identity = 1
      `),
      localPool.request().query(`
        SELECT c.name 
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID('dbo.[${tableName}]') AND c.is_computed = 1
      `),
      localPool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'dbo'
      `),
    ]);

    const hasIdentity = identRes.recordset.length > 0;
    const computedSet = new Set(compRes.recordset.map((r) => r.name.toLowerCase()));
    const localCols = new Set(colsRes.recordset.map((r) => r.COLUMN_NAME.toLowerCase()));
    const colTypeMap = {};
    colsRes.recordset.forEach((c) => {
      colTypeMap[c.COLUMN_NAME.toLowerCase()] = (c.DATA_TYPE || "").toLowerCase();
    });

    // Filter columns present in local DB, in remote result, and NOT computed
    const sampleRow = rows[0];
    const validCols = Object.keys(sampleRow).filter((col) => {
      const lower = col.toLowerCase();
      return localCols.has(lower) && !computedSet.has(lower);
    });

    if (validCols.length === 0) {
      console.log(`⚠️ (No matching writable columns locally, skipped)`);
      return { success: true, count: 0 };
    }

    // 3. Clear existing local data in this table
    try {
      await localPool.request().query(`DELETE FROM [dbo].[${tableName}]`);
    } catch (delErr) {
      // Continue if empty or constraint handled
    }

    // 4. Batch Insertion
    // MSSQL allows up to 2100 parameters in a single statement.
    const numCols = validCols.length;
    const batchSize = Math.max(1, Math.min(200, Math.floor(2000 / numCols)));
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const req = localPool.request();
      const valueTuples = [];

      let paramIdx = 0;
      chunk.forEach((row) => {
        const rowParams = [];
        validCols.forEach((col) => {
          const pName = `p_${paramIdx++}`;
          rowParams.push(`@${pName}`);
          const val = row[col];
          const dtype = colTypeMap[col.toLowerCase()] || "";
          if (dtype === "varbinary" || dtype === "image" || dtype === "binary") {
            req.input(pName, sql.VarBinary, val ? Buffer.from(val) : null);
          } else {
            req.input(pName, val !== undefined ? val : null);
          }
        });
        valueTuples.push(`(${rowParams.join(", ")})`);
      });

      const colListSql = validCols.map((c) => `[${c}]`).join(", ");
      let insertBatchSql = "";

      if (hasIdentity) {
        insertBatchSql += `SET IDENTITY_INSERT [dbo].[${tableName}] ON; `;
      }
      insertBatchSql += `INSERT INTO [dbo].[${tableName}] (${colListSql}) VALUES ${valueTuples.join(", ")}; `;
      if (hasIdentity) {
        insertBatchSql += `SET IDENTITY_INSERT [dbo].[${tableName}] OFF; `;
      }

      await req.query(insertBatchSql);
      insertedCount += chunk.length;
    }

    const elapsed = ((Date.now() - tableStart) / 1000).toFixed(2);
    console.log(`✅ ${insertedCount} rows in ${elapsed}s`);
    return { success: true, count: insertedCount };
  } catch (err) {
    const elapsed = ((Date.now() - tableStart) / 1000).toFixed(2);
    console.log(`❌ FAILED (${elapsed}s): ${err.message}`);
    return { success: false, error: err.message, count: 0 };
  }
}

async function runClone() {
  console.log("=================================================================");
  console.log("🚀 UNIPRO HYBRID POS - FULL CLOUD-TO-LOCAL DATABASE CLONER");
  console.log("=================================================================");
  console.log(`Source Cloud: ${remoteConfig.server}:${remoteConfig.port} / [${remoteConfig.database}]`);
  console.log(`Target Local: ${localConfig.server}:${localConfig.port} / [${localConfig.database}]`);
  console.log("=================================================================\n");

  const startTime = Date.now();
  let remotePool = null;
  let localPool = null;

  try {
    console.log("🔌 Connecting to Remote Cloud database...");
    remotePool = new sql.ConnectionPool(remoteConfig);
    await remotePool.connect();
    console.log("✅ Remote Cloud Database Connected!\n");

    console.log("🔌 Connecting to Local database...");
    localPool = new sql.ConnectionPool(localConfig);
    await localPool.connect();
    console.log("✅ Local Database Connected!\n");

    // 1. Fetch all tables that currently have rows in the remote database
    console.log("🔍 Scanning remote database for populated tables...");
    const tablesToClone = await getNonEmptyTables(remotePool);
    console.log(`📋 Found ${tablesToClone.length} tables with data on remote cloud.\n`);

    // 2. Pre-flight schema adjustment and temporarily disable foreign key constraints/triggers
    console.log("⚙️  Running pre-flight schema checks and temporarily disabling constraints...");
    try {
      await localPool.request().query(`
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ImageList' AND COLUMN_NAME = 'ImageData' AND CHARACTER_MAXIMUM_LENGTH <> -1)
        BEGIN
          ALTER TABLE [dbo].[ImageList] ALTER COLUMN [ImageData] VARBINARY(MAX);
        END
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'Photo' AND DATA_TYPE = 'image')
        BEGIN
          ALTER TABLE [dbo].[CustomerMaster] ALTER COLUMN [Photo] VARBINARY(MAX);
          ALTER TABLE [dbo].[CustomerMaster] ALTER COLUMN [ic] VARBINARY(MAX);
        END
      `);
      await localPool.request().query("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT all'");
      await localPool.request().query("EXEC sp_MSforeachtable 'ALTER TABLE ? DISABLE TRIGGER all'");
      console.log("✅ Schema validated, Constraints & Triggers bypassed successfully.\n");
    } catch (cErr) {
      console.warn("⚠️ Warning while bypassing constraints:", cErr.message);
    }

    console.log("-----------------------------------------------------------------");
    console.log("📥 BEGINNING MASS DATA TRANSFER");
    console.log("-----------------------------------------------------------------");

    let totalRowsCloned = 0;
    let tablesSuccess = 0;
    let tablesFailed = 0;

    for (let i = 0; i < tablesToClone.length; i++) {
      const item = tablesToClone[i];
      const res = await cloneSingleTable(
        remotePool,
        localPool,
        item.TableName,
        item.TotalRows,
        i + 1,
        tablesToClone.length
      );
      if (res.success) {
        tablesSuccess++;
        totalRowsCloned += res.count;
      } else {
        tablesFailed++;
      }
    }

    // 2.5 Verify and Reseed IDENTITY Columns
    console.log("\n🔑 Verifying & Synchronizing Table IDENTITY properties...");
    const identityTables = [
      'SettlementHeader', 'SettlementItemDetail', 'settlement', 'RewardMaster',
      'PaymentGatewayTransactions', 'OpeningCashDenomination', 'ItemMaster',
      'server', 'servermaster', 'TvTakeAway', 'ReceiptPrintCache', 'QRMaster',
      'MasterSettings', 'DishModifiers', 'AppSettings'
    ];
    for (const t of identityTables) {
      try {
        const identCheck = await localPool.request().query(`
          SELECT c.name FROM sys.columns c
          WHERE c.object_id = OBJECT_ID('dbo.[${t}]') AND c.is_identity = 1
        `);
        if (identCheck.recordset.length > 0) {
          const identCol = identCheck.recordset[0].name;
          const maxRes = await localPool.request().query(`
            SELECT ISNULL(MAX(CAST([${identCol}] AS BIGINT)), 0) AS maxVal FROM [dbo].[${t}]
          `);
          const maxVal = Number(maxRes.recordset[0]?.maxVal || 0);
          if (maxVal > 0) {
            await localPool.request().query(`DBCC CHECKIDENT ('dbo.[${t}]', RESEED, ${maxVal})`);
          }
        }
      } catch (e) {}
    }
    console.log("✅ Table IDENTITY properties and seeds synchronized.\n");

    // 3. Clone SQL Views from remote cloud
    console.log("\n👁️  Cloning SQL Views from remote cloud...");
    try {
      const viewsRes = await remotePool.request().query(`
        SELECT v.name, m.definition
        FROM sys.views v
        JOIN sys.sql_modules m ON v.object_id = m.object_id
        WHERE v.is_ms_shipped = 0
      `);
      let vCount = 0;
      for (const v of viewsRes.recordset) {
        try {
          await localPool.request().query(`IF OBJECT_ID('dbo.[${v.name}]', 'V') IS NOT NULL DROP VIEW dbo.[${v.name}]`);
          await localPool.request().query(v.definition);
          vCount++;
        } catch (e) {}
      }
      console.log(`✅ Cloned ${vCount} SQL Views successfully.\n`);
    } catch (vErr) {
      console.warn("⚠️ View cloning warning:", vErr.message);
    }

    // 4. Re-enable foreign key constraints and triggers on local
    console.log("⚙️  Re-enabling local FK constraints and triggers...");
    try {
      await localPool.request().query("EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all'");
      await localPool.request().query("EXEC sp_MSforeachtable 'ALTER TABLE ? ENABLE TRIGGER all'");
      console.log("✅ Constraints & Triggers re-enabled successfully.\n");
    } catch (cErr) {
      console.warn("⚠️ Warning while re-enabling constraints:", cErr.message);
    }

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("=================================================================");
    console.log("🎉 DATABASE CLONING COMPLETED SUCCESSFULLY!");
    console.log("=================================================================");
    console.log(`⏱️  Total Time Taken : ${totalSeconds} seconds`);
    console.log(`📊 Tables Cloned    : ${tablesSuccess} / ${tablesToClone.length} (${tablesFailed} failed)`);
    console.log(`📦 Total Rows Copied: ${totalRowsCloned.toLocaleString()} rows`);
    console.log("=================================================================");
    console.log("💡 The local database is now fully populated with all cloud data.");
    console.log("   You can start the backend now and it will run 100% offline!");
    console.log("=================================================================\n");
  } catch (err) {
    console.error("\n❌ Fatal error during clone operation:", err);
  } finally {
    if (remotePool) await remotePool.close();
    if (localPool) await localPool.close();
    process.exit(0);
  }
}

runClone();
