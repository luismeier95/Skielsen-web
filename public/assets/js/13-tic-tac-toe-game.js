(()=>{
'use strict';

const POLL_MS=450;
const COUNTDOWN_MS=100;
const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const TEAM_MODE_COPY={
  ALTERNATING:{title:'ALTERNATING',copy:'Die Spieler eines Teams wechseln sich nach jedem eigenen Zug ab.'},
  SELECTED_PLAYER:{title:'SELECTED PLAYER',copy:'Jedes Team bestimmt einen Spieler, der den kompletten Match spielt.'},
  SIMULTANEOUS:{title:'SIMULTANEOUS',copy:'Zwei Duelle laufen gleichzeitig. Bei 1:1 entscheidet ein Decider.'}
};

let root=null,session=null,db=null,state=null,pollTimer=0,countdownTimer=0,pollBusy=false,lastSignature='',message='',localTest=null,localBotTimer=0,postgamePhase='RANKING',postgameBusy=false,postgameTimers=[],postgameRun=0,finalResultIngested=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorVar=c=>({BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'})[String(c||'').toUpperCase()]||'var(--theme-accent)';
const uuid=()=>crypto?.randomUUID?.()||('ttt-'+Date.now()+'-'+Math.random().toString(16).slice(2));

function clearTimers(){
  clearInterval(pollTimer);pollTimer=0;
  clearInterval(countdownTimer);countdownTimer=0;
  clearTimeout(localBotTimer);localBotTimer=0;
  postgameTimers.forEach(clearTimeout);postgameTimers=[];postgameRun++;
}
function participantInfo(pid){
  const rows=(state?.players||[]).filter(p=>p.participant_id===pid);
  const first=rows[0]||{};
  return {
    id:pid,
    name:first.team_name||first.display_name||'TEILNEHMER',
    color:first.identity_color||'',
    members:rows
  };
}
function participantIds(){
  return [...new Set((state?.players||[]).map(p=>p.participant_id).filter(Boolean))];
}
function viewerMember(){return state?.viewer?.tournament_member_id||null}
function viewerParticipant(){return state?.viewer?.participant_id||null}
function isAdmin(){return !!state?.viewer?.is_admin}
function lineups(role){
  return (state?.lineups||[]).filter(x=>x.lineup_role===role);
}
function selectedMember(pid,role){
  return lineups(role).find(x=>x.participant_id===pid)?.tournament_member_id||null;
}
function phase(){return String(state?.phase||'WAITING').toUpperCase()}
function variant(){return String(state?.variant||'').toUpperCase()}
function teamMode(){return String(state?.team_mode||'').toUpperCase()}
function setMessage(v){message=String(v||'');const el=root?.querySelector('[data-ttt-feedback]');if(el)el.textContent=message}

async function rpc(name,args){
  if(!db)throw new Error('NO_DATABASE');
  const r=await db.rpc(name,args);
  if(r.error)throw r.error;
  return r.data;
}
async function refresh(force=false){
  if(pollBusy||!session?.session_id||!db)return;
  pollBusy=true;
  try{
    const next=await rpc('get_tic_tac_toe_state',{p_session_id:session.session_id});
    if(!next)return;
    state=next;
    const sig=JSON.stringify([
      state.version,state.status,state.phase,state.team_mode,state.variant,
      state.viewer?.my_subgame,
      state.state?.board_state?.board_move_no,
      state.state?.subgames?.['1']?.board_move_no,
      state.state?.subgames?.['2']?.board_move_no,
      state.state?.decider?.board_move_no,
      state.result?.finalized_at,
      state.result?.tournament_handoff?.finalized,
      state.result?.tournament_handoff?.status,
      (state.lineups||[]).map(x=>[x.lineup_role,x.participant_id,x.tournament_member_id])
    ]);
    if(force||sig!==lastSignature){lastSignature=sig;render()}
    updateCountdown();
  }catch(err){
    console.warn('Tic Tac Toe state',err);
    setMessage('SYNC-FEHLER · '+String(err?.message||err));
  }finally{pollBusy=false}
}
function header(title,meta=''){
  return `<header class="tttp-head"><div><small>SKIELSEN · TIC TAC TOE</small><h1>${esc(title)}</h1></div>${meta?`<strong>${esc(meta)}</strong>`:''}</header>`;
}
function participantBadge(pid){
  const p=participantInfo(pid);
  return `<span class="tttp-participant"><i style="--tttp-team:${colorVar(p.color)}"></i><b>${esc(p.name)}</b></span>`;
}
function renderModeSelection(){
  const options=['ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS'];
  root.innerHTML=`${header('TEAMMODUS','1 / 3')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>WIE SOLL DAS TEAM ANTRETEN?</small><h2>TEAMMODUS WÄHLEN.</h2></section>
      <div class="tttp-choice-grid tttp-mode-grid" style="--game-mode-count:${options.length}">
        ${options.map(k=>`<button type="button" class="tttp-choice" data-team-mode="${k}" ${isAdmin()?'':'disabled'}>
          <strong>${TEAM_MODE_COPY[k].title}</strong><span>${TEAM_MODE_COPY[k].copy}</span>
        </button>`).join('')}
      </div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(isAdmin()?message:'WARTET AUF DIE AUSWAHL DES ADMINS.')}</p>
    </main>`;
  root.querySelectorAll('[data-team-mode]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;setMessage('TEAMMODUS WIRD GESPEICHERT …');
    try{await rpc('set_tic_tac_toe_team_mode',{p_session_id:session.session_id,p_mode:btn.dataset.teamMode});message='';await refresh(true)}
    catch(err){btn.disabled=false;setMessage('FEHLER · '+String(err?.message||err))}
  }));
}
function renderPlayerSelection(selection='MATCH'){
  const pid=viewerParticipant(),own=participantInfo(pid);
  const role=selection==='DECIDER'?'DECIDER':'REPRESENTATIVE';
  const selected=selectedMember(pid,role);
  const everybody=lineups(role);
  const allReady=new Set(everybody.map(x=>x.participant_id)).size===participantIds().length;
  const title=selection==='DECIDER'?'DECIDER':'SPIELERWAHL';
  const kicker=selection==='DECIDER'?'1 : 1 · ENTSCHEIDUNGSSPIEL':'2 / 3';
  root.innerHTML=`${header(title,kicker)}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>${selection==='DECIDER'?'JEDES TEAM BESTIMMT DEN DECIDER':'JEDES TEAM BESTIMMT EINEN SPIELER'}</small><h2>${esc(own.name)}.</h2></section>
      <div class="tttp-player-picks">
        ${own.members.map(m=>`<button type="button" class="tttp-player-pick ${selected===m.tournament_member_id?'is-selected':''}" data-player-pick="${esc(m.tournament_member_id)}">
          <i style="--tttp-team:${colorVar(m.identity_color)}"></i>
          <span><small>${selected===m.tournament_member_id?'AUSGEWÄHLT':'SPIELER'}</small><strong>${esc(m.display_name)}</strong></span>
          <b>${selected===m.tournament_member_id?'✓':'→'}</b>
        </button>`).join('')}
      </div>
      <div class="tttp-team-ready">
        ${participantIds().map(id=>`<div>${participantBadge(id)}<strong>${selectedMember(id,role)?'BEREIT':'WARTET'}</strong></div>`).join('')}
      </div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(message||(allReady?'ALLE TEAMS BEREIT.':'WÄHLE EINEN SPIELER DEINES TEAMS.'))}</p>
    </main>`;
  root.querySelectorAll('[data-player-pick]').forEach(btn=>btn.addEventListener('click',async()=>{
    root.querySelectorAll('[data-player-pick]').forEach(x=>x.disabled=true);
    setMessage('AUSWAHL WIRD GESPEICHERT …');
    try{
      await rpc('select_tic_tac_toe_player',{
        p_session_id:session.session_id,
        p_tournament_member_id:btn.dataset.playerPick,
        p_selection:selection
      });
      message='';await refresh(true);
    }catch(err){
      root.querySelectorAll('[data-player-pick]').forEach(x=>x.disabled=false);
      setMessage('FEHLER · '+String(err?.message||err));
    }
  }));
}
function renderDifficulty(){
  const options=[
    ['NORMAL','Klassisches Tic Tac Toe. Drei eigene Symbole in einer Reihe gewinnen.'],
    ['DISAPPEAR','Beim vierten eigenen Symbol verschwindet das älteste. Maximal drei bleiben aktiv.']
  ];
  root.innerHTML=`${header('SCHWIERIGKEIT','3 / 3')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>SPIELREGEL FESTLEGEN</small><h2>VARIANTE WÄHLEN.</h2></section>
      <div class="tttp-choice-grid tttp-difficulty-grid" style="--difficulty-count:${options.length}">
        ${options.map(([key,copy])=>`<button type="button" class="tttp-choice ${variant()===key?'is-selected':''}" data-variant="${key}" ${isAdmin()?'':'disabled'}>
          <strong>${key}</strong><span>${copy}</span>
        </button>`).join('')}
      </div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(isAdmin()?message:'WARTET AUF DIE AUSWAHL DES ADMINS.')}</p>
    </main>`;
  root.querySelectorAll('[data-variant]').forEach(btn=>btn.addEventListener('click',async()=>{
    root.querySelectorAll('[data-variant]').forEach(x=>{x.disabled=true;x.classList.toggle('is-selected',x===btn)});
    setMessage('SCHWIERIGKEIT WIRD GESPEICHERT …');
    try{await rpc('set_tic_tac_toe_variant',{p_session_id:session.session_id,p_variant:btn.dataset.variant});message='';await refresh(true)}
    catch(err){root.querySelectorAll('[data-variant]').forEach(x=>x.disabled=false);setMessage('FEHLER · '+String(err?.message||err))}
  }));
}
function renderReady(){
  const reps=teamMode()==='SELECTED_PLAYER'?lineups('REPRESENTATIVE'):[];
  root.innerHTML=`${header('MATCH BEREIT','START')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>KONFIGURATION ABGESCHLOSSEN</small><h2>${esc(variant())}.</h2></section>
      <section class="tttp-summary">
        <div><small>TEAMMODUS</small><strong>${esc(teamMode())}</strong></div>
        <div><small>SCHWIERIGKEIT</small><strong>${esc(variant())}</strong></div>
        ${reps.length?`<div class="tttp-summary-wide"><small>GEWÄHLTE SPIELER</small><strong>${esc(reps.map(x=>x.display_name).join(' · '))}</strong></div>`:''}
      </section>
      ${isAdmin()?'<button type="button" class="tttp-primary" data-start-match>MATCH STARTEN →</button>':'<div class="tttp-wait">WARTET AUF MATCH START</div>'}
      <p class="tttp-feedback" data-ttt-feedback>${esc(message)}</p>
    </main>`;
  root.querySelector('[data-start-match]')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;btn.disabled=true;btn.textContent='MATCH WIRD GESTARTET …';setMessage('');
    try{
      const ok=await window.skielsenV15?.startMatch?.();
      if(!ok){
        btn.disabled=false;btn.textContent='MATCH STARTEN →';setMessage('MATCH KANN NOCH NICHT GESTARTET WERDEN.');
        return;
      }
      await rpc('start_tic_tac_toe_match',{p_session_id:session.session_id});
      message='';
      await refresh(true);
    }catch(err){
      btn.disabled=false;btn.textContent='MATCH STARTEN →';setMessage('STARTFEHLER · '+String(err?.message||err));
    }
  });
}
function boardForViewer(){
  const p=phase(),gs=state?.state||{};
  if(p==='PLAYING')return gs.board_state||null;
  if(p==='DECIDER_PLAYING')return gs.decider||null;
  if(p==='PARALLEL_PLAYING'){
    const key=state?.viewer?.my_subgame;
    return key?gs.subgames?.[key]||null:null;
  }
  return null;
}
function symbolFor(board,pid){return board?.symbols?.[pid]||'—'}
function renderBoard(){
  const board=boardForViewer();
  if(!board){
    root.innerHTML=`${header('MATCH LIVE',variant())}<main class="tttp-stage"><div class="tttp-wait">SPIELSTATUS WIRD SYNCHRONISIERT …</div></main>`;
    return;
  }
  const ids=participantIds(),myPid=viewerParticipant(),turnPid=board.current_turn_participant_id,actor=board.current_actor_member_id;
  const myTurn=viewerMember()&&viewerMember()===actor;
  const turnP=participantInfo(turnPid);
  const winning=new Set(board.winning_cells||[]);
  const cells=Array.isArray(board.board)?board.board:Array(9).fill(null);
  const mySymbol=symbolFor(board,myPid);
  const turnSymbol=symbolFor(board,turnPid);
  const decider=phase()==='DECIDER_PLAYING';
  const parallel=phase()==='PARALLEL_PLAYING';
  const nextOut=new Set();
  if(variant()==='DISAPPEAR'&&myPid){
    const q=board.active_mark_order?.[myPid];
    if(Array.isArray(q)&&q.length===3)nextOut.add(Number(q[0]));
  }
  root.innerHTML=`${header(decider?'DECIDER':(parallel?'SIMULTANEOUS':'MATCH LIVE'),variant())}
    <main class="tttp-game">
      <section class="tttp-statusbar">
        <div><small>DU</small><strong>${esc(mySymbol)}</strong></div>
        <div><small>AM ZUG</small><strong>${esc(turnP.name)}</strong></div>
        <div><small>BOARD</small><strong>${esc(board.board_index||1)}</strong></div>
        ${decider?'<div class="tttp-countdown"><small>ZEIT</small><strong data-ttt-countdown>5.0</strong></div>':''}
      </section>
      <section class="tttp-versus">${ids.map(participantBadge).join('<b>VS</b>')}</section>
      <section class="tttp-board" role="grid" aria-label="Tic Tac Toe Spielfeld">
        ${cells.map((pid,i)=>`<button type="button" class="tttp-cell ${winning.has(i)?'is-winning':''} ${nextOut.has(i)?'is-next-out':''}" data-cell="${i}" ${(!myTurn||pid||board.status!=='PLAYING')?'disabled':''}>
          ${pid?`<span style="--tttp-mark:${colorVar(participantInfo(pid).color)}">${esc(symbolFor(board,pid))}</span>`:''}
        </button>`).join('')}
      </section>
      <div class="tttp-turn-note ${myTurn?'is-mine':''}"><i style="--tttp-team:${colorVar(turnP.color)}"></i><strong>${myTurn?'DU BIST DRAN':esc(turnP.name)+' IST DRAN'}</strong><span>${esc(turnSymbol)}</span></div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(message)}</p>
    </main>`;
  root.querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>submitMove(Number(btn.dataset.cell),btn)));
  updateCountdown();
}
async function submitMove(index,btn){
  if(!Number.isInteger(index)||btn.disabled)return;
  root.querySelectorAll('[data-cell]').forEach(x=>x.disabled=true);setMessage('');
  try{
    await rpc('submit_tic_tac_toe_move',{
      p_session_id:session.session_id,
      p_cell_index:index,
      p_client_action_id:uuid()
    });
    await refresh(true);
  }catch(err){
    setMessage('ZUG ABGELEHNT · '+String(err?.message||err));
    await refresh(true);
  }
}
function renderWaiting(){
  root.innerHTML=`${header('WARTET','SYNC')}<main class="tttp-stage"><div class="tttp-wait">MATCH WIRD VORBEREITET …</div><p class="tttp-feedback" data-ttt-feedback>${esc(message)}</p></main>`;
}
function canonicalPostgame(result=state?.result){
  if(localTest?.postgamePayload)return localTest.postgamePayload;
  return window.skielsenBuzzerBridge?.getCanonicalPostgame?.(session?.tournament_game_id,result)||null;
}
function tttJokerAllowed(reveal){return !!reveal&&String(reveal?.joker?.category||'').toUpperCase()!=='ACTION'}
function tttMovement(delta){delta=Number(delta||0);return delta>0?'▲ '+delta:(delta<0?'▼ '+Math.abs(delta):'—')}
function postgameLater(fn,ms){const id=setTimeout(fn,ms);postgameTimers.push(id);return id}
function ensureFinalResultIngested(result){
  if(finalResultIngested||!result?.tournament_handoff?.finalized)return;
  finalResultIngested=!!window.skielsenV15?.ingestInAppGameResult?.(session?.tournament_game_id,result);
}
function renderFinalRanking(result){
  const pg=canonicalPostgame(result),rows=[...(pg?.rows||[])].filter(r=>Number(r.game_placement||0)>0).sort((a,b)=>Number(a.game_placement)-Number(b.game_placement));
  root.innerHTML=`${header('ERGEBNIS',variant())}
    <main class="tttp-stage tttp-result">
      <section class="tttp-result-card tttp-standard-card">
        <header><strong>FINALES ERGEBNIS</strong><span>TIC TAC TOE</span></header>
        <div class="tttp-standard-columns"><span>POSITION</span><span>NAME</span><span>PUNKTE</span><span>ERGEBNIS</span></div>
        ${rows.map((r,i)=>`<div class="tttp-result-row tttp-standard-row" style="--tttp-row-delay:${i*120}ms">
          <b>${Number(r.game_placement||i+1)}.</b>
          <span class="tttp-participant"><i style="--tttp-team:${colorVar(r.identity_color)}"></i><b>${esc(r.display_name||'TEILNEHMER')}</b></span>
          <strong class="tttp-added-points">+${Number(r.added_points||0)}</strong>
          <strong>${Number(r.game_placement)===1?'SIEG':'PLATZ '+Number(r.game_placement||i+1)}</strong>
        </div>`).join('')}
      </section>
      <button type="button" class="tttp-primary" data-ttt-postgame-next>WEITER →</button>
    </main>`;
  root.querySelector('[data-ttt-postgame-next]')?.addEventListener('click',advanceTttPostgame);
}
function renderFinalJoker(result,reveal){
  const j=reveal?.joker||{},o=reveal?.owner||{},r=reveal?.result||{};
  const before=r.before_text??(r.before!=null?String(r.before)+(r.unit?' '+r.unit:''):'—');
  const after=r.after_text??(r.after!=null?String(r.after)+(r.unit?' '+r.unit:''):(r.text||'—'));
  root.innerHTML=`${header('JOKER AUFLÖSUNG',variant())}
    <main class="tttp-stage tttp-result">
      <section class="tttp-joker-card" style="--tttp-joker-owner:${esc(o.color||colorVar(o.color_key))}">
        <small>${esc(String(j.category||'SECRET').toUpperCase())} JOKER</small>
        <h2>${esc(j.title||j.type||'JOKER')}</h2>
        <p>${esc(j.description||'Der Joker wurde auf die finale Wertung angewendet.')}</p>
        <div class="tttp-joker-owner"><i></i><span><small>JOKER GESETZT VON</small><strong>${esc(o.display_name||'TEILNEHMER')}</strong></span></div>
        <div class="tttp-joker-value"><span>${esc(before)}</span><b>→</b><strong>${esc(after)}</strong></div>
      </section>
      <button type="button" class="tttp-primary" data-ttt-postgame-next>WEITER ZUM TURNIERSTAND →</button>
    </main>`;
  root.querySelector('[data-ttt-postgame-next]')?.addEventListener('click',advanceTttPostgame);
}
function renderFinalMerge(result){
  const pg=canonicalPostgame(result),rows=[...(pg?.rows||[])].sort((a,b)=>Number(a.old_rank||999)-Number(b.old_rank||999));
  root.innerHTML=`${header('TURNIERSTAND','NACH TIC TAC TOE')}
    <main class="tttp-stage tttp-result">
      <section class="tttp-result-card tttp-merge-card is-game" data-ttt-merge-card>
        <header><strong>GAME → TURNIER</strong><span>GESAMTRANKING</span></header>
        <div class="tttp-standard-columns tttp-merge-columns"><span>POSITION</span><span>NAME</span><span>PUNKTE</span><span>ERGEBNIS</span></div>
        <div class="tttp-merge-rows">
          ${rows.map((r,i)=>`<div class="tttp-result-row tttp-merge-row" data-ttt-merge-row data-old-rank="${Number(r.old_rank||i+1)}" data-new-rank="${Number(r.new_rank||i+1)}">
            <b><span class="tttp-rank-value">${Number(r.old_rank||i+1)}.</span><small class="tttp-rank-move"></small></b>
            <span class="tttp-participant"><i style="--tttp-team:${colorVar(r.identity_color)}"></i><b>${esc(r.display_name||'TEILNEHMER')}</b></span>
            <strong class="tttp-merge-points"><span class="tttp-award-value">+${Number(r.added_points||0)}</span><span class="tttp-points-equation"><b class="tttp-base-points">${Number(r.old_points||0)}</b><em>+</em><strong class="tttp-award-points">${Number(r.added_points||0)}</strong></span><span class="tttp-total-points">${Number(r.new_points||0)}</span></strong>
            <strong>${Number(r.game_placement)===1?'SIEG':'PLATZ '+Number(r.game_placement||i+1)}</strong>
          </div>`).join('')}
        </div>
      </section>
      <button type="button" class="tttp-primary" data-ttt-postgame-close hidden disabled>SPIEL SCHLIESSEN →</button>
    </main>`;
  animateTttMerge();
  root.querySelector('[data-ttt-postgame-close]')?.addEventListener('click',()=>{
    if(postgameBusy||postgamePhase!=='MERGE_COMPLETE')return;
    const btn=root.querySelector('[data-ttt-postgame-close]');if(btn){btn.disabled=true;btn.textContent='WIRD GESCHLOSSEN …'}
    if(localTest?.onPostgameClose){localTest.onPostgameClose();return}
    const ok=window.skielsenBuzzerBridge?.completeCanonicalInAppPostgame?.(session?.tournament_game_id);
    if(!ok)window.skielsenInApp?.completeAndExit?.();
  });
}
function animateTttMerge(){
  postgameTimers.forEach(clearTimeout);postgameTimers=[];const run=++postgameRun,host=root?.querySelector('.tttp-merge-rows');if(!host)return;
  const rows=[...host.querySelectorAll('[data-ttt-merge-row]')],card=root?.querySelector('[data-ttt-merge-card]');
  postgameBusy=true;
  postgameLater(()=>{if(run!==postgameRun)return;window.skielsenInApp?.launchConfetti?.(root?.querySelector('.tttp-merge-card'),colorVar((canonicalPostgame(state?.result)?.rows||[]).find(r=>Number(r.game_placement)===1)?.identity_color))},350);
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
      const oldRank=Number(r.dataset.oldRank||0),newRank=Number(r.dataset.newRank||oldRank),rv=r.querySelector('.tttp-rank-value'),mv=r.querySelector('.tttp-rank-move');
      if(rv){rv.textContent=newRank+'.';rv.classList.add('is-updating')}
      if(mv){const delta=oldRank-newRank;mv.textContent=tttMovement(delta);mv.className='tttp-rank-move '+(delta>0?'up':delta<0?'down':'same')+' visible'}
    });
  },5340);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    const close=root?.querySelector('[data-ttt-postgame-close]');if(close){close.hidden=false;close.disabled=false}
    postgameBusy=false;postgamePhase='MERGE_COMPLETE';
  },6100);
}
function advanceTttPostgame(){
  if(postgameBusy)return;
  const result=state?.result||{},reveal=canonicalPostgame(result)?.joker_reveal||result?.tournament_handoff?.joker_reveal||null;
  if(postgamePhase==='RANKING'&&tttJokerAllowed(reveal)){postgamePhase='JOKER';renderComplete();return}
  postgamePhase='MERGE';renderComplete();
}
function renderComplete(){
  const result=state?.result||{},handoff=result?.tournament_handoff||{},finalized=!!handoff.finalized;
  if(!finalized){
    const rows=Array.isArray(result.standings)?[...result.standings].sort((a,b)=>Number(a.placement)-Number(b.placement)):[];
    root.innerHTML=`${header('ERGEBNIS',variant())}
      <main class="tttp-stage tttp-result">
        <section class="tttp-result-card">
          <header><strong>FINALES MATCH-ERGEBNIS</strong><span>${esc(result.completion_reason||'WIN')}</span></header>
          ${rows.map(r=>`<div class="tttp-result-row"><b>${Number(r.placement)}.</b>${participantBadge(r.participant_id)}<strong>${Number(r.placement)===1?'SIEG':'NIEDERLAGE'}</strong></div>`).join('')}
        </section>
        <div class="tttp-wait">NÄCHSTES MATCH WIRD VORBEREITET …</div>
      </main>`;
    return;
  }
  ensureFinalResultIngested(result);window.skielsenInApp?.markConcluded?.();
  const reveal=canonicalPostgame(result)?.joker_reveal||handoff.joker_reveal||null;
  if(postgamePhase==='JOKER'&&tttJokerAllowed(reveal)){renderFinalJoker(result,reveal);return}
  if(postgamePhase==='MERGE'||postgamePhase==='MERGE_COMPLETE'){renderFinalMerge(result);return}
  renderFinalRanking(result);
}
function render(){
  if(!root||!state)return;
  const p=phase();
  root.dataset.phase=p;
  if(p==='TEAM_MODE')renderModeSelection();
  else if(p==='PLAYER_SELECTION')renderPlayerSelection('MATCH');
  else if(p==='DIFFICULTY')renderDifficulty();
  else if(p==='READY_TO_START')renderReady();
  else if(p==='PLAYING'||p==='PARALLEL_PLAYING'||p==='DECIDER_PLAYING')renderBoard();
  else if(p==='DECIDER_SELECTION')renderPlayerSelection('DECIDER');
  else if(p==='COMPLETE'||String(state.status).toUpperCase()==='FINISHED')renderComplete();
  else renderWaiting();
}
function updateCountdown(){
  const el=root?.querySelector('[data-ttt-countdown]');
  if(!el)return;
  const deadline=state?.state?.decider?.turn_deadline_at;
  if(!deadline){el.textContent='5.0';return}
  const ms=Math.max(0,new Date(deadline).getTime()-Date.now());
  el.textContent=(ms/1000).toFixed(1);
  el.classList.toggle('is-low',ms<=2000);
}

