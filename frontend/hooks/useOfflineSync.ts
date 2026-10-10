import { useState, useEffect, useCallback, useRef } from 'react';
import { OrderRepository, MenuRepository, SyncQueueRepository } from '../db';
import { useOfflineSyncStore } from '../stores/offlineSyncStore';
import axios from 'axios';

// 20 Minutes Background Sync Interval
const SYNC_INTERVAL_MS = 20 * 60 * 1000;
// 30 Seconds Retry Loop for Unsynced Local Queue
const RETRY_QUEUE_INTERVAL_MS = 30 * 1000;

export interface SyncStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
}

export function useOfflineSync(backendUrl: string) {
  const cleanUrl = (backendUrl || '').trim().replace(/\/+$/, '');

  const [syncState, setSyncState] = useState<SyncStatusState>({
    isOnline: true,
    isSyncing: false,
    lastSyncedAt: null,
    pendingCount: 0,
    lastError: null,
  });

  const isSyncingRef = useRef(false);

  const updateState = useCallback((patch: Partial<SyncStatusState>) => {
    setSyncState((prev) => {
      const updated = { ...prev, ...patch };
      useOfflineSyncStore.getState().setSyncStatus(updated);
      return updated;
    });
  }, []);

  // Update pending queue count for UI status pill
  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await SyncQueueRepository.getQueueCount();
      updateState({ pendingCount: count });
    } catch (err) {
      console.warn('[OfflineSync] Failed to fetch queue count:', err);
    }
  }, [updateState]);

  /**
   * Push unsynced local SQLite orders up to Counter PC / Railway
   */
  const pushLocalOrders = useCallback(async (): Promise<number> => {
    if (!cleanUrl) return 0;
    const unsyncedBatch = await OrderRepository.getUnsyncedOrders();
    if (unsyncedBatch.length === 0) return 0;

    console.log(`[OfflineSync] Found ${unsyncedBatch.length} unsynced orders to push to ${cleanUrl}...`);

    const response = await axios.post(`${cleanUrl}/api/sync/push`, {
      batch: unsyncedBatch,
    }, { timeout: 15000 });

    if (response.data?.success) {
      const syncedIds = response.data.synced_client_ids || [];
      await OrderRepository.markOrdersSynced(syncedIds);
      console.log(`[OfflineSync] Push successful! Synced ${syncedIds.length} orders.`);
      return syncedIds.length;
    } else {
      throw new Error(response.data?.error || 'Push sync rejected by server.');
    }
  }, [cleanUrl]);

  /**
   * Pull updated menu dishes from central MSSQL server into local SQLite cache
   */
  const pullMenuData = useCallback(async (): Promise<void> => {
    if (!cleanUrl) return;
    const response = await axios.get(`${cleanUrl}/api/sync/pull`, { timeout: 15000 });
    if (response.data?.success && Array.isArray(response.data.dishes)) {
      await MenuRepository.saveMenuDishes(response.data.dishes);
      console.log(`[OfflineSync] Pull successful! Cached ${response.data.dishes.length} menu items locally.`);
    }
  }, [cleanUrl]);

  /**
   * Trigger full synchronization cycle (Push + Pull)
   */
  const executeFullSync = useCallback(async () => {
    if (isSyncingRef.current || !cleanUrl) return;
    isSyncingRef.current = true;

    updateState({ isSyncing: true, lastError: null });

    try {
      // 1. Push local changes up to cloud
      const syncedCount = await pushLocalOrders();

      // 2. Pull master menu down from cloud
      await pullMenuData();

      const now = new Date().toLocaleTimeString();
      updateState({
        isOnline: true,
        isSyncing: false,
        lastSyncedAt: now,
        lastError: null,
      });

      await refreshQueueCount();
      return { success: true, syncedCount };
    } catch (err: any) {
      const errMsg = err.message || 'Sync operation failed.';
      console.error('[OfflineSync] Sync error:', errMsg);

      updateState({
        isOnline: false,
        isSyncing: false,
        lastError: errMsg,
      });

      await refreshQueueCount();
      return { success: false, error: errMsg };
    } finally {
      isSyncingRef.current = false;
    }
  }, [cleanUrl, pushLocalOrders, pullMenuData, refreshQueueCount, updateState]);

  // Automated 20-minute background interval + 30-second retry loop
  useEffect(() => {
    refreshQueueCount();

    // 1. 20-Minute Background Sync Timer
    const mainSyncInterval = setInterval(() => {
      console.log('[OfflineSync] 20-minute background timer triggered.');
      executeFullSync();
    }, SYNC_INTERVAL_MS);

    // 2. 30-Second Local Queue Retry Loop
    const retryInterval = setInterval(async () => {
      const count = await SyncQueueRepository.getQueueCount();
      if (count > 0 && !isSyncingRef.current) {
        console.log(`[OfflineSync] Retry loop detected ${count} pending items in queue.`);
        executeFullSync();
      }
    }, RETRY_QUEUE_INTERVAL_MS);

    return () => {
      clearInterval(mainSyncInterval);
      clearInterval(retryInterval);
    };
  }, [executeFullSync, refreshQueueCount]);

  return {
    ...syncState,
    triggerManualSync: executeFullSync,
    refreshQueueCount,
  };
}
