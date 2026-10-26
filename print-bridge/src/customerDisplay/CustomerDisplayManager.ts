import { BrowserWindow } from 'electron';
import * as path from 'path';
import { getSecondaryDisplay } from './MonitorService';
import { logger } from '../logger';
import { config } from '../config';

let displayWindow: BrowserWindow | null = null;

// Paths differ depending on whether we run in development (src/) or production packaged (dist/)
const getUIPath = () => {
  const { app } = require('electron');
  const candidates = [
    path.join(app.getAppPath(), 'customer-display-web', 'index.html'),
    path.join(process.resourcesPath || '', 'customer-display-web', 'index.html'),
    path.join(process.cwd(), 'customer-display-web', 'index.html'),
    path.join(__dirname, '..', '..', 'customer-display-web', 'index.html'),
  ];
  for (const c of candidates) {
    if (require('fs').existsSync(c)) return c;
  }
  return candidates[0];
};

/**
 * Launches the customer display window on the secondary display (if detected).
 */
export function launchCustomerDisplay() {
  const secondary = getSecondaryDisplay();
  if (!secondary) {
    logger.warn('[CustomerDisplay] No secondary monitor found — aborting launch.');
    return;
  }

  if (displayWindow && !displayWindow.isDestroyed()) {
    logger.info('[CustomerDisplay] Window already open.');
    return;
  }

  const { x, y, width, height } = secondary.bounds;
  displayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    title: 'Smart-Club Customer Display',
    resizable: false,
    movable: false,
    alwaysOnTop: false, // Prevents z-order fighting and window lag when switching apps
    focusable: true,    // Allows touch/clicks on customer screen without stealing focus (since shown inactive)
    skipTaskbar: true,  // Hides from Windows taskbar and Alt+Tab switcher
    show: false,        // Smooth reveal without white flash
    backgroundColor: '#0C0A22',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Keeps full 60 FPS when cashier is active on primary screen
    },
  });

  displayWindow.setBounds({ x, y, width, height });

  displayWindow.once('ready-to-show', () => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.showInactive();
      logger.info('[CustomerDisplay] Window displayed smoothly on secondary monitor (inactive mode).');
    }
  });

  const uiPath = getUIPath();
  const exists = require('fs').existsSync(uiPath);
  logger.info(`[CustomerDisplay] Loading UI from: ${uiPath} (File Exists: ${exists})`);

  // Open DevTools automatically for debugging if in development
  if (!require('electron').app.isPackaged) {
    displayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Event Listeners for thorough tracking
  displayWindow.webContents.on('did-start-loading', () => {
    logger.info('[CustomerDisplay Event] did-start-loading');
  });

  displayWindow.webContents.on('did-finish-load', () => {
    logger.info('[CustomerDisplay Event] did-finish-load');
  });

  displayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error(`[CustomerDisplay Event] did-fail-load: code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`);
  });

  displayWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error(`[CustomerDisplay Event] render-process-gone: reason=${details.reason}`);
  });

  displayWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logger.info(`[CustomerDisplay Console] [level=${level}] ${message} (at ${sourceId}:${line})`);
  });

  // Load the standalone Expo route via local Express server to resolve absolute path assets correctly
  // (Omit the .html extension so Expo Router matches the route pathname exactly)
  const url = `http://localhost:${config.port}/customer-display-standalone`;
  logger.info(`[CustomerDisplay] Loading UI from URL: ${url}`);

  displayWindow.loadURL(url)
    .then(() => {
      logger.info('[CustomerDisplay] loadURL promise resolved successfully');
    })
    .catch((err) => {
      logger.error(`[CustomerDisplay] loadURL promise rejected: ${err.message}`);
    });

  displayWindow.on('closed', () => {
    logger.warn('[CustomerDisplay] Window was closed.');
    displayWindow = null;
  });

  logger.info(`[CustomerDisplay] Window opened successfully on monitor (${width}x${height}).`);
}

/**
 * Closes the customer display window.
 */
export function closeCustomerDisplay() {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.close();
  }
  displayWindow = null;
  logger.info('[CustomerDisplay] Window closed.');
}

/**
 * Updates or re-aligns the customer display window bounds to the current secondary display.
 */
export function updateCustomerDisplayBounds() {
  const secondary = getSecondaryDisplay();
  if (!secondary) {
    closeCustomerDisplay();
    return;
  }
  if (displayWindow && !displayWindow.isDestroyed()) {
    const { x, y, width, height } = secondary.bounds;
    displayWindow.setBounds({ x, y, width, height });
    logger.info(`[CustomerDisplay] Re-aligned window bounds to secondary display: ${width}x${height} at (${x}, ${y})`);
  } else {
    launchCustomerDisplay();
  }
}

/**
 * Pushes customer display state data directly into the React Native Web app inside the BrowserWindow
 * using window.postMessage.
 */
export function pushStateToDisplay(state: any) {
  if (!displayWindow || displayWindow.isDestroyed()) return;

  const payload = JSON.stringify({
    __source: 'electron-print-bridge',
    payload: state,
  });

  displayWindow.webContents
    .executeJavaScript(`window.postMessage(${payload}, '*')`)
    .catch((err) => logger.error(`[CustomerDisplay] Failed to push state to display: ${err.message}`));
}

// 10s Heartbeat watcher: ensures that if the window was closed but the monitor is still attached, it gets relaunched.
setInterval(() => {
  if (getSecondaryDisplay() && (!displayWindow || displayWindow.isDestroyed())) {
    logger.warn('[CustomerDisplay] Heartbeat: window not found but monitor connected. Relaunching...');
    launchCustomerDisplay();
  }
}, 10000);
