const axios = require('axios');
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
        { role: 'user', content: `User: "${userMessage}"\nAI: "${aiResponse}"\nExtract facts:` }
      ],
      max_tokens: 256,
      temperature: 0.1
    }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    const raw = response.data.choices[0].message.content.trim();
    try { res.json({ facts: JSON.parse(raw) }); } catch { res.json({ facts: [] }); }
  } catch { res.json({ facts: [] }); }
};