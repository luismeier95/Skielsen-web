(()=>{
'use strict';

const POLL_MS=450;
const COUNTDOWN_MS=100;
let serverClock=null,clockSamples=[],mountGeneration=0;
const serverNow=()=>serverClock?serverClock.server+performance.now()-serverClock.local:Date.now();
const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const TEAM_MODE_COPY={
  ALTERNATING:{title:'ALTERNATING',copy:'Die Spieler eines Teams wechseln sich nach jedem eigenen Zug ab.'},
  SELECTED_PLAYER:{title:'SELECTED PLAYER',copy:'Jedes Team bestimmt einen Spieler, der den kompletten Match spielt.'},
  SIMULTANEOUS:{title:'SIMULTANEOUS',copy:'Zwei Duelle laufen gleichzeitig. Bei 1:1 entscheidet ein Decider.'}
};

let root=null,session=null,db=null,state=null,pollTimer=0,countdownTimer=0,pollBusy=false,lastSignature='',message='',localTest=null,localBotTimer=0,postgamePhase='RANKING',postgameBusy=false,postgameTimers=[],postgameRun=0,finalResultIngested=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorVar=c=>({BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'})[String(c||'').toUpperCase()]||'var(--theme-accent)';
// randomUUID requires HTTPS; LAN play also needs a valid PostgreSQL UUID.
const uuid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));

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
  const generation=mountGeneration,requestStart=performance.now();
  try{
    const next=await rpc('get_tic_tac_toe_state',{p_session_id:session.session_id});
    if(generation!==mountGeneration)return;
    if(!next)return;
    const received=performance.now(),server=Date.parse(next.server_now);
    if(Number.isFinite(server)){
      clockSamples.push({server:server+(received-requestStart)/2,local:received,rtt:received-requestStart});
      clockSamples=clockSamples.slice(-8);
      serverClock=clockSamples.reduce((a,b)=>a.rtt<b.rtt?a:b);
    }
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
    if(generation!==mountGeneration||!root)return;
    if(!state)renderWaiting();
    console.warn('Tic Tac Toe state',err);
    setMessage('SYNC-FEHLER · '+String(err?.message||err));
  }finally{if(generation===mountGeneration)pollBusy=false}
}
function header(title,meta=''){
  return `<header class="tttp-head"><div><small>SKIELSEN · TIC TAC TOE</small><h1>${esc(title)}</h1></div>${meta?`<strong>${esc(meta)}</strong>`:''}</header>`;
}
function participantBadge(pid){
  const p=participantInfo(pid);
  return `<span class="tttp-participant"><i style="--tttp-team:${colorVar(p.color)}"></i><b style="color:${colorVar(p.color)}">${esc(p.name)}</b></span>`;
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
      <section class="tttp-title"><small>${selection==='DECIDER'?'JEDES TEAM BESTIMMT DEN DECIDER':'JEDES TEAM BESTIMMT EINEN SPIELER'}</small><h2 style="color:${colorVar(own.color)}">${esc(own.name)}.</h2></section>
      <div class="tttp-player-picks">
        ${own.members.map(m=>`<button type="button" class="tttp-player-pick ${selected===m.tournament_member_id?'is-selected':''}" data-player-pick="${esc(m.tournament_member_id)}">
          <i style="--tttp-team:${colorVar(m.identity_color)}"></i>
          <span><small>${selected===m.tournament_member_id?'AUSGEWÄHLT':'SPIELER'}</small><strong style="color:${colorVar(m.identity_color)}">${esc(m.display_name)}</strong></span>
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
    ['NORMAL','Drei eigene Symbole in einer Reihe gewinnen die Runde.'],
    ['DISAPPEAR','Beim vierten eigenen Symbol verschwindet das älteste. Maximal drei bleiben aktiv.']
  ];
  let selectedVariant=variant()||'NORMAL',seconds=Number(state?.turn_seconds||0);
  root.innerHTML=`${header('SPIELEINSTELLUNGEN','3 / 3')}
    <main class="tttp-stage tttp-prestart">
      <section class="tttp-title"><small>4+ RUNDEN PRO DUELL</small><h2>VARIANTE WÄHLEN.</h2></section>
      <div class="tttp-choice-grid tttp-difficulty-grid" style="--difficulty-count:${options.length}">
        ${options.map(([key,copy])=>`<button type="button" class="tttp-choice ${selectedVariant===key?'is-selected':''}" data-variant="${key}" ${isAdmin()?'':'disabled'}>
          <strong>${key}</strong><span>${copy}</span></button>`).join('')}
      </div>
      <div class="tttp-timer-options" aria-label="Zugzeit">
        ${[0,3,5,7].map(n=>`<button type="button" class="tttp-choice ${n===seconds?'is-selected':''}" data-turn-seconds="${n}" ${isAdmin()?'':'disabled'}><strong>${n?n+' SEK.':'AUS'}</strong></button>`).join('')}
      </div>
      ${isAdmin()?'<button type="button" class="tttp-primary" data-save-settings>WEITER →</button>':''}
      <p class="tttp-feedback" data-ttt-feedback>${esc(isAdmin()?message:'WARTET AUF DIE AUSWAHL DES ADMINS.')}</p>
    </main>`;
  root.querySelectorAll('[data-variant]').forEach(btn=>btn.addEventListener('click',()=>{
    selectedVariant=btn.dataset.variant;
    root.querySelectorAll('[data-variant]').forEach(x=>x.classList.toggle('is-selected',x===btn));
  }));
  root.querySelectorAll('[data-turn-seconds]').forEach(btn=>btn.addEventListener('click',()=>{
    seconds=Number(btn.dataset.turnSeconds);
    root.querySelectorAll('[data-turn-seconds]').forEach(x=>x.classList.toggle('is-selected',x===btn));
  }));
  root.querySelector('[data-save-settings]')?.addEventListener('click',async()=>{
    root.querySelectorAll('button').forEach(x=>x.disabled=true);
    try{
      await rpc('set_tic_tac_toe_timer',{p_session_id:session.session_id,p_turn_seconds:seconds});
      await rpc('set_tic_tac_toe_variant',{p_session_id:session.session_id,p_variant:selectedVariant});
      message='';await refresh(true);
    }catch(err){setMessage('FEHLER · '+String(err?.message||err));await refresh(true)}
  });
}
function readyStatus(row){
  return String(row?.status||'').toUpperCase()==='READY';
}
function readyRoster(){
  const teamTournament=String(state?.tournament_mode||'').toUpperCase()==='TEAM';
  return participantIds().map(pid=>{
    const p=participantInfo(pid);
    const members=[...p.members].sort((a,b)=>Number(a.seat||0)-Number(b.seat||0));
    const rows=members.map(m=>{
      const ready=readyStatus(m);
      return `<div class="tttp-ready-member">
        <span class="tttp-ready-name" style="--tttp-team:${colorVar(p.color)}">
          <i></i><b style="color:${colorVar(p.color)}">${esc(m.display_name||p.name)}</b>
        </span>
        <strong class="tttp-ready-state ${ready?'is-ready':'is-waiting'}">${ready?'BEREIT':'WARTET'}</strong>
      </div>`;
    }).join('');
    return `<article class="tttp-ready-team">
      ${teamTournament?`<header><small>TEAM</small><strong style="color:${colorVar(p.color)}">${esc(p.name)}</strong></header>`:''}
      <div class="tttp-ready-members">${rows}</div>
    </article>`;
  }).join('');
}
function readyRules(){
  const selected=teamMode()==='SELECTED_PLAYER'?lineups('REPRESENTATIVE'):[];
  const variantRule=variant()==='DISAPPEAR'
    ? 'Maximal drei eigene Symbole bleiben aktiv. Beim vierten verschwindet das älteste.'
    : 'Klassisch: Drei eigene Symbole in einer Reihe gewinnen.';
  const modeRule=TEAM_MODE_COPY[teamMode()]?.copy
    || 'Die beiden Teilnehmer spielen direkt gegeneinander.';
  const selectedRule=selected.length
    ? `Gewählte Spieler: ${selected.map(x=>`<b style="color:${colorVar(participantInfo(x.participant_id).color)}">${esc(x.display_name)}</b>`).join(' · ')}.`
    : '';
  return [
    ['ZIEL','Drei eigene Symbole horizontal, vertikal oder diagonal in eine Reihe bringen.'],
    ['4+ RUNDEN','Starter wechseln. Sieg als Starter: 1 Matchpunkt, sonst 2. Uneinholbarer Vorsprung beendet das Duell früher.'],
    ['OVERTIME','Gleichstand nach Runde 4: immer zwei weitere Runden. Ein Sieg plus TIE oder zwei Siege entscheiden; geteilte Siege und zwei TIEs verlängern.'],
    ['TIMER '+(Number(state?.turn_seconds)||'AUS'),'Erster Zug jeder Runde ohne Timer. Danach gilt die gewählte Zugzeit. Timeout setzt einen schwachen legalen Zug.'],
    [variant()||'MODUS',variantRule],
    [teamMode()||'SOLO',modeRule],
    ...(selectedRule?[['AUFSTELLUNG',selectedRule,true]]:[])
  ];
}
function renderReady(){
  const players=state?.players||[];
  const allReady=players.length>0&&players.every(readyStatus);
  const mine=players.find(p=>p.tournament_member_id===viewerMember());
  const myReady=!!mine&&readyStatus(mine);
  const rules=readyRules();

  root.innerHTML=`${header('READY','START')}
    <main class="tttp-stage tttp-prestart tttp-ready-page">
      <section class="tttp-title"><small>SPIELERSTATUS</small><h2>ALLE BEREIT?</h2></section>

      <section class="tttp-ready-roster" aria-label="Bereitschaft der Spieler">
        ${readyRoster()}
      </section>

      <section class="tttp-ready-rules" aria-label="Spielregeln">
        <header><small>REGELN</small><strong>${esc(variant())} · ${esc(teamMode()||'SOLO')}</strong></header>
        <div class="tttp-ready-rule-list">
          ${rules.map((r,i)=>`<div class="tttp-ready-rule">
            <b>${String(i+1).padStart(2,'0')}</b>
            <span><strong>${esc(r[0])}</strong><small>${r[2]?r[1]:esc(r[1])}</small></span>
          </div>`).join('')}
        </div>
      </section>

      <div class="tttp-ready-actions ${isAdmin()&&mine?'has-two':''}">
        ${mine?`<button type="button" class="tttp-primary tttp-ready-toggle ${myReady?'is-ready':''}" data-ready-toggle>
          ${myReady?'BEREIT ✓':'ICH BIN BEREIT →'}
        </button>`:''}
        ${isAdmin()
          ?`<button type="button" class="tttp-primary tttp-start-ready" data-start-match ${allReady?'':'disabled'}>
              ${allReady?'MATCH STARTEN →':'WARTET AUF ALLE SPIELER'}
            </button>`
          :`<div class="tttp-wait">${allReady?'ALLE BEREIT · WARTET AUF ADMIN':'WARTET AUF DIE ANDEREN SPIELER'}</div>`}
      </div>
      <p class="tttp-feedback" data-ttt-feedback>${esc(message)}</p>
    </main>`;

  root.querySelector('[data-ready-toggle]')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;
    btn.disabled=true;
    setMessage(myReady?'BEREITSCHAFT WIRD ZURÜCKGESETZT …':'BEREITSCHAFT WIRD GESPEICHERT …');
    try{
      await rpc('set_in_app_game_ready',{p_session_id:session.session_id,p_ready:!myReady});
      message='';
      await refresh(true);
    }catch(err){
      btn.disabled=false;
      setMessage('READY-FEHLER · '+String(err?.message||err));
    }
  });

  root.querySelector('[data-start-match]')?.addEventListener('click',async e=>{
    if(!allReady)return;
    const btn=e.currentTarget;btn.disabled=true;btn.textContent='MATCH WIRD GESTARTET …';setMessage('');
    try{
      const ok=session?.quick_game?true:await window.skielsenV15?.startMatch?.();
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
function markSvg(symbol){
  return symbol==='X'
    ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 8 50 40 82 8 92 18 60 50 92 82 82 92 50 60 18 92 8 82 40 50 8 18Z"/></svg>'
    : '<svg viewBox="0 0 100 100" aria-hidden="true"><path fill-rule="evenodd" d="M50 5a45 45 0 1 0 0 90 45 45 0 0 0 0-90m0 16a29 29 0 1 1 0 58 29 29 0 0 1 0-58"/></svg>';
}
function boardName(board,pid){
  const member=state?.players?.find(p=>p.tournament_member_id===board.actors?.[pid]);
  return teamMode()==='ALTERNATING'?participantInfo(pid).name:member?.display_name||participantInfo(pid).name;
}
function boardOverlay(board){
  const t=board.transition;
  if(!t)return '';
  const pid=t.participant_id;
  const label=t.kind==='START'?'BEGINNT':t.kind==='WIN'?'GEWINNT':t.kind;
  return `<div class="tttp-board-overlay" role="status"><div class="tttp-overlay-card">
    ${['START','WIN'].includes(t.kind)?`<strong style="color:${colorVar(participantInfo(pid).color)}">${esc(boardName(board,pid))}</strong>`:''}
    <span>${esc(label)}</span></div></div>`;
}
function renderBoard(){
  const board=boardForViewer();
  if(!board){
    root.innerHTML=`${header('MATCH LIVE',variant())}<main class="tttp-stage"><div class="tttp-wait">MATCH LIVE · DIE ZUGEWIESENEN SPIELER SPIELEN.</div></main>`;
    return;
  }
  const ids=participantIds(),turnPid=board.current_turn_participant_id;
  const myTurn=viewerMember()===board.current_actor_member_id;
  const cells=Array.isArray(board.board)?board.board:Array(9).fill(null);
  const winning=board.winning_cells||[];
  const round=Number(board.round_number||1),target=round<=4?4:round+(round%2);
  const seconds=Number(board.turn_seconds||0);
  const finished=board.status==='COMPLETE';
  const turnColor=colorVar(participantInfo(turnPid).color);
  const line=winning.length===3?(()=>{
    const start=winning.includes(board.last_move)?board.last_move:winning[0];
    const pos=i=>[(i%3+.5)*100/3,(Math.floor(i/3)+.5)*100/3];
    return `<svg class="tttp-win-line" viewBox="0 0 100 100" aria-hidden="true" style="color:${turnColor}">${winning.filter(i=>i!==start).map(i=>{
      const a=pos(start),b=pos(i);return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    }).join('')}</svg>`;
  })():'';
  root.innerHTML=`<main class="tttp-game tttp-game-v3">
    <section class="tttp-config-bar" aria-label="Matchkonfiguration">
      <strong>4+ RUNDEN</strong><strong>${esc(variant())}</strong><strong>TIMER ${seconds||'AUS'}</strong>
    </section>
    <div class="tttp-round-display">RUNDE ${round}/${target}</div>
    <div class="tttp-match-score" aria-label="Matchpunkte">
      ${ids.map(pid=>`<strong style="color:${colorVar(participantInfo(pid).color)}" title="${esc(boardName(board,pid))}">${Number(board.match_points?.[pid]||0)}</strong>`).join('<span>:</span>')}
    </div>
    <div class="tttp-board-area">
      <div class="tttp-board-stack">
        <div class="tttp-timer-bar is-passive" role="progressbar" aria-label="Verbleibende Zugzeit" aria-valuemin="0" aria-valuemax="${seconds}"><i></i></div>
        <div class="tttp-board-shell" style="--tttp-turn:${turnColor}">
          <section class="tttp-board" role="grid" aria-label="Tic Tac Toe Spielfeld">
          ${cells.map((pid,i)=>{
            const q=board.active_mark_order?.[pid]||[],age=q.indexOf(i);
            const ageClass=variant()==='DISAPPEAR'&&pid?age===q.length-1?'is-newest':age===q.length-2?'is-middle':'is-oldest':'';
            return `<button type="button" class="tttp-cell ${ageClass}" data-cell="${i}" aria-label="${esc('Feld '+(i+1)+(pid?', '+boardName(board,pid)+', '+symbolFor(board,pid):', leer'))}"
              ${(!myTurn||pid||finished||board.transition)?'disabled':''}>
              ${pid?`<span style="--tttp-mark:${colorVar(participantInfo(pid).color)}">${markSvg(symbolFor(board,pid))}</span>`:''}</button>`;
          }).join('')}
          </section>${line}${boardOverlay(board)}
        </div>
        <p class="tttp-live-name" style="color:${turnColor}">${esc(boardName(board,turnPid))}${finished?' · DUELL BEENDET':' · AM ZUG'}</p>
        ${finished?'<p class="tttp-live-wait">WARTET AUF DAS ANDERE DUELL</p>':''}
        <p class="tttp-feedback" data-ttt-feedback>${esc(message)}</p>
      </div>
    </div>
  </main>`;
  root.querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>submitMove(Number(btn.dataset.cell),btn)));
  measureGameViewport();
  updateCountdown();
}
function measureGameViewport(){
  if(!root?.querySelector('.tttp-game-v3'))return;
  const viewport=window.visualViewport;
  const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);
  root.style.setProperty('--tttp-available-height',Math.max(240,bottom-Math.max(root.getBoundingClientRect().top,viewport?.offsetTop||0)-12)+'px');
}
async function submitMove(index,btn){
  if(!Number.isInteger(index)||btn.disabled)return;
  root.querySelectorAll('[data-cell]').forEach(x=>x.disabled=true);setMessage('');
  try{
    await rpc('submit_tic_tac_toe_move',{
      p_session_id:session.session_id,
      p_cell_index:index,
      ...(session?.quick_game?{p_duel:phase()==='DECIDER_PLAYING'?'decider':phase()==='PARALLEL_PLAYING'?state.viewer?.my_subgame:'main'}:{}),
      p_client_action_id:uuid(),
      p_expected_round:Number(boardForViewer()?.round_number),
      p_expected_move:Number(boardForViewer()?.board_move_no)
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
          <span class="tttp-participant"><i style="--tttp-team:${colorVar(r.identity_color)}"></i><b style="color:${colorVar(r.identity_color)}">${esc(r.display_name||'TEILNEHMER')}</b></span>
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
        <div class="tttp-joker-owner"><i></i><span><small>JOKER GESETZT VON</small><strong style="color:var(--tttp-joker-owner)">${esc(o.display_name||'TEILNEHMER')}</strong></span></div>
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
            <span class="tttp-participant"><i style="--tttp-team:${colorVar(r.identity_color)}"></i><b style="color:${colorVar(r.identity_color)}">${esc(r.display_name||'TEILNEHMER')}</b></span>
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
  if(session?.quick_game){renderQuickResult();return}
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
function renderQuickResult(){
  const result=state?.result||{},rows=[...(result.standings||[])].sort((a,b)=>a.rank-b.rank);
  const duels=result.duel_results||{};
  const boards=[['DUELL',duels.main],['DUELL 1',duels.subgames?.['1']],['DUELL 2',duels.subgames?.['2']],['DECIDER',duels.decider]].filter(([,b])=>b);
  root.innerHTML=`${header('ERGEBNIS','QUICK GAMES')}<main class="tttp-stage tttp-result">
    <section class="tttp-result-card" aria-label="Spielranking">
      <header><strong>RANKING</strong><span>${esc(variant())}</span></header>
      ${rows.map(r=>`<div class="tttp-result-row"><b>${Number(r.rank)}.</b>${participantBadge(r.participant_id)}<strong>${r.rank===1?'SIEG':'NIEDERLAGE'}</strong></div>`).join('')}
    </section>
    ${boards.map(([name,b])=>`<section class="tttp-result-card" aria-label="${name} Matchpunkte">
      <header><strong>${name} · MATCHPUNKTE</strong><span>${(b.round_results||[]).length} RUNDEN</span></header>
      ${participantIds().map(pid=>`<div class="tttp-result-row"><b></b>${participantBadge(pid)}<strong>${Number(b.match_points?.[pid]||0)}</strong></div>`).join('')}
    </section>`).join('')}
    <button class="tttp-primary" type="button" data-quick-exit>ZURÜCK ZU QUICK GAMES →</button>
  </main>`;
  root.querySelector('[data-quick-exit]').addEventListener('click',()=>session.onQuickExit?.());
  clearInterval(pollTimer);pollTimer=0;
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
  const el=root?.querySelector('.tttp-timer-bar');
  if(!el)return;
  const board=boardForViewer(),seconds=Number(board?.turn_seconds||0);
  const deadline=Date.parse(board?.turn_deadline_at);
  const active=seconds>0&&Number.isFinite(deadline)&&!board?.transition&&board?.status==='PLAYING';
  el.classList.toggle('is-passive',!active);
  const left=active?Math.max(0,deadline-serverNow())/1000:seconds;
  el.querySelector('i').style.transform='scaleX('+(seconds?Math.min(1,left/seconds):1)+')';
  el.setAttribute('aria-valuenow',left.toFixed(1));
  el.classList.toggle('tttp-timer-warning',active&&left<=Math.min(2.5,seconds*.4)&&left>1);
  el.classList.toggle('tttp-timer-danger',active&&left<=1);
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
  document.addEventListener('visibilitychange',refreshOnVisible);
  window.addEventListener('resize',measureGameViewport);
  window.visualViewport?.addEventListener('resize',measureGameViewport);
}
function refreshOnVisible(){if(!document.hidden)void refresh(true)}
function updateSession(next){session=next||session}
function unmount(){
  mountGeneration++;serverClock=null;clockSamples=[];
  document.removeEventListener('visibilitychange',refreshOnVisible);
  window.removeEventListener('resize',measureGameViewport);
  window.visualViewport?.removeEventListener('resize',measureGameViewport);
  clearTimers();
  if(root){root.classList.remove('tttp-root');root.innerHTML=''}
  root=null;session=null;db=null;state=null;localTest=null;pollBusy=false;lastSignature='';message='';postgamePhase='RANKING';postgameBusy=false;finalResultIngested=false;
}
window.skielsenTicTacToe={mount,mountTestBot,showLocalPostgame,updateSession,unmount,get state(){return state},get testBot(){return localTest},get resultOpen(){return !!((localTest?.postgamePayload||state?.result?.tournament_handoff?.finalized)&&['RANKING','JOKER','MERGE','MERGE_COMPLETE'].includes(postgamePhase))}};
})();
