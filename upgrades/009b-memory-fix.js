const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 9b — Fix memory API routing on Vercel',
  apply: async () => {

    const memDir = path.join(ROOT, 'api', 'memory');
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

    const supabaseHelper = `const axios = require('axios');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
function headers() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': \`Bearer \${SUPABASE_KEY}\`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}
module.exports = {
  async getAll(table) {
    const r = await axios.get(\`\${SUPABASE_URL}/rest/v1/\${table}?order=created_at.desc\`, { headers: headers() });
    return r.data;
  },
  async insert(table, data) {
    const r = await axios.post(\`\${SUPABASE_URL}/rest/v1/\${table}\`, data, { headers: headers() });
    return r.data[0];
  },
  async delete(table, id) {
    await axios.delete(\`\${SUPABASE_URL}/rest/v1/\${table}?id=eq.\${id}\`, { headers: headers() });
    return { success: true };
  },
  async deleteAll(table) {
    await axios.delete(\`\${SUPABASE_URL}/rest/v1/\${table}?id=neq.00000000-0000-0000-0000-000000000000\`, { headers: headers() });
    return { success: true };
  }
};`;

    // Write supabase helper in memory dir too
    fs.writeFileSync(path.join(ROOT, 'api', '_supabase.js'), supabaseHelper);

    // api/memory/index.js — GET all, POST new
    fs.writeFileSync(path.join(memDir, 'index.js'), `const db = require('../_supabase');
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
};`);

    // api/memory/context.js — GET memory as AI context string
    fs.writeFileSync(path.join(memDir, 'context.js'), `const db = require('../_supabase');

module.exports = async (req, res) => {
  try {
    const memories = await db.getAll('memories');
    if (!memories.length) return res.json({ context: '' });
    const context = '## What you remember about the user:\\n' +
      memories.map(m => \`- [\${m.tag}] \${m.content}\`).join('\\n');
    res.json({ context });
  } catch(err) {
    res.json({ context: '' });
  }
};`);

    // api/memory/[id].js — DELETE single memory
    fs.writeFileSync(path.join(memDir, '[id].js'), `const db = require('../_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    await db.delete('memories', id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};`);

    // Update vercel.json to handle memory routes
    fs.writeFileSync(path.join(ROOT, 'vercel.json'),
      JSON.stringify({
        rewrites: [
          { source: '/api/memory/context', destination: '/api/memory/context' },
          { source: '/api/memory/:id', destination: '/api/memory/[id]' },
          { source: '/api/memory', destination: '/api/memory/index' },
          { source: '/api/(.*)', destination: '/api/$1' },
          { source: '/(.*)', destination: '/public/index.html' }
        ]
      })
    );

    console.log('  → api/memory/index.js created (GET all, POST new, DELETE all)');
    console.log('  → api/memory/context.js created');
    console.log('  → api/memory/[id].js created (DELETE single)');
    console.log('  → vercel.json updated with memory routes');
  }
};
