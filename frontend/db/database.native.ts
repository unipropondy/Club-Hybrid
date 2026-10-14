import * as SQLite from 'expo-sqlite';
import { DB_NAME, CREATE_TABLES_SQL } from './schema';

let sqliteDb: any = null;
let isInitialized = false;
let initPromise: Promise<any> | null = null;

export async function getLocalDatabase() {
  if (isInitialized && sqliteDb) return sqliteDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      sqliteDb = await SQLite.openDatabaseAsync(DB_NAME);
      await sqliteDb.execAsync(CREATE_TABLES_SQL);
      isInitialized = true;
      console.log(`[LocalDB] Native SQLite database "${DB_NAME}" initialized successfully.`);
      return sqliteDb;
    } catch (error) {
      isInitialized = false;
      sqliteDb = null;
      console.error(`[LocalDB] Native expo-sqlite initialization failed:`, error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  const db = await getLocalDatabase();

  try {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await db.getAllAsync(sql, params);
      return rows || [];
    } else {
      const result = await db.runAsync(sql, params);
      return [result];
    }
  } catch (err) {
    console.error(`[LocalDB] Native SQLite query error: ${sql}`, err);
    throw err;
  }
}

export async function executeTransaction(statements: { sql: string; params?: any[] }[]): Promise<void> {
  const db = await getLocalDatabase();

  await db.withTransactionAsync(async () => {
    for (const stmt of statements) {
      await db.runAsync(stmt.sql, stmt.params || []);
    }
  });
}
