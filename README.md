# 🎱 Bingo Multiplayer — Full Stack

Real-time multiplayer Bingo with payments, built with React + Node.js + Socket.io + Stripe.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure Server Environment

```bash
cd server
cp .env.example .env
# Edit .env with your values:
#   JWT_SECRET=your_random_secret
#   STRIPE_SECRET_KEY=sk_test_...   (from stripe.com)
#   CLIENT_URL=http://localhost:3000
```

### 3. Run

```bash
# Terminal 1 — Server
cd server
npm run dev

# Terminal 2 — Client
cd client
npm start
```

Open http://localhost:3000

---

## 🏗 Architecture

```
bingo/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── .env.example      # Environment template
│   └── package.json
└── client/
    ├── src/
    │   ├── App.js
    │   ├── context/
    │   │   └── AuthContext.js    # JWT auth + API calls
    │   └── pages/
    │       ├── Auth.js           # Login / Register
    │       ├── Lobby.js          # Room browser + wallet
    │       └── Game.js           # Real-time game board
    └── package.json
```

---

## 🎮 How to Play

1. **Register** an account (starts with $100 demo credits)
2. **Create a room** — set buy-in amount & max players
3. **Share the room code** with friends
4. Each player **pays the buy-in** and clicks **Ready**
5. Host clicks **Start Game**
6. Host **calls numbers** one by one
7. Players **click matching cells** on their card
8. First to complete a line clicks **BINGO!**
9. Winner receives the full prize pool 🏆

---

## 💳 Payment System

| Feature | Status |
|---------|--------|
| Demo wallet (in-memory) | ✅ Working |
| Buy-in per game | ✅ Working |
| Add credits (demo) | ✅ Working |
| Real Stripe payments | ⚙️ Add your Stripe key |

### Enable Real Stripe Payments

1. Create account at [stripe.com](https://stripe.com)
2. Get your test keys from the Stripe dashboard
3. Add `STRIPE_SECRET_KEY=sk_test_...` to `server/.env`
4. Add `REACT_APP_STRIPE_KEY=pk_test_...` to `client/.env`
5. Replace the demo payment buttons with Stripe Elements in `Lobby.js`

---

## 🔌 Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinRoom` | client→server | Join a game room |
| `roomUpdate` | server→client | Room state changed |
| `cardDealt` | server→client | Player receives their card |
| `playerReady` | client→server | Player marks ready |
| `startGame` | client→server | Host starts game |
| `callNumber` | client→server | Host calls next number |
| `numberCalled` | server→client | Broadcast called number |
| `claimBingo` | client→server | Player claims BINGO |
| `gameOver` | server→client | Winner announced |

---

## 🛠 Production Deployment

```bash
# Build client
cd client && npm run build

# Serve with nginx or add to Express:
# app.use(express.static('../client/build'));

# Use a real database (MongoDB/PostgreSQL)
# Replace in-memory users/rooms objects in server/index.js

# Set environment variables on your hosting platform
# Recommended: Railway, Render, or Heroku
```

---

## 📦 Tech Stack

- **Frontend**: React 18, Socket.io-client
- **Backend**: Node.js, Express, Socket.io
- **Auth**: JWT + bcrypt
- **Payments**: Stripe (demo mode included)
- **Styling**: Inline styles (no dependencies)

