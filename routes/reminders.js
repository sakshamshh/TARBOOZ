const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const REMINDERS_FILE = path.join(__dirname, '../data/reminders.json');

function readReminders() {
  if (!fs.existsSync(REMINDERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8')); }
  catch { return []; }
}

function writeReminders(data) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/reminders — get all reminders
router.get('/', (req, res) => {
  const reminders = readReminders();
  const now = new Date();
  // Mark overdue
  const enriched = reminders.map(r => ({
    ...r,
    overdue: !r.done && new Date(r.datetime) < now
  }));
  res.json(enriched);
});

// GET /api/reminders/upcoming — next 24hrs
router.get('/upcoming', (req, res) => {
  const reminders = readReminders();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = reminders.filter(r =>
    !r.done && new Date(r.datetime) >= now && new Date(r.datetime) <= tomorrow
  );
  res.json(upcoming);
});

// POST /api/reminders — create a reminder
// Body: { title, datetime (ISO string), notes }
router.post('/', (req, res) => {
  const { title, datetime, notes } = req.body;
  if (!title || !datetime) return res.status(400).json({ error: 'title and datetime are required' });
  const reminders = readReminders();
  const entry = {
    id: uuidv4(),
    title,
    datetime,
    notes: notes || '',
    done: false,
    createdAt: new Date().toISOString()
  };
  reminders.push(entry);
  reminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  writeReminders(reminders);
  res.json(entry);
});

// PATCH /api/reminders/:id/done — mark done/undone
router.patch('/:id/done', (req, res) => {
  const reminders = readReminders();
  const r = reminders.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reminder not found' });
  r.done = !r.done;
  writeReminders(reminders);
  res.json(r);
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res) => {
  let reminders = readReminders();
  const before = reminders.length;
  reminders = reminders.filter(r => r.id !== req.params.id);
  if (reminders.length === before) return res.status(404).json({ error: 'Reminder not found' });
  writeReminders(reminders);
  res.json({ success: true });
});

// ── Cron: log upcoming reminders every minute (can hook notifications here later) ──
cron.schedule('* * * * *', () => {
  const reminders = readReminders();
  const now = new Date();
  const due = reminders.filter(r => {
    if (r.done) return false;
    const diff = Math.abs(new Date(r.datetime) - now);
    return diff < 60000; // within 1 minute
  });
  if (due.length) {
    console.log(`[Reminders] Due now: ${due.map(r => r.title).join(', ')}`);
  }
});

module.exports = router;
