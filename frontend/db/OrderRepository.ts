import 'react-native-get-random-values';
import { executeQuery, executeTransaction } from './database';
import { LocalOrder, LocalOrderItem, SyncAction } from './types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class OrderRepository {
  /**
   * Save a new order and its line items locally in SQLite with offline sync metadata.
   */
  static async createOrder(
    order: Omit<LocalOrder, 'client_id' | 'is_synced' | 'sync_action' | 'created_at' | 'updated_at'>,
    items: Omit<LocalOrderItem, 'item_id' | 'order_id' | 'is_synced' | 'sync_action' | 'created_at' | 'updated_at'>[]
  ): Promise<LocalOrder> {
    const clientId = generateUUID();
    const now = new Date().toISOString();

    const fullOrder: LocalOrder = {
      ...order,
      client_id: clientId,
      order_id: clientId,
      is_synced: 0,
      sync_action: 'INSERT',
      created_at: now,
      updated_at: now,
    };

    const statements: { sql: string; params: any[] }[] = [];

    // 1. Insert order statement
    statements.push({
      sql: `INSERT INTO orders (
        client_id, order_number, table_no, waiter_name, customer_name,
        subtotal, tax_amount, discount_amount, total_amount, status,
        payment_status, payment_method, raw_payload, is_synced, sync_action,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'INSERT', ?, ?)`,
      params: [
        fullOrder.client_id,
        fullOrder.order_number,
        fullOrder.table_no,
        fullOrder.waiter_name || '',
        fullOrder.customer_name || '',
        fullOrder.subtotal,
        fullOrder.tax_amount,
        fullOrder.discount_amount,
        fullOrder.total_amount,
        fullOrder.status,
        fullOrder.payment_status,
        fullOrder.payment_method || '',
        fullOrder.raw_payload || '',
        now,
        now,
      ],
    });

    // 2. Insert item statements
    const fullItems: LocalOrderItem[] = items.map((item) => {
      const itemId = generateUUID();
      return {
        ...item,
        item_id: itemId,
        order_id: clientId,
        is_synced: 0,
        sync_action: 'INSERT',
        created_at: now,
        updated_at: now,
      };
    });

    for (const item of fullItems) {
      statements.push({
        sql: `INSERT INTO order_items (
          item_id, order_id, dish_id, dish_name, quantity, unit_price, total_price,
          notes, kds_status, is_synced, sync_action, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'INSERT', ?, ?)`,
        params: [
          item.item_id,
          item.order_id,
          item.dish_id,
          item.dish_name,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.notes || '',
          item.kds_status || 'PENDING',
          now,
          now,
        ],
      });
    }

    // 3. Enqueue to sync queue
    statements.push({
      sql: `INSERT INTO sync_queue (
        id, entity_type, client_id, action, payload, retry_count, created_at
      ) VALUES (?, 'ORDER', ?, 'INSERT', ?, 0, ?)`,
      params: [
        generateUUID(),
        clientId,
        JSON.stringify({ order: fullOrder, items: fullItems }),
        now,
      ],
    });

    // Execute atomic transaction
    await executeTransaction(statements);
    console.log(`[OrderRepository] Order ${fullOrder.order_number} saved locally (client_id: ${clientId}).`);
    return fullOrder;
  }

  /**
   * Fetch all unsynced orders (is_synced = 0) with their items for cloud up-sync.
   */
  static async getUnsyncedOrders(): Promise<{ order: LocalOrder; items: LocalOrderItem[] }[]> {
    const orders = (await executeQuery(
      `SELECT * FROM orders WHERE is_synced = 0 ORDER BY created_at ASC`
    )) as LocalOrder[];

    const result: { order: LocalOrder; items: LocalOrderItem[] }[] = [];

    for (const order of orders) {
      const items = (await executeQuery(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [order.client_id]
      )) as LocalOrderItem[];
      result.push({ order, items });
    }

    return result;
  }

  /**
   * Mark orders and their items as synced (is_synced = 1) after cloud acknowledgment.
   */
  static async markOrdersSynced(clientIds: string[]): Promise<void> {
    if (clientIds.length === 0) return;

    const placeholders = clientIds.map(() => '?').join(',');
    await executeTransaction([
      {
        sql: `UPDATE orders SET is_synced = 1 WHERE client_id IN (${placeholders})`,
        params: clientIds,
      },
      {
        sql: `UPDATE order_items SET is_synced = 1 WHERE order_id IN (${placeholders})`,
        params: clientIds,
      },
      {
        sql: `DELETE FROM sync_queue WHERE client_id IN (${placeholders}) AND entity_type = 'ORDER'`,
        params: clientIds,
      },
    ]);

    console.log(`[OrderRepository] Marked ${clientIds.length} orders as synced.`);
  }

  /**
   * Fetch all orders stored in local SQLite database for display.
   */
  static async getAllOrders(): Promise<LocalOrder[]> {
    return (await executeQuery(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`
    )) as LocalOrder[];
  }

  /**
   * Fetch a single order with its items.
   */
  static async getOrderById(clientId: string): Promise<{ order: LocalOrder; items: LocalOrderItem[] } | null> {
    const orders = (await executeQuery(
      `SELECT * FROM orders WHERE client_id = ?`,
      [clientId]
    )) as LocalOrder[];

    if (orders.length === 0) return null;

    const items = (await executeQuery(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [clientId]
    )) as LocalOrderItem[];

    return { order: orders[0], items };
  }
}
