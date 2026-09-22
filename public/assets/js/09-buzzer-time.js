(()=>{
'use strict';

const COLORS={BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'};
const COLOR_DE={BLUE:'BLAU',RED:'ROT',YELLOW:'GELB',GREEN:'GRÜN'};
const POLL_MS=500,REVEAL_MS=10000;

let root=null,session=null,db=null,state=null,pollTimer=0,raf=0,busy=false;
let localStartPerf=null,lastStartToken=null,serverOffsetMs=0,revealEndPerf=0,engineResultIngested=false;
let testMode=false,testCtx=null,testEngine=null,testRevealAdvanced=false,revealToken=null,postgamePhase='RANKING',postgameBusy=false,postgameTimers=[],postgameRun=0,postgameRendered=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2=n=>String(Math.max(0,Math.floor(Number(n)||0))).padStart(2,'0');
const fmtClockMs=ms=>{
  ms=Math.max(0,Number(ms)||0);
  const cs=Math.round(ms/10);
  const sec=Math.floor(cs/100);
  return `00:${pad2(sec)}:${pad2(cs%100)}`;
};
const fmtSec=ms=>ms==null?'—':(Number(ms)/1000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
const teamColor=color=>COLORS[String(color||'').toUpperCase()]||'var(--theme-accent)';
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

function setTheme(){
  const identity=String(state?.current?.identity_color||'').toUpperCase(),c=teamColor(identity);
  const theme=String(document.documentElement.dataset.themePack||document.body.dataset.themePack||'theme.skielsen.core');
  const coreFamily=theme==='theme.skielsen.core'||theme==='theme.skielsen.core2';
  const onTeam=coreFamily?'#ffffff':(identity==='BLUE'?'#ffffff':'#050505');
  root?.style.setProperty('--bzt-team',c);
  root?.style.setProperty('--bzt-team-on',onTeam);
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
      <div class="bzt-header-row"><img class="bzt-logo" src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>RUNDE ${round} / ${roundCount}</span></div>
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
      <div class="bzt-header-row"><img class="bzt-logo" src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>RUNDE ${Number(rv.round||state?.round||1)} / ${Number(state?.round_count||5)}</span></div>
    </header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>RUNDE ${Number(rv.round||state?.round||1)} · AUSWERTUNG</span><h2>ZWISCHENSTAND</h2></section>
      <section class="bzt-countdown"><span>NÄCHSTE RUNDE IN</span><strong id="bztCountdown">10s</strong></section>
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
function clearPostgameTimers(){postgameTimers.forEach(clearTimeout);postgameTimers=[]}
function postgameLater(fn,ms){const id=setTimeout(fn,ms);postgameTimers.push(id);return id}
function canonicalPostgame(){
  return window.skielsenBuzzerBridge?.getCanonicalPostgame?.(session?.tournament_game_id,state?.result)||null;
}
function buzzerJokerAllowed(reveal){return !!reveal&&String(reveal?.joker?.category||'').toUpperCase()!=='ACTION'}
function buzzerMovement(delta){delta=Number(delta||0);return delta>0?'▲ '+delta:(delta<0?'▼ '+Math.abs(delta):'—')}
function buzzerRankingMarkup(){
  const standings=Array.isArray(state?.result?.standings)?[...state.result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)):[];
  const pg=canonicalPostgame(),byId=new Map((pg?.rows||[]).map(r=>[r.participant_id,r]));
  return `<section class="bzt-app bzt-complete">
    <header class="bzt-header"><div class="bzt-header-row"><img class="bzt-logo" src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>5 / 5</span></div></header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>BUZZER ZEIT STOPPEN</span><h2>ERGEBNIS</h2></section>
      <section class="bzt-standard-card">
        <header><strong>FINALES ERGEBNIS</strong><span>NIEDRIGSTE ABWEICHUNG GEWINNT</span></header>
        <div class="bzt-standard-columns"><span>POSITION</span><span>NAME</span><span>ABW.</span><span>PUNKTE</span></div>
        <div class="bzt-standard-rows">
          ${standings.map((r,i)=>{const m=byId.get(r.participant_id)||{};return `<div class="bzt-standard-row" style="--bzt-row-delay:${i*120}ms">
            <b>${Number(r.placement||i+1)}.</b>
            <span><i style="background:${teamColor(r.identity_color)}"></i><strong>${esc(String(r.team_name||m.display_name||teamFallback(r.identity_color)).replace(/^TEAM\\s+/i,''))}</strong></span>
            <strong>${fmtSec(r.total_deviation_ms)}</strong>
            <strong class="bzt-added-points">+${Number(m.added_points||0)}</strong>
          </div>`}).join('')}
        </div>
      </section>
      <button class="bzt-postgame-primary" type="button" data-bzt-postgame-next>WEITER →</button>
    </main>
  </section>`;
}
function buzzerJokerMarkup(reveal){
  const j=reveal?.joker||{},o=reveal?.owner||{},r=reveal?.result||{};
  const before=r.before_text??(r.before!=null?String(r.before)+(r.unit?' '+r.unit:''):'—');
  const after=r.after_text??(r.after!=null?String(r.after)+(r.unit?' '+r.unit:''):(r.text||'—'));
  return `<section class="bzt-app bzt-complete">
    <header class="bzt-header"><div class="bzt-header-row"><img class="bzt-logo" src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>JOKER</span></div></header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>POST GAME</span><h2>JOKER AUFLÖSUNG</h2></section>
      <section class="bzt-joker-card" style="--bzt-joker-owner:${esc(o.color||teamColor(o.color_key))}">
        <small>${esc(String(j.category||'SECRET').toUpperCase())} JOKER</small>
        <h2>${esc(j.title||j.type||'JOKER')}</h2>
        <p>${esc(j.description||'Der Joker wurde auf die finale Wertung angewendet.')}</p>
        <div class="bzt-joker-owner"><i></i><span><small>JOKER GESETZT VON</small><strong>${esc(o.display_name||'TEILNEHMER')}</strong></span></div>
        <div class="bzt-joker-value"><span>${esc(before)}</span><b>→</b><strong>${esc(after)}</strong></div>
      </section>
      <button class="bzt-postgame-primary" type="button" data-bzt-postgame-next>WEITER ZUM TURNIERSTAND →</button>
    </main>
  </section>`;
}
function buzzerMergeMarkup(){
  const pg=canonicalPostgame(),rows=[...(pg?.rows||[])].sort((a,b)=>Number(a.old_rank||999)-Number(b.old_rank||999));
  return `<section class="bzt-app bzt-complete">
    <header class="bzt-header"><div class="bzt-header-row"><img class="bzt-logo" src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>MERGE</span></div></header>
    <main class="bzt-reveal-content">
      <section class="bzt-reveal-head"><span>BUZZER ZEIT STOPPEN</span><h2>TURNIERSTAND</h2></section>
      <section class="bzt-standard-card bzt-merge-card is-game" data-bzt-merge-card>
        <header><strong>GAME → TURNIER</strong><span>GESAMTRANKING</span></header>
        <div class="bzt-standard-columns bzt-merge-columns"><span>POSITION</span><span>NAME</span><span>PUNKTE</span><span>+ GAME</span></div>
        <div class="bzt-standard-rows bzt-merge-rows">
          ${rows.map((r,i)=>`<div class="bzt-standard-row bzt-merge-row" data-bzt-merge-row data-old-rank="${Number(r.old_rank||i+1)}" data-new-rank="${Number(r.new_rank||i+1)}">
            <b><span class="bzt-rank-value">${Number(r.old_rank||i+1)}.</span><small class="bzt-rank-move"></small></b>
            <span><i style="background:${teamColor(r.identity_color)}"></i><strong>${esc(String(r.display_name||'TEILNEHMER').replace(/^TEAM\\s+/i,''))}</strong></span>
            <strong class="bzt-merge-points"><span>${Number(r.old_points||0)}</span><em>→</em><b>${Number(r.new_points||0)}</b></strong>
            <strong class="bzt-added-points">+${Number(r.added_points||0)}</strong>
          </div>`).join('')}
        </div>
      </section>
      <button class="bzt-postgame-primary" type="button" data-bzt-postgame-close hidden disabled>SPIEL SCHLIESSEN →</button>
    </main>
  </section>`;
}
function animateBuzzerMerge(){
  clearPostgameTimers();const run=++postgameRun,host=root?.querySelector('.bzt-merge-rows');if(!host)return;
  const rows=[...host.querySelectorAll('[data-bzt-merge-row]')],card=root?.querySelector('[data-bzt-merge-card]');
  postgameBusy=true;
  postgameLater(()=>{if(run!==postgameRun)return;card?.classList.add('is-merging')},900);
  postgameLater(()=>{if(run!==postgameRun)return;card?.classList.add('is-total')},2500);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    card?.classList.remove('is-game');card?.classList.add('is-tournament');
    const before=new Map(rows.map(r=>[r,r.getBoundingClientRect().top]));
    rows.sort((a,b)=>Number(a.dataset.newRank)-Number(b.dataset.newRank)).forEach(r=>host.appendChild(r));
    rows.forEach(r=>{const dy=before.get(r)-r.getBoundingClientRect().top;r.style.transition='none';r.style.transform=`translateY(${dy}px)`});
    void host.offsetHeight;
    rows.forEach(r=>{r.style.transition='transform 1520ms cubic-bezier(.2,.85,.2,1)';r.style.transform='translateY(0)'});
  },4100);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    rows.forEach(r=>{
      const oldRank=Number(r.dataset.oldRank||0),newRank=Number(r.dataset.newRank||oldRank),rv=r.querySelector('.bzt-rank-value'),mv=r.querySelector('.bzt-rank-move');
      if(rv){rv.textContent=newRank+'.';rv.classList.add('is-updating')}
      if(mv){mv.textContent=buzzerMovement(oldRank-newRank);mv.classList.add('visible')}
    });
  },5340);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    const close=root?.querySelector('[data-bzt-postgame-close]');if(close){close.hidden=false;close.disabled=false}
    postgameBusy=false;postgamePhase='MERGE_COMPLETE';
  },6100);
}
function advanceBuzzerPostgame(){
  if(postgameBusy)return;
  const reveal=canonicalPostgame()?.joker_reveal||state?.result?.tournament_handoff?.joker_reveal||null;
  if(postgamePhase==='RANKING'&&buzzerJokerAllowed(reveal)){postgamePhase='JOKER';render();return}
  postgamePhase='MERGE';render();
}
function renderBuzzerPostgame(){
  postgameRendered=true;
  const reveal=canonicalPostgame()?.joker_reveal||state?.result?.tournament_handoff?.joker_reveal||null;
  if(postgamePhase==='JOKER'&&buzzerJokerAllowed(reveal))root.innerHTML=buzzerJokerMarkup(reveal);
  else if(postgamePhase==='MERGE'||postgamePhase==='MERGE_COMPLETE')root.innerHTML=buzzerMergeMarkup();
  else root.innerHTML=buzzerRankingMarkup();
  root.querySelector('[data-bzt-postgame-next]')?.addEventListener('click',advanceBuzzerPostgame);
  root.querySelector('[data-bzt-postgame-close]')?.addEventListener('click',()=>{
    if(postgameBusy||postgamePhase!=='MERGE_COMPLETE')return;
    const btn=root.querySelector('[data-bzt-postgame-close]');if(btn){btn.disabled=true;btn.textContent='WIRD GESCHLOSSEN …'}
    const ok=window.skielsenBuzzerBridge?.completeCanonicalInAppPostgame?.(session?.tournament_game_id);
    if(!ok)window.skielsenInApp?.completeAndExit?.();
  });
  if(postgamePhase==='MERGE')animateBuzzerMerge();
}
function render(){
  if(!root||!state)return;
  setTheme();
  root.closest('#v15InAppLayer')?.classList.add('buzzer-mode');
  if(state.phase==='REVEAL')root.innerHTML=revealMarkup();
  else if(state.phase==='COMPLETE')renderBuzzerPostgame();
  else root.innerHTML=playMarkup();

  document.getElementById('bztAction')?.addEventListener('click',handleAction);
  if(state.phase==='REVEAL'){
    const nextRevealToken=`${Number(state.reveal?.round??state.round??0)}|${Number(state.reveal?.target_seconds??state.target_seconds??0)}`;
    if(revealToken!==nextRevealToken){
      revealToken=nextRevealToken;
      revealEndPerf=performance.now()+Math.max(0,Number(state.reveal_remaining_ms||0));
    }
  }else{
    revealToken=null;
    revealEndPerf=0;
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
    if(bar)bar.style.width=`${Math.max(0,Math.min(100,left/REVEAL_MS*100))}%`;
    if(testMode&&left<=0&&!testRevealAdvanced){testRevealAdvanced=true;queueMicrotask(testAdvanceAfterReveal)}
  }
  raf=requestAnimationFrame(frame);
}
async function handleAction(){
  if(testMode){testHandleAction();return}
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
    if(next.phase==='COMPLETE'&&next.result&&!engineResultIngested){
      try{
        engineResultIngested=!!window.skielsenV15?.ingestInAppGameResult?.(session.tournament_game_id,next.result);
      }catch(err){console.warn('Buzzer tournament sync',err)}
    }
    if(next.phase!=='COMPLETE'||!postgameRendered)render();
  }finally{busy=false}
}

