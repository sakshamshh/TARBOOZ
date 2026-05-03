const axios = require('axios');
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
};