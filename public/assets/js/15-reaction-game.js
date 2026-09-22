(()=>{
'use strict';

const POLL_MS=800;
const EASY_INTERVAL_MS=420;
const EASY_INITIAL_MS=350;
const EASY_HOLD_MIN_MS=700;
const EASY_HOLD_MAX_MS=2200;
const NORMAL_MIN_MS=2000;
const NORMAL_MAX_MS=4000;

let root=null,session=null,db=null,state=null,pollTimer=0;
let phase='START',attemptToken=null,signalAt=0,sequenceTimers=[],busy=false,resultOpen=false,lastRenderKey='';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorVar=c=>({BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'})[String(c||'').toUpperCase()]||'var(--theme-accent)';
const sleepTimer=(fn,ms)=>{const id=setTimeout(fn,ms);sequenceTimers.push(id);return id};
const clearSequence=()=>{sequenceTimers.forEach(clearTimeout);sequenceTimers=[];signalAt=0};
const fmt=v=>Number.isFinite(Number(v))?Math.round(Number(v))+' ms':'—';
const viewerAttempts=()=>Array.isArray(state?.viewer?.attempts)?state.viewer.attempts:[];
const validTimes=()=>viewerAttempts().filter(a=>!a?.false_start&&a?.reaction_ms!=null).map(a=>Number(a.reaction_ms)).filter(Number.isFinite);
const bestMs=()=>{const v=validTimes();return v.length?Math.min(...v):null};
const attemptNo=()=>Math.min(viewerAttempts().length+1,2);
const difficulty=()=>String(state?.difficulty||session?.public_state?.reaction_difficulty||'').toUpperCase();
const isAdmin=()=>!!(state?.viewer?.is_admin||window.skielsenV15?.runtime?.is_admin);

async function rpc(name,args){
  if(!db)throw new Error('NO_DATABASE');
  const r=await db.rpc(name,args);
  if(r.error)throw r.error;
  return r.data;
}
function playerName(){
  const id=state?.viewer?.tournament_member_id||session?.me?.tournament_member_id;
  return state?.players?.find(p=>p.tournament_member_id===id)?.display_name||session?.players?.find(p=>p.tournament_member_id===id)?.display_name||'PLAYER';
}
function currentStatus(){return String(state?.status||session?.status||'').toUpperCase()}
function clearPolling(){clearInterval(pollTimer);pollTimer=0}
function schedulePoll(){clearPolling();pollTimer=setInterval(()=>loadState(false),POLL_MS)}
function statusMarkup(){
  return `<section class="rxp-status" aria-label="Spielstatus">
    <div><small>PLAYER</small><strong>${esc(playerName())}</strong></div>
    <div><small>VERSUCH</small><strong>${viewerAttempts().length>=2?'2 / 2':attemptNo()+' / 2'}</strong></div>
    <div><small>BEST</small><strong>${fmt(bestMs())}</strong></div>
  </section>`;
}
function playerRows(){
  return (state?.players||session?.players||[]).map(p=>{
    const ready=String(p.status||'').toUpperCase()==='READY';
    const done=!!p.completed;
    const st=done?'FERTIG':ready?'BEREIT':'WARTET';
    return `<div class="rxp-player"><i style="--rxp-player:${colorVar(p.identity_color)}"></i><strong>${esc(p.display_name||'PLAYER')}</strong><b class="${done||ready?'ok':''}">${st}</b></div>`;
  }).join('');
}
function renderDifficulty(){
  resultOpen=false;
  const admin=isAdmin();
  const options=[
    ['EASY','F1-Startampel. Lichter aus = drücken.'],
    ['NORMAL','Keine Vorwarnung. Farbwechsel nach 2–4 Sekunden.']
  ];
  root.innerHTML=`<main class="rxp-page rxp-setup">
    <section class="rxp-hero"><small>SCHWIERIGKEIT</small><h2>REACTION.</h2></section>
    <section class="rxp-card">
      <div class="rxp-choice" style="--difficulty-count:${options.length}">
        ${options.map(([key,copy])=>`<button type="button" data-rx-difficulty="${key}" ${admin?'':'disabled'}><strong>${key}</strong><span>${copy}</span></button>`).join('')}
      </div>
    </section>
    <div class="rxp-note">${admin?'SCHWIERIGKEIT WÄHLEN.':'WARTET AUF DIE AUSWAHL DES ADMINS.'}</div>
  </main>`;
  root.querySelectorAll('[data-rx-difficulty]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(busy)return;busy=true;root.querySelectorAll('[data-rx-difficulty]').forEach(x=>x.disabled=true);
    try{
      await rpc('set_reaction_difficulty',{p_session_id:session.session_id,p_difficulty:btn.dataset.rxDifficulty});
      await window.skielsenInApp?.poll?.();
      await loadState(true);
    }catch(err){
      console.warn('Reaction difficulty',err);
      busy=false;renderDifficulty();
    }finally{busy=false}
  }));
}
function renderReady(){
  resultOpen=false;
  const ready=String(session?.me?.status||'').toUpperCase()==='READY';
  root.innerHTML=`<main class="rxp-page rxp-ready">
    <section class="rxp-ready-head"><small>${esc(difficulty())}</small><h2>BEREIT?</h2></section>
    <section class="rxp-card"><div class="rxp-player-list">${playerRows()}</div></section>
    <section class="rxp-rules">
      <div><b>01</b><span>ZWEI VERSUCHE DIREKT HINTEREINANDER.</span></div>
      <div><b>02</b><span>DIE SCHNELLERE GÜLTIGE ZEIT ZÄHLT.</span></div>
      <div><b>03</b><span>ZU FRÜH GEDRÜCKT = FEHLSTART UND VERSUCH VERBRAUCHT.</span></div>
      <div><b>04</b><span>${difficulty()==='EASY'?'LICHTER AUS = DRÜCKEN.':'FARBWECHSEL = DRÜCKEN.'}</span></div>
    </section>
    <button class="rxp-primary ${ready?'secondary':''}" data-rx-ready type="button">${ready?'BEREITS BEREIT ✓':'ICH BIN BEREIT'}</button>
  </main>`;
  root.querySelector('[data-rx-ready]')?.addEventListener('click',async()=>{
    if(busy)return;busy=true;
    try{
      await rpc('set_in_app_game_ready',{p_session_id:session.session_id,p_ready:!ready});
      await window.skielsenInApp?.poll?.();
      await loadState(true);
    }catch(err){console.warn('Reaction ready',err)}
    finally{busy=false}
  });
}
function basePlayMarkup(){
  const easy=difficulty()==='EASY';
  return `<main class="rxp-play">
    ${statusMarkup()}
    <section class="rxp-mechanic">
      <div class="rxp-light-zone" ${easy?'':'hidden'}>
        <div class="rxp-lights" aria-label="F1 Startampel"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <button class="rxp-pad start" data-rx-pad type="button" aria-label="Reaktionsfläche">
        <strong data-rx-value>VERSUCH STARTEN</strong>
        <span data-rx-label>ZUM STARTEN DRÜCKEN</span>
      </button>
    </section>
  </main>`;
}
function setPad(cls,value,label){
  const pad=root?.querySelector('[data-rx-pad]');
  if(!pad)return;
  pad.className='rxp-pad '+cls;
  const v=pad.querySelector('[data-rx-value]'),l=pad.querySelector('[data-rx-label]');
  if(v)v.textContent=value;if(l)l.textContent=label;
}
function renderStart(){
  resultOpen=false;phase='START';attemptToken=null;clearSequence();
  root.innerHTML=basePlayMarkup();
  root.querySelector('[data-rx-pad]')?.addEventListener('pointerdown',handlePad,{passive:false});
}
function renderDoneWaiting(){
  resultOpen=false;phase='DONE';attemptToken=null;clearSequence();
  root.innerHTML=basePlayMarkup();
  setPad('done','FERTIG','WARTET AUF DIE ANDEREN PLAYER');
  const pad=root.querySelector('[data-rx-pad]');if(pad)pad.disabled=true;
}
function runEasy(){
  const lights=[...root.querySelectorAll('.rxp-lights i')];
  let index=0;
  const step=()=>{
    if(phase!=='WAITING')return;
    if(index<lights.length){
      lights[index].classList.add('on');
      index++;
      sleepTimer(step,EASY_INTERVAL_MS);
      return;
    }
    sleepTimer(()=>{
      if(phase!=='WAITING')return;
      lights.forEach(x=>x.classList.remove('on'));
      arm();
    },EASY_HOLD_MIN_MS+Math.random()*(EASY_HOLD_MAX_MS-EASY_HOLD_MIN_MS));
  };
  sleepTimer(step,EASY_INITIAL_MS);
}
function runNormal(){
  const delay=NORMAL_MIN_MS+Math.random()*(NORMAL_MAX_MS-NORMAL_MIN_MS);
  sleepTimer(()=>{if(phase==='WAITING')arm()},delay);
}
function arm(){
  phase='ARMED';
  signalAt=performance.now();
  if(difficulty()==='EASY')setPad('waiting','','');
  else setPad('signal','','');
}
async function beginAttempt(){
  if(busy||phase!=='START')return;
  busy=true;setPad('waiting','STARTET …','');
  try{
    const data=await rpc('begin_reaction_attempt',{p_session_id:session.session_id});
    attemptToken=data?.attempt_token||null;
    if(!attemptToken)throw new Error('REACTION_ATTEMPT_TOKEN_MISSING');
    phase='WAITING';setPad('waiting','','');
    if(difficulty()==='EASY')runEasy();else runNormal();
  }catch(err){
    console.warn('Reaction begin',err);
    phase='START';
    if(String(err?.message||err).includes('REACTION_ATTEMPT_ALREADY_PENDING'))void loadState(true);
    else setPad('start','VERSUCH STARTEN','ZUM STARTEN DRÜCKEN');
  }finally{busy=false}
}
async function submitAttempt(ms,falseStart){
  if(busy||!attemptToken)return;
  busy=true;clearSequence();
  const token=attemptToken;attemptToken=null;phase='RESULT';
  setPad(falseStart?'false-start':'result',falseStart?'FEHLSTART':fmt(ms),falseStart?'VERSUCH VERBRAUCHT':'REAKTIONSZEIT');
  try{
    const data=await rpc('submit_reaction_attempt',{
      p_session_id:session.session_id,
      p_attempt_token:token,
      p_reaction_ms:falseStart?null:ms,
      p_false_start:!!falseStart
    });
    if(data?.tournament_complete&&data?.tournament_result){
      state={...(state||{}),status:'FINISHED',result:data.tournament_result};
      ingestResult(data.tournament_result);
      renderResult(data.tournament_result);
      return;
    }
    sleepTimer(()=>{phase='START';void loadState(true)},1100);
  }catch(err){
    console.warn('Reaction submit',err);
    setPad('false-start','SYNC-FEHLER','VERSUCH NICHT GESPEICHERT');
    phase='START';
    sleepTimer(()=>loadState(true),1200);
  }finally{busy=false}
}
function handlePad(e){
  e?.preventDefault?.();
  if(phase==='START'){void beginAttempt();return}
  if(phase==='WAITING'){void submitAttempt(null,true);return}
  if(phase==='ARMED'){void submitAttempt(performance.now()-signalAt,false)}
}
function ingestResult(result){
  if(!result)return;
  window.skielsenV15?.ingestInAppGameResult?.(session?.tournament_game_id,result);
}
function renderResult(result){
  if(!result||!Array.isArray(result.standings))return;
  resultOpen=true;phase='RANKING';clearSequence();
  const playerResults=Array.isArray(result.player_results)?result.player_results:[];
  const rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
  root.innerHTML=`<main class="rxp-page rxp-result-page">
    <section class="rxp-result-status"><strong>ERGEBNIS</strong></section>
    <section class="rxp-result-card">
      <header><strong>FINALES ERGEBNIS</strong><span>${esc(result.difficulty||difficulty())} · LESS IS BETTER</span></header>
      <div class="rxp-result-columns"><span>POSITION</span><span>NAME</span><span>ZEIT</span><span>DETAIL</span></div>
      <div>${rows.map(r=>{
        const details=playerResults.filter(p=>p.participant_id===r.participant_id).map(p=>`${esc(p.display_name||'PLAYER')} ${fmt(p.best_ms)}`).join(' + ')||'—';
        return `<div class="rxp-result-row"><b>${Number(r.placement)}.</b><span class="rxp-result-player"><i style="--rxp-player:${colorVar(r.identity_color)}"></i><strong>${esc(r.display_name||'TEILNEHMER')}</strong></span><strong>${r.aggregate_ms==null?'DNF':fmt(r.aggregate_ms)}</strong><span class="rxp-detail">${details}</span></div>`;
      }).join('')}</div>
    </section>
    <button class="rxp-primary" data-rx-close type="button">SPIEL SCHLIESSEN →</button>
  </main>`;
  root.querySelector('[data-rx-close]')?.addEventListener('click',()=>{
    if(!window.skielsenBuzzerBridge?.completePendingInAppGame?.())window.skielsenInApp?.finishAndExit?.();
  });
}
function renderFromState(force=false){
  if(!root||!state)return;
  const key=JSON.stringify([state.status,state.difficulty,state.viewer?.attempts,state.players?.map(p=>[p.tournament_member_id,p.status,p.attempt_count]),state.result?.finalized_at]);
  if(!force&&key===lastRenderKey&&['WAITING','ARMED','RESULT'].includes(phase))return;
  lastRenderKey=key;
  if(state.result){ingestResult(state.result);renderResult(state.result);return}
  const status=currentStatus();
  if(status!=='ACTIVE'){
    if(!difficulty())renderDifficulty();else renderReady();
    return;
  }
  const pending=state?.viewer?.pending;
  if(phase==='START'&&pending?.attempt_token){
    root.innerHTML=basePlayMarkup();
    attemptToken=pending.attempt_token;
    phase='WAITING';
    setPad('false-start','UNTERBROCHEN','VERSUCH WIRD ALS FEHLSTART GEWERTET');
    void submitAttempt(null,true);
    return;
  }
  if(viewerAttempts().length>=2){renderDoneWaiting();return}
  if(!['WAITING','ARMED','RESULT'].includes(phase))renderStart();
}
async function loadState(force=false){
  if(!session?.session_id||!db)return;
  try{
    const next=await rpc('get_reaction_state',{p_session_id:session.session_id});
    if(!next)return;
    state=next;
    renderFromState(force);
  }catch(err){console.warn('Reaction state',err)}
}
function mount(nextRoot,nextSession,nextDb){
  const same=root===nextRoot&&String(session?.session_id||'')===String(nextSession?.session_id||'');
  root=nextRoot;session=nextSession;db=nextDb;root.classList.add('rxp-root');
  if(!same){phase='START';attemptToken=null;lastRenderKey='';resultOpen=false;clearSequence()}
  void loadState(true);schedulePoll();
  return true;
}
function updateSession(nextSession){
  session=nextSession||session;
  if(state)state.status=session?.status||state.status;
  void loadState(false);
}
function unmount(){
  clearPolling();clearSequence();
  if(root)root.classList.remove('rxp-root');
  root=null;session=null;db=null;state=null;phase='START';attemptToken=null;signalAt=0;busy=false;lastRenderKey='';resultOpen=false;
}
window.skielsenReaction={mount,updateSession,unmount,get resultOpen(){return resultOpen}};
})();