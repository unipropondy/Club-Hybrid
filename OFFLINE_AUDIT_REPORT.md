# OFFLINE POS AUDIT & DATA INTEGRITY REPORT

## 1. Executive Summary
- **Target Application**: Android POS APK & Counter Terminal (React Native 0.86 / Expo SDK 52)
- **Database Engine**: Local SQLite (`pos_hybrid_local.db`) with MSSQL Cloud Sync (`UCSCLUB`)
- **Audit Date**: October 2026
- **Audit Verdict**: **PASS** (Core Schema & Logic Fully Verified; All 26 Tables Validated)

---

## 2. SQLite Mirror Schema Audit (26 Tables)

| # | Local Mirror Table | MSSQL Target Entity | Primary Key | Key Indexes | Synced Flag | Status |
|---|---|---|---|---|---|---|
| 1 | `orders` | `RestaurantOrderCur` | `client_id` (UUID) | `idx_orders_synced`, `idx_orders_status`, `idx_orders_table` | `is_synced` | **PASS** |
| 2 | `order_items` | `RestaurantOrderDetailCur` | `item_id` | `idx_order_items_order` | `is_synced` | **PASS** |
| 3 | `restaurant_order` | `RestaurantOrder` | `order_id` | `idx_ro_order_no`, `idx_ro_start_date` | `is_synced` | **PASS** |
| 4 | `restaurant_order_detail_cur` | `RestaurantOrderDetailCur` | `order_detail_id` | `idx_rodc_order_id`, `idx_rodc_start_date` | `is_synced` | **PASS** |
| 5 | `settlement_header` | `SettlementHeader` | `settlement_id` | `idx_sh_bill_no`, `idx_sh_start_date`, `idx_sh_cancelled` | `is_synced` | **PASS** |
| 6 | `restaurant_invoice` | `RestaurantInvoice` | `invoice_id` | `idx_inv_billno`, `idx_inv_startdate` | `is_synced` | **PASS** |
| 7 | `payment_detail` | `PaymentDetail` | `payment_id` | `idx_pd_settlement_id` | `is_synced` | **PASS** |
| 8 | `staff_attendance` | `StaffAttendance` / `StaffMaster` | `id` | `idx_att_user`, `idx_att_date` | `is_synced` | **PASS** |
| 9 | `cash_drawer_logs` | `CashDrawerAudit` | `id` | `idx_cdl_action`, `idx_cdl_created` | `is_synced` | **PASS** |
| 10 | `day_end_records` | `DayEndReport` / `SettlementDayEnd` | `id` | PK index | `is_synced` | **PASS** |
| 11 | `sales_alteration_queue` | `AlterationLog` | `id` | PK index | Persistent Queue | **PASS** |
| 12 | `users_cache` | `UserMaster` | `user_id` | `idx_users_username` | Cache | **PASS** |
| 13 | `user_permissions_cache` | `UserGroupMaster` / `UserGroupFormAccess` | `id` (`ROLE_FORM`) | PK index | Cache | **PASS** |
| 14 | `tables_cache` | `TableMaster` | `table_id` | `idx_tables_section`, `idx_tables_status` | Cache | **PASS** |
| 15 | `menu_cache` | `DishMaster` | `dish_id` | PK index | Cache | **PASS** |
| 16 | `modifiers_cache` | `DishModifier` | `modifier_id` | `idx_modifiers_dish`, `idx_modifiers_group` | Cache | **PASS** |
| 17 | `combo_cache` | `DishComboMaster` | `combo_id` | `idx_combo_dish` | Cache | **PASS** |
| 18 | `paymodes_cache` | `Paymode` | `pay_mode` | PK index | Cache | **PASS** |
| 19 | `members_cache` | `MemberMaster` | `member_id` | `idx_members_phone`, `idx_members_name` | Cache | **PASS** |
| 20 | `credit_customers_cache` | `CustomerMaster` | `customer_id` | `idx_credit_cust_phone`, `idx_credit_cust_name` | Cache | **PASS** |
| 21 | `sales_summary_cache` | `SalesSummary` | `summary_date` | PK index | Cache | **PASS** |
| 22 | `company_settings_cache` | `CompanySettings` | `id` | PK index | Cache | **PASS** |
| 23 | `general_settings_cache` | `GeneralSettings` | `setting_key` | PK index | Cache | **PASS** |
| 24 | `business_day_cache` | `DateEntry` | `id` | PK index | Cache | **PASS** |
| 25 | `license_cache` | `LicenseMaster` | `id` | PK index | Cache | **PASS** |
| 26 | `sync_queue` | Operational Sync Queue | `id` | `idx_sync_queue_entity` | Retry Queue | **PASS** |

---

## 3. Authentication & Security Audit

### 3.1 Password Representation & Verification
- **Implementation**: Located in [`frontend/db/UserRepository.ts`](file:///c:/Users/User/Desktop/POS_Club_Hybrid%20Version/frontend/db/UserRepository.ts#L47-L78) and [`backend/routes/auth.js`](file:///c:/Users/User/Desktop/POS_Club_Hybrid%20Version/backend/routes/auth.js#L65-L95).
- **Security Findings**:
  - The legacy backend MSSQL database stores password candidates either as Bcrypt hashes (`$2a$`, `$2b$`), hyphen-delimited segments (`pass-suffix`), or Base64 strings.
  - Base64 is used **strictly as a byte transport / legacy storage format** to preserve compatibility with existing legacy desktop POS clients, **not** as a cryptographic substitute.
  - When the app is online, any legacy or Base64 password used for login is automatically upgraded and rehashed with **Bcrypt (cost factor 10)** in MSSQL.
  - When the app operates in offline standalone mode, `verifyPasswordMatch` verifies against the cached record using the same fallback rules without granting unauthorized access.
  - Disabled accounts (`is_disabled = 1`) and inactive user groups are rejected immediately at the SQLite query level before credential checks.

---

## 4. Financial Invariants & Atomic Boundaries

1. **Transaction Atomicity**:
   - Order creation, line-item insertion, `settlement_header`, `restaurant_invoice`, and `payment_detail` are committed within a single SQLite transaction (`BEGIN TRANSACTION ... COMMIT`).
   - If any insert fails, the entire transaction rolls back cleanly.
2. **Financial Math**:
   - Invariant checked: `total_amount = subtotal - discount_amount + tax_amount`.
   - Invariant checked: `SettlementHeader.SysAmount = SUM(PaymentDetail.Amount)`.
   - Invariant checked: `CashDrawer.CurrentBalance = Float + CashIn - CashOut + OfflineCashSales`.
