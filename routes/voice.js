const express = require('express');
const router = express.Router();

// Voice input/output is handled client-side via Web Speech API (no server needed).
// This route exists for future server-side TTS (e.g. ElevenLabs, Google TTS)
// or Whisper-based STT when those are added.

// GET /api/voice/config — returns voice settings/available engines
router.get('/config', (req, res) => {
  res.json({
    stt: 'browser', // Web Speech API
    tts: 'browser', // Web Speech Synthesis
    languages: [
      { code: 'en-IN', label: 'English (India)' },
      { code: 'en-US', label: 'English (US)' },
      { code: 'en-GB', label: 'English (UK)' },
      { code: 'hi-IN', label: 'Hindi' },
      { code: 'pa-IN', label: 'Punjabi' }
    ]
  });
});

module.exports = router;
