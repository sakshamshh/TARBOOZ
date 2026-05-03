const axios = require('axios');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { title, start, end, description, location } = req.body;
  try {
    const r = await axios.post('https://www.googleapis.com/calendar/v3/calendars/primary/events',
      { summary: title, start: { dateTime: start }, end: { dateTime: end || start }, description, location },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    res.json({ event: r.data });
  } catch(err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
};