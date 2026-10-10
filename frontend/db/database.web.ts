import AsyncStorage from '@react-native-async-storage/async-storage';

let isInitialized = false;

// In-memory / AsyncStorage mock store for web fallback
const webStorageMemory: Record<string, any[]> = {
  orders: [],
  order_items: [],
  menu_cache: [],
  sync_queue: [],
  app_settings_cache: [],
};

export async function getLocalDatabase() {
  if (isInitialized) return null;

  try {
    for (const tableName of Object.keys(webStorageMemory)) {
      const stored = await AsyncStorage.getItem(`@pos_db_${tableName}`);
      if (stored) {
        webStorageMemory[tableName] = JSON.parse(stored);
      }
    }
  } catch (err) {
    console.error(`[LocalDB] Web storage error:`, err);
  }

  isInitialized = true;
  return null;
}

export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  await getLocalDatabase();
  return executeWebFallbackQuery(sql, params);
}

export async function executeTransaction(statements: { sql: string; params?: any[] }[]): Promise<void> {
  await getLocalDatabase();
  for (const stmt of statements) {
    await executeWebFallbackQuery(stmt.sql, stmt.params || []);
  }
}

async function persistWebTable(tableName: string) {
  try {
    await AsyncStorage.setItem(`@pos_db_${tableName}`, JSON.stringify(webStorageMemory[tableName]));
  } catch (err) {
    console.error(`[LocalDB] Failed to persist web table ${tableName}:`, err);
  }
}

function executeWebFallbackQuery(sql: string, params: any[] = []): any[] {
  const cleaned = sql.trim();
  const upper = cleaned.toUpperCase();

  if (upper.startsWith('SELECT')) {
    if (upper.includes('FROM SYNC_QUEUE')) {
      if (upper.includes('COUNT(*)')) {
        return [{ count: webStorageMemory.sync_queue.length }];
      }
      return webStorageMemory.sync_queue;
    }
    if (upper.includes('FROM ORDERS')) {
      if (upper.includes('IS_SYNCED = 0')) {
        return webStorageMemory.orders.filter((o) => Number(o.is_synced) === 0);
      }
      return webStorageMemory.orders;
    }
    if (upper.includes('FROM ORDER_ITEMS')) {
      if (upper.includes('ORDER_ID = ?') && params.length > 0) {
        return webStorageMemory.order_items.filter((item) => String(item.order_id) === String(params[0]));
      }
      return webStorageMemory.order_items;
    }
    if (upper.includes('FROM MENU_CACHE')) {
      return webStorageMemory.menu_cache;
    }
    return [];
  }

  if (upper.startsWith('INSERT INTO ORDERS')) {
    const newOrder = {
      client_id: params[0],
      order_number: params[1],
      table_no: params[2],
      waiter_name: params[3],
      customer_name: params[4],
      subtotal: params[5],
      tax_amount: params[6],
      discount_amount: params[7],
      total_amount: params[8],
      status: params[9],
      payment_status: params[10],
      payment_method: params[11],
      raw_payload: params[12],
      is_synced: params[13],
      sync_action: params[14],
      created_at: params[15],
      updated_at: params[16],
    };
    webStorageMemory.orders = webStorageMemory.orders.filter((o) => o.client_id !== newOrder.client_id);
    webStorageMemory.orders.push(newOrder);
    persistWebTable('orders');
    return [{ changes: 1 }];
  }

  if (upper.startsWith('INSERT INTO ORDER_ITEMS')) {
    const newItem = {
      item_id: params[0],
      order_id: params[1],
      dish_id: params[2],
      dish_name: params[3],
      quantity: params[4],
      unit_price: params[5],
      total_price: params[6],
      notes: params[7],
      kds_status: params[8],
      is_synced: params[9],
      sync_action: params[10],
      created_at: params[11],
      updated_at: params[12],
    };
    webStorageMemory.order_items = webStorageMemory.order_items.filter((i) => i.item_id !== newItem.item_id);
    webStorageMemory.order_items.push(newItem);
    persistWebTable('order_items');
    return [{ changes: 1 }];
  }

  if (upper.startsWith('INSERT INTO SYNC_QUEUE')) {
    const newQueueItem = {
      id: params[0],
      entity_type: 'ORDER',
      client_id: params[1],
      action: 'INSERT',
      payload: params[2],
      retry_count: 0,
      created_at: params[3],
    };
    webStorageMemory.sync_queue = webStorageMemory.sync_queue.filter((q) => q.client_id !== newQueueItem.client_id);
    webStorageMemory.sync_queue.push(newQueueItem);
    persistWebTable('sync_queue');
    return [{ changes: 1 }];
  }

  if (upper.includes('INTO MENU_CACHE')) {
    const dishItem = {
      dish_id: params[0],
      dish_name: params[1],
      category_id: params[2],
      category_name: params[3],
      price: params[4],
      is_available: params[5] === 1 || params[5] === true,
      image_url: params[6],
      updated_at: params[7],
    };
    webStorageMemory.menu_cache = webStorageMemory.menu_cache.filter((d) => d.dish_id !== dishItem.dish_id);
    webStorageMemory.menu_cache.push(dishItem);
    persistWebTable('menu_cache');
    return [{ changes: 1 }];
  }

  if (upper.startsWith('UPDATE ORDERS')) {
    if (upper.includes('SET IS_SYNCED = 1')) {
      const ids = new Set(params.map(String));
      webStorageMemory.orders.forEach((o) => {
        if (ids.has(String(o.client_id))) {
          o.is_synced = 1;
        }
      });
      persistWebTable('orders');
    }
    return [{ changes: 1 }];
  }

  if (upper.startsWith('UPDATE ORDER_ITEMS')) {
    if (upper.includes('SET IS_SYNCED = 1')) {
      const ids = new Set(params.map(String));
      webStorageMemory.order_items.forEach((i) => {
        if (ids.has(String(i.order_id))) {
          i.is_synced = 1;
        }
      });
      persistWebTable('order_items');
    }
    return [{ changes: 1 }];
  }

  if (upper.startsWith('DELETE FROM SYNC_QUEUE')) {
    const ids = new Set(params.map(String));
    webStorageMemory.sync_queue = webStorageMemory.sync_queue.filter(
      (q) => !ids.has(String(q.client_id)) && !ids.has(String(q.id))
    );
    persistWebTable('sync_queue');
    return [{ changes: 1 }];
  }

  return [];
}
