const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set!");
}
const bcrypt = require("bcryptjs");

/* ================= AUTH - LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, message: "Database connection busy or unavailable." });
    }
    const { userName: rawUserName, password: rawPassword, sessionId: clientSessionId } = req.body;
    const userName = (rawUserName || "").trim();
    const password = (rawPassword || "").trim();

    if (!userName || !password) {
      return res.status(400).json({ success: false, message: "User ID and Password are required." });
    }

    console.log(`[AUTH] Attempting login for UserName: "${userName}"`);

    const result = await pool.request()
      .input("UserName", userName)
      .query(`
        SELECT 
          u.UserId, u.UserCode, u.UserName, u.UserPassword, u.FullName,
          u.FirstName, u.LastName, u.IsDisabled, u.UserGroupid,
          u.IsLoggedIn, u.LastHeartbeat, u.ActiveSessionId,
          ISNULL(u.AllowedLogins, 1) AS AllowedLogins,
          DATEDIFF(SECOND, u.LastHeartbeat, GETDATE()) AS HeartbeatAgeSeconds,
          g.UserGroupCode AS RoleCode, g.UserGroupName AS RoleName,
          g.isActive AS IsGroupActive
        FROM [dbo].[UserMaster] u
        LEFT JOIN [dbo].[UserGroupMaster] g ON u.UserGroupid = g.UserGroupId
        WHERE u.UserName = @UserName
      `);

    if (result.recordset.length === 0) {
      console.log(`[AUTH] Login failed: UserName "${userName}" not found.`);
      return res.status(401).json({ success: false, message: "Invalid User ID or Password." });
    }

    const user = result.recordset[0];

    // ✅ VALIDATE USER STATUS
    if (user.IsDisabled === true || user.IsDisabled === 1) {
      console.log(`[AUTH] Login failed: Account disabled for user "${user.UserName}".`);
      return res.status(403).json({ success: false, message: "Your account is disabled." });
    }

    // ✅ VALIDATE USER GROUP (STRICT CHECK)
    if (!user.UserGroupid || !user.RoleCode) {
      console.log(`[AUTH] Login failed: No valid group assigned to user "${user.UserName}".`);
      return res.status(403).json({ success: false, message: "User has no valid group assigned." });
    }

    if (user.IsGroupActive === false || user.IsGroupActive === 0) {
      console.log(`[AUTH] Login failed: User group is inactive for user "${user.UserName}".`);
      return res.status(403).json({ success: false, message: "Your user group is currently inactive." });
    }

    const dbPassword = (user.UserPassword || "").trim();
    let isValid = false;
    let needsRehash = false;

    // 1. Try bcrypt check
    try {
      if (dbPassword.startsWith("$2a$") || dbPassword.startsWith("$2b$")) {
        isValid = await bcrypt.compare(password, dbPassword);
      }
    } catch (e) {
      console.error("Bcrypt compare error:", e);
    }

    // 2. Legacy check fallback
    if (!isValid) {
      const parts = dbPassword.split("-");
      const candidates = [dbPassword, parts[0]].filter(c => c.length > 0);

      for (const cand of candidates) {
        if (cand === password) { isValid = true; needsRehash = true; break; }
        try {
          const decoded = Buffer.from(cand, "base64").toString("utf-8").trim();
          if (decoded === password) { isValid = true; needsRehash = true; break; }
        } catch (e) {}
      }
    }

    if (!isValid) {
      console.log(`[AUTH] Login failed: Password mismatch for user "${user.UserName}".`);
      return res.status(401).json({ success: false, message: "Invalid User ID or Password." });
    }


    // 3. CHECK ACTIVE SESSIONS CONCURRENCY LOCK (Supports AllowedLogins = 1, 2, 3...)
    const allowedLogins = user.AllowedLogins !== undefined && user.AllowedLogins !== null ? Number(user.AllowedLogins) : 1;
    const isUnlimited = allowedLogins === 0 || allowedLogins >= 999;
    const clientSession = clientSessionId ? String(clientSessionId).trim() : null;

    if (!isUnlimited) {
      // 3a. Clean up expired sessions (> 300s / 5 mins since last heartbeat)
      await pool.request()
        .input("UserId", String(user.UserId))
        .query(`
          DELETE FROM [dbo].[UserSessions]
          WHERE UserId = @UserId AND DATEDIFF(SECOND, LastHeartbeat, GETDATE()) > 300
        `);

      // 3b. Query active sessions for this user
      const sessionsResult = await pool.request()
        .input("UserId", String(user.UserId))
        .query(`
          SELECT SessionId, DATEDIFF(SECOND, LastHeartbeat, GETDATE()) AS AgeSec
          FROM [dbo].[UserSessions]
          WHERE UserId = @UserId AND DATEDIFF(SECOND, LastHeartbeat, GETDATE()) <= 300
        `);

      const activeSessions = sessionsResult.recordset || [];
      const isAlreadyActiveOnThisDevice = clientSession && activeSessions.some(s => s.SessionId === clientSession);

      // Block only if active sessions reached the limit AND this device is not already one of the active sessions
      if (!isAlreadyActiveOnThisDevice && activeSessions.length >= allowedLogins) {
        const oldestSec = activeSessions.length > 0 ? Math.max(...activeSessions.map(s => s.AgeSec || 0)) : 0;
        const remainingMinutes = Math.min(5, Math.max(1, Math.ceil((300 - oldestSec) / 60)));

        console.log(`[AUTH] Login blocked: User "${user.UserName}" reached limit (${activeSessions.length}/${allowedLogins} devices).`);
        return res.status(409).json({
          success: false,
          isLocked: true,
          message: `User '${user.UserName}' has reached the maximum allowed concurrent logins (${allowedLogins} device${allowedLogins > 1 ? "s" : ""}). Please log out from another device, or wait ${remainingMinutes} minute(s).`
        });
      }
    }

    const newSessionId = clientSession || crypto.randomUUID();

    // 4. Save Session into UserSessions
    await pool.request()
      .input("SessionId", newSessionId)
      .input("UserId", String(user.UserId))
      .input("IpAddress", req.ip || "")
      .query(`
        IF EXISTS (SELECT 1 FROM [dbo].[UserSessions] WHERE SessionId = @SessionId)
        BEGIN
          UPDATE [dbo].[UserSessions] SET LastHeartbeat = GETDATE() WHERE SessionId = @SessionId
        END
        ELSE
        BEGIN
          INSERT INTO [dbo].[UserSessions] (SessionId, UserId, IpAddress, CreatedAt, LastHeartbeat)
          VALUES (@SessionId, @UserId, @IpAddress, GETDATE(), GETDATE())
        END
      `);

    // Update UserMaster
    await pool.request()
      .input("UserId", user.UserId)
      .input("SessionId", newSessionId)
      .query(`
        UPDATE [dbo].[UserMaster] 
        SET 
          LastLogInDate = GETDATE(),
          IsLoggedIn = 1,
          LastHeartbeat = GETDATE(),
          ActiveSessionId = @SessionId
        WHERE UserId = @UserId
      `);

    const finalUserId = String(user.UserId).trim();
    const roleCode = (user.RoleCode || "CASHIER").toUpperCase().trim();

    const token = jwt.sign(
      { userId: finalUserId, userName: user.UserName, role: roleCode, sessionId: newSessionId },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log(`✅ Login Success: ${user.FullName} | Role: ${roleCode} | Session: ${newSessionId} | Device Limit: ${isUnlimited ? "Unlimited" : allowedLogins}`);

    // 2. Return Comprehensive Auth Response
    return res.json({
      success: true,
      token,
      sessionId: newSessionId,
      user: {
        userId: finalUserId,
        id: finalUserId,
        userCode: user.UserCode,
        userName: user.UserName,
        fullName: user.FullName || user.FirstName,
        role: roleCode, // ADMIN, CASHIER, WAITER, etc.
        roleName: user.RoleName,
        userGroupId: user.UserGroupid
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ================= AUTH - HEARTBEAT (EVERY 60s) ================= */
router.post("/heartbeat", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ success: false, message: "Database connection unavailable." });

    const { userId, sessionId } = req.body;
    if (!userId || !sessionId) {
      return res.status(400).json({ success: false, message: "Missing userId or sessionId." });
    }

    // 1. Update UserSessions
    const sessionRes = await pool.request()
      .input("UserId", String(userId))
      .input("SessionId", String(sessionId))
      .query(`
        UPDATE [dbo].[UserSessions]
        SET LastHeartbeat = GETDATE()
        WHERE UserId = @UserId AND SessionId = @SessionId;
        SELECT @@ROWCOUNT as rowsAffected;
      `);

    const updatedRows = sessionRes.recordset[0]?.rowsAffected || 0;
    if (updatedRows === 0) {
      // Check if session exists at all or was force-unlocked/revoked
      return res.status(401).json({ success: false, sessionRevoked: true, message: "Session is no longer active." });
    }

    // 2. Also touch UserMaster LastHeartbeat
    await pool.request()
      .input("UserId", userId)
      .query(`
        UPDATE [dbo].[UserMaster]
        SET LastHeartbeat = GETDATE(), IsLoggedIn = 1
        WHERE UserId = @UserId
      `);

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[AUTH] Heartbeat error:", err.message);
    res.status(500).json({ success: false, message: "Heartbeat failed." });
  }
});

