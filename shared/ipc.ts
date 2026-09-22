/**
 * Typed IPC contract between main/preload/renderer.
 *
 * WHY: a single source of truth prevents channel-name typos and
 * untyped payloads drifting between processes. Preload exposes only
 * the methods declared here; the renderer never touches ipcRenderer directly.
 */

/** Outgoing app version info exposed to the renderer (read-only, safe). */
export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
}

/**
 * Minimal Phase 1 bridge API.
 * Future phases will extend this with device identity, signaling,
 * screen capture, and remote input channels (never raw Node/Electron APIs).
 */
export interface LanternApi {
  getAppInfo: () => Promise<AppInfo>;
  getDeviceId: () => Promise<string>;
}

export const IPC_CHANNELS = {
  GET_APP_INFO: 'lantern:get-app-info',
  GET_DEVICE_ID: 'lantern:get-device-id',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
