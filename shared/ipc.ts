/**
 * Typed IPC contract between main/preload/renderer.
 *
 * WHY: a single source of truth prevents channel-name typos and
 * untyped payloads drifting between processes. Preload exposes only
 * the methods declared here; the renderer never touches ipcRenderer directly.
 */
import type { InputAdapterStatus, RemoteInputRequest } from './remoteInput.js';

/** Outgoing app version info exposed to the renderer (read-only, safe). */
export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
}

/**
 * One capturable display. The thumbnail is a small data-URL preview so the
 * renderer can show a source picker without any Electon/Node access.
 */
export interface DesktopSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

/**
 * Secure bridge API. Each method maps to exactly one typed IPC channel;
 * the renderer never receives raw Node/Electron APIs.
 */
export interface LanternApi {
  getAppInfo: () => Promise<AppInfo>;
  getDeviceId: () => Promise<string>;
  getDesktopSources: () => Promise<DesktopSource[]>;
  /** Fire-and-forget host input (high frequency — no ack); main validates. */
  sendRemoteInput: (request: RemoteInputRequest) => void;
  getRemoteInputStatus: () => Promise<InputAdapterStatus>;
}

export const IPC_CHANNELS = {
  GET_APP_INFO: 'lantern:get-app-info',
  GET_DEVICE_ID: 'lantern:get-device-id',
  GET_DESKTOP_SOURCES: 'lantern:get-desktop-sources',
  REMOTE_INPUT: 'lantern:remote-input',
  GET_REMOTE_INPUT_STATUS: 'lantern:get-remote-input-status',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
