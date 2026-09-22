/**
 * Connection lifecycle states (Phase 1 skeleton).
 * Full transitions + signaling/WebRTC wiring land in Phases 2-4.
 */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'waiting-for-approval'
  | 'approved'
  | 'negotiating'
  | 'connected'
  | 'disconnected'
  | 'failed';

export interface DeviceInfo {
  /** Human-readable device id, e.g. "482 913 742". Placeholder until Phase 2. */
  deviceId: string;
}
