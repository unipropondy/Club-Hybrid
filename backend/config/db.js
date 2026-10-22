const { initSecureConfig } = require("./secureConfig");
initSecureConfig();
const sql = require("mssql");

function buildConfig({ server, port, database, user, password }, useInstance = true) {
  if (!server) return null;

  let serverName = server.trim();
  let instanceName = undefined;

  if (serverName.includes("\\") || serverName.includes("/")) {
    const parts = serverName.split(/[\\/]+/).filter(Boolean);
    serverName = parts[0] || "localhost";
    instanceName = parts[1];
  }

  if (serverName === "." || serverName === "(local)") {
    serverName = "localhost";
  }

  const configObj = {
    user,
    password,
    server: serverName,
    database,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 5000,
      requestTimeout: 30000,
      appName: "POS_System_Hybrid",
      keepAlive: true,
    },
    connectionTimeout: 5000,
    requestTimeout: 30000,
    pool: {
      max: 100,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (useInstance && instanceName) {
    configObj.options.instanceName = instanceName;
  } else if (port) {
    configObj.port = parseInt(port);
  }

  return configObj;
}

let activeConfig = null;
let activePoolInstance = null;

async function connectWithFallback() {
  const localServerRaw = process.env.LOCAL_DB_SERVER || "localhost\\ups";
  const localUser = process.env.LOCAL_DB_USER || "sa";
  const localPass = process.env.LOCAL_DB_PASSWORD || "Unipro@2026";
  const localDb = process.env.LOCAL_DB_NAME || "UCSCLUB";
  const localPort = process.env.LOCAL_DB_PORT || "1433";

  // Strategy 1: Named Instance (localhost\ups)
  const localConfigInstance = buildConfig({
    server: localServerRaw,
    port: localPort,
    database: localDb,
    user: localUser,
    password: localPass,
  }, true);

  // Strategy 2: Direct TCP IP fallback (127.0.0.1:1433)
  const localConfigDirect = buildConfig({
    server: "127.0.0.1",
    port: localPort,
    database: localDb,
    user: localUser,
    password: localPass,
  }, false);

  const remoteConfig = buildConfig({
    server: process.env.REMOTE_DB_SERVER || process.env.DB_SERVER,
    port: process.env.REMOTE_DB_PORT || process.env.DB_PORT,
    database: process.env.REMOTE_DB_NAME || process.env.DB_NAME,
    user: process.env.REMOTE_DB_USER || process.env.DB_USER,
    password: process.env.REMOTE_DB_PASSWORD || process.env.DB_PASSWORD,
  }, false);

  // 1. Attempt Local Database Connection (Instance Strategy)
  if (localConfigInstance) {
    console.log(`🔍 [Database Check] Attempting connection to LOCAL database (${localServerRaw})...`);
    try {
      const localPool = new sql.ConnectionPool(localConfigInstance);
      await localPool.connect();
      console.log(`✅ [Local DB] Connected to Local MSSQL Instance (${localServerRaw}/${localDb}) Successfully!`);
      localPool.on("error", (err) => console.error("⚠️ [Local DB Pool Error]:", err.message));
      activePoolInstance = localPool;
      activeConfig = localConfigInstance;
      return localPool;
    } catch (localErr) {
      console.warn(`⚠️ [Local DB Connection Warning]: ${localErr.message}`);
    }
  }

  // 1b. Attempt Local Direct TCP fallback (127.0.0.1:1433)
  if (localConfigDirect) {
    try {
      const localPool = new sql.ConnectionPool(localConfigDirect);
      await localPool.connect();
      console.log(`✅ [Local DB] Connected to Local MSSQL Direct TCP (127.0.0.1:${localPort}/${localDb}) Successfully!`);
      localPool.on("error", (err) => console.error("⚠️ [Local DB Pool Error]:", err.message));
      activePoolInstance = localPool;
      activeConfig = localConfigDirect;
      return localPool;
    } catch (directErr) {
      console.warn(`⚠️ [Local Direct TCP Failed]: ${directErr.message}`);
      console.warn(`🌐 Falling back to Remote Cloud Database...`);
    }
  }

  // 2. Fallback to Remote Cloud Database
  if (remoteConfig) {
    const remoteServerStr = `${remoteConfig.server}:${remoteConfig.port || 1433}`;
    console.log(`🔍 [Database Check] Attempting connection to REMOTE cloud database (${remoteServerStr})...`);
    try {
      const remotePool = new sql.ConnectionPool(remoteConfig);
      await remotePool.connect();
      console.log(`✅ [Remote DB] Connected to Remote MSSQL (${remoteServerStr}/${remoteConfig.database}) Successfully!`);
      remotePool.on("error", (err) => console.error("⚠️ [Remote DB Pool Error]:", err.message));
      activePoolInstance = remotePool;
      activeConfig = remoteConfig;
      return remotePool;
    } catch (remoteErr) {
      console.error(`❌ [Remote DB Connection Failed]: ${remoteErr.message}`);
    }
  }

  console.error("❌ CRITICAL: Could not connect to either Local or Remote MSSQL Database!");
  return null;
}

const poolPromise = connectWithFallback();

module.exports = {
  sql,
  poolPromise,
  get dbConfig() {
    return activeConfig || localConfigInstance || remoteConfig;
  },
  getPool: () => activePoolInstance,
};
