/* Chef & Mixologist: account and administration screens.
   Sign-in (with authenticator codes), activation, My profile, Notifications,
   Notification preferences (incl. browser push), Team, Staff roles & access,
   Access requests, Audit history, Organisation settings, Install app.
   Loaded last. Every action is also permission-checked by the server. */

const CM='/plugin/cm/';
const ACT=['create','read','update','delete','archive'];
const ACT_LABEL={create:'Create',read:'Read',update:'Update',delete:'Delete',archive:'Archive'};
const fmtDate=s=>s?new Date(s).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const ago=s=>{if(!s)return'never';const m=(Date.now()-new Date(s))/6e4;return m<1?'just now':m<60?`${Math.round(m)} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} days ago`};
const keepSignedIn=()=>{try{return localStorage.getItem('cm_keep')==='1'}catch(e){return false}};
function saveToken(t,keep){API.token=t;try{(keep?localStorage:sessionStorage).setItem('cm_token',t);localStorage.setItem('cm_keep',keep?'1':'0');if(!keep)localStorage.removeItem('cm_token')}catch(e){}}
function clearToken(){API.token=null;try{sessionStorage.removeItem('cm_token');localStorage.removeItem('cm_token')}catch(e){}}
try{if(!API.token)API.token=localStorage.getItem('cm_token')}catch(e){}
let PROFILE=null,BRAND=null,UNREAD=0,SAVED_THEME=null;
const baseApply=applySnapshot;
applySnapshot=function(d){baseApply(d);renderShellUser()};

/* ================= sign-in, with an authenticator step ================= */
showLogin=async function(msg=''){
  if(!BRAND){try{BRAND=await fetch(API.base+CM+'branding/').then(r=>r.json())}catch(e){BRAND={name:'Chef & Mixologist'}}}
  let step='password',creds=null;
  const draw=()=>formModal('Sign in',esc(BRAND.outlet?`${BRAND.name} · ${BRAND.outlet}`:BRAND.name),
    `<div class="signin-brand"><img src="${BRAND.logo||'brand/mark-light.png'}" alt=""><b>${esc(BRAND.name)}</b><span>Resto &amp; Cafe · stores, kitchen and bar</span></div>`+
    (step==='password'?`<label>Username<input name="u" autocomplete="username" required></label>
      <label>Password<input name="p" type="password" autocomplete="current-password" required></label>
      <label style="flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" name="keep" ${keepSignedIn()?'checked':''}>Keep me signed in on this device</label>
      <details><summary class="muted">Server</summary><label>Server address<input name="s" value="${esc(API.base)}" required></label></details>`
    :`<p>Enter the 6-digit code from your authenticator app.</p><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required></label>`)+
    (msg?`<p class="muted">${esc(msg)}</p>`:''),step==='password'?'Sign in':'Verify',async f=>{
      if(step==='password')creds={u:f.get('u'),p:f.get('p'),keep:!!f.get('keep'),base:(f.get('s')||API.base).replace(/\/+$/,'')};
      const r=await fetch(creds.base+CM+'auth/login/',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({username:creds.u,password:creds.p,code:f.get('code')||''})}).catch(()=>null);
      if(!r)throw new Error('Cannot reach the server');
      const d=await r.json().catch(()=>({}));
      if(r.status===202&&d.mfaRequired){step='code';msg='';draw();return}
      if(!r.ok)throw new Error(errText(d)||`Sign-in failed (${r.status})`);
      API.base=creds.base;try{localStorage.setItem('cm_api',creds.base)}catch(e){}
      saveToken(d.token,creds.keep);$('#modal').classList.remove('on');
      await afterSignIn();toast('Signed in');
    });
  draw();
};

async function afterSignIn(){
  PROFILE=await api(CM+'profile/');
  if(PROFILE.mfa.required&&!PROFILE.mfa.enrolled){API.live=true;API.can={};renderShellUser();go('profile');toast('Set up two-step verification to continue');return}
  await reload();renderShellUser();pollBell();
}

