require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET','POST'] }
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ─── In-memory DB (replace with real DB in production) ───
const users = {};       // id -> user
const rooms = {};       // roomCode -> room
const sessions = {};    // token -> userId

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ─── Helpers ───
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = users[decoded.id];
    if (!req.user) return res.status(401).json({ error: 'Invalid user' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function generateBingoCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const card = ranges.map(([lo,hi]) => {
    const pool = Array.from({length: hi-lo+1}, (_,i) => lo+i);
    const col = [];
    while (col.length < 5) {
      const i = Math.floor(Math.random() * pool.length);
      col.push(pool.splice(i,1)[0]);
    }
    return col;
  });
  card[2][2] = 0; // FREE
  return card;
}

function generatePool() {
  const pool = Array.from({length:75}, (_,i) => i+1);
  for (let i = pool.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]] = [pool[j],pool[i]];
  }
  return pool;
}

function getLetter(n) {
  if (n<=15) return 'B'; if (n<=30) return 'I';
  if (n<=45) return 'N'; if (n<=60) return 'G'; return 'O';
}

function checkWin(card, marked) {
  const LETTERS = ['B','I','N','G','O'];
  for (let r=0;r<5;r++)
    if ([0,1,2,3,4].every(c=>marked[c][r])) return true;
  for (let c=0;c<5;c++)
    if ([0,1,2,3,4].every(r=>marked[c][r])) return true;
  if ([0,1,2,3,4].every(i=>marked[i][i])) return true;
  if ([0,1,2,3,4].every(i=>marked[i][4-i])) return true;
  return false;
}

// ─── Auth Routes ───
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (Object.values(users).find(u=>u.email===email))
    return res.status(400).json({ error: 'Email already registered' });
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  users[id] = { id, username, email, password: hash, balance: 100, gamesPlayed: 0, gamesWon: 0, createdAt: new Date() };
  const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
  const { password:_, ...userSafe } = users[id];
  res.json({ token, user: userSafe });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = Object.values(users).find(u=>u.email===email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password:_, ...userSafe } = user;
  res.json({ token, user: userSafe });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const { password:_, ...userSafe } = req.user;
  res.json(userSafe);
});

// ─── Room Routes ───
app.post('/api/rooms', authMiddleware, (req, res) => {
  const { buyIn = 10, maxPlayers = 8 } = req.body;
  if (req.user.balance < buyIn)
    return res.status(400).json({ error: 'Insufficient balance' });
  const code = Math.random().toString(36).substr(2,6).toUpperCase();
  rooms[code] = {
    code, hostId: req.user.id, buyIn, maxPlayers,
    players: {}, pool: generatePool(), calledNumbers: [],
    status: 'waiting', prizePool: 0, createdAt: new Date()
  };
  res.json({ code, room: sanitizeRoom(rooms[code]) });
});

app.get('/api/rooms', (req, res) => {
  const list = Object.values(rooms)
    .filter(r=>r.status==='waiting')
    .map(r=>({ code:r.code, buyIn:r.buyIn, maxPlayers:r.maxPlayers,
      playerCount:Object.keys(r.players).length, host: users[r.hostId]?.username }));
  res.json(list);
});

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms[req.params.code];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(sanitizeRoom(room));
});

function sanitizeRoom(room) {
  return {
    code: room.code, buyIn: room.buyIn, maxPlayers: room.maxPlayers,
    status: room.status, prizePool: room.prizePool,
    calledNumbers: room.calledNumbers,
    players: Object.values(room.players).map(p=>({
      id:p.id, username:p.username, isHost:p.id===room.hostId, ready:p.ready
    })),
    hostId: room.hostId
  };
}

// ─── Stripe Payment Routes ───
app.post('/api/payment/create-intent', authMiddleware, async (req, res) => {
  const { roomCode } = req.body;
  const room = rooms[roomCode];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  try {
    const intent = await stripe.paymentIntents.create({
      amount: room.buyIn * 100,
      currency: 'usd',
      metadata: { userId: req.user.id, roomCode }
    });
    res.json({ clientSecret: intent.client_secret });
  } catch(e) {
    // Fallback for demo without real Stripe keys
    res.json({ clientSecret: 'demo_secret', demo: true });
  }
});

app.post('/api/payment/demo-buyin', authMiddleware, (req, res) => {
  const { roomCode } = req.body;
  const room = rooms[roomCode];
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (req.user.balance < room.buyIn)
    return res.status(400).json({ error: 'Insufficient balance' });
  req.user.balance -= room.buyIn;
  room.prizePool += room.buyIn;
  const { password:_, ...userSafe } = req.user;
  res.json({ success: true, user: userSafe, prizePool: room.prizePool });
});

