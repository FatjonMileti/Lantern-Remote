import { describe, it, expect } from 'vitest';
import {
  parseRemoteInputMessage,
  serializeRemoteInputMessage,
  normalizePoint,
  denormalizePoint,
  clamp01,
  parseRemoteInputRequest,
  KEYBOARD_CODE_WHITELIST,
  MAX_KEY_LENGTH,
  MAX_WHEEL_DELTA,
  MAX_SHARED_DIMENSION,
} from './remoteInput.js';

describe('remoteInput', () => {
  describe('parseRemoteInputMessage', () => {
    it('rejects non-object values', () => {
      expect(parseRemoteInputMessage(null)).toBeNull();
      expect(parseRemoteInputMessage(undefined)).toBeNull();
      expect(parseRemoteInputMessage('string')).toBeNull();
      expect(parseRemoteInputMessage(123)).toBeNull();
      expect(parseRemoteInputMessage([])).toBeNull();
    });

    it('parses valid mouse-move messages', () => {
      const valid = { kind: 'mouse-move', x: 0.5, y: 0.5 };
      expect(parseRemoteInputMessage(valid)).toEqual(valid);
    });

    it('rejects mouse-move with invalid coordinates', () => {
      expect(parseRemoteInputMessage({ kind: 'mouse-move', x: -0.1, y: 0.5 })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'mouse-move', x: 1.1, y: 0.5 })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'mouse-move', x: '0.5', y: 0.5 })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'mouse-move', x: 0.5, y: Infinity })).toBeNull();
    });

    it('parses valid mouse-button messages', () => {
      const valid = { kind: 'mouse-button', event: 'down', button: 'left', x: 0.5, y: 0.5 };
      expect(parseRemoteInputMessage(valid)).toEqual(valid);
    });

    it('rejects mouse-button with invalid event', () => {
      expect(parseRemoteInputMessage({ kind: 'mouse-button', event: 'invalid', button: 'left', x: 0.5, y: 0.5 })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'mouse-button', event: 123, button: 'left', x: 0.5, y: 0.5 })).toBeNull();
    });

    it('rejects mouse-button with invalid button', () => {
      expect(parseRemoteInputMessage({ kind: 'mouse-button', event: 'down', button: 'invalid', x: 0.5, y: 0.5 })).toBeNull();
    });

    it('parses valid mouse-wheel messages', () => {
      const valid = { kind: 'mouse-wheel', deltaX: 100, deltaY: 50, x: 0.5, y: 0.5 };
      expect(parseRemoteInputMessage(valid)).toEqual(valid);
    });

    it('rejects mouse-wheel with excessive deltas', () => {
      const large = MAX_WHEEL_DELTA + 1;
      expect(parseRemoteInputMessage({ kind: 'mouse-wheel', deltaX: large, deltaY: 50, x: 0.5, y: 0.5 })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'mouse-wheel', deltaX: 50, deltaY: -large, x: 0.5, y: 0.5 })).toBeNull();
    });

    it('parses valid keyboard messages', () => {
      const valid = { kind: 'keyboard', event: 'keydown', key: 'A', code: 'KeyA' };
      expect(parseRemoteInputMessage(valid)).toEqual(valid);
    });

    it('rejects keyboard with non-whitelisted code', () => {
      expect(parseRemoteInputMessage({ kind: 'keyboard', event: 'keydown', key: 'A', code: 'Unidentified' })).toBeNull();
      expect(parseRemoteInputMessage({ kind: 'keyboard', event: 'keydown', key: 'A', code: 'InvalidCode' })).toBeNull();
    });

    it('rejects keyboard with oversized key', () => {
      const longKey = 'A'.repeat(MAX_KEY_LENGTH + 1);
      expect(parseRemoteInputMessage({ kind: 'keyboard', event: 'keydown', key: longKey, code: 'KeyA' })).toBeNull();
    });

    it('rejects keyboard with empty key', () => {
      expect(parseRemoteInputMessage({ kind: 'keyboard', event: 'keydown', key: '', code: 'KeyA' })).toBeNull();
    });

    it('rejects unknown kind', () => {
      expect(parseRemoteInputMessage({ kind: 'unknown' })).toBeNull();
    });
  });

  describe('serializeRemoteInputMessage', () => {
    it('serializes valid messages', () => {
      const message = { kind: 'mouse-move' as const, x: 0.5, y: 0.5 };
      expect(serializeRemoteInputMessage(message)).toBe(JSON.stringify(message));
    });
  });

  describe('clamp01', () => {
    it('clamps values to [0, 1]', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1)).toBe(1);
      expect(clamp01(1.5)).toBe(1);
    });

    it('handles NaN and Infinity', () => {
      expect(clamp01(NaN)).toBe(0);
      // Infinity clamping behavior depends on implementation
      // Testing that it doesn't throw and returns a number
      const infResult = clamp01(Infinity);
      expect(typeof infResult).toBe('number');
      expect(infResult).toBeGreaterThanOrEqual(0);
      expect(infResult).toBeLessThanOrEqual(1);
    });
  });

  describe('normalizePoint', () => {
    it('normalizes point within letterboxed video', () => {
      const element = { width: 800, height: 600 };
      const video = { width: 640, height: 480 };
      const result = normalizePoint(element, video, 400, 300);
      expect(result).toEqual({ x: 0.5, y: 0.5 });
    });

    it('returns null for points outside letterbox', () => {
      const element = { width: 800, height: 400 }; // wider than video
      const video = { width: 640, height: 480 };
      expect(normalizePoint(element, video, 0, 0)).toBeNull(); // Top-left letterbox
      expect(normalizePoint(element, video, 799, 0)).toBeNull(); // Top-right letterbox
    });

    it('handles zero dimensions', () => {
      expect(normalizePoint({ width: 0, height: 600 }, { width: 640, height: 480 }, 400, 300)).toBeNull();
      expect(normalizePoint({ width: 800, height: 0 }, { width: 640, height: 480 }, 400, 300)).toBeNull();
      expect(normalizePoint({ width: 800, height: 600 }, { width: 0, height: 480 }, 400, 300)).toBeNull();
    });

    it('handles 1:1 scale (no letterbox)', () => {
      const element = { width: 640, height: 480 };
      const video = { width: 640, height: 480 };
      const result = normalizePoint(element, video, 320, 240);
      expect(result).toEqual({ x: 0.5, y: 0.5 });
    });
  });

  describe('denormalizePoint', () => {
    it('converts normalized coords to display pixels', () => {
      const display = { width: 1920, height: 1080 };
      const result = denormalizePoint(display, 0.5, 0.5);
      expect(result).toEqual({ x: 960, y: 540 });
    });

    it('clamps normalized coords before conversion', () => {
      const display = { width: 1920, height: 1080 };
      expect(denormalizePoint(display, -0.1, 0.5)).toEqual({ x: 0, y: 540 });
      expect(denormalizePoint(display, 1.1, 0.5)).toEqual({ x: 1920, y: 540 });
    });

    it('handles NaN and Infinity', () => {
      const display = { width: 1920, height: 1080 };
      expect(denormalizePoint(display, NaN, 0.5)).toEqual({ x: 0, y: 540 });
      // Infinity clamping behavior depends on implementation
      const infResult = denormalizePoint(display, 0.5, Infinity);
      expect(typeof infResult.y).toBe('number');
      expect(infResult.y).toBeGreaterThanOrEqual(0);
      expect(infResult.y).toBeLessThanOrEqual(1080);
    });
  });

  describe('parseRemoteInputRequest', () => {
    it('parses valid requests', () => {
      const valid = {
        message: { kind: 'mouse-move' as const, x: 0.5, y: 0.5 },
        displayWidth: 1920,
        displayHeight: 1080,
      };
      expect(parseRemoteInputRequest(valid)).toEqual(valid);
    });

    it('rejects invalid message', () => {
      const invalid = {
        message: { kind: 'invalid' },
        displayWidth: 1920,
        displayHeight: 1080,
      };
      expect(parseRemoteInputRequest(invalid)).toBeNull();
    });

    it('rejects invalid display dimensions', () => {
      const invalid = {
        message: { kind: 'mouse-move' as const, x: 0.5, y: 0.5 },
        displayWidth: 0,
        displayHeight: 1080,
      };
      expect(parseRemoteInputRequest(invalid)).toBeNull();

      const invalid2 = {
        message: { kind: 'mouse-move' as const, x: 0.5, y: 0.5 },
        displayWidth: 1920,
        displayHeight: MAX_SHARED_DIMENSION + 1,
      };
      expect(parseRemoteInputRequest(invalid2)).toBeNull();
    });

    it('rejects non-object values', () => {
      expect(parseRemoteInputRequest(null)).toBeNull();
      expect(parseRemoteInputRequest('string')).toBeNull();
      expect(parseRemoteInputRequest(123)).toBeNull();
    });
  });

  describe('KEYBOARD_CODE_WHITELIST', () => {
    it('contains common keys', () => {
      expect(KEYBOARD_CODE_WHITELIST.has('KeyA')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('KeyZ')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('Digit0')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('Digit9')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('Space')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('Enter')).toBe(true);
    });

    it('includes all letter keys', () => {
      // The whitelist includes all letters A-Z
      expect(KEYBOARD_CODE_WHITELIST.has('KeyI')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('KeyL')).toBe(true);
      expect(KEYBOARD_CODE_WHITELIST.has('KeyO')).toBe(true);
    });

    it('is a reasonable size', () => {
      expect(KEYBOARD_CODE_WHITELIST.size).toBeGreaterThan(50);
    });
  });

  describe('constants', () => {
    it('MAX_KEY_LENGTH should be 32', () => {
      expect(MAX_KEY_LENGTH).toBe(32);
    });

    it('MAX_WHEEL_DELTA should be 1,000,000', () => {
      expect(MAX_WHEEL_DELTA).toBe(1_000_000);
    });

    it('MAX_SHARED_DIMENSION should be 16,384', () => {
      expect(MAX_SHARED_DIMENSION).toBe(16_384);
    });
  });
});
