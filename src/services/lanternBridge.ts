/**
 * Renderer access to the secure preload bridge.
 *
 * WHY this layer: components never touch `window.lantern` directly,
 * so future phases (signaling, capture, input) gain validation/retry
 * in one place instead of scattered `window` accesses.
 */
import type { AppInfo, DesktopSource } from '../../shared/ipc.js';
import type { InputAdapterStatus, RemoteInputRequest } from '../../shared/remoteInput.js';

function bridge(): Window['lantern'] {
  if (!window.lantern) {
    throw new Error('Preload bridge unavailable (contextIsolation enabled)');
  }
  return window.lantern;
}

export function getDeviceId(): Promise<string> {
  return bridge().getDeviceId();
}

export function getAppInfo(): Promise<AppInfo> {
  return bridge().getAppInfo();
}

export function getDesktopSources(): Promise<DesktopSource[]> {
  return bridge().getDesktopSources();
}

export function sendRemoteInput(request: RemoteInputRequest): void {
  bridge().sendRemoteInput(request);
}

export function getRemoteInputStatus(): Promise<InputAdapterStatus> {
  return bridge().getRemoteInputStatus();
}
