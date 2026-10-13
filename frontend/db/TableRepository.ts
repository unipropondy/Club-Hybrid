import { executeQuery, executeTransaction } from './database';

export interface CachedTable {
  id: string;
  label: string;
  DiningSection: number;
  Status: number;
  StartTime?: string | null;
  lockedByName?: string | null;
  totalAmount: number;
  currentOrderId?: string | null;
  isOvertime: number;
  isHoldOvertime: number;
  entryStatus?: string | null;
  paymentStatus: number;
  customerName?: string | null;
  pax?: number | null;
}

export class TableRepository {
  /**
   * Save or update tables into local SQLite cache
   */
  static async saveTables(tables: any[]): Promise<void> {
    if (!tables || tables.length === 0) return;

    const now = new Date().toISOString();
    const statements = tables.map((t) => {
      const id = String(t.id || t.TableId || t.table_id || '').replace(/^\{|\}$/g, '').trim().toLowerCase();
      const label = String(t.label || t.TableNumber || t.table_number || '');
      const diningSection = Number(t.DiningSection || t.dining_section || 1);
      const status = Number(t.Status || t.status || 0);
      const startTime = t.StartTime || t.start_time || null;
      const lockedByName = t.lockedByName || t.locked_by_name || null;
      const totalAmount = Number(t.totalAmount || t.total_amount || 0);
      const currentOrderId = t.currentOrderId || t.current_order_id || null;
      const isOvertime = Number(t.isOvertime || t.is_overtime || 0);
      const isHoldOvertime = Number(t.isHoldOvertime || t.is_hold_overtime || 0);
      const entryStatus = t.entryStatus || t.entry_status || null;
      const paymentStatus = Number(t.paymentStatus || t.payment_status || 0);
      const customerName = t.customerName || t.customer_name || null;
      const pax = t.pax !== undefined && t.pax !== null ? Number(t.pax) : null;

      return {
        sql: `INSERT OR REPLACE INTO tables_cache (
          table_id, table_number, dining_section, status,
          start_time, locked_by_name, total_amount, current_order_id,
          is_overtime, is_hold_overtime, entry_status, payment_status,
          customer_name, pax, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, label, diningSection, status,
          startTime, lockedByName, totalAmount, currentOrderId,
          isOvertime, isHoldOvertime, entryStatus, paymentStatus,
          customerName, pax, now,
        ],
      };
    });

    try {
      await executeTransaction(statements);
      console.log(`[TableRepository] Cached ${tables.length} tables in local SQLite.`);
    } catch (err) {
      console.error('[TableRepository] Failed to cache tables:', err);
    }
  }

  /**
   * Retrieve cached tables, optionally filtered by dining section
   */
  static async getCachedTables(section?: number): Promise<CachedTable[]> {
    try {
      let query = `SELECT 
        table_id as id,
        table_number as label,
        dining_section as DiningSection,
        status as Status,
        start_time as StartTime,
        locked_by_name as lockedByName,
        total_amount as totalAmount,
        current_order_id as currentOrderId,
        is_overtime as isOvertime,
        is_hold_overtime as isHoldOvertime,
        entry_status as entryStatus,
        payment_status as paymentStatus,
        customer_name as customerName,
        pax as pax
      FROM tables_cache`;

      const params: any[] = [];
      if (section !== undefined) {
        query += ` WHERE dining_section = ?`;
        params.push(section);
      }
      query += ` ORDER BY table_number ASC`;

      const rows = await executeQuery(query, params);
      return rows as CachedTable[];
    } catch (err) {
      console.error('[TableRepository] Failed to retrieve cached tables:', err);
      return [];
    }
  }

  /**
   * Update table status locally when placing or paying orders offline
   */
  static async updateTableStatus(
    tableId: string,
    status: number,
    totalAmount: number = 0,
    currentOrderId: string | null = null,
    customerName: string | null = null,
    pax: number | null = null
  ): Promise<void> {
    const cleanId = String(tableId).replace(/^\{|\}$/g, '').trim().toLowerCase();
    const now = new Date().toISOString();

    const sql = `UPDATE tables_cache SET 
      status = ?, 
      total_amount = ?, 
      current_order_id = ?,
      customer_name = COALESCE(?, customer_name),
      pax = COALESCE(?, pax),
      updated_at = ?
    WHERE table_id = ?`;

    try {
      await executeQuery(sql, [status, totalAmount, currentOrderId, customerName, pax, now, cleanId]);
      console.log(`[TableRepository] Updated local table status for ${cleanId} to ${status}`);
    } catch (err) {
      console.error(`[TableRepository] Failed to update table status for ${cleanId}:`, err);
    }
  }
}
