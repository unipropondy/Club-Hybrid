export const DB_NAME = 'pos_hybrid_local.db';

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  client_id TEXT PRIMARY KEY NOT NULL,
  order_number TEXT NOT NULL,
  table_no TEXT NOT NULL,
  waiter_name TEXT,
  customer_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  payment_method TEXT,
  raw_payload TEXT,
  is_synced INTEGER NOT NULL DEFAULT 0,
  sync_action TEXT NOT NULL DEFAULT 'INSERT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(is_synced);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_no);

CREATE TABLE IF NOT EXISTS order_items (
  item_id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  notes TEXT,
  kds_status TEXT NOT NULL DEFAULT 'PENDING',
  is_synced INTEGER NOT NULL DEFAULT 0,
  sync_action TEXT NOT NULL DEFAULT 'INSERT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(client_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS menu_cache (
  dish_id TEXT PRIMARY KEY NOT NULL,
  dish_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  client_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, client_id);

CREATE TABLE IF NOT EXISTS app_settings_cache (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
