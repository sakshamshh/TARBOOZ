const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 7 — Google Calendar',
  apply: async () => {

    const apiDir = path.join(ROOT, 'api');
    const authDir = path.join(apiDir, 'auth');
    const calDir = path.join(apiDir, 'calendar');
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    if (!fs.existsSync(calDir)) fs.mkdirSync(calDir, { recursive: true });

    // 1. OAuth login redirect
    fs.writeFileSync(path.join(authDir, 'login.js'), `module.exports = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.VERCEL_URL
    ? \`https://\${process.env.VERCEL_URL}/auth/callback\`
    : 'https://tarbooz.vercel.app/auth/callback';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events');
  const url = \`https://accounts.google.com/o/oauth2/v2/auth?client_id=\${clientId}&redirect_uri=\${encodeURIComponent(redirect)}&response_type=code&scope=\${scope}&access_type=offline&prompt=consent\`;
  res.redirect(url);
};`);

    // 2. OAuth callback — exchange code for tokens
    fs.writeFileSync(path.join(authDir, 'callback.js'), `const axios = require('axios');
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
    res.redirect(\`/?cal_token=\${access_token}&cal_refresh=\${refresh_token}&cal_expires=\${Date.now() + expires_in * 1000}\`);
  } catch(err) {
    res.status(500).send('Auth failed: ' + (err.response?.data?.error || err.message));
  }
};`);

    // 3. Calendar events endpoint
    fs.writeFileSync(path.join(calDir, 'events.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const r = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: { Authorization: \`Bearer \${token}\` },
      params: { timeMin: now, timeMax: future, singleEvents: true, orderBy: 'startTime', maxResults: 10 }
    });
    const events = (r.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || 'Untitled',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || null,
      description: e.description || null,
      allDay: !e.start?.dateTime
    }));
    res.json({ events });
  } catch(err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
};`);

    // 4. Create calendar event
    fs.writeFileSync(path.join(calDir, 'create.js'), `const axios = require('axios');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { title, start, end, description, location } = req.body;
  try {
    const r = await axios.post('https://www.googleapis.com/calendar/v3/calendars/primary/events',
      { summary: title, start: { dateTime: start }, end: { dateTime: end || start }, description, location },
      { headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' } }
    );
    res.json({ event: r.data });
  } catch(err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message });
  }
};`);

    // 5. Patch index.html — add Calendar panel
    const htmlPath = path.join(ROOT, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (!html.includes('007-calendar-applied')) {

      // Add nav button
      html = html.replace(
        `<div class="sidebar-divider"></div>\n    <button class="nav-btn" onclick="nav('settings',this)">`,
        `<button class="nav-btn" onclick="nav('calendar',this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span>Calendar</span>
    </button>
    <div class="sidebar-divider"></div>
    <button class="nav-btn" onclick="nav('settings',this)">`
      );

      // Add calendar panel before settings panel
      html = html.replace(
        `    <!-- SETTINGS -->`,
        `    <!-- CALENDAR — 007-calendar-applied -->
    <div id="panel-calendar" class="panel">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>Google Calendar</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="calRefresh()" id="calRefreshBtn" style="display:none">Refresh</button>
            <button class="btn btn-primary btn-sm" onclick="calLogin()" id="calLoginBtn">Connect Google</button>
          </div>
        </div>
        <div id="calStatus" style="font-size:13px;color:var(--muted);margin-bottom:14px">Connect your Google Calendar to see upcoming events.</div>
        <div id="calEvents"></div>
      </div>
      <div class="card" id="calCreateCard" style="display:none">
        <div class="card-title">Create Event</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input class="input" id="calTitle" placeholder="Event title">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Start</div><input class="input" type="datetime-local" id="calStart"></div>
            <div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">End</div><input class="input" type="datetime-local" id="calEnd"></div>
          </div>
          <input class="input" id="calLocation" placeholder="Location (optional)">
          <button class="btn btn-primary" onclick="calCreate()">Add to Calendar</button>
        </div>
      </div>
    </div>

    <!-- SETTINGS -->`
      );

      // Add calendar JS before closing script tag
      html = html.replace(
        `// ── UTILS ──`,
        `// ── CALENDAR ──
function calLogin(){
  window.location.href='/auth/login';
}

function calGetToken(){
  return localStorage.getItem('cal_token');
}

function calCheckTokenInURL(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('cal_token');
  const refresh=params.get('cal_refresh');
  const expires=params.get('cal_expires');
  if(token){
    localStorage.setItem('cal_token',token);
    if(refresh) localStorage.setItem('cal_refresh',refresh);
    if(expires) localStorage.setItem('cal_expires',expires);
    window.history.replaceState({},'','/');
    calRefresh();
  }
}

async function calRefresh(){
  const token=calGetToken();
  if(!token){ calShowDisconnected(); return; }
  document.getElementById('calStatus').textContent='Loading events…';
  try{
    const r=await fetch('/api/calendar/events',{headers:{Authorization:'Bearer '+token}});
    if(r.status===401){localStorage.removeItem('cal_token');calShowDisconnected();return;}
    const data=await r.json();
    calShowEvents(data.events||[]);
    document.getElementById('calLoginBtn').style.display='none';
    document.getElementById('calRefreshBtn').style.display='';
    document.getElementById('calCreateCard').style.display='';
  }catch(e){
    document.getElementById('calStatus').textContent='Error loading events: '+e.message;
  }
}

function calShowDisconnected(){
  document.getElementById('calStatus').textContent='Connect your Google Calendar to see upcoming events.';
  document.getElementById('calLoginBtn').style.display='';
  document.getElementById('calRefreshBtn').style.display='none';
  document.getElementById('calCreateCard').style.display='none';
  document.getElementById('calEvents').innerHTML='';
}

function calShowEvents(events){
  const el=document.getElementById('calEvents');
  document.getElementById('calStatus').textContent=events.length+' upcoming event'+(events.length!==1?'s':'')+' this week';
  if(!events.length){el.innerHTML='<div style="color:var(--faint);font-size:14px;padding:12px 0">No events this week.</div>';return;}
  el.innerHTML=events.map(e=>{
    const start=new Date(e.start);
    const date=start.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
    const time=e.allDay?'All day':start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return \`<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="text-align:center;min-width:44px;background:var(--surface2);border-radius:var(--r-sm);padding:6px 8px;flex-shrink:0">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase">\${start.toLocaleDateString([],{month:'short'})}</div>
        <div style="font-size:20px;font-weight:600;line-height:1">\${start.getDate()}</div>
      </div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:14px">\${esc(e.title)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">\${time}\${e.location?' · '+esc(e.location):''}</div>
      </div>
    </div>\`;
  }).join('');
}

async function calCreate(){
  const token=calGetToken();if(!token)return;
  const title=document.getElementById('calTitle').value.trim();
  const start=document.getElementById('calStart').value;
  const end=document.getElementById('calEnd').value;
  if(!title||!start){alert('Title and start time required');return;}
  try{
    await fetch('/api/calendar/create',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({title,start:new Date(start).toISOString(),end:end?new Date(end).toISOString():null})});
    document.getElementById('calTitle').value='';
    calRefresh();
  }catch(e){alert('Failed to create event: '+e.message);}
}

calCheckTokenInURL();

// ── UTILS ──`
      );

      fs.writeFileSync(htmlPath, html);
    }

    console.log('  → auth/login.js created');
    console.log('  → auth/callback.js created');
    console.log('  → calendar/events.js created');
    console.log('  → calendar/create.js created');
    console.log('  → Calendar panel added to frontend');
  }
};
