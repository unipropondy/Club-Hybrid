/**
 * Secure Configuration & Credential Shield
 * 
 * Protects proprietary Cloud ERP credentials and SMTP email passwords
 * so they are never exposed in plain text inside client .env files or Program Files.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Internal obfuscation key & IV for in-binary credential storage
const CIPHER_KEY = Buffer.from("6f70656e736573616d655f756e6970726f5f706f735f323032362140", "hex"); // 28 bytes padded
const CIPHER_SALT = "unipro_cloud_salt_2026";
const DERIVED_KEY = crypto.scryptSync(CIPHER_KEY, CIPHER_SALT, 32);
const IV = Buffer.from("a1b2c3d4e5f60718293a4b5c", "hex"); // 12 bytes for aes-256-gcm

// Pre-encrypted proprietary credentials (Cloud ERP + SMTP mailer)
const ENCRYPTED_VAULT = {
  authTag: "49b2e73b49c8a99c59d36ed8c0c38125",
  data: "e7ee5586dbf4697b37ede870ae55598d179a23b0a45ccf1e08b6e1dbfe5b5985fe5f3cdb0bf34294fcfd598514db6293b288af4597e6f3e06f3bb218a9a21ba468afd18421c42422d1a0e1dfde84b98ce49dab937759b94c22df42e3cbc96eada50cd7d77b4a610c7f7b77c41c5b6f4db857aa6ea1f82fb7469b8369ccc7eaf023b4f5793fbdedb05526f9cc824ff683eaf8d2c7c9ac2eb5fe1d8539656e4adc1338622f51a47c2a28dea090c2f34b565bd60ef77b98fdd17d698c9a78be5a45cf646d53b84e846b9be8dac151470d43bb716c557b1a4499c6b3886d3f644e442a4f25d9580934db79ca5d5e5fe8dc18c54ab73a3013"
};

function decryptVault() {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", DERIVED_KEY, IV);
    decipher.setAuthTag(Buffer.from(ENCRYPTED_VAULT.authTag, "hex"));
    let decrypted = decipher.update(ENCRYPTED_VAULT.data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    console.error(`⚠️ [Security] Failed to decrypt secure credential vault: ${err.message}`);
    return {};
  }
}

/**
 * Returns the resolved path to the user's editable local .env file.
 * In production desktop mode: %APPDATA%\unipro-pos-counter\.env
 * In local dev mode: <backendDir>/.env
 */
function resolveEnvFilePath() {
  const isDev = process.env.NODE_ENV === "development" || !process.env.APPDATA;
  if (isDev && fs.existsSync(path.resolve(__dirname, "../.env"))) {
    return path.resolve(__dirname, "../.env");
  }

  const appDataDir = process.env.APPDATA 
    ? path.join(process.env.APPDATA, "unipro-pos-counter") 
    : path.resolve(__dirname, "..");

  if (!fs.existsSync(appDataDir)) {
    try {
      fs.mkdirSync(appDataDir, { recursive: true });
    } catch (_) {}
  }

  return path.join(appDataDir, ".env");
}

/**
 * Ensures a safe local .env template exists without exposing any cloud/email credentials.
 */
function ensureSafeLocalEnv(targetPath) {
  if (fs.existsSync(targetPath)) return;

  const defaultContent = `# --- Smart-Club POS UniPro: Local Terminal Configuration ---
# You can edit Local Database settings here. Cloud ERP synchronization
# is managed automatically by UniPro.

# 1. Local Database (Counter PC / Server)
LOCAL_DB_SERVER=localhost\\ups
LOCAL_DB_PORT=1433
LOCAL_DB_NAME=UCSCLUB
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=Unipro@2026

# 2. Terminal Station Identifier
STATION_PREFIX=POS
PORT=5000
`;

  try {
    fs.writeFileSync(targetPath, defaultContent, "utf8");
    console.log(`🔒 [Security] Created clean Local DB configuration at: ${targetPath}`);
  } catch (err) {
    console.warn(`⚠️ [Security] Could not create local .env: ${err.message}`);
  }
}

/**
 * Loads configuration:
 * 1. Loads local user settings (LOCAL_DB_*) from target .env
 * 2. Injects protected Cloud & Email credentials directly into process.env in memory
 */
function initSecureConfig() {
  const envPath = resolveEnvFilePath();
  ensureSafeLocalEnv(envPath);

  // 1. Load local .env (only contains Local DB settings)
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }

  // 2. Ensure JWT_SECRET exists in memory
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "12824f4c4e78d18659d888d5a150c701a0b8b8101591ce1ad9ed7c9f6108c032";
  }

  // 3. Inject Cloud ERP credentials into memory (never saved to plain text .env)
  const vault = decryptVault();
  for (const [key, val] of Object.entries(vault)) {
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }

  console.log(`🛡️ [Security] Cloud ERP credentials & SMTP keys securely loaded into memory.`);
  console.log(`📁 [Config] Local database configuration loaded from: ${envPath}`);
  return { envPath };
}

module.exports = {
  initSecureConfig,
  resolveEnvFilePath,
  decryptVault
};
