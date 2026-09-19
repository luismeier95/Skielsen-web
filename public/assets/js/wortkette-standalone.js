(()=>{
'use strict';

const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';

const q=s=>document.querySelector(s);
const screens=[...document.querySelectorAll('.wk-screen')];

let timeLimit=0;
let state=null;
let typed='';
let busy=false;
let timer=0;
let timeLeft=0;
let correctCount=0;

function show(id){
  screens.forEach(s=>s.classList.toggle('active',s.id===id));
  window.scrollTo({top:0,behavior:'auto'});
}
function cleanLetters(value){
  return String(value||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'').toLocaleUpperCase('de-DE');
}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function rpc(name,payload={}){
  const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:'Bearer '+SUPABASE_KEY,
      'Content-Type':'application/json',
      Accept:'application/json'
    },
    body:JSON.stringify(payload)
  });
  const text=await r.text();
  let data=null;
  try{data=text?JSON.parse(text):null}catch(_){data=text}
  if(!r.ok)throw new Error(data?.message||data?.hint||('HTTP '+r.status));
  return data;
}
function setBackendStatus(text,mode='live'){
  const el=q('#backendStatus');
  el.textContent=text;
  el.className='wk-backend '+mode;
}
function setSegment(host,value){
  host.querySelectorAll('button[data-time]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.time)===value));
}
function chainMarkup(words,host){
  const list=Array.isArray(words)?words:[];
  host.innerHTML=list.map((word,i)=>'<span class="word">'+esc(word)+'</span>'+(i<list.length-1?'<span class="arrow">→</span>':'')).join('')||'—';
}
function answerRestLength(){
  return Math.max(0,Number(state?.answer_length||1)-1);
}
function renderSlots(){
  const host=q('#letterSlots');
  const total=Math.max(1,Number(state?.answer_length||1));
  const first=String(state?.first_letter||'—').toLocaleUpperCase('de-DE');
  const chars=[first,...typed.split('')];
  host.innerHTML=Array.from({length:total},(_,i)=>{
    const char=chars[i]||'';
    const cls=i===0?'slot fixed':('slot '+(char?'filled':'empty'));
    return '<span class="'+cls+'">'+esc(char||'_')+'</span>';
  }).join('');
  q('#guessCapture').value=typed;
}
function focusGuess(){
  if(!state||state.completed||busy)return;
  q('#guessCapture').focus({preventScroll:true});
}
function renderState(){
  if(!state)return;
  q('#stepLabel').textContent=String(state.step||1).padStart(2,'0')+' / '+String(state.total_steps||0).padStart(2,'0');
  q('#scoreValue').textContent=String(state.score??0);
  q('#wrongValue').textContent=String(state.wrong_count??0);
  q('#correctValue').textContent=String(correctCount);
  q('#baseWord').textContent=state.base_word||'—';
  chainMarkup(state.solved_words,q('#solvedChain'));
  renderSlots();
  updateTimerChrome();
}
function feedback(text,kind=''){
  const el=q('#feedback');
  el.textContent=text||'';
  el.className='feedback'+(kind?' '+kind:'');
}
function animateCard(cls){
  const card=q('#puzzleCard');
  card.classList.remove('shake','flash-good');
  void card.offsetWidth;
  card.classList.add(cls);
  setTimeout(()=>card.classList.remove(cls),500);
}
function updateTimerChrome(){
  const off=timeLimit<=0;
  const shell=q('.timer-shell'),progress=q('.progress');
  shell.classList.toggle('urgent',!off&&timeLeft<=5&&timeLeft>0);
  progress.classList.toggle('off',off);
  q('#timerValue').textContent=off?'∞':String(Math.max(0,Math.ceil(timeLeft)));
  q('#progressBar').style.width=off?'100%':Math.max(0,(timeLeft/timeLimit)*100)+'%';
}
function stopTimer(){
  clearInterval(timer);timer=0;
}
function startTimer(){
  stopTimer();
  if(timeLimit<=0){timeLeft=0;updateTimerChrome();return}
  timeLeft=timeLimit;
  const deadline=performance.now()+timeLimit*1000;
  updateTimerChrome();
  timer=setInterval(()=>{
    timeLeft=Math.max(0,(deadline-performance.now())/1000);
    updateTimerChrome();
    if(timeLeft<=0){
      stopTimer();
      submitGuess(true);
    }
  },100);
}
async function startGame(){
  if(busy)return;
  busy=true;
  const btn=q('#startBtn');
  btn.disabled=true;
  btn.textContent='KETTE WIRD IM BACKEND FESTGELEGT …';
  feedback('');
  try{
    state=await rpc('start_word_chain_solo');
    typed='';correctCount=0;
    setBackendStatus('KETTE SERVERSEITIG GESPERRT','live');
    show('playScreen');
    renderState();
    startTimer();
    setTimeout(focusGuess,80);
  }catch(err){
    console.warn('Wortkette start',err);
    setBackendStatus('BACKEND FEHLER','error');
    alert('Kette konnte nicht gestartet werden: '+String(err?.message||err));
  }finally{
    busy=false;
    btn.disabled=false;
    btn.textContent='NEUE KETTE STARTEN →';
  }
}
async function submitGuess(timeout=false){
  if(!state||busy||state.completed)return;
  const needed=answerRestLength();

  if(!timeout&&typed.length!==needed){
    feedback('NOCH '+Math.max(0,needed-typed.length)+' BUCHSTABE'+(Math.max(0,needed-typed.length)===1?'':'N')+' FEHLEN.','bad');
    animateCard('shake');
    focusGuess();
    return;
  }

  busy=true;
  stopTimer();
  const fullGuess=timeout?'':String(state.first_letter||'')+typed;
  q('#phaseLabel').textContent='PRÜFEN …';

  try{
    const next=await rpc('submit_word_chain_solo',{p_session_id:state.session_id,p_guess:fullGuess});

    if(next.correct){
      correctCount++;
      feedback('RICHTIG · '+String(next.compound||'').toLocaleUpperCase('de-DE'),'good');
      animateCard('flash-good');
      state=next;
      typed='';
      q('#scoreValue').textContent=String(state.score??0);
      q('#wrongValue').textContent=String(state.wrong_count??0);
      q('#correctValue').textContent=String(correctCount);

      if(state.completed){
        setTimeout(()=>finishGame(state),500);
        return;
      }

      setTimeout(()=>{
        feedback('');
        q('#phaseLabel').textContent='WORT FINDEN';
        renderState();
        startTimer();
        busy=false;
        focusGuess();
      },520);
      return;
    }

    state=next;
    typed='';
    feedback(timeout?'ZEIT ABGELAUFEN · −1 PUNKT · NOCHMAL.':'FALSCH · −1 PUNKT · NOCHMAL VERSUCHEN.','bad');
    animateCard('shake');
    renderState();

    setTimeout(()=>{
      feedback('');
      q('#phaseLabel').textContent='WORT FINDEN';
      startTimer();
      busy=false;
      focusGuess();
    },650);
  }catch(err){
    console.warn('Wortkette submit',err);
    feedback('BACKEND-FEHLER · BITTE ERNEUT BESTÄTIGEN.','bad');
    setBackendStatus('BACKEND FEHLER','error');
    busy=false;
    startTimer();
    focusGuess();
  }
}
function finishGame(finalState){
  stopTimer();
  state=finalState;
  q('#finalScore').textContent=String(finalState.score??0);
  q('#finishCopy').textContent=String(finalState.wrong_count??0)+' FEHLVERSUCHE · '+String(finalState.total_steps||0)+' WÖRTER GELÖST.';
  chainMarkup(finalState.full_chain,q('#fullChain'));
  show('finishScreen');
  busy=false;
}
function resetToSetup(){
  stopTimer();
  state=null;typed='';busy=false;correctCount=0;
  q('#feedback').textContent='';
  setBackendStatus('BACKEND BEREIT','live');
  show('setupScreen');
}

q('#timeLimit').addEventListener('click',e=>{
  const btn=e.target.closest('button[data-time]');
  if(!btn)return;
  timeLimit=Number(btn.dataset.time)||0;
  setSegment(q('#timeLimit'),timeLimit);
});
q('#startBtn').addEventListener('click',startGame);
q('#restartBtn').addEventListener('click',resetToSetup);
q('#letterSlots').addEventListener('click',focusGuess);

q('#guessCapture').addEventListener('input',e=>{
  if(!state||busy)return;
  const max=answerRestLength();
  typed=cleanLetters(e.target.value).slice(0,max);
  renderSlots();
});
q('#guessCapture').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    e.preventDefault();
    submitGuess(false);
  }
});
q('#playScreen').addEventListener('click',e=>{
  if(!e.target.closest('.game-top')&&!e.target.closest('.stats-row'))focusGuess();
});

setBackendStatus('BACKEND BEREIT','live');
})();