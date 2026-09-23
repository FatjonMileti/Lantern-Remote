import { create } from 'zustand';
import type { ConnectionStatus } from '../../shared/types.js';

export interface IncomingRequest {
  roomId: string;
  fromDeviceId: string;
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
  reset: () => void;
}

/**
 * Connection lifecycle store.
 * Phase 2 drives idle → connecting → waiting-for-approval → approved / failed.
 * Phase 3 extends to negotiating → connected / disconnected / failed plus
 * live RTCPeerConnection and ICE states for diagnostics.
 * Phase 4 adds local/remote MediaStreams and the sharing flag.
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
    }),
}));
