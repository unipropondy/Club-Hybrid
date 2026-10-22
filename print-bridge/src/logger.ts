import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let userDataPath = '';
try {
  if (app) {
    userDataPath = app.getPath('userData');
  }
} catch (e) {
  // app might not be initialized or available in dev/testing contexts
}

if (!userDataPath) {
  userDataPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'unipro-pos-counter')
    : process.cwd();
}

const logDir = path.join(userDataPath, 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Returns current date in YYYY-MM-DD format for daily log file partitioning.
 */
function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10 MB maximum per file
const RETENTION_DAYS = 31; // Auto-purge logs older than 31 days

/**
 * Appends a log line to a date-stamped file and maintains a live symlink/copy.
 * Prevents any individual file from ballooning beyond MAX_LOG_FILE_SIZE.
 */
function append(category: 'app' | 'backend' | 'frontend', msg: string) {
  try {
    const today = getTodayString();
    const datedFile = path.join(logDir, `${category}-${today}.log`);
    const liveFile = path.join(logDir, `${category}.log`);

    // Check size limit before appending
    try {
      if (fs.existsSync(datedFile) && fs.statSync(datedFile).size > MAX_LOG_FILE_SIZE) {
        fs.appendFileSync(datedFile, `\n[SYSTEM] Log reached 10MB limit. Further entries truncated for safety.\n`);
        return;
      }
    } catch (_) {}

    const line = msg + '\n';
    fs.appendFileSync(datedFile, line);

    // Also update the live file (used by Settings UI & quick inspection)
    try {
      if (fs.existsSync(liveFile) && fs.statSync(liveFile).size > MAX_LOG_FILE_SIZE) {
        // Keep last 1000 lines if the main live file exceeds 10MB
        const lines = fs.readFileSync(liveFile, 'utf8').split('\n');
        fs.writeFileSync(liveFile, lines.slice(-1000).join('\n') + '\n');
      }
      fs.appendFileSync(liveFile, line);
    } catch (_) {}
  } catch (_) {}
}

/**
 * Scans the logs folder and automatically deletes any log files older than 31 days.
 */
export function purgeOldLogs(retentionDays = RETENTION_DAYS): void {
  try {
    if (!fs.existsSync(logDir)) return;
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(logDir);

    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      // Do not delete primary live pointers (app.log, backend.log, frontend.log)
      if (file === 'app.log' || file === 'backend.log' || file === 'frontend.log') continue;

      const fullPath = path.join(logDir, file);
      try {
        const stats = fs.statSync(fullPath);
        const ageMs = now - stats.mtimeMs;
        if (ageMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          console.log(`[LogJanitor] Auto-deleted expired log (>31 days): ${file}`);
        }
      } catch (_) {}
    }
  } catch (err: any) {
    console.error(`[LogJanitor] Error running log cleanup: ${err.message}`);
  }
}

// Run cleanup immediately at startup, and then once every 24 hours
purgeOldLogs();
setInterval(() => purgeOldLogs(), 24 * 60 * 60 * 1000);

export const logger = {
  info(message: string) {
    const log = `[INFO] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    append('app', log);
  },
  error(message: string, error?: any) {
    const errorMsg = error ? ` - Error: ${error.message || error}` : '';
    const log = `[ERROR] [${new Date().toISOString()}] ${message}${errorMsg}`;
    console.error(log);
    append('app', log);
  },
  warn(message: string) {
    const log = `[WARN] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    append('app', log);
  },
  backend(message: string) {
    const log = `[BACKEND] [${new Date().toISOString()}] ${message}`;
    append('backend', log);
  },
  frontend(message: string) {
    const log = `[FRONTEND] [${new Date().toISOString()}] ${message}`;
    append('frontend', log);
  }
};

