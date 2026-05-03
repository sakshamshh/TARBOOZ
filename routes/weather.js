const express = require('express');
const axios = require('axios');
const router = express.Router();

async function geocode(city) {
  const r = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: city, count: 1, language: 'en', format: 'json' }
  });
  const results = r.data.results;
  if (!results || !results.length) throw new Error(`City "${city}" not found`);
  return results[0];
}

function wmoDescription(code) {
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Icy fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
  };
  return map[code] || 'Unknown';
}

router.get('/', async (req, res) => {
  const { city = 'Amritsar' } = req.query;
  try {
    const geo = await geocode(city);
    const r = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: geo.latitude,
        longitude: geo.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility',
        daily: 'sunrise,sunset',
        timezone: 'auto',
        forecast_days: 1
      }
    });
    const c = r.data.current;
    const d = r.data.daily;
    res.json({
      city: geo.name,
      country: geo.country,
      temp: Math.round(c.temperature_2m),
      feels_like: Math.round(c.apparent_temperature),
      condition: wmoDescription(c.weather_code),
      humidity: c.relative_humidity_2m,
      wind_kph: Math.round(c.wind_speed_10m),
      visibility_km: c.visibility ? Math.round(c.visibility / 1000) : null,
      sunrise: new Date(d.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sunset: new Date(d.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err) {
    console.error('[Weather]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
