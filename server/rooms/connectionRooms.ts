/**
 * Connection rooms: pending approval, then a two-party session.
 * Cleanup is explicit (leave / reject) and implicit (TTL, disconnect).
 */

import { randomUUID } from 'node:crypto';
import { PENDING_ROOM_TTL_MS } from '../../shared/signaling.js';

export type RoomStatus = 'pending' | 'accepted';

export interface ConnectionRoom {
  id: string;
  clientDeviceId: string;
  hostDeviceId: string;
  clientSocketId: string;
  hostSocketId: string | null;
  status: RoomStatus;
  createdAt: number;
}

export class ConnectionRooms {
  private readonly rooms = new Map<string, ConnectionRoom>();
  private readonly byDevice = new Map<string, string>();

  createPending(input: {
    clientDeviceId: string;
    hostDeviceId: string;
    clientSocketId: string;
  }): ConnectionRoom {
    const room: ConnectionRoom = {
      id: randomUUID(),
      clientDeviceId: input.clientDeviceId,
      hostDeviceId: input.hostDeviceId,
      clientSocketId: input.clientSocketId,
      hostSocketId: null,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.rooms.set(room.id, room);
    this.byDevice.set(input.clientDeviceId, room.id);
    this.byDevice.set(input.hostDeviceId, room.id);
    return room;
  }

  get(roomId: string): ConnectionRoom | undefined {
    return this.rooms.get(roomId);
  }

  getByDevice(deviceId: string): ConnectionRoom | undefined {
    const id = this.byDevice.get(deviceId);
    return id ? this.rooms.get(id) : undefined;
  }

  accept(roomId: string, hostSocketId: string): ConnectionRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'pending') return undefined;
    room.status = 'accepted';
    room.hostSocketId = hostSocketId;
    return room;
  }

  remove(roomId: string): ConnectionRoom | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    this.rooms.delete(roomId);
    this.byDevice.delete(room.clientDeviceId);
    this.byDevice.delete(room.hostDeviceId);
    return room;
  }

  expirePending(now = Date.now()): ConnectionRoom[] {
    const expired: ConnectionRoom[] = [];
    for (const room of this.rooms.values()) {
      if (room.status === 'pending' && now - room.createdAt >= PENDING_ROOM_TTL_MS) {
        expired.push(room);
      }
    }
    for (const room of expired) {
      this.remove(room.id);
    }
    return expired;
  }
}
