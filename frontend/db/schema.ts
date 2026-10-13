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

CREATE TABLE IF NOT EXISTS tables_cache (
  table_id TEXT PRIMARY KEY NOT NULL,
  table_number TEXT NOT NULL,
  dining_section INTEGER NOT NULL DEFAULT 1,
  status INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  locked_by_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  current_order_id TEXT,
  is_overtime INTEGER NOT NULL DEFAULT 0,
  is_hold_overtime INTEGER NOT NULL DEFAULT 0,
  entry_status TEXT,
  payment_status INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT,
  pax INTEGER,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tables_section ON tables_cache(dining_section);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables_cache(status);

CREATE TABLE IF NOT EXISTS paymodes_cache (
  pay_mode TEXT PRIMARY KEY NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  commission REAL DEFAULT 0,
  service_charge REAL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_summary_cache (
  summary_date TEXT PRIMARY KEY NOT NULL,
  total_sales REAL NOT NULL DEFAULT 0,
  total_bills INTEGER NOT NULL DEFAULT 0,
  cash_total REAL NOT NULL DEFAULT 0,
  card_total REAL NOT NULL DEFAULT 0,
  upi_total REAL NOT NULL DEFAULT 0,
  other_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  raw_breakdown TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members_cache (
  member_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  is_vip INTEGER DEFAULT 0,
  vip_type TEXT,
  reward_credit REAL DEFAULT 0,
  promo_code TEXT,
  promo_amount REAL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_phone ON members_cache(phone);
CREATE INDEX IF NOT EXISTS idx_members_name ON members_cache(name);

CREATE TABLE IF NOT EXISTS credit_customers_cache (
  customer_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  customer_type TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_cust_phone ON credit_customers_cache(phone);
CREATE INDEX IF NOT EXISTS idx_credit_cust_name ON credit_customers_cache(name);

CREATE TABLE IF NOT EXISTS modifiers_cache (
  modifier_id TEXT PRIMARY KEY NOT NULL,
  dish_id TEXT NOT NULL,
  group_id TEXT,
  modifier_code TEXT,
  modifier_name TEXT NOT NULL,
  price REAL DEFAULT 0,
  is_open_modifier INTEGER DEFAULT 0,
  sort_code INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modifiers_dish ON modifiers_cache(dish_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers_cache(group_id);

CREATE TABLE IF NOT EXISTS combo_cache (
  combo_id TEXT PRIMARY KEY NOT NULL,
  dish_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_price REAL DEFAULT 0,
  raw_config TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combo_dish ON combo_cache(dish_id);

CREATE TABLE IF NOT EXISTS company_settings_cache (
  id TEXT PRIMARY KEY NOT NULL DEFAULT '1',
  company_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  gst_no TEXT,
  gst_percentage REAL DEFAULT 0,
  tax_mode TEXT DEFAULT 'exclusive',
  service_charge_percentage REAL DEFAULT 0,
  takeaway_charges REAL DEFAULT 0,
  currency TEXT DEFAULT 'SGD',
  currency_symbol TEXT DEFAULT '$',
  company_logo_url TEXT,
  halal_logo_url TEXT,
  show_company_logo INTEGER DEFAULT 0,
  show_halal_logo INTEGER DEFAULT 0,
  hold_overtime_minutes INTEGER DEFAULT 30,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS general_settings_cache (
  setting_key TEXT PRIMARY KEY NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users_cache (
  user_id TEXT PRIMARY KEY NOT NULL,
  user_code TEXT,
  user_name TEXT NOT NULL,
  user_password TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  role_name TEXT,
  user_group_id TEXT,
  is_disabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users_cache(user_name);

CREATE TABLE IF NOT EXISTS user_permissions_cache (
  id TEXT PRIMARY KEY NOT NULL,
  form_code TEXT NOT NULL,
  role TEXT NOT NULL,
  user_group_id TEXT,
  can_add INTEGER NOT NULL DEFAULT 1,
  can_update INTEGER NOT NULL DEFAULT 1,
  can_delete INTEGER NOT NULL DEFAULT 1,
  can_read INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_day_cache (
  id TEXT PRIMARY KEY NOT NULL DEFAULT '1',
  start_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  started_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS license_cache (
  id TEXT PRIMARY KEY NOT NULL DEFAULT '1',
  company_name TEXT,
  address TEXT,
  company_logo_url TEXT,
  from_date TEXT,
  to_date TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL
);
`;
