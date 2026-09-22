/**
 * In-memory map of device id → live socket.
 * Presence is session-scoped; disconnect always unregisters.
 */

import type { Socket } from 'socket.io';

export class DeviceRegistry {
  private readonly byDeviceId = new Map<string, Socket>();
  private readonly bySocketId = new Map<string, string>();

  register(deviceId: string, socket: Socket): Socket | null {
    const previous = this.byDeviceId.get(deviceId) ?? null;
    if (previous && previous.id !== socket.id) {
      this.bySocketId.delete(previous.id);
    }
    this.byDeviceId.set(deviceId, socket);
    this.bySocketId.set(socket.id, deviceId);
    return previous && previous.id !== socket.id ? previous : null;
  }

  unregisterSocket(socketId: string): string | null {
    const deviceId = this.bySocketId.get(socketId);
    if (!deviceId) return null;
    const current = this.byDeviceId.get(deviceId);
    if (current && current.id === socketId) {
      this.byDeviceId.delete(deviceId);
    }
    this.bySocketId.delete(socketId);
    return deviceId;
  }

  getSocket(deviceId: string): Socket | undefined {
    return this.byDeviceId.get(deviceId);
  }

  getDeviceId(socketId: string): string | undefined {
    return this.bySocketId.get(socketId);
  }

  isOnline(deviceId: string): boolean {
    const socket = this.byDeviceId.get(deviceId);
    return Boolean(socket?.connected);
  }
}
