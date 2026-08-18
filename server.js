/**
 * Enke Bet — servidor de salas por WebSocket
 * -------------------------------------------
 * Es un "relay" tonto: no conoce las reglas de ningún juego.
 * Solo gestiona salas por código y reenvía mensajes entre los
 * jugadores conectados a la misma sala. Toda la lógica de cada
 * juego (blackjack, ruleta, etc.) sigue viviendo en el navegador
 * del jugador que hace de "host" de la sala, que es quien manda
 * el estado autoritativo y los demás solo lo reciben.
 *
 * Deploy rápido (gratis) en Render.com:
 *   1. Sube esta carpeta /server a un repo de GitHub.
 *   2. En Render: New > Web Service > conecta el repo.
 *   3. Build command:  npm install
 *      Start command:  npm start
 *   4. Cuando esté desplegado te da una URL tipo:
 *      https://enke-bet-ws.onrender.com
 *      Tu WS_URL en el cliente es la misma pero con wss://
 *      wss://enke-bet-ws.onrender.com
 */

const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  // endpoint simple de salud, útil para Render/Railway
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Enke Bet WS server OK. Rooms: ' + rooms.size);
});

const wss = new WebSocket.Server({ server });

const rooms = new Map(); // code -> { players: Map(id -> {id, ws, name, isHost}), game: string|null }
let nextId = 1;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastRoom(code, msg, exceptId) {
  const room = rooms.get(code);
  if (!room) return;
  for (const [id, p] of room.players) {
    if (id === exceptId) continue;
    send(p.ws, msg);
  }
}

function playerList(room) {
  return Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
}

wss.on('connection', (ws) => {
  const playerId = 'p' + (nextId++);
  let joinedCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'create': {
        const code = genCode();
        const room = { players: new Map(), game: msg.game || null };
        room.players.set(playerId, { id: playerId, ws, name: msg.name || 'Jugador 1', isHost: true });
        rooms.set(code, room);
        joinedCode = code;
        send(ws, { type: 'created', code, playerId });
        send(ws, { type: 'roomUpdate', code, players: playerList(room) });
        break;
      }

      case 'join': {
        const code = String(msg.code || '').toUpperCase();
        const room = rooms.get(code);
        if (!room) { send(ws, { type: 'error', message: 'Código no encontrado.' }); return; }
        if (room.players.size >= 6) { send(ws, { type: 'error', message: 'La sala está llena.' }); return; }
        room.players.set(playerId, {
          id: playerId, ws,
          name: msg.name || ('Jugador ' + (room.players.size + 1)),
          isHost: false
        });
        joinedCode = code;
        send(ws, { type: 'joined', code, playerId, game: room.game });
        broadcastRoom(code, { type: 'roomUpdate', code, players: playerList(room) });
        break;
      }

      case 'start': {
        if (!joinedCode) return;
        const room = rooms.get(joinedCode);
        if (!room) return;
        const p = room.players.get(playerId);
        if (!p || !p.isHost) return; // solo el host puede arrancar
        broadcastRoom(joinedCode, { type: 'gameStart', game: room.game });
        break;
      }

      // 'state'  -> el host manda el estado autoritativo del juego
      // 'action' -> un jugador manda una acción (pedir carta, apostar, girar...)
      // ambos simplemente se reenvían a los demás de la sala
      case 'state':
      case 'action': {
        if (!joinedCode) return;
        broadcastRoom(joinedCode, { ...msg, from: playerId }, playerId);
        break;
      }

      case 'leave': {
        handleLeave();
        break;
      }
    }
  });

  function handleLeave() {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    room.players.delete(playerId);
    if (room.players.size === 0) {
      rooms.delete(joinedCode);
    } else {
      const stillHasHost = Array.from(room.players.values()).some(p => p.isHost);
      if (!stillHasHost) {
        const first = room.players.values().next().value;
        first.isHost = true;
      }
      broadcastRoom(joinedCode, { type: 'roomUpdate', code: joinedCode, players: playerList(room) });
    }
    joinedCode = null;
  }

  ws.on('close', handleLeave);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Enke Bet WS server escuchando en el puerto ' + PORT));
