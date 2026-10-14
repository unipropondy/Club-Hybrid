import initSqlJs from 'sql.js';
import { CREATE_TABLES_SQL } from './schema';

let sqlDb: any = null;
let isInitialized = false;

export async function getLocalDatabase() {
  if (isInitialized && sqlDb) return sqlDb;

  const SQL = await initSqlJs();
  sqlDb = new SQL.Database();
  sqlDb.run(CREATE_TABLES_SQL);
  isInitialized = true;
  return sqlDb;
}

export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  const db = await getLocalDatabase();
  const cleaned = sql.trim();
  const upper = cleaned.toUpperCase();

  try {
    if (upper.startsWith('SELECT')) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } else {
      db.run(sql, params);
      const changes = db.getRowsModified();
      return [{ rowsAffected: changes, changes }];
    }
  } catch (err) {
    console.error(`[TestDB Error] Query failed: ${sql}`, err);
    throw err;
  }
}

export async function executeTransaction(statements: { sql: string; params?: any[] }[]): Promise<void> {
  const db = await getLocalDatabase();
  db.run('BEGIN TRANSACTION');
  try {
    for (const stmt of statements) {
      db.run(stmt.sql, stmt.params || []);
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}
