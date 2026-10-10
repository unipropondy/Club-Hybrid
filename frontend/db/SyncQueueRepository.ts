import { executeQuery, executeTransaction } from './database';
import { LocalSyncQueueItem } from './types';

export class SyncQueueRepository {
  /**
   * Fetch all pending outbound mutations waiting for synchronization.
   */
  static async getPendingItems(): Promise<LocalSyncQueueItem[]> {
    return (await executeQuery(
      `SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50`
    )) as LocalSyncQueueItem[];
  }

  /**
   * Remove items from sync queue after successful transmission.
   */
  static async removeItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
  }

  /**
   * Record a sync failure on a queue item (increment retry count and save last error message).
   */
  static async recordError(id: string, errorMessage: string): Promise<void> {
    await executeQuery(
      `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [errorMessage.substring(0, 500), id]
    );
  }

  /**
   * Get queue size count for UI status indicators.
   */
  static async getQueueCount(): Promise<number> {
    const res = await executeQuery(`SELECT COUNT(*) as count FROM sync_queue`);
    return res[0]?.count || 0;
  }
}
