import { executeQuery, executeTransaction } from './database';

function decodeBase64(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch (_) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString('utf-8');
    }
  } catch (_) {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function encodeBase64(str: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(str);
    }
  } catch (_) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
  } catch (_) {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let block = 0, charCode, idx = 0, map = chars;
       str.charAt(idx | 0) || (map = '=', idx % 1);
       output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
    charCode = str.charCodeAt(idx += 3/4);
    block = block << 8 | charCode;
  }
  return output;
}

export function verifyPasswordMatch(enteredPassword: string, dbPassword: string): boolean {
  if (!enteredPassword || !dbPassword) return false;
  const p = enteredPassword.trim();
  const db = dbPassword.trim();

  // 1. Direct match (plain text or already verified cache)
  if (p === db) return true;

  // 2. Base64 encode candidate against dbPassword
  if (encodeBase64(p) === db) return true;

  // 3. Base64 decode dbPassword against candidate
  try {
    if (decodeBase64(db) === p) return true;
  } catch (_) {}

  // 4. Split by '-' for legacy multi-part passwords
  if (db.includes('-')) {
    const parts = db.split('-');
    for (const part of parts) {
      const cleanPart = part.trim();
      if (!cleanPart) continue;
      if (cleanPart === p) return true;
      if (encodeBase64(p) === cleanPart) return true;
      try {
        if (decodeBase64(cleanPart) === p) return true;
      } catch (_) {}
    }
  }

  return false;
}

