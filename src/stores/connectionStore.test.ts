import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './connectionStore.js';

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useConnectionStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with idle status', () => {
      const store = useConnectionStore.getState();
      expect(store.status).toBe('idle');
    });

    it('has null initial values for optional fields', () => {
      const store = useConnectionStore.getState();
      expect(store.error).toBeNull();
      expect(store.roomId).toBeNull();
      expect(store.incoming).toBeNull();
      expect(store.role).toBeNull();
      expect(store.localStream).toBeNull();
      expect(store.remoteStream).toBeNull();
      expect(store.sharedDisplaySize).toBeNull();
      expect(store.inputUnavailableReason).toBeNull();
      expect(store.lastRemoteInput).toBeNull();
      expect(store.tokenCode).toBeNull();
      expect(store.tokenExpiresAt).toBeNull();
    });

    it('has correct default boolean values', () => {
      const store = useConnectionStore.getState();
      expect(store.signalingConnected).toBe(false);
      expect(store.sharing).toBe(false);
      expect(store.fullscreen).toBe(false);
      expect(store.inputSupported).toBe(false);
    });

    it('has correct default WebRTC states', () => {
      const store = useConnectionStore.getState();
      expect(store.rtcState).toBe('new');
      expect(store.iceState).toBe('new');
    });

    it('has zero counters', () => {
      const store = useConnectionStore.getState();
      expect(store.blockedAttempts).toBe(0);
      expect(store.clipboardSent).toBe(0);
      expect(store.clipboardReceived).toBe(0);
    });
  });

  describe('status transitions', () => {
    it('can transition from idle to connecting', () => {
      const store = useConnectionStore.getState();
      store.setStatus('connecting');
      expect(useConnectionStore.getState().status).toBe('connecting');
    });

    it('can transition through the full connection lifecycle', () => {
      const store = useConnectionStore.getState();
      store.setStatus('connecting');
      expect(useConnectionStore.getState().status).toBe('connecting');

      store.setStatus('waiting-for-approval');
      expect(useConnectionStore.getState().status).toBe('waiting-for-approval');

      store.setStatus('approved');
      expect(useConnectionStore.getState().status).toBe('approved');

      store.setStatus('negotiating');
      expect(useConnectionStore.getState().status).toBe('negotiating');

      store.setStatus('connected');
      expect(useConnectionStore.getState().status).toBe('connected');
    });

    it('can transition to error states', () => {
      const store = useConnectionStore.getState();
      store.setStatus('failed');
      expect(useConnectionStore.getState().status).toBe('failed');

      store.setStatus('disconnected');
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });
  });

  describe('error handling', () => {
    it('can set and clear error messages', () => {
      const store = useConnectionStore.getState();
      store.setError('Connection failed');
      expect(useConnectionStore.getState().error).toBe('Connection failed');

      store.setError(null);
      expect(useConnectionStore.getState().error).toBeNull();
    });
  });

  describe('role management', () => {
    it('can set client role', () => {
      const store = useConnectionStore.getState();
      store.setRole('client');
      expect(useConnectionStore.getState().role).toBe('client');
    });

    it('can set host role', () => {
      const store = useConnectionStore.getState();
      store.setRole('host');
      expect(useConnectionStore.getState().role).toBe('host');
    });

    it('can clear role', () => {
      const store = useConnectionStore.getState();
      store.setRole('client');
      expect(useConnectionStore.getState().role).toBe('client');

      store.setRole(null);
      expect(useConnectionStore.getState().role).toBeNull();
    });
  });

  describe('WebRTC state management', () => {
    it('can update RTC state', () => {
      const store = useConnectionStore.getState();
      store.setRtcState('connected');
      expect(useConnectionStore.getState().rtcState).toBe('connected');

      store.setRtcState('failed');
      expect(useConnectionStore.getState().rtcState).toBe('failed');
    });

    it('can update ICE state', () => {
      const store = useConnectionStore.getState();
      store.setIceState('connected');
      expect(useConnectionStore.getState().iceState).toBe('connected');

      store.setIceState('failed');
      expect(useConnectionStore.getState().iceState).toBe('failed');
    });
  });

  describe('room management', () => {
    it('can set room ID', () => {
      const store = useConnectionStore.getState();
      store.setRoomId('room-123');
      expect(useConnectionStore.getState().roomId).toBe('room-123');
    });

    it('can clear room ID', () => {
      const store = useConnectionStore.getState();
      store.setRoomId('room-123');
      expect(useConnectionStore.getState().roomId).toBe('room-123');

      store.setRoomId(null);
      expect(useConnectionStore.getState().roomId).toBeNull();
    });
  });

  describe('incoming request management', () => {
    it('can set incoming request', () => {
      const store = useConnectionStore.getState();
      const request = {
        roomId: 'room-123',
        fromDeviceId: '123 456 789',
        token: 'ABC123',
      };
      store.setIncoming(request);
      expect(useConnectionStore.getState().incoming).toEqual(request);
    });

    it('can clear incoming request', () => {
      const store = useConnectionStore.getState();
      const request = {
        roomId: 'room-123',
        fromDeviceId: '123 456 789',
        token: 'ABC123',
      };
      store.setIncoming(request);
      expect(useConnectionStore.getState().incoming).toEqual(request);

      store.setIncoming(null);
      expect(useConnectionStore.getState().incoming).toBeNull();
    });
  });

  describe('screen sharing state', () => {
    it('can toggle sharing state', () => {
      const store = useConnectionStore.getState();
      expect(useConnectionStore.getState().sharing).toBe(false);

      store.setSharing(true);
      expect(useConnectionStore.getState().sharing).toBe(true);

      store.setSharing(false);
      expect(useConnectionStore.getState().sharing).toBe(false);
    });

    it('can set local stream', () => {
      const store = useConnectionStore.getState();
      const mockStream = {} as MediaStream;
      store.setLocalStream(mockStream);
      expect(useConnectionStore.getState().localStream).toBe(mockStream);
    });

    it('can set remote stream', () => {
      const store = useConnectionStore.getState();
      const mockStream = {} as MediaStream;
      store.setRemoteStream(mockStream);
      expect(useConnectionStore.getState().remoteStream).toBe(mockStream);
    });

    it('can set shared display size', () => {
      const store = useConnectionStore.getState();
      const size = { width: 1920, height: 1080 };
      store.setSharedDisplaySize(size);
      expect(useConnectionStore.getState().sharedDisplaySize).toEqual(size);
    });
  });

  describe('input capability management', () => {
    it('can set input as supported', () => {
      const store = useConnectionStore.getState();
      store.setInputCapability(true, null);
      expect(useConnectionStore.getState().inputSupported).toBe(true);
      expect(useConnectionStore.getState().inputUnavailableReason).toBeNull();
    });

    it('can set input as unsupported with reason', () => {
      const store = useConnectionStore.getState();
      store.setInputCapability(false, 'Wayland not supported');
      expect(useConnectionStore.getState().inputSupported).toBe(false);
      expect(useConnectionStore.getState().inputUnavailableReason).toBe('Wayland not supported');
    });
  });

  describe('token management', () => {
    it('can set token code and expiry', () => {
      const store = useConnectionStore.getState();
      const expiresAt = Date.now() + 600000;
      store.setToken('ABC123', expiresAt);
      expect(useConnectionStore.getState().tokenCode).toBe('ABC123');
      expect(useConnectionStore.getState().tokenExpiresAt).toBe(expiresAt);
    });

    it('can clear token', () => {
      const store = useConnectionStore.getState();
      store.setToken('ABC123', Date.now() + 600000);
      expect(useConnectionStore.getState().tokenCode).toBe('ABC123');

      store.setToken(null, null);
      expect(useConnectionStore.getState().tokenCode).toBeNull();
      expect(useConnectionStore.getState().tokenExpiresAt).toBeNull();
    });

    it('can set token input', () => {
      const store = useConnectionStore.getState();
      store.setTokenInput('ABC123');
      expect(useConnectionStore.getState().tokenInput).toBe('ABC123');
    });

    it('increments blocked attempts', () => {
      const store = useConnectionStore.getState();
      expect(useConnectionStore.getState().blockedAttempts).toBe(0);

      store.incrementBlockedAttempts();
      expect(useConnectionStore.getState().blockedAttempts).toBe(1);

      store.incrementBlockedAttempts();
      store.incrementBlockedAttempts();
      expect(useConnectionStore.getState().blockedAttempts).toBe(3);
    });
  });

  describe('clipboard sync counters', () => {
    it('increments clipboard sent counter', () => {
      const store = useConnectionStore.getState();
      expect(useConnectionStore.getState().clipboardSent).toBe(0);

      store.incrementClipboardSent();
      expect(useConnectionStore.getState().clipboardSent).toBe(1);

      store.incrementClipboardSent();
      store.incrementClipboardSent();
      expect(useConnectionStore.getState().clipboardSent).toBe(3);
    });

    it('increments clipboard received counter', () => {
      const store = useConnectionStore.getState();
      expect(useConnectionStore.getState().clipboardReceived).toBe(0);

      store.incrementClipboardReceived();
      expect(useConnectionStore.getState().clipboardReceived).toBe(1);

      store.incrementClipboardReceived();
      store.incrementClipboardReceived();
      expect(useConnectionStore.getState().clipboardReceived).toBe(3);
    });
  });

  describe('reset functionality', () => {
    it('resets all state to initial values', () => {
      const store = useConnectionStore.getState();
      // Set various states
      store.setStatus('connected');
      store.setError('Test error');
      store.setRoomId('room-123');
      store.setRole('client');
      store.setRtcState('connected');
      store.setIceState('connected');
      store.setSharing(true);
      store.setFullscreen(true);
      store.setSharedDisplaySize({ width: 1920, height: 1080 });
      store.setInputCapability(true, null);
      store.setLastRemoteInput('mouse move (0.50, 0.50)');
      store.setToken('ABC123', Date.now() + 600000);
      store.setTokenInput('ABC123');
      store.incrementBlockedAttempts();
      store.incrementClipboardSent();
      store.incrementClipboardReceived();

      // Reset
      store.reset();

      // Verify all reset to initial values
      const resetStore = useConnectionStore.getState();
      expect(resetStore.status).toBe('idle');
      expect(resetStore.error).toBeNull();
      expect(resetStore.roomId).toBeNull();
      expect(resetStore.role).toBeNull();
      expect(resetStore.rtcState).toBe('new');
      expect(resetStore.iceState).toBe('new');
      expect(resetStore.sharing).toBe(false);
      expect(resetStore.fullscreen).toBe(false);
      expect(resetStore.sharedDisplaySize).toBeNull();
      expect(resetStore.inputSupported).toBe(false);
      expect(resetStore.inputUnavailableReason).toBeNull();
      expect(resetStore.lastRemoteInput).toBeNull();
      expect(resetStore.tokenCode).toBeNull();
      expect(resetStore.tokenExpiresAt).toBeNull();
      expect(resetStore.blockedAttempts).toBe(0);
      expect(resetStore.clipboardSent).toBe(0);
      expect(resetStore.clipboardReceived).toBe(0);
    });

    it('preserves remoteId and tokenInput after reset', () => {
      const store = useConnectionStore.getState();
      store.setRemoteId('123 456 789');
      store.setTokenInput('ABC123');

      store.reset();

      const resetStore = useConnectionStore.getState();
      expect(resetStore.remoteId).toBe('123 456 789');
      expect(resetStore.tokenInput).toBe('ABC123');
    });
  });

  describe('signaling connection state', () => {
    it('can set signaling connected state', () => {
      const store = useConnectionStore.getState();
      store.setSignalingConnected(true);
      expect(useConnectionStore.getState().signalingConnected).toBe(true);

      store.setSignalingConnected(false);
      expect(useConnectionStore.getState().signalingConnected).toBe(false);
    });
  });

  describe('fullscreen state', () => {
    it('can toggle fullscreen', () => {
      const store = useConnectionStore.getState();
      expect(useConnectionStore.getState().fullscreen).toBe(false);

      store.setFullscreen(true);
      expect(useConnectionStore.getState().fullscreen).toBe(true);

      store.setFullscreen(false);
      expect(useConnectionStore.getState().fullscreen).toBe(false);
    });
  });

  describe('last remote input', () => {
    it('can set last remote input summary', () => {
      const store = useConnectionStore.getState();
      store.setLastRemoteInput('mouse move (0.50, 0.50)');
      expect(useConnectionStore.getState().lastRemoteInput).toBe('mouse move (0.50, 0.50)');

      store.setLastRemoteInput(null);
      expect(useConnectionStore.getState().lastRemoteInput).toBeNull();
    });
  });
});
