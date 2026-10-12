import { app as electronApp } from 'electron';
import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';
import { startPoller, pollerStats } from './poller';
import { sendToPrinter, checkPrinterReachable } from './printer';
import { logger } from './logger';
import {
  startMonitorWatcher,
  monitorEvents,
  getSecondaryDisplay,
} from './customerDisplay/MonitorService';
import {
  launchCustomerDisplay,
  closeCustomerDisplay,
  pushStateToDisplay,
} from './customerDisplay/CustomerDisplayManager';
import { loadPersistedState, getCurrentState } from './customerDisplay/DisplayStateStore';
import displayRouter from './customerDisplay/displayRoutes';
import {
  launchCounterPOSWindow,
  focusCounterPOSWindow,
} from './posWindow/CounterPOSManager';
import { initTray } from './tray/TrayManager';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS globally with support for credentials (which doesn't allow '*')
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, postman, or mobile apps)
    if (!origin) return callback(null, true);
    
    // Dynamically allow any HTTP/HTTPS origin (localhost, local IP, or Cloudflare Workers POS domain)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight OPTIONS requests globally before routes
app.options('*', cors());

// Serve Settings UI static assets (CSS, JS) from src/public (dev) or dist/public (prod)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Request single-instance lock
const gotTheLock = electronApp.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('[Electron] Another instance of UniPro POS is already running. Exiting...');
  electronApp.quit();
  process.exit(0);
}

electronApp.on('second-instance', () => {
  logger.info('[Electron] Second instance launch attempted - focusing existing Counter POS window.');
  if (!focusCounterPOSWindow()) {
    launchCounterPOSWindow();
  }
});

// 1. GET /health - Local health check of the print bridge
app.get('/health', (req: Request, res: Response) => {
  res.json(pollerStats.getHealth());
});

// 1.1 GET /api/config - Retrieve current print bridge configuration
app.get('/api/config', (req: Request, res: Response) => {
  res.json(config);
});

// 1.2 POST /api/config - Save configuration to config.json
app.post('/api/config', (req: Request, res: Response) => {
  const { saveConfig } = require('./config');
  const success = saveConfig(req.body);
  if (success) {
    res.json({ success: true, message: 'Configuration saved successfully' });
  } else {
    res.status(500).json({ success: false, error: 'Failed to write configuration file' });
  }
});

// 1.3 GET /settings - Serve the production Settings Dashboard
app.get('/settings', (req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, 'public', 'settings.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(503).send('<h1>Settings UI not found. Run npm run build first.</h1>');
  }
});

// 1.4 GET /api/status - Rich runtime status for the Settings Dashboard
app.get('/api/status', (req: Request, res: Response) => {
  let appVersion = '1.0.0';
  let electronVersion = process.versions.electron || 'N/A';
  const nodeVersion   = process.version;

  try {
    const pkgPath = path.join(electronApp.getAppPath(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      appVersion = pkg.version || '1.0.0';
    }
  } catch (_) {}

  let configPath = 'N/A';
  try {
    // Resolve the same config file path logic as config.ts
    const execDir        = path.dirname(process.execPath);
    const execConfigPath = path.join(execDir, 'config.json');
    const localConfig    = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(execConfigPath))  configPath = execConfigPath;
    else if (fs.existsSync(localConfig)) configPath = localConfig;
  } catch (_) {}

  let configLastSaved: string | null = null;
  try {
    if (configPath !== 'N/A') {
      const stat = fs.statSync(configPath);
      configLastSaved = stat.mtime.toISOString();
    }
  } catch (_) {}

  const health = pollerStats.getHealth();

  res.json({
    bridgeRunning:             true,
    printerConnected:          health.connected,
    customerDisplayConnected:  false, // updated by customer display manager if needed
    appVersion,
    electronVersion,
    nodeVersion,
    configPath,
    configLastSaved,
    printer: {
      ip:        config.backends?.[0]?.url || 'N/A',
      port:      9100,
      status:    health.connected ? 'Connected' : 'Disconnected',
      usbStatus: 'Not configured',
    },
    kitchenRoutes:  'Via Railway backend',
    cashierPrinter: 'Receipt Printer (TCP)',
  });
});

