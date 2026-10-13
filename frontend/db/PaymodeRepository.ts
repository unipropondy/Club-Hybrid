import { executeQuery, executeTransaction } from './database';

export interface CachedPaymode {
  payMode: string;
  description: string;
  position: number;
  active: boolean;
  commission: number;
  serviceCharge: number;
}

export class PaymodeRepository {
  /**
   * Save or replace paymodes into local SQLite cache
   */
  static async savePaymodes(paymodes: any[]): Promise<void> {
    if (!paymodes || paymodes.length === 0) return;

    const now = new Date().toISOString();
    const statements = paymodes.map((p) => {
      const payMode = String(p.payMode || p.PayMode || p.pay_mode || '').trim();
      const desc = String(p.description || p.Description || p.payMode || '');
      const position = Number(p.position || p.Position || 0);
      const active = (p.active !== false && p.is_active !== 0 && p.IsActive !== false) ? 1 : 0;
      const commission = Number(p.commission || 0);
      const serviceCharge = Number(p.serviceCharge || 0);

      return {
        sql: `INSERT OR REPLACE INTO paymodes_cache (
          pay_mode, description, position, is_active,
          commission, service_charge, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [payMode, desc, position, active, commission, serviceCharge, now],
      };
    });

    try {
      await executeTransaction(statements);
      console.log(`[PaymodeRepository] Cached ${paymodes.length} paymodes in local SQLite.`);
    } catch (err) {
      console.error('[PaymodeRepository] Failed to cache paymodes:', err);
    }
  }

  /**
   * Retrieve active cached payment methods
   */
  static async getCachedPaymodes(): Promise<CachedPaymode[]> {
    try {
      const rows = await executeQuery(
        `SELECT 
          pay_mode as payMode,
          description,
          position,
          is_active as active,
          commission,
          service_charge as serviceCharge
        FROM paymodes_cache
        WHERE is_active = 1
        ORDER BY position ASC`
      );

      return rows.map((r) => ({
        payMode: r.payMode,
        description: r.description,
        position: r.position,
        active: Boolean(r.active),
        commission: Number(r.commission || 0),
        serviceCharge: Number(r.serviceCharge || 0),
      }));
    } catch (err) {
      console.error('[PaymodeRepository] Failed to retrieve cached paymodes:', err);
      // Sensible offline defaults if empty
      return [
        { payMode: 'CASH', description: 'Cash', position: 1, active: true, commission: 0, serviceCharge: 0 },
        { payMode: 'CARD', description: 'Card', position: 2, active: true, commission: 0, serviceCharge: 0 },
        { payMode: 'QR', description: 'QR / PayNow', position: 3, active: true, commission: 0, serviceCharge: 0 },
      ];
    }
  }
}
