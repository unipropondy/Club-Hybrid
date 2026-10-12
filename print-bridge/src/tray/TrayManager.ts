import { Tray, Menu, app as electronApp, nativeImage } from 'electron';
import * as path from 'path';
import { launchCounterPOSWindow, focusCounterPOSWindow } from '../posWindow/CounterPOSManager';
import { launchCustomerDisplay } from '../customerDisplay/CustomerDisplayManager';
import { config } from '../config';
import { logger } from '../logger';

let tray: Tray | null = null;

export function initTray(): Tray | null {
  if (tray) return tray;

  try {
    // Generate or locate tray icon
    const iconCandidates = [
      path.join(__dirname, '..', 'public', 'tray-icon.png'),
      path.join(electronApp.getAppPath(), 'src', 'public', 'tray-icon.png'),
    ];

    let icon = nativeImage.createEmpty();
    for (const p of iconCandidates) {
      const candidate = nativeImage.createFromPath(p);
      if (!candidate.isEmpty()) {
        icon = candidate;
        break;
      }
    }

    tray = new Tray(icon);
    tray.setToolTip('UniPro POS & Print Bridge');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🖥️ Open Counter POS',
        click: () => {
          if (!focusCounterPOSWindow()) {
            launchCounterPOSWindow();
          }
        },
      },
      {
        label: '📺 Open Customer Display',
        click: () => {
          launchCustomerDisplay();
        },
      },
      {
        label: '⚙️ Settings & Bridge Dashboard',
        click: () => {
          const { shell } = require('electron');
          shell.openExternal(`http://localhost:${config.port}/settings`);
        },
      },
      { type: 'separator' },
      {
        label: '❌ Exit UniPro POS',
        click: () => {
          logger.info('[Tray] User requested full application exit.');
          electronApp.exit(0);
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (!focusCounterPOSWindow()) {
        launchCounterPOSWindow();
      }
    });

    logger.info('[Tray] System Tray menu initialized successfully.');
    return tray;
  } catch (err: any) {
    logger.warn(`[Tray] Tray initialization warning: ${err.message}`);
    return null;
  }
}