// 1.5 GET /api/logs - Return latest 100 log lines
app.get('/api/logs', (req: Request, res: Response) => {
  try {
    let userDataPath = '';
    try { userDataPath = electronApp.getPath('userData'); } catch (_) {}
    if (!userDataPath) {
      userDataPath = process.env.APPDATA
        ? path.join(process.env.APPDATA, 'UniPro Print Bridge')
        : process.cwd();
    }
    const logFile = path.join(userDataPath, 'logs', 'app.log');
    if (!fs.existsSync(logFile)) {
      return res.json({ lines: [] });
    }
    const content = fs.readFileSync(logFile, 'utf8');
    const lines   = content.split('\n').filter(Boolean).slice(-100);
    res.json({ lines });
  } catch (err: any) {
    res.json({ lines: [`[ERROR] Could not read log file: ${err.message}`] });
  }
});

// 1.6 POST /api/printer/reconnect - Signal a printer reconnection attempt
app.post('/api/printer/reconnect', async (req: Request, res: Response) => {
  logger.info('[Settings] Manual printer reconnect requested via dashboard.');
  // The poller will naturally re-authenticate on the next cycle.
  // We reset connection flags on all backend instances.
  const { getBackendInstances } = require('./railwayApi');
  const instances = getBackendInstances();
  for (const inst of instances) {
    inst.authenticated = false;
    inst.connected     = false;
  }
  res.json({ success: true, message: 'Reconnect signal sent â€” backends will re-authenticate on next poll cycle.' });
});

// â”€â”€â”€ Settings UI now served via static file (src/public/settings.html) â”€â”€â”€

