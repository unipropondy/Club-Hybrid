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
  ComboRepository,
  ModifierRepository,
  SettlementRepository,
  AttendanceRepository,
  CashDrawerRepository,
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
  const isPullingRef = useRef(false);

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
   * Push unsynced local SQLite orders, alterations, and attendance up to Counter PC / Railway
   */
  const pushLocalOrders = useCallback(async (): Promise<number> => {
    if (!cleanUrl) return 0;
    const unsyncedBatch = await OrderRepository.getUnsyncedOrders();
    const unsyncedAlterations = await SettlementRepository.getPendingAlterations();
    const unsyncedAttendance = await AttendanceRepository.getUnsyncedAttendance();
    const unsyncedDrawerLogs = await CashDrawerRepository.getUnsyncedLogs();
    
    // Fetch pending day-end records
    const { executeQuery } = require('../db/database');
    const unsyncedDayEnds = await executeQuery(`SELECT * FROM day_end_records WHERE is_synced = 0`);

    if (
      unsyncedBatch.length === 0 &&
      unsyncedAlterations.length === 0 &&
      unsyncedAttendance.length === 0 &&
      unsyncedDrawerLogs.length === 0 &&
      unsyncedDayEnds.length === 0
    ) {
      return 0;
    }

    console.log(
      `[OfflineSync] Pushing ${unsyncedBatch.length} orders, ${unsyncedAlterations.length} alterations, ${unsyncedAttendance.length} attendance punches, ${unsyncedDrawerLogs.length} drawer logs, ${unsyncedDayEnds.length} day-ends...`
    );

    const response = await axios.post(
      `${cleanUrl}/api/sync/push`,
      {
        batch: unsyncedBatch,
        alterations: unsyncedAlterations,
        attendance: unsyncedAttendance,
        drawer_logs: unsyncedDrawerLogs,
        day_end_records: unsyncedDayEnds,
      },
      { timeout: 15000 }
    );

    if (response.data?.success) {
      const syncedIds = response.data.synced_client_ids || [];
      if (syncedIds.length > 0) {
        await OrderRepository.markOrdersSynced(syncedIds);
      }

      const syncedAltIds = response.data.synced_alteration_ids || [];
      for (const altId of syncedAltIds) {
        await SettlementRepository.removeAlteration(altId);
      }

      const syncedAttIds = response.data.synced_attendance_ids || [];
      if (syncedAttIds.length > 0) {
        await AttendanceRepository.markAttendanceSynced(syncedAttIds);
      }

      const syncedDrawerIds = response.data.synced_drawer_ids || [];
      if (syncedDrawerIds.length > 0) {
        await CashDrawerRepository.markLogsSynced(syncedDrawerIds);
      }

      const syncedDayEndIds = response.data.synced_day_end_ids || [];
      if (syncedDayEndIds.length > 0) {
        const placeholders = syncedDayEndIds.map(() => '?').join(',');
        await executeQuery(
          `UPDATE day_end_records SET is_synced = 1 WHERE id IN (${placeholders})`,
          syncedDayEndIds
        );
      }

      const totalSynced =
        syncedIds.length +
        syncedAltIds.length +
        syncedAttIds.length +
        syncedDrawerIds.length +
        syncedDayEndIds.length;
      console.log(`[OfflineSync] Push successful! Synced ${totalSynced} items.`);
      return totalSynced;
    } else {
      throw new Error(response.data?.error || 'Push sync rejected by server.');
    }
  }, [cleanUrl]);


  /**
   * Pull updated master data and today's sales from server into local SQLite cache
   */
  const pullMasterData = useCallback(async (): Promise<void> => {
    if (!cleanUrl || isPullingRef.current) return;
    isPullingRef.current = true;
    try {
      const response = await axios.get(`${cleanUrl}/api/sync/pull`, { timeout: 15000 });
      if (response.data?.success) {
        // 1. Save Dishes
        if (Array.isArray(response.data.dishes) && response.data.dishes.length > 0) {
          await MenuRepository.saveMenuDishes(response.data.dishes);
        }
        // 1.1 Save Kitchen Categories (CategoryMaster)
        if (Array.isArray(response.data.categories) && response.data.categories.length > 0) {
          await MenuRepository.saveKitchenCategories(response.data.categories);
        }
        // 1.2 Save Dish Groups (DishGroupMaster)
        if (Array.isArray(response.data.dish_groups) && response.data.dish_groups.length > 0) {
          await MenuRepository.saveDishGroups(response.data.dish_groups);
        }
        // 2. Save Tables
        if (Array.isArray(response.data.tables) && response.data.tables.length > 0) {
          await TableRepository.saveTables(response.data.tables);
        }
        // 3. Save Payment Modes
        if (Array.isArray(response.data.paymodes) && response.data.paymodes.length > 0) {
          await PaymodeRepository.savePaymodes(response.data.paymodes);
        }
        // 4. Save Members
        if (Array.isArray(response.data.members) && response.data.members.length > 0) {
          await MemberRepository.saveMembers(response.data.members);
        }
        // 5. Save Credit Customers
        if (Array.isArray(response.data.credit_customers) && response.data.credit_customers.length > 0) {
          await MemberRepository.saveCreditCustomers(response.data.credit_customers);
        }
        // 6. Save Company Settings
        if (response.data.company_settings) {
          await SettingsRepository.saveCompanySettings(response.data.company_settings);
        }
        // 7. Save General Settings
        if (response.data.general_settings) {
          await SettingsRepository.saveGeneralSettings(response.data.general_settings);
        }
        // 8. Save Users (for 100% offline APK counter login)
        if (Array.isArray(response.data.users) && response.data.users.length > 0) {
          await UserRepository.saveUsers(response.data.users);
        }
        // 9. Save User Permissions
        if (Array.isArray(response.data.permissions) && response.data.permissions.length > 0) {
          await UserRepository.savePermissions(response.data.permissions);
        }
        // 10. Save Active Business Day (StartDate)
        if (response.data.active_business_day?.startDate) {
          const sDate = response.data.active_business_day.startDate;
          await SettingsRepository.saveActiveBusinessDay(sDate, true, response.data.active_business_day.username);
          await AsyncStorage.setItem('selected_business_date', sDate);
        }
        // 11. Save License Information
        if (response.data.license) {
          await SettingsRepository.saveLicenseInfo(response.data.license);
          await AsyncStorage.setItem('cached_license_info', JSON.stringify(response.data.license));
        }
        // 12. Save Modifiers
        if (Array.isArray(response.data.modifiers) && response.data.modifiers.length > 0) {
          await ModifierRepository.saveModifiers(response.data.modifiers);
        }
        // 13. Save Combos
        if (Array.isArray(response.data.combos) && response.data.combos.length > 0) {
          await ComboRepository.saveCombos(response.data.combos);
        }
        // 14. Save Today's Settlements, Order Details, and Payments for instant offline reports
        if (Array.isArray(response.data.settlements) && response.data.settlements.length > 0) {
          await SettlementRepository.bulkSaveSettlements(response.data.settlements);
        }
        if (Array.isArray(response.data.order_details) && response.data.order_details.length > 0) {
          await SettlementRepository.bulkSaveOrderDetails(response.data.order_details);
        }
        if (Array.isArray(response.data.payment_details) && response.data.payment_details.length > 0) {
          await SettlementRepository.bulkSavePaymentDetails(response.data.payment_details);
        }
        // 15. Save Today's Attendance
        if (Array.isArray(response.data.attendance) && response.data.attendance.length > 0) {
          await AttendanceRepository.bulkSaveAttendance(response.data.attendance);
        }
        // 16. Save Cash Drawer Activity Logs
        if (Array.isArray(response.data.drawer_logs) && response.data.drawer_logs.length > 0) {
          await CashDrawerRepository.bulkSaveLogs(response.data.drawer_logs);
        }
        console.log(`[OfflineSync] Full master data, sales & cash drawer logs cached locally.`);
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
