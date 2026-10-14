import { executeQuery, executeTransaction } from './database';
import { LocalMenuDish } from './types';

export class MenuRepository {
  /**
   * Bulk update local menu cache from central server data.
   * Only stores or marks active dishes (is_available = 1) so unactivated dishes don't clutter offline view.
   */
  static async saveMenuDishes(dishes: any[]): Promise<void> {
    if (dishes.length === 0) return;

    const now = new Date().toISOString();
    const statements = dishes.map((dish) => ({
      sql: `INSERT OR REPLACE INTO menu_cache (
        dish_id, dish_name, category_id, category_name, kitchen_id, kitchen_name, price, is_available, image_url, sort_code, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        dish.dish_id || dish.DishId || dish.id,
        dish.dish_name || dish.Name || '',
        dish.category_id || dish.DishGroupId || '',
        dish.category_name || dish.DishGroupName || '',
        dish.kitchen_id || dish.CategoryId || '',
        dish.kitchen_name || dish.KitchenTypeName || '',
        Number(dish.price || dish.currentcost || dish.Cost || 0),
        dish.is_available === false || dish.IsActive === false || dish.IsActive === 0 ? 0 : 1,
        dish.image_url || dish.Imageid || '',
        Number(dish.sort_code || dish.SordCode || 0),
        now,
      ],
    }));

    await executeTransaction(statements);
    console.log(`[MenuRepository] Cached ${dishes.length} menu dishes in local SQLite.`);
  }

  /**
   * Cache CategoryMaster / Kitchen records in SQLite
   */
  static async saveKitchenCategories(kitchens: any[]): Promise<void> {
    if (!kitchens || kitchens.length === 0) return;
    const now = new Date().toISOString();
    const statements = kitchens.map((k) => ({
      sql: `INSERT OR REPLACE INTO categories_cache (
        category_id, category_name, kitchen_type_code, sort_code, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        k.CategoryId || k.category_id,
        k.KitchenTypeName || k.CategoryName || k.category_name || '',
        k.KitchenTypeCode || k.kitchen_type_code || '',
        Number(k.SortCode || k.sort_code || 0),
        k.IsActive === false || k.is_active === 0 ? 0 : 1,
        now,
      ],
    }));
    await executeTransaction(statements);
    console.log(`[MenuRepository] Cached ${kitchens.length} kitchen categories in local SQLite.`);
  }

  /**
   * Cache DishGroupMaster records in SQLite
   */
  static async saveDishGroups(groups: any[], categoryId?: string): Promise<void> {
    if (!groups || groups.length === 0) return;
    const now = new Date().toISOString();
    const statements = groups.map((g) => ({
      sql: `INSERT OR REPLACE INTO dishgroups_cache (
        group_id, group_name, category_id, kitchen_type_name, sort_code, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        g.DishGroupId || g.group_id,
        g.DishGroupName || g.group_name || '',
        categoryId || g.CategoryId || g.category_id || null,
        g.KitchenTypeName || g.kitchen_type_name || '',
        Number(g.SortCode || g.sort_code || 0),
        g.IsActive === false || g.is_active === 0 ? 0 : 1,
        now,
      ],
    }));
    await executeTransaction(statements);
    console.log(`[MenuRepository] Cached ${groups.length} dish groups in local SQLite.`);
  }

  /**
   * Fetch cached active categories/kitchens (filtered by is_active = 1, sorted by sort_code)
   */
  static async getCachedKitchens(): Promise<any[]> {
    const rows = await executeQuery(
      `SELECT category_id as CategoryId, category_name as KitchenTypeName, kitchen_type_code as KitchenTypeCode, sort_code as SortCode 
       FROM categories_cache 
       WHERE is_active = 1 
       ORDER BY sort_code ASC, category_name ASC`
    );
    return rows;
  }

  /**
   * Fetch cached active dish groups for a given category/kitchen (filtered by is_active = 1)
   */
  static async getCachedDishGroups(categoryId?: string): Promise<any[]> {
    let sql = `SELECT group_id as DishGroupId, group_name as DishGroupName, category_id as CategoryId, sort_code as SortCode 
               FROM dishgroups_cache 
               WHERE is_active = 1`;
    const params: any[] = [];
    if (categoryId) {
      sql += ` AND (category_id = ? OR category_id IS NULL)`;
      params.push(categoryId);
    }
    sql += ` ORDER BY sort_code ASC, group_name ASC`;
    const rows = await executeQuery(sql, params);
    return rows;
  }

  /**
   * Fetch active cached menu dishes (filtered strictly by is_available = 1)
   */
  static async getCachedMenu(): Promise<any[]> {
    const rows = await executeQuery(
      `SELECT * FROM menu_cache WHERE is_available = 1 ORDER BY sort_code ASC, category_name ASC, dish_name ASC`
    );
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
