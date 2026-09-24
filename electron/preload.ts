import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionTokenInfo } from '../shared/connectionToken.js';
import { IPC_CHANNELS, type AppInfo, type DesktopSource } from '../shared/ipc.js';
import type { InputAdapterStatus, RemoteInputRequest } from '../shared/remoteInput.js';

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
  // Fire-and-forget by design: input events stream at tens of Hz.
  sendRemoteInput: (request: RemoteInputRequest): void =>
    ipcRenderer.send(IPC_CHANNELS.REMOTE_INPUT, request),
  getRemoteInputStatus: (): Promise<InputAdapterStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_REMOTE_INPUT_STATUS),
  getConnectionToken: (): Promise<ConnectionTokenInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CONNECTION_TOKEN),
  regenerateConnectionToken: (): Promise<ConnectionTokenInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.REGENERATE_CONNECTION_TOKEN),
  validateConnectionToken: (code: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_CONNECTION_TOKEN, code),
  consumeConnectionToken: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONSUME_CONNECTION_TOKEN),
  clearConnectionToken: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_CONNECTION_TOKEN),
};

export type LanternApiType = typeof lanternApi;

contextBridge.exposeInMainWorld('lantern', lanternApi);

declare global {
  interface Window {
    lantern: LanternApiType;
  }
}
