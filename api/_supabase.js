const axios = require('axios');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
function headers() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}
module.exports = {
  async getAll(table) {
    const r = await axios.get(`${SUPABASE_URL}/rest/v1/${table}?order=created_at.desc`, { headers: headers() });
    return r.data;
  },
  async insert(table, data) {
    const r = await axios.post(`${SUPABASE_URL}/rest/v1/${table}`, data, { headers: headers() });
    return r.data[0];
  },
  async delete(table, id) {
    await axios.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { headers: headers() });
    return { success: true };
  },
  async deleteAll(table) {
    await axios.delete(`${SUPABASE_URL}/rest/v1/${table}?id=neq.00000000-0000-0000-0000-000000000000`, { headers: headers() });
    return { success: true };
  }
};