/* ================= AUTH - LOGOUT ================= */
router.post("/logout", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ success: false, message: "Database connection unavailable." });

    const { userId, sessionId } = req.body;
    if (userId) {
      // 1. Remove this specific session
      if (sessionId) {
        await pool.request()
          .input("UserId", String(userId))
          .input("SessionId", String(sessionId))
          .query(`DELETE FROM [dbo].[UserSessions] WHERE UserId = @UserId AND SessionId = @SessionId`);
      }

      // 2. Check how many active sessions remain for this user
      const remaining = await pool.request()
        .input("UserId", String(userId))
        .query(`
          SELECT COUNT(*) as count FROM [dbo].[UserSessions]
          WHERE UserId = @UserId AND DATEDIFF(SECOND, LastHeartbeat, GETDATE()) <= 300
        `);

      const remainingCount = remaining.recordset[0]?.count || 0;
      if (remainingCount === 0) {
        await pool.request()
          .input("UserId", userId)
          .query(`UPDATE [dbo].[UserMaster] SET IsLoggedIn = 0, ActiveSessionId = NULL, LastHeartbeat = NULL WHERE UserId = @UserId`);
      }
      console.log(`[AUTH] User ${userId} logged out (session: ${sessionId || "any"}). Remaining active devices: ${remainingCount}`);
    }

    return res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("[AUTH] Logout error:", err.message);
    res.status(500).json({ success: false, message: "Logout failed." });
  }
});

