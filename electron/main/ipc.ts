import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc.js';
import { DesktopSourcesService } from '../services/DesktopSourcesService.js';
import { DeviceIdentityService } from '../services/DeviceIdentityService.js';
import { Logger } from '../services/Logger.js';
import { RemoteInputService } from '../services/RemoteInputService.js';

const logger = new Logger('main:ipc');

/**
 * WHY a dedicated module: every IPC handler is registered in one place
 * with explicit channels + validation, so the preload bridge can't drift
 * out of sync with main. No business logic beyond delegation lives here.
 */
export function registerIpcHandlers(
  deviceIdentity: DeviceIdentityService,
  desktopSources: DesktopSourcesService,
  remoteInput: RemoteInputService,
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

  // Fire-and-forget: mouse moves arrive at tens of Hz, so no ack channel.
  // The dispatcher re-validates; only the message kind (never coordinates
  // or contents) is logged, per the logging hygiene rules.
  ipcMain.on(IPC_CHANNELS.REMOTE_INPUT, (_event, raw: unknown) => {
    void remoteInput.dispatch(raw).then((result) => {
      if (!result.ok) {
        logger.warn('Remote input rejected', {
          kind: result.kind,
          reason: result.reason,
        });
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.GET_REMOTE_INPUT_STATUS, () => {
    return remoteInput.status();
  });

  logger.info('IPC handlers registered');
}
