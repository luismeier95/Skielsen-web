(()=>{
'use strict';

const COLORS={BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'};
const COLOR_DE={BLUE:'BLAU',RED:'ROT',YELLOW:'GELB',GREEN:'GRÜN'};
const POLL_MS=500;

let root=null,session=null,db=null,state=null,pollTimer=0,raf=0,busy=false;
let localStartPerf=null,lastStartToken=null,serverOffsetMs=0,revealEndPerf=0;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2=n=>String(Math.max(0,Math.floor(Number(n)||0))).padStart(2,'0');
const fmtClockMs=ms=>{
  ms=Math.max(0,Number(ms)||0);
  const cs=Math.round(ms/10);
  const sec=Math.floor(cs/100);
  return `00:${pad2(sec)}:${pad2(cs%100)}`;
};
const fmtSec=ms=>ms==null?'—':(Number(ms)/1000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
const teamColor=color=>COLORS[String(color||'').toUpperCase()]||'#1515ff';
const teamFallback=color=>'TEAM '+(COLOR_DE[String(color||'').toUpperCase()]||String(color||'').toUpperCase()||'—');

const SEGMENTS={
  '0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg',
  '5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg'
};

function sevenMarkup(value='00:00:00'){
  return [...value].map(ch=>{
    if(/\d/.test(ch)){
      const active=SEGMENTS[ch]||'';
      return `<span class="bzt-digit">${['a','b','c','d','e','f','g'].map(name=>`<i class="bzt-seg ${['a','g','d'].includes(name)?'h':'v'} ${name}${active.includes(name)?' on':''}"></i>`).join('')}</span>`;
    }
    return `<span class="bzt-separator colon" aria-hidden="true"></span>`;
  }).join('');
}

function currentViewer(){
  const memberId=state?.viewer?.member_id;
  return (session?.players||[]).find(p=>p.tournament_member_id===memberId)||null;
}
function viewerLabel(){
  const p=currentViewer();
  const color=p?.identity_color||'';
  const team=teamFallback(color);
  return p?.display_name?`${team} · ${String(p.display_name).toUpperCase()}`:team;
}
function setTheme(){
  const c=teamColor(state?.current?.identity_color);
  root?.style.setProperty('--bzt-team',c);
}
function liveElapsedMs(){
  if(state?.phase!=='RUNNING')return 0;
  if(state?.viewer?.is_current_team)return 0;
  const started=state?.current?.live_started_at;
  if(!started)return 0;
  const serverNow=Date.now()-serverOffsetMs;
  return Math.max(0,serverNow-Date.parse(started));
}
function messageText(){
  const name=String(state?.current?.display_name||'PLAYER').toUpperCase();
  const team=String(state?.current?.team_name||teamFallback(state?.current?.identity_color)).toUpperCase();
  if(state?.phase==='RUNNING'){
    if(state?.viewer?.is_current_player)return 'Deine Zeit läuft. Stoppe nur nach Gefühl.';
    if(state?.viewer?.is_current_team)return `${name} spielt. Die Zeit bleibt für dein Team verborgen.`;
    return `${name} spielt. Du siehst die Zeit live mitlaufen.`;
  }
  if(state?.phase==='READY'){
    if(state?.viewer?.is_current_player)return 'Du startest diesen Relay-Versuch.';
    if(state?.viewer?.is_current_team)return `${name} ist jetzt für dein Team dran.`;
    return `${team} · ${name} ist jetzt dran.`;
  }
  return '';
}
function actionMarkup(){
  const active=!!state?.viewer?.is_current_player;
  if(state?.phase==='RUNNING'&&active)return `<button class="bzt-action stop" id="bztAction" type="button">STOPP</button>`;
  if(state?.phase==='READY'&&active)return `<button class="bzt-action" id="bztAction" type="button">START</button>`;
  return `<button class="bzt-action wait" type="button" disabled>${state?.phase==='RUNNING'?'ZEIT LÄUFT':'WARTEN'}</button>`;
}
function playMarkup(){
  const round=Number(state?.round||1),roundCount=Number(state?.round_count||5);
  const current=state?.current||{};
  return `<section class="bzt-app">
    <header class="bzt-header">
      <div class="bzt-header-row"><strong>SKIELSEN</strong><span>RUNDE ${round} / ${roundCount}</span></div>
      <div class="bzt-header-row sub"><span>${esc(viewerLabel())}</span><b>${esc(state?.phase==='RUNNING'?'LÄUFT':'BEREIT')}</b></div>
    </header>
    <main class="bzt-content">
      <section class="bzt-now">
        <span>JETZT DRAN</span>
        <strong>${esc(String(current.display_name||'PLAYER').toUpperCase())}</strong>
      </section>
      <section class="bzt-info-grid">
        <div class="bzt-info"><span>ZIELZEIT</span><strong>${Number(state?.target_seconds||0)} SEK</strong></div>
        <div class="bzt-info"><span>RELAY</span><strong class="small">SPIELER ${Number(current.relay_index||1)} / ${Number(current.relay_count||1)}</strong></div>
      </section>
      <section class="bzt-display-shell"><div class="bzt-display" id="bztDisplay" role="timer" aria-label="00:00:00">${sevenMarkup('00:00:00')}</div></section>
      <div class="bzt-message">${esc(messageText())}</div>
      ${actionMarkup()}
    </main>
  </section>`;
}
function revealMarkup(){
  const rv=state?.reveal||{},rows=Array.isArray(rv.rows)?rv.rows:[];
  return `<section class="bzt-app bzt-reveal">
    <header class="bzt-header">
      <div class="bzt-header-row"><strong>SKIELSEN</strong><span>RUNDE ${Number(rv.round||state?.round||1)} / ${Number(state?.round_count||5)}</span></div>
      <div class="bzt-header-row sub"><span>${esc(viewerLabel())}</span><b>AUSWERTUNG</b></div>
    </header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>RUNDE ${Number(rv.round||state?.round||1)} · AUSWERTUNG</span><h2>ZWISCHENSTAND</h2></section>
      <section class="bzt-countdown"><span>NÄCHSTE RUNDE IN</span><strong id="bztCountdown">7s</strong></section>
      <div class="bzt-countbar"><i id="bztCountbar"></i></div>
      <section class="bzt-table-wrap">
        <div class="bzt-table-title">ZIELZEIT · ${Number(rv.target_seconds||state?.target_seconds||0)} SEKUNDEN</div>
        <table><thead><tr><th>TEAM</th><th>ZEIT 1</th><th>ZEIT 2</th><th>GESAMT</th><th>ABW.</th></tr></thead>
        <tbody>${rows.map((r,i)=>`<tr class="${i===0?'best':''}">
          <td><i style="background:${teamColor(r.identity_color)}"></i>${esc(String(r.team_name||teamFallback(r.identity_color)).replace(/^TEAM\s+/i,''))}</td>
          <td>${fmtSec(r.split1_ms)}</td>
          <td>${r.split2_ms==null?'—':fmtSec(r.split2_ms)}</td>
          <td>${fmtSec(r.total_ms)}</td>
          <td>${fmtSec(r.deviation_ms)}</td>
        </tr>`).join('')}</tbody></table>
      </section>
      <p class="bzt-auto-note">Es geht automatisch weiter.</p>
    </main>
  </section>`;
}
function completeMarkup(){
  const standings=Array.isArray(state?.result?.standings)?state.result.standings:[];
  return `<section class="bzt-app bzt-complete">
    <header class="bzt-header"><div class="bzt-header-row"><strong>SKIELSEN</strong><span>5 / 5</span></div><div class="bzt-header-row sub"><span>${esc(viewerLabel())}</span><b>FERTIG</b></div></header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>BUZZER ZEIT STOPPEN</span><h2>SPIEL BEENDET</h2></section>
      <section class="bzt-table-wrap final">
        <div class="bzt-table-title">GESAMTABWEICHUNG · 5 RUNDEN</div>
        <table><thead><tr><th>TEAM</th><th colspan="3"></th><th>ABW.</th></tr></thead>
        <tbody>${standings.map((r,i)=>`<tr class="${i===0?'best':''}">
          <td><i style="background:${teamColor(r.identity_color)}"></i>${esc(String(r.team_name||teamFallback(r.identity_color)).replace(/^TEAM\s+/i,''))}</td>
          <td colspan="3">${i+1}. PLATZ</td>
          <td>${fmtSec(r.total_deviation_ms)}</td>
        </tr>`).join('')}</tbody></table>
      </section>
      <p class="bzt-auto-note">Das Ergebnis ist gespeichert.</p>
    </main>
  </section>`;
}
function render(){
  if(!root||!state)return;
  setTheme();
  root.closest('#v15InAppLayer')?.classList.add('buzzer-mode');
  if(state.phase==='REVEAL')root.innerHTML=revealMarkup();
  else if(state.phase==='COMPLETE')root.innerHTML=completeMarkup();
  else root.innerHTML=playMarkup();

  document.getElementById('bztAction')?.addEventListener('click',handleAction);
  if(state.phase==='REVEAL'){
    revealEndPerf=performance.now()+Math.max(0,Number(state.reveal_remaining_ms||0));
  }
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(frame);
}
function updateSeven(value){
  const el=document.getElementById('bztDisplay');
  if(!el)return;
  const next=value||'00:00:00';
  if(el.dataset.value===next)return;
  el.dataset.value=next;
  el.setAttribute('aria-label',next);
  el.innerHTML=sevenMarkup(next);
}
function frame(){
  if(!root)return;
  if(state?.phase==='RUNNING')updateSeven(fmtClockMs(liveElapsedMs()));
  else if(state?.phase==='READY')updateSeven('00:00:00');

  if(state?.phase==='REVEAL'){
    const left=Math.max(0,revealEndPerf-performance.now());
    const sec=document.getElementById('bztCountdown'),bar=document.getElementById('bztCountbar');
    if(sec)sec.textContent=`${Math.ceil(left/1000)}s`;
    if(bar)bar.style.width=`${Math.max(0,Math.min(100,left/7000*100))}%`;
  }
  raf=requestAnimationFrame(frame);
}
async function handleAction(){
  if(!db||!session||!state?.viewer?.is_current_player)return;
  const btn=document.getElementById('bztAction');
  if(btn)btn.disabled=true;
  const type=state.phase==='RUNNING'?'STOP':'START';
  let elapsed=null;
  if(type==='STOP'&&localStartPerf!=null)elapsed=Math.max(1,Math.round(performance.now()-localStartPerf));
  const r=await db.rpc('buzzer_time_action',{p_session_id:session.session_id,p_action_type:type,p_client_elapsed_ms:elapsed});
  if(r.error){
    console.warn('Buzzer action',r.error);
    if(btn)btn.disabled=false;
    return;
  }
  if(type==='START'){
    localStartPerf=performance.now();
    lastStartToken=`${state.round}|${state.current?.participant_id}|${state.current?.relay_index}`;
  }else{
    localStartPerf=null;
    lastStartToken=null;
  }
  await poll();
}
async function poll(){
  if(busy||!db||!session?.session_id)return;
  busy=true;
  try{
    const r=await db.rpc('get_buzzer_time_state',{p_session_id:session.session_id});
    if(r.error){console.warn('Buzzer state',r.error);return}
    const next=r.data||null;
    if(!next)return;
    if(next.server_now)serverOffsetMs=Date.now()-Date.parse(next.server_now);
    const token=`${next.round}|${next.current?.participant_id}|${next.current?.relay_index}`;
    if(next.phase!=='RUNNING'||!next.viewer?.is_current_player||token!==lastStartToken){
      if(next.phase!=='RUNNING')localStartPerf=null;
    }
    state=next;
    render();
  }finally{busy=false}
}
function mount(host,s,client){
  if(!host||!s||!client)return;
  const changed=!session||session.session_id!==s.session_id||root!==host;
  root=host;session=s;db=client;
  if(changed){
    clearInterval(pollTimer);cancelAnimationFrame(raf);
    state=null;localStartPerf=null;lastStartToken=null;
    root.innerHTML='<div class="bzt-loading">BUZZER WIRD GELADEN …</div>';
    poll();
    pollTimer=setInterval(poll,POLL_MS);
  }
}
function updateSession(s){session=s||session}
function unmount(){
  clearInterval(pollTimer);cancelAnimationFrame(raf);
  root?.closest('#v15InAppLayer')?.classList.remove('buzzer-mode');
  root=null;session=null;db=null;state=null;localStartPerf=null;lastStartToken=null;
}
window.skielsenBuzzerTime={mount,updateSession,unmount,poll};
})();
