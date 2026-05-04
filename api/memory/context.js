const db = require('../_supabase');

module.exports = async (req, res) => {
  try {
    const memories = await db.getAll('memories');
    if (!memories.length) return res.json({ context: '' });
    const context = '## What you remember about the user:\n' +
      memories.map(m => `- [${m.tag}] ${m.content}`).join('\n');
    res.json({ context });
  } catch(err) {
    res.json({ context: '' });
  }
};