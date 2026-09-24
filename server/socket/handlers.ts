import type { Server, Socket } from 'socket.io';
import {
  SIGNALING_EVENTS,
  parseConnectionRequestPayload,
  parseIceCandidatePayload,
  parseRegisterDevicePayload,
  parseRejectionPayload,
  parseRoomActionPayload,
  parseSessionPayload,
  signalingError,
  type SignalingAck,
} from '../../shared/signaling.js';
import type { ConnectionRooms } from '../rooms/connectionRooms.js';
import type { DeviceRegistry } from './deviceRegistry.js';

function ackOk(ack: ((response: SignalingAck) => void) | undefined, roomId?: string): void {
  ack?.({ ok: true, roomId });
}

function ackErr(
  ack: ((response: SignalingAck) => void) | undefined,
  code: Parameters<typeof signalingError>[0],
): void {
  ack?.({ ok: false, error: signalingError(code) });
}

export function registerSocketHandlers(
  io: Server,
  socket: Socket,
  registry: DeviceRegistry,
  rooms: ConnectionRooms,
): void {
  socket.on(SIGNALING_EVENTS.REGISTER_DEVICE, (raw: unknown, ack?: (r: SignalingAck) => void) => {
    const payload = parseRegisterDevicePayload(raw);
    if (!payload) {
      ackErr(ack, 'INVALID_ID');
      return;
    }
    const displaced = registry.register(payload.deviceId, socket);
    if (displaced) {
      displaced.disconnect(true);
    }
    socket.emit(SIGNALING_EVENTS.DEVICE_ONLINE, { deviceId: payload.deviceId });
    ackOk(ack);
  });

  socket.on(
    SIGNALING_EVENTS.CONNECTION_REQUEST,
    (raw: unknown, ack?: (r: SignalingAck) => void) => {
      const requesterId = registry.getDeviceId(socket.id);
      if (!requesterId) {
        ackErr(ack, 'NOT_REGISTERED');
        return;
      }
      const payload = parseConnectionRequestPayload(raw);
      if (!payload) {
        ackErr(ack, 'INVALID_ID');
        return;
      }
      if (payload.targetDeviceId === requesterId) {
        ackErr(ack, 'SELF_CONNECT');
        return;
      }
      if (rooms.getByDevice(requesterId) || rooms.getByDevice(payload.targetDeviceId)) {
        ackErr(ack, 'ALREADY_IN_SESSION');
        return;
      }
      const hostSocket = registry.getSocket(payload.targetDeviceId);
      if (!hostSocket?.connected) {
        ackErr(ack, 'DEVICE_OFFLINE');
        return;
      }

      const room = rooms.createPending({
        clientDeviceId: requesterId,
        hostDeviceId: payload.targetDeviceId,
        clientSocketId: socket.id,
      });
      void socket.join(room.id);
      // The token travels to the host opaquely: the server checks its shape
      // in the parser above, never its value — only the host holds a live code.
      hostSocket.emit(SIGNALING_EVENTS.INCOMING_CONNECTION, {
        roomId: room.id,
        fromDeviceId: requesterId,
        token: payload.token,
      });
      ackOk(ack, room.id);
    },
  );

  socket.on(
    SIGNALING_EVENTS.CONNECTION_ACCEPTED,
    (raw: unknown, ack?: (r: SignalingAck) => void) => {
      const hostId = registry.getDeviceId(socket.id);
      if (!hostId) {
        ackErr(ack, 'NOT_REGISTERED');
        return;
      }
      const payload = parseRoomActionPayload(raw);
      if (!payload) {
        ackErr(ack, 'ROOM_NOT_FOUND');
        return;
      }
      const room = rooms.get(payload.roomId);
      if (!room) {
        ackErr(ack, 'ROOM_NOT_FOUND');
        return;
      }
      if (room.hostDeviceId !== hostId || room.status !== 'pending') {
        ackErr(ack, 'UNAUTHORIZED');
        return;
      }
      rooms.accept(room.id, socket.id);
      void socket.join(room.id);
      io.to(room.clientSocketId).emit(SIGNALING_EVENTS.CONNECTION_ACCEPTED, {
        roomId: room.id,
        hostDeviceId: hostId,
      });
      ackOk(ack, room.id);
    },
  );

  socket.on(
    SIGNALING_EVENTS.CONNECTION_REJECTED,
    (raw: unknown, ack?: (r: SignalingAck) => void) => {
      const hostId = registry.getDeviceId(socket.id);
      if (!hostId) {
        ackErr(ack, 'NOT_REGISTERED');
        return;
      }
      const payload = parseRejectionPayload(raw);
      if (!payload) {
        ackErr(ack, 'ROOM_NOT_FOUND');
        return;
      }
      const room = rooms.get(payload.roomId);
      if (!room) {
        ackErr(ack, 'ROOM_NOT_FOUND');
        return;
      }
      if (room.hostDeviceId !== hostId) {
        ackErr(ack, 'UNAUTHORIZED');
        return;
      }
      rooms.remove(room.id);
      io.to(room.clientSocketId).emit(SIGNALING_EVENTS.CONNECTION_REJECTED, {
        roomId: room.id,
        hostDeviceId: hostId,
        reason: payload.reason,
      });
      ackOk(ack, room.id);
    },
  );

  socket.on(
    SIGNALING_EVENTS.DISCONNECT_DEVICE,
    (raw: unknown, ack?: (r: SignalingAck) => void) => {
      const deviceId = registry.getDeviceId(socket.id);
      if (!deviceId) {
        ackErr(ack, 'NOT_REGISTERED');
        return;
      }
      const payload = parseRoomActionPayload(raw);
      const room = payload ? rooms.get(payload.roomId) : rooms.getByDevice(deviceId);
      if (!room) {
        ackErr(ack, 'ROOM_NOT_FOUND');
        return;
      }
      if (room.clientDeviceId !== deviceId && room.hostDeviceId !== deviceId) {
        ackErr(ack, 'UNAUTHORIZED');
        return;
      }
      rooms.remove(room.id);
      io.to(room.id).emit(SIGNALING_EVENTS.PEER_DISCONNECTED, {
        roomId: room.id,
        reason: 'left',
      });
      ackOk(ack, room.id);
    },
  );

  /**
   * WebRTC signaling relay. The server forwards SDP/ICE between the two room
   * members only — it never inspects media and enforces direction
   * (offers flow client→host, answers host→client) plus room membership.
   * Peer sockets resolve via the registry so reconnects stay fresh.
   */
  socket.on(SIGNALING_EVENTS.WEBRTC_OFFER, (raw: unknown, ack?: (r: SignalingAck) => void) => {
    const senderId = registry.getDeviceId(socket.id);
    if (!senderId) {
      ackErr(ack, 'NOT_REGISTERED');
      return;
    }
    const payload = parseSessionPayload(raw, 'offer');
    if (!payload) {
      ackErr(ack, 'ROOM_NOT_FOUND');
      return;
    }
    const room = rooms.get(payload.roomId);
    if (!room || room.status !== 'accepted' || room.clientDeviceId !== senderId) {
      ackErr(ack, room ? 'UNAUTHORIZED' : 'ROOM_NOT_FOUND');
      return;
    }
    const hostSocket = registry.getSocket(room.hostDeviceId);
    if (!hostSocket?.connected) {
      ackErr(ack, 'DEVICE_OFFLINE');
      return;
    }
    hostSocket.emit(SIGNALING_EVENTS.WEBRTC_OFFER, payload);
    ackOk(ack, room.id);
  });

  socket.on(SIGNALING_EVENTS.WEBRTC_ANSWER, (raw: unknown, ack?: (r: SignalingAck) => void) => {
    const senderId = registry.getDeviceId(socket.id);
    if (!senderId) {
      ackErr(ack, 'NOT_REGISTERED');
      return;
    }
    const payload = parseSessionPayload(raw, 'answer');
    if (!payload) {
      ackErr(ack, 'ROOM_NOT_FOUND');
      return;
    }
    const room = rooms.get(payload.roomId);
    if (!room || room.status !== 'accepted' || room.hostDeviceId !== senderId) {
      ackErr(ack, room ? 'UNAUTHORIZED' : 'ROOM_NOT_FOUND');
      return;
    }
    const clientSocket = registry.getSocket(room.clientDeviceId);
    if (!clientSocket?.connected) {
      ackErr(ack, 'DEVICE_OFFLINE');
      return;
    }
    clientSocket.emit(SIGNALING_EVENTS.WEBRTC_ANSWER, payload);
    ackOk(ack, room.id);
  });

  socket.on(SIGNALING_EVENTS.ICE_CANDIDATE, (raw: unknown, ack?: (r: SignalingAck) => void) => {
    const senderId = registry.getDeviceId(socket.id);
    if (!senderId) {
      ackErr(ack, 'NOT_REGISTERED');
      return;
    }
    const payload = parseIceCandidatePayload(raw);
    if (!payload) {
      ackErr(ack, 'ROOM_NOT_FOUND');
      return;
    }
    const room = rooms.get(payload.roomId);
    if (!room || room.status !== 'accepted') {
      ackErr(ack, 'ROOM_NOT_FOUND');
      return;
    }
    const peerDeviceId =
      room.clientDeviceId === senderId
        ? room.hostDeviceId
        : room.hostDeviceId === senderId
          ? room.clientDeviceId
          : null;
    if (!peerDeviceId) {
      ackErr(ack, 'UNAUTHORIZED');
      return;
    }
    const peerSocket = registry.getSocket(peerDeviceId);
    if (!peerSocket?.connected) {
      ackErr(ack, 'DEVICE_OFFLINE');
      return;
    }
    peerSocket.emit(SIGNALING_EVENTS.ICE_CANDIDATE, payload);
    ackOk(ack, room.id);
  });

  socket.on('disconnect', () => {
    const deviceId = registry.unregisterSocket(socket.id);
    if (!deviceId) return;
    const room = rooms.getByDevice(deviceId);
    if (room) {
      rooms.remove(room.id);
      io.to(room.id).emit(SIGNALING_EVENTS.PEER_DISCONNECTED, {
        roomId: room.id,
        reason: 'offline',
      });
      const peerSocketId =
        room.clientSocketId === socket.id ? room.hostSocketId : room.clientSocketId;
      if (peerSocketId) {
        io.to(peerSocketId).emit(SIGNALING_EVENTS.PEER_DISCONNECTED, {
          roomId: room.id,
          reason: 'offline',
        });
      }
    }
    io.emit(SIGNALING_EVENTS.DEVICE_OFFLINE, { deviceId });
  });
}
