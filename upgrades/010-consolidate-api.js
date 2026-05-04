const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 10 — Consolidate API into single function',
  apply: async () => {

    const apiDir = path.join(ROOT, 'api');

    // Remove all existing api files/folders except _supabase.js
    const cleanup = ['ai', 'memory', 'calendar', 'auth', 'health.js', 'memory.js', 'search.js', 'weather.js'];
    cleanup.forEach(item => {
      const p = path.join(apiDir, item);
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
      }
    });

    // Write single consolidated handler: api/index.js
    fs.writeFileSync(path.join(apiDir, 'index.js'), `const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ── Supabase ──
function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': \`Bearer \${process.env.SUPABASE_ANON_KEY}\`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}
async function sbGet(table) {
  const r = await axios.get(\`\${process.env.SUPABASE_URL}/rest/v1/\${table}?order=created_at.desc\`, { headers: sbHeaders() });
  return r.data;
}
async function sbInsert(table, data) {
  const r = await axios.post(\`\${process.env.SUPABASE_URL}/rest/v1/\${table}\`, data, { headers: sbHeaders() });
  return r.data[0];
}
async function sbDelete(table, id) {
  const filter = id ? \`?id=eq.\${id}\` : \`?id=neq.00000000-0000-0000-0000-000000000000\`;
  await axios.delete(\`\${process.env.SUPABASE_URL}/rest/v1/\${table}\${filter}\`, { headers: sbHeaders() });
}

// ── Groq ──
async function groq(messages, system, maxTokens = 1024, temp = 0.7) {
  const r = await axios.post(GROQ_URL, {
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: maxTokens,
    temperature: temp
  }, { headers: { 'Authorization': \`Bearer \${process.env.GROQ_API_KEY}\`, 'Content-Type': 'application/json' } });
  return r.data.choices[0].message.content;
}

// ── WMO Weather codes ──
const WMO = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Light drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',80:'Showers',95:'Thunderstorm'};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.split('?')[0].replace(/^\\/api/, '');
  const query = req.query;

  try {

    // ── Health ──
    if (url === '/health' || url === '') {
      return res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
    }

    // ── AI Chat ──
    if (url === '/ai/chat') {
      const { messages, systemPrompt } = req.body;
      const text = await groq(messages, systemPrompt || 'You are Tarbooz, a sharp witty personal AI.');
      return res.json({ content: [{ text }] });
    }

    // ── AI Extract Memory ──
    if (url === '/ai/extract-memory') {
      const { userMessage, aiResponse } = req.body;
      const raw = await groq(
        [{ role: 'user', content: \`User: "\${userMessage}"\\nAI: "\${aiResponse}"\\nExtract facts:\` }],
        'Extract memorable facts about the user. Return ONLY a JSON array: [{"content":"fact","tag":"preference"}]. Tags: preference,fact,goal,work,personal,habit. Max 3. If nothing return []. Raw JSON only.',
        256, 0.1
      );
      try { return res.json({ facts: JSON.parse(raw) }); } catch { return res.json({ facts: [] }); }
    }

    // ── AI Should Search ──
    if (url === '/ai/should-search') {
      const { message } = req.body;
      const raw = await groq(
        [{ role: 'user', content: message }],
        'Decide if this needs a web search. Reply ONLY with {"search":true,"query":"search query"} or {"search":false}. Search for current events, news, prices, sports. Do NOT search for coding, math, opinions.',
        64, 0.1
      );
      try { return res.json(JSON.parse(raw)); } catch { return res.json({ search: false }); }
    }

    // ── Weather ──
    if (url === '/weather') {
      const city = query.city || 'Amritsar';
      const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: city, count: 1, language: 'en', format: 'json' } });
      const g = geo.data.results?.[0];
      if (!g) return res.status(404).json({ error: 'City not found' });
      const w = await axios.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: g.latitude, longitude: g.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', daily: 'sunrise,sunset', timezone: 'auto', forecast_days: 1 } });
      const c = w.data.current, d = w.data.daily;
      return res.json({ city: g.name, country: g.country, temp: Math.round(c.temperature_2m), feels_like: Math.round(c.apparent_temperature), condition: WMO[c.weather_code] || 'Unknown', humidity: c.relative_humidity_2m, wind_kph: Math.round(c.wind_speed_10m), sunrise: new Date(d.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), sunset: new Date(d.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    }

    // ── Search ──
    if (url === '/search') {
      const q = query.q;
      if (!q) return res.status(400).json({ error: 'q required' });
      const r = await axios.post('https://api.tavily.com/search', { api_key: process.env.TAVILY_API_KEY, query: q, search_depth: 'basic', max_results: 5, include_answer: true });
      return res.json({ query: q, answer: r.data.answer || null, results: (r.data.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.content?.slice(0, 200) })) });
    }

    // ── Memory ──
    if (url === '/memory/context') {
      const memories = await sbGet('memories');
      if (!memories.length) return res.json({ context: '' });
      return res.json({ context: '## What you remember about the user:\\n' + memories.map(m => \`- [\${m.tag}] \${m.content}\`).join('\\n') });
    }

    if (url.startsWith('/memory')) {
      const idMatch = url.match(/\\/memory\\/([a-f0-9-]{36})/);
      if (req.method === 'GET') {
        return res.json(await sbGet('memories'));
      }
      if (req.method === 'POST') {
        const { content, tag } = req.body;
        if (!content) return res.status(400).json({ error: 'content required' });
        const entry = await sbInsert('memories', { id: uuidv4(), content, tag: tag || 'general', created_at: new Date().toISOString() });
        return res.json(entry);
      }
      if (req.method === 'DELETE') {
        await sbDelete('memories', idMatch?.[1] || null);
        return res.json({ success: true });
      }
    }

    // ── Auth ──
    if (url === '/auth/login') {
      const redirect = 'https://tarbooz.vercel.app/auth/callback';
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events');
      return res.redirect(\`https://accounts.google.com/o/oauth2/v2/auth?client_id=\${process.env.GOOGLE_CLIENT_ID}&redirect_uri=\${encodeURIComponent(redirect)}&response_type=code&scope=\${scope}&access_type=offline&prompt=consent\`);
    }

    if (url === '/auth/callback') {
      const { code } = query;
      const r = await axios.post('https://oauth2.googleapis.com/token', { code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: 'https://tarbooz.vercel.app/auth/callback', grant_type: 'authorization_code' });
      const { access_token, refresh_token, expires_in } = r.data;
      return res.redirect(\`/?cal_token=\${access_token}&cal_refresh=\${refresh_token}&cal_expires=\${Date.now() + expires_in * 1000}\`);
    }

    // ── Calendar ──
    if (url === '/calendar/events') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const r = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', { headers: { Authorization: \`Bearer \${token}\` }, params: { timeMin: now, timeMax: future, singleEvents: true, orderBy: 'startTime', maxResults: 10 } });
      return res.json({ events: (r.data.items || []).map(e => ({ id: e.id, title: e.summary || 'Untitled', start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, location: e.location || null, allDay: !e.start?.dateTime })) });
    }

    if (url === '/calendar/create') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      const { title, start, end, description, location } = req.body;
      const r = await axios.post('https://www.googleapis.com/calendar/v3/calendars/primary/events', { summary: title, start: { dateTime: start }, end: { dateTime: end || start }, description, location }, { headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' } });
      return res.json({ event: r.data });
    }

    return res.status(404).json({ error: 'Not found' });

  } catch(err) {
    console.error('[API]', url, err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
};
`);

    // Update vercel.json — route everything through single function
    fs.writeFileSync(path.join(ROOT, 'vercel.json'),
      JSON.stringify({
        rewrites: [
          { source: '/api/:path*', destination: '/api/index' },
          { source: '/(.*)', destination: '/public/index.html' }
        ]
      })
    );

    // Clean up _supabase.js since it's now inlined
    const sbPath = path.join(apiDir, '_supabase.js');
    if (fs.existsSync(sbPath)) fs.unlinkSync(sbPath);

    console.log('  → All API routes consolidated into api/index.js');
    console.log('  → vercel.json updated — single function handles everything');
    console.log('  → Under 12 function limit');
  }
};
