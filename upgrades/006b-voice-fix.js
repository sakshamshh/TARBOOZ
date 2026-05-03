const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 6b — Voice fix: stays on until you tap again',
  apply: async () => {

    const htmlPath = path.join(ROOT, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (html.includes('006b-voice-fix-applied')) {
      console.log('  → already applied, skipping');
      return;
    }

    html = html.replace(
      `function startListening(){
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
}`,

      `// 006b-voice-fix-applied
function startListening(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();
  recognition.lang=settings.lang||'en-IN';
  recognition.interimResults=true;
  recognition.continuous=false; // iOS doesn't support continuous=true, we restart manually

  let finalTranscript='';
  let restartTimeout=null;
  let userStopped=false;

  recognition.onstart=()=>{
    isListening=true;
    userStopped=false;
    document.getElementById('micBtn').classList.add('active','listening');
    document.getElementById('chatInput').placeholder='Listening… (tap mic to send)';
    appendVoiceWave();
  };

  recognition.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i].isFinal){
        finalTranscript+=e.results[i][0].transcript+' ';
      } else {
        interim+=e.results[i][0].transcript;
      }
    }
    document.getElementById('chatInput').value=(finalTranscript+interim).trim();
    autoResize(document.getElementById('chatInput'));
  };

  recognition.onend=()=>{
    // If user hasn't manually stopped, restart to keep listening
    if(!userStopped && isListening){
      restartTimeout=setTimeout(()=>{
        try{ recognition.start(); }catch(e){}
      }, 200);
      return;
    }
    // User tapped mic to stop — send the message
    isListening=false;
    document.getElementById('micBtn').classList.remove('active','listening');
    document.getElementById('chatInput').placeholder='Message Tarbooz…';
    removeVoiceWave();
    const text=finalTranscript.trim()||document.getElementById('chatInput').value.trim();
    if(text){
      document.getElementById('chatInput').value=text;
      sendMessage();
    }
  };

  recognition.onerror=e=>{
    if(e.error==='no-speech'){
      // Restart on silence — keep listening
      if(!userStopped && isListening){
        try{ recognition.start(); }catch(err){}
      }
      return;
    }
    if(e.error==='not-allowed'){
      alert('Microphone access denied.\\nOn iPhone: go to Settings → Safari → Microphone → Allow.');
    }
    isListening=false;
    userStopped=true;
    document.getElementById('micBtn').classList.remove('active','listening');
    document.getElementById('chatInput').placeholder='Message Tarbooz…';
    removeVoiceWave();
  };

  // Override toggleVoice stop to set userStopped flag
  window._stopListening=()=>{
    userStopped=true;
    isListening=false;
    clearTimeout(restartTimeout);
    try{ recognition.stop(); }catch(e){}
  };

  try{ recognition.start(); }
  catch(e){ console.warn('Recognition start error:',e.message); }
}`
    );

    // Patch toggleVoice to use _stopListening
    html = html.replace(
      `if(isListening){recognition&&recognition.stop();return;}`,
      `if(isListening){window._stopListening&&window._stopListening();return;}`
    );

    fs.writeFileSync(htmlPath, html);
    console.log('  → mic now stays on until you tap again');
    console.log('  → auto-restarts on silence (iOS fix)');
    console.log('  → sends message when you tap mic to stop');
  }
};
