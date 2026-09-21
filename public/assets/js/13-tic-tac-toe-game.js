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

let root=null,session=null,db=null,state=null,pollTimer=0,countdownTimer=0,pollBusy=false,lastSignature='',message='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorVar=c=>({BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'})[String(c||'').toUpperCase()]||'var(--theme-accent)';
const uuid=()=>crypto?.randomUUID?.()||('ttt-'+Date.now()+'-'+Math.random().toString(16).slice(2));

function clearTimers(){
  clearInterval(pollTimer);pollTimer=0;
  clearInterval(countdownTimer);countdownTimer=0;
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
      <div class="tttp-choice-grid tttp-mode-grid">
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
  root.innerHTML=`${header('SCHWIERIGKEIT','3 / 3')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>SPIELREGEL FESTLEGEN</small><h2>VARIANTE WÄHLEN.</h2></section>
      <div class="tttp-choice-grid">
        <button type="button" class="tttp-choice" data-variant="NORMAL" ${isAdmin()?'':'disabled'}>
          <strong>NORMAL</strong><span>Klassisches Tic Tac Toe. Drei eigene Symbole in einer Reihe gewinnen.</span>
        </button>
        <button type="button" class="tttp-choice" data-variant="DISAPPEAR" ${isAdmin()?'':'disabled'}>
          <strong>DISAPPEAR</strong><span>Beim vierten eigenen Symbol verschwindet das älteste. Maximal drei bleiben aktiv.</span>
        </button>
      </div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(isAdmin()?message:'WARTET AUF DIE AUSWAHL DES ADMINS.')}</p>
    </main>`;
  root.querySelectorAll('[data-variant]').forEach(btn=>btn.addEventListener('click',async()=>{
    root.querySelectorAll('[data-variant]').forEach(x=>x.disabled=true);
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
function renderComplete(){
  const result=state?.result||{},rows=Array.isArray(result.standings)?[...result.standings].sort((a,b)=>Number(a.placement)-Number(b.placement)):[];
  root.innerHTML=`${header('ERGEBNIS',variant())}
    <main class="tttp-stage tttp-result">
      <section class="tttp-result-card">
        <header><strong>FINALES MATCH-ERGEBNIS</strong><span>${esc(result.completion_reason||'WIN')}</span></header>
        ${rows.map(r=>`<div class="tttp-result-row"><b>${Number(r.placement)}.</b>${participantBadge(r.participant_id)}<strong>${Number(r.placement)===1?'SIEG':'NIEDERLAGE'}</strong></div>`).join('')}
      </section>
      <div class="tttp-wait">ERGEBNIS WIRD AN DAS TURNIER ÜBERGEBEN …</div>
    </main>`;
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
function mount(nextRoot,nextSession,nextDb){
  unmount();
  root=nextRoot;session=nextSession;db=nextDb;message='';lastSignature='';
  root.classList.add('tttp-root');
  void refresh(true);
  pollTimer=setInterval(()=>void refresh(false),POLL_MS);
  countdownTimer=setInterval(updateCountdown,COUNTDOWN_MS);
}
function updateSession(next){session=next||session}
function unmount(){
  clearTimers();
  if(root){root.classList.remove('tttp-root');root.innerHTML=''}
  root=null;session=null;db=null;state=null;pollBusy=false;lastSignature='';message='';
}
window.skielsenTicTacToe={mount,updateSession,unmount,get state(){return state}};
})();