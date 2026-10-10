import { executeQuery, executeTransaction } from './database';
import { LocalMenuDish } from './types';

export class MenuRepository {
  /**
   * Bulk update local menu cache from central server data.
   */
  static async saveMenuDishes(dishes: LocalMenuDish[]): Promise<void> {
    if (dishes.length === 0) return;

    const now = new Date().toISOString();
    const statements = dishes.map((dish) => ({
      sql: `INSERT OR REPLACE INTO menu_cache (
        dish_id, dish_name, category_id, category_name, price, is_available, image_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        dish.dish_id,
        dish.dish_name,
        dish.category_id,
        dish.category_name,
        dish.price,
        dish.is_available ? 1 : 0,
        dish.image_url || '',
        dish.updated_at || now,
      ],
    }));

    await executeTransaction(statements);
    console.log(`[MenuRepository] Cached ${dishes.length} menu dishes in local SQLite database.`);
  }

  /**
   * Fetch all cached menu dishes for instant offline menu display.
   */
  static async getCachedMenu(): Promise<LocalMenuDish[]> {
    const rows = await executeQuery(`SELECT * FROM menu_cache ORDER BY category_name ASC, dish_name ASC`);
    return rows.map((r: any) => ({
      ...r,
      is_available: r.is_available === 1 || r.is_available === true,
    }));
  }

  /**
   * Clear cached menu items.
   */
  static async clearMenuCache(): Promise<void> {
    await executeQuery(`DELETE FROM menu_cache`);
  }
}
