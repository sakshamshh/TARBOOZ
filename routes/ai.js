const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function groqHeaders(apiKey) {
  return { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { messages, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set in .env' });
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  try {
    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'You are Tarbooz, a helpful personal AI assistant.' },
        ...messages
      ],
      max_tokens: 1024,
      temperature: 0.7
    }, { headers: groqHeaders(apiKey) });

    const text = response.data.choices[0].message.content;
    res.json({ content: [{ text }] });

  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error(`[AI] Error ${status}:`, message);
    res.status(status).json({ error: message });
  }
});

// POST /api/ai/extract-memory
// Silently extracts memorable facts from a conversation turn
router.post('/extract-memory', async (req, res) => {
  const { userMessage, aiResponse } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ facts: [] });

  try {
    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a memory extraction system. Given a conversation exchange, extract any facts worth remembering about the user — their name, preferences, goals, job, habits, opinions, or anything personal they revealed.

Rules:
- Return ONLY a JSON array of objects like: [{"content": "fact here", "tag": "preference"}]
- Tags must be one of: preference, fact, goal, work, personal, habit
- Only extract things about the USER, not general knowledge
- If nothing is worth remembering, return an empty array: []
- Maximum 3 facts per exchange
- Be concise, each fact under 100 characters
- Return raw JSON only, no markdown, no explanation`
        },
        {
          role: 'user',
          content: `User said: "${userMessage}"\nAI responded: "${aiResponse}"\n\nExtract memorable facts about the user:`
        }
      ],
      max_tokens: 256,
      temperature: 0.1
    }, { headers: groqHeaders(apiKey) });

    const raw = response.data.choices[0].message.content.trim();
    let facts = [];
    try {
      facts = JSON.parse(raw);
      if (!Array.isArray(facts)) facts = [];
    } catch { facts = []; }

    res.json({ facts });

  } catch (err) {
    console.error('[AutoMemory] Extract error:', err.message);
    res.json({ facts: [] }); // fail silently
  }
});

module.exports = router;

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
