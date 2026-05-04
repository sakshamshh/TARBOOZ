const db = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    await db.delete('memories', id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};