/**
 * Device ID helpers shared by main, renderer, and signaling server.
 *
 * WHY: the public id is an identifier (not a secret) and must parse the same
 * way everywhere. Never derived from a MAC address.
 */

export const DEVICE_ID_DIGIT_COUNT = 9;

export function normalizeDeviceId(input: string): string {
  return input.replace(/\D/g, '');
}

export function parseDeviceId(input: string): string | null {
  const digits = normalizeDeviceId(input);
  if (digits.length !== DEVICE_ID_DIGIT_COUNT) return null;
  return digits;
}

export function isValidDeviceId(input: string): boolean {
  return parseDeviceId(input) !== null;
}

/** Formats "482913742" -> "482 913 742". */
export function formatDeviceId(input: string): string {
  const digits = normalizeDeviceId(input).padStart(DEVICE_ID_DIGIT_COUNT, '0').slice(0, 9);
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}