/* ================= AUTH - FORCE UNLOCK (MANAGER / ADMIN OVERRIDE) ================= */
router.post("/force-unlock", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ success: false, message: "Database connection unavailable." });

    const { userName, userId } = req.body;
    if (!userName && !userId) {
      return res.status(400).json({ success: false, message: "Provide userName or userId to unlock." });
    }

    const request = pool.request();
    if (userId) {
      request.input("UserId", String(userId));
      await request.query(`
        DELETE FROM [dbo].[UserSessions] WHERE UserId = @UserId;
        UPDATE [dbo].[UserMaster] SET IsLoggedIn = 0, ActiveSessionId = NULL, LastHeartbeat = NULL WHERE UserId = @UserId;
      `);
    } else {
      request.input("UserName", userName);
      await request.query(`
        DELETE FROM [dbo].[UserSessions] WHERE UserId IN (SELECT CAST(UserId AS VARCHAR(100)) FROM [dbo].[UserMaster] WHERE UserCode = @UserName OR UserName = @UserName);
        UPDATE [dbo].[UserMaster] SET IsLoggedIn = 0, ActiveSessionId = NULL, LastHeartbeat = NULL WHERE UserCode = @UserName OR UserName = @UserName;
      `);
    }

    console.log(`[AUTH] User ${userName || userId} force-unlocked.`);
    return res.json({ success: true, message: "User session unlocked successfully." });
  } catch (err) {
    console.error("[AUTH] Force unlock error:", err.message);
    res.status(500).json({ success: false, message: "Force unlock failed." });
  }
});

