import { executeQuery, executeTransaction } from './database';

export class ComboRepository {
  /**
   * Cache all combo configurations fetched from server.
   */
  static async saveCombos(combos: any[]): Promise<void> {
    if (!Array.isArray(combos) || combos.length === 0) return;

    const now = new Date().toISOString();
    const statements = combos.map((c) => {
      const comboId = String(c.combo_id || c.ComboId || c.dish_id || c.DishId || '').trim();
      const dishId = String(c.dish_id || c.DishId || comboId).trim();
      const name = String(c.name || c.Name || '').trim();
      const basePrice = Number(c.base_price || c.basePrice || c.BasePrice || 0);
      const rawConfig = typeof c.raw_config === 'string' ? c.raw_config : JSON.stringify(c);

      return {
        sql: `INSERT OR REPLACE INTO combo_cache (
          combo_id, dish_id, name, base_price, raw_config, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [comboId, dishId, name, basePrice, rawConfig, now],
      };
    }).filter(s => s.params[0] && s.params[1]);

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[ComboRepository] Cached ${statements.length} combo configurations.`);
    }
  }

  /**
   * Fetch cached combo configuration for a dish ID.
   */
  static async getComboByDishId(dishId: string): Promise<any | null> {
    const cleanId = String(dishId || '').trim();
    const rows = await executeQuery(
      `SELECT * FROM combo_cache WHERE dish_id = ? OR combo_id = ? LIMIT 1`,
      [cleanId, cleanId]
    );

    if (rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].raw_config);
    } catch (_) {
      return null;
    }
  }

  /**
   * Fetch all cached combos.
   */
  static async getAllCombos(): Promise<any[]> {
    const rows = await executeQuery(`SELECT * FROM combo_cache`);
    return rows.map((r: any) => {
      try {
        return JSON.parse(r.raw_config);
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
  }
}
