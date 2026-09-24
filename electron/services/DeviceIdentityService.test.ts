// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Device identity persistence with mocked Electron: `app.getPath` points
 * at a throwaway tmp dir, the real fs does the work. Covers generation,
 * reload stability, corrupt-file recovery, and the StrictMode
 * double-invocation race (single-flight shared promise).
 */

const userData = mkdtempSync(join(tmpdir(), 'lantern-id-test-'));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`unexpected path: ${name}`);
      return userData;
    },
  },
}));

import { isValidDeviceId } from '../../shared/deviceId.js';
import { DeviceIdentityService } from './DeviceIdentityService.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('DeviceIdentityService', () => {
  it('generates a valid formatted id on first run', async () => {
    const service = new DeviceIdentityService('first-run.json');
    const id = await service.getDeviceId();
    expect(isValidDeviceId(id)).toBe(true);
    expect(id).toMatch(/^\d{3} \d{3} \d{3}$/);
  });

  it('persists the id across service instances', async () => {
    const first = new DeviceIdentityService('stable.json');
    const id = await first.getDeviceId();
    const second = new DeviceIdentityService('stable.json');
    expect(await second.getDeviceId()).toBe(id);
    const raw = JSON.parse(readFileSync(join(userData, 'stable.json'), 'utf8')) as {
      deviceId: string;
    };
    expect(raw.deviceId.replace(/ /g, '')).toBe(id.replace(/ /g, ''));
  });

  it('recovers from a corrupt identity file', async () => {
    writeFileSync(join(userData, 'corrupt.json'), '{{not json', 'utf8');
    const service = new DeviceIdentityService('corrupt.json');
    const id = await service.getDeviceId();
    expect(isValidDeviceId(id)).toBe(true);
  });

  it('shares one in-flight attempt under concurrent calls', async () => {
    const service = new DeviceIdentityService('race.json');
    const [a, b] = await Promise.all([service.getDeviceId(), service.getDeviceId()]);
    expect(a).toBe(b);
    expect(isValidDeviceId(a)).toBe(true);
  });
});
