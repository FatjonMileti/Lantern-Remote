import { create } from 'zustand';
import type { ConnectionStatus } from '../../shared/types.js';

export interface IncomingRequest {
  roomId: string;
  fromDeviceId: string;
}

interface ConnectionState {
  status: ConnectionStatus;
  remoteId: string;
  error: string | null;
  roomId: string | null;
  incoming: IncomingRequest | null;
  signalingConnected: boolean;
  setRemoteId: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setRoomId: (roomId: string | null) => void;
  setIncoming: (incoming: IncomingRequest | null) => void;
  setSignalingConnected: (connected: boolean) => void;
  reset: () => void;
}

/**
 * Connection lifecycle store.
 * Phase 2 drives idle → connecting → waiting-for-approval → approved / failed.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  remoteId: '',
  error: null,
  roomId: null,
  incoming: null,
  signalingConnected: false,
  setRemoteId: (remoteId) => set({ remoteId }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setRoomId: (roomId) => set({ roomId }),
  setIncoming: (incoming) => set({ incoming }),
  setSignalingConnected: (signalingConnected) => set({ signalingConnected }),
  reset: () =>
    set({
      status: 'idle',
      error: null,
      roomId: null,
      incoming: null,
    }),
}));
