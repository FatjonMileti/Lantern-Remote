/**
 * Renderer access to the secure preload bridge.
 *
 * WHY this layer: components never touch `window.lantern` directly,
 * so future phases (signaling, capture, input) gain validation/retry
 * in one place instead of scattered `window` accesses.
 */
import type { AppInfo } from '../../shared/ipc.js';

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
