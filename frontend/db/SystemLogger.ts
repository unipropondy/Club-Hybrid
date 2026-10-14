import { executeQuery } from './database';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class SystemLogger {
  /**
   * Log an event, warning, error, or debug message into local SQLite system_logs table
   */
  static async log(level: LogLevel, category: string, message: string, details?: any): Promise<void> {
    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;

      await executeQuery(
        `INSERT INTO system_logs (id, level, category, message, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, level, category, message, detailsStr, now]
      );
    } catch (err) {
      console.warn('[SystemLogger] Failed to write local log:', err);
    }
  }

  static async info(category: string, message: string, details?: any) {
    return this.log('INFO', category, message, details);
  }

  static async warn(category: string, message: string, details?: any) {
    return this.log('WARN', category, message, details);
  }

  static async error(category: string, message: string, details?: any) {
    return this.log('ERROR', category, message, details);
  }

  static async debug(category: string, message: string, details?: any) {
    return this.log('DEBUG', category, message, details);
  }

  /**
   * Query recent system logs (for troubleshooting & diagnostic views)
   */
  static async getRecentLogs(limit = 100): Promise<any[]> {
    try {
      return await executeQuery(
        `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );
    } catch {
      return [];
    }
  }

  /**
   * Push pending local logs to server logs/system.log file
   */
  static async pushLogsToServer(): Promise<void> {
    try {
      const logs = await this.getRecentLogs(50);
      if (logs.length === 0) return;

      const API = require('../api').default;
      const formatted = logs.map((l: any) => ({
        level: l.level,
        category: l.category,
        message: l.message,
        details: l.details ? JSON.parse(l.details) : null,
        timestamp: l.created_at
      }));

      await API.post('/admin/client-logs', { logs: formatted });
    } catch (_) {}
  }
}