/* ================= AUTH - VERIFY PASSWORD (ROLE-BASED) ================= */
router.post("/verify", async (req, res) => {
  try {
    const { password, role } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: "Missing password" });
    }

    const pool = await poolPromise;
    const base64Password = Buffer.from(password).toString("base64");

    let query = `
      SELECT u.UserId, u.UserPassword, u.UserName 
      FROM [dbo].[UserMaster] u
      INNER JOIN [dbo].[UserGroupMaster] g ON u.UserGroupid = g.UserGroupId
      WHERE (u.IsDisabled IS NULL OR u.IsDisabled = 0)
        AND g.isActive = 1
    `;

    const request = pool.request();

    if (role) {
      let roleList = [];
      if (Array.isArray(role)) {
        roleList = role.map(r => String(r).toUpperCase().trim());
      } else if (typeof role === 'string') {
        roleList = role.split(',').map(r => r.toUpperCase().trim());
      }

      if (roleList.length > 0) {
        const conditions = [];
        roleList.forEach((r, idx) => {
          const paramName = `role_${idx}`;
          request.input(paramName, sql.VarChar, r);
          conditions.push(`UPPER(g.UserGroupCode) = @${paramName} OR UPPER(g.UserGroupName) = @${paramName}`);
        });
        query += ` AND (${conditions.join(' OR ')})`;
      }
    }

    const result = await request.query(query);

    let isValid = false;
    let matchedUser = null;
    let needsRehash = false;

    for (const u of result.recordset) {
      const dbPassword = (u.UserPassword || "").trim();
      
      // Try bcrypt check
      if (dbPassword.startsWith("$2a$") || dbPassword.startsWith("$2b$")) {
        try {
          if (await bcrypt.compare(password, dbPassword)) {
            isValid = true;
            matchedUser = u;
            break;
          }
        } catch (e) {}
      } else {
        // Try legacy check
        const parts = dbPassword.split("-");
        const candidates = [dbPassword, parts[0]].filter(c => c.length > 0);

        for (const cand of candidates) {
          if (cand === password || Buffer.from(cand, "base64").toString("utf-8").trim() === password) {
            isValid = true;
            matchedUser = u;
            needsRehash = true;
            break;
          }
        }
        if (isValid) break;
      }
    }


    return res.json({ success: isValid });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// 🚀 PERMISSIONS CACHE (5-minute TTL)
const permissionCache = new Map();
const PERM_CACHE_TTL = 5 * 60 * 1000;

/* ================= AUTH - PERMISSIONS ================= */
router.get("/permissions/:userGroupCode", async (req, res) => {
  try {
    const { userGroupCode } = req.params;
    const cacheKey = (userGroupCode || "").trim().toUpperCase();

    if (!cacheKey) {
      return res.status(400).json({ error: "Invalid user group code" });
    }

    // Check memory cache
    const cached = permissionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < PERM_CACHE_TTL)) {
      console.log(`⚡ [Permissions Cache] Hit for group: ${cacheKey}`);
      return res.json(cached.data);
    }

    console.log(`🔎 [Permissions Cache] Miss for group: ${cacheKey}. Fetching from DB...`);
    const pool = await poolPromise;
    const result = await pool.request()
      .input("UserGroupCode", cacheKey)
      .query(`
        SELECT 
          LTRIM(RTRIM(FormCode)) AS FormCode,
          LTRIM(RTRIM(AllowAdd))    AS AllowAdd,
          LTRIM(RTRIM(AllowUpdate)) AS AllowUpdate,
          LTRIM(RTRIM(AllowDelete)) AS AllowDelete,
          LTRIM(RTRIM(AllowRead))   AS AllowRead
        FROM [dbo].[UserPermission]
        WHERE UserGroupCode = @UserGroupCode
      `);

    const permMap = {};
    for (const row of result.recordset) {
      if (row.FormCode) {
        permMap[row.FormCode] = {
          canAdd:    row.AllowAdd    === "A",
          canUpdate: row.AllowUpdate === "U",
          canDelete: row.AllowDelete === "D",
          canRead:   row.AllowRead   === "R",
        };
      }
    }

    // Save to cache
    permissionCache.set(cacheKey, {
      data: permMap,
      timestamp: Date.now()
    });

    res.json(permMap);
  } catch (err) {
    console.error("PERMISSIONS FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= AUTH - LICENSE DETAILS ================= */
router.get("/license/:userId", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { userId } = req.params;
    const result = await pool.request()
      .input("UserId", userId)
      .query(`
        SELECT 
          (SELECT TOP 1 CompanyName FROM CompanySettings) AS CompanyName,
          (SELECT TOP 1 Address FROM CompanySettings) AS Address,
          (SELECT TOP 1 CompanyLogoUrl FROM CompanySettings) AS CompanyLogoUrl,
          FromDate,
          ToDate
        FROM [dbo].[UserMaster]
        WHERE CAST(UserId AS NVARCHAR(100)) = CAST(@UserId AS NVARCHAR(100))
      `);
    if (result.recordset.length > 0) {
      res.json({ success: true, license: result.recordset[0] });
    } else {
      const compRes = await pool.request().query("SELECT TOP 1 CompanyName, Address, CompanyLogoUrl FROM CompanySettings");
      const comp = compRes.recordset[0] || {};
      res.json({
        success: true,
        license: {
          CompanyName: comp.CompanyName || "Smart POS",
          Address: comp.Address || "",
          CompanyLogoUrl: comp.CompanyLogoUrl || "",
          FromDate: null,
          ToDate: null
        }
      });
    }
  } catch (err) {
    console.error("LICENSE FETCH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
