# 🍉 Tarbooz — Your Personal AI

A self-hosted personal AI assistant powered by Groq (Llama 3.3 70B). Fast, free, and built to grow.

## Stack
- **Backend** — Node.js + Express
- **AI** — Groq (Llama 3.3 70B) — free
- **Weather** — Open-Meteo — free, no key needed
- **Search** — Tavily — free tier
- **Frontend** — Vanilla JS, no framework

## Quick Start

### 1. Install
```bash
npm install
```

### 2. Environment
```bash
cp .env.example .env
# Fill in your keys
```

### 3. Run
```bash
npm run dev        # development
npm start          # production
```

### 4. Apply upgrades
```bash
npm run upgrade
```

Open `http://localhost:3000`

## Project Structure
```
tarbooz/
├── server.js              ← Express server, all routes mount here
├── upgrade.js             ← Upgrade runner
├── package.json
├── .env                   ← Your keys (never commit)
├── .env.example           ← Template
├── .upgrades_applied      ← Tracks applied upgrades
├── public/
│   └── index.html         ← Full frontend (single file)
├── routes/
│   ├── ai.js              ← Groq AI + auto memory extraction
│   ├── memory.js          ← Persistent AI memory
│   ├── weather.js         ← Open-Meteo weather
│   ├── search.js          ← Tavily web search
│   ├── reminders.js       ← Reminders + cron
│   └── voice.js           ← Voice config
├── upgrades/
│   └── 003-web-search.js  ← Modular upgrade scripts
└── data/
    ├── memory.json         ← Auto-created
    └── reminders.json      ← Auto-created
```

## Adding Features
Every new feature = one file in `upgrades/`. Run `npm run upgrade` to apply.

## Upgrades Applied
| # | Feature | Status |
|---|---------|--------|
| 001 | Gemini → Groq switch | ✅ |
| 002 | Auto Memory | ✅ |
| 003 | Web Search (Tavily) | ✅ |
| 004 | Deploy Online | 🔜 |
| 005 | PWA / Mobile | 🔜 |
| 006 | Voice I/O | 🔜 |
| 007 | Google Calendar | 🔜 |

## Environment Variables
| Key | Required | Description |
|-----|----------|-------------|
| `GROQ_API_KEY` | ✅ | From console.groq.com |
| `TAVILY_API_KEY` | ✅ | From tavily.com |
| `PORT` | ❌ | Default 3000 |