function localOther(pid){
  if(!localTest)return null;
  return pid===localTest.human.id?localTest.bot.id:localTest.human.id;
}
function localPlayer(pid){
  if(!localTest)return {id:pid,name:'PLAYER',color:''};
  return pid===localTest.human.id?localTest.human:localTest.bot;
}
function localWinningCells(board){
  for(const line of WINS){
    const [a,b,c]=line;
    if(board[a]&&board[a]===board[b]&&board[a]===board[c])return line;
  }
  return [];
}
function localApplyPreview(board,queues,pid,index,mode){
  const next=board.slice(),q=[...(queues[pid]||[])];
  next[index]=pid;q.push(index);
  if(mode==='DISAPPEAR'&&q.length>3){
    const old=q.shift();
    next[old]=null;
  }
  return {board:next,queue:q,win:localWinningCells(next)};
}
function localChooseBotMove(){
  if(!localTest)return null;
  const g=localTest.game,bot=localTest.bot.id,human=localTest.human.id;
  const free=g.board.map((v,i)=>v==null?i:null).filter(Number.isInteger);
  if(!free.length)return null;
  const wins=pid=>free.find(i=>localApplyPreview(g.board,g.active,pid,i,g.mode).win.length);
  const own=wins(bot);if(Number.isInteger(own))return own;
  const block=wins(human);if(Number.isInteger(block))return block;
  if(free.includes(4))return 4;
  const corners=[0,2,6,8].filter(i=>free.includes(i));
  if(corners.length)return corners[(g.movesTotal+corners.length)%corners.length];
  return free[(g.movesTotal+free.length)%free.length];
}
function renderLocalSetup(){
  if(!root||!localTest)return;
  const g=localTest.game;
  root.innerHTML=`${header('SCHWIERIGKEIT','TEST BOT')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>TEST MATCH · ${esc(localTest.human.name)} VS ${esc(localTest.bot.name)}</small><h2>VARIANTE WÄHLEN.</h2></section>
      <div class="tttp-choice-grid">
        <button type="button" class="tttp-choice ${g.mode==='NORMAL'?'is-selected':''}" data-local-variant="NORMAL">
          <strong>NORMAL</strong><span>Klassisches Tic Tac Toe. Drei eigene Symbole in einer Reihe gewinnen.</span>
        </button>
        <button type="button" class="tttp-choice ${g.mode==='DISAPPEAR'?'is-selected':''}" data-local-variant="DISAPPEAR">
          <strong>DISAPPEAR</strong><span>Beim vierten eigenen Symbol verschwindet das älteste. Maximal drei bleiben aktiv.</span>
        </button>
      </div>
      <button type="button" class="tttp-primary" data-local-start>MATCH STARTEN →</button>
      <p class="tttp-feedback">LOKALER TEST-BOT · KEIN ZWEITES GERÄT ERFORDERLICH.</p>
    </main>`;
  root.querySelectorAll('[data-local-variant]').forEach(btn=>btn.addEventListener('click',()=>{
    g.mode=btn.dataset.localVariant==='DISAPPEAR'?'DISAPPEAR':'NORMAL';
    renderLocalSetup();
  }));
  root.querySelector('[data-local-start]')?.addEventListener('click',startLocalBoard);
}
function startLocalBoard(){
  if(!localTest)return;
  clearTimeout(localBotTimer);
  const g=localTest.game;
  g.board=Array(9).fill(null);
  g.active={[localTest.human.id]:[],[localTest.bot.id]:[]};
  g.starter=localTest.human.id;
  g.current=g.starter;
  g.boardIndex=1;
  g.boardMoves=0;
  g.movesTotal=0;
  g.winner=null;
  g.winning=[];
  g.locked=false;
  g.phase='PLAYING';
  renderLocalBoard();
}
function resetLocalBoardAfterDraw(){
  if(!localTest)return;
  const g=localTest.game;
  g.starter=localOther(g.starter);
  g.current=g.starter;
  g.board=Array(9).fill(null);
  g.active={[localTest.human.id]:[],[localTest.bot.id]:[]};
  g.boardIndex+=1;
  g.boardMoves=0;
  g.locked=false;
  renderLocalBoard();
  scheduleLocalBot();
}
function localMove(index,pid){
  if(!localTest)return;
  const g=localTest.game;
  if(g.phase!=='PLAYING'||g.locked||pid!==g.current||!Number.isInteger(index)||index<0||index>8||g.board[index])return;
  g.locked=true;
  const preview=localApplyPreview(g.board,g.active,pid,index,g.mode);
  g.board=preview.board;
  g.active[pid]=preview.queue;
  g.boardMoves+=1;
  g.movesTotal+=1;
  g.winning=preview.win;
  if(g.winning.length){
    g.winner=pid;
    g.phase='RESULT';
    renderLocalBoard();
    localBotTimer=setTimeout(renderLocalResult,500);
    return;
  }
  const full=g.board.every(Boolean);
  if(g.mode==='NORMAL'&&full){
    renderLocalBoard();
    localBotTimer=setTimeout(resetLocalBoardAfterDraw,420);
    return;
  }
  g.current=localOther(pid);
  g.locked=false;
  renderLocalBoard();
  scheduleLocalBot();
}
function scheduleLocalBot(){
  if(!localTest||localTest.game.phase!=='PLAYING'||localTest.game.current!==localTest.bot.id)return;
  clearTimeout(localBotTimer);
  localTest.game.locked=true;
  renderLocalBoard();
  localBotTimer=setTimeout(()=>{
    if(!localTest||localTest.game.phase!=='PLAYING')return;
    localTest.game.locked=false;
    const move=localChooseBotMove();
    if(Number.isInteger(move))localMove(move,localTest.bot.id);
  },520);
}
function renderLocalBoard(){
  if(!root||!localTest)return;
  const g=localTest.game,turn=localPlayer(g.current),humanTurn=g.current===localTest.human.id&&!g.locked;
  const nextOut=new Set();
  if(g.mode==='DISAPPEAR'){
    const q=g.active[localTest.human.id]||[];
    if(q.length===3)nextOut.add(Number(q[0]));
  }
  root.innerHTML=`${header('MATCH LIVE',g.mode)}
    <main class="tttp-game">
      <section class="tttp-statusbar">
        <div><small>DU</small><strong>X</strong></div>
        <div><small>AM ZUG</small><strong>${esc(turn.name)}</strong></div>
        <div><small>BOARD</small><strong>${g.boardIndex}</strong></div>
      </section>
      <section class="tttp-versus">
        <span class="tttp-participant"><i style="--tttp-team:${colorVar(localTest.human.color)}"></i><b>${esc(localTest.human.name)}</b></span>
        <b>VS</b>
        <span class="tttp-participant"><i style="--tttp-team:${colorVar(localTest.bot.color)}"></i><b>${esc(localTest.bot.name)}</b></span>
      </section>
      <section class="tttp-board" role="grid" aria-label="Tic Tac Toe Spielfeld">
        ${g.board.map((pid,i)=>`<button type="button" class="tttp-cell ${g.winning.includes(i)?'is-winning':''} ${nextOut.has(i)?'is-next-out':''}" data-local-cell="${i}" ${(!humanTurn||pid)?'disabled':''}>
          ${pid?`<span style="--tttp-mark:${colorVar(localPlayer(pid).color)}">${pid===localTest.human.id?'X':'O'}</span>`:''}
        </button>`).join('')}
      </section>
      <div class="tttp-turn-note ${humanTurn?'is-mine':''}">
        <i style="--tttp-team:${colorVar(turn.color)}"></i>
        <strong>${humanTurn?'DU BIST DRAN':esc(turn.name)+' IST DRAN'}</strong>
        <span>${g.current===localTest.human.id?'X':'O'}</span>
      </div>
      <p class="tttp-feedback">TEST BOT · ${g.movesTotal} ZÜGE</p>
    </main>`;
  root.querySelectorAll('[data-local-cell]').forEach(btn=>btn.addEventListener('click',()=>localMove(Number(btn.dataset.localCell),localTest.human.id)));
}
function submitLocalResult(){
  if(!localTest||localTest.resultSubmitting)return;
  const done=localTest?.onComplete,winnerId=localTest?.game?.winner;
  if(typeof done!=='function'||!winnerId)return;
  localTest.resultSubmitting=true;
  try{
    const accepted=done(winnerId);
    if(accepted===false)throw new Error('RESULT_HANDOFF_REJECTED');
  }catch(err){
    console.warn('Tic Tac Toe local result handoff',err);
    localTest.resultSubmitting=false;
    const feedback=root?.querySelector('[data-local-result-feedback]');
    if(feedback)feedback.textContent='ERGEBNIS KONNTE NICHT ÜBERNOMMEN WERDEN.';
    const retry=root?.querySelector('[data-local-result-retry]');
    if(retry)retry.hidden=false;
  }
}
function renderLocalResult(){
  if(!root||!localTest)return;
  const g=localTest.game,winner=localPlayer(g.winner),loser=localPlayer(localOther(g.winner));
  root.innerHTML=`${header('ERGEBNIS',g.mode)}
    <main class="tttp-stage tttp-result">
      <section class="tttp-result-card">
        <header><strong>FINALES MATCH-ERGEBNIS</strong><span>${esc(g.mode)} · ${g.boardIndex} BOARD${g.boardIndex===1?'':'S'}</span></header>
        <div class="tttp-result-row"><b>1.</b><span class="tttp-participant"><i style="--tttp-team:${colorVar(winner.color)}"></i><b>${esc(winner.name)}</b></span><strong>SIEG</strong></div>
        <div class="tttp-result-row"><b>2.</b><span class="tttp-participant"><i style="--tttp-team:${colorVar(loser.color)}"></i><b>${esc(loser.name)}</b></span><strong>NIEDERLAGE</strong></div>
      </section>
      <div class="tttp-wait" data-local-result-feedback>ERGEBNIS WIRD ÜBERNOMMEN …</div>
      <button type="button" class="tttp-primary" data-local-result-retry hidden>ERNEUT VERSUCHEN →</button>
    </main>`;
  root.querySelector('[data-local-result-retry]')?.addEventListener('click',submitLocalResult);
  setTimeout(submitLocalResult,320);
}
function showLocalPostgame(config){
  if(!root||!localTest||!config?.result||!config?.payload)return false;
  localTest.postgamePayload=config.payload;
  localTest.onPostgameClose=config.onClose||null;
  state={status:'FINISHED',phase:'COMPLETE',result:config.result};
  postgamePhase='RANKING';postgameBusy=false;finalResultIngested=true;
  renderComplete();
  return true;
}
function mountTestBot(nextRoot,config){
  unmount();
  root=nextRoot;
  const human=config?.human,bot=config?.bot;
  if(!human?.id||!bot?.id)throw new Error('TIC_TAC_TOE_TEST_BOT_CONFIG_INVALID');
  localTest={
    human:{id:human.id,name:human.name||'PLAYER',color:human.color||'RED'},
    bot:{id:bot.id,name:bot.name||'BOT',color:bot.color||'BLUE'},
    onComplete:config?.onComplete,
    resultSubmitting:false,
    game:{mode:'NORMAL',phase:'SETUP',board:[],active:{},starter:null,current:null,boardIndex:1,boardMoves:0,movesTotal:0,winner:null,winning:[],locked:false}
  };
  root.classList.add('tttp-root');
  renderLocalSetup();
}

function mount(nextRoot,nextSession,nextDb){
  unmount();
  root=nextRoot;session=nextSession;db=nextDb;message='';lastSignature='';postgamePhase='RANKING';postgameBusy=false;finalResultIngested=false;
  root.classList.add('tttp-root');
  void refresh(true);
  pollTimer=setInterval(()=>void refresh(false),POLL_MS);
  countdownTimer=setInterval(updateCountdown,COUNTDOWN_MS);
}
function updateSession(next){session=next||session}
function unmount(){
  clearTimers();
  if(root){root.classList.remove('tttp-root');root.innerHTML=''}
  root=null;session=null;db=null;state=null;localTest=null;pollBusy=false;lastSignature='';message='';postgamePhase='RANKING';postgameBusy=false;finalResultIngested=false;
}
window.skielsenTicTacToe={mount,mountTestBot,showLocalPostgame,updateSession,unmount,get state(){return state},get testBot(){return localTest},get resultOpen(){return !!((localTest?.postgamePayload||state?.result?.tournament_handoff?.finalized)&&['RANKING','JOKER','MERGE','MERGE_COMPLETE'].includes(postgamePhase))}};
})();