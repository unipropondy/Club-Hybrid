const fs = require('fs');
const initSqlJs = require('sql.js');

async function test() {
  const schemaFile = fs.readFileSync('./db/schema.ts', 'utf8');
  const startMarker = 'export const CREATE_TABLES_SQL = `';
  const endMarker = '`;';
  const start = schemaFile.indexOf(startMarker) + startMarker.length;
  const end = schemaFile.lastIndexOf(endMarker);
  const sql = schemaFile.substring(start, end);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(sql);
  console.log('✅ SQLite Schema successfully created!');

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.flat();
  console.log('Cached menu tables present in SQLite:');
  console.log(tables.filter(t => t.includes('cache') || t === 'menu_cache'));
}

test().catch(console.error);
