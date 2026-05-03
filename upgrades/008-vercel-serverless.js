const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 8 — Vercel Serverless Functions',
  apply: async () => {

    // Create api/ directory for Vercel serverless functions
    const apiDir = path.join(ROOT, 'api');
    if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
    const aiDir = path.join(apiDir, 'ai');
    if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir);
    const memDir = path.join(apiDir, 'memory');
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir);

    // 1. api/ai/chat.js
    fs.writeFileSync(path.join(aiDir, 'chat.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt || 'You are Tarbooz, a sharp witty personal AI.' },
        ...messages
      ],
      max_tokens: 1024,
      temperature: 0.7
    }, { headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' } });
    const text = response.data.choices[0].message.content;
    res.json({ content: [{ text }] });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
};`);

    // 2. api/ai/extract-memory.js
    fs.writeFileSync(path.join(aiDir, 'extract-memory.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userMessage, aiResponse } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ facts: [] });
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Extract memorable facts about the user from this conversation. Return ONLY a JSON array: [{"content": "fact", "tag": "preference"}]. Tags: preference, fact, goal, work, personal, habit. Max 3 facts. If nothing memorable, return []. Raw JSON only.' },
        { role: 'user', content: \`User: "\${userMessage}"\\nAI: "\${aiResponse}"\\nExtract facts:\` }
      ],
      max_tokens: 256,
      temperature: 0.1
    }, { headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' } });
    const raw = response.data.choices[0].message.content.trim();
    try { res.json({ facts: JSON.parse(raw) }); } catch { res.json({ facts: [] }); }
  } catch { res.json({ facts: [] }); }
};`);

    // 3. api/ai/should-search.js
    fs.writeFileSync(path.join(aiDir, 'should-search.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ search: false });
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Decide if this needs a web search. Reply ONLY with {"search": true, "query": "search query"} or {"search": false}. Search for: current events, news, prices, sports, weather, recent info. Do NOT search for: coding, math, opinions, general knowledge.' },
        { role: 'user', content: message }
      ],
      max_tokens: 64,
      temperature: 0.1
    }, { headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' } });
    const raw = response.data.choices[0].message.content.trim();
    try { res.json(JSON.parse(raw)); } catch { res.json({ search: false }); }
  } catch { res.json({ search: false }); }
};`);

    // 4. api/weather.js
    fs.writeFileSync(path.join(apiDir, 'weather.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  const { city = 'Amritsar' } = req.query;
  try {
    const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: city, count: 1, language: 'en', format: 'json' } });
    const results = geo.data.results;
    if (!results?.length) return res.status(404).json({ error: 'City not found' });
    const g = results[0];
    const w = await axios.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: g.latitude, longitude: g.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m', daily: 'sunrise,sunset', timezone: 'auto', forecast_days: 1 } });
    const c = w.data.current, d = w.data.daily;
    const wmo = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Light drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',80:'Showers',95:'Thunderstorm'};
    res.json({ city: g.name, country: g.country, temp: Math.round(c.temperature_2m), feels_like: Math.round(c.apparent_temperature), condition: wmo[c.weather_code]||'Unknown', humidity: c.relative_humidity_2m, wind_kph: Math.round(c.wind_speed_10m), sunrise: new Date(d.sunrise[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), sunset: new Date(d.sunset[0]).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) });
  } catch(err) { res.status(500).json({ error: err.message }); }
};`);

    // 5. api/search.js
    fs.writeFileSync(path.join(apiDir, 'search.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  const { q } = req.query;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY not set' });
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const r = await axios.post('https://api.tavily.com/search', { api_key: apiKey, query: q, search_depth: 'basic', max_results: 5, include_answer: true });
    res.json({ query: q, answer: r.data.answer||null, results: (r.data.results||[]).map(x=>({ title: x.title, url: x.url, snippet: x.content?.slice(0,200) })) });
  } catch(err) { res.status(500).json({ error: err.message }); }
};`);

    // 6. api/health.js
    fs.writeFileSync(path.join(apiDir, 'health.js'), `module.exports = (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
};`);

    // 7. api/memory.js — using Vercel KV or simple in-memory (stateless warning)
    fs.writeFileSync(path.join(apiDir, 'memory.js'), `const { v4: uuidv4 } = require('uuid');

// NOTE: Vercel is stateless - memory stored in-process won't persist between requests.
// For persistent memory, connect Vercel KV (free) in your Vercel dashboard.
// For now this returns empty - memory features work on localhost only.
module.exports = async (req, res) => {
  if (req.method === 'GET' && !req.url.includes('context')) return res.json([]);
  if (req.method === 'GET') return res.json({ context: '' });
  if (req.method === 'POST') return res.json({ id: uuidv4(), ...req.body, createdAt: new Date().toISOString() });
  if (req.method === 'DELETE') return res.json({ success: true });
  res.status(405).json({ error: 'Method not allowed' });
};`);

    // 8. vercel.json — routing config
    fs.writeFileSync(path.join(ROOT, 'vercel.json'), JSON.stringify({
      version: 2,
      builds: [
        { src: 'api/**/*.js', use: '@vercel/node' },
        { src: 'public/**', use: '@vercel/static' }
      ],
      routes: [
        { src: '/api/(.*)', dest: '/api/$1' },
        { src: '/(.*)', dest: '/public/$1' }
      ]
    }, null, 2));

    console.log('  → api/ serverless functions created');
    console.log('  → vercel.json routing configured');
    console.log('  → weather, search, AI, health endpoints ready');
    console.log('  → NOTE: memory requires Vercel KV for persistence on production');
  }
};