function testParticipant(pid){return (testEngine?.state?.participants||[]).find(p=>p.id===pid)||null}
function testActor(aid){return (testEngine?.state?.actors||[]).find(a=>a.id===aid)||null}
function testRoundOrder(){
  const ids=testCtx?.participantIds||[];if(!ids.length)return[];
  const start=((Number(testCtx.round||1)-1)%ids.length+ids.length)%ids.length;
  return ids.slice(start).concat(ids.slice(0,start));
}
function testRelayIds(pid){
  const p=testParticipant(pid),ids=(p?.actorIds||[]).filter(Boolean);
  if(testCtx?.teamMode)return (ids.length?ids:[`${pid}-P1`,`${pid}-P2`]).slice(0,2);
  return (ids.length?ids:[`${pid}-P1`]).slice(0,1);
}
function testCurrentPid(){return testCtx?.order?.[testCtx.participantPos]||null}
function testCurrentActorId(){return testRelayIds(testCurrentPid())[testCtx?.relayIndex||0]||null}
function testCurrentName(){
  const pid=testCurrentPid(),aid=testCurrentActorId(),a=testActor(aid),p=testParticipant(pid);
  if(a?.name)return a.name;
  const relay=(testCtx?.relayIndex||0)+1;
  return testCtx?.teamMode?`${p?.name||'TEAM'} · P${relay}`:(p?.name||'PLAYER');
}
function testPickTarget(){
  const rules=testCtx?.game?.rules_json||{},team=testCtx?.teamMode;
  const range=team?(rules.teamTargetSeconds||{}):(rules.singleTargetSeconds||{});
  const min=Number(range.min??(team?6:3)),max=Number(range.max??(team?15:12));
  let n=min,tries=0;
  do{n=Math.floor(Math.random()*(max-min+1))+min;tries++}while((testCtx.targets||[]).slice(-2).includes(n)&&tries<40);
  testCtx.targets.push(n);return n;
}
function testBuildPlayState(phase='READY'){
  const pid=testCurrentPid(),p=testParticipant(pid)||{},relayIds=testRelayIds(pid),aid=testCurrentActorId();
  const liveStarted=phase==='RUNNING'?new Date().toISOString():null;
  state={
    phase,round:testCtx.round,round_count:testCtx.roundCount,target_seconds:testCtx.target,
    current:{participant_id:pid,display_name:testCurrentName(),identity_color:p.color,team_name:p.name||teamFallback(p.color),relay_index:(testCtx.relayIndex||0)+1,relay_count:relayIds.length,live_started_at:liveStarted},
    viewer:{member_id:aid,is_current_player:true,is_current_team:true},reveal:null,result:null
  };
}
function testPrepareRound(){
  testCtx.order=testRoundOrder();testCtx.participantPos=0;testCtx.relayIndex=0;testCtx.roundResults={};
  testCtx.target=testPickTarget();testRevealAdvanced=false;testBuildPlayState('READY');render();
}
function testRow(pid){
  const p=testParticipant(pid)||{},r=testCtx.roundResults[pid]||{splits:[]},splits=r.splits||[];
  const split1=Number(splits[0]||0),split2=testCtx.teamMode?Number(splits[1]||0):null,total=split1+(split2||0);
  return {participant_id:pid,team_name:p.name||teamFallback(p.color),identity_color:p.color,split1_ms:split1,split2_ms:split2,total_ms:total,deviation_ms:Math.abs(total-testCtx.target*1000)};
}
function testStartReveal(){
  const rows=testCtx.participantIds.map(testRow).sort((a,b)=>a.deviation_ms-b.deviation_ms||String(a.team_name).localeCompare(String(b.team_name),'de'));
  const snapshot={round:testCtx.round,target_seconds:testCtx.target,rows:rows.map(r=>({...r}))};
  testCtx.history.push(snapshot);testRevealAdvanced=false;
  state={phase:'REVEAL',round:testCtx.round,round_count:testCtx.roundCount,target_seconds:testCtx.target,current:state?.current||{},viewer:state?.viewer||{},reveal:snapshot,reveal_remaining_ms:REVEAL_MS,result:null};
  render();
}
function testAdvanceAfterReveal(){
  if(!testMode||!testCtx)return;
  if(testCtx.round<testCtx.roundCount){testCtx.round++;testPrepareRound();return}
  testFinalize();
}
function testFinalize(){
  const rows=testCtx.participantIds.map(pid=>{
    const p=testParticipant(pid)||{};
    const deviations=testCtx.history.map(h=>Number((h.rows||[]).find(r=>r.participant_id===pid)?.deviation_ms||0));
    return {participant_id:pid,team_name:p.name||teamFallback(p.color),identity_color:p.color,total_deviation_ms:deviations.reduce((a,b)=>a+b,0),round_deviations_ms:deviations,vector:[...deviations].sort((a,b)=>a-b),draw:Math.random()};
  });
  rows.sort((a,b)=>{
    if(a.total_deviation_ms!==b.total_deviation_ms)return a.total_deviation_ms-b.total_deviation_ms;
    for(let i=0;i<Math.max(a.vector.length,b.vector.length);i++){const d=Number(a.vector[i]||0)-Number(b.vector[i]||0);if(d)return d}
    return a.draw-b.draw;
  });
  const standings=rows.map((r,i)=>({participant_id:r.participant_id,team_name:r.team_name,identity_color:r.identity_color,total_deviation_ms:r.total_deviation_ms,round_deviations_ms:r.round_deviations_ms,placement:i+1}));
  const result={game_key:'buzzer_time_stoppen',standings,history:testCtx.history.map(h=>({round:h.round,target_seconds:h.target_seconds,rows:h.rows.map(r=>({...r}))})),finalized_at:new Date().toISOString(),tiebreak:'TOTAL_DEVIATION_THEN_BEST_ROUND_VECTOR_THEN_RANDOM_DRAW',test_mode:true};
  state={phase:'COMPLETE',round:testCtx.roundCount,round_count:testCtx.roundCount,target_seconds:testCtx.target,current:state?.current||{},viewer:state?.viewer||{},reveal:null,result};
  render();
  if(!engineResultIngested){
    try{engineResultIngested=!!testEngine?.ingestInAppGameResult?.(testCtx.tournamentGameId,result)}catch(err){console.warn('Buzzer test tournament sync',err)};if(engineResultIngested)render()
  }
}
function testHandleAction(){
  if(!testMode||!testCtx||!state?.viewer?.is_current_player)return;
  const btn=document.getElementById('bztAction');if(btn)btn.disabled=true;
  if(state.phase==='READY'){
    localStartPerf=performance.now();testBuildPlayState('RUNNING');render();return;
  }
  if(state.phase!=='RUNNING'||localStartPerf==null)return;
  const elapsed=Math.max(1,Math.round(performance.now()-localStartPerf));localStartPerf=null;
  const pid=testCurrentPid();if(!testCtx.roundResults[pid])testCtx.roundResults[pid]={splits:[]};
  testCtx.roundResults[pid].splits[testCtx.relayIndex]=elapsed;
  const relayCount=testRelayIds(pid).length;
  if(testCtx.relayIndex+1<relayCount){testCtx.relayIndex++;testBuildPlayState('READY');render();return}
  testCtx.relayIndex=0;testCtx.participantPos++;
  if(testCtx.participantPos<testCtx.order.length){testBuildPlayState('READY');render();return}
  testStartReveal();
}
function mountTest(host,runtime,game,engine){
  if(!host||!runtime||!game||!engine)return;
  const key=String(game.tournament_game_id||game.game_id||'buzzer-test');
  const changed=!testMode||root!==host||testCtx?.key!==key;
  root=host;db=null;session={session_id:`test-${key}`,tournament_game_id:game.tournament_game_id||null};testMode=true;testEngine=engine;
  clearInterval(pollTimer);cancelAnimationFrame(raf);
  if(!changed){render();return}
  const st=engine.state||{},m=(game.matches||[])[game.matchIndex||0]||(game.matches||[])[0];
  let participantIds=(m?.participantIds||[]).filter(Boolean);
  if(!participantIds.length)participantIds=(st.participants||[]).map(p=>p.id);
  testCtx={key,game,tournamentGameId:game.tournament_game_id||null,participantIds:[...participantIds],teamMode:String(runtime.mode||'').toUpperCase()==='TEAM',round:1,roundCount:Number(game.rules_json?.rounds||5),participantPos:0,relayIndex:0,target:null,targets:[],order:[],roundResults:{},history:[]};
  state=null;localStartPerf=null;lastStartToken=null;engineResultIngested=false;testRevealAdvanced=false;revealToken=null;revealEndPerf=0;postgamePhase='RANKING';postgameBusy=false;postgameRendered=false;postgameRendered=false;clearPostgameTimers();postgameRun++;
  testPrepareRound();
}

