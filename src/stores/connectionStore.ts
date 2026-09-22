import { create } from 'zustand';
import type { ConnectionStatus } from '../../shared/types.js';

interface ConnectionState {
  status: ConnectionStatus;
  remoteId: string;
  error: string | null;
  setRemoteId: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Connection lifecycle store (Phase 1 skeleton).
 * Signaling + WebRTC transitions land in Phases 2-4.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  remoteId: '',
  error: null,
  setRemoteId: (remoteId) => set({ remoteId }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () => set({ status: 'idle', error: null }),
}));
