import { executeQuery, executeTransaction } from './database';

export interface LocalAttendanceRecord {
  id: string;
  user_id: string;
  user_name: string;
  staff_name: string;
  status: number;
  action_name: string;
  timestamp: string;
  created_date: string;
  is_synced: number;
}

export class AttendanceRepository {
  /**
   * Save an attendance action locally when offline or online.
   */
  static async recordAttendance(params: {
    userId: string;
    userName: string;
    staffName: string;
    status: number;
  }): Promise<LocalAttendanceRecord> {
    const now = new Date();
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = now.toISOString();
    const createdDate = now.toISOString().split('T')[0];

    const actionMap: Record<number, string> = {
      1: 'CLOCK_IN',
      0: 'CLOCK_OUT',
      3: 'BREAK_IN',
      4: 'BREAK_OUT',
    };
    const actionName = actionMap[params.status] || 'STATUS_UPDATE';

    const record: LocalAttendanceRecord = {
      id,
      user_id: params.userId,
      user_name: params.userName,
      staff_name: params.staffName,
      status: params.status,
      action_name: actionName,
      timestamp,
      created_date: createdDate,
      is_synced: 0,
    };

    await executeQuery(
      `INSERT INTO staff_attendance (
        id, user_id, user_name, staff_name, status, action_name, timestamp, created_date, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        record.id,
        record.user_id,
        record.user_name,
        record.staff_name,
        record.status,
        record.action_name,
        record.timestamp,
        record.created_date,
      ]
    );

    console.log(`[AttendanceRepository] Saved local attendance record: ${record.action_name} for ${record.staff_name}`);
    return record;
  }

  /**
   * Get today's attendance summary for a staff member offline.
   */
  static async getTodaySummary(userId: string): Promise<{
    lastStatus: number | null;
    canClockIn: boolean;
    canClockOut: boolean;
    canStartBreak: boolean;
    canEndBreak: boolean;
    records: LocalAttendanceRecord[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const records = (await executeQuery(
      `SELECT * FROM staff_attendance 
       WHERE user_id = ? AND created_date = ? 
       ORDER BY timestamp DESC`,
      [userId, today]
    )) as LocalAttendanceRecord[];

    const lastStatus = records.length > 0 ? records[0].status : null;

    return {
      lastStatus,
      canClockIn: lastStatus === null || lastStatus === 0,
      canClockOut: lastStatus === 1 || lastStatus === 4,
      canStartBreak: lastStatus === 1 || lastStatus === 4,
      canEndBreak: lastStatus === 3,
      records,
    };
  }

  /**
   * Get all today's logs for a user.
   */
  static async getTodayLogs(userId: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    const rows = await executeQuery(
      `SELECT 
        id, user_id as UserId, user_name as UserName, staff_name as StaffName,
        status as Status, action_name as ActionName, timestamp as LoginTime, created_date as CreatedDate
       FROM staff_attendance 
       WHERE user_id = ? AND created_date = ? 
       ORDER BY timestamp DESC`,
      [userId, today]
    );
    return rows;
  }

  /**
   * Get all attendance logs (for admin log viewer offline).
   */
  static async getAllLogs(): Promise<any[]> {
    const rows = await executeQuery(
      `SELECT 
        id, user_id as UserId, user_name as UserName, staff_name as StaffName,
        status as Status, action_name as ActionName, timestamp as LoginTime, created_date as CreatedDate
       FROM staff_attendance 
       ORDER BY timestamp DESC LIMIT 200`
    );
    return rows;
  }

  /**
   * Get unsynced attendance punches to push to server.
   */
  static async getUnsyncedAttendance(): Promise<LocalAttendanceRecord[]> {
    return (await executeQuery(
      `SELECT * FROM staff_attendance WHERE is_synced = 0 ORDER BY timestamp ASC`
    )) as LocalAttendanceRecord[];
  }

  /**
   * Mark attendance punches as synced.
   */
  static async markAttendanceSynced(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(
      `UPDATE staff_attendance SET is_synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  /**
   * Bulk cache attendance records pulled from server.
   */
  static async bulkSaveAttendance(records: any[]): Promise<void> {
    if (!Array.isArray(records) || records.length === 0) return;
    const statements = records.map((r) => {
      const id = String(r.id || r.AttendanceId || `srv_${r.UserId}_${r.LoginTime}`).trim();
      const userId = String(r.UserId || r.user_id || '').trim();
      const userName = String(r.UserName || r.user_name || '').trim();
      const staffName = String(r.StaffName || r.staff_name || userName).trim();
      const status = Number(r.Status || 1);
      const actionName = String(r.ActionName || (status === 1 ? 'CLOCK_IN' : status === 0 ? 'CLOCK_OUT' : 'BREAK'));
      const timestamp = r.LoginTime ? new Date(r.LoginTime).toISOString() : new Date().toISOString();
      const createdDate = timestamp.split('T')[0];

      return {
        sql: `INSERT OR REPLACE INTO staff_attendance (
          id, user_id, user_name, staff_name, status, action_name, timestamp, created_date, is_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        params: [id, userId, userName, staffName, status, actionName, timestamp, createdDate],
      };
    }).filter(s => s.params[0] && s.params[1]);

    if (statements.length > 0) {
      await executeTransaction(statements);
    }
  }
}
