const express = require('express');
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
