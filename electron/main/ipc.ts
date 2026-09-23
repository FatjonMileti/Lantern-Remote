import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc.js';
import { DesktopSourcesService } from '../services/DesktopSourcesService.js';
import { DeviceIdentityService } from '../services/DeviceIdentityService.js';
import { Logger } from '../services/Logger.js';

const logger = new Logger('main:ipc');

/**
 * WHY a dedicated module: every IPC handler is registered in one place
 * with explicit channels + validation, so the preload bridge can't drift
 * out of sync with main. No business logic beyond delegation lives here.
 */
export function registerIpcHandlers(
  deviceIdentity: DeviceIdentityService,
  desktopSources: DesktopSourcesService,
): void {
  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, () => {
    return {
      version: '0.1.0',
      platform: process.platform,
    };
  });

  ipcMain.handle(IPC_CHANNELS.GET_DEVICE_ID, async () => {
    try {
      return await deviceIdentity.getDeviceId();
    } catch (error) {
      logger.error('Failed to resolve device id', error);
      throw new Error('Unable to resolve device id');
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_DESKTOP_SOURCES, async () => {
    try {
      return await desktopSources.listScreens();
    } catch (error) {
      // Never leak native error detail; the renderer shows a friendly message.
      logger.error('Failed to list desktop sources', error);
      throw new Error('Unable to list screens for capture');
    }
  });

  logger.info('IPC handlers registered');
}
