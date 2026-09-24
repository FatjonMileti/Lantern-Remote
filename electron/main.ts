import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc.js';
import { createMainWindow } from './main/window.js';
import { ConnectionTokenService } from './services/ConnectionTokenService.js';
import { DesktopSourcesService } from './services/DesktopSourcesService.js';
import { DeviceIdentityService } from './services/DeviceIdentityService.js';
import { Logger } from './services/Logger.js';
import { RemoteInputService } from './services/RemoteInputService.js';

const logger = new Logger('main');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const customUserData = process.env.LANTERN_USER_DATA;
if (customUserData) {
  app.setPath('userData', customUserData);
}

const deviceIdentity = new DeviceIdentityService();
const desktopSources = new DesktopSourcesService();
const remoteInput = new RemoteInputService();
const connectionToken = new ConnectionTokenService();

registerIpcHandlers(deviceIdentity, desktopSources, remoteInput, connectionToken);

const allowMultiInstance =
  process.env.LANTERN_ALLOW_MULTI_INSTANCE === '1' || Boolean(customUserData);

const gotLock = allowMultiInstance ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  if (!allowMultiInstance) {
    app.on('second-instance', () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });
  }

  void app.whenReady().then(() => {
    createMainWindow();
    logger.info('Lantern Remote ready');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
