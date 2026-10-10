const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const sql = require("mssql");
const { poolPromise } = require("../config/db");
const fs = require("fs");

async function auditAndGenerateInit() {
  console.log("🔍 [Schema Audit] Connecting to database to inspect full UCSCLUB schema...");
  const pool = await poolPromise;
  if (!pool) {
    console.error("❌ Could not connect to MSSQL database to run schema audit.");
    process.exit(1);
  }

  try {
    // 1. Fetch all user tables in the connected database
    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME
    `);

    const tableNames = tablesRes.recordset.map((r) => r.TABLE_NAME);
    console.log(`📋 Found ${tableNames.length} tables in UCSCLUB database.`);

    // 2. Fetch all columns for all tables
    const colsRes = await pool.request().query(`
      SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH, 
        NUMERIC_PRECISION, 
        NUMERIC_SCALE, 
        IS_NULLABLE, 
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const columnsByTable = {};
    for (const col of colsRes.recordset) {
      if (!columnsByTable[col.TABLE_NAME]) {
        columnsByTable[col.TABLE_NAME] = [];
      }
      columnsByTable[col.TABLE_NAME].push(col);
    }

    // Read original clean init.js base template or reset generated part
    const initPath = path.resolve(__dirname, "../config/init.js");
    let initContent = fs.readFileSync(initPath, "utf8");

    // Remove old broken auto-generated sections if present
    const markerIdx = initContent.indexOf("// AUTOMATICALLY GENERATED DDL SCHEMAS");
    if (markerIdx !== -1) {
      initContent = initContent.substring(0, markerIdx) + "\n  } catch (err) {\n    console.error(\"❌ DB Initialization Failed:\", err.message);\n  }\n}\n";
    }

    const missingTables = [];
    for (const table of tableNames) {
      const regex = new RegExp(`OBJECT_ID\\(N'\\[dbo\\]\\.\\[${table}\\]'\\)`, "i");
      if (!regex.test(initContent)) {
        missingTables.push(table);
      }
    }

    console.log(`🔍 Schema Audit Result: ${missingTables.length} tables to generate in init.js.`);

    if (missingTables.length > 0) {
      let ddlAdditions = "\n    // ============================================================\n";
      ddlAdditions += "    // AUTOMATICALLY GENERATED DDL SCHEMAS FROM UCSCLUB AUDIT\n";
      ddlAdditions += "    // ============================================================\n";

      for (const table of missingTables) {
        const cols = columnsByTable[table] || [];
        if (cols.length === 0) continue;

        let colDefs = cols.map((col) => {
          let baseType = col.DATA_TYPE.toUpperCase();
          let typeParam = "";

          if (["NVARCHAR", "VARCHAR", "CHAR", "NCHAR"].includes(baseType)) {
            const len = col.CHARACTER_MAXIMUM_LENGTH === -1 ? "MAX" : col.CHARACTER_MAXIMUM_LENGTH || 255;
            typeParam = `(${len})`;
          } else if (["DECIMAL", "NUMERIC"].includes(baseType)) {
            typeParam = `(${col.NUMERIC_PRECISION || 18}, ${col.NUMERIC_SCALE || 2})`;
          }

          let def = `[${col.COLUMN_NAME}] [${baseType}]${typeParam}`;
          if (col.IS_NULLABLE === "NO") def += " NOT NULL";
          else def += " NULL";

          if (col.COLUMN_DEFAULT) {
            def += ` DEFAULT ${col.COLUMN_DEFAULT}`;
          }
          return `              ${def}`;
        }).join(",\n");

        ddlAdditions += `
    await runQuery("Create ${table} table", \`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${table}]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[${table}](
${colDefs}
          )
      END
    \`);\n`;
      }

      const targetMarker = "} catch (err) {";
      if (initContent.includes(targetMarker)) {
        initContent = initContent.replace(targetMarker, `${ddlAdditions}\n  } catch (err) {`);
        fs.writeFileSync(initPath, initContent, "utf8");
        console.log(`✅ Successfully updated init.js with PERFECT bracket-free T-SQL syntax for all ${missingTables.length} tables!`);
      }
    }

  } catch (err) {
    console.error("❌ Schema audit failed:", err);
  }
}

auditAndGenerateInit();