function mount(host,s,client){
  if(!host||!s||!client)return;
  const changed=!session||session.session_id!==s.session_id||root!==host;
  root=host;session=s;db=client;
  if(changed){
    clearInterval(pollTimer);cancelAnimationFrame(raf);
    state=null;localStartPerf=null;lastStartToken=null;engineResultIngested=false;revealToken=null;revealEndPerf=0;postgamePhase='RANKING';postgameBusy=false;clearPostgameTimers();postgameRun++;
    root.innerHTML='<div class="bzt-loading">BUZZER WIRD GELADEN …</div>';
    poll();
    pollTimer=setInterval(poll,POLL_MS);
  }
}
function updateSession(s){session=s||session}
function unmount(){
  clearInterval(pollTimer);cancelAnimationFrame(raf);
  testMode=false;testCtx=null;testEngine=null;testRevealAdvanced=false;revealToken=null;revealEndPerf=0;clearPostgameTimers();postgameRun++;postgamePhase='RANKING';postgameBusy=false;
  root?.closest('#v15InAppLayer')?.classList.remove('buzzer-mode');
  root=null;session=null;db=null;state=null;localStartPerf=null;lastStartToken=null;engineResultIngested=false;
}
window.skielsenBuzzerTime={mount,mountTest,updateSession,unmount,poll};
})();