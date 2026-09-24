/**
 * Signaling protocol: event names, payloads, and validators.
 *
 * WHY a shared module: server and client must reject the same malformed
 * messages. Never trust a remote payload; always parse `unknown`.
 */

import { isValidTokenFormat } from './connectionToken.js';
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
  WEBRTC_OFFER: 'webrtc-offer',
  WEBRTC_ANSWER: 'webrtc-answer',
  ICE_CANDIDATE: 'ice-candidate',
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
  | 'NOT_REGISTERED'
  | 'NEGOTIATION_TIMEOUT'
  | 'ICE_FAILED'
  | 'INVALID_TOKEN';

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
  NEGOTIATION_TIMEOUT: 'The peer did not complete WebRTC negotiation in time.',
  ICE_FAILED: 'Could not establish a direct peer connection (ICE failed).',
  INVALID_TOKEN: 'Incorrect or expired connection code. Ask the host for a fresh one.',
};

export function signalingError(code: SignalingErrorCode): {
  code: SignalingErrorCode;
  message: string;
} {
  return { code, message: SIGNALING_ERROR_MESSAGES[code] };
}

export interface RegisterDevicePayload {
  deviceId: string;
}

export interface ConnectionRequestPayload {
  targetDeviceId: string;
  /** Connection code; server checks shape only, the host checks value. */
  token: string;
}

export interface RoomActionPayload {
  roomId: string;
}

export interface IncomingConnectionPayload {
  roomId: string;
  fromDeviceId: string;
  token: string;
}

export interface ConnectionDecisionPayload {
  roomId: string;
  hostDeviceId: string;
  /** Present on rejections only; acceptances omit it. */
  reason?: ConnectionRejectionReason;
}

/** Why a request was refused. The server relays the host's verdict. */
export type ConnectionRejectionReason = 'declined' | 'invalid-token';

const REJECTION_REASONS: ReadonlySet<string> = new Set(['declined', 'invalid-token']);

export interface PeerDisconnectedPayload {
  roomId: string;
  reason: 'left' | 'offline' | 'timeout' | 'rejected';
}

export interface DevicePresencePayload {
  deviceId: string;
}

/** SDP offer/answer routed between the two room members. Never media. */
export interface WebRTCSessionPayload {
  roomId: string;
  sdp: string;
  type: 'offer' | 'answer';
}

/** Trickled ICE candidate routed between the two room members. */
export interface IceCandidatePayload {
  roomId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type SignalingAck =
  | { ok: true; roomId?: string }
  | { ok: false; error: { code: SignalingErrorCode; message: string } };

export const CONNECTION_REQUEST_TIMEOUT_MS = 30_000;
export const PENDING_ROOM_TTL_MS = 35_000;
export const NEGOTIATION_TIMEOUT_MS = 20_000;

/** SDP is text; cap it so a malicious peer cannot flood the server. */
export const MAX_SDP_LENGTH = 32_768;
export const MAX_ICE_CANDIDATE_LENGTH = 4_096;

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
  const token = readString(record, 'token');
  if (!token || !isValidTokenFormat(token)) return null;
  return { targetDeviceId, token };
}

export function parseRoomActionPayload(value: unknown): RoomActionPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const roomId = readString(record, 'roomId');
  if (!roomId || roomId.length < 8 || roomId.length > 80) return null;
  return { roomId };
}

/** Host refusal: room plus a whitelisted reason (defaults to `declined`). */
export function parseRejectionPayload(
  value: unknown,
): { roomId: string; reason: ConnectionRejectionReason } | null {
  const room = parseRoomActionPayload(value);
  if (!room) return null;
  const record = asRecord(value);
  const reason = record?.reason;
  if (reason === undefined) return { roomId: room.roomId, reason: 'declined' };
  if (typeof reason !== 'string' || !REJECTION_REASONS.has(reason)) return null;
  return { roomId: room.roomId, reason: reason as ConnectionRejectionReason };
}

export function parseSessionPayload(
  value: unknown,
  expectedType: 'offer' | 'answer',
): WebRTCSessionPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const room = parseRoomActionPayload(value);
  if (!room) return null;
  const sdp = readString(record, 'sdp');
  const type = readString(record, 'type');
  if (!sdp || sdp.length > MAX_SDP_LENGTH) return null;
  if (type !== expectedType) return null;
  return { roomId: room.roomId, sdp, type: expectedType };
}

export function parseIceCandidatePayload(value: unknown): IceCandidatePayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const room = parseRoomActionPayload(value);
  if (!room) return null;
  const candidate = readString(record, 'candidate');
  if (!candidate || candidate.length > MAX_ICE_CANDIDATE_LENGTH) return null;
  const sdpMid = record.sdpMid;
  const sdpMLineIndex = record.sdpMLineIndex;
  if (sdpMid !== null && typeof sdpMid !== 'string') return null;
  if (
    sdpMLineIndex !== null &&
    (typeof sdpMLineIndex !== 'number' ||
      !Number.isFinite(sdpMLineIndex) ||
      !Number.isInteger(sdpMLineIndex) ||
      sdpMLineIndex < 0)
  ) {
    return null;
  }
  return { roomId: room.roomId, candidate, sdpMid, sdpMLineIndex };
}
