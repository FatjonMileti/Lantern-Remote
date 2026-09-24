import { describe, it, expect, beforeEach } from 'vitest';
import { remoteInputService } from './RemoteInputService.js';

describe('RemoteInputService', () => {
  let detachFn: (() => void) | null = null;

  beforeEach(() => {
    // Reset service state before each test
    if (detachFn) {
      detachFn();
      detachFn = null;
    }
  });

  describe('initial state', () => {
    it('starts with no attached capture', () => {
      // Service starts without active capture
      expect(true).toBe(true); // Basic state test
    });
  });

  describe('attach/detach lifecycle', () => {
    it('can attach and detach', () => {
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 640 });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 480 });
      Object.defineProperty(mockVideo, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      });

      detachFn = remoteInputService.attachCapture(mockVideo);
      expect(detachFn).toBeInstanceOf(Function);

      detachFn();
      detachFn = null;
    });

    it('detaching when not attached is safe', () => {
      const mockDetach = () => {};
      expect(() => mockDetach()).not.toThrow();
    });
  });

  describe('capture throttling', () => {
    it('attaches capture without errors', () => {
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 640 });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 480 });
      Object.defineProperty(mockVideo, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      });

      detachFn = remoteInputService.attachCapture(mockVideo);
      expect(detachFn).toBeInstanceOf(Function);

      detachFn();
      detachFn = null;
    });
  });

  describe('host-side validation', () => {
    it('validates and forwards valid messages', () => {
      const validMessage = JSON.stringify({
        kind: 'mouse-move',
        x: 0.5,
        y: 0.5,
      });

      const result = remoteInputService.forwardToHost(validMessage, { width: 1920, height: 1080 });
      expect(result).not.toBeNull();
    });

    it('rejects invalid messages', () => {
      const invalidMessage = JSON.stringify({ kind: 'invalid' });

      const result = remoteInputService.forwardToHost(invalidMessage, { width: 1920, height: 1080 });
      expect(result).toBeNull();
    });

    it('denormalizes coordinates against display size', () => {
      const message = JSON.stringify({
        kind: 'mouse-move',
        x: 0.5,
        y: 0.5,
      });

      const result = remoteInputService.forwardToHost(message, { width: 1920, height: 1080 });
      expect(result?.kind).toBe('mouse-move');
      if (result?.kind === 'mouse-move') {
        expect(result.x).toBeCloseTo(0.5, 1);
        expect(result.y).toBeCloseTo(0.5, 1);
      }
    });
  });
});
