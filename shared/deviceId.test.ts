import { describe, it, expect } from 'vitest';
import {
  normalizeDeviceId,
  parseDeviceId,
  isValidDeviceId,
  formatDeviceId,
  DEVICE_ID_DIGIT_COUNT,
} from './deviceId.js';

describe('deviceId', () => {
  describe('normalizeDeviceId', () => {
    it('removes non-digit characters', () => {
      expect(normalizeDeviceId('482 913 742')).toBe('482913742');
      expect(normalizeDeviceId('482-913-742')).toBe('482913742');
      expect(normalizeDeviceId('ABC123DEF')).toBe('123');
      expect(normalizeDeviceId('')).toBe('');
    });

    it('preserves digits only', () => {
      expect(normalizeDeviceId('123456789')).toBe('123456789');
      expect(normalizeDeviceId('1')).toBe('1');
    });
  });

  describe('parseDeviceId', () => {
    it('returns null for invalid lengths', () => {
      expect(parseDeviceId('123')).toBeNull();
      expect(parseDeviceId('1234567890')).toBeNull();
      expect(parseDeviceId('')).toBeNull();
    });

    it('returns digits for valid 9-digit IDs', () => {
      expect(parseDeviceId('482913742')).toBe('482913742');
      expect(parseDeviceId('000000000')).toBe('000000000');
    });

    it('normalizes input before validation', () => {
      expect(parseDeviceId('482 913 742')).toBe('482913742');
      expect(parseDeviceId('482-913-742')).toBe('482913742');
    });
  });

  describe('isValidDeviceId', () => {
    it('returns true for valid 9-digit IDs', () => {
      expect(isValidDeviceId('482913742')).toBe(true);
      expect(isValidDeviceId('482 913 742')).toBe(true);
      expect(isValidDeviceId('482-913-742')).toBe(true);
    });

    it('returns false for invalid IDs', () => {
      expect(isValidDeviceId('123')).toBe(false);
      expect(isValidDeviceId('1234567890')).toBe(false);
      expect(isValidDeviceId('')).toBe(false);
      expect(isValidDeviceId('ABC')).toBe(false);
    });
  });

  describe('formatDeviceId', () => {
    it('formats 9-digit IDs with spaces', () => {
      expect(formatDeviceId('482913742')).toBe('482 913 742');
      expect(formatDeviceId('000000000')).toBe('000 000 000');
    });

    it('pads shorter IDs with leading zeros', () => {
      expect(formatDeviceId('123')).toBe('000 000 123');
      expect(formatDeviceId('12345')).toBe('000 012 345');
    });

    it('truncates longer IDs to 9 digits', () => {
      expect(formatDeviceId('1234567890')).toBe('123 456 789');
    });

    it('normalizes input before formatting', () => {
      expect(formatDeviceId('482 913 742')).toBe('482 913 742');
      expect(formatDeviceId('482-913-742')).toBe('482 913 742');
    });

    it('handles empty string', () => {
      expect(formatDeviceId('')).toBe('000 000 000');
    });
  });

  describe('DEVICE_ID_DIGIT_COUNT', () => {
    it('should be 9', () => {
      expect(DEVICE_ID_DIGIT_COUNT).toBe(9);
    });
  });
});