/* ================= activation (invite link) ================= */
function activationFromHash(){
  const m=location.hash.match(/^#activate=(\d+)\.([\w-]+)/);if(!m)return false;
  formModal('Activate your account','Choose a password to finish setting up',`
    <label>New password<input name="p" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Confirm password<input name="p2" type="password" autocomplete="new-password" required></label>
    <p class="muted">At least 8 characters, not just numbers, and not a common password.</p>`,'Activate',async(f,close)=>{
    if(f.get('p')!==f.get('p2'))throw new Error('The passwords do not match');
    const r=await fetch(API.base+CM+'auth/activate/',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({uid:+m[1],token:m[2],password:f.get('p')})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errText(d));
    close();history.replaceState(null,'',location.pathname);toast(`Account activated. Sign in as ${esc(d.username)}`);showLogin(`Your username is ${d.username}`)});
  return true;
}

/* ================= top bar: bell + account menu ================= */
function renderShellUser(){
  const p=PROFILE;if(!p)return;
  const nm=[p.firstName,p.lastName].filter(Boolean).join(' ')||p.username,ini=nm.split(/[\s.]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
  $('#site').innerHTML=`<button class="icon-btn bell" id="bell" aria-label="Notifications" title="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span class="dot" id="bellDot" hidden></span></button>
    <div class="acct"><button class="acct-btn" id="acctBtn" aria-haspopup="menu" aria-expanded="false"><span class="avatar">${esc(ini)}</span><span class="acct-name">${esc(nm)}</span></button>
    <div class="acct-menu" id="acctMenu" role="menu" hidden><div class="acct-head"><b>${esc(nm)}</b><small>${esc(p.roles.join(', ')||'No role')}</small></div>
      <button role="menuitem" data-go="profile">My profile</button><button role="menuitem" data-go="prefs">Notification preferences</button><button role="menuitem" data-go="install">Install app</button><button role="menuitem" id="signOut">Sign out</button></div></div>`;
  $('#bell').onclick=()=>go('notifications');
  const menu=$('#acctMenu'),btnEl=$('#acctBtn');
  btnEl.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;btnEl.setAttribute('aria-expanded',!menu.hidden)};
  document.addEventListener('click',()=>{menu.hidden=true;btnEl.setAttribute('aria-expanded','false')});
  menu.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('#signOut').onclick=async()=>{try{await api(CM+'auth/logout/',{method:'POST',json:{}})}catch(e){}clearToken();location.hash='';location.reload()};
  $('#sideFoot').innerHTML=`<span class="avatar">${esc(ini)}</span><div><b>My profile</b><small>${esc(nm)} · ${esc(p.roles.join(', ')||'No role')}</small></div>`;
  $('#sideFoot').onclick=()=>go('profile');
}
let bellTimer=null;
async function pollBell(){
  clearTimeout(bellTimer);
  try{const d=await api(CM+'notifications/');UNREAD=d.unread;const dot=$('#bellDot');if(dot){dot.hidden=!d.unread;dot.textContent=d.unread>9?'9+':d.unread}
    renderMenu()}catch(e){}
  bellTimer=setTimeout(pollBell,60000);
}

/* ================= My profile ================= */
async function renderProfile(){
  const body=view('profile','My profile','Personal details, two-step verification and the devices you are signed in on.');
  const p=await load(body,CM+'profile/');if(!p)return;PROFILE=p;renderShellUser();
  const gate=p.mfa.required&&!p.mfa.enrolled;
  body.innerHTML=(gate?`<div class="panel" style="margin-bottom:16px;background:var(--gold-soft)"><div class="panel-b"><b>Two-step verification is required for your role.</b> Set it up below to use the rest of the app.</div></div>`:'')+
  `<div class="admin-grid">
   ${panel('Personal details','Your username and roles are managed by an owner',`<form id="pf" class="calc" style="display:grid;gap:12px">
     <div class="two"><label>First name<input name="firstName" value="${esc(p.firstName)}" maxlength="150"></label><label>Last name<input name="lastName" value="${esc(p.lastName)}" maxlength="150"></label></div>
     <div class="two"><label>Phone<input name="phone" value="${esc(p.phone)}" maxlength="30"></label><label>Job title<input name="jobTitle" value="${esc(p.jobTitle)}" maxlength="60"></label></div>
     <p class="muted" style="margin:0">${esc(p.username)}${p.email?` · ${esc(p.email)}`:''} · ${p.roles.map(r=>`<span class="sticker soft">${esc(r)}</span>`).join(' ')}</p>
     <div><button class="btn btn-primary">Save changes</button></div></form>`)}
   ${panel('Account security',`Last sign-in ${ago(p.lastSignIn)}`,`<div style="display:grid;gap:14px">
     <div class="row-between"><div><b>Two-step verification</b><br><small class="muted">${p.mfa.required?'Required for your role':'Recommended'}</small></div>${p.mfa.enrolled?'<span class="sticker lime">On</span>':'<span class="sticker turmeric">Not set up</span>'}</div>
     <div id="mfaBox">${p.mfa.enrolled?(p.mfa.required?'':btn('Turn off','id="mfaOff" style="color:var(--rust-ink)"')):`<button class="btn btn-primary" id="mfaStart">Set up authenticator</button>`}</div>
     <hr class="soft"><b>Change password</b><form id="pw" class="calc" style="display:grid;gap:10px">
       <label>Current password<input name="current" type="password" autocomplete="current-password" required></label>
       <label>New password<input name="new" type="password" autocomplete="new-password" minlength="8" required></label>
       <div><button class="btn btn-line">Change password</button></div></form></div>`)}
  </div>`+
  panel('Signed-in devices','Sign out anywhere you no longer use',`<div class="feed">${p.devices.map(d=>`<div class="feed-row" style="cursor:default"><span class="bubble info"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></span>
     <div><b>${esc(d.name)}</b> ${d.current?'<span class="sticker lime">This device</span>':''}<small>${d.ip?esc(d.ip)+' · ':''}signed in ${d.created?fmtDate(d.created):'—'}${d.lastSeen?` · last active ${esc(d.lastSeen)}`:''}</small></div>
     ${d.current?'':btn('Sign out',`data-dev="${d.id}"`)}</div>`).join('')}</div>
     ${p.devices.length>1?`<div style="margin-top:12px">${btn('Sign out all other devices','id="devAll"')}</div>`:''}`);
  $('#pf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{PROFILE=await api(CM+'profile/',{method:'PATCH',json:Object.fromEntries(f)});renderShellUser();toast('Profile saved')}catch(err){fail(err)}};
  $('#pw').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api(CM+'profile/password/',{method:'POST',json:Object.fromEntries(f)});e.target.reset();toast('Password changed. Other devices were signed out.');renderProfile()}catch(err){fail(err)}};
  if($('#mfaStart'))$('#mfaStart').onclick=async()=>{let s;try{s=await api(CM+'profile/mfa/setup/',{method:'POST',json:{}})}catch(e){return fail(e)}
    formModal('Set up your authenticator','Use Google Authenticator, Microsoft Authenticator or similar',`
      <div class="qr">${s.qr}</div><p>Scan this code with the app, or enter the key by hand:</p><code class="key">${esc(s.secret.match(/.{1,4}/g).join(' '))}</code>
      <a class="btn btn-sm btn-line" href="${esc(s.uri)}">Open in authenticator app</a>
      <label>Enter the 6-digit code it shows<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required></label>`,'Turn on',async(f,close)=>{
      await api(CM+'profile/mfa/confirm/',{method:'POST',json:{code:f.get('code')}});close();toast('Two-step verification is on');
      if(gate){await afterSignIn()}else renderProfile()})};
  if($('#mfaOff'))$('#mfaOff').onclick=()=>formModal('Turn off two-step verification','Your account will be easier to break into',`<label>Current authenticator code<input name="code" inputmode="numeric" maxlength="6" required></label>`,'Turn off',async(f,close)=>{
    await api(CM+'profile/mfa/off/',{method:'DELETE',json:{code:f.get('code')}});close();toast('Two-step verification is off');renderProfile()});
  body.querySelectorAll('[data-dev]').forEach(b=>b.onclick=async()=>{try{await api(CM+`profile/devices/${b.dataset.dev}/`,{method:'DELETE'});toast('Device signed out');renderProfile()}catch(e){fail(e)}});
  if($('#devAll'))$('#devAll').onclick=async()=>{try{const r=await api(CM+'profile/devices/',{method:'DELETE'});toast(`${r.signedOut} device${r.signedOut===1?'':'s'} signed out`);renderProfile()}catch(e){fail(e)}};
}

/* ================= Notifications inbox ================= */
let NOTE_SHOW='unread';
async function renderNotifications(){
  const body=view('notifications','Notifications','Alerts about stock, deliveries, preps, events and your account.',
    `<span class="seg"><button data-ns="unread" aria-pressed="${NOTE_SHOW==='unread'}">Unread</button><button data-ns="all" aria-pressed="${NOTE_SHOW==='all'}">All recent</button></span>${btn('Mark all read','id="markAll"')}${btn('Preferences','id="toPrefs"')}`);
  $$('[data-ns]').forEach(b=>b.onclick=()=>{NOTE_SHOW=b.dataset.ns;renderNotifications()});
  $('#toPrefs').onclick=()=>go('prefs');
  const d=await load(body,CM+`notifications/?show=${NOTE_SHOW}`);if(!d)return;
  $('#markAll').onclick=async()=>{await api(CM+'notifications/',{method:'POST',json:{all:true}});toast('All marked as read');pollBell();renderNotifications()};
  const tone={high:'bad',normal:'info'};
  const draw=()=>{const pg=paginate('notes',d.rows,15,NOTE_SHOW+d.rows.length);
    const days=[...new Set(pg.rows.map(n=>new Date(n.at).toDateString()))];
    body.innerHTML=(d.rows.length?days.map(day=>`<section class="feed-day"><h3>${new Date(day).toDateString()===new Date().toDateString()?'Today':new Date(day).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</h3><div class="feed">${pg.rows.filter(n=>new Date(n.at).toDateString()===day).map(n=>`<div class="feed-row ${n.read?'':'unread'}" data-n="${n.id}" data-link="${esc(n.link)}" tabindex="0"><span class="bubble ${tone[n.priority]||'info'}">${n.priority==='high'?'!':'•'}</span><div><b>${esc(n.title)}</b><small>${new Date(n.at).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}${n.body?' · '+esc(n.body):''}</small></div>${n.read?'':'<span class="sticker copper">New</span>'}</div>`).join('')}</div></section>`).join(''):`<div class="panel empty"><b>${NOTE_SHOW==='unread'?'No unread alerts':'No alerts yet'}</b>You'll see stock, delivery and account alerts here.</div>`)+pg.html;
    body.querySelectorAll('[data-n]').forEach(r=>r.onclick=async()=>{await api(CM+'notifications/',{method:'POST',json:{ids:[+r.dataset.n]}}).catch(()=>{});pollBell();const l=r.dataset.link;if(l&&VIEWS[l])go(l);else renderNotifications()});
    wirePager(body,draw)};
  draw();
}

