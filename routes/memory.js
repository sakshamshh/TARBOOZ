const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const MEMORY_FILE = path.join(__dirname, '../data/memory.json');

function readMemory() {
  if (!fs.existsSync(MEMORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); }
  catch { return []; }
}

function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// GET /api/memory — get all memories
router.get('/', (req, res) => {
  res.json(readMemory());
});

// POST /api/memory — add a memory
// Body: { content: 'string', tag: 'optional tag' }
router.post('/', (req, res) => {
  const { content, tag } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const memories = readMemory();
  const entry = {
    id: uuidv4(),
    content,
    tag: tag || 'general',
    createdAt: new Date().toISOString()
  };
  memories.unshift(entry);
  writeMemory(memories);
  res.json(entry);
});

// DELETE /api/memory/:id — delete a memory
router.delete('/:id', (req, res) => {
  let memories = readMemory();
  const before = memories.length;
  memories = memories.filter(m => m.id !== req.params.id);
  if (memories.length === before) return res.status(404).json({ error: 'Memory not found' });
  writeMemory(memories);
  res.json({ success: true });
});

// DELETE /api/memory — clear all memories
router.delete('/', (req, res) => {
  writeMemory([]);
  res.json({ success: true });
});

// GET /api/memory/context — returns memories formatted as system prompt context
router.get('/context', (req, res) => {
  const memories = readMemory();
  if (!memories.length) return res.json({ context: '' });
  const context = '## What you remember about the user:\n' +
    memories.map(m => `- [${m.tag}] ${m.content}`).join('\n');
  res.json({ context });
});

module.exports = router;
