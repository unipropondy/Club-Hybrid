import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OrderRepository,
  MenuRepository,
  TableRepository,
  PaymodeRepository,
  MemberRepository,
  SettingsRepository,
  SyncQueueRepository,
  UserRepository,
} from '../db';
import { useOfflineSyncStore } from '../stores/offlineSyncStore';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
   * Pull updated master data (dishes, tables, paymodes, members, credit, settings) from server into local SQLite cache
   */
  const pullMasterData = useCallback(async (): Promise<void> => {
    if (!cleanUrl) return;
    try {
      const response = await axios.get(`${cleanUrl}/api/sync/pull`, { timeout: 15000 });
      if (response.data?.success) {
        // 1. Save Dishes
        if (Array.isArray(response.data.dishes) && response.data.dishes.length > 0) {
          await MenuRepository.saveMenuDishes(response.data.dishes);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.dishes.length} dishes locally.`);
        }
        // 2. Save Tables
        if (Array.isArray(response.data.tables) && response.data.tables.length > 0) {
          await TableRepository.saveTables(response.data.tables);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.tables.length} tables locally.`);
        }
        // 3. Save Payment Modes
        if (Array.isArray(response.data.paymodes) && response.data.paymodes.length > 0) {
          await PaymodeRepository.savePaymodes(response.data.paymodes);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.paymodes.length} paymodes locally.`);
        }
        // 4. Save Members
        if (Array.isArray(response.data.members) && response.data.members.length > 0) {
          await MemberRepository.saveMembers(response.data.members);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.members.length} members locally.`);
        }
        // 5. Save Credit Customers
        if (Array.isArray(response.data.credit_customers) && response.data.credit_customers.length > 0) {
          await MemberRepository.saveCreditCustomers(response.data.credit_customers);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.credit_customers.length} credit customers locally.`);
        }
        // 6. Save Company Settings
        if (response.data.company_settings) {
          await SettingsRepository.saveCompanySettings(response.data.company_settings);
          console.log(`[OfflineSync] Pull successful! Cached company settings locally.`);
        }
        // 7. Save General Settings
        if (response.data.general_settings) {
          await SettingsRepository.saveGeneralSettings(response.data.general_settings);
          console.log(`[OfflineSync] Pull successful! Cached general settings locally.`);
        }
        // 8. Save Users (for 100% offline APK counter login)
        if (Array.isArray(response.data.users) && response.data.users.length > 0) {
          await UserRepository.saveUsers(response.data.users);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.users.length} users locally.`);
        }
        // 9. Save User Permissions
        if (Array.isArray(response.data.permissions) && response.data.permissions.length > 0) {
          await UserRepository.savePermissions(response.data.permissions);
          console.log(`[OfflineSync] Pull successful! Cached ${response.data.permissions.length} permissions locally.`);
        }
        // 10. Save Active Business Day (StartDate)
        if (response.data.active_business_day?.startDate) {
          const sDate = response.data.active_business_day.startDate;
          await SettingsRepository.saveActiveBusinessDay(sDate, true, response.data.active_business_day.username);
          await AsyncStorage.setItem('selected_business_date', sDate);
          console.log(`[OfflineSync] Pull successful! Cached active business day (${sDate}) locally.`);
        }
        // 11. Save License Information
        if (response.data.license) {
          await SettingsRepository.saveLicenseInfo(response.data.license);
          await AsyncStorage.setItem('cached_license_info', JSON.stringify(response.data.license));
          console.log(`[OfflineSync] Pull successful! Cached license information locally.`);
        }
      }
    } catch (err: any) {
      console.warn('[OfflineSync] Master data pull warning:', err.message);
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

      // 2. Pull master data (dishes, tables, paymodes) down from cloud
      await pullMasterData();

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
  }, [cleanUrl, pushLocalOrders, pullMasterData, refreshQueueCount, updateState]);

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