/* ================= Notification preferences (+ browser push) ================= */
const b64ToBytes=b=>{const p='='.repeat((4-b.length%4)%4),s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...s].map(c=>c.charCodeAt(0)))};
async function pushState(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window))return{supported:false};
  const reg=await navigator.serviceWorker.getRegistration();const sub=reg?await reg.pushManager.getSubscription():null;
  return{supported:true,reg,sub,permission:Notification.permission};
}
async function renderPrefs(){
  const body=view('prefs','Notification preferences','Choose which alerts you get in the app and as browser notifications. Security notices about your account always appear.');
  const d=await load(body,CM+'notification-preferences/');if(!d)return;
  const ps=await pushState();
  const groups=[...new Set(d.prefs.map(p=>p.group))];
  body.innerHTML=panel('Browser notifications',`${d.push.devices} device${d.push.devices===1?'':'s'} turned on for your account`,`
    <p class="muted" style="margin-top:0">Get an alert on this device even when the app is closed. Alerts show only a title, never prices, suppliers or quantities.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${!d.push.enabled?'<span class="muted">Browser notifications are not set up on the server yet.</span>':!ps.supported?'<span class="muted">This browser does not support notifications. On iPhone, install the app to the home screen first.</span>':
      ps.sub?`${btn('Turn off on this device','id="pushOff"')}${btn('Send a test','id="pushTest"')}`:`<button class="btn btn-primary" id="pushOn">Turn on for this device</button>`}
      ${ps.permission==='denied'?'<span class="muted">Notifications are blocked for this site in your browser settings.</span>':''}</div>`)+
    groups.map(g=>panel(esc(g),'',`<div class="pref-list">${d.prefs.filter(p=>p.group===g).map(p=>`<div class="pref-row"><span>${esc(p.label)}</span>
      <label class="switch" title="In the app"><input type="checkbox" data-pref="${p.event}" data-k="inApp" ${p.inApp?'checked':''} ${p.locked?'disabled':''}><span>In app</span></label>
      <label class="switch" title="Browser notification"><input type="checkbox" data-pref="${p.event}" data-k="push" ${p.push?'checked':''}><span>Push</span></label></div>`).join('')}</div>`)).join('');
  body.querySelectorAll('[data-pref]').forEach(c=>c.onchange=async()=>{const p=d.prefs.find(x=>x.event===c.dataset.pref);p[c.dataset.k]=c.checked;
    try{await api(CM+'notification-preferences/',{method:'PUT',json:{prefs:[p]}});toast('Saved')}catch(e){fail(e)}});
  if($('#pushOn'))$('#pushOn').onclick=async()=>{try{
    const perm=await Notification.requestPermission();if(perm!=='granted')return toast('Notifications were not allowed');
    const reg=ps.reg||await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(d.push.publicKey)});
    await api(CM+'push/',{method:'POST',json:{subscription:sub.toJSON()}});toast('Browser notifications are on');renderPrefs()}catch(e){fail(e)}};
  if($('#pushOff'))$('#pushOff').onclick=async()=>{try{const ep=ps.sub.endpoint;await ps.sub.unsubscribe();await api(CM+'push/',{method:'DELETE',json:{endpoint:ep}});toast('Turned off on this device');renderPrefs()}catch(e){fail(e)}};
  if($('#pushTest'))$('#pushTest').onclick=async()=>{try{await api(CM+'push/test/',{method:'POST',json:{}});toast('Test sent')}catch(e){fail(e)}};
}

