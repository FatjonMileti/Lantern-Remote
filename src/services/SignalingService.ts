import { io, type Socket } from 'socket.io-client';
import { parseDeviceId } from '../../shared/deviceId.js';
import {
  CONNECTION_REQUEST_TIMEOUT_MS,
  SIGNALING_ERROR_MESSAGES,
  SIGNALING_EVENTS,
  signalingError,
  type ConnectionDecisionPayload,
  type IncomingConnectionPayload,
  type PeerDisconnectedPayload,
  type SignalingAck,
  type SignalingErrorCode,
} from '../../shared/signaling.js';

export type SignalingListener = {
  onIncoming?: (payload: IncomingConnectionPayload) => void;
  onAccepted?: (payload: ConnectionDecisionPayload) => void;
  onRejected?: (payload: ConnectionDecisionPayload) => void;
  onPeerDisconnected?: (payload: PeerDisconnectedPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onUnavailable?: (message: string) => void;
};

function isAck(value: unknown): value is SignalingAck {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.ok === true || record.ok === false;
}

function ackError(ack: SignalingAck | null | undefined, fallback: SignalingErrorCode): never {
  if (ack && ack.ok === false) {
    throw Object.assign(new Error(ack.error.message), { code: ack.error.code });
  }
  const err = signalingError(fallback);
  throw Object.assign(new Error(err.message), { code: err.code });
}

/**
 * Renderer signaling client. WebRTC media stays out of this service.
 */
export class SignalingService {
  private socket: Socket | null = null;
  private deviceId: string | null = null;
  private listeners: SignalingListener = {};
  private requestTimer: ReturnType<typeof setTimeout> | null = null;

  setListeners(listeners: SignalingListener): void {
    this.listeners = listeners;
  }

  get connected(): boolean {
    return Boolean(this.socket?.connected);
  }

  connect(url: string, deviceId: string): void {
    const digits = parseDeviceId(deviceId);
    if (!digits) {
      this.listeners.onUnavailable?.(SIGNALING_ERROR_MESSAGES.INVALID_ID);
      return;
    }
    if (this.socket && this.deviceId === digits) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    this.disconnect();
    this.deviceId = digits;

    const socket = io(url, {
      autoConnect: true,
      reconnection: true,
      timeout: 8000,
      transports: ['websocket', 'polling'],
    });
    this.socket = socket;

    socket.on('connect', () => {
      socket.emit(SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: digits }, (ack: unknown) => {
        if (!isAck(ack) || ack.ok === false) {
          this.listeners.onUnavailable?.(SIGNALING_ERROR_MESSAGES.NOT_REGISTERED);
          return;
        }
        this.listeners.onConnected?.();
      });
    });

    socket.on('connect_error', () => {
      this.listeners.onUnavailable?.(SIGNALING_ERROR_MESSAGES.SERVER_UNAVAILABLE);
    });

    socket.on('disconnect', () => {
      this.listeners.onDisconnected?.();
    });

    socket.on(SIGNALING_EVENTS.INCOMING_CONNECTION, (raw: unknown) => {
      const payload = parseIncoming(raw);
      if (payload) this.listeners.onIncoming?.(payload);
    });

    socket.on(SIGNALING_EVENTS.CONNECTION_ACCEPTED, (raw: unknown) => {
      this.clearRequestTimer();
      const payload = parseDecision(raw);
      if (payload) this.listeners.onAccepted?.(payload);
    });

    socket.on(SIGNALING_EVENTS.CONNECTION_REJECTED, (raw: unknown) => {
      this.clearRequestTimer();
      const payload = parseDecision(raw);
      if (payload) this.listeners.onRejected?.(payload);
    });

    socket.on(SIGNALING_EVENTS.PEER_DISCONNECTED, (raw: unknown) => {
      this.clearRequestTimer();
      const payload = parsePeerDisconnected(raw);
      if (payload) this.listeners.onPeerDisconnected?.(payload);
    });
  }

  async requestConnection(targetDeviceId: string): Promise<string> {
    const socket = this.requireSocket();
    const digits = parseDeviceId(targetDeviceId);
    if (!digits) {
      ackError(null, 'INVALID_ID');
    }
    const ack = await emitWithAck(socket, SIGNALING_EVENTS.CONNECTION_REQUEST, {
      targetDeviceId: digits,
    });
    if (!ack.ok || !ack.roomId) {
      ackError(ack, 'DEVICE_OFFLINE');
    }
    this.armRequestTimer();
    return ack.roomId;
  }

  async accept(roomId: string): Promise<void> {
    const socket = this.requireSocket();
    const ack = await emitWithAck(socket, SIGNALING_EVENTS.CONNECTION_ACCEPTED, { roomId });
    if (!ack.ok) ackError(ack, 'ROOM_NOT_FOUND');
  }

  async reject(roomId: string): Promise<void> {
    const socket = this.requireSocket();
    const ack = await emitWithAck(socket, SIGNALING_EVENTS.CONNECTION_REJECTED, { roomId });
    if (!ack.ok) ackError(ack, 'ROOM_NOT_FOUND');
  }

  async disconnectSession(roomId: string | null): Promise<void> {
    this.clearRequestTimer();
    const socket = this.socket;
    if (!socket?.connected || !roomId) return;
    await emitWithAck(socket, SIGNALING_EVENTS.DISCONNECT_DEVICE, { roomId });
  }

  disconnect(): void {
    this.clearRequestTimer();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.deviceId = null;
  }

  private requireSocket(): Socket {
    const socket = this.socket;
    if (!socket || !socket.connected) {
      ackError(null, 'SERVER_UNAVAILABLE');
    }
    return socket;
  }

  private armRequestTimer(): void {
    this.clearRequestTimer();
    this.requestTimer = setTimeout(() => {
      this.listeners.onPeerDisconnected?.({ roomId: '', reason: 'timeout' });
    }, CONNECTION_REQUEST_TIMEOUT_MS);
  }

  private clearRequestTimer(): void {
    if (this.requestTimer) {
      clearTimeout(this.requestTimer);
      this.requestTimer = null;
    }
  }
}

function emitWithAck(
  socket: Socket,
  event: string,
  payload: Record<string, string>,
): Promise<SignalingAck> {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload, (err: Error | null, ack: unknown) => {
      if (err) {
        resolve({ ok: false, error: signalingError('SERVER_UNAVAILABLE') });
        return;
      }
      resolve(isAck(ack) ? ack : { ok: false, error: signalingError('SERVER_UNAVAILABLE') });
    });
  });
}

function parseIncoming(value: unknown): IncomingConnectionPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.roomId !== 'string' || typeof record.fromDeviceId !== 'string') return null;
  const fromDeviceId = parseDeviceId(record.fromDeviceId);
  if (!fromDeviceId) return null;
  return { roomId: record.roomId, fromDeviceId };
}

function parseDecision(value: unknown): ConnectionDecisionPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.roomId !== 'string' || typeof record.hostDeviceId !== 'string') return null;
  const hostDeviceId = parseDeviceId(record.hostDeviceId);
  if (!hostDeviceId) return null;
  return { roomId: record.roomId, hostDeviceId };
}

function parsePeerDisconnected(value: unknown): PeerDisconnectedPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.roomId !== 'string') return null;
  const reason = record.reason;
  if (reason !== 'left' && reason !== 'offline' && reason !== 'timeout' && reason !== 'rejected') {
    return null;
  }
  return { roomId: record.roomId, reason };
}

export const signalingService = new SignalingService();
