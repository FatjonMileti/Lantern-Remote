/**
 * Signaling protocol: event names, payloads, and validators.
 *
 * WHY a shared module: server and client must reject the same malformed
 * messages. Never trust a remote payload; always parse `unknown`.
 */

import { parseDeviceId } from './deviceId.js';

export const SIGNALING_EVENTS = {
  REGISTER_DEVICE: 'register-device',
  CONNECTION_REQUEST: 'connection-request',
  CONNECTION_ACCEPTED: 'connection-accepted',
  CONNECTION_REJECTED: 'connection-rejected',
  DISCONNECT_DEVICE: 'disconnect-device',
  INCOMING_CONNECTION: 'incoming-connection',
  PEER_DISCONNECTED: 'peer-disconnected',
  DEVICE_ONLINE: 'device-online',
  DEVICE_OFFLINE: 'device-offline',
} as const;

export type SignalingEvent = (typeof SIGNALING_EVENTS)[keyof typeof SIGNALING_EVENTS];

export type SignalingErrorCode =
  | 'SERVER_UNAVAILABLE'
  | 'INVALID_ID'
  | 'DEVICE_OFFLINE'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'SELF_CONNECT'
  | 'UNAUTHORIZED'
  | 'ROOM_NOT_FOUND'
  | 'ALREADY_IN_SESSION'
  | 'NOT_REGISTERED';

export const SIGNALING_ERROR_MESSAGES: Record<SignalingErrorCode, string> = {
  SERVER_UNAVAILABLE:
    'Signaling server is unavailable. Start it with npm run server and check the URL.',
  INVALID_ID: 'That device ID is not valid. Use nine digits, like 482 913 742.',
  DEVICE_OFFLINE: 'That device is offline.',
  REJECTED: 'The host declined this connection.',
  TIMEOUT: 'The host did not respond in time.',
  SELF_CONNECT: 'You cannot connect to this device.',
  UNAUTHORIZED: 'You are not allowed to act on this connection.',
  ROOM_NOT_FOUND: 'That connection is no longer available.',
  ALREADY_IN_SESSION: 'A connection request is already in progress.',
  NOT_REGISTERED: 'This device is not registered with the signaling server.',
};

export function signalingError(
  code: SignalingErrorCode,
): { code: SignalingErrorCode; message: string } {
  return { code, message: SIGNALING_ERROR_MESSAGES[code] };
}

export interface RegisterDevicePayload {
  deviceId: string;
}

export interface ConnectionRequestPayload {
  targetDeviceId: string;
}

export interface RoomActionPayload {
  roomId: string;
}

export interface IncomingConnectionPayload {
  roomId: string;
  fromDeviceId: string;
}

export interface ConnectionDecisionPayload {
  roomId: string;
  hostDeviceId: string;
}

export interface PeerDisconnectedPayload {
  roomId: string;
  reason: 'left' | 'offline' | 'timeout' | 'rejected';
}

export interface DevicePresencePayload {
  deviceId: string;
}

export type SignalingAck =
  | { ok: true; roomId?: string }
  | { ok: false; error: { code: SignalingErrorCode; message: string } };

export const CONNECTION_REQUEST_TIMEOUT_MS = 30_000;
export const PENDING_ROOM_TTL_MS = 35_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function parseRegisterDevicePayload(value: unknown): RegisterDevicePayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const raw = readString(record, 'deviceId');
  if (!raw) return null;
  const deviceId = parseDeviceId(raw);
  if (!deviceId) return null;
  return { deviceId };
}

export function parseConnectionRequestPayload(value: unknown): ConnectionRequestPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const raw = readString(record, 'targetDeviceId');
  if (!raw) return null;
  const targetDeviceId = parseDeviceId(raw);
  if (!targetDeviceId) return null;
  return { targetDeviceId };
}

export function parseRoomActionPayload(value: unknown): RoomActionPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const roomId = readString(record, 'roomId');
  if (!roomId || roomId.length < 8 || roomId.length > 80) return null;
  return { roomId };
}
