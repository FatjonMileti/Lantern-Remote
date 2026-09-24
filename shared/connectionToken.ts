/**
 * Temporary connection codes (Phase 8).
 *
 * WHY shared: client, host, and server must agree on the *shape* (never the
 * value — only the host main process ever holds a live code). The human
 * carries the code out-of-band from host screen to client keyboard, exactly
 * like a pairing PIN. Unambiguous alphabet: no 0/O, 1/I/L.
 */

export const TOKEN_LENGTH = 6;
export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface ConnectionTokenInfo {
  code: string;
  /** Epoch ms when the code stops being valid. */
  expiresAt: number;
}

export function isValidTokenFormat(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== TOKEN_LENGTH) return false;
  for (const char of value) {
    if (!TOKEN_ALPHABET.includes(char)) return false;
  }
  return true;
}

/** Normalize user typing: uppercase, strip anything outside the alphabet. */
export function normalizeTokenInput(value: string): string {
  return value
    .toUpperCase()
    .split('')
    .filter((char) => TOKEN_ALPHABET.includes(char))
    .join('')
    .slice(0, TOKEN_LENGTH);
}