// 2. POST /test-print - Directly test a kitchen printer from the bridge machine
app.post('/test-print', async (req: Request, res: Response) => {
  const { ip, port } = req.body;
  const targetPort = parseInt(port as string) || 9100;

  if (!ip) {
    return res.status(400).json({ success: false, error: 'Missing printer IP address' });
  }

  const testContent =
    '\x1B\x40' +                      // Initialize printer
    '\x1B\x61\x01' +                  // Center alignment
    'UniPro Print Bridge Test\n' +
    '------------------------\n' +
    `Time: ${new Date().toLocaleString()}\n` +
    `Printer IP: ${ip}\n` +
    `Port: ${targetPort}\n\n\n\n` +
    '\x1D\x56\x41\x00';                // Paper cut command

  try {
    logger.info(`Manual test print initiated for printer: ${ip}:${targetPort}`);
    await sendToPrinter(ip, targetPort, testContent, 'TEST-JOB');
    res.json({ success: true, message: `Test receipt sent to printer at ${ip}:${targetPort}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Printing failed' });
  }
});

// 3. POST /direct-test-print - Test simple text payload without formatting
app.post('/direct-test-print', async (req: Request, res: Response) => {
  const { ip, port } = req.body;
  const targetPort = parseInt(port as string) || 9100;

  if (!ip) {
    return res.status(400).json({ success: false, error: 'Missing printer IP address' });
  }

  const testContent = 'HELLO FROM PRINT BRIDGE\n\n\n';

  try {
    logger.info(`Direct simple test print initiated for printer: ${ip}:${targetPort}`);
    await sendToPrinter(ip, targetPort, testContent, 'TEST-JOB');
    res.json({ success: true, message: `Direct text sent to printer at ${ip}:${targetPort}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Printing failed' });
  }
});

// 4. POST /api/lan/orders - Receive order from local waiter tablets over Wi-Fi
app.post('/api/lan/orders', async (req: Request, res: Response) => {
  const { order, items } = req.body;
  if (!order || !order.client_id) {
    return res.status(400).json({ success: false, error: 'Invalid order payload' });
  }

  logger.info(`[LAN Server Hub] Received order ${order.order_number || order.client_id} from table ${order.table_no}`);

  // Print order automatically if cashier printer is configured
  let printSuccess = false;
  try {
    const printerIp = config.backends?.[0]?.url || '127.0.0.1';
    const testReceipt =
      '\x1B\x40' +
      '\x1B\x61\x01' +
      `ORDER #${order.order_number}\n` +
      `Table: ${order.table_no} | Waiter: ${order.waiter_name || 'Staff'}\n` +
      `------------------------\n` +
      (items || []).map((i: any) => `${i.quantity}x ${i.dish_name} - $${i.total_price}`).join('\n') +
      `\n------------------------\nTotal: $${order.total_amount}\n\n\n\n\x1D\x56\x41\x00`;

    await sendToPrinter(printerIp, 9100, testReceipt, order.client_id);
    printSuccess = true;
  } catch (printErr: any) {
    logger.warn(`[LAN Server Hub] Auto-print warning for order ${order.client_id}: ${printErr.message}`);
  }

  res.json({
    success: true,
    client_id: order.client_id,
    printed: printSuccess,
    received_at: new Date().toISOString(),
  });
});

// Resolves the web assets directory across development, unpacked, and packaged installer modes
export function getWebAssetsDir(): string {
  const candidates = [
    path.join(electronApp.getAppPath(), 'customer-display-web'),
    path.join(process.resourcesPath || '', 'customer-display-web'),
    path.join(process.cwd(), 'customer-display-web'),
    path.join(__dirname, '..', 'customer-display-web'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// 5. Reverse proxy unhandled /api/* and /uploads/* to active backend
app.use(async (req: Request, res: Response, next) => {
  const isApi = req.path.startsWith('/api/');
  const isUploads = req.path.startsWith('/uploads/');
  if (!isApi && !isUploads) {
    return next();
  }

  // Preserve local Print Bridge endpoints
  const localEndpoints = [
    '/api/config',
    '/api/status',
    '/api/logs',
    '/api/printer/reconnect',
    '/api/lan/orders',
  ];
  if (localEndpoints.includes(req.path)) {
    return next();
  }

  const activeBackend = config.backends?.find((b) => b.enabled)?.url || 'http://localhost:5000';
  try {
    const targetUrl = `${activeBackend.replace(/\/+$/, '')}${req.originalUrl}`;
    const headers: Record<string, any> = { ...req.headers };
    try {
      headers.host = new URL(activeBackend).host;
    } catch (_) {}

    const response = await axios({
      method: req.method as any,
      url: targetUrl,
      data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      headers,
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 30000,
    });

    res.status(response.status);
    Object.entries(response.headers).forEach(([k, v]) => {
      if (v && k.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(k, v as any);
      }
    });
    response.data.pipe(res);
  } catch (err: any) {
    logger.warn(`[Proxy] Failed to route ${req.method} ${req.path} to ${activeBackend}: ${err.message}`);
    res.status(502).json({
      success: false,
      error: `Could not reach backend at ${activeBackend}: ${err.message}`,
    });
  }
});

// Serve the static POS web and customer display files
const webAssetsDir = getWebAssetsDir();
app.use(express.static(webAssetsDir, { extensions: ['html'] }));

// Mount customer display endpoints
app.use('/customer-display', displayRouter);

// SPA fallback for React Native Web / Expo Router
app.get('*', (req: Request, res: Response, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/settings') ||
    req.path.startsWith('/customer-display') ||
    req.path === '/health'
  ) {
    return next();
  }
  const indexPath = path.join(webAssetsDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Initialize Electron Lifecycle
electronApp.whenReady().then(() => {
  logger.info('[Electron] Platform ready. Starting services...');

  // Launch the Express listener + poller first
  app.listen(config.port, () => {
    logger.info(`UniPro Print Bridge server listening locally on port ${config.port}`);
    startPoller();

    loadPersistedState();
    startMonitorWatcher();

    // 1. Initialize System Tray Menu
    initTray();

    // 2. Launch Cashier POS Window on Primary Display
    launchCounterPOSWindow();

    // 3. If a secondary display is already plugged in on start, launch customer display
    if (getSecondaryDisplay()) {
      launchCustomerDisplay();
    }

    // Handle display changes (added/removed/metrics changes)
    monitorEvents.on('display-changed', () => {
      if (getSecondaryDisplay()) {
        launchCustomerDisplay();
        // Re-push the current state so the display isn't blank/stale after connecting
        setTimeout(() => {
          pushStateToDisplay(getCurrentState());
        }, 2000);
      } else {
        closeCustomerDisplay();
      }
    });
  });

  // Windows Startup Registry Configuration
  electronApp.setLoginItemSettings({
    openAtLogin: true,
    name: 'UniPro POS Counter',
  });
});

// Avoid app shutdown when window closes (our tray/express server remains running)
electronApp.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
