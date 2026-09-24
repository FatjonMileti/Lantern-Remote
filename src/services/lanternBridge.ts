/**
 * Renderer access to the secure preload bridge.
 *
 * WHY this layer: components never touch `window.lantern` directly,
 * so future phases (signaling, capture, input) gain validation/retry
 * in one place instead of scattered `window` accesses.
 */
import type { ConnectionTokenInfo } from '../../shared/connectionToken.js';
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

export function getConnectionToken(): Promise<ConnectionTokenInfo> {
  return bridge().getConnectionToken();
}

export function regenerateConnectionToken(): Promise<ConnectionTokenInfo> {
  return bridge().regenerateConnectionToken();
}

export function validateConnectionToken(code: string): Promise<boolean> {
  return bridge().validateConnectionToken(code);
}

export function consumeConnectionToken(): Promise<boolean> {
  return bridge().consumeConnectionToken();
}

export function clearConnectionToken(): Promise<void> {
  return bridge().clearConnectionToken();
}
