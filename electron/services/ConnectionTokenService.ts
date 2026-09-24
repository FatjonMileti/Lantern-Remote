import { randomInt, timingSafeEqual } from 'node:crypto';
import {
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  isValidTokenFormat,
  type ConnectionTokenInfo,
} from '../../shared/connectionToken.js';

/** Codes live 10 minutes — long enough to read over, short enough to bound theft. */
export const TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Host-owned temporary connection codes.
 *
 * WHY main-process + in-memory: codes are authentication material. They are
 * generated with `crypto.randomInt` (never `Math.random`), compared in
 * constant time, never persisted (a restart wipes them), single-use
 * (consumed on accept), and revocable (cleared on session teardown).
 * The signaling server never holds a live code — it only routes the shape.
 */
export class ConnectionTokenService {
  private current: ConnectionTokenInfo | null = null;

  /** Clock seam for unit tests (defaults to wall time). */
  constructor(private readonly now: () => number = Date.now) {}

  /** Current live code, generating one if none is live. */
  getOrCreate(): ConnectionTokenInfo {
    const live = this.current;
    if (live && live.expiresAt > this.now()) return live;
    return this.regenerate();
  }

  /** Invalidate any live code and issue a fresh one. */
  regenerate(): ConnectionTokenInfo {
    let code = '';
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
      code += TOKEN_ALPHABET[randomInt(0, TOKEN_ALPHABET.length)];
    }
    this.current = { code, expiresAt: this.now() + TOKEN_TTL_MS };
    return this.current;
  }

  /** Pure check — presenting a code never consumes it (accept does). */
  validate(candidate: unknown): boolean {
    if (!isValidTokenFormat(candidate)) return false;
    const live = this.current;
    if (!live || live.expiresAt <= this.now()) return false;
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(live.code, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Burn the live code after a successful accept (single-use). */
  consume(): boolean {
    const had = this.current !== null;
    this.current = null;
    return had;
  }

  /** Revoke without replacement (session teardown, explicit cancel). */
  clear(): void {
    this.current = null;
  }
}
