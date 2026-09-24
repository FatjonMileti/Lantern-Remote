import { describe, it, expect } from 'vitest';
import { isValidTokenFormat } from '../../shared/connectionToken.js';
import { ConnectionTokenService, TOKEN_TTL_MS } from './ConnectionTokenService.js';

/**
 * Token generation + expiry with a fake clock. `crypto.randomInt` is real
 * here (distribution is not under test — format and lifecycle are); no
 * OS, IPC, or timers involved.
 */
describe('ConnectionTokenService', () => {
  function setup(now = 1_000_000): { service: ConnectionTokenService; clock: { now: number } } {
    const clock = { now };
    const service = new ConnectionTokenService(() => clock.now);
    return { service, clock };
  }

  it('generates a well-formed code with a TTL expiry', () => {
    const { service } = setup();
    const info = service.getOrCreate();
    expect(isValidTokenFormat(info.code)).toBe(true);
    expect(info.expiresAt).toBe(1_000_000 + TOKEN_TTL_MS);
  });

  it('returns the stable live code while valid', () => {
    const { service } = setup();
    const first = service.getOrCreate();
    expect(service.getOrCreate().code).toBe(first.code);
    expect(service.validate(first.code)).toBe(true);
  });

  it('rotates the code after expiry', () => {
    const { service, clock } = setup();
    const first = service.getOrCreate();
    clock.now += TOKEN_TTL_MS + 1;
    expect(service.validate(first.code)).toBe(false);
    const second = service.getOrCreate();
    expect(second.code).not.toBe(first.code);
    expect(service.validate(second.code)).toBe(true);
  });

  it('rejects wrong codes and malformed input', () => {
    const { service } = setup();
    service.getOrCreate();
    expect(service.validate('ZZZZZZ')).toBe(false);
    expect(service.validate('nope')).toBe(false);
    expect(service.validate(null)).toBe(false);
    expect(service.validate(undefined)).toBe(false);
    expect(service.validate(123456)).toBe(false);
  });

  it('validation never consumes the code', () => {
    const { service } = setup();
    const { code } = service.getOrCreate();
    expect(service.validate(code)).toBe(true);
    expect(service.validate(code)).toBe(true);
  });

  it('regenerate invalidates the old code', () => {
    const { service } = setup();
    const first = service.getOrCreate();
    const second = service.regenerate();
    expect(second.code).not.toBe(first.code);
    expect(service.validate(first.code)).toBe(false);
    expect(service.validate(second.code)).toBe(true);
  });

  it('consume burns the code exactly once', () => {
    const { service } = setup();
    const { code } = service.getOrCreate();
    expect(service.consume()).toBe(true);
    expect(service.validate(code)).toBe(false);
    expect(service.consume()).toBe(false);
  });

  it('clear revokes without replacement', () => {
    const { service } = setup();
    const { code } = service.getOrCreate();
    service.clear();
    expect(service.validate(code)).toBe(false);
    // Next use generates fresh — nothing stale survives.
    expect(service.getOrCreate().code).not.toBe(code);
  });
});
