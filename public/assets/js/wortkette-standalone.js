/* Wortkette Solo V20 · fullversion design-contract alignment */
(()=>{
'use strict';

const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';

const q=s=>document.querySelector(s);
const screens=[...document.querySelectorAll('.wk-screen')];

function getPersistentPlayerKey(){
  const storageKey='skielsen_word_chain_player_key_v1';
  try{
    let key=localStorage.getItem(storageKey);
    if(!key){
      key=(globalThis.crypto?.randomUUID?.()||('wc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)));
      localStorage.setItem(storageKey,key);
    }
    return 'solo:'+key;
  }catch(_){
    if(!globalThis.__skielsenWordChainSessionKey){
      globalThis.__skielsenWordChainSessionKey='solo:session-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    }
    return globalThis.__skielsenWordChainSessionKey;
  }
}
const PLAYER_KEY=getPersistentPlayerKey();
let timeLimit=0,state=null,busy=false,timer=0,timeLeft=0,correctCount=0;
let occurrenceThreshold=35;
let thresholdStatsTimer=0;
let inputRules={ignore_repeated_initial:false};
let chainCollapsed=false;
let maxVisualHeight=window.visualViewport?.height||window.innerHeight;
let viewportFrame=0;

function show(id){
  screens.forEach(s=>s.classList.toggle('active',s.id===id));
  document.body.classList.toggle('wk-playing',id==='playScreen');
  if(id==='playScreen'&&matchMedia('(max-width:720px)').matches)setChainCollapsed(true);
  if(id!=='playScreen')document.body.classList.remove('wk-keyboard-open');
  window.scrollTo({top:0,behavior:'auto'});
  requestViewportUpdate();
}
function cleanLetters(value){return String(value||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'').toLocaleUpperCase('de-DE')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function rpc(name,payload={}){
  const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify(payload)
  });
  const text=await r.text();let data=null;
  try{data=text?JSON.parse(text):null}catch(_){data=text}
  if(!r.ok)throw new Error(data?.message||data?.hint||('HTTP '+r.status));
  return data;
}
function setBackendStatus(text,mode='live'){const el=q('#backendStatus');el.textContent=text;el.className='wk-backend '+mode}
function setSegment(value){q('#timeLimit').querySelectorAll('button[data-time]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.time)===value))}
async function refreshThresholdStats(){
  q('#thresholdValue').textContent=String(occurrenceThreshold);
  try{
    const stats=await rpc('get_word_chain_threshold_stats',{p_occurrence_threshold:occurrenceThreshold});
    q('#thresholdEligible').textContent=String(stats.eligible_edges??'—')+' / 445';
  }catch(err){
    console.warn('Threshold stats',err);
    q('#thresholdEligible').textContent='— / 445';
  }
}
function scheduleThresholdStats(){
  clearTimeout(thresholdStatsTimer);
  q('#thresholdValue').textContent=String(occurrenceThreshold);
  thresholdStatsTimer=setTimeout(refreshThresholdStats,140);
}
function setChainCollapsed(value,forced=false){
  chainCollapsed=!!value;
  const panel=q('#chainPanel');
  const toggle=q('#chainToggle');
  if(!panel||!toggle)return;
  panel.classList.toggle('collapsed',chainCollapsed);
  toggle.setAttribute('aria-expanded',String(!chainCollapsed));
  toggle.dataset.forced=forced?'1':'0';
}
function chainMarkup(words,host){
  const list=Array.isArray(words)?words:[];
  host.innerHTML=list.map((word,i)=>'<span class="word">'+esc(word)+'</span>'+(i<list.length-1?'<span class="arrow">→</span>':'')).join('')||'—';
  const count=q('#chainCount');
  if(count)count.textContent=String(list.length)+' '+(list.length===1?'WORT':'WÖRTER');
}
async function refreshInputRules(){
  inputRules={ignore_repeated_initial:false};
  if(!state||state.completed)return;
  const prefix=cleanLetters(state.revealed_prefix||'');
  if(prefix.length!==1)return;
  try{
    inputRules=await rpc('get_word_chain_input_rules',{p_session_id:state.session_id})||inputRules;
  }catch(err){
    console.warn('Wortkette input rules',err);
  }
}
function renderPrefix(){
  const prefix=cleanLetters(state?.revealed_prefix||'');
  q('#revealedPrefix').innerHTML=prefix.split('').map(ch=>'<span class="prefix-letter">'+esc(ch)+'</span>').join('');
  q('#guessTail').value='';
  q('#guessTail').placeholder=prefix?'WEITERSCHREIBEN …':'WORT EINGEBEN …';
}
function renderState(){
  if(!state)return;
  q('#stepLabel').textContent=String(state.step||1).padStart(2,'0')+' / '+String(state.total_steps||0).padStart(2,'0');
  q('#scoreValue').textContent=String(state.score??0);
  q('#wrongValue').textContent=String(state.wrong_count??0);
  q('#correctValue').textContent=String(correctCount);
  q('#baseWord').textContent=state.base_word||'—';
  chainMarkup(state.solved_words,q('#solvedChain'));
  renderPrefix();
  updateTimerChrome();
}
function feedback(text,kind=''){const el=q('#feedback');el.textContent=text||'';el.className='feedback'+(kind?' '+kind:'')}
function animateCard(cls){const card=q('#puzzleCard');card.classList.remove('shake','flash-good');void card.offsetWidth;card.classList.add(cls);setTimeout(()=>card.classList.remove(cls),500)}
function focusGuess(){if(!state||state.completed||busy)return;q('#guessTail').focus({preventScroll:true})}
function updateViewportState(){
  viewportFrame=0;
  const vv=window.visualViewport;
  const currentHeight=vv?.height||window.innerHeight;
  const offsetTop=vv?.offsetTop||0;
  const inputFocused=document.activeElement===q('#guessTail');
  const mobile=matchMedia('(max-width:720px)').matches;

  if(!inputFocused)maxVisualHeight=Math.max(maxVisualHeight,currentHeight);

  const shrink=Math.max(0,maxVisualHeight-currentHeight);
  const keyboardOpen=mobile&&inputFocused&&shrink>100;

  document.documentElement.style.setProperty('--wk-visual-height',currentHeight+'px');
  document.documentElement.style.setProperty('--wk-visual-top',offsetTop+'px');
  document.body.classList.toggle('wk-keyboard-open',keyboardOpen);

  if(keyboardOpen)setChainCollapsed(true,true);
}
function requestViewportUpdate(){
  if(viewportFrame)return;
  viewportFrame=requestAnimationFrame(updateViewportState);
}
function updateTimerChrome(){
  const off=timeLimit<=0,shell=q('.timer-shell'),progress=q('.progress');
  shell.classList.toggle('urgent',!off&&timeLeft<=5&&timeLeft>0);
  progress.classList.toggle('off',off);
  q('#timerValue').textContent=off?'∞':String(Math.max(0,Math.ceil(timeLeft)));
  q('#progressBar').style.width=off?'100%':Math.max(0,(timeLeft/timeLimit)*100)+'%';
}
function stopTimer(){clearInterval(timer);timer=0}
function startTimer(){
  stopTimer();
  if(timeLimit<=0){timeLeft=0;updateTimerChrome();return}
  timeLeft=timeLimit;const deadline=performance.now()+timeLimit*1000;updateTimerChrome();
  timer=setInterval(()=>{
    timeLeft=Math.max(0,(deadline-performance.now())/1000);updateTimerChrome();
    if(timeLeft<=0){if(busy)return;stopTimer();submitGuess(true)}
  },100);
}
async function startGame(){
  if(busy)return;
  busy=true;const btn=q('#startBtn');btn.disabled=true;btn.textContent='KETTE WIRD IM BACKEND FESTGELEGT …';
  try{
    state=await rpc('start_word_chain_solo',{p_player_key:PLAYER_KEY,p_steps:10,p_occurrence_threshold:occurrenceThreshold});
    correctCount=0;
    await refreshInputRules();
    setBackendStatus('KETTE SERVERSEITIG GESPERRT','live');
    show('playScreen');renderState();feedback('');startTimer();setTimeout(focusGuess,80);
  }catch(err){
    console.warn('Wortkette start',err);setBackendStatus('BACKEND FEHLER','error');
    alert('Kette konnte nicht gestartet werden: '+String(err?.message||err));
  }finally{
    busy=false;btn.disabled=false;btn.textContent='NEUE KETTE STARTEN →';
  }
}
async function submitGuess(timeout=false){
  if(!state||busy||state.completed)return;
  const prefix=cleanLetters(state.revealed_prefix||'');
  const tail=cleanLetters(q('#guessTail').value);
  if(!timeout&&!tail&&!prefix){
    feedback('BITTE EIN WORT EINGEBEN.','bad');animateCard('shake');focusGuess();return;
  }

  busy=true;if(timeout)stopTimer();q('#phaseLabel').textContent='PRÜFEN …';
  const guess=timeout?'':prefix+tail;
  const previousPrefix=prefix;

  try{
    const next=await rpc('submit_word_chain_solo',{p_session_id:state.session_id,p_guess:guess});

    if(next.accepted_attempt===false){
      state=next;
      const unavailable=!!next.validation_unavailable;
      feedback(
        unavailable?'WORTPRÜFUNG NICHT VERFÜGBAR · VERSUCH NICHT GEWERTET.':'KEIN GÜLTIGES WORT · VERSUCH NICHT GEWERTET.',
        'bad'
      );
      q('#guessTail').value='';
      q('#phaseLabel').textContent='WORT FINDEN';
      busy=false;
      focusGuess();
      return;
    }

    if(next.correct||next.auto_completed){
      stopTimer();
      if(next.correct)correctCount++;
      const automatic=!!next.auto_completed;
      feedback(
        (automatic?'AUFGEDECKT · ':'RICHTIG · ')+String(next.compound||'').toLocaleUpperCase('de-DE')+(automatic?' · WORT ABGESCHLOSSEN':''),
        automatic?'hint':'good'
      );
      animateCard(automatic?'flash-hint':'flash-good');state=next;
      q('#scoreValue').textContent=String(state.score??0);
      q('#wrongValue').textContent=String(state.wrong_count??0);
      q('#correctValue').textContent=String(correctCount);

      if(state.completed){setTimeout(()=>finishGame(state),automatic?700:480);return}

      setTimeout(async()=>{
        await refreshInputRules();
        feedback('');q('#phaseLabel').textContent='WORT FINDEN';renderState();startTimer();busy=false;focusGuess();
      },automatic?700:500);
      return;
    }

    state=next;
    inputRules={ignore_repeated_initial:false};
    const newPrefix=cleanLetters(state.revealed_prefix||'');
    const revealed=newPrefix.slice(previousPrefix.length) || '—';
    feedback((timeout?'ZEIT ABGELAUFEN':'FALSCH')+' · −1 PUNKT · NÄCHSTER BUCHSTABE: '+revealed,'bad');
    animateCard('shake');renderState();

    setTimeout(()=>{
      feedback('');q('#phaseLabel').textContent='WORT FINDEN';
      if(timeout)startTimer();
      busy=false;focusGuess();
    },700);
  }catch(err){
    console.warn('Wortkette submit',err);feedback('BACKEND-FEHLER · BITTE ERNEUT BESTÄTIGEN.','bad');
    setBackendStatus('BACKEND FEHLER','error');busy=false;if(timeout)startTimer();focusGuess();
  }
}
function finishGame(finalState){
  stopTimer();state=finalState;
  q('#finalScore').textContent=String(finalState.score??0);
  q('#finishCopy').textContent=String(finalState.wrong_count??0)+' FEHLVERSUCHE · '+String(finalState.total_steps||0)+' WÖRTER GELÖST.';
  chainMarkup(finalState.full_chain,q('#fullChain'));show('finishScreen');busy=false;
}
function resetToSetup(){
  stopTimer();state=null;busy=false;correctCount=0;feedback('');
  setBackendStatus('BACKEND BEREIT','live');show('setupScreen');
}

q('#timeLimit').addEventListener('click',e=>{const btn=e.target.closest('button[data-time]');if(!btn)return;timeLimit=Number(btn.dataset.time)||0;setSegment(timeLimit)});
q('#occurrenceThreshold').addEventListener('input',e=>{
  occurrenceThreshold=Math.max(0,Math.min(50,Number(e.target.value)||0));
  try{localStorage.setItem('skielsen_word_chain_threshold_v1',String(occurrenceThreshold))}catch(_){}
  scheduleThresholdStats();
});
q('#startBtn').addEventListener('click',startGame);
q('#restartBtn').addEventListener('click',resetToSetup);
q('#chainToggle').addEventListener('click',()=>{
  if(document.body.classList.contains('wk-keyboard-open'))return;
  setChainCollapsed(!chainCollapsed);
});
q('#openWordInput').addEventListener('click',focusGuess);
q('#guessTail').addEventListener('input',e=>{
  let value=cleanLetters(e.target.value);
  const prefix=cleanLetters(state?.revealed_prefix||'');
  if(inputRules?.ignore_repeated_initial&&prefix.length===1&&value.startsWith(prefix)){
    value=value.slice(1);
  }
  e.target.value=value;
});
q('#guessTail').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitGuess(false)}});
q('#guessTail').addEventListener('focus',()=>{
  if(matchMedia('(max-width:720px)').matches)setChainCollapsed(true,true);
  setTimeout(requestViewportUpdate,40);
  setTimeout(requestViewportUpdate,180);
});
q('#guessTail').addEventListener('blur',()=>setTimeout(requestViewportUpdate,80));
q('#playScreen').addEventListener('click',e=>{if(!e.target.closest('.game-top')&&!e.target.closest('.stats-row')&&!e.target.closest('#chainToggle'))focusGuess()});

if(window.visualViewport){
  window.visualViewport.addEventListener('resize',requestViewportUpdate);
  window.visualViewport.addEventListener('scroll',requestViewportUpdate);
}
window.addEventListener('resize',requestViewportUpdate);

try{
  const saved=Number(localStorage.getItem('skielsen_word_chain_threshold_v1'));
  if(Number.isFinite(saved))occurrenceThreshold=Math.max(0,Math.min(50,saved));
}catch(_){}
q('#occurrenceThreshold').value=String(occurrenceThreshold);
refreshThresholdStats();
setBackendStatus('BACKEND BEREIT','live');
requestViewportUpdate();
})();