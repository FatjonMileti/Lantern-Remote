import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type AppInfo, type DesktopSource } from '../shared/ipc.js';

/**
 * Secure preload bridge.
 *
 * WHY contextBridge + invoke-only: the renderer must never receive
 * ipcRenderer, Node.js, or Electron APIs directly. Only the whitelisted
 * async methods below are exposed, each bound to a typed channel.
 */
const lanternApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  getDeviceId: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GET_DEVICE_ID),
  getDesktopSources: (): Promise<DesktopSource[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DESKTOP_SOURCES),
};

export type LanternApiType = typeof lanternApi;

contextBridge.exposeInMainWorld('lantern', lanternApi);

declare global {
  interface Window {
    lantern: LanternApiType;
  }
}
