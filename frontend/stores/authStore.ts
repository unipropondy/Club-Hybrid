import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiUrl } from "../constants/Config";

/* ================= HEARTBEAT SERVICE ================= */
let heartbeatTimer: any = null;

export const startHeartbeat = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  const sendPing = async () => {
    try {
      const state = useAuthStore.getState();
      if (!state.isLoggedIn || !state.user || !state.sessionId) return;

      const activeApi = getApiUrl();
      const res = await fetch(`${activeApi}/api/auth/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: state.user.userId || (state.user as any).id,
          sessionId: state.sessionId,
        }),
      });

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.sessionRevoked) {
          console.warn("[AuthHeartbeat] Active session revoked or superseded. Logging out.");
          state.logout();
        }
      }
    } catch {
      // Ignore network blip / offline fluctuation
    }
  };

  // Ping every 45s (keeps session well within the 5-minute / 300s expiration)
  heartbeatTimer = setInterval(sendPing, 45000);
  sendPing();
};

export const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

/* ================= TYPES ================= */

export type UserRole = "ADMIN" | "CASHIER" | "MANAGER" | "SUPERVISOR" | "KDS" | "WAITER" | "OWNER";

export type AuthUser = {
  userId: string;
  userCode: string;
  userName: string;
  fullName: string;
  role: UserRole;
  roleName: string;
  userGroupId?: string;
};

export type FormPermission = {
  canAdd: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRead: boolean;
};

// Map of FormCode → permissions
export type PermissionsMap = Record<string, FormPermission>;

/* ============================================================
   FormCode → POS Screen mapping (from [dbo].[UserPermission])
   ============================================================
   OPRORD  → Ordering / Tables (main POS flow)
   RPTSAL  → Sales Report
   OPRMBR  → Members
   OPRTEN  → Time Entry / Attendance
   MSTTBL  → Lock Tables / Table Management
   OPRSTK  → KDS (Kitchen Display System / Stock)
   OPROLS  → Held Orders / Online Orders
   VWORDR  → Void Order
   OPRDED  → Daily End / Deductions
   SECUSR  → Security: Users (admin only)
   SECUGR  → Security: User Groups (admin only)
   SECPRM  → Security: Permissions (admin only)
   ============================================================ */

export const FORM_CODES = {
  ORDERING:     "OPRORD",  // Tables and ordering
  SALES_REPORT: "RPTSAL",  // Sales Report
  MEMBERS:      "OPRMBR",  // Members
  STAFF_ATTENDANCE: "OPRTEN",  // Staff Attendance
  TABLES:       "MSTTBL",  // Lock Tables
  KDS:          "OPRSTK",  // Kitchen Display / Stock
  HELD_ORDERS:  "OPROLS",  // Held Orders
  VOID_ORDER:   "VWORDR",  // Void Orders
  DAILY_END:    "OPRDED",  // Daily End
} as const;

export type AuthState = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  loginDate: string | null;
  permissions: PermissionsMap;
  permissionsLoaded: boolean;
  token: string | null;
  sessionId: string | null;

  setUser: (user: AuthUser, token?: string, loginDate?: string | null, sessionId?: string | null) => void;
  setPermissions: (permissions: PermissionsMap) => void;
  logout: () => void;

  // Low-level permission check by FormCode
  can: (formCode: string) => boolean;
  canDelete: (formCode: string) => boolean;

  // High-level screen access checks (mapped to FormCodes)
  canAccessOrdering: () => boolean;
  canAccessSalesReport: () => boolean;
  canAccessMembers: () => boolean;
  canAccessStaffAttendance: () => boolean;
  canAccessLockTables: () => boolean;
  canAccessKDS: () => boolean;
  canAccessHeldOrders: () => boolean;
  canVoidOrder: () => boolean;
  canAccessDayEnd: () => boolean;
  canAccessStoreSettings: () => boolean;
  canAccessReceiptSettings: () => boolean;
  canAccessWaiters: () => boolean;

  // Role helpers
  isAdmin: () => boolean;
  isManager: () => boolean;
  isSupervisor: () => boolean;
  isCashier: () => boolean;
  isWaiter: () => boolean;
  isKDS: () => boolean;
};

/* ================= STORE ================= */

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoggedIn: false,
      loginDate: null,
      permissions: {},
      permissionsLoaded: false,
      token: null,
      sessionId: null,

      setUser: (user, token, loginDate, sessionId) => {
        set({
          user,
          token: token || null,
          sessionId: sessionId || null,
          isLoggedIn: true,
          loginDate: loginDate || new Date().toISOString().split("T")[0],
        });
        startHeartbeat();
      },

      setPermissions: (permissions) => set({ permissions, permissionsLoaded: true }),

      logout: () => {
        const { user, sessionId } = get();
        stopHeartbeat();

        // Release session lock from backend immediately
        if (user && sessionId) {
          try {
            const activeApi = getApiUrl();
            fetch(`${activeApi}/api/auth/logout`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user.userId || (user as any).id,
                sessionId: sessionId,
              }),
            }).catch(() => {});
          } catch {}
        }

        set({
          user: null,
          token: null,
          sessionId: null,
          isLoggedIn: false,
          permissions: {},
          permissionsLoaded: false,
          loginDate: null,
        });
      },

      /* ─── Low-level: check if user can READ a given FormCode ─── */
      can: (formCode) => {
        const { permissions, user } = get();
        if (user?.role === "ADMIN" || user?.role === "MANAGER") return true;
        const perm = permissions[formCode];
        return perm?.canRead === true;
      },

      canDelete: (formCode) => {
        const { permissions, user } = get();
        if (user?.role === "ADMIN" || user?.role === "MANAGER") return true;
        const perm = permissions[formCode];
        return perm?.canDelete === true;
      },

      /* ─── High-level screen access helpers ─── */
      canAccessOrdering:    () => get().can(FORM_CODES.ORDERING),
      canAccessSalesReport: () => get().can(FORM_CODES.SALES_REPORT),
      canAccessMembers:     () => get().can(FORM_CODES.MEMBERS),
      canAccessStaffAttendance:   () => get().can(FORM_CODES.STAFF_ATTENDANCE),
      canAccessLockTables:  () => get().can(FORM_CODES.TABLES),
      canAccessKDS:         () => get().can(FORM_CODES.KDS),
      canAccessHeldOrders:  () => get().can(FORM_CODES.HELD_ORDERS),
      canVoidOrder:         () => get().can(FORM_CODES.VOID_ORDER),
      canAccessDayEnd:      () => get().can(FORM_CODES.DAILY_END),
      canAccessStoreSettings: () => {
        const role = get().user?.role;
        return role === "ADMIN" || role === "MANAGER" || role === "OWNER";
      },
      canAccessReceiptSettings: () => {
        const role = get().user?.role;
        return role === "ADMIN" || role === "MANAGER" || role === "OWNER";
      },
      canAccessWaiters: () => {
        const role = get().user?.role;
        return role === "ADMIN" || role === "MANAGER" || role === "OWNER";
      },

      /* ─── Role helpers ─── */
      isAdmin:      () => get().user?.role === "ADMIN",
      isManager:    () => get().user?.role === "MANAGER",
      isSupervisor: () => get().user?.role === "SUPERVISOR",
      isCashier:    () => get().user?.role === "CASHIER",
      isWaiter:     () => get().user?.role === "WAITER",
      isKDS:        () => get().user?.role === "KDS",
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() =>
        Platform.OS === "web" ? window.sessionStorage : AsyncStorage
      ),
      // Only persist what's needed — no function fields
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        permissions: state.permissions,
        permissionsLoaded: state.permissionsLoaded,
        token: state.token,
        loginDate: state.loginDate,
        sessionId: state.sessionId,
      }),
    }
  )
);
