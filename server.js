require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Ensure data directory exists ──
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting — protect API routes
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many requests, slow down.' }
});
app.use('/api', limiter);

// ── Routes ──
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/memory',    require('./routes/memory'));
app.use('/api/weather',   require('./routes/weather'));
app.use('/api/search',    require('./routes/search'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/voice',     require('./routes/voice'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ── Catch-all → serve frontend ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n🍉 Tarbooz running at http://localhost:${PORT}`);
  console.log(`   API health: http://localhost:${PORT}/api/health\n`);
});