/* ================= Team ================= */
let TEAM=null,TEAM_Q='',TEAM_STATUS='all';
async function renderTeam(){
  const body=view('team','Staff & teams','Invite colleagues, choose their roles and manage their accounts.',API.can.staff?'<button class="btn btn-primary" id="invite">Invite a colleague</button>':'');
  const d=await load(body,CM+'team/');if(!d)return;TEAM=d;
  if($('#invite'))$('#invite').onclick=inviteForm;
  const draw=()=>{const q=TEAM_Q.toLowerCase();
    const L=d.staff.filter(s=>(!focusIs('person')||s.name===S.focus.key||s.username===S.focus.key)&&(TEAM_STATUS==='all'||s.status===TEAM_STATUS)&&(!q||`${s.name} ${s.username} ${s.email} ${s.roles.join(' ')}`.toLowerCase().includes(q)));
    const pg=paginate('team',L,12,TEAM_Q+TEAM_STATUS);
    body.innerHTML=`<div class="toolbar"><label class="field" style="flex:1;max-width:360px">Find<input id="tq" value="${esc(TEAM_Q)}" placeholder="Name, username or role" style="border:0;background:none;height:100%;flex:1"></label>
      <label class="field">Status<select id="ts">${[['all','Everyone'],['active','Active'],['invited','Invited'],['deactivated','Deactivated']].map(([k,l])=>`<option value="${k}" ${TEAM_STATUS===k?'selected':''}>${l}</option>`).join('')}</select></label><span class="result-count">${L.length} of ${d.staff.length}</span></div>
      <div class="people">${pg.rows.map(s=>`<button class="person" data-u="${s.id}"><span class="avatar">${esc(s.name.split(/[\s.]+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''))}</span>
        <span class="person-t"><b>${esc(s.name)}</b><small>${esc(s.username)}${s.jobTitle?' · '+esc(s.jobTitle):''}</small><span class="person-roles">${s.roles.map(r=>`<span class="sticker soft">${esc(r)}</span>`).join('')}</span></span>
        <span class="person-s"><span class="sticker ${s.status==='active'?'lime':s.status==='invited'?'turmeric':'soft'}">${s.status==='active'?'Active':s.status==='invited'?'Invited':'Deactivated'}</span><small>${s.mfa?'2-step on':'2-step off'} · ${ago(s.lastSignIn)}</small></span></button>`).join('')||'<p class="muted">No one matches.</p>'}</div>${pg.html}`;
    const tq=$('#tq');tq.oninput=()=>{TEAM_Q=tq.value;draw();const n=$('#tq');n.focus();n.setSelectionRange(n.value.length,n.value.length)};
    $('#ts').onchange=e=>{TEAM_STATUS=e.target.value;draw()};
    body.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>memberForm(d.staff.find(s=>s.id===+b.dataset.u)));
    wirePager(body,draw)};
  draw();
}
const roleChecks=(sel=[])=>`<fieldset class="checks"><legend>Roles</legend>${TEAM.roles.map(r=>`<label><input type="checkbox" name="roles" value="${r.id}" ${sel.includes(r.name)?'checked':''}>${esc(r.name)}</label>`).join('')}</fieldset>`;
function activationLink(a){return `${location.origin}${location.pathname}#activate=${a.uid}.${a.token}`}
function showLink(title,a){
  const link=activationLink(a);
  formModal(title,'Send this link to them privately (WhatsApp or in person). It works once and expires in 72 hours.',`<textarea readonly rows="3" style="width:100%;font-family:monospace">${esc(link)}</textarea>`,'Copy link',async(f,close)=>{
    try{await navigator.clipboard.writeText(link);toast('Link copied')}catch(e){toast('Select the link and copy it')}close()});
}
function inviteForm(){
  formModal('Invite a colleague','They choose their own password from a one-time link',`<div class="two">
    <label>First name<input name="firstName" required maxlength="150"></label><label>Last name<input name="lastName" maxlength="150"></label>
    <label>Username<input name="username" placeholder="e.g. arnab.k" maxlength="150"></label><label>Phone<input name="phone" maxlength="30"></label>
    <label>Email (optional)<input name="email" type="email"></label><label>Job title<input name="jobTitle" maxlength="60" placeholder="e.g. Sous chef"></label></div>${roleChecks()}`,'Create activation link',async(f,close)=>{
    const body=Object.fromEntries([...f].filter(([k])=>k!=='roles'));body.roles=f.getAll('roles').map(Number);
    const r=await api(CM+'team/',{method:'POST',json:body});close();renderTeam();showLink(`${esc(r.username)} invited`,r.activation)});
}
function memberForm(s){
  formModal(esc(s.name),`${esc(s.username)} · ${s.status}`,`<div class="two">
    <label>First name<input name="firstName" value="${esc(s.firstName)}"></label><label>Last name<input name="lastName" value="${esc(s.lastName)}"></label>
    <label>Email<input name="email" type="email" value="${esc(s.email)}"></label><label>Job title<input name="jobTitle" value="${esc(s.jobTitle)}"></label></div>
    ${roleChecks(s.roles)}
    <label style="flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${s.active?'checked':''} ${s.status==='invited'?'disabled':''}>Account active</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('New activation link','id="mReset"')}${btn('Sign out everywhere','id="mOut"')}${API.can.roles?btn('Access for this person','id="mAccess"'):''}</div>`,'Save',async(f,close)=>{
    const body={firstName:f.get('firstName'),lastName:f.get('lastName'),email:f.get('email'),jobTitle:f.get('jobTitle')};
    const roles=f.getAll('roles').map(Number),before=TEAM.roles.filter(r=>s.roles.includes(r.name)).map(r=>r.id);
    if(roles.sort().join()!==before.sort().join())body.roles=roles;
    if(s.status!=='invited')body.active=!!f.get('active');
    await api(CM+`team/${s.id}/`,{method:'PATCH',json:body});close();toast('Saved');renderTeam()});
  $('#mReset').onclick=()=>confirmModal('Reset this account?','They are signed out everywhere and must choose a new password from a new link.','Reset',async()=>{const r=await api(CM+`team/${s.id}/reset/`,{method:'POST',json:{}});renderTeam();showLink('New activation link',r.activation)});
  $('#mOut').onclick=async()=>{try{const r=await api(CM+`team/${s.id}/signout/`,{method:'POST',json:{}});toast(`${r.signedOut} device${r.signedOut===1?'':'s'} signed out`)}catch(e){fail(e)}};
  if($('#mAccess'))$('#mAccess').onclick=()=>personAccess(s);
}

