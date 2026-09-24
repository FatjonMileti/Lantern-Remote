import { describe, it, expect } from 'vitest';
import {
  isValidTokenFormat,
  normalizeTokenInput,
  TOKEN_LENGTH,
  TOKEN_ALPHABET,
} from './connectionToken.js';

describe('connectionToken', () => {
  describe('isValidTokenFormat', () => {
    it('returns true for valid 6-character codes', () => {
      expect(isValidTokenFormat('ABC234')).toBe(true);
      expect(isValidTokenFormat('JKMNPQ')).toBe(true);
      expect(isValidTokenFormat('234567')).toBe(true);
    });

    it('returns false for invalid lengths', () => {
      expect(isValidTokenFormat('')).toBe(false);
      expect(isValidTokenFormat('A')).toBe(false);
      expect(isValidTokenFormat('ABC1234')).toBe(false);
    });

    it('returns false for characters outside alphabet', () => {
      expect(isValidTokenFormat('ABC12O')).toBe(false); // O is excluded
      expect(isValidTokenFormat('ABC12I')).toBe(false); // I is excluded
      expect(isValidTokenFormat('ABC12L')).toBe(false); // L is excluded
      expect(isValidTokenFormat('ABC120')).toBe(false); // 0 is excluded
      expect(isValidTokenFormat('ABC12!')).toBe(false); // special character
    });

    it('returns false for non-string types', () => {
      expect(isValidTokenFormat(null)).toBe(false);
      expect(isValidTokenFormat(undefined)).toBe(false);
      expect(isValidTokenFormat(123)).toBe(false);
      expect(isValidTokenFormat({})).toBe(false);
      expect(isValidTokenFormat([])).toBe(false);
    });

    it('accepts only characters from the alphabet', () => {
      expect(isValidTokenFormat('ABCDEFG')).toBe(false); // 7 chars
      expect(isValidTokenFormat('JKMNPQ')).toBe(true); // valid
      expect(isValidTokenFormat('234567')).toBe(true); // valid
    });
  });

  describe('normalizeTokenInput', () => {
    it('converts to uppercase', () => {
      expect(normalizeTokenInput('abc234')).toBe('ABC234');
      expect(normalizeTokenInput('AbC234')).toBe('ABC234');
    });

    it('removes characters outside alphabet', () => {
      expect(normalizeTokenInput('ABC23O')).toBe('ABC23');
      expect(normalizeTokenInput('ABC23I')).toBe('ABC23');
      expect(normalizeTokenInput('ABC23L')).toBe('ABC23');
      expect(normalizeTokenInput('ABC23!')).toBe('ABC23');
      expect(normalizeTokenInput('AB C23')).toBe('ABC23');
    });

    it('truncates to TOKEN_LENGTH', () => {
      expect(normalizeTokenInput('ABCDEFGH')).toBe('ABCDEF');
      expect(normalizeTokenInput('23456789')).toBe('234567');
    });

    it('handles empty string', () => {
      expect(normalizeTokenInput('')).toBe('');
    });

    it('preserves valid characters', () => {
      expect(normalizeTokenInput('JKMNPQ')).toBe('JKMNPQ');
      expect(normalizeTokenInput('234567')).toBe('234567');
    });
  });

  describe('TOKEN_LENGTH', () => {
    it('should be 6', () => {
      expect(TOKEN_LENGTH).toBe(6);
    });
  });

  describe('TOKEN_ALPHABET', () => {
    it('should not contain ambiguous characters', () => {
      expect(TOKEN_ALPHABET).not.toContain('0');
      expect(TOKEN_ALPHABET).not.toContain('O');
      expect(TOKEN_ALPHABET).not.toContain('1');
      expect(TOKEN_ALPHABET).not.toContain('I');
      expect(TOKEN_ALPHABET).not.toContain('L');
    });

    it('should contain uppercase letters and digits', () => {
      expect(TOKEN_ALPHABET).toMatch(/^[A-Z0-9]+$/);
    });

    it('should have reasonable length', () => {
      expect(TOKEN_ALPHABET.length).toBeGreaterThan(20);
    });
  });
});
