import { create } from 'zustand';

export interface OfflineSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
}

interface OfflineSyncStoreState extends OfflineSyncStatus {
  setSyncStatus: (status: Partial<OfflineSyncStatus>) => void;
}

export const useOfflineSyncStore = create<OfflineSyncStoreState>((set) => ({
  isOnline: true,
  isSyncing: false,
  lastSyncedAt: null,
  pendingCount: 0,
  lastError: null,
  setSyncStatus: (status) => set((state) => ({ ...state, ...status })),
}));
