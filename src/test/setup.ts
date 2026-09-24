import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type { LanternApiType } from '../../electron/preload.js';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * `window.lantern` mock. Shape must mirror `LanternApi` in shared/ipc.ts —
 * tests that touch the bridge fail loudly here instead of deep in a service.
 * Clipboard/token fns return benign values; input send is a silent no-op.
 * jsdom only — node-env suites (server routing) have no window.
 */
if (typeof window !== 'undefined') {
  window.lantern = {
  getAppInfo: async () => ({ version: 'test', platform: 'linux' }),
  getDeviceId: async () => '123 456 789',
  getDesktopSources: async () => [],
  sendRemoteInput: () => undefined,
  getRemoteInputStatus: async () => ({ supported: false, reason: 'Test environment' }),
  getConnectionToken: async () => ({ code: 'ABC234', expiresAt: Date.now() + 600000 }),
  regenerateConnectionToken: async () => ({ code: 'DEF567', expiresAt: Date.now() + 600000 }),
  validateConnectionToken: async () => true,
  consumeConnectionToken: async () => true,
  clearConnectionToken: async () => undefined,
  getClipboardText: async () => '',
  setClipboardText: async () => true,
} satisfies LanternApiType;
}
