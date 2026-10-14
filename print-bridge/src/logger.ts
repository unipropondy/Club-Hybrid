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
const logFile = path.join(logDir, 'app.log');
const backendLogFile = path.join(logDir, 'backend.log');
const frontendLogFile = path.join(logDir, 'frontend.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function append(target: string, msg: string) {
  try {
    fs.appendFileSync(target, msg + '\n');
  } catch (_) {}
}

export const logger = {
  info(message: string) {
    const log = `[INFO] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    append(logFile, log);
  },
  error(message: string, error?: any) {
    const errorMsg = error ? ` - Error: ${error.message || error}` : '';
    const log = `[ERROR] [${new Date().toISOString()}] ${message}${errorMsg}`;
    console.error(log);
    append(logFile, log);
  },
  warn(message: string) {
    const log = `[WARN] [${new Date().toISOString()}] ${message}`;
    console.log(log);
    append(logFile, log);
  },
  backend(message: string) {
    const log = `[BACKEND] [${new Date().toISOString()}] ${message}`;
    append(backendLogFile, log);
  },
  frontend(message: string) {
    const log = `[FRONTEND] [${new Date().toISOString()}] ${message}`;
    append(frontendLogFile, log);
  }
};
