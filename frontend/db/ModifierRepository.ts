import { executeQuery, executeTransaction } from './database';

export class ModifierRepository {
  /**
   * Save dish modifiers into local SQLite cache.
   */
  static async saveModifiers(modifiers: any[]): Promise<void> {
    if (!Array.isArray(modifiers) || modifiers.length === 0) return;

    const now = new Date().toISOString();
    const statements = modifiers.map((m) => {
      const modifierId = String(m.modifier_id || m.ModifierId || m.ModifierID || '').trim();
      const dishId = String(m.dish_id || m.DishId || '').trim();
      const groupId = m.group_id || m.GroupId || m.ModifierGroupId || null;
      const modifierCode = m.modifier_code || m.ModifierCode || null;
      const modifierName = String(m.modifier_name || m.ModifierName || m.name || '').trim();
      const price = Number(m.price || m.Price || m.DishCost || 0);
      const isOpen = m.is_open_modifier === 1 || m.isOpenModifier === 1 || m.isOpenModifier === true ? 1 : 0;
      const sortCode = Number(m.sort_code || m.SortCode || 0);

      return {
        sql: `INSERT OR REPLACE INTO modifiers_cache (
          modifier_id, dish_id, group_id, modifier_code, modifier_name, price, is_open_modifier, sort_code, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          modifierId,
          dishId,
          groupId,
          modifierCode,
          modifierName,
          price,
          isOpen,
          sortCode,
          now,
        ],
      };
    }).filter(s => s.params[0] && s.params[1] && s.params[4]);

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[ModifierRepository] Cached ${statements.length} dish modifiers.`);
    }
  }

  /**
   * Fetch modifiers for a dish offline.
   */
  static async getModifiersByDishId(dishId: string): Promise<any[]> {
    const cleanId = String(dishId || '').trim();
    const rows = await executeQuery(
      `SELECT * FROM modifiers_cache WHERE dish_id = ? ORDER BY sort_code ASC, modifier_name ASC`,
      [cleanId]
    );

    return rows.map((r: any) => ({
      ModifierID: r.modifier_id,
      ModifierId: r.modifier_id,
      DishId: r.dish_id,
      GroupId: r.group_id,
      ModifierCode: r.modifier_code,
      ModifierName: r.modifier_name,
      Price: r.price,
      isOpenModifier: r.is_open_modifier === 1,
      SortCode: r.sort_code,
    }));
  }
}
