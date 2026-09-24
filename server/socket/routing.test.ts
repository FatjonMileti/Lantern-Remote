// @vitest-environment node
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SIGNALING_EVENTS, type SignalingAck } from '../../shared/signaling.js';
import { ConnectionRooms } from '../rooms/connectionRooms.js';
import { DeviceRegistry } from './deviceRegistry.js';
import { registerSocketHandlers } from './handlers.js';

/**
 * Signaling routing over real sockets on an ephemeral port — the same
 * wiring as server/index.ts (minus the TTL sweeper). Covers request
 * validation, token passthrough, accept/reject relay, direction
 * enforcement, and disconnect cleanup. No WebRTC, no OS.
 */

const CLIENT_ID = '111111111';
const HOST_ID = '222222222';
const TOKEN = 'A7K4P9';

let httpServer: HttpServer;
let url: string;

function emitAck(socket: ClientSocket, event: string, payload: unknown): Promise<SignalingAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 5000);
    socket.emit(event, payload, (ack: SignalingAck) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function onceEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`event timeout: ${event}`)), 5000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function connectClient(): Promise<ClientSocket> {
  const socket = clientIo(url);
  await onceEvent(socket, 'connect');
  return socket;
}

/** Ack carries roomId only on success — unwrap or fail loudly. */
function roomIdOf(ack: SignalingAck): string {
  if (!ack.ok || !ack.roomId)
    throw new Error(`expected ok ack with roomId: ${JSON.stringify(ack)}`);
  return ack.roomId;
}

beforeAll(async () => {
  const registry = new DeviceRegistry();
  const rooms = new ConnectionRooms();
  httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: true } });
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, registry, rooms);
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

describe('signaling routing', () => {
  it('rejects invalid registration', async () => {
    const socket = await connectClient();
    try {
      const ack = await emitAck(socket, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: 'nope' });
      expect(ack.ok).toBe(false);
    } finally {
      socket.disconnect();
    }
  });

  it('rejects requests from unregistered sockets', async () => {
    const socket = await connectClient();
    try {
      const ack = await emitAck(socket, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      expect(ack.ok).toBe(false);
    } finally {
      socket.disconnect();
    }
  });

  it('routes token requests and relays the reject reason', async () => {
    const client = await connectClient();
    const host = await connectClient();
    try {
      expect(
        (await emitAck(client, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: CLIENT_ID })).ok,
      ).toBe(true);
      expect(
        (await emitAck(host, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: HOST_ID })).ok,
      ).toBe(true);

      // Missing and malformed tokens never reach the host.
      expect(
        (await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, { targetDeviceId: HOST_ID }))
          .ok,
      ).toBe(false);
      expect(
        (
          await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
            targetDeviceId: HOST_ID,
            token: 'wrong!',
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
            targetDeviceId: CLIENT_ID,
            token: TOKEN,
          })
        ).ok,
      ).toBe(false);

      const incomingP = onceEvent<{ roomId: string; token: string }>(
        host,
        SIGNALING_EVENTS.INCOMING_CONNECTION,
      );
      const reqAck = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      expect(reqAck.ok).toBe(true);
      const incoming = await incomingP;
      expect(incoming.roomId).toBe(roomIdOf(reqAck));
      expect(incoming.token).toBe(TOKEN);

      // A second request while pending is refused.
      const busy = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      expect(busy.ok).toBe(false);

      const rejectedP = onceEvent<{ reason: string }>(client, SIGNALING_EVENTS.CONNECTION_REJECTED);
      const rejAck = await emitAck(host, SIGNALING_EVENTS.CONNECTION_REJECTED, {
        roomId: incoming.roomId,
        reason: 'invalid-token',
      });
      expect(rejAck.ok).toBe(true);
      expect((await rejectedP).reason).toBe('invalid-token');

      // Rejected rooms are gone: accepting afterwards fails.
      const late = await emitAck(host, SIGNALING_EVENTS.CONNECTION_ACCEPTED, {
        roomId: incoming.roomId,
      });
      expect(late.ok).toBe(false);
    } finally {
      client.disconnect();
      host.disconnect();
    }
  });

  it('accepts, enforces offer direction, and cleans up on disconnect', async () => {
    const client = await connectClient();
    const host = await connectClient();
    let replacement: ClientSocket | null = null;
    try {
      await emitAck(client, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: CLIENT_ID });
      await emitAck(host, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: HOST_ID });

      const incomingP = onceEvent<{ roomId: string }>(host, SIGNALING_EVENTS.INCOMING_CONNECTION);
      const reqAck = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      const { roomId } = await incomingP;
      expect(roomIdOf(reqAck)).toBe(roomId);

      const acceptedP = onceEvent<{ roomId: string }>(client, SIGNALING_EVENTS.CONNECTION_ACCEPTED);
      expect((await emitAck(host, SIGNALING_EVENTS.CONNECTION_ACCEPTED, { roomId })).ok).toBe(true);
      expect((await acceptedP).roomId).toBe(roomId);

      // Offers flow client→host only; a host-side offer is unauthorized.
      const offerP = onceEvent<{ roomId: string }>(host, SIGNALING_EVENTS.WEBRTC_OFFER);
      expect(
        (
          await emitAck(client, SIGNALING_EVENTS.WEBRTC_OFFER, {
            roomId,
            sdp: 'fake-offer',
            type: 'offer',
          })
        ).ok,
      ).toBe(true);
      expect((await offerP).roomId).toBe(roomId);
      expect(
        (
          await emitAck(host, SIGNALING_EVENTS.WEBRTC_OFFER, {
            roomId,
            sdp: 'fake-offer',
            type: 'offer',
          })
        ).ok,
      ).toBe(false);

      replacement = await connectClient();
      const replacedPeerP = onceEvent<{ roomId: string; reason: string }>(
        client,
        SIGNALING_EVENTS.PEER_DISCONNECTED,
      );
      expect(
        (await emitAck(replacement, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: HOST_ID })).ok,
      ).toBe(true);
      const replacedPeer = await replacedPeerP;
      expect(replacedPeer.roomId).toBe(roomId);
      expect(replacedPeer.reason).toBe('offline');

      const retryIncomingP = onceEvent<{ roomId: string }>(
        replacement,
        SIGNALING_EVENTS.INCOMING_CONNECTION,
      );
      const retryAck = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      expect(retryAck.ok).toBe(true);
      const retryRoomId = (await retryIncomingP).roomId;
      expect(retryRoomId).toBe(roomIdOf(retryAck));

      // Host disconnect notifies the client and frees both devices.
      const offlineP = onceEvent<{ roomId: string; reason: string }>(
        client,
        SIGNALING_EVENTS.PEER_DISCONNECTED,
      );
      replacement.disconnect();
      const offline = await offlineP;
      expect(offline.roomId).toBe(retryRoomId);
      expect(offline.reason).toBe('offline');

      const retry = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: HOST_ID,
        token: TOKEN,
      });
      expect(retry.ok).toBe(false);
    } finally {
      client.disconnect();
      replacement?.disconnect();
    }
  });

  it('reports offline targets', async () => {
    const client = await connectClient();
    try {
      await emitAck(client, SIGNALING_EVENTS.REGISTER_DEVICE, { deviceId: CLIENT_ID });
      const ack = await emitAck(client, SIGNALING_EVENTS.CONNECTION_REQUEST, {
        targetDeviceId: '999999999',
        token: TOKEN,
      });
      expect(ack.ok).toBe(false);
    } finally {
      client.disconnect();
    }
  });
});
