const axios = require('axios');
module.exports = async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = 'https://tarbooz.vercel.app/auth/callback';
  try {
    const r = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirect, grant_type: 'authorization_code'
    });
    const { access_token, refresh_token, expires_in } = r.data;
    // Send tokens to frontend via URL params (frontend stores in localStorage)
    res.redirect(`/?cal_token=${access_token}&cal_refresh=${refresh_token}&cal_expires=${Date.now() + expires_in * 1000}`);
  } catch(err) {
    res.status(500).send('Auth failed: ' + (err.response?.data?.error || err.message));
  }
};