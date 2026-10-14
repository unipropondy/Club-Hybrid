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
  kitchen_id TEXT,
  kitchen_name TEXT,
  price REAL NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  sort_code INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_cat ON menu_cache(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_kitchen ON menu_cache(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_menu_avail ON menu_cache(is_available);

CREATE TABLE IF NOT EXISTS categories_cache (
  category_id TEXT PRIMARY KEY NOT NULL,
  category_name TEXT NOT NULL,
  kitchen_type_code TEXT,
  sort_code INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dishgroups_cache (
  group_id TEXT PRIMARY KEY NOT NULL,
  group_name TEXT NOT NULL,
  category_id TEXT,
  kitchen_type_name TEXT,
  sort_code INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dg_cat ON dishgroups_cache(category_id);

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

-- 🧾 Sales Tables Mirrors for 100% Offline Querying & Reporting
CREATE TABLE IF NOT EXISTS restaurant_invoice (
  invoice_id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  total_line_item_amount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_term_code TEXT,
  invoice_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  status_code INTEGER DEFAULT 5,
  created_by TEXT,
  created_on TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_billno ON restaurant_invoice(bill_number);
CREATE INDEX IF NOT EXISTS idx_inv_startdate ON restaurant_invoice(start_date);

CREATE TABLE IF NOT EXISTS restaurant_order (
  order_id TEXT PRIMARY KEY NOT NULL,
  order_number TEXT NOT NULL,
  table_no TEXT NOT NULL,
  customer_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  total_line_item_amount REAL NOT NULL DEFAULT 0,
  status_code INTEGER DEFAULT 3,
  is_order_closed INTEGER DEFAULT 1,
  start_date TEXT NOT NULL,
  created_by TEXT,
  created_on TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ro_order_no ON restaurant_order(order_number);
CREATE INDEX IF NOT EXISTS idx_ro_start_date ON restaurant_order(start_date);

CREATE TABLE IF NOT EXISTS restaurant_order_detail_cur (
  order_detail_id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  price_per_unit REAL NOT NULL DEFAULT 0,
  actual_amount REAL NOT NULL DEFAULT 0,
  status_code INTEGER DEFAULT 1,
  is_void INTEGER DEFAULT 0,
  category_id TEXT,
  category_name TEXT,
  sub_category_name TEXT,
  combo_details_json TEXT,
  modifiers_json TEXT,
  start_date TEXT NOT NULL,
  created_on TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rodc_order_id ON restaurant_order_detail_cur(order_id);
CREATE INDEX IF NOT EXISTS idx_rodc_start_date ON restaurant_order_detail_cur(start_date);

CREATE TABLE IF NOT EXISTS settlement_header (
  settlement_id TEXT PRIMARY KEY NOT NULL,
  bill_no TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  sys_amount REAL NOT NULL DEFAULT 0,
  manual_amount REAL NOT NULL DEFAULT 0,
  table_no TEXT,
  order_type TEXT DEFAULT 'DINE-IN',
  section TEXT DEFAULT 'MAIN',
  pay_mode TEXT NOT NULL DEFAULT 'CASH',
  server_name TEXT,
  is_cancelled INTEGER DEFAULT 0,
  cancellation_reason TEXT,
  start_date TEXT NOT NULL,
  created_by TEXT,
  created_on TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sh_bill_no ON settlement_header(bill_no);
CREATE INDEX IF NOT EXISTS idx_sh_start_date ON settlement_header(start_date);
CREATE INDEX IF NOT EXISTS idx_sh_cancelled ON settlement_header(is_cancelled);

CREATE TABLE IF NOT EXISTS payment_detail (
  payment_id TEXT PRIMARY KEY NOT NULL,
  settlement_id TEXT NOT NULL,
  bill_no TEXT,
  pay_mode TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  created_on TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pd_settlement_id ON payment_detail(settlement_id);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  status INTEGER NOT NULL,
  action_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_date TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_att_user ON staff_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_att_date ON staff_attendance(created_date);

CREATE TABLE IF NOT EXISTS sales_alteration_queue (
  id TEXT PRIMARY KEY NOT NULL,
  action_type TEXT NOT NULL, -- 'VOID_ITEM', 'CANCEL_ORDER', 'CHANGE_PAYMENT'
  settlement_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_drawer_logs (
  id TEXT PRIMARY KEY NOT NULL,
  outlet_id INTEGER DEFAULT 1,
  terminal_code TEXT DEFAULT 'T1',
  action_type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  tendered_amount REAL DEFAULT 0,
  change_amount REAL DEFAULT 0,
  order_id TEXT,
  reason TEXT,
  remark TEXT,
  opened_by_user_id TEXT,
  approved_by_user_id TEXT,
  open_source TEXT DEFAULT 'MANUAL',
  attachment_url TEXT,
  is_success INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cdl_action ON cash_drawer_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_cdl_created ON cash_drawer_logs(created_at);

CREATE TABLE IF NOT EXISTS day_end_records (
  id TEXT PRIMARY KEY NOT NULL,
  business_date TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  closed_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  is_synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY NOT NULL,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sys_logs_created ON system_logs(created_at);
`;