/* ================= Staff roles & access ================= */
let ROLES=null,ROLE_SEL=null;
function gridTable(areas,cell,editable,extraCol){
  const groups=[...new Set(areas.map(a=>a.group))];
  return `<div class="tablewrap"><table class="t grid"><thead><tr><th>Access</th>${ACT.map(a=>`<th class="c">${ACT_LABEL[a]}</th>`).join('')}<th>Reach</th>${extraCol?'<th></th>':''}</tr></thead><tbody>
    ${groups.map(g=>`<tr class="grp"><td colspan="${8}">${esc(g)}</td></tr>`+areas.filter(a=>a.group===g).map(a=>`<tr><td><b>${esc(a.label)}</b>${a.risk!=='standard'?` <span class="risk ${a.risk}">${a.risk==='critical'?'Critical':'Sensitive'}</span>`:''}</td>
      ${ACT.map(x=>`<td class="c">${a.actions.includes(x)?cell(a,x):'<span class="muted">–</span>'}</td>`).join('')}
      <td>${a.reach?reachCell(a,editable):'<span class="muted">All areas</span>'}</td></tr>`).join('')).join('')}</tbody></table></div>`;
}
let reachCell=()=>'';
async function renderPermissions(){
  const body=view('permissions','Staff roles & access','What each role can do. Built-in roles are fixed; create a custom role or change one person\'s access for anything different.',API.can.roles?'<button class="btn btn-primary" id="newRole">New custom role</button>':'');
  const d=await load(body,CM+'roles/');if(!d)return;ROLES=d;
  if(!ROLE_SEL||!d.roles.some(r=>r.id===ROLE_SEL))ROLE_SEL=d.roles[0]?.id;
  if($('#newRole'))$('#newRole').onclick=()=>formModal('New custom role','Start from an existing role and adjust',`<label>Role name<input name="name" required maxlength="150"></label>
    <label>Description<input name="description" maxlength="200"></label><label>Copy access from<select name="copyFrom"><option value="">Nothing (start empty)</option>${d.roles.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label>`,'Create role',async(f,close)=>{
    const r=await api(CM+'roles/',{method:'POST',json:{name:f.get('name'),description:f.get('description'),copyFrom:+f.get('copyFrom')||null}});close();ROLE_SEL=r.id;renderPermissions()});
  const role=d.roles.find(r=>r.id===ROLE_SEL),edit=!role.system&&API.can.roles;
  const grid={...role.grid};
  reachCell=(a,editable)=>{const keys=a.actions.map(x=>`${a.key}.${x}`).filter(k=>grid[k]);const cur=keys.length?grid[keys[0]]:'own';
    return editable?`<select data-reach="${a.key}" ${keys.length?'':'disabled'}><option value="own" ${cur==='own'?'selected':''}>Own areas</option><option value="all" ${cur==='all'?'selected':''}>All areas</option></select>`:`<span>${keys.length?(cur==='all'?'All areas':'Own areas'):'—'}</span>`};
  body.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-b"><div class="role-chips">${d.roles.map(r=>`<button class="chip" data-role="${r.id}" aria-pressed="${r.id===ROLE_SEL}">${esc(r.name)}<em>${r.members}</em></button>`).join('')}</div>
    <p style="margin:12px 0 0"><b>${esc(role.name)}:</b> ${esc(role.description||'Custom role')}${role.system?' <span class="sticker soft">Built-in</span>':''}</p></div></div>
    <div class="panel">${gridTable(d.areas,(a,x)=>`<input type="checkbox" data-cell="${a.key}.${x}" ${grid[`${a.key}.${x}`]?'checked':''} ${edit?'':'disabled'} aria-label="${esc(a.label)} ${x}">`,edit)}
    ${edit?`<div class="panel-b" style="display:flex;gap:8px;justify-content:flex-end">${btn('Delete role','id="delRole" style="color:var(--rust-ink)"')}<button class="btn btn-primary" id="saveRole">Save access</button></div>`:''}</div>`;
  body.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{ROLE_SEL=+b.dataset.role;renderPermissions()});
  if(!edit)return;
  body.querySelectorAll('[data-cell]').forEach(c=>c.onchange=()=>{const a=c.dataset.cell.split('.')[0],area=d.areas.find(x=>x.key===a);
    if(c.checked)grid[c.dataset.cell]=area.reach?(body.querySelector(`[data-reach="${a}"]`)?.value||'own'):'all';else delete grid[c.dataset.cell];
    const sel=body.querySelector(`[data-reach="${a}"]`);if(sel)sel.disabled=!area.actions.some(x=>grid[`${a}.${x}`])});
  body.querySelectorAll('[data-reach]').forEach(s=>s.onchange=()=>{Object.keys(grid).filter(k=>k.startsWith(s.dataset.reach+'.')).forEach(k=>grid[k]=s.value)});
  $('#saveRole').onclick=async()=>{try{await api(CM+`roles/${role.id}/`,{method:'PATCH',json:{grid}});toast('Access saved');renderPermissions()}catch(e){fail(e)}};
  $('#delRole').onclick=()=>confirmModal(`Delete ${esc(role.name)}?`,'Only possible when nobody has this role.','Delete',async()=>{await api(CM+`roles/${role.id}/`,{method:'DELETE'});ROLE_SEL=null;toast('Role deleted');renderPermissions()});
}
async function personAccess(s){
  const [d,ro]=await Promise.all([api(CM+`people/${s.id}/access/`),ROLES?Promise.resolve(ROLES):api(CM+'roles/')]).catch(e=>{fail(e);return[]});if(!d)return;
  const ov={...d.overrides};
  const cell=(a,x)=>{const k=`${a.key}.${x}`,o=ov[k],fromRole=d.fromRoles[k];
    return `<select data-ov="${k}" class="ov ${o?o.effect:''}"><option value="">${fromRole?'✓ role':'– role'}</option><option value="grant" ${o?.effect==='grant'?'selected':''}>Allow</option><option value="deny" ${o?.effect==='deny'?'selected':''}>Block</option></select>`};
  reachCell=()=>'<span class="muted">From role</span>';
  formModal(`Access for ${esc(s.name)}`,'Changes here apply to this person only, on top of their roles',gridTable(ro.areas,cell,false),'Save access',async(f,close)=>{
    $$('#modal-box [data-ov]').forEach(sel=>{if(sel.value)ov[sel.dataset.ov]={effect:sel.value,reach:'all'};else delete ov[sel.dataset.ov]});
    await api(CM+`people/${s.id}/access/`,{method:'PUT',json:{overrides:ov}});close();toast('Access saved')});
  $('#modal-box').classList.add('wide');
}

/* ================= Access requests ================= */
let AR_FILTER='all';
async function renderAccess(){
  const body=view('access','Access requests','Ask for time-limited access you don\'t normally have. A manager approves or rejects it; approved access ends by itself.','<button class="btn btn-primary" id="askAccess">Request access</button>');
  const d=await load(body,CM+'access-requests/');if(!d)return;
  $('#askAccess').onclick=()=>{
    formModal('Request temporary access','Say what you need and why',`<label>Access to<select name="area" id="arArea">${d.options.map(o=>`<option value="${o.area}">${esc(o.label)}</option>`).join('')}</select></label>
      <label>To<select name="action" id="arAct"></select></label><label id="arReachL">Reach<select name="reach"><option value="own">My own areas</option><option value="all">All areas</option></select></label>
      <label>For how long<select name="hours">${[1,2,4,8,12,24,48,72].map(h=>`<option value="${h}">${h<24?h+' hour'+(h>1?'s':''):h/24+' day'+(h>24?'s':'')}</option>`).join('')}</select></label>
      <label>Reason<textarea name="reason" required minlength="5" maxlength="300" rows="2" placeholder="e.g. Counting the dry store while Rakesh is on leave"></textarea></label>`,'Send request',async(f,close)=>{
      await api(CM+'access-requests/',{method:'POST',json:Object.fromEntries(f)});close();toast('Request sent');renderAccess()});
    const sync=()=>{const o=d.options.find(x=>x.area===$('#arArea').value);$('#arAct').innerHTML=o.actions.map(a=>`<option value="${a}">${ACT_LABEL[a]}</option>`).join('');$('#arReachL').hidden=!o.reach};
    $('#arArea').onchange=sync;sync()};
  const tone={pending:'turmeric',approved:'lime',rejected:'melon',expired:'soft',cancelled:'soft'};
  const label={pending:'Waiting for review',approved:'Approved',rejected:'Rejected',expired:'Expired',cancelled:'Cancelled'};
  const draw=()=>{const L=d.requests.filter(r=>AR_FILTER==='all'||r.status===AR_FILTER),pg=paginate('ar',L,10,AR_FILTER);
    body.innerHTML=`<div class="toolbar"><div class="chips">${['all','pending','approved','rejected'].map(k=>`<button class="chip" data-arf="${k}" aria-pressed="${AR_FILTER===k}">${k==='all'?'All':label[k]}<em>${k==='all'?d.requests.length:d.requests.filter(r=>r.status===k).length}</em></button>`).join('')}</div></div>
    <div class="feed">${pg.rows.map(r=>`<div class="feed-row" style="cursor:default;align-items:start"><span class="bubble ${r.status==='approved'?'good':r.status==='pending'?'warn':r.status==='rejected'?'bad':'info'}">${esc(r.who.slice(0,1))}</span>
      <div><b>${esc(r.who)}</b> asked to <b>${ACT_LABEL[r.action].toLowerCase()}</b> ${esc(r.areaLabel.toLowerCase())}${r.reach==='all'?' (all areas)':''} for ${r.hours} h<small>“${esc(r.reason)}” · ${fmtDate(r.created)}${r.decidedBy?` · ${label[r.status]} by ${esc(r.decidedBy)}${r.note?`: ${esc(r.note)}`:''}`:''}${r.status==='approved'&&r.expires?` · until ${fmtDate(r.expires)}`:''}</small></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><span class="sticker ${tone[r.status]}">${label[r.status]}</span>
        ${r.status==='pending'&&d.canReview&&r.userId!==PROFILE?.id?btn('Approve',`data-dec="approve" data-id="${r.id}"`,'btn-primary')+btn('Reject',`data-dec="reject" data-id="${r.id}"`):''}
        ${r.status==='pending'&&r.userId===PROFILE?.id?btn('Cancel',`data-dec="cancel" data-id="${r.id}"`):''}</div></div>`).join('')||'<div class="panel empty"><b>No requests</b>Choose “Request access” when you need temporary access.</div>'}</div>${pg.html}`;
    body.querySelectorAll('[data-arf]').forEach(b=>b.onclick=()=>{AR_FILTER=b.dataset.arf;draw()});
    body.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{const act=b.dataset.dec;
      if(act==='cancel')return api(CM+`access-requests/${b.dataset.id}/cancel/`,{method:'POST',json:{}}).then(()=>{toast('Request cancelled');renderAccess()}).catch(fail);
      formModal(act==='approve'?'Approve access':'Reject request','The person is notified',`<label>Note (optional)<input name="note" maxlength="300"></label>`,act==='approve'?'Approve':'Reject',async(f,close)=>{
        await api(CM+`access-requests/${b.dataset.id}/${act}/`,{method:'POST',json:{note:f.get('note')}});close();toast(act==='approve'?'Approved':'Rejected');renderAccess()})});
    wirePager(body,draw)};
  draw();
}

/* ================= Audit history ================= */
const AUD={q:'',category:'all',problems:false,page:1};
async function renderAudit(){
  const body=view('audit','Audit history','Who did what, and when. Entries cannot be edited or deleted.');
  const qs=`audit/?page=${AUD.page}&size=25&category=${AUD.category}${AUD.problems?'&outcome=problems':''}${AUD.q?`&q=${encodeURIComponent(AUD.q)}`:''}`;
  const d=await load(body,CM+qs);if(!d)return;
  const pages=Math.max(1,Math.ceil(d.total/d.size));
  const outcome={done:['lime','Done'],refused:['melon','Refused'],failed:['melon','Failed']};
  body.innerHTML=`<div class="toolbar"><label class="field" style="flex:1;max-width:420px">Search<input id="aq" value="${esc(AUD.q)}" placeholder="A person, or something like “signed in”" style="border:0;background:none;height:100%;flex:1"></label>
    <label class="field">Type<select id="ac"><option value="all">All events</option>${d.categories.map(([k,l])=>`<option value="${k}" ${AUD.category===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
    <label class="field">Show<select id="ap"><option value="">Everything</option><option value="1" ${AUD.problems?'selected':''}>Only refusals and failures</option></select></label></div>
    <div class="feed">${d.rows.map(r=>`<details class="audit-row"><summary><span class="bubble ${r.outcome==='done'?'info':'bad'}">${esc((r.who||'?').slice(0,1))}</span><div><b>${esc(r.who)}</b> ${esc(r.summary)}${r.target?` <span class="muted">#${esc(r.target)}</span>`:''}<small>${fmtDate(r.at)}</small></div><span class="sticker ${outcome[r.outcome][0]}">${outcome[r.outcome][1]}</span></summary>
      <dl class="audit-d"><dt>When</dt><dd>${fmtDate(r.at)}</dd><dt>From</dt><dd>${esc(r.ip||'—')}</dd><dt>Device</dt><dd>${esc(r.device||'—')}</dd>${Object.entries(r.details||{}).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(typeof v==='object'?JSON.stringify(v):v)}</dd>`).join('')}</dl></details>`).join('')||'<div class="panel empty"><b>Nothing found</b>Try another search or filter.</div>'}</div>
    ${pages>1?pagerHtml('audit',AUD.page,pages,d.total,(AUD.page-1)*d.size,d.size):''}`;
  let t;$('#aq').oninput=e=>{clearTimeout(t);t=setTimeout(()=>{AUD.q=e.target.value;AUD.page=1;renderAudit().then(()=>{const n=$('#aq');n.focus();n.setSelectionRange(n.value.length,n.value.length)})},350)};
  $('#ac').onchange=e=>{AUD.category=e.target.value;AUD.page=1;renderAudit()};
  $('#ap').onchange=e=>{AUD.problems=!!e.target.value;AUD.page=1;renderAudit()};
  body.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{AUD.page=+b.dataset.pg.split(':')[1];renderAudit();window.scrollTo({top:0,behavior:'smooth'})});
}

/* ================= Organisation settings ================= */
async function renderOrg(){
  const body=view('org','Organisation settings','Restaurant details, logo, operating targets and sign-in security.');
  const o=await load(body,CM+'org/');if(!o)return;
  const can=API.can.admin,dis=can?'':'disabled';
  body.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-b org-sum"><img src="${o.logo?'':'brand/logo.png'}" id="orgLogo" alt=""><div><h2 style="margin:0">${esc(o.name)}</h2><p class="muted" style="margin:4px 0 0">${esc(o.outlet)} · ${esc(o.timezone)} · ${esc(o.currency)} · since ${new Date(o.created).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</p></div></div></div>
   <div class="admin-grid flow">
   ${panel('Restaurant details','Shown in the app and on the sign-in screen',`<form id="orgF" class="calc" style="display:grid;gap:12px"><div class="two">
     <label>Restaurant name<input name="name" value="${esc(o.name)}" ${dis} required maxlength="100"></label><label>Outlet<input name="outlet" value="${esc(o.outlet)}" ${dis} maxlength="100"></label></div>
     <label>Tagline<input name="tagline" value="${esc(o.tagline)}" ${dis} maxlength="150"></label><label>Address<textarea name="address" rows="2" ${dis} maxlength="300">${esc(o.address)}</textarea></label>
     <div class="two"><label>Phone<input name="phone" value="${esc(o.phone)}" ${dis}></label><label>Email<input name="email" type="email" value="${esc(o.email)}" ${dis}></label>
     <label>GSTIN<input name="gstin" value="${esc(o.gstin)}" ${dis} maxlength="15" placeholder="19ABCDE1234F1Z5"></label><label>FSSAI licence<input name="fssai" value="${esc(o.fssai)}" ${dis} maxlength="20"></label>
     <label>Website<input name="website" value="${esc(o.website)}" ${dis}></label><label>Timezone<input name="timezone" value="${esc(o.timezone)}" ${dis}></label></div>
     ${can?'<div><button class="btn btn-primary">Save details</button></div>':''}</form>`)}
   ${panel('Logo','PNG, JPG or WebP up to 1 MB. Used on the sign-in screen.',`<div class="logo-edit"><img src="brand/logo.png" id="orgLogo2" alt=""><div style="display:flex;gap:8px;flex-wrap:wrap">${can?`<label class="btn btn-sm btn-line">Upload logo<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden></label>${o.logo?btn('Remove','id="logoDel"'):''}`:''}</div><small class="muted">${o.logo?'Your uploaded logo.':'Showing the built-in Chef & Mixologist logo.'}</small></div>`)}
   ${panel('Kitchen targets','Used by reports and reorder suggestions',`<form id="opsF" class="calc" style="display:grid;gap:12px"><div class="two">
     <label>Food cost target (%)<input name="foodCostTarget" type="number" min="5" max="80" step="0.5" value="${o.foodCostTarget}" ${dis}></label>
     <label>Stock-out protection<select name="serviceLevel" ${dis}>${[[1.28,'90%'],[1.65,'95%'],[2.33,'99%']].map(([v,l])=>`<option value="${v}" ${o.serviceLevel===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
     ${can?'<div><button class="btn btn-primary">Save targets</button></div>':''}</form>`)}
   ${themePanel(o,dis,can)}
   ${costingPanel(o,dis,can)}
   ${limitsPanel(o,dis,can)}
   ${whatsappPanel(o,dis,can)}
   ${panel('Sign-in security','Two-step verification with an authenticator app',`<form id="secF" class="calc" style="display:grid;gap:12px"><label>Who must use two-step verification<select name="mfaPolicy" ${dis}>
     <option value="admins" ${o.mfaPolicy==='admins'?'selected':''}>Owners, managers and auditors</option><option value="required" ${o.mfaPolicy==='required'?'selected':''}>Everyone</option><option value="optional" ${o.mfaPolicy==='optional'?'selected':''}>Optional for everyone</option></select></label>
     <p class="muted" style="margin:0">People who must use it are asked to set it up the next time they sign in.</p>${can?'<div><button class="btn btn-primary">Save security</button></div>':''}</form>`)}</div>`;
  if(o.logo){const r=await fetch(API.base+o.logo,{headers:{Authorization:'Token '+API.token}}).catch(()=>null);if(r&&r.ok){const u=URL.createObjectURL(await r.blob());if($('#orgLogo'))$('#orgLogo').src=u;if($('#orgLogo2'))$('#orgLogo2').src=u}}else if($('#orgLogo'))$('#orgLogo').src='brand/logo.png';
  if(!can||!body.isConnected)return;  // the page was redrawn while the logo loaded
  const save=sel=>$(sel).onsubmit=async e=>{e.preventDefault();try{await api(CM+'org/',{method:'PATCH',json:Object.fromEntries(new FormData(e.target))});toast('Saved');BRAND=null;renderOrg()}catch(err){fail(err)}};
  save('#orgF');save('#opsF');save('#secF');save('#costF');save('#limF');if($('#waF'))$('#waF').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);
    try{await api(CM+'org/',{method:'PATCH',json:{whatsappTarget:f.get('whatsappTarget'),whatsappPrices:!!f.get('whatsappPrices')}});toast('Saved');await reload();renderOrg()}catch(err){fail(err)}};
  wireTheme(o);
  $$('#costF input[name="costingMethod"]').forEach(r=>r.onchange=()=>$$('#costF .method').forEach(l=>l.classList.toggle('on',l.contains(r)&&r.checked)));
  $('#logoFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>1048576)return toast('Logo must be under 1 MB');const fd=new FormData();fd.append('logo',f);try{await api(CM+'org/logo/',{method:'POST',body:fd});toast('Logo saved');BRAND=null;renderOrg()}catch(err){fail(err)}};
  if($('#logoDel'))$('#logoDel').onclick=async()=>{await api(CM+'org/logo/',{method:'DELETE'});toast('Logo removed');BRAND=null;renderOrg()};
}

/* Colour palette: preview as you pick, saved for everyone on Save */
function themePanel(o,dis,can){
  const t=o.theme||{theme:'copper'},cur=paletteColours(t)||PALETTES.copper.slice(2);
  const card=(k,name,sub,p,a)=>`<label class="pal ${t.theme===k?'on':''}"><input type="radio" name="theme" value="${k}" ${t.theme===k?'checked':''} ${dis}>
    <span class="pal-sw"><i style="background:${p}"></i><i style="background:${a}"></i></span><b>${esc(name)}</b><small>${esc(sub)}</small></label>`;
  return panel('Colour palette','Brand colours for everyone in the app and on the sign-in screen',`<form id="themeF" class="calc" style="display:grid;gap:12px">
   <div class="pal-pick">${Object.entries(PALETTES).map(([k,[n,sub,p,a]])=>card(k,n,sub,p,a)).join('')}
     ${card('custom','Your own colours','Pick a dark colour and an accent',t.primary||cur[0],t.accent||cur[1])}</div>
   <div class="pal-custom two ${t.theme==='custom'?'on':''}"><label>Dark brand colour<input type="color" name="themePrimary" value="${t.primary||cur[0]}" ${dis}></label>
     <label>Accent colour<input type="color" name="themeAccent" value="${t.accent||cur[1]}" ${dis}></label></div>
   <p class="pal-warn" id="palWarn" hidden></p>
   <p class="muted" style="margin:0">Green, gold and red keep their meaning (healthy, needs attention, problem) in every palette.</p>
   ${can?'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary">Save palette</button><button type="button" class="btn btn-line" id="palUndo">Undo preview</button></div>':''}</form>`);
}
function wireTheme(o){
  const f=$('#themeF');if(!f)return;
  const saved=o.theme||{theme:'copper'};
  const pick=()=>{const d=Object.fromEntries(new FormData(f));
    const t={theme:d.theme,primary:d.themePrimary,accent:d.themeAccent};
    $$('#themeF .pal').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked));
    $('#themeF .pal-custom').classList.toggle('on',t.theme==='custom');
    const sw=$('#themeF input[value="custom"]').closest('.pal').querySelectorAll('.pal-sw i');sw[0].style.background=t.primary;sw[1].style.background=t.accent;
    const warn=[];if(t.theme==='custom'){
      if(contrast(t.primary,'#FFF8F0')<7)warn.push('The dark colour is too light for white text on the sidebar. Pick a darker shade.');
      if(contrast(t.accent,'#FFF8F0')<3)warn.push('The accent is too light for button text. Pick a deeper shade.')}
    $('#palWarn').hidden=!warn.length;$('#palWarn').textContent=warn.join(' ');
    applyTheme(t);return warn.length===0};
  f.addEventListener('input',pick);
  $('#palUndo').onclick=()=>{applyTheme(saved);renderOrg()};
  f.onsubmit=async e=>{e.preventDefault();if(!pick())return toast('Choose colours with enough contrast first');
    try{const d=Object.fromEntries(new FormData(f));await api(CM+'org/',{method:'PATCH',json:d});
      SAVED_THEME={theme:d.theme,primary:d.themePrimary.toUpperCase(),accent:d.themeAccent.toUpperCase()};applyTheme(SAVED_THEME);toast('Palette saved');BRAND=null;renderOrg()}catch(err){fail(err)}};
}

/* ================= Install app (PWA) ================= */
let INSTALL_EVT=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();INSTALL_EVT=e;if(S.view==='install')renderInstall()});
window.addEventListener('appinstalled',()=>{INSTALL_EVT=null;toast('App installed');if(S.view==='install')renderInstall()});
function renderInstall(){
  const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const body=view('install','Install the app','Open Chef & Mixologist from your phone\'s home screen or your computer\'s dock, in its own window.');
  const sw='serviceWorker' in navigator&&navigator.serviceWorker.controller;
  body.innerHTML=`<div class="install-hero"><img src="brand/icon-192.png" alt=""><div><h2>${installed?'You are using the installed app':'Chef & Mixologist on this device'}</h2><p>${installed?'Everything is set up.':ios?'On iPhone or iPad: tap the Share button, then “Add to Home Screen”.':INSTALL_EVT?'One tap adds it to this device.':'Use your browser\'s menu and choose “Install app” or “Add to Home screen”.'}</p></div>
    ${!installed&&INSTALL_EVT?'<button class="btn btn-primary" id="doInstall">Install app</button>':''}</div>
    <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:16px 0">
      <div class="tile ${sw?'good':'warn'}"><span class="lbl">Offline page</span><span class="val" style="font-size:var(--fs-lg)">${sw?'Active':'Starting…'}</span><span class="sub">Opens even on a weak connection</span></div>
      <div class="tile ${installed?'good':'info'}"><span class="lbl">This device</span><span class="val" style="font-size:var(--fs-lg)">${installed?'Installed':'In the browser'}</span><span class="sub">${installed?'Running in its own window':'Install for quicker access'}</span></div>
      <div class="tile info"><span class="lbl">Alerts</span><span class="val" style="font-size:var(--fs-lg)">${'Notification' in window?({granted:'Allowed',denied:'Blocked',default:'Not set'})[Notification.permission]:'Not supported'}</span><span class="sub"><a href="#prefs">Notification preferences</a></span></div></div>
    <div class="admin-grid">${panel('Kept on this device','So the app opens fast',`<ul class="ticks good"><li>The app's screens and styling</li><li>The Chef &amp; Mixologist logo and icons</li><li>A “you're offline” page</li></ul>`)}
      ${panel('Never stored on this device','Always fetched from the server',`<ul class="ticks bad"><li>Stock levels, orders and sales</li><li>Prices, costs and supplier details</li><li>Item photos and recipes</li><li>Passwords and sign-in sessions</li></ul>`)}</div>`;
  if($('#doInstall'))$('#doInstall').onclick=async()=>{INSTALL_EVT.prompt();await INSTALL_EVT.userChoice;INSTALL_EVT=null;renderInstall()};
}

/* ================= navigation, routing, start-up ================= */
Object.assign(VIEWS,{profile:renderProfile,notifications:renderNotifications,prefs:renderPrefs,team:renderTeam,permissions:renderPermissions,
  access:renderAccess,audit:renderAudit,org:renderOrg,install:renderInstall});
const IC={team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6"/>',
  permissions:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',access:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  audit:'<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',org:'<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  notifications:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',install:'<path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'};
const liveCan=k=>()=>API.live&&(!k||API.can[k]);
IC.prefs='<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>';
NAV.push(['_admin','Admin and settings'],
  ['team','Team',IC.team,liveCan('staff')],['permissions','Roles & access',IC.permissions,liveCan('roles')],['access','Access requests',IC.access,liveCan()],
  ['audit','Audit history',IC.audit,liveCan('audit')],['org','Organisation settings',IC.org,liveCan('settings')],
  ['notifications','Notifications',IC.notifications,liveCan()],['prefs','Notification preferences',IC.prefs,liveCan()],['install','Install app',IC.install]);
// My profile is pinned to the foot of the sidebar, not listed in the menu

const navOpen=k=>{try{return localStorage.getItem('cm_nav_'+k)==='1'}catch(e){return false}};
const CHEVRON='<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const baseRenderMenu=renderMenu;
renderMenu=function(){
  baseRenderMenu();
  const menu=$('#menu');
  menu.insertAdjacentHTML('afterbegin','<span class="side-sec">Daily work</span>');
  // entries whose key starts with "_" open a collapsible group holding everything after them
  let body=null;
  [...menu.children].forEach(el=>{
    const k=el.dataset&&el.dataset.v;
    if(k&&k.startsWith('_')){
      if(!API.live){el.remove();body=null;return}
      const label=(NAV.find(n=>n[0]===k)||[])[1]||'';
      const g=document.createElement('div');g.className='nav-group';g.dataset.g=k;
      g.innerHTML=`<button type="button" class="nav-g-h" aria-expanded="false" aria-controls="ng-${k}">${esc(label)}<span class="nav-g-n"></span>${CHEVRON}</button><div class="nav-g-b" id="ng-${k}"></div>`;
      el.replaceWith(g);body=g.querySelector('.nav-g-b');return}
    if(body)body.appendChild(el);
  });
  $$('#menu .nav-group').forEach(g=>{
    const h=g.querySelector('.nav-g-h'),b=g.querySelector('.nav-g-b');
    if(!b.children.length){g.remove();return}
    const open=navOpen(g.dataset.g)||!!b.querySelector('[aria-current="page"]');
    g.classList.toggle('open',open);h.setAttribute('aria-expanded',open);
    h.onclick=()=>{const o=!g.classList.contains('open');g.classList.toggle('open',o);h.setAttribute('aria-expanded',o);
      try{localStorage.setItem('cm_nav_'+g.dataset.g,o?'1':'0')}catch(e){}};
  });
  const nb=$('#menu button[data-v="notifications"]');
  if(nb&&UNREAD){const n=UNREAD>9?'9+':UNREAD;nb.insertAdjacentHTML('beforeend',`<span class="badge">${n}</span>`);
    const gn=nb.closest('.nav-group')?.querySelector('.nav-g-n');if(gn)gn.innerHTML=`<span class="badge">${n}</span>`}
  const foot=$('#sideFoot');if(foot)foot.toggleAttribute('aria-current',S.view==='profile');
  filterMenu();
};
function filterMenu(){
  const q=($('#menuQ')?.value||'').trim().toLowerCase(),menu=$('#menu');
  menu.classList.toggle('searching',!!q);
  $$('#menu button[data-v]').forEach(b=>b.hidden=!!q&&!b.textContent.toLowerCase().includes(q));
  $$('#menu .nav-group').forEach(g=>g.hidden=!!q&&!g.querySelector('button[data-v]:not([hidden])'));
  let empty=$('#menu .menu-none');
  const none=!!q&&!$('#menu button[data-v]:not([hidden])');
  if(none&&!empty)menu.insertAdjacentHTML('beforeend','<p class="menu-none">No page matches. Try another word.</p>');
  else if(!none&&empty)empty.remove();
}
$('#menuQ').oninput=filterMenu;
$('#menuQ').onkeydown=e=>{if(e.key==='Enter'){const b=$('#menu button[data-v]:not([hidden])');if(b){b.click();e.target.value='';filterMenu()}}
  if(e.key==='Escape'){e.target.value='';filterMenu()}};
/* Phone menu: the sidebar opens as a drawer */
function setNav(open){
  const side=$('#side'),t=$('#navToggle');if(!side||!t)return;
  side.classList.toggle('open',open);$('#navScrim').hidden=!open;document.body.classList.toggle('nav-open',open);
  t.setAttribute('aria-expanded',open);t.setAttribute('aria-label',open?'Close menu':'Open menu');
  if(open)($('#menu [aria-current="page"]')||$('#menuQ')).focus();
}
$('#navToggle').onclick=()=>setNav(!$('#side').classList.contains('open'));
$('#navScrim').onclick=()=>setNav(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#side').classList.contains('open')){setNav(false);$('#navToggle').focus()}});
matchMedia('(min-width:861px)').addEventListener('change',e=>{if(e.matches)setNav(false)});
const baseGo=go;
go=function(v,opts){setNav(false);if(S.view==='org'&&v!=='org'&&SAVED_THEME)applyTheme(SAVED_THEME);if(v&&!v.startsWith('_')){if(location.hash!=='#'+v)history.replaceState(null,'','#'+v)}baseGo(v,opts)};
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);
  if(VIEWS[v]&&S.view!==v){const m=$('#modal');if(m.classList.contains('on')&&!$('#mform [name=u]'))m.classList.remove('on');baseGo(v)}  // a new page closes the side panel and any dialog
});

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{});

// start once every script (links, units, stock-takes …) has loaded, so the first page has all its helpers
window.addEventListener('DOMContentLoaded',async function start(){
  $$('[data-signin]').forEach(b=>b.onclick=()=>API.live?go('profile'):showLogin());
  fetch(API.base+CM+'branding/').then(r=>r.json()).then(b=>{BRAND=BRAND||b;SAVED_THEME=b.theme;applyTheme(b.theme)}).catch(()=>{});
  if(activationFromHash()){render();return}
  const want=location.hash.slice(1);
  if(!API.token){render();showLogin();return}
  try{await afterSignIn();if(VIEWS[want]&&want!==S.view)baseGo(want)}
  catch(e){render();if(e.auth)showLogin(e.message);else offline(e)}
});