app.post('/api/payment/add-credits', authMiddleware, async (req, res) => {
  const { amount } = req.body; // amount in dollars
  // In production, verify Stripe payment here
  req.user.balance += amount;
  const { password:_, ...userSafe } = req.user;
  res.json({ success: true, user: userSafe });
});

app.get('/api/leaderboard', (req, res) => {
  const board = Object.values(users)
    .sort((a,b)=>b.gamesWon-a.gamesWon)
    .slice(0,10)
    .map(u=>({ username:u.username, gamesWon:u.gamesWon, gamesPlayed:u.gamesPlayed }));
  res.json(board);
});

// ─── Socket.io ───
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = users[decoded.id];
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`🟢 ${user.username} connected`);

  socket.on('joinRoom', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('error', 'Room not found');
    if (room.status !== 'waiting') return socket.emit('error', 'Game already started');
    if (Object.keys(room.players).length >= room.maxPlayers)
      return socket.emit('error', 'Room is full');

    socket.join(roomCode);
    socket.roomCode = roomCode;

    room.players[user.id] = {
      id: user.id, username: user.username,
      socketId: socket.id, card: generateBingoCard(),
      marked: Array.from({length:5},()=>Array(5).fill(false)),
      ready: false, paidIn: false
    };
    room.players[user.id].marked[2][2] = true; // FREE

    io.to(roomCode).emit('roomUpdate', sanitizeRoom(room));
    socket.emit('cardDealt', { card: room.players[user.id].card });
    console.log(`${user.username} joined room ${roomCode}`);
  });

  socket.on('playerReady', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[user.id]) return;
    room.players[user.id].ready = true;
    io.to(roomCode).emit('roomUpdate', sanitizeRoom(room));

    // Auto-start if all players ready and >= 2 players
    const players = Object.values(room.players);
    if (players.length >= 2 && players.every(p=>p.ready) && room.hostId === user.id) {
      startGame(room);
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== user.id) return socket.emit('error', 'Only host can start');
    if (Object.keys(room.players).length < 2) return socket.emit('error', 'Need at least 2 players');
    startGame(room);
  });

  socket.on('callNumber', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;
    if (room.hostId !== user.id) return socket.emit('error', 'Only host can call numbers');
    if (room.pool.length === 0) return socket.emit('error', 'All numbers called');

    const num = room.pool.pop();
    room.calledNumbers.push(num);
    const letter = getLetter(num);

    // Auto-mark FREE center and matching numbers
    Object.values(room.players).forEach(p => {
      for (let c=0;c<5;c++) for (let r=0;r<5;r++) {
        if (p.card[c][r] === num) p.marked[c][r] = true;
      }
    });

    io.to(roomCode).emit('numberCalled', { number: num, letter, calledNumbers: room.calledNumbers });

    // Check all players for auto-win
    Object.values(room.players).forEach(p => {
      if (checkWin(p.card, p.marked)) {
        declareWinner(room, p.id);
      }
    });
  });

  socket.on('claimBingo', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;
    const player = room.players[user.id];
    if (!player) return;
    if (checkWin(player.card, player.marked)) {
      declareWinner(room, user.id);
    } else {
      socket.emit('falseBingo', { message: 'Not a valid BINGO yet!' });
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      delete room.players[user.id];
      io.to(roomCode).emit('roomUpdate', sanitizeRoom(room));
      if (Object.keys(room.players).length === 0) {
        setTimeout(() => { if (rooms[roomCode]) delete rooms[roomCode]; }, 30000);
      }
    }
    console.log(`🔴 ${user.username} disconnected`);
  });
});

function startGame(room) {
  room.status = 'playing';
  room.pool = generatePool();
  room.calledNumbers = [];
  io.to(room.code).emit('gameStarted', { room: sanitizeRoom(room) });
  // Send each player their card
  Object.values(room.players).forEach(p => {
    const playerSocket = [...io.sockets.sockets.values()].find(s=>s.id===p.socketId);
    if (playerSocket) playerSocket.emit('cardDealt', { card: p.card });
  });
}

function declareWinner(room, winnerId) {
  if (room.status !== 'playing') return;
  room.status = 'finished';
  const winner = users[winnerId];
  const prize = room.prizePool;
  if (winner) {
    winner.balance += prize;
    winner.gamesWon += 1;
    Object.values(room.players).forEach(p => { if (users[p.id]) users[p.id].gamesPlayed += 1; });
  }
  io.to(room.code).emit('gameOver', {
    winnerId, winnerName: winner?.username || 'Unknown',
    prize, card: room.players[winnerId]?.card
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🎱 Bingo server running on port ${PORT}`));
