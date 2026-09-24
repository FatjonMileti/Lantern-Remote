import { describe, it, expect } from 'vitest';
import { ConnectionRooms } from './connectionRooms.js';

/** Room lifecycle + cleanup: nothing lingers after remove/expiry. */
describe('ConnectionRooms', () => {
  function pending() {
    const rooms = new ConnectionRooms();
    const room = rooms.createPending({
      clientDeviceId: '111111111',
      hostDeviceId: '222222222',
      clientSocketId: 'socket-a',
    });
    return { rooms, room };
  }

  it('creates a pending room indexed by both devices', () => {
    const { rooms, room } = pending();
    expect(room.status).toBe('pending');
    expect(room.hostSocketId).toBeNull();
    expect(rooms.get(room.id)).toBe(room);
    expect(rooms.getByDevice('111111111')).toBe(room);
    expect(rooms.getByDevice('222222222')).toBe(room);
  });

  it('accept transitions to accepted with the host socket', () => {
    const { rooms, room } = pending();
    const accepted = rooms.accept(room.id, 'socket-b');
    expect(accepted?.status).toBe('accepted');
    expect(accepted?.hostSocketId).toBe('socket-b');
  });

  it('accept rejects unknown rooms and double accept', () => {
    const { rooms, room } = pending();
    expect(rooms.accept('nope', 'socket-b')).toBeUndefined();
    expect(rooms.accept(room.id, 'socket-b')).toBeDefined();
    expect(rooms.accept(room.id, 'socket-b')).toBeUndefined();
  });

  it('remove clears both device indexes', () => {
    const { rooms, room } = pending();
    rooms.remove(room.id);
    expect(rooms.get(room.id)).toBeUndefined();
    expect(rooms.getByDevice('111111111')).toBeUndefined();
    expect(rooms.getByDevice('222222222')).toBeUndefined();
    expect(rooms.remove(room.id)).toBeUndefined();
  });

  it('expirePending removes only stale pending rooms', () => {
    const { rooms, room } = pending();
    const fresh = rooms.createPending({
      clientDeviceId: '333333333',
      hostDeviceId: '444444444',
      clientSocketId: 'socket-c',
    });
    rooms.accept(fresh.id, 'socket-d');
    const expired = rooms.expirePending(room.createdAt + 60 * 60 * 1000);
    expect(expired.map((r) => r.id)).toEqual([room.id]);
    expect(rooms.get(room.id)).toBeUndefined();
    // Accepted rooms survive expiry sweeps.
    expect(rooms.get(fresh.id)).toBeDefined();
  });
});
