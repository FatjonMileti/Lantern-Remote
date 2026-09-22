import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc.js';
import { DeviceIdentityService } from '../services/DeviceIdentityService.js';
import { Logger } from '../services/Logger.js';

const logger = new Logger('main:ipc');

/**
 * WHY a dedicated module: every IPC handler is registered in one place
 * with explicit channels + validation, so the preload bridge can't drift
 * out of sync with main. No business logic beyond delegation lives here.
 */
export function registerIpcHandlers(deviceIdentity: DeviceIdentityService): void {
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

  logger.info('IPC handlers registered');
}
