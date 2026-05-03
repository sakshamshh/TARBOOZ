const axios = require('axios');
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
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    const raw = response.data.choices[0].message.content.trim();
    try { res.json(JSON.parse(raw)); } catch { res.json({ search: false }); }
  } catch { res.json({ search: false }); }
};