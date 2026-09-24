import { create } from 'zustand';
import type { ConnectionStatus } from '../../shared/types.js';

export interface IncomingRequest {
  roomId: string;
  fromDeviceId: string;
  /** Presented code — validated against the live code before any modal. */
  token: string;
}

export type SessionRole = 'client' | 'host';

interface ConnectionState {
  status: ConnectionStatus;
  remoteId: string;
  error: string | null;
  roomId: string | null;
  incoming: IncomingRequest | null;
  signalingConnected: boolean;
  role: SessionRole | null;
  rtcState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  sharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  fullscreen: boolean;
  /** True shared-display size (from the capture track) for denormalization. */
  sharedDisplaySize: { width: number; height: number } | null;
  /** Host adapter capability — the honest unsupported state. */
  inputSupported: boolean;
  inputUnavailableReason: string | null;
  /** Last received input summary, kind + normalized coords (diagnostics). */
  lastRemoteInput: string | null;
  /** Client-typed connection code (normalized as typed, validated on send). */
  tokenInput: string;
  /** Host's live code display (mirrors main; cleared on teardown). */
  tokenCode: string | null;
  tokenExpiresAt: number | null;
  /** Incorrect-code attempts auto-rejected without showing a modal. */
  blockedAttempts: number;
  setRemoteId: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setRoomId: (roomId: string | null) => void;
  setIncoming: (incoming: IncomingRequest | null) => void;
  setSignalingConnected: (connected: boolean) => void;
  setRole: (role: SessionRole | null) => void;
  setRtcState: (state: RTCPeerConnectionState) => void;
  setIceState: (state: RTCIceConnectionState) => void;
  setSharing: (sharing: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setSharedDisplaySize: (size: { width: number; height: number } | null) => void;
  setInputCapability: (supported: boolean, reason: string | null) => void;
  setLastRemoteInput: (summary: string | null) => void;
  setTokenInput: (tokenInput: string) => void;
  setToken: (code: string | null, expiresAt: number | null) => void;
  incrementBlockedAttempts: () => void;
  reset: () => void;
}

/**
 * Connection lifecycle store.
 * Phase 2 drives idle → connecting → waiting-for-approval → approved / failed.
 * Phase 3 extends to negotiating → connected / disconnected / failed plus
 * live RTCPeerConnection and ICE states for diagnostics.
 * Phase 4 adds local/remote MediaStreams and the sharing flag.
 * Phase 6 adds shared display size, input capability, and last-input readout.
 * Phase 8 adds connection-code fields and the blocked-attempts counter.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  remoteId: '',
  error: null,
  roomId: null,
  incoming: null,
  signalingConnected: false,
  role: null,
  rtcState: 'new',
  iceState: 'new',
  sharing: false,
  localStream: null,
  remoteStream: null,
  fullscreen: false,
  sharedDisplaySize: null,
  inputSupported: false,
  inputUnavailableReason: null,
  lastRemoteInput: null,
  tokenInput: '',
  tokenCode: null,
  tokenExpiresAt: null,
  blockedAttempts: 0,
  setRemoteId: (remoteId) => set({ remoteId }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setRoomId: (roomId) => set({ roomId }),
  setIncoming: (incoming) => set({ incoming }),
  setSignalingConnected: (signalingConnected) => set({ signalingConnected }),
  setRole: (role) => set({ role }),
  setRtcState: (rtcState) => set({ rtcState }),
  setIceState: (iceState) => set({ iceState }),
  setSharing: (sharing) => set({ sharing }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setSharedDisplaySize: (sharedDisplaySize) => set({ sharedDisplaySize }),
  setInputCapability: (supported, reason) =>
    set({ inputSupported: supported, inputUnavailableReason: reason }),
  setLastRemoteInput: (lastRemoteInput) => set({ lastRemoteInput }),
  setTokenInput: (tokenInput) => set({ tokenInput }),
  setToken: (tokenCode, tokenExpiresAt) => set({ tokenCode, tokenExpiresAt }),
  incrementBlockedAttempts: () => set((s) => ({ blockedAttempts: s.blockedAttempts + 1 })),
  reset: () =>
    set({
      status: 'idle',
      error: null,
      roomId: null,
      incoming: null,
      role: null,
      rtcState: 'new',
      iceState: 'new',
      sharing: false,
      localStream: null,
      remoteStream: null,
      fullscreen: false,
      sharedDisplaySize: null,
      inputSupported: false,
      inputUnavailableReason: null,
      lastRemoteInput: null,
      tokenCode: null,
      tokenExpiresAt: null,
      blockedAttempts: 0,
    }),
}));
