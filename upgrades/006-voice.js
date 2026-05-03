const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 6 — Voice Input & Text-to-Speech',
  apply: async () => {

    const htmlPath = path.join(ROOT, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (html.includes('006-voice-applied')) {
      console.log('  → already applied, skipping');
      return;
    }

    // 1. Add voice CSS
    html = html.replace(
      `@media(max-width:760px){`,
      `/* VOICE */
.mic-btn.listening{background:var(--red-bg)!important;border-color:var(--red)!important;color:var(--red)!important;animation:micPulse 1s infinite}
@keyframes micPulse{0%,100%{opacity:1}50%{opacity:.4}}
.voice-wave{display:flex;align-items:center;gap:3px;padding:10px 14px;background:var(--text);border-radius:12px;border-bottom-left-radius:4px}
.voice-wave span{width:3px;border-radius:3px;background:#fff;animation:wave 1s infinite ease-in-out}
.voice-wave span:nth-child(1){height:8px;animation-delay:0s}
.voice-wave span:nth-child(2){height:16px;animation-delay:.1s}
.voice-wave span:nth-child(3){height:24px;animation-delay:.2s}
.voice-wave span:nth-child(4){height:16px;animation-delay:.3s}
.voice-wave span:nth-child(5){height:8px;animation-delay:.4s}
@keyframes wave{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.8)}}
@media(max-width:760px){`
    );

    // 2. Replace placeholder voice functions with real implementation
    html = html.replace(
      `// ── VOICE ──
let recognition=null,isListening=false;
function toggleVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert('Voice not supported in this browser. Try Chrome.');return;}
  if(isListening){recognition&&recognition.stop();return;}
  recognition=new SR();
  recognition.lang=settings.lang||'en-IN';
  recognition.interimResults=true;
  recognition.onstart=()=>{isListening=true;document.getElementById('micBtn').classList.add('active');document.getElementById('chatInput').placeholder='Listening…';};
  recognition.onresult=e=>{document.getElementById('chatInput').value=Array.from(e.results).map(r=>r[0].transcript).join('');};
  recognition.onend=()=>{isListening=false;document.getElementById('micBtn').classList.remove('active');document.getElementById('chatInput').placeholder='Message Tarbooz…';if(document.getElementById('chatInput').value.trim())sendMessage();};
  recognition.onerror=e=>{isListening=false;document.getElementById('micBtn').classList.remove('active');if(e.error==='not-allowed')alert('Microphone access denied.');};
  recognition.start();
}
function speak(text){
  if(!settings.tts||!window.speechSynthesis)return;
  stopSpeaking();
  const clean=text.replace(/\\*\\*(.+?)\\*\\*/g,'$1').replace(/\\*(.+?)\\*/g,'$1').replace(/\`(.+?)\`/g,'$1').replace(/\\n/g,' ');
  const u=new SpeechSynthesisUtterance(clean);
  u.rate=parseFloat(settings.rate||1);u.lang=settings.lang||'en-IN';
  u.onstart=()=>{document.getElementById('stopBtn').style.display='flex';};
  u.onend=u.onerror=()=>{document.getElementById('stopBtn').style.display='none';};
  window.speechSynthesis.speak(u);
}
function stopSpeaking(){window.speechSynthesis&&window.speechSynthesis.cancel();document.getElementById('stopBtn').style.display='none';}`,

      `// ── VOICE — 006-voice-applied ──
let recognition=null,isListening=false,isSpeaking=false;

function toggleVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    alert('Voice input not supported in this browser.\\nOn iPhone: use Safari.\\nOn desktop: use Chrome or Edge.');
    return;
  }
  if(isListening){recognition&&recognition.stop();return;}
  startListening();
}

function startListening(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();
  recognition.lang=settings.lang||'en-IN';
  recognition.interimResults=true;
  recognition.continuous=false;

  recognition.onstart=()=>{
    isListening=true;
    document.getElementById('micBtn').classList.add('active','listening');
    document.getElementById('chatInput').placeholder='Listening…';
    appendVoiceWave();
  };

  recognition.onresult=e=>{
    const transcript=Array.from(e.results).map(r=>r[0].transcript).join('');
    document.getElementById('chatInput').value=transcript;
    autoResize(document.getElementById('chatInput'));
  };

  recognition.onend=()=>{
    isListening=false;
    document.getElementById('micBtn').classList.remove('active','listening');
    document.getElementById('chatInput').placeholder='Message Tarbooz…';
    removeVoiceWave();
    const text=document.getElementById('chatInput').value.trim();
    if(text) sendMessage();
  };

  recognition.onerror=e=>{
    isListening=false;
    document.getElementById('micBtn').classList.remove('active','listening');
    document.getElementById('chatInput').placeholder='Message Tarbooz…';
    removeVoiceWave();
    if(e.error==='not-allowed'){
      alert('Microphone access denied.\\nGo to browser settings and allow microphone access for this site.');
    } else if(e.error==='no-speech'){
      // silently ignore, user just didn't speak
    } else {
      console.warn('Voice error:',e.error);
    }
  };

  try { recognition.start(); }
  catch(e){ console.warn('Recognition start error:', e.message); }
}

function appendVoiceWave(){
  removeVoiceWave();
  const msgs=document.getElementById('chatMessages');
  const d=document.createElement('div');
  d.className='msg';d.id='voice-wave-indicator';
  d.innerHTML='<div class="msg-avatar ai">T</div><div class="msg-content"><div class="voice-wave"><span></span><span></span><span></span><span></span><span></span></div><div class="msg-time" style="font-size:11px;color:var(--faint);margin-top:3px">Listening…</div></div>';
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
}

function removeVoiceWave(){
  const el=document.getElementById('voice-wave-indicator');
  if(el) el.remove();
}

function speak(text){
  if(!settings.tts) return;
  if(!window.speechSynthesis) return;
  stopSpeaking();

  const clean=text
    .replace(/\\*\\*(.+?)\\*\\*/g,'$1')
    .replace(/\\*(.+?)\\*/g,'$1')
    .replace(/\`(.+?)\`/g,'$1')
    .replace(/#{1,6}\\s/g,'')
    .replace(/\\n/g,' ')
    .trim();

  if(!clean) return;

  // iOS requires voices to be loaded first
  const doSpeak=()=>{
    const u=new SpeechSynthesisUtterance(clean);
    u.rate=parseFloat(settings.rate||1);
    u.pitch=1;
    u.volume=1;

    // Pick best available voice for language
    const voices=window.speechSynthesis.getVoices();
    const lang=settings.lang||'en-IN';
    const match=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.split('-')[0]))||null;
    if(match) u.voice=match;

    u.onstart=()=>{
      isSpeaking=true;
      document.getElementById('stopBtn').style.display='flex';
    };
    u.onend=()=>{
      isSpeaking=false;
      document.getElementById('stopBtn').style.display='none';
    };
    u.onerror=()=>{
      isSpeaking=false;
      document.getElementById('stopBtn').style.display='none';
    };
    window.speechSynthesis.speak(u);
  };

  // Voices may not be loaded yet on iOS
  if(window.speechSynthesis.getVoices().length){
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged=()=>{
      window.speechSynthesis.onvoiceschanged=null;
      doSpeak();
    };
  }
}

function stopSpeaking(){
  if(window.speechSynthesis){
    window.speechSynthesis.cancel();
  }
  isSpeaking=false;
  const btn=document.getElementById('stopBtn');
  if(btn) btn.style.display='none';
}`
    );

    fs.writeFileSync(htmlPath, html);
    console.log('  → voice CSS added');
    console.log('  → voice input upgraded (iOS Safari compatible)');
    console.log('  → TTS upgraded (voice selection, iOS fix)');
    console.log('  → visual wave indicator added');
  }
};
