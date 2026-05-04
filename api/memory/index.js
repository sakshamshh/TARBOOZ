const db = require('../_supabase');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const memories = await db.getAll('memories');
      return res.json(memories);
    }
    if (req.method === 'POST') {
      const { content, tag } = req.body;
      if (!content) return res.status(400).json({ error: 'content required' });
      const entry = await db.insert('memories', {
        id: uuidv4(),
        content,
        tag: tag || 'general',
        created_at: new Date().toISOString()
      });
      return res.json(entry);
    }
    if (req.method === 'DELETE') {
      await db.deleteAll('memories');
      return res.json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch(err) {
    console.error('[Memory]', err.message);
    res.status(500).json({ error: err.message });
  }
};