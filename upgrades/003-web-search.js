const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 3 — Web Search via Tavily',
  apply: async () => {

    // 1. Write new search route
    fs.writeFileSync(path.join(ROOT, 'routes/search.js'), `const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  const { q } = req.query;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TAVILY_API_KEY not set in .env' });
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const r = await axios.post('https://api.tavily.com/search', {
      api_key: apiKey,
      query: q,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true
    });
    res.json({
      query: q,
      answer: r.data.answer || null,
      results: (r.data.results || []).map(x => ({
        title: x.title,
        url: x.url,
        snippet: x.content?.slice(0, 200)
      }))
    });
  } catch (err) {
    console.error('[Search]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`);

    // 2. Update ai.js to add /api/ai/should-search endpoint
    const aiPath = path.join(ROOT, 'routes/ai.js');
    let ai = fs.readFileSync(aiPath, 'utf8');

    if (!ai.includes('should-search')) {
      ai += `
// POST /api/ai/should-search
// Decides if a query needs a web search
router.post('/should-search', async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ search: false });
  try {
    const response = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You decide if a user message needs a live web search. Reply with only: {"search": true, "query": "search query"} or {"search": false}. Search when asked about current events, news, prices, weather, sports scores, or anything time-sensitive. Do not search for general knowledge, coding help, math, or opinions.' },
        { role: 'user', content: message }
      ],
      max_tokens: 64,
      temperature: 0.1
    }, { headers: groqHeaders(apiKey) });
    const raw = response.data.choices[0].message.content.trim();
    try { res.json(JSON.parse(raw)); } catch { res.json({ search: false }); }
  } catch { res.json({ search: false }); }
});
`;
      fs.writeFileSync(aiPath, ai);
    }

    // 3. Patch index.html — inject search logic into sendMessage
    const htmlPath = path.join(ROOT, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (!html.includes('should-search')) {
      // Add search results injector before chat history push
      html = html.replace(
        `const tid=appendTyping();`,
        `const tid=appendTyping();`
      );

      // Replace the try block opening in sendMessage to inject search
      const oldTry = `    const tid=appendTyping();
  try{
    // Fetch memory context
    let memCtx='';`;

      const newTry = `    const tid=appendTyping();
  try{
    // Check if search needed
    let searchContext='';
    try {
      const sr = await fetch(API+'/api/ai/should-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
      const sd = await sr.json();
      if(sd.search && sd.query){
        const qr = await fetch(API+'/api/search?q='+encodeURIComponent(sd.query));
        const qd = await qr.json();
        if(qd.answer || qd.results?.length){
          searchContext = '\\n\\n## Live search results for "'+sd.query+'":\\n';
          if(qd.answer) searchContext += 'Summary: '+qd.answer+'\\n';
          (qd.results||[]).forEach(r=>{ searchContext += '- '+r.title+': '+r.snippet+'\\n'; });
          appendSearchBadge(sd.query);
        }
      }
    } catch{}
    // Fetch memory context
    let memCtx='';`;

      html = html.replace(oldTry, newTry);

      // Inject search context into system prompt
      html = html.replace(
        `const systemPrompt=getSystemPrompt()+(memCtx?'\\n\\n'+memCtx:'');`,
        `const systemPrompt=getSystemPrompt()+(memCtx?'\\n\\n'+memCtx:'')+(searchContext||'');`
      );

      // Add appendSearchBadge function
      html = html.replace(
        `// ── AUTO MEMORY ──`,
        `// ── SEARCH BADGE ──
function appendSearchBadge(query){
  const msgs=document.getElementById('chatMessages');
  const d=document.createElement('div');
  d.style.cssText='font-size:11px;color:var(--blue);padding:2px 0 6px 38px;animation:fadeIn .3s ease';
  d.textContent='🔍 Searched: '+query;
  msgs.appendChild(d);
}

// ── AUTO MEMORY ──`
      );

      fs.writeFileSync(htmlPath, html);
    }

    console.log('  → search route updated');
    console.log('  → ai.js patched with should-search');
    console.log('  → frontend patched with auto search');
  }
};
