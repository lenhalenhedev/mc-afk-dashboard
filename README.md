# ⛏️ MC AFK Dashboard

A production-grade Minecraft AFK bot manager with a real-time web dashboard.

## Features

- **Multi-account** — manage unlimited bots, each with its own config
- **Real-time dashboard** — live health, hunger, position, ping via Socket.IO
- **Anti-AFK** — random movements, head rotation, jumping, sneaking (30–80s intervals)
- **Auto-reconnect** — random delay 3–15s, configurable max retries
- **Chat relay** — read server chat + send messages from the dashboard
- **Console logs** — filterable, searchable, exportable per-bot logs
- **Per-bot settings** — server, version, movement pattern, join commands, etc.
- **Auth gate** — JWT-protected dashboard (username/password in `.env`)
- **SQLite** — persistent config and log storage
- **Export/Import** — JSON backup of all accounts and settings

## Requirements

- **Node.js 20+** (ESM, `--watch` flag)
- npm 9+

## Installation

```bash
# 1. Clone / unzip the project
cd mc-afk-dashboard

# 2. Install dependencies (this takes a minute — mineflayer is heavy)
npm install

# 3. Copy and edit the environment file
cp .env.example .env
# Edit .env and set your DASHBOARD_USERNAME, DASHBOARD_PASSWORD, JWT_SECRET
```

## Running (Development)

```bash
npm run dev
```

- **Backend** → `http://localhost:3001`
- **Frontend** (Vite dev server) → `http://localhost:5173`

Open `http://localhost:5173` and log in with your `.env` credentials.

## Running (Production)

```bash
# Build the React frontend
npm run build

# Start the production server (serves both API + static files)
npm start
```

Open `http://localhost:3001` (or whatever PORT you set).

## Environment Variables

| Key | Default | Description |
|-----|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `NODE_ENV` | `development` | Set to `production` for prod |
| `DASHBOARD_USERNAME` | `admin` | Login username |
| `DASHBOARD_PASSWORD` | `changeme123` | Login password (**change this!**) |
| `JWT_SECRET` | *(insecure default)* | JWT signing secret (**change this!**) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (dev only) |
| `DB_PATH` | `./data/mcafk.db` | SQLite database path |
| `LOG_DIR` | `./logs` | Directory for log files |
| `JWT_EXPIRES_IN` | `86400` | JWT expiry in seconds (24h) |

## Project Structure

```
mc-afk-dashboard/
├── src/
│   ├── server/
│   │   ├── index.js            # Express + Socket.IO entry point
│   │   ├── botManager.js       # All bot instances registry
│   │   ├── botInstance.js      # Single bot lifecycle class
│   │   ├── database.js         # SQLite schema + helpers
│   │   ├── logger.js           # Winston logger
│   │   ├── socketHandlers.js   # Socket.IO event handlers
│   │   ├── middleware/auth.js  # JWT middleware
│   │   └── routes/
│   │       ├── auth.js         # Login/logout endpoints
│   │       ├── bots.js         # CRUD + bot control REST
│   │       └── config.js       # Export/import endpoints
│   └── client/
│       ├── main.jsx            # React entry
│       ├── App.jsx             # Router + socket wiring
│       ├── index.css           # Tailwind + custom styles
│       ├── store/useStore.js   # Zustand global state
│       ├── lib/
│       │   ├── socket.js       # Socket.IO client singleton
│       │   └── api.js          # Fetch wrapper
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   └── Dashboard.jsx
│       └── components/
│           ├── Header.jsx
│           ├── Sidebar.jsx
│           ├── BotPanel.jsx
│           ├── BotStats.jsx
│           ├── LogViewer.jsx
│           ├── ChatPanel.jsx
│           ├── BotSettings.jsx
│           └── Toast.jsx
├── data/                       # SQLite DB (auto-created)
├── logs/                       # Log files (auto-created)
├── .env.example
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Microsoft Authentication

Set `auth_type: microsoft` for a bot. On first connect, mineflayer will emit a device code to the console log. Open the URL shown, enter the code, and log in with your Microsoft account. The session is cached automatically.

## Anti-AFK Patterns

| Pattern | Behaviour |
|---------|-----------|
| `random` | Randomly picks from: jump, sneak, strafe, forward, look |
| `jump` | Jump every 30–80 seconds |
| `strafe` | Strafe left/right briefly |
| `circle` | Look + move forward briefly |

Head rotation runs independently every 10–30 seconds regardless of pattern.

## Notes

- Logs are ring-buffered to 2000 entries per bot in the DB
- Reconnect uses random delay (3–15s) to avoid ban patterns
- Join commands are sent with a 2-second gap each
- All bot control is also available via the REST API (see `routes/bots.js`)
