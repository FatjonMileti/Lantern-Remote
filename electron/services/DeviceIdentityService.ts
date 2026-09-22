import { randomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { formatDeviceId, parseDeviceId } from '../../shared/deviceId.js';

const IDENTITY_FILE = 'device-identity.json';

interface StoredIdentity {
  deviceId: string;
}

function isStoredIdentity(value: unknown): value is StoredIdentity {
  if (typeof value !== 'object' || value === null) return false;
  if (!('deviceId' in value)) return false;
  return typeof value.deviceId === 'string';
}

/**
 * Stable device identity persisted under `app.getPath('userData')`.
 *
 * WHY not MAC / hardware addresses: those leak network identifiers and
 * are a poor public ID. A random 9-digit code is an identifier, not a secret.
 */
export class DeviceIdentityService {
  private cachedId: string | null = null;

  constructor(private readonly fileName = IDENTITY_FILE) {}

  async getDeviceId(): Promise<string> {
    if (this.cachedId) return this.cachedId;
    const digits = await this.loadOrCreate();
    this.cachedId = formatDeviceId(digits);
    return this.cachedId;
  }

  get userDataPath(): string {
    return app.getPath('userData');
  }

  private get filePath(): string {
    return join(this.userDataPath, this.fileName);
  }

  private async loadOrCreate(): Promise<string> {
    await mkdir(this.userDataPath, { recursive: true });
    const existing = await this.readStored();
    if (existing) return existing;

    const digits = generateDigits();
    const tmp = `${this.filePath}.tmp`;
    const body = JSON.stringify({ deviceId: digits }, null, 2);
    await writeFile(tmp, body, 'utf8');
    await rename(tmp, this.filePath);
    return digits;
  }

  private async readStored(): Promise<string | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredIdentity(parsed)) return null;
      return parseDeviceId(parsed.deviceId);
    } catch {
      return null;
    }
  }
}

function generateDigits(): string {
  let digits = '';
  for (let i = 0; i < 9; i += 1) {
    digits += String(randomInt(0, 10));
  }
  return digits;
}

export { formatDeviceId } from '../../shared/deviceId.js';
