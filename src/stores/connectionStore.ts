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
  setRemoteId: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setRoomId: (roomId: string | null) => void;
  setIncoming: (incoming: IncomingRequest | null) => void;
  setSignalingConnected: (connected: boolean) => void;
  setRole: (role: SessionRole | null) => void;
  setRtcState: (state: RTCPeerConnectionState) => void;
  setIceState: (state: RTCIceConnectionState) => void;
  reset: () => void;
}

/**
 * Connection lifecycle store.
 * Phase 2 drives idle → connecting → waiting-for-approval → approved / failed.
 * Phase 3 extends to negotiating → connected / disconnected / failed plus
 * live RTCPeerConnection and ICE states for diagnostics.
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
  setRemoteId: (remoteId) => set({ remoteId }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setRoomId: (roomId) => set({ roomId }),
  setIncoming: (incoming) => set({ incoming }),
  setSignalingConnected: (signalingConnected) => set({ signalingConnected }),
  setRole: (role) => set({ role }),
  setRtcState: (rtcState) => set({ rtcState }),
  setIceState: (iceState) => set({ iceState }),
  reset: () =>
    set({
      status: 'idle',
      error: null,
      roomId: null,
      incoming: null,
      role: null,
      rtcState: 'new',
      iceState: 'new',
    }),
}));
