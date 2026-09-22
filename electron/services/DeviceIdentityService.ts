import { randomInt } from 'node:crypto';
import { app } from 'electron';

/**
 * DeviceIdentityService (Phase 1 skeleton).
 *
 * WHY this shape: the public device id must be stable across restarts,
 * must NOT be a MAC address, and must live behind main-process storage
 * (safeStorage / userData) so the renderer only ever sees the id string.
 *
 * Full implementation (persist via userData + secure storage, 9-digit
 * "XXX XXX XXX" format) lands with device registration in Phase 2.
 * This stub keeps main/preload/renderer wiring verifiable in Phase 1.
 */
export class DeviceIdentityService {
  private cachedId: string | null = null;

  constructor(private readonly appName = 'lantern-remote') {
    void appName;
  }

  /** Returns the stable device id, generating + persisting it on first run. */
  async getDeviceId(): Promise<string> {
    if (this.cachedId) return this.cachedId;
    // Phase 1 placeholder: random per launch so the UI wiring is visible.
    // Phase 2 replaces this with persisted storage under app.getPath('userData').
    this.cachedId = formatDeviceId(generateDigits());
    return this.cachedId;
  }

  get userDataPath(): string {
    return app.getPath('userData');
  }
}

function generateDigits(): string {
  let digits = '';
  for (let i = 0; i < 9; i += 1) {
    digits += String(randomInt(0, 10));
  }
  return digits;
}

/** Formats "482913742" -> "482 913 742". Exported for future unit tests. */
export function formatDeviceId(digits: string): string {
  const clean = digits.replace(/\D/g, '').padStart(9, '0').slice(0, 9);
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}
