import type { Server, Socket } from 'socket.io';
import {
  SIGNALING_EVENTS,
  parseConnectionRequestPayload,
  parseRegisterDevicePayload,
  parseRoomActionPayload,
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
      hostSocket.emit(SIGNALING_EVENTS.INCOMING_CONNECTION, {
        roomId: room.id,
        fromDeviceId: requesterId,
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
      if (room.hostDeviceId !== hostId) {
        ackErr(ack, 'UNAUTHORIZED');
        return;
      }
      rooms.remove(room.id);
      io.to(room.clientSocketId).emit(SIGNALING_EVENTS.CONNECTION_REJECTED, {
        roomId: room.id,
        hostDeviceId: hostId,
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
