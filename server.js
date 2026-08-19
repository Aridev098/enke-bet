const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

const MAX_PLAYERS = 4;
// code -> { gameId, gameName, hostId, players: Set<socket.id>, started: boolean }
const rooms = {};

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function roomSnapshot(room) {
  return { players: room.players.size, max: MAX_PLAYERS };
}

function leaveCurrentRoom(socket) {
  const code = socket.data.code;
  if (!code) return;
  const room = rooms[code];
  socket.leave(code);
  socket.data.code = null;
  if (!room) return;

  room.players.delete(socket.id);

  if (room.players.size === 0) {
    delete rooms[code];
    return;
  }

  if (room.hostId === socket.id) {
    room.hostId = room.players.values().next().value;
  }

  io.to(code).emit('lobby_update', roomSnapshot(room));
}

io.on('connection', (socket) => {
  socket.data.code = null;

  socket.on('create_room', ({ gameId, gameName }) => {
    if (!gameId) return;
    if (socket.data.code) leaveCurrentRoom(socket);

    const code = randomCode();
    const room = { gameId, gameName, hostId: socket.id, players: new Set([socket.id]), started: false };
    rooms[code] = room;
    socket.join(code);
    socket.data.code = code;

    socket.emit('room_created', { code, gameId, gameName, players: room.players.size });
  });

  socket.on('join_room', ({ code }) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) { socket.emit('join_error', { message: 'Ese código no existe.' }); return; }
    if (room.started) { socket.emit('join_error', { message: 'Esa partida ya ha empezado.' }); return; }
    if (room.players.size >= MAX_PLAYERS) { socket.emit('join_error', { message: 'La sala está llena.' }); return; }

    if (socket.data.code) leaveCurrentRoom(socket);

    room.players.add(socket.id);
    socket.join(code);
    socket.data.code = code;

    socket.emit('room_joined', { code, gameId: room.gameId, gameName: room.gameName, players: room.players.size });
    socket.to(code).emit('lobby_update', roomSnapshot(room));
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.players.size < 2) {
      socket.emit('join_error', { message: 'Esperando a que al menos un amigo más se una.' });
      return;
    }
    room.started = true;
    io.to(code).emit('game_start', { code });
  });

  socket.on('leave_room', () => {
    leaveCurrentRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Enke Bet escuchando en el puerto ${PORT}`);
});
