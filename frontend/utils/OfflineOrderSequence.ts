import AsyncStorage from '@react-native-async-storage/async-storage';
import { executeQuery } from '../db/database';
import { useAuthStore } from '../stores/authStore';

const STORAGE_KEY_DATE = 'pos_offline_order_date';
const STORAGE_KEY_SEQ = 'pos_offline_order_seq';

/**
 * Returns current date string formatted as YYYYMMDD in local/Singapore time
 */
export function getSingaporeDatePrefix(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date()).replace(/-/g, "");
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
}

/**
 * Resolves standard station prefix based on user role and configuration
 */
export function resolveDeviceStationPrefix(customPrefix?: string): string {
  if (customPrefix && customPrefix.trim()) {
    return customPrefix.trim().toUpperCase();
  }
  const { user, isWaiter } = useAuthStore.getState();
  if (isWaiter && isWaiter()) {
    const waiterCode = (user?.userCode || user?.userName || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return waiterCode ? `W${waiterCode.slice(0, 2)}` : "W1";
  }
  return "POS";
}

export class OfflineOrderSequence {
  /**
   * Generates the next sequential Order Number (e.g. POS-20261013-0001)
   * Guaranteed to be atomic, monotonically increasing, and unique for the current day.
   */
  static async getNextOrderNumber(customPrefix?: string): Promise<string> {
    const todayStr = getSingaporeDatePrefix();
    const prefix = resolveDeviceStationPrefix(customPrefix);

    let currentSeq = 0;
    try {
      const storedDate = await AsyncStorage.getItem(STORAGE_KEY_DATE);
      const storedSeq = await AsyncStorage.getItem(STORAGE_KEY_SEQ);

      if (storedDate === todayStr && storedSeq) {
        currentSeq = parseInt(storedSeq, 10) || 0;
      } else {
        currentSeq = 0;
      }
    } catch {
      currentSeq = 0;
    }

    // Safety net: check SQLite orders table for today's max sequence
    try {
      const likePattern = `%${todayStr}%`;
      const rows = (await executeQuery(
        `SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY created_at DESC LIMIT 50`,
        [likePattern]
      )) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const match = row.order_number?.match(/-(\d{4,})$/);
          if (match && match[1]) {
            const parsed = parseInt(match[1], 10);
            if (parsed > currentSeq) {
              currentSeq = parsed;
            }
          }
        }
      }
    } catch {
      // ignore sqlite query errors if db not initialized
    }

    const nextSeq = currentSeq + 1;

    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEY_DATE, todayStr],
        [STORAGE_KEY_SEQ, String(nextSeq)],
      ]);
    } catch (e) {
      console.warn('[OfflineOrderSequence] Failed to persist sequence in AsyncStorage:', e);
    }

    const paddedSeq = String(nextSeq).padStart(4, '0');
    const orderNo = `${prefix}-${todayStr}-${paddedSeq}`;
    console.log(`🏷️ [OfflineOrderSequence] Generated Order Number: ${orderNo}`);
    return orderNo;
  }

  /**
   * Peek current highest order number without incrementing
   */
  static async peekCurrentOrderNumber(customPrefix?: string): Promise<string> {
    const todayStr = getSingaporeDatePrefix();
    const prefix = resolveDeviceStationPrefix(customPrefix);
    try {
      const storedDate = await AsyncStorage.getItem(STORAGE_KEY_DATE);
      const storedSeq = await AsyncStorage.getItem(STORAGE_KEY_SEQ);
      const seq = (storedDate === todayStr && storedSeq) ? parseInt(storedSeq, 10) : 1;
      return `${prefix}-${todayStr}-${String(seq).padStart(4, '0')}`;
    } catch {
      return `${prefix}-${todayStr}-0001`;
    }
  }
}
