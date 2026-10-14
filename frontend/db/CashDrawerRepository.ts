import { executeQuery, executeTransaction } from './database';

export interface LocalCashDrawerLog {
  id: string;
  outlet_id: number;
  terminal_code: string;
  action_type: string;
  amount: number;
  tendered_amount: number;
  change_amount: number;
  order_id?: string | null;
  reason?: string | null;
  remark?: string | null;
  opened_by_user_id: string;
  approved_by_user_id?: string | null;
  open_source: string;
  attachment_url?: string | null;
  is_success: number;
  created_at: string;
  is_synced: number;
}

export class CashDrawerRepository {
  /**
   * Save a cash drawer action (Cash In, Cash Out, Float, etc.) locally in SQLite.
   */
  static async recordDrawerAction(payload: {
    outletId: number;
    terminalCode: string;
    actionType: string;
    amount?: number;
    tenderedAmount?: number;
    changeAmount?: number;
    orderId?: string | null;
    reason?: string | null;
    remark?: string | null;
    openedByUserId: string;
    approvedByUserId?: string | null;
    openSource?: string;
    attachmentUrl?: string | null;
    isSuccess: boolean;
  }): Promise<LocalCashDrawerLog> {
    const id = `cdl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: LocalCashDrawerLog = {
      id,
      outlet_id: payload.outletId || 1,
      terminal_code: payload.terminalCode || 'T1',
      action_type: payload.actionType || 'OTHER',
      amount: payload.amount || 0,
      tendered_amount: payload.tenderedAmount || 0,
      change_amount: payload.changeAmount || 0,
      order_id: payload.orderId || null,
      reason: payload.reason || null,
      remark: payload.remark || null,
      opened_by_user_id: payload.openedByUserId || '1',
      approved_by_user_id: payload.approvedByUserId || payload.openedByUserId || '1',
      open_source: payload.openSource || 'MANUAL',
      attachment_url: payload.attachmentUrl || null,
      is_success: payload.isSuccess ? 1 : 0,
      created_at: now,
      is_synced: 0,
    };

    await executeQuery(
      `INSERT INTO cash_drawer_logs (
        id, outlet_id, terminal_code, action_type, amount, tendered_amount,
        change_amount, order_id, reason, remark, opened_by_user_id,
        approved_by_user_id, open_source, attachment_url, is_success,
        created_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        record.id,
        record.outlet_id,
        record.terminal_code,
        record.action_type,
        record.amount,
        record.tendered_amount,
        record.change_amount,
        record.order_id,
        record.reason,
        record.remark,
        record.opened_by_user_id,
        record.approved_by_user_id,
        record.open_source,
        record.attachment_url,
        record.is_success,
        record.created_at,
      ]
    );

    console.log(`[CashDrawerRepository] Recorded local cash drawer action: ${record.action_type} ($${record.amount})`);
    return record;
  }

  /**
   * Fetch cash drawer logs offline for the Cash Drawer Report screen.
   */
  static async getLogs(filters?: {
    actionType?: string;
    terminalCode?: string;
  }): Promise<any[]> {
    let query = `SELECT 
      id as Id,
      outlet_id as OutletId,
      terminal_code as TerminalCode,
      action_type as ActionType,
      amount as Amount,
      tendered_amount as TenderedAmount,
      change_amount as ChangeAmount,
      order_id as OrderId,
      reason as Reason,
      remark as Remark,
      opened_by_user_id as OpenedByUserId,
      approved_by_user_id as ApprovedByUserId,
      open_source as OpenSource,
      attachment_url as AttachmentUrl,
      is_success as IsSuccess,
      created_at as CreatedAt,
      is_synced as IsSynced
    FROM cash_drawer_logs WHERE 1=1`;

    const params: any[] = [];
    if (filters?.actionType && filters.actionType !== 'ALL') {
      query += ` AND action_type = ?`;
      params.push(filters.actionType);
    }
    if (filters?.terminalCode && filters.terminalCode !== 'ALL') {
      query += ` AND terminal_code = ?`;
      params.push(filters.terminalCode);
    }

    query += ` ORDER BY created_at DESC LIMIT 200`;
    return await executeQuery(query, params);
  }

  /**
   * Fetch unsynced drawer actions for push to server.
   */
  static async getUnsyncedLogs(): Promise<LocalCashDrawerLog[]> {
    return (await executeQuery(
      `SELECT * FROM cash_drawer_logs WHERE is_synced = 0 ORDER BY created_at ASC`
    )) as LocalCashDrawerLog[];
  }

  /**
   * Mark logs as synced after cloud push.
   */
  static async markLogsSynced(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(
      `UPDATE cash_drawer_logs SET is_synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  /**
   * Bulk cache logs pulled from server.
   */
  static async bulkSaveLogs(logs: any[]): Promise<void> {
    if (!Array.isArray(logs) || logs.length === 0) return;
    const statements = logs.map((l) => {
      const id = String(l.Id || l.id || `srv_cdl_${l.CreatedAt}_${Math.random()}`).trim();
      return {
        sql: `INSERT OR REPLACE INTO cash_drawer_logs (
          id, outlet_id, terminal_code, action_type, amount, tendered_amount,
          change_amount, order_id, reason, remark, opened_by_user_id,
          approved_by_user_id, open_source, attachment_url, is_success,
          created_at, is_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        params: [
          id,
          l.OutletId || l.outlet_id || 1,
          l.TerminalCode || l.terminal_code || 'T1',
          l.ActionType || l.action_type || 'OTHER',
          Number(l.Amount || l.amount || 0),
          Number(l.TenderedAmount || l.tendered_amount || 0),
          Number(l.ChangeAmount || l.change_amount || 0),
          l.OrderId || l.order_id || null,
          l.Reason || l.reason || null,
          l.Remark || l.remark || null,
          l.OpenedByUserId || l.opened_by_user_id || '1',
          l.ApprovedByUserId || l.approved_by_user_id || null,
          l.OpenSource || l.open_source || 'MANUAL',
          l.AttachmentUrl || l.attachment_url || null,
          l.IsSuccess === false || l.is_success === 0 ? 0 : 1,
          l.CreatedAt || l.created_at || new Date().toISOString(),
        ],
      };
    });

    if (statements.length > 0) {
      await executeTransaction(statements);
    }
  }
}
