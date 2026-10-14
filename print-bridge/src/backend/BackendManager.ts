import { ChildProcess, spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { app as electronApp } from 'electron';
import { logger } from '../logger';

let backendProcess: ChildProcess | null = null;
let isStopping = false;

/**
 * Checks if the backend HTTP server is responding on port 5000.
 */
export function checkBackendAlive(port = 5000, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Resolves the absolute path to the backend directory containing server.js.
 */
export function getBackendDir(): string {
  const candidates = [
    // Packaged installer extraResources location
    path.join(process.resourcesPath || '', 'backend'),
    path.join(electronApp.getAppPath(), 'backend'),
    // Development / project root paths
    path.resolve(__dirname, '../../../backend'),
    path.resolve(__dirname, '../../backend'),
    path.resolve(process.cwd(), '../backend'),
    path.resolve(process.cwd(), 'backend'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, 'server.js'))) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), '../backend');
}

/**
 * Resolves the Node.js executable to use.
 */
export function getNodeExecutable(): { executable: string; useElectronAsNode: boolean } {
  const candidates = [
    // 1. Packaged bin/node.exe in extraResources
    path.join(process.resourcesPath || '', 'bin', 'node.exe'),
    path.join(process.resourcesPath || '', 'backend', 'bin', 'node.exe'),
    // 2. Development print-bridge/bin/node.exe
    path.resolve(__dirname, '../../bin/node.exe'),
    path.resolve(__dirname, '../bin/node.exe'),
    path.resolve(process.cwd(), 'bin/node.exe'),
    // 3. System installed node
    'C:\\Program Files\\nodejs\\node.exe',
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { executable: candidate, useElectronAsNode: false };
    }
  }

  // 4. Try system PATH node
  try {
    const whereOutput = execSync('where.exe node', { stdio: 'pipe' }).toString().trim().split('\r\n')[0];
    if (whereOutput && fs.existsSync(whereOutput)) {
      return { executable: whereOutput, useElectronAsNode: false };
    }
  } catch (_) {}

  // 5. Fallback: Electron's own runtime with ELECTRON_RUN_AS_NODE=1
  return { executable: process.execPath, useElectronAsNode: true };
}

/**
 * Starts the embedded Node.js backend server in the background.
 */
export async function startBackendProcess(): Promise<void> {
  const isAlreadyRunning = await checkBackendAlive(5000, 1000);
  if (isAlreadyRunning) {
    logger.info('[BackendManager] Backend server is already running on port 5000. Skipping spawn.');
    return;
  }

  const backendDir = getBackendDir();
  const serverScript = path.join(backendDir, 'server.js');

  if (!fs.existsSync(serverScript)) {
    logger.error(`[BackendManager] Cannot find server.js at: ${serverScript}`);
    return;
  }

  const { executable: nodePath, useElectronAsNode } = getNodeExecutable();
  logger.info(`[BackendManager] Starting backend: ${nodePath} ${serverScript} (cwd: ${backendDir})`);

  const env = {
    ...process.env,
    PORT: '5000',
    ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
  };

  try {
    backendProcess = spawn(nodePath, [serverScript], {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    if (backendProcess.pid) {
      logger.info(`[BackendManager] Backend spawned with PID: ${backendProcess.pid}`);
    }

    backendProcess.stdout?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        logger.backend(msg);
        logger.info(`[Backend] ${msg}`);
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        logger.backend(`[ERROR] ${msg}`);
        logger.warn(`[Backend Error] ${msg}`);
      }
    });

    backendProcess.on('error', (err) => {
      logger.error(`[BackendManager] Backend process error: ${err.message}`);
    });

    backendProcess.on('exit', (code, signal) => {
      logger.info(`[BackendManager] Backend exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });

    // Wait for backend to be responsive (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 500));
      if (await checkBackendAlive(5000, 500)) {
        logger.info(`[BackendManager] Backend server successfully responded on port 5000 after ${(i + 1) * 0.5}s.`);
        break;
      }
    }
  } catch (err: any) {
    logger.error(`[BackendManager] Failed to launch backend: ${err.message}`);
  }
}

/**
 * Stops the backend process cleanly on app exit.
 */
export function stopBackendProcess(): void {
  if (isStopping) return;
  isStopping = true;

  if (backendProcess && backendProcess.pid) {
    const pid = backendProcess.pid;
    logger.info(`[BackendManager] Terminating backend process tree (PID: ${pid})...`);
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        backendProcess.kill('SIGKILL');
      }
      logger.info(`[BackendManager] Successfully terminated backend process tree.`);
    } catch (err: any) {
      logger.warn(`[BackendManager] Error terminating backend process: ${err.message}`);
      try {
        backendProcess.kill();
      } catch (_) {}
    }
    backendProcess = null;
  }
}
