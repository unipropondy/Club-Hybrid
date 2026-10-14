import { executeQuery, executeTransaction } from './database';

export interface LocalSettlementHeader {
  settlement_id: string;
  bill_no: string;
  subtotal: number;
  total_tax: number;
  discount_amount: number;
  sys_amount: number;
  manual_amount: number;
  table_no: string;
  order_type: string;
  section: string;
  pay_mode: string;
  server_name: string;
  is_cancelled: number;
  cancellation_reason?: string;
  start_date: string;
  created_by?: string;
  created_on: string;
  is_synced: number;
}

export interface LocalOrderDetail {
  order_detail_id: string;
  order_id: string;
  dish_id: string;
  dish_name: string;
  quantity: number;
  price_per_unit: number;
  actual_amount: number;
  status_code: number;
  is_void: number;
  category_id?: string;
  category_name?: string;
  sub_category_name?: string;
  combo_details_json?: string;
  modifiers_json?: string;
  start_date: string;
  created_on: string;
  is_synced: number;
}

export interface LocalPaymentDetail {
  payment_id: string;
  settlement_id: string;
  bill_no?: string;
  pay_mode: string;
  amount: number;
  start_date: string;
  created_on: string;
  is_synced: number;
}

export class SettlementRepository {
  /**
   * Save a completed sale directly into the core local SQLite mirror tables:
   * 1. settlement_header
   * 2. restaurant_invoice
   * 3. restaurant_order
   * 4. restaurant_order_detail_cur
   * 5. payment_detail
   */
  static async recordCompleteSale(params: {
    settlementId: string;
    billNo: string;
    subtotal: number;
    totalTax: number;
    discountAmount: number;
    totalAmount: number;
    tableNo: string;
    orderType: string;
    section: string;
    payMode: string;
    serverName: string;
    startDate: string;
    createdBy?: string;
    payments?: Array<{ payMode: string; amount: number }>;
    items: Array<{
      orderDetailId?: string;
      dishId: string;
      dishName: string;
      quantity: number;
      price: number;
      actualAmount?: number;
      categoryId?: string;
      categoryName?: string;
      subCategoryName?: string;
      comboSelections?: any;
      modifiers?: any;
    }>;
  }): Promise<void> {
    const now = new Date().toISOString();
    const sid = params.settlementId;
    const bNo = params.billNo;
    const sDate = (params.startDate || now.split('T')[0]).trim();
    const statements: { sql: string; params: any[] }[] = [];

    // 1. Settlement Header
    statements.push({
      sql: `INSERT OR REPLACE INTO settlement_header (
        settlement_id, bill_no, subtotal, total_tax, discount_amount, sys_amount, manual_amount,
        table_no, order_type, section, pay_mode, server_name, is_cancelled, cancellation_reason,
        start_date, created_by, created_on, is_synced, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 0, ?)`,
      params: [
        sid,
        bNo,
        params.subtotal || params.totalAmount,
        params.totalTax || 0,
        params.discountAmount || 0,
        params.totalAmount,
        params.totalAmount,
        params.tableNo || '',
        params.orderType || 'DINE-IN',
        params.section || 'MAIN',
        params.payMode || 'CASH',
        params.serverName || '',
        sDate,
        params.createdBy || '',
        now,
        now,
      ],
    });

    // 2. Restaurant Invoice
    statements.push({
      sql: `INSERT OR REPLACE INTO restaurant_invoice (
        invoice_id, order_id, bill_number, total_line_item_amount, total_tax,
        discount_amount, total_amount, payment_term_code, invoice_date, start_date,
        status_code, created_by, created_on, is_synced, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, 0, ?)`,
      params: [
        sid,
        sid,
        bNo,
        params.subtotal || params.totalAmount,
        params.totalTax || 0,
        params.discountAmount || 0,
        params.totalAmount,
        params.payMode || 'CASH',
        now.split('T')[0],
        sDate,
        params.createdBy || '',
        now,
        now,
      ],
    });

    // 3. Restaurant Order
    statements.push({
      sql: `INSERT OR REPLACE INTO restaurant_order (
        order_id, order_number, table_no, customer_name, total_amount,
        total_line_item_amount, status_code, is_order_closed, start_date,
        created_by, created_on, is_synced, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 3, 1, ?, ?, ?, 0, ?)`,
      params: [
        sid,
        bNo,
        params.tableNo || '',
        params.serverName || '',
        params.totalAmount,
        params.subtotal || params.totalAmount,
        sDate,
        params.createdBy || '',
        now,
        now,
      ],
    });

    // 4. Payment Details (Split Payment Support)
    const payments = params.payments && params.payments.length > 0
      ? params.payments
      : [{ payMode: params.payMode || 'CASH', amount: params.totalAmount }];

    payments.forEach((p, idx) => {
      const pid = `${sid}_pay_${idx}`;
      statements.push({
        sql: `INSERT OR REPLACE INTO payment_detail (
          payment_id, settlement_id, bill_no, pay_mode, amount, start_date, created_on, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        params: [
          pid,
          sid,
          bNo,
          p.payMode || 'CASH',
          p.amount,
          sDate,
          now,
          now,
        ],
      });
    });

    // 5. Line items into RestaurantOrderDetailCur
    params.items.forEach((item, idx) => {
      const did = item.orderDetailId || `${sid}_item_${idx}`;
      const qty = Number(item.quantity || 1);
      const rate = Number(item.price || 0);
      const amt = Number(item.actualAmount || qty * rate);
      const comboJson = item.comboSelections ? JSON.stringify(item.comboSelections) : null;
      const modJson = item.modifiers ? JSON.stringify(item.modifiers) : null;

      statements.push({
        sql: `INSERT OR REPLACE INTO restaurant_order_detail_cur (
          order_detail_id, order_id, dish_id, dish_name, quantity, price_per_unit,
          actual_amount, status_code, is_void, category_id, category_name, sub_category_name,
          combo_details_json, modifiers_json, start_date, created_on, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        params: [
          did,
          sid,
          item.dishId,
          item.dishName,
          qty,
          rate,
          amt,
          item.categoryId || '',
          item.categoryName || '',
          item.subCategoryName || '',
          comboJson,
          modJson,
          sDate,
          now,
          now,
        ],
      });
    });

    await executeTransaction(statements);
    console.log(`[SettlementRepository] Successfully mirrored offline sale ${bNo} into local SQLite.`);
  }

  /**
   * Bulk cache existing settlements pulled from backend server into local SQLite.
   */
  static async bulkSaveSettlements(records: any[]): Promise<void> {
    if (!Array.isArray(records) || records.length === 0) return;
    const now = new Date().toISOString();
    const statements = records.map((r) => {
      const sid = String(r.SettlementID || r.settlement_id || '').trim();
      const bNo = String(r.BillNo || r.bill_no || r.OrderNumber || '').trim();
      const subtotal = Number(r.SubTotal || r.subtotal || r.SysAmount || 0);
      const totalTax = Number(r.TotalTax || r.TaxAmount || 0);
      const discount = Number(r.DiscountAmount || 0);
      const sysAmount = Number(r.SysAmount || r.TotalAmount || 0);
      const tableNo = String(r.TableNo || r.table_no || '');
      const payMode = String(r.PayMode || r.payment_method || 'CASH');
      const isCancelled = r.IsCancelled === 1 || r.is_cancelled === 1 ? 1 : 0;
      const startDate = String(r.start_date || r.CreatedOn || '').split('T')[0];
      const createdOn = r.CreatedOn ? new Date(r.CreatedOn).toISOString() : now;

      return {
        sql: `INSERT OR REPLACE INTO settlement_header (
          settlement_id, bill_no, subtotal, total_tax, discount_amount, sys_amount, manual_amount,
          table_no, order_type, section, pay_mode, server_name, is_cancelled, cancellation_reason,
          start_date, created_by, created_on, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        params: [
          sid,
          bNo,
          subtotal,
          totalTax,
          discount,
          sysAmount,
          sysAmount,
          tableNo,
          r.OrderType || 'DINE-IN',
          r.Section || 'MAIN',
          payMode,
          r.SER_NAME || r.waiter_name || '',
          isCancelled,
          r.CancellationReason || null,
          startDate,
          r.CreatedBy || '',
          createdOn,
          now,
        ],
      };
    }).filter(s => s.params[0] && s.params[1]);

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[SettlementRepository] Bulk cached ${statements.length} settlements locally.`);
    }
  }

  /**
   * Bulk cache items into restaurant_order_detail_cur from backend pull.
   */
  static async bulkSaveOrderDetails(items: any[]): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) return;
    const now = new Date().toISOString();
    const statements = items.map((i) => {
      const did = String(i.OrderDetailId || i.order_detail_id || i.item_id || '').trim();
      const oid = String(i.OrderId || i.order_id || i.SettlementID || '').trim();
      const dishId = String(i.DishId || i.dish_id || '').trim();
      const dishName = String(i.DishName || i.Description || i.dish_name || '').trim();
      const qty = Number(i.Quantity || i.Qty || 1);
      const rate = Number(i.PricePerUnit || i.Price || 0);
      const amt = Number(i.ActualAmount || i.TotalDetailLineAmount || qty * rate);
      const isVoid = i.isVoid === 1 || i.is_void === 1 || i.Status === 'VOID' ? 1 : 0;
      const startDate = String(i.start_date || now.split('T')[0]).split('T')[0];

      return {
        sql: `INSERT OR REPLACE INTO restaurant_order_detail_cur (
          order_detail_id, order_id, dish_id, dish_name, quantity, price_per_unit,
          actual_amount, status_code, is_void, category_id, category_name, sub_category_name,
          combo_details_json, modifiers_json, start_date, created_on, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        params: [
          did,
          oid,
          dishId,
          dishName,
          qty,
          rate,
          amt,
          isVoid,
          i.CategoryId || null,
          i.CategoryName || null,
          i.SubCategoryName || null,
          i.ComboDetailsJSON ? (typeof i.ComboDetailsJSON === 'string' ? i.ComboDetailsJSON : JSON.stringify(i.ComboDetailsJSON)) : null,
          i.ModifiersJSON ? (typeof i.ModifiersJSON === 'string' ? i.ModifiersJSON : JSON.stringify(i.ModifiersJSON)) : null,
          startDate,
          i.OrderDateTime || now,
          now,
        ],
      };
    }).filter(s => s.params[0] && s.params[1]);

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[SettlementRepository] Bulk cached ${statements.length} line items locally.`);
    }
  }

  /**
   * Bulk cache payment details from backend pull.
   */
  static async bulkSavePaymentDetails(payments: any[]): Promise<void> {
    if (!Array.isArray(payments) || payments.length === 0) return;
    const now = new Date().toISOString();
    const statements = payments.map((p) => {
      const pid = String(p.PaymentId || p.payment_id || '').trim();
      const sid = String(p.RestaurantBillId || p.SettlementId || p.settlement_id || '').trim();
      const payMode = String(p.PayModeName || p.PayMode || p.pay_mode || 'CASH');
      const amount = Number(p.Amount || p.amount || 0);
      const startDate = String(p.start_date || now.split('T')[0]).split('T')[0];

      return {
        sql: `INSERT OR REPLACE INTO payment_detail (
          payment_id, settlement_id, bill_no, pay_mode, amount, start_date, created_on, is_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        params: [
          pid,
          sid,
          p.BillNo || '',
          payMode,
          amount,
          startDate,
          p.CreatedOn || now,
          now,
        ],
      };
    }).filter(s => s.params[0] && s.params[1]);

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[SettlementRepository] Bulk cached ${statements.length} payment details locally.`);
    }
  }

  /**
   * Fetch all settlements for a date range (for Sales Report offline operation).
   */
  static async getSettlementsByRange(startDate: string, endDate: string): Promise<any[]> {
    const sDate = (startDate || '').split('T')[0];
    const eDate = (endDate || sDate).split('T')[0];

    const rows = await executeQuery(
      `SELECT 
        settlement_id as SettlementID,
        bill_no as BillNo,
        bill_no as OrderNumber,
        subtotal as SubTotal,
        total_tax as TaxAmount,
        discount_amount as DiscountAmount,
        sys_amount as SysAmount,
        manual_amount as ManualAmount,
        table_no as TableNo,
        order_type as OrderType,
        section as Section,
        pay_mode as PayMode,
        server_name as waiter_name,
        is_cancelled as IsCancelled,
        cancellation_reason as CancellationReason,
        start_date,
        created_on as CreatedOn,
        1 as isOffline
      FROM settlement_header
      WHERE date(start_date) >= date(?) AND date(start_date) <= date(?)
      ORDER BY created_on DESC`,
      [sDate, eDate]
    );

    return rows;
  }

  /**
   * Fetch line items for a settlement (for Sales Report order details / bill slip offline).
   */
  static async getItemsBySettlementId(settlementId: string): Promise<any[]> {
    const cleanId = String(settlementId || '').trim();
    const rows = await executeQuery(
      `SELECT 
        order_detail_id as OrderDetailId,
        dish_id as DishId,
        dish_name as DishName,
        dish_name as Description,
        quantity as Quantity,
        quantity as Qty,
        price_per_unit as PricePerUnit,
        price_per_unit as Price,
        actual_amount as ActualAmount,
        actual_amount as TotalDetailLineAmount,
        is_void as isVoid,
        category_id as CategoryId,
        category_name as CategoryName,
        sub_category_name as SubCategoryName,
        combo_details_json as ComboDetailsJSON,
        modifiers_json as ModifiersJSON
      FROM restaurant_order_detail_cur
      WHERE order_id = ? AND is_void = 0
      ORDER BY rowid ASC`,
      [cleanId]
    );

    return rows;
  }

  /**
   * Fetch payments for a settlement offline.
   */
  static async getPaymentsBySettlementId(settlementId: string): Promise<any[]> {
    const cleanId = String(settlementId || '').trim();
    const rows = await executeQuery(
      `SELECT 
        payment_id as PaymentId,
        pay_mode as PayMode,
        pay_mode as PayModeName,
        amount as Amount
      FROM payment_detail
      WHERE settlement_id = ?
      ORDER BY rowid ASC`,
      [cleanId]
    );

    return rows;
  }

  /**
   * Alteration: Offline Void Item
   */
  static async voidItemOffline(settlementId: string, orderDetailIds: string[]): Promise<void> {
    if (!orderDetailIds || orderDetailIds.length === 0) return;
    const placeholders = orderDetailIds.map(() => '?').join(',');

    await executeTransaction([
      {
        sql: `UPDATE restaurant_order_detail_cur SET is_void = 1, updated_at = ? WHERE order_detail_id IN (${placeholders})`,
        params: [new Date().toISOString(), ...orderDetailIds],
      },
      {
        sql: `INSERT INTO sales_alteration_queue (id, action_type, settlement_id, payload, created_at)
              VALUES (?, 'VOID_ITEM', ?, ?, ?)`,
        params: [
          `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          settlementId,
          JSON.stringify({ orderDetailIds }),
          new Date().toISOString(),
        ],
      },
    ]);
  }

  /**
   * Alteration: Offline Cancel Order
   */
  static async cancelOrderOffline(settlementId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    await executeTransaction([
      {
        sql: `UPDATE settlement_header SET is_cancelled = 1, cancellation_reason = ?, updated_at = ? WHERE settlement_id = ?`,
        params: [reason || 'Manual Cancellation', now, settlementId],
      },
      {
        sql: `INSERT INTO sales_alteration_queue (id, action_type, settlement_id, payload, created_at)
              VALUES (?, 'CANCEL_ORDER', ?, ?, ?)`,
        params: [
          `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          settlementId,
          JSON.stringify({ reason }),
          now,
        ],
      },
    ]);
  }

  /**
   * Alteration: Offline Change Payment Mode
   */
  static async changePaymentOffline(settlementId: string, newPayMode: string): Promise<void> {
    const now = new Date().toISOString();
    await executeTransaction([
      {
        sql: `UPDATE settlement_header SET pay_mode = ?, updated_at = ? WHERE settlement_id = ?`,
        params: [newPayMode, now, settlementId],
      },
      {
        sql: `UPDATE payment_detail SET pay_mode = ?, updated_at = ? WHERE settlement_id = ?`,
        params: [newPayMode, now, settlementId],
      },
      {
        sql: `INSERT INTO sales_alteration_queue (id, action_type, settlement_id, payload, created_at)
              VALUES (?, 'CHANGE_PAYMENT', ?, ?, ?)`,
        params: [
          `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          settlementId,
          JSON.stringify({ payMode: newPayMode }),
          now,
        ],
      },
    ]);
  }

  /**
   * Fetch queued alterations to sync up to backend when network returns
   */
  static async getPendingAlterations(): Promise<any[]> {
    return await executeQuery(`SELECT * FROM sales_alteration_queue ORDER BY created_at ASC`);
  }

  /**
   * Remove processed alteration from queue
   */
  static async removeAlteration(id: string): Promise<void> {
    await executeQuery(`DELETE FROM sales_alteration_queue WHERE id = ?`, [id]);
  }
}
