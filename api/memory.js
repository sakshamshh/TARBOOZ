const { v4: uuidv4 } = require('uuid');

// NOTE: Vercel is stateless - memory stored in-process won't persist between requests.
// For persistent memory, connect Vercel KV (free) in your Vercel dashboard.
// For now this returns empty - memory features work on localhost only.
module.exports = async (req, res) => {
  if (req.method === 'GET' && !req.url.includes('context')) return res.json([]);
  if (req.method === 'GET') return res.json({ context: '' });
  if (req.method === 'POST') return res.json({ id: uuidv4(), ...req.body, createdAt: new Date().toISOString() });
  if (req.method === 'DELETE') return res.json({ success: true });
  res.status(405).json({ error: 'Method not allowed' });
};