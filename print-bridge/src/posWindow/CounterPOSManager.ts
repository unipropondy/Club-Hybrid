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
    title: 'Smart-Club POS UniPro',
    icon: path.join(__dirname, '../../build/icon.ico'),
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

  // ── Splash Screen: Shown immediately while backend warms up ────────────────
  const splashHtml = `data:text/html;charset=UTF-8,<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Smart-Club POS UniPro</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    background:linear-gradient(135deg,#0C0A22 0%,#1a1040 50%,#0C0A22 100%);
    color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;
  }
  .card{text-align:center;max-width:440px;padding:48px 40px}
  .logo{font-size:48px;margin-bottom:20px;animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  h1{font-size:26px;font-weight:700;margin-bottom:8px;
     background:linear-gradient(90deg,#818CF8,#C084FC);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .subtitle{color:#94A3B8;font-size:14px;margin-bottom:36px}
  .bar-track{width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:999px;overflow:hidden;margin-bottom:18px}
  .bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#6366F1,#A855F7);border-radius:999px;
            animation:load 15s ease forwards}
  @keyframes load{0%{width:0%}40%{width:60%}80%{width:85%}100%{width:95%}}
  .status{color:#64748B;font-size:13px;animation:blink 1.4s step-start infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🎰</div>
  <h1>Smart-Club POS UniPro</h1>
  <p class="subtitle">Powered by UniPro Solutions</p>
  <div class="bar-track"><div class="bar-fill"></div></div>
  <p class="status">Starting local services, please wait…</p>
</div>
</body>
</html>`;

  // Show splash immediately — no server required
  counterPOSWindow.loadURL(splashHtml).catch(() => {});

  let retries = 0;
  const maxRetries = 75; // 75 × 800ms = 60s maximum wait
  let loadTimer: NodeJS.Timeout | null = null;
  let splashShown = true;

  const tryLoad = () => {
    if (!counterPOSWindow || counterPOSWindow.isDestroyed()) return;
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }

    counterPOSWindow.loadURL(targetUrl).then(() => {
      splashShown = false;
      logger.info(`[CounterPOS] POS loaded successfully after ${retries} retries.`);
    }).catch((err) => {
      retries++;
      if (retries <= maxRetries) {
        logger.warn(
          `[CounterPOS] Web server starting up (${retries}/${maxRetries}): ${err.message}. Retrying in 800ms...`
        );
        loadTimer = setTimeout(tryLoad, 800);
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
      // Start trying to load the real POS now that window is visible
      tryLoad();
    }
  });

  counterPOSWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    // Retry on connection refused, connection reset, name not resolved, or aborts during startup
    if (errorCode === -102 || errorCode === -105 || errorCode === -106 || errorCode === -3) {
      retries++;
      if (retries <= maxRetries) {
        logger.warn(
          `[CounterPOS] Waiting for local server (code ${errorCode}: ${errorDescription}). Retrying in 800ms...`
        );
        if (!loadTimer) {
          loadTimer = setTimeout(tryLoad, 800);
        }
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

  // tryLoad() is now triggered inside the 'ready-to-show' event handler after the splash shows.
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
