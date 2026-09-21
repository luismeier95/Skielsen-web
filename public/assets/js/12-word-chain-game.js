(()=>{
'use strict';

const VERSION=window.SKIELSEN_VERSION||'15.1.81';
const POLL_MS=1600;
const DIFFICULTIES={
  EASY:{threshold:50,showWordLength:true},
  NORMAL:{threshold:35,showWordLength:false},
  HARDCORE:{threshold:15,showWordLength:false}
};
const COLOR_VAR={
  RED:'var(--core-red)',
  BLUE:'var(--core-blue)',
  GREEN:'var(--core-green)',
  YELLOW:'var(--core-yellow)'
};

let root=null,session=null,db=null,state=null;
let pollTimer=0,tickTimer=0,busy=false,serverOffsetMs=0,lastTimeoutDeadline=null;
let resultIngested=false,finalResult=null,pendingTier='NORMAL';
let inputBuffer='',acceptedBuffer='',lastWordKey='';

const q=sel=>root?.querySelector(sel)||null;
const qa=sel=>root?[...root.querySelectorAll(sel)]:[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'').toLocaleUpperCase('de-DE');

async function rpc(name,args={}){
  if(!db)throw new Error('WORD_CHAIN_DB_NOT_READY');
  const {data,error}=await db.rpc(name,args);
  if(error)throw error;
  return data;
}
function isAdmin(){
  return !!(window.skielsenV15?.runtime?.is_admin||window.skielsenV15?.state?.is_admin);
}
function publicState(){
  return session?.public_state||{};
}
function difficultyRequired(){
  // V4 production contract: every Word Chain In-App session must pass the
  // session-wide difficulty gate before any player run can be created.
  // Do not fall back to legacy NORMAL when older/missing public_state flags
  // reach the current client; the admin must explicitly choose a tier.
  return true;
}
function selectedDifficulty(){
  const value=String(publicState()?.word_chain_difficulty||state?.difficulty||'').toUpperCase();
  return DIFFICULTIES[value]?value:'';
}
function colorVar(value){
  return COLOR_VAR[String(value||'').toUpperCase()]||'var(--theme-muted)';
}
function feedback(text,kind=''){
  const el=q('[data-wc-feedback]');
  if(!el)return;
  el.textContent=text||'';
  el.className='wc-feedback'+(kind?' '+kind:'');
}
function formatDuration(ms){
  if(ms==null||!Number.isFinite(Number(ms)))return '–';
  const totalCs=Math.max(0,Math.floor(Number(ms)/10));
  const m=Math.floor(totalCs/6000);
  const s=Math.floor((totalCs%6000)/100);
  const cs=totalCs%100;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+':'+String(cs).padStart(2,'0');
}
function shell(){
  return `<div class="wc-game">
    <section class="wc-page wc-setup-page" data-wc-page="setup" hidden></section>

    <section class="wc-page wc-play-page" data-wc-page="play" hidden>
      <div class="wc-game-progress" aria-hidden="true"><i data-wc-game-progress></i></div>
      <main class="wc-play-main">
        <section class="wc-status" aria-label="Spielstatus">
          <div><small>SCHRITT</small><strong data-wc-step>01 / 10</strong></div>
          <div><small>PUNKTE</small><strong data-wc-score>0</strong></div>
          <div><small>ZEIT</small><strong data-wc-time>—</strong></div>
        </section>
        <div class="wc-word-timer" aria-hidden="true"><i data-wc-word-timer></i></div>

        <section class="wc-chain" data-wc-chain>
          <small>DEINE KETTE</small>
          <div data-wc-chain-content>—</div>
        </section>

        <section class="wc-puzzle">
          <div class="wc-base">
            <small>AUSGANGSWORT</small>
            <strong data-wc-base>—</strong>
          </div>
          <div class="wc-plus" aria-hidden="true">+</div>
          <div class="wc-answer">
            <small>GESUCHTES NOMEN</small>
            <input class="wc-native-input" data-wc-input type="text" inputmode="text" enterkeyhint="go"
              autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Worteingabe">
            <div class="wc-slots" data-wc-slots></div>
          </div>
          <div class="wc-feedback" data-wc-feedback aria-live="polite"></div>
        </section>
      </main>
    </section>

    <section class="wc-page wc-result-page" data-wc-page="result" hidden>
      <div class="wc-game-progress is-complete" aria-hidden="true"><i></i></div>
      <main class="wc-result-main">
        <section class="wc-result-status"><strong>ERGEBNIS</strong></section>
        <section class="wc-result-card">
          <header><strong data-wc-result-title>FINALES ERGEBNIS</strong><span data-wc-result-meta>—</span></header>
          <div class="wc-result-columns"><span>POSITION</span><span>NAME</span><span>ZEIT</span><span>SCORE</span></div>
          <div class="wc-result-rows" data-wc-result-rows></div>
        </section>
        <button class="wc-result-primary" type="button" data-wc-finish hidden>TURNIER ANSEHEN →</button>
      </main>
    </section>
  </div>`;
}
function showPage(name){
  qa('[data-wc-page]').forEach(el=>{el.hidden=el.dataset.wcPage!==name});
  root?.classList.toggle('wc-result-open',name==='result');
  root?.classList.toggle('wc-setup-open',name==='setup');
}
function difficultyMarkup(){
  const admin=isAdmin();
  return `<main class="wc-setup-main">
    <section class="wc-setup-hero"><h1>WORT<br>KETTE.</h1></section>
    <section class="wc-setup-card">
      <small>MODUS</small>
      <div class="wc-difficulty" data-wc-difficulty>
        ${['EASY','NORMAL','HARDCORE'].map(t=>`<button type="button" data-wc-tier="${t}" class="${pendingTier===t?'active':''}" ${admin?'':'disabled'}>
          <b>${t}</b><span>THRESHOLD ${DIFFICULTIES[t].threshold}</span>
        </button>`).join('')}
      </div>
    </section>
    ${admin
      ?'<button class="wc-start" type="button" data-wc-start>SPIEL STARTEN →</button>'
      :'<div class="wc-setup-wait"><strong>ADMIN WÄHLT DEN SCHWIERIGKEITSGRAD</strong><span>Das Spiel startet danach automatisch auf diesem Gerät.</span></div>'}
    <div class="wc-setup-feedback" data-wc-setup-feedback></div>
  </main>`;
}
function renderDifficulty(){
  showPage('setup');
  const page=q('[data-wc-page="setup"]');
  if(!page)return;
  page.innerHTML=difficultyMarkup();
  page.querySelectorAll('[data-wc-tier]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!isAdmin()||busy)return;
    pendingTier=btn.dataset.wcTier;
    page.querySelectorAll('[data-wc-tier]').forEach(other=>other.classList.toggle('active',other===btn));
  }));
  page.querySelector('[data-wc-start]')?.addEventListener('click',()=>void setDifficulty());
}
async function setDifficulty(){
  if(!isAdmin()||busy||!session?.session_id)return;
  busy=true;
  const msg=q('[data-wc-setup-feedback]');
  if(msg)msg.textContent='MODUS WIRD GESPEICHERT …';
  try{
    const data=await rpc('set_word_chain_difficulty',{p_session_id:session.session_id,p_tier:pendingTier});
    session.public_state={
      ...(session.public_state||{}),
      difficulty_required:true,
      word_chain_difficulty:data?.difficulty||pendingTier,
      occurrence_threshold:data?.occurrence_threshold??DIFFICULTIES[pendingTier].threshold,
      show_word_length:data?.show_word_length??DIFFICULTIES[pendingTier].showWordLength,
      word_chain_rules_version:data?.rules_version||4
    };
    busy=false;
    await loadState(true);
    window.skielsenInApp?.poll?.();
    return true;
  }catch(err){
    console.warn('Wortkette difficulty',err);
    if(msg)msg.textContent='MODUS KONNTE NICHT GESPEICHERT WERDEN.';
    return false;
  }finally{busy=false}
}
function chainHtml(words){
  const list=Array.isArray(words)?words:[];
  return list.map((w,i)=>'<span>'+esc(w)+'</span>'+(i<list.length-1?'<b>→</b>':'')).join('')||'—';
}
function normalizedInput(){
  let value=clean(inputBuffer);
  const prefix=clean(state?.revealed_prefix||'');
  if(state?.ignore_repeated_initial&&prefix.length===1&&value.startsWith(prefix))value=value.slice(1);
  return value;
}
function slotHtml(ch,cls,label){
  return `<span class="wc-slot ${cls}" aria-label="${esc(label)}">${ch?esc(ch):''}</span>`;
}
function renderSlots(){
  const wrap=q('[data-wc-slots]');
  if(!wrap||!state||state.completed)return;
  const prefix=clean(state.revealed_prefix||'');
  const initialCount=Math.max(0,Number(state.initial_revealed_count??1));
  const typed=String(acceptedBuffer||normalizedInput());
  const showLength=!!state.show_word_length;
  const targetLength=Number(state.target_length||0);
  const parts=[];

  [...prefix].forEach((ch,i)=>{
    parts.push(slotHtml(ch,i<initialCount?'is-initial':'is-hint',''+(i<initialCount?'Startbuchstabe ':'Hinweis ')+ch));
  });
  [...typed].forEach(ch=>parts.push(slotHtml(ch,'is-typed','Eingegeben '+ch)));

  if(showLength&&targetLength>0){
    const empty=Math.max(0,targetLength-prefix.length-typed.length);
    for(let i=0;i<empty;i++)parts.push(slotHtml('','is-empty','Verborgen'));
  }else if(!typed&&!acceptedBuffer){
    parts.push(slotHtml('','is-next','Nächste Eingabeposition'));
  }

  wrap.innerHTML=parts.join('');
  fitSlots();
}
function fitSlots(){
  const wrap=q('[data-wc-slots]');
  if(!wrap)return;
  const count=Math.max(1,wrap.children.length);
  const width=Math.max(1,wrap.clientWidth||560);
  const gap=window.matchMedia('(max-width:720px)').matches?4:6;
  const max=window.matchMedia('(max-width:720px)').matches?30:38;
  const size=Math.max(15,Math.min(max,Math.floor((width-gap*(count-1))/count)));
  wrap.style.setProperty('--wc-slot-size',size+'px');
  wrap.style.setProperty('--wc-slot-font',Math.max(12,Math.floor(size*.68))+'px');
}
function fitBase(){
  const el=q('[data-wc-base]');
  if(!el)return;
  const max=window.matchMedia('(max-width:720px)').matches?44:58;
  const min=22;
  let size=max;
  el.style.fontSize=size+'px';
  while(el.scrollWidth>el.clientWidth&&size>min){
    size--;
    el.style.fontSize=size+'px';
  }
}
function renderPlay(next,{clearInput=false}={}){
  const enteringPlay=!!q('[data-wc-page="play"]')?.hidden;
  state=next;
  showPage('play');
  if(clearInput){inputBuffer='';acceptedBuffer='';syncInput()}
  const step=Math.max(1,Number(state.step||1));
  const total=Math.max(1,Number(state.total_steps||10));
  q('[data-wc-step]').textContent=String(step).padStart(2,'0')+' / '+String(total).padStart(2,'0');
  q('[data-wc-score]').textContent=String(state.score??0);
  q('[data-wc-base]').textContent=state.base_word||'—';
  q('[data-wc-chain-content]').innerHTML=chainHtml(state.solved_words);
  const progress=q('[data-wc-game-progress]');
  if(progress)progress.style.width=Math.max(0,Math.min(100,(step/total)*100))+'%';

  const wordKey=String(state.step)+'|'+String(state.revealed_prefix||'');
  if(wordKey!==lastWordKey&&lastWordKey){inputBuffer='';acceptedBuffer='';syncInput()}
  lastWordKey=wordKey;
  renderSlots();
  requestAnimationFrame(()=>{fitBase();fitSlots()});
  tick();
  if(enteringPlay)setTimeout(focusInput,60);
}
function syncClock(next){
  const server=Date.parse(next?.server_now||'');
  if(Number.isFinite(server))serverOffsetMs=server-Date.now();
  if(next?.deadline_at!==state?.deadline_at)lastTimeoutDeadline=null;
}
function syncInput(){
  const input=q('[data-wc-input]');
  if(input&&input.value!==inputBuffer)input.value=inputBuffer;
}
function focusInput(){
  const input=q('[data-wc-input]');
  if(!input||state?.completed)return;
  try{
    input.focus({preventScroll:true});
    const n=input.value.length;
    input.setSelectionRange?.(n,n);
  }catch(_){}
}
function onInput(){
  if(!state||state.completed||busy)return;
  const input=q('[data-wc-input]');
  let value=clean(input?.value||'').slice(0,32);
  const prefix=clean(state.revealed_prefix||'');
  if(state.ignore_repeated_initial&&prefix.length===1&&value.startsWith(prefix))value=value.slice(1);
  inputBuffer=value;
  acceptedBuffer='';
  if(input&&input.value!==value)input.value=value;
  renderSlots();
  feedback('');
}
async function submit(timeout=false){
  if(!state||state.completed||busy)return;
  const prefix=clean(state.revealed_prefix||'');
  const tail=normalizedInput();
  if(!timeout&&!tail){
    feedback('WORT EINGEBEN · MIT ENTER BESTÄTIGEN','hint');
    focusInput();
    return;
  }

  busy=true;
  const guess=timeout?'':prefix+tail;
  try{
    const next=await rpc('submit_word_chain_tournament',{
      p_in_app_session_id:session.session_id,
      p_guess:guess,
      p_timeout:!!timeout
    });
    syncClock(next);

    if(next?.accepted_attempt===false){
      inputBuffer='';acceptedBuffer='';syncInput();
      renderPlay(next,{clearInput:true});
      feedback(next.validation_unavailable?'WORTPRÜFUNG NICHT VERFÜGBAR · VERSUCH NICHT GEWERTET.':'KEIN GÜLTIGES WORT · VERSUCH NICHT GEWERTET.','hint');
    }else if(next?.correct){
      inputBuffer='';acceptedBuffer='';
      renderPlay(next,{clearInput:true});
      feedback('');
    }else if(next?.auto_completed){
      inputBuffer='';acceptedBuffer='';
      renderPlay(next,{clearInput:true});
      feedback('');
    }else if(next?.timeout||next?.timeout_applied){
      inputBuffer='';acceptedBuffer='';
      renderPlay(next,{clearInput:true});
      feedback('');
    }else{
      inputBuffer='';acceptedBuffer='';
      renderPlay(next,{clearInput:true});
      feedback('');
    }

    if(next?.tournament_complete&&next?.tournament_result){
      finalResult=next.tournament_result;
      ingestResult(finalResult);
      renderResult(finalResult);
    }else if(next?.completed){
      state=next;
      await loadResult();
    }
  }catch(err){
    console.warn('Wortkette submit',err);
    feedback('EINGABE KONNTE NICHT VERARBEITET WERDEN.','bad');
  }finally{
    busy=false;
  }
}
function tick(){
  if(!root||!state||state.completed)return;
  const end=Date.parse(state.deadline_at||'');
  if(!Number.isFinite(end))return;
  const now=Date.now()+serverOffsetMs;
  const ms=Math.max(0,end-now);
  const limit=Math.max(1,Number(state.time_limit_seconds||15))*1000;
  const seconds=Math.max(0,Math.ceil(ms/1000));
  const time=q('[data-wc-time]');
  if(time)time.textContent=String(seconds);
  time?.classList.toggle('urgent',ms>0&&ms<=5000);
  const timer=q('[data-wc-word-timer]');
  if(timer)timer.style.width=Math.max(0,Math.min(100,ms/limit*100))+'%';
  timer?.parentElement?.classList.toggle('urgent',ms>0&&ms<=5000);
  if(ms<=0&&!busy&&lastTimeoutDeadline!==state.deadline_at){
    lastTimeoutDeadline=state.deadline_at;
    void submit(true);
  }
}
function resultRowsHtml(rows){
  const list=Array.isArray(rows)?rows:[];
  return list.map(row=>`<div class="wc-result-row">
    <b>${esc(row.placement||'—')}.</b>
    <span><i style="--wc-player:${colorVar(row.identity_color)}"></i><strong>${esc(row.display_name||'PLAYER')}</strong></span>
    <strong>${formatDuration(row.duration_ms)}</strong>
    <strong>${Number(row.score??0)>0?'+':''}${esc(row.score??0)}</strong>
  </div>`).join('');
}
function liveResultRowsHtml(rows){
  const list=Array.isArray(rows)?rows:[];
  return list.map(row=>{
    const done=!!row.completed;
    const rank=done&&row.rank!=null?String(row.rank)+'.':'';
    const time=done?formatDuration(row.elapsed_ms):'–';
    const score=done?(Number(row.score??0)>0?'+':'')+String(row.score??0):'–';
    return `<div class="wc-result-row ${done?'is-complete':'is-pending'}">
      <b>${esc(rank)}</b>
      <span><i style="--wc-player:${colorVar(row.identity_color)}"></i><strong>${esc(row.display_name||'PLAYER')}</strong></span>
      <strong>${esc(time)}</strong>
      <strong>${esc(score)}</strong>
    </div>`;
  }).join('');
}
function renderResult(result){
  finalResult=result||finalResult;
  showPage('result');
  const rows=Array.isArray(finalResult?.standings)?finalResult.standings:[];
  const meta=q('[data-wc-result-meta]');
  if(meta)meta.textContent=rows.length?rows.length+' PARTICIPANTS':'ERGEBNIS WIRD GELADEN';
  const host=q('[data-wc-result-rows]');
  if(host)host.innerHTML=rows.length?resultRowsHtml(rows):'<div class="wc-result-wait">ERGEBNIS WIRD GELADEN …</div>';
  const finish=q('[data-wc-finish]');
  if(finish)finish.hidden=!rows.length;
}
function renderResultWaiting(nextState=state){
  state=nextState||state;
  showPage('result');
  const finished=Number(state?.finished_players||0),total=Number(state?.total_players||0);
  const rows=Array.isArray(state?.live_standings)?state.live_standings:[];
  const meta=q('[data-wc-result-meta]');
  if(meta)meta.textContent=`${finished} / ${total} FERTIG`;
  const host=q('[data-wc-result-rows]');
  if(host){
    host.innerHTML=rows.length
      ?liveResultRowsHtml(rows)
      :'<div class="wc-result-wait">LIVE-TABELLE WIRD GELADEN …</div>';
  }
  const finish=q('[data-wc-finish]');
  if(finish)finish.hidden=true;
}
function ingestResult(result){
  if(resultIngested||!result)return;
  resultIngested=true;
  window.skielsenV15?.ingestInAppGameResult?.(session?.tournament_game_id,result);
}
async function loadResult(){
  if(!session?.tournament_game_id)return;
  renderResultWaiting(state);
  try{
    const data=await rpc('get_word_chain_game_result',{p_tournament_game_id:session.tournament_game_id});
    const result=data?.result||null;
    if(result){
      finalResult=result;
      ingestResult(result);
      renderResult(result);
    }
  }catch(err){console.warn('Wortkette result',err)}
}
async function loadState(initial=false){
  if(!session?.session_id||busy)return;
  if(difficultyRequired()&&!selectedDifficulty()){
    renderDifficulty();
    return;
  }
  try{
    const next=await rpc(initial?'start_word_chain_tournament_player':'get_word_chain_tournament_state',{
      p_in_app_session_id:session.session_id
    });
    if(next?.requires_difficulty){
      renderDifficulty();
      return;
    }
    syncClock(next);
    state=next;
    if(next?.completed){
      renderResultWaiting(next);
      const finished=Number(next?.finished_players||0);
      const total=Number(next?.total_players||0);
      if(total>0&&finished>=total)await loadResult();
      return;
    }
    renderPlay(next);
  }catch(err){
    console.warn('Wortkette state',err);
    feedback('SPIELSTAND KONNTE NICHT GELADEN WERDEN.','bad');
  }
}
function bind(){
  q('[data-wc-input]')?.addEventListener('beforeinput',e=>{if(busy)e.preventDefault()});
  q('[data-wc-input]')?.addEventListener('input',onInput);
  q('[data-wc-input]')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();void submit(false)}
  });
  q('.wc-puzzle')?.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    setTimeout(focusInput,0);
  });
  q('[data-wc-finish]')?.addEventListener('click',()=>window.skielsenInApp?.finishAndExit?.());
  window.addEventListener('resize',onResize);
}
function onResize(){
  if(!root)return;
  requestAnimationFrame(()=>{fitBase();fitSlots()});
}
function poll(){
  if(!root||!session?.session_id)return;
  if(difficultyRequired()&&!selectedDifficulty()){
    renderDifficulty();
    return;
  }
  if(finalResult)return;
  void loadState(!state);
}
function updateSession(next){
  const before=selectedDifficulty();
  session=next||session;
  const after=selectedDifficulty();
  if(root&&difficultyRequired()&&!after){
    renderDifficulty();
    return;
  }
  if(root&&!state&&(!difficultyRequired()||after))void loadState(true);
  else if(root&&!before&&after)void loadState(true);
}
function mount(nextRoot,nextSession,nextDb){
  if(!nextRoot||!nextSession||!nextDb)return false;
  const changed=root!==nextRoot||String(session?.session_id||'')!==String(nextSession.session_id||'');
  root=nextRoot;session=nextSession;db=nextDb;
  if(changed){
    clearInterval(pollTimer);clearInterval(tickTimer);
    state=null;finalResult=null;resultIngested=false;busy=false;lastTimeoutDeadline=null;
    inputBuffer='';acceptedBuffer='';lastWordKey='';pendingTier='NORMAL';
    root.innerHTML=shell();
    bind();
    if(difficultyRequired()&&!selectedDifficulty())renderDifficulty();
    else void loadState(true);
    pollTimer=setInterval(poll,POLL_MS);
    tickTimer=setInterval(tick,100);
  }
  return true;
}
function unmount(){
  clearInterval(pollTimer);clearInterval(tickTimer);
  pollTimer=0;tickTimer=0;
  window.removeEventListener('resize',onResize);
  root=null;session=null;db=null;state=null;busy=false;
  finalResult=null;inputBuffer='';acceptedBuffer='';lastWordKey='';
}
window.skielsenWordChain={version:VERSION,mount,updateSession,unmount,poll,setDifficulty:async tier=>{const next=String(tier||'').toUpperCase();if(!DIFFICULTIES[next]||!isAdmin())return false;pendingTier=next;return !!(await setDifficulty())},get resultOpen(){return !!q('[data-wc-page="result"]')&&!q('[data-wc-page="result"]').hidden}};
})();