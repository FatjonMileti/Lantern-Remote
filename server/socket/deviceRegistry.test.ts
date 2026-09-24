import { describe, it, expect } from 'vitest';
import { DeviceRegistry } from './deviceRegistry.js';

function fakeSocket(id: string): Parameters<DeviceRegistry['register']>[1] {
  return { id, connected: true } as Parameters<DeviceRegistry['register']>[1];
}

/** Presence bookkeeping: displacement, stale-socket safety, full cleanup. */
describe('DeviceRegistry', () => {
  it('registers and resolves both directions', () => {
    const registry = new DeviceRegistry();
    const socket = fakeSocket('s1');
    expect(registry.register('111111111', socket)).toBeNull();
    expect(registry.getSocket('111111111')).toBe(socket);
    expect(registry.getDeviceId('s1')).toBe('111111111');
    expect(registry.isOnline('111111111')).toBe(true);
  });

  it('re-register displaces the previous socket', () => {
    const registry = new DeviceRegistry();
    const old = fakeSocket('s1');
    const fresh = fakeSocket('s2');
    registry.register('111111111', old);
    expect(registry.register('111111111', fresh)).toBe(old);
    expect(registry.getSocket('111111111')).toBe(fresh);
    expect(registry.getDeviceId('s1')).toBeUndefined();
  });

  it('unregister removes presence but keeps stale-socket safety', () => {
    const registry = new DeviceRegistry();
    registry.register('111111111', fakeSocket('s1'));
    registry.register('111111111', fakeSocket('s2'));
    // s1 was already displaced at re-register (its mapping deleted there),
    // so unregistering it is a no-op that must not drop s2.
    expect(registry.unregisterSocket('s1')).toBeNull();
    expect(registry.getSocket('111111111')?.id).toBe('s2');
    expect(registry.unregisterSocket('s2')).toBe('111111111');
    expect(registry.isOnline('111111111')).toBe(false);
    expect(registry.unregisterSocket('s2')).toBeNull();
  });

  it('unknown sockets unregister to null', () => {
    const registry = new DeviceRegistry();
    expect(registry.unregisterSocket('ghost')).toBeNull();
    expect(registry.getSocket('000000000')).toBeUndefined();
  });
});
