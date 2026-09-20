(()=>{
'use strict';

const VERSION=window.SKIELSEN_VERSION||'15.1.50';
const POLL_MS=1600;
let root=null,session=null,db=null,state=null,pollTimer=0,tickTimer=0,busy=false,serverOffsetMs=0,lastTimeoutDeadline=null,lastWordKey='',resultIngested=false,viewportRaf=0,baseViewportHeight=window.visualViewport?.height||window.innerHeight;

const q=(sel)=>root?.querySelector(sel)||null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'').toLocaleUpperCase('de-DE');

async function rpc(name,args={}){
  if(!db)throw new Error('WORD_CHAIN_DB_NOT_READY');
  const {data,error}=await db.rpc(name,args);
  if(error)throw error;
  return data;
}
function feedback(text,kind=''){
  const el=q('[data-wc-feedback]');if(!el)return;
  el.textContent=text||'';
  el.className='wc-feedback'+(kind?' '+kind:'');
}
function chainHtml(words){
  const list=Array.isArray(words)?words:[];
  return list.map((w,i)=>'<span>'+esc(w)+'</span>'+(i<list.length-1?'<b>→</b>':'')).join('')||'—';
}
function shell(){
  return `
    <div class="wc-app">
      <header class="wc-header">
        <div class="wc-brand"><img src="assets/images/skielsen-logo.png" alt="SKIELSEN"><div><strong>WORTKETTE</strong><small>V${esc(VERSION)}</small></div></div>
        <button class="wc-minimize" type="button" data-wc-minimize>MINIMIEREN</button>
      </header>
      <div class="wc-progress"><i data-wc-progress></i></div>
      <main class="wc-main">
        <section class="wc-stats" aria-label="Spielstatus">
          <div><small>SCHRITT</small><strong data-wc-step>01 / 10</strong></div>
          <div><small>PUNKTE</small><strong data-wc-score>0</strong></div>
          <div><small>ZEIT</small><strong data-wc-time>—</strong></div>
        </section>

        <section class="wc-chain collapsed" data-wc-chain>
          <button type="button" class="wc-chain-toggle" data-wc-chain-toggle aria-expanded="false">
            <span>DEINE KETTE</span><b data-wc-chain-count>1 WORT</b><i>⌄</i>
          </button>
          <div class="wc-chain-content" data-wc-chain-content>—</div>
        </section>

        <section class="wc-puzzle" data-wc-puzzle>
          <div class="wc-context">
            <small>AKTUELLES AUSGANGSWORT</small>
            <h1 data-wc-base>—</h1>
            <div class="wc-plus">+</div>
          </div>
          <div class="wc-answer" data-wc-answer>
            <small class="wc-answer-label">GESUCHTES NOMEN</small>
            <div class="wc-input-row">
              <div class="wc-prefix" data-wc-prefix></div>
              <input data-wc-input type="text" autocomplete="off" autocapitalize="characters" enterkeyhint="go" spellcheck="false" aria-label="Rest des gesuchten Nomens" placeholder="WEITERSCHREIBEN …">
            </div>
            <div class="wc-enter"><span>WORT ERGÄNZEN</span><b>ENTER ↵</b></div>
            <div class="wc-feedback" data-wc-feedback aria-live="polite"></div>
          </div>
        </section>

        <section class="wc-complete" data-wc-complete hidden>
          <small>DEINE KETTE IST FERTIG</small>
          <h2>GESCHAFFT.</h2>
          <div class="wc-finish-grid">
            <div><small>PUNKTE</small><strong data-wc-final-score>0</strong></div>
            <div><small>FEHLVERSUCHE</small><strong data-wc-final-wrong>0</strong></div>
          </div>
          <p data-wc-waiting>ERGEBNIS WIRD SYNCHRONISIERT …</p>
          <div class="wc-final-chain" data-wc-final-chain></div>
          <button class="wc-primary" type="button" data-wc-minimize-finish>TURNIER ANSEHEN →</button>
        </section>
      </main>
    </div>`;
}
function bind(){
  q('[data-wc-minimize]')?.addEventListener('click',()=>window.skielsenInApp?.minimize?.());
  q('[data-wc-minimize-finish]')?.addEventListener('click',()=>window.skielsenInApp?.minimize?.());
  q('[data-wc-chain-toggle]')?.addEventListener('click',()=>{
    if(root?.classList.contains('wc-keyboard-open'))return;
    const box=q('[data-wc-chain]');if(!box)return;
    const collapsed=box.classList.toggle('collapsed');
    q('[data-wc-chain-toggle]')?.setAttribute('aria-expanded',String(!collapsed));
  });
  q('[data-wc-input]')?.addEventListener('input',e=>{
    let value=clean(e.target.value);
    const prefix=clean(state?.revealed_prefix||'');
    if(state?.ignore_repeated_initial&&prefix.length===1&&value.startsWith(prefix))value=value.slice(1);
    e.target.value=value;
  });
  q('[data-wc-input]')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();void submit(false)}
  });
  q('[data-wc-input]')?.addEventListener('focus',()=>{q('[data-wc-chain]')?.classList.add('collapsed');setTimeout(requestViewport,40);setTimeout(requestViewport,180)});
  q('[data-wc-input]')?.addEventListener('blur',()=>setTimeout(requestViewport,80));
}
function updateViewport(){
  viewportRaf=0;
  if(!root)return;
  const vv=window.visualViewport;
  const h=vv?.height||window.innerHeight;
  const top=vv?.offsetTop||0;
  const inputFocused=document.activeElement===q('[data-wc-input]');
  if(!inputFocused)baseViewportHeight=Math.max(baseViewportHeight,h);
  const gap=Math.max(0,window.innerHeight-h-top);
  const open=inputFocused&&(baseViewportHeight-h>100||gap>100);
  root.style.setProperty('--wc-visible-height',h+'px');
  root.style.setProperty('--wc-keyboard-bottom',(open?gap:0)+'px');
  root.classList.toggle('wc-keyboard-open',open);
  if(open)q('[data-wc-chain]')?.classList.add('collapsed');
}
function requestViewport(){
  if(viewportRaf)return;
  viewportRaf=requestAnimationFrame(updateViewport);
}
function syncClock(next){
  const server=Date.parse(next?.server_now||'');
  if(Number.isFinite(server))serverOffsetMs=server-Date.now();
  if(next?.deadline_at!==state?.deadline_at)lastTimeoutDeadline=null;
}
function render(next,{clearInput=false}={}){
  if(!root||!next)return;
  syncClock(next);
  state=next;

  const completed=!!state.completed;
  q('[data-wc-puzzle]').hidden=completed;
  q('[data-wc-complete]').hidden=!completed;

  q('[data-wc-step]').textContent=String(state.step||1).padStart(2,'0')+' / '+String(state.total_steps||10).padStart(2,'0');
  q('[data-wc-score]').textContent=String(state.score??0);

  const solved=Array.isArray(state.solved_words)?state.solved_words:[];
  q('[data-wc-chain-content]').innerHTML=chainHtml(solved);
  q('[data-wc-chain-count]').textContent=String(solved.length)+' '+(solved.length===1?'WORT':'WÖRTER');

  if(completed){
    q('[data-wc-final-score]').textContent=String(state.score??0);
    q('[data-wc-final-wrong]').textContent=String(state.wrong_count??0);
    q('[data-wc-final-chain]').innerHTML=chainHtml(state.full_chain||solved);
    const finished=Number(state.finished_players||0),total=Number(state.total_players||0);
    q('[data-wc-waiting]').textContent=state.waiting_for_others
      ?`DU BIST FERTIG · ${finished}/${total} PLAYER ABGESCHLOSSEN · WARTET AUF DIE ANDEREN.`
      :'ALLE PLAYER SIND FERTIG · AUSWERTUNG LÄUFT.';
    return;
  }

  q('[data-wc-base]').textContent=state.base_word||'—';
  const prefix=clean(state.revealed_prefix||'');
  q('[data-wc-prefix]').innerHTML=prefix.split('').map(ch=>'<span>'+esc(ch)+'</span>').join('');

  const key=String(state.step)+'|'+prefix;
  if(clearInput||key!==lastWordKey){
    const input=q('[data-wc-input]');if(input)input.value='';
  }
  lastWordKey=key;
  const input=q('[data-wc-input]');
  if(input)input.placeholder=prefix?'WEITERSCHREIBEN …':'WORT EINGEBEN …';
  tick();
}
function tick(){
  if(!root||!state)return;
  const time=q('[data-wc-time]'),bar=q('[data-wc-progress]');
  if(state.completed||!state.deadline_at){
    if(time)time.textContent='—';
    if(bar)bar.style.width='100%';
    return;
  }
  const end=Date.parse(state.deadline_at);
  const now=Date.now()+serverOffsetMs;
  const ms=Math.max(0,end-now);
  const limit=Math.max(1,Number(state.time_limit_seconds||15))*1000;
  if(time)time.textContent=String(Math.max(0,Math.ceil(ms/1000)));
  if(bar)bar.style.width=Math.max(0,Math.min(100,ms/limit*100))+'%';
  q('[data-wc-time]')?.classList.toggle('urgent',ms>0&&ms<=5000);
  if(ms<=0&&!busy&&lastTimeoutDeadline!==state.deadline_at){
    lastTimeoutDeadline=state.deadline_at;
    void submit(true);
  }
}
async function loadState(initial=false){
  if(!session?.session_id||busy)return;
  try{
    const next=await rpc(initial?'start_word_chain_tournament_player':'get_word_chain_tournament_state',{
      p_in_app_session_id:session.session_id
    });
    render(next);
  }catch(err){
    console.warn('Wortkette state',err);
    feedback('SPIELSTAND KONNTE NICHT GELADEN WERDEN.','bad');
  }
}
async function submit(timeout=false){
  if(!state||state.completed||busy)return;
  const input=q('[data-wc-input]');
  const prefix=clean(state.revealed_prefix||'');
  const tail=clean(input?.value||'');
  if(!timeout&&!tail){
    feedback('BITTE DAS WORT VERVOLLSTÄNDIGEN.','bad');
    input?.focus({preventScroll:true});
    return;
  }

  busy=true;
  if(input)input.disabled=true;
  const guess=timeout?'':prefix+tail;
  try{
    const next=await rpc('submit_word_chain_tournament',{
      p_in_app_session_id:session.session_id,
      p_guess:guess,
      p_timeout:!!timeout
    });

    if(next?.accepted_attempt===false){
      render(next,{clearInput:true});
      feedback(next.validation_unavailable?'WORTPRÜFUNG NICHT VERFÜGBAR · VERSUCH NICHT GEWERTET.':'KEIN GÜLTIGES WORT · VERSUCH NICHT GEWERTET.','bad');
    }else if(next?.correct){
      render(next,{clearInput:true});
      feedback('RICHTIG'+(next.compound?' · '+String(next.compound).toLocaleUpperCase('de-DE'):'')+'.','good');
    }else if(next?.auto_completed){
      render(next,{clearInput:true});
      feedback('WORT VOLLSTÄNDIG AUFGEDECKT · WEITER.','hint');
    }else if(next?.timeout||next?.timeout_applied){
      render(next,{clearInput:true});
      feedback('ZEIT ABGELAUFEN · −1 PUNKT · NÄCHSTER BUCHSTABE.','bad');
    }else{
      render(next,{clearInput:true});
      feedback('FALSCH · −1 PUNKT · NÄCHSTER BUCHSTABE.','bad');
    }

    if(next?.tournament_complete&&next?.tournament_result&&!resultIngested){
      resultIngested=true;
      window.skielsenV15?.ingestInAppGameResult?.(session.tournament_game_id,next.tournament_result);
    }
  }catch(err){
    console.warn('Wortkette submit',err);
    feedback('EINGABE KONNTE NICHT VERARBEITET WERDEN.','bad');
  }finally{
    busy=false;
    if(input)input.disabled=false;
    if(!state?.completed)setTimeout(()=>input?.focus({preventScroll:true}),40);
  }
}
function updateSession(next){session=next||session}
function poll(){
  if(!root||!session?.session_id)return;
  void loadState(false);
}
function mount(nextRoot,nextSession,nextDb){
  if(!nextRoot||!nextSession||!nextDb)return false;
  const changed=root!==nextRoot||String(session?.session_id||'')!==String(nextSession.session_id||'');
  root=nextRoot;session=nextSession;db=nextDb;
  if(changed){
    clearInterval(pollTimer);clearInterval(tickTimer);
    state=null;lastWordKey='';lastTimeoutDeadline=null;resultIngested=false;
    root.innerHTML=shell();
    bind();
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',requestViewport);
      window.visualViewport.addEventListener('scroll',requestViewport);
    }
    window.addEventListener('resize',requestViewport);
    void loadState(true);
    pollTimer=setInterval(poll,POLL_MS);
    tickTimer=setInterval(tick,100);
    requestViewport();
  }
  return true;
}
function unmount(){
  clearInterval(pollTimer);clearInterval(tickTimer);
  pollTimer=0;tickTimer=0;
  if(window.visualViewport){
    window.visualViewport.removeEventListener('resize',requestViewport);
    window.visualViewport.removeEventListener('scroll',requestViewport);
  }
  window.removeEventListener('resize',requestViewport);
  if(root)root.classList.remove('wc-keyboard-open');
  root=null;session=null;db=null;state=null;busy=false;lastWordKey='';lastTimeoutDeadline=null;
}
window.skielsenWordChain={version:VERSION,mount,updateSession,unmount,poll};
})();