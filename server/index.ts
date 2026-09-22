/**
 * Signaling server (Socket.IO).
 *
 * WHY a dedicated process: the server routes presence and connection
 * control messages only. It never receives screen video or input contents.
 *
 * socket.io is used because it gives rooms, acknowledgements, and reconnect
 * semantics for signaling without carrying media. socket.io-client is the
 * matching renderer library.
 */

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { PENDING_ROOM_TTL_MS, SIGNALING_EVENTS } from '../shared/signaling.js';
import { ConnectionRooms } from './rooms/connectionRooms.js';
import { DeviceRegistry } from './socket/deviceRegistry.js';
import { registerSocketHandlers } from './socket/handlers.js';

const PORT = Number.parseInt(process.env.SIGNALING_PORT ?? '3001', 10);

const registry = new DeviceRegistry();
const rooms = new ConnectionRooms();

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'lantern-signaling' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: true },
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket, registry, rooms);
});

setInterval(() => {
  const expired = rooms.expirePending();
  for (const room of expired) {
    io.to(room.clientSocketId).emit(SIGNALING_EVENTS.PEER_DISCONNECTED, {
      roomId: room.id,
      reason: 'timeout',
    });
    const host = registry.getSocket(room.hostDeviceId);
    host?.emit(SIGNALING_EVENTS.PEER_DISCONNECTED, {
      roomId: room.id,
      reason: 'timeout',
    });
  }
}, PENDING_ROOM_TTL_MS);

httpServer.listen(PORT, () => {
  console.log(`[signaling] listening on http://localhost:${PORT}`);
});
