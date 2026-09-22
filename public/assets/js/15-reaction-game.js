(()=>{
'use strict';

const POLL_MS=800;
const EASY_INTERVAL_MS=420;
const EASY_INITIAL_MS=350;
const NORMAL_MIN_MS=2000;
const NORMAL_MAX_MS=4000;

let root=null,session=null,db=null,state=null,pollTimer=0;
let phase='START',attemptToken=null,signalAt=0,sequenceTimers=[],postgameTimers=[],busy=false,postgameBusy=false,resultOpen=false,lastRenderKey='',postgameAnimationRun=0;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorVar=c=>({BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'})[String(c||'').toUpperCase()]||'var(--theme-accent)';
const sleepTimer=(fn,ms)=>{const id=setTimeout(fn,ms);sequenceTimers.push(id);return id};
const clearSequence=()=>{sequenceTimers.forEach(clearTimeout);sequenceTimers=[];signalAt=0};
const clearPostgameTimers=()=>{postgameTimers.forEach(clearTimeout);postgameTimers=[]};
const postgameLater=(fn,ms)=>{const id=setTimeout(fn,ms);postgameTimers.push(id);return id};
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
  resultOpen=false;postgameBusy=false;clearPostgameTimers();phase='START';attemptToken=null;clearSequence();
  root.innerHTML=basePlayMarkup();
  const pad=root.querySelector('[data-rx-pad]');
  pad?.addEventListener('pointerdown',handlePad,{passive:false});
  pad?.addEventListener('keydown',e=>{if(e.repeat||!['Enter',' '].includes(e.key))return;e.preventDefault();handlePad(e)});
}
function renderDoneWaiting(){
  resultOpen=false;postgameBusy=false;clearPostgameTimers();phase='DONE';attemptToken=null;clearSequence();
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
    lights.forEach(x=>x.classList.remove('on'));
    arm();
  };
  sleepTimer(step,EASY_INITIAL_MS);
}
function runNormal(){
  const delay=NORMAL_MIN_MS+Math.random()*(NORMAL_MAX_MS-NORMAL_MIN_MS);
  sleepTimer(()=>{if(phase==='WAITING')arm()},delay);
}
function arm(){
  phase='ARMED';signalAt=performance.now();setPad('signal','JETZT!','DRÜCKEN');
}
async function beginAttempt(){
  if(busy||phase!=='START')return;
  busy=true;setPad('waiting','STARTET …','');
  try{
    const data=await rpc('begin_reaction_attempt',{p_session_id:session.session_id});
    attemptToken=data?.attempt_token||null;
    if(!attemptToken)throw new Error('REACTION_ATTEMPT_TOKEN_MISSING');
    phase='WAITING';setPad('waiting','WARTEN','AUF DAS SIGNAL WARTEN');
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
function gamePoints(place,valid=true){
  if(!valid)return 0;
  return [10,5,3,0][Math.max(0,Number(place)-1)]??0;
}
function resultRows(result){
  return [...(result?.standings||[])].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
}
function resultDetail(result,row){
  const pr=Array.isArray(result?.player_results)?result.player_results:[];
  const parts=pr.filter(p=>p.participant_id===row.participant_id);
  if(!parts.length)return '—';
  return parts.map(p=>`${esc(p.display_name||'PLAYER')} · ${fmt(p.best_ms)}`).join(' + ');
}
function rankingRowMarkup(result,row,index){
  const valid=row.aggregate_ms!=null&&Number.isFinite(Number(row.aggregate_ms));
  const pts=gamePoints(row.placement||index+1,valid);
  return `<div class="rxp-ranking-row" data-rx-rank-row style="--rxp-row-delay:${180+index*150}ms">
    <b>${String(Number(row.placement||index+1)).padStart(2,'0')}</b>
    <span class="rxp-ranking-player"><i style="--rxp-player:${colorVar(row.identity_color)}"></i><span><strong>${esc(row.display_name||'TEILNEHMER')}</strong><small>${resultDetail(result,row)}</small></span></span>
    <strong class="rxp-ranking-metric">${valid?fmt(row.aggregate_ms):'DNF'}</strong>
    <span class="rxp-ranking-points"><b>+${pts}</b><small>PTS</small></span>
  </div>`;
}
function renderRanking(result){
  resultOpen=true;phase='RANKING';postgameBusy=false;clearSequence();clearPostgameTimers();
  const rows=resultRows(result);
  root.innerHTML=`<main class="rxp-page rxp-result-page">
    <section class="rxp-result-status"><strong>ERGEBNIS</strong></section>
    <section class="rxp-ranking-card is-revealing">
      <header><strong>FINALES ERGEBNIS</strong><span>${esc(result.difficulty||difficulty())} · WENIGER IST BESSER</span></header>
      <div class="rxp-ranking-columns"><span>POSITION</span><span>NAME</span><span>ZEIT</span><span>PUNKTE</span></div>
      <div class="rxp-ranking-rows">${rows.map((r,i)=>rankingRowMarkup(result,r,i)).join('')}</div>
    </section>
    <button class="rxp-primary" data-rx-ranking-continue type="button">WEITER →</button>
    <div class="rxp-postgame-feedback" data-rx-postgame-feedback aria-live="polite"></div>
  </main>`;
  root.querySelector('[data-rx-ranking-continue]')?.addEventListener('click',()=>void resolveReactionPostgame());
}
function jokerValue(reveal,which){
  const r=reveal?.result||{};
  if(r[which+'_text'])return r[which+'_text'];
  if(r[which]!=null)return String(r[which])+(r.unit?' '+r.unit:'');
  return r.text||'—';
}
function renderJokerResolution(reveal){
  resultOpen=true;phase='JOKER_RESOLUTION';postgameBusy=false;clearPostgameTimers();
  const j=reveal?.joker||{},o=reveal?.owner||{},r=reveal?.result||{};
  root.innerHTML=`<main class="rxp-page rxp-postgame-page">
    <section class="rxp-result-status"><strong>JOKER AUFLÖSUNG</strong></section>
    <section class="rxp-joker-card" style="--rxp-joker-owner:${esc(o.color||colorVar(o.color_key))}">
      <small>${esc(String(j.category||'SECRET').toUpperCase())} JOKER</small>
      <h2>${esc(j.title||j.type||'JOKER')}</h2>
      <p>${esc(j.description||'Der Joker wurde auf das finale Game-Ergebnis angewendet.')}</p>
      <div class="rxp-joker-owner"><i></i><span><small>JOKER GESETZT VON</small><strong>${esc(o.display_name||'TEILNEHMER')}</strong></span></div>
      <div class="rxp-joker-result">
        <small>${esc(r.label||'ERGEBNIS')}</small>
        <strong><span>${esc(jokerValue(reveal,'before'))}</span><b>→</b><span>${esc(jokerValue(reveal,'after'))}</span></strong>
      </div>
    </section>
    <button class="rxp-primary" data-rx-joker-continue type="button">WEITER ZUM TURNIERSTAND →</button>
    <div class="rxp-postgame-feedback" data-rx-postgame-feedback aria-live="polite"></div>
  </main>`;
  root.querySelector('[data-rx-joker-continue]')?.addEventListener('click',()=>void mergeReactionPostgame());
}
function mergeRowMarkup(result,row,merge,index){
  const valid=row.aggregate_ms!=null&&Number.isFinite(Number(row.aggregate_ms));
  const m=merge||{};
  return `<div class="rxp-merge-row" data-rx-merge-row data-participant-id="${esc(row.participant_id)}" data-old-rank="${Number(m.old_rank||index+1)}" data-new-rank="${Number(m.new_rank||index+1)}">
    <div class="rxp-merge-position"><span class="rxp-merge-rank">${Number(row.placement||index+1)}.</span><span class="rxp-movement" data-rx-movement></span></div>
    <span class="rxp-merge-player"><i style="--rxp-player:${colorVar(row.identity_color||m.identity_color)}"></i><strong>${esc(row.display_name||m.display_name||'TEILNEHMER')}</strong></span>
    <div class="rxp-merge-points">
      <span class="rxp-award-value">+${Number(m.added_points||0)}</span>
      <span class="rxp-points-equation"><b>${Number(m.old_points||0)}</b><em>+</em><strong>${Number(m.added_points||0)}</strong></span>
      <span class="rxp-total-value">${Number(m.new_points||0)}</span>
    </div>
    <strong class="rxp-merge-metric">${valid?fmt(row.aggregate_ms):'DNF'}</strong>
  </div>`;
}
function movementMarkup(delta){
  delta=Number(delta||0);
  if(delta>0)return {cls:'up',text:'▲ '+delta};
  if(delta<0)return {cls:'down',text:'▼ '+Math.abs(delta)};
  return {cls:'same',text:'—'};
}
function finalizeMergeUi(run){
  if(run!==postgameAnimationRun)return;
  root?.querySelectorAll('[data-rx-merge-row]').forEach(row=>{
    const rank=Number(row.dataset.newRank||0);
    const oldRank=Number(row.dataset.oldRank||rank);
    const num=row.querySelector('.rxp-merge-rank');if(num)num.textContent=rank+'.';
    const move=movementMarkup(oldRank-rank),el=row.querySelector('[data-rx-movement]');
    if(el){el.textContent=move.text;el.className='rxp-movement '+move.cls+' visible'}
  });
  const close=root?.querySelector('[data-rx-postgame-close]');
  if(close){close.hidden=false;close.disabled=false}
  postgameBusy=false;phase='MERGE_COMPLETE';
}
function reorderMergeRows(run){
  if(run!==postgameAnimationRun)return;
  const host=root?.querySelector('.rxp-merge-rows');if(!host)return;
  const rows=[...host.querySelectorAll('[data-rx-merge-row]')],before=new Map(rows.map(r=>[r,r.getBoundingClientRect().top]));
  rows.sort((a,b)=>Number(a.dataset.newRank)-Number(b.dataset.newRank)).forEach(r=>host.appendChild(r));
  rows.forEach(r=>{const dy=before.get(r)-r.getBoundingClientRect().top;r.style.transition='none';r.style.transform=`translateY(${dy}px)`});
  void host.offsetHeight;
  rows.forEach(r=>{r.style.transition='transform 1520ms cubic-bezier(.2,.85,.2,1)';r.style.transform='translateY(0)'});
  postgameLater(()=>finalizeMergeUi(run),1850);
}
function renderMerge(payload,result,animate=true){
  const rows=resultRows(result),mergeRows=Array.isArray(payload?.rows)?payload.rows:[],byId=new Map(mergeRows.map(r=>[r.participant_id,r]));
  resultOpen=true;phase='MERGE';clearSequence();clearPostgameTimers();
  const run=++postgameAnimationRun;
  root.innerHTML=`<main class="rxp-page rxp-result-page">
    <section class="rxp-result-status"><strong>ERGEBNIS</strong></section>
    <section class="rxp-merge-card ${animate?'is-revealing is-game':'is-tournament is-total'}" data-rx-merge-card>
      <header><strong data-rx-merge-title>${animate?'FINALES ERGEBNIS':'TURNIERSTAND'}</strong><span data-rx-merge-meta>${animate?'GAME ABGESCHLOSSEN':'NACH REACTION'}</span></header>
      <div class="rxp-merge-columns"><span>POSITION</span><span>NAME</span><span>PUNKTE</span><span data-rx-merge-metric-head>ZEIT</span></div>
      <div class="rxp-merge-rows">${rows.map((r,i)=>mergeRowMarkup(result,r,byId.get(r.participant_id),i)).join('')}</div>
    </section>
    <button class="rxp-primary" data-rx-postgame-close type="button" ${animate?'hidden disabled':''}>SPIEL SCHLIESSEN →</button>
    <div class="rxp-postgame-feedback" data-rx-postgame-feedback aria-live="polite"></div>
  </main>`;
  root.querySelector('[data-rx-postgame-close]')?.addEventListener('click',()=>void closeReactionPostgame());
  if(!animate){
    root.querySelectorAll('[data-rx-merge-row]').forEach(row=>{
      const rank=Number(row.dataset.newRank||0),oldRank=Number(row.dataset.oldRank||rank);
      row.querySelector('.rxp-merge-rank').textContent=rank+'.';
      const move=movementMarkup(oldRank-rank),el=row.querySelector('[data-rx-movement]');
      if(el){el.textContent=move.text;el.className='rxp-movement '+move.cls+' visible'}
    });
    const host=root.querySelector('.rxp-merge-rows');
    [...host.children].sort((a,b)=>Number(a.dataset.newRank)-Number(b.dataset.newRank)).forEach(r=>host.appendChild(r));
    postgameBusy=false;phase='MERGE_COMPLETE';return;
  }
  postgameBusy=true;
  postgameLater(()=>{if(run!==postgameAnimationRun)return;root.querySelector('[data-rx-merge-card]')?.classList.add('is-merging')},900);
  postgameLater(()=>{if(run!==postgameAnimationRun)return;root.querySelector('[data-rx-merge-card]')?.classList.add('is-total')},2500);
  postgameLater(()=>{
    if(run!==postgameAnimationRun)return;
    const card=root.querySelector('[data-rx-merge-card]');card?.classList.remove('is-game');card?.classList.add('is-tournament');
    const title=root.querySelector('[data-rx-merge-title]'),meta=root.querySelector('[data-rx-merge-meta]');
    if(title)title.textContent='TURNIERSTAND';if(meta)meta.textContent='NACH REACTION';
    reorderMergeRows(run);
  },4100);
}
function setPostgameFeedback(message){
  const el=root?.querySelector('[data-rx-postgame-feedback]');if(el)el.textContent=String(message||'');
}
async function resolveReactionPostgame(){
  if(postgameBusy||!session?.session_id)return;
  postgameBusy=true;const btn=root?.querySelector('[data-rx-ranking-continue]');if(btn)btn.disabled=true;
  setPostgameFeedback('JOKER WIRD GEPRÜFT …');
  try{
    const data=await rpc('resolve_reaction_postgame_joker',{p_session_id:session.session_id});
    state={...(state||{}),postgame:{...(state?.postgame||{}),phase:data?.phase||'MERGE',joker_resolved:true,joker_reveal:data?.joker_reveal||null}};
    if(data?.phase==='JOKER_RESOLUTION'&&data?.joker_reveal){postgameBusy=false;renderJokerResolution(data.joker_reveal);return}
    postgameBusy=false;await mergeReactionPostgame();
  }catch(err){
    console.warn('Reaction postgame joker',err);postgameBusy=false;if(btn)btn.disabled=false;setPostgameFeedback('JOKER-AUFLÖSUNG KONNTE NICHT ABGESCHLOSSEN WERDEN.');
  }
}
async function mergeReactionPostgame(){
  if(postgameBusy||!session?.session_id)return;
  postgameBusy=true;setPostgameFeedback('TURNIERSTAND WIRD BERECHNET …');
  try{
    const payload=await rpc('merge_reaction_postgame_points',{p_session_id:session.session_id});
    state={...(state||{}),postgame:{...(state?.postgame||{}),phase:'MERGE_COMPLETE',joker_resolved:true,merge_complete:true,merge_payload:payload}};
    renderMerge(payload,state.result||{},true);
  }catch(err){
    console.warn('Reaction postgame merge',err);postgameBusy=false;setPostgameFeedback('TURNIERSTAND KONNTE NICHT ZUSAMMENGEFÜHRT WERDEN.');
  }
}
async function closeReactionPostgame(){
  if(postgameBusy||!state?.postgame?.merge_complete||!session?.session_id)return;
  postgameBusy=true;const btn=root?.querySelector('[data-rx-postgame-close]');if(btn){btn.disabled=true;btn.textContent='WIRD GESCHLOSSEN …'}
  try{
    await rpc('close_reaction_postgame',{p_session_id:session.session_id});
    state={...(state||{}),viewer:{...(state?.viewer||{}),postgame_closed:true}};
    const handled=await window.skielsenBuzzerBridge?.completeReactionPostgame?.(state?.postgame?.merge_payload||null,state?.postgame?.joker_reveal||null);
    if(!handled)window.skielsenInApp?.finishAndExit?.();
  }catch(err){
    console.warn('Reaction postgame close',err);postgameBusy=false;if(btn){btn.disabled=false;btn.textContent='SPIEL SCHLIESSEN →'}setPostgameFeedback('SPIEL KONNTE NICHT GESCHLOSSEN WERDEN.');
  }
}
function renderPostgame(result,postgame={}){
  const p=String(postgame?.phase||'RANKING').toUpperCase();
  if(postgame?.merge_complete||p==='MERGE_COMPLETE'){renderMerge(postgame.merge_payload||{},result,false);return}
  if(p==='JOKER_RESOLUTION'&&postgame?.joker_reveal){renderJokerResolution(postgame.joker_reveal);return}
  if(p==='MERGE'&&postgame?.joker_resolved){renderRanking(result);postgameLater(()=>void mergeReactionPostgame(),0);return}
  renderRanking(result);
}
function renderResult(result){renderPostgame(result,state?.postgame||{phase:'RANKING'})}
function renderFromState(force=false){
  if(!root||!state)return;
  const key=JSON.stringify([state.status,state.difficulty,state.viewer?.attempts,state.players?.map(p=>[p.tournament_member_id,p.status,p.attempt_count]),state.result?.finalized_at,state.postgame?.phase,state.postgame?.joker_resolved,state.postgame?.merge_complete,state.viewer?.postgame_closed]);
  if(!force&&key===lastRenderKey)return;
  lastRenderKey=key;
  if(state.result){ingestResult(state.result);if(postgameBusy)return;renderPostgame(state.result,state.postgame||{});return}
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
  if(!same){phase='START';attemptToken=null;lastRenderKey='';resultOpen=false;postgameBusy=false;clearSequence();clearPostgameTimers()}
  void loadState(true);schedulePoll();
  return true;
}
function updateSession(nextSession){
  session=nextSession||session;
  if(state)state.status=session?.status||state.status;
  void loadState(false);
}
function unmount(){
  clearPolling();clearSequence();clearPostgameTimers();postgameAnimationRun++;
  if(root)root.classList.remove('rxp-root');
  root=null;session=null;db=null;state=null;phase='START';attemptToken=null;signalAt=0;busy=false;postgameBusy=false;lastRenderKey='';resultOpen=false;
}
window.skielsenReaction={mount,updateSession,unmount,get resultOpen(){return resultOpen}};
})();