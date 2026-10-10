export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncMetadata {
  client_id: string; // UUID v4
  is_synced: number; // 0 = unsynced, 1 = synced
  sync_action: SyncAction;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface LocalOrder extends SyncMetadata {
  order_id: string; // Same as client_id
  order_number: string;
  table_no: string;
  waiter_name?: string;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'PENDING' | 'SENT' | 'READY' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'UNPAID' | 'PAID' | 'PARTIAL';
  payment_method?: string;
  raw_payload?: string; // JSON representation of full order context
}

export interface LocalOrderItem extends SyncMetadata {
  item_id: string; // client_id for item
  order_id: string; // Foreign key -> LocalOrder.client_id
  dish_id: string;
  dish_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  kds_status?: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
}

export interface LocalMenuDish {
  dish_id: string;
  dish_name: string;
  category_id: string;
  category_name: string;
  price: number;
  is_available: boolean;
  image_url?: string;
  updated_at: string;
}

export interface LocalSyncQueueItem {
  id: string; // UUID v4
  entity_type: 'ORDER' | 'ORDER_ITEM' | 'SETTLEMENT' | 'CUSTOMER';
  client_id: string;
  action: SyncAction;
  payload: string; // JSON payload
  retry_count: number;
  last_error?: string;
  created_at: string;
}
