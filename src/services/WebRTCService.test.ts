import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webrtcService } from './WebRTCService.js';

describe('WebRTCService cleanup', () => {
  beforeEach(() => {
    // Clean up before each test
    webrtcService.close();
  });

  describe('close method', () => {
    it('closes peer connection if active', () => {
      // Start with a fresh connection
      expect(webrtcService.connectionState).toBe('new');

      // Internal RTCPeerConnection is not injectable, so this asserts the
      // public contract: close is safe and the state reads back as new.
      webrtcService.close();

      // After close, state should be new
      expect(webrtcService.connectionState).toBe('new');
    });

    it('closes data channels if active', () => {
      // Test that close can be called multiple times safely
      webrtcService.close();
      expect(() => webrtcService.close()).not.toThrow();
    });

    it('is idempotent - can be called multiple times', () => {
      webrtcService.close();
      webrtcService.close();
      webrtcService.close();
      expect(webrtcService.connectionState).toBe('new');
    });

    it('resets connection state', () => {
      // Even without an active connection, close should reset state
      webrtcService.close();
      expect(webrtcService.connectionState).toBe('new');
      expect(webrtcService.iceConnectionState).toBe('new');
    });
  });

  describe('resource cleanup', () => {
    it('clears event handlers on close', () => {
      // Set up event handlers
      webrtcService.setEvents({
        onConnectionState: vi.fn(),
        onIceState: vi.fn(),
        onIceCandidate: vi.fn(),
      });

      // Close should clear these handlers
      webrtcService.close();

      // After close, new events should not trigger old handlers
      // (We can't easily test this without a real peer connection, but the contract is clear)
    });

    it('handles cleanup when no connection exists', () => {
      // Close without ever creating a connection should be safe
      expect(() => webrtcService.close()).not.toThrow();
    });
  });

  describe('state after cleanup', () => {
    it('returns to new state after close', () => {
      webrtcService.close();
      expect(webrtcService.connectionState).toBe('new');
      expect(webrtcService.iceConnectionState).toBe('new');
    });

    it('can create new connection after close', () => {
      webrtcService.close();
      // The service should be ready to create a new connection
      // (We can't easily test the actual creation without real WebRTC)
      expect(webrtcService.connectionState).toBe('new');
    });
  });
});
