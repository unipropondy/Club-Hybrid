import { BrowserWindow, screen, app as electronApp } from 'electron';
import * as path from 'path';
import { logger } from '../logger';
import { config } from '../config';

let counterPOSWindow: BrowserWindow | null = null;

/**
 * Returns the active Counter POS BrowserWindow instance, if open.
 */
export function getCounterPOSWindow(): BrowserWindow | null {
  return counterPOSWindow;
}

/**
 * Brings the Counter POS window to the foreground and focuses it.
 */
export function focusCounterPOSWindow(): boolean {
  if (counterPOSWindow && !counterPOSWindow.isDestroyed()) {
    if (counterPOSWindow.isMinimized()) {
      counterPOSWindow.restore();
    }
    counterPOSWindow.show();
    counterPOSWindow.focus();
    return true;
  }
  return false;
}

/**
 * Launches the primary Cashier / Counter POS interface on the primary display.
 */
export function launchCounterPOSWindow(): BrowserWindow {
  if (counterPOSWindow && !counterPOSWindow.isDestroyed()) {
    focusCounterPOSWindow();
    return counterPOSWindow;
  }

  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;

  logger.info(
    `[CounterPOS] Initializing Cashier POS window on Primary Screen (${width}x${height} at x:${x}, y:${y})`
  );

  counterPOSWindow = new BrowserWindow({
    x,
    y,
    width: Math.min(width, 1440),
    height: Math.min(height, 900),
    minWidth: 1024,
    minHeight: 680,
    title: 'UniPro POS - Cashier & Counter Terminal',
    backgroundColor: '#0C0A22',
    show: false, // Prevents white flash during initial rendering
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  counterPOSWindow.maximize();

  const targetUrl = `http://localhost:${config.port}/`;
  logger.info(`[CounterPOS] Loading POS URL: ${targetUrl}`);

  let retries = 0;
  const maxRetries = 25;

  const tryLoad = () => {
    if (!counterPOSWindow || counterPOSWindow.isDestroyed()) return;
    counterPOSWindow.loadURL(targetUrl).catch((err) => {
      retries++;
      if (retries <= maxRetries) {
        logger.warn(
          `[CounterPOS] Web server starting up (${retries}/${maxRetries}): ${err.message}. Retrying in 1.5s...`
        );
        setTimeout(tryLoad, 1500);
      } else {
        logger.error(`[CounterPOS] Failed to load POS after ${maxRetries} attempts: ${err.message}`);
      }
    });
  };

  counterPOSWindow.once('ready-to-show', () => {
    if (counterPOSWindow && !counterPOSWindow.isDestroyed()) {
      counterPOSWindow.show();
      counterPOSWindow.focus();
      logger.info('[CounterPOS] Window displayed and focused successfully.');
    }
  });

  counterPOSWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode === -102 || errorCode === -105 || errorCode === -106) {
      retries++;
      if (retries <= maxRetries) {
        logger.warn(
          `[CounterPOS] Waiting for local server (code ${errorCode}: ${errorDescription}). Retrying in 1.5s...`
        );
        setTimeout(tryLoad, 1500);
      }
    }
  });

  // 📝 Capture all Frontend UI console output into frontend.log
  counterPOSWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    logger.frontend(`[${levelStr}] [${sourceId || 'UI'}:${line}] ${message}`);
  });

  // Enterprise POS Keyboard Shortcuts
  counterPOSWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // F11: Fullscreen toggle
      if (input.key === 'F11') {
        const isFull = counterPOSWindow?.isFullScreen() || false;
        counterPOSWindow?.setFullScreen(!isFull);
        event.preventDefault();
      }
      // F5 or Ctrl+R: Soft reload POS interface
      else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
        logger.info('[CounterPOS] Manual reload requested via hotkey.');
        counterPOSWindow?.reload();
        event.preventDefault();
      }
      // F12 or Ctrl+Shift+I: Open DevTools
      else if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        counterPOSWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
  });

  counterPOSWindow.on('closed', () => {
    logger.info('[CounterPOS] Window closed by user. Terminating application...');
    counterPOSWindow = null;
    electronApp.quit();
  });

  tryLoad();
  return counterPOSWindow;
}

/**
 * Closes the Counter POS window.
 */
export function closeCounterPOSWindow(): void {
  if (counterPOSWindow && !counterPOSWindow.isDestroyed()) {
    counterPOSWindow.close();
  }
  counterPOSWindow = null;
}
