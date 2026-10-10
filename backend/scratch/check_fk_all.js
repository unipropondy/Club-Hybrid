const { poolPromise } = require("../config/db");

async function checkFKAll() {
  const pool = await poolPromise;
  const fks = await pool.request().query(`
    SELECT 
      fk.name AS FK_name,
      tp.name AS ParentTable,
      cp.name AS ParentColumn,
      tr.name AS RefTable,
      cr.name AS RefColumn
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
    INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
    INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
    WHERE tr.name IN ('SettlementItemDetail', 'settlement') OR tp.name IN ('SettlementItemDetail', 'settlement')
  `);
  console.log("Foreign keys on SettlementItemDetail & settlement:", fks.recordset);
  process.exit(0);
}

checkFKAll().catch(console.error);