export class UserRepository {
  /**
   * Save or update users in local SQLite cache.
   */
  static async saveUsers(users: any[]): Promise<void> {
    if (!Array.isArray(users) || users.length === 0) return;

    const now = new Date().toISOString();
    const statements = users.map((u) => {
      const userId = String(u.user_id || u.userId || u.id || '').trim();
      const userName = String(u.user_name || u.userName || '').trim();
      const userCode = String(u.user_code || u.userCode || '').trim();
      const userPassword = String(u.user_password || u.userPassword || u.password || '').trim();
      const fullName = String(u.full_name || u.fullName || u.firstName || userName).trim();
      const role = String(u.role || u.RoleCode || 'CASHIER').toUpperCase().trim();
      const roleName = String(u.role_name || u.roleName || u.RoleName || role).trim();
      const userGroupId = String(u.user_group_id || u.userGroupId || u.UserGroupid || '').trim();
      const isDisabled = u.is_disabled === 1 || u.is_disabled === true || u.IsDisabled === 1 || u.IsDisabled === true ? 1 : 0;

      return {
        sql: `INSERT OR REPLACE INTO users_cache (
          user_id, user_code, user_name, user_password, full_name, role, role_name, user_group_id, is_disabled, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          userId,
          userCode,
          userName,
          userPassword,
          fullName,
          role,
          roleName,
          userGroupId,
          isDisabled,
          now,
        ],
      };
    }).filter(s => s.params[0] && s.params[2]); // Must have user_id and user_name

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[UserRepository] Cached ${statements.length} users in local SQLite database.`);
    }
  }

  /**
   * Save or update user group permissions in local SQLite cache.
   */
  static async savePermissions(permissions: any[]): Promise<void> {
    if (!Array.isArray(permissions) || permissions.length === 0) return;

    const now = new Date().toISOString();
    const statements = permissions.map((p) => {
      const role = String(p.role || p.UserGroupCode || '').toUpperCase().trim();
      const formCode = String(p.form_code || p.FormCode || '').toUpperCase().trim();
      const userGroupId = String(p.user_group_id || p.userGroupId || '').trim();
      const canAdd = p.can_add === 1 || p.can_add === true || p.AllowAdd === 'A' ? 1 : 0;
      const canUpdate = p.can_update === 1 || p.can_update === true || p.AllowUpdate === 'U' ? 1 : 0;
      const canDelete = p.can_delete === 1 || p.can_delete === true || p.AllowDelete === 'D' ? 1 : 0;
      const canRead = p.can_read === 1 || p.can_read === true || p.AllowRead === 'R' ? 1 : 0;
      const id = `${role}_${formCode}`;

      return {
        sql: `INSERT OR REPLACE INTO user_permissions_cache (
          id, form_code, role, user_group_id, can_add, can_update, can_delete, can_read, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          formCode,
          role,
          userGroupId,
          canAdd,
          canUpdate,
          canDelete,
          canRead,
          now,
        ],
      };
    }).filter(s => s.params[1] && s.params[2]); // Must have form_code and role

    if (statements.length > 0) {
      await executeTransaction(statements);
      console.log(`[UserRepository] Cached ${statements.length} user permissions in local SQLite database.`);
    }
  }

  /**
   * Retrieve cached permissions for a given role / user group.
   */
  static async getPermissionsByRole(role: string): Promise<Record<string, { canAdd: boolean; canUpdate: boolean; canDelete: boolean; canRead: boolean }>> {
    const cleanRole = (role || '').trim().toUpperCase();
    const rows = await executeQuery(`SELECT * FROM user_permissions_cache WHERE UPPER(role) = ?`, [cleanRole]);
    const permMap: Record<string, { canAdd: boolean; canUpdate: boolean; canDelete: boolean; canRead: boolean }> = {};
    for (const row of rows) {
      if (row.form_code) {
        permMap[row.form_code.trim()] = {
          canAdd: row.can_add === 1 || row.can_add === true,
          canUpdate: row.can_update === 1 || row.can_update === true,
          canDelete: row.can_delete === 1 || row.can_delete === true,
          canRead: row.can_read === 1 || row.can_read === true,
        };
      }
    }
    return permMap;
  }

  /**
   * Authenticate user offline using cached UserMaster & UserGroupMaster data.
   */
  static async authenticateOffline(rawUserName: string, rawPassword: string): Promise<{
    success: boolean;
    message?: string;
    isOffline?: boolean;
    token?: string;
    user?: any;
    permissions?: any;
  }> {
    const userName = (rawUserName || '').trim();
    const password = (rawPassword || '').trim();

    if (!userName || !password) {
      return { success: false, message: 'User ID and Password are required.' };
    }

    try {
      const rows = await executeQuery(
        `SELECT * FROM users_cache WHERE LOWER(user_name) = LOWER(?)`,
        [userName]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: 'Offline user not found. Please connect to Wi-Fi/Server to sync credentials first.',
        };
      }

      const userRow = rows[0];

      if (userRow.is_disabled === 1 || userRow.is_disabled === true) {
        return { success: false, message: 'Your account is disabled.' };
      }

      const isMatch = verifyPasswordMatch(password, userRow.user_password || '');
      if (!isMatch) {
        return { success: false, message: 'Invalid User ID or Password.' };
      }

      const role = (userRow.role || 'CASHIER').toUpperCase().trim();
      const permissions = await this.getPermissionsByRole(role);

      return {
        success: true,
        isOffline: true,
        token: `offline_token_${userRow.user_id}_${Date.now()}`,
        user: {
          userId: userRow.user_id,
          id: userRow.user_id,
          userCode: userRow.user_code || '',
          userName: userRow.user_name,
          fullName: userRow.full_name || userRow.user_name,
          role: role as any,
          roleName: userRow.role_name || role,
          userGroupId: userRow.user_group_id || '',
        },
        permissions,
      };
    } catch (err: any) {
      console.error('[UserRepository] authenticateOffline error:', err);
      return { success: false, message: `Offline auth failed: ${err.message}` };
    }
  }

  /**
   * Get all cached users (e.g. for user list or debugging).
   */
  static async getAllCachedUsers(): Promise<any[]> {
    return await executeQuery(`SELECT user_id, user_code, user_name, full_name, role, role_name, user_group_id, is_disabled FROM users_cache WHERE is_disabled = 0`);
  }
}
