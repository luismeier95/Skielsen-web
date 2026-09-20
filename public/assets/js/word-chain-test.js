(()=>{
'use strict';

const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const theme=q('#wcxtTheme');
const stateButtons=qa('[data-state]');
const body=document.body;

const TIME_LIMIT=15;
const LETTERS=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'];
const CHAIN=[
  {base:'AUTO',next:'BAHN',compound:'AUTOBAHN'},
  {base:'BAHN',next:'HOF',compound:'BAHNHOF'},
  {base:'HOF',next:'TÜR',compound:'HOFTÜR'},
  {base:'TÜR',next:'GRIFF',compound:'TÜRGRIFF'},
  {base:'GRIFF',next:'BRETT',compound:'GRIFFBRETT'},
  {base:'BRETT',next:'SPIEL',compound:'BRETTSPIEL'},
  {base:'SPIEL',next:'PLATZ',compound:'SPIELPLATZ'},
  {base:'PLATZ',next:'REGEN',compound:'PLATZREGEN'},
  {base:'REGEN',next:'BOGEN',compound:'REGENBOGEN'},
  {base:'BOGEN',next:'LAMPE',compound:'BOGENLAMPE'}
];

const OTHER_PLAYERS=[
  {name:'SOFYA',score:-1,time:91,color:'var(--core-blue)'},
  {name:'HANNES',score:0,time:84,color:'var(--core-green)'},
  {name:'PIA',score:-3,time:122,color:'var(--core-yellow)'}
];

let game=null;
let timerId=0;
let transitionId=0;

function cleanLetter(v){
  const value=String(v||'').normalize('NFC').toLocaleUpperCase('de-DE');
  return LETTERS.includes(value)?value:'';
}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function setTheme(value){
  document.documentElement.dataset.themePack=value;
  body.dataset.themePack=value;
}
function clearTimers(){
  clearInterval(timerId);timerId=0;
  clearTimeout(transitionId);transitionId=0;
}
function freshGame(){
  clearTimers();
  game={
    step:0,
    score:0,
    revealed:1,
    solved:['AUTO'],
    startedAt:performance.now(),
    deadline:performance.now()+TIME_LIMIT*1000,
    completed:false,
    locked:false
  };
  renderKeyboard();
  renderPlay();
  startTimer(true);
}
function current(){
  return CHAIN[Math.min(game.step,CHAIN.length-1)];
}
function setDebugState(name){
  stateButtons.forEach(b=>b.classList.toggle('active',b.dataset.state===name));
}
function renderSlots(){
  const target=current().next;
  q('#wcxtSlots').innerHTML=[...target].map((ch,i)=>
    '<span class="wcxt-slot '+(i<game.revealed?'is-revealed':'')+'" aria-label="'+(i<game.revealed?esc(ch):'verborgen')+'">'+
      (i<game.revealed?esc(ch):'')+
    '</span>'
  ).join('');
}
function renderKeyboard(){
  q('#wcxtKeyboard').innerHTML=LETTERS.map(letter=>
    '<button type="button" class="wcxt-key" data-letter="'+letter+'" aria-label="Buchstabe '+letter+'">'+letter+'</button>'
  ).join('');
}
function renderChain(){
  q('#wcxtChain').innerHTML=game.solved.map((word,i)=>
    '<span>'+esc(word)+'</span>'+(i<game.solved.length-1?'<b>→</b>':'')
  ).join('');
}
function renderPlayerScore(){
  q('#wcxtPlayerSelf b').textContent=String(game.score);
}
function setKeyboardLocked(locked){
  qa('.wcxt-key').forEach(btn=>btn.disabled=!!locked);
}
function renderPlay(){
  q('#wcxtPlayLayout').hidden=false;
  q('#wcxtResult').hidden=true;
  const stepNo=Math.min(game.step+1,CHAIN.length);
  q('#wcxtStep').textContent=String(stepNo).padStart(2,'0')+' / '+String(CHAIN.length).padStart(2,'0');
  q('#wcxtScore').textContent=String(game.score);
  q('#wcxtBase').textContent=current().base;
  q('#wcxtProgress').style.width=((game.step/CHAIN.length)*100)+'%';
  renderSlots();
  renderChain();
  renderPlayerScore();
  setKeyboardLocked(game.locked||game.completed);
}
function feedback(text,kind=''){
  const el=q('#wcxtFeedback');
  el.textContent=text||'';
  el.className='wcxt-feedback'+(kind?' '+kind:'');
  const main=q('#wcxtMainBody');
  main.classList.remove('is-hint','is-correct');
  if(kind==='bad'||kind==='hint')main.classList.add('is-hint');
  if(kind==='good')main.classList.add('is-correct');
}
function startTimer(resetDeadline=false){
  clearInterval(timerId);
  if(game.completed)return;
  if(resetDeadline)game.deadline=performance.now()+TIME_LIMIT*1000;
  updateTimer();
  timerId=setInterval(updateTimer,100);
}
function updateTimer(){
  if(game.completed)return;
  const ms=Math.max(0,game.deadline-performance.now());
  q('#wcxtTime').textContent=String(Math.max(0,Math.ceil(ms/1000)));
  q('#wcxtTime').classList.toggle('urgent',ms>0&&ms<=5000);
  if(ms<=0&&!game.locked){
    clearInterval(timerId);timerId=0;
    applyWrong(true);
  }
}
function classifyLetter(letter,target,revealed){
  const chosen=cleanLetter(letter);
  if(!chosen)return 'ignore';
  const next=String(target||'').charAt(revealed);
  if(revealed===1&&chosen===String(target||'').charAt(0)&&next!==chosen)return 'repeat-ignore';
  return chosen===next?'correct':'wrong';
}
function repeatedInitialRuleSelfTest(){
  return classifyLetter('G','GELD',1)==='repeat-ignore'
    && classifyLetter('L','LLAMA',1)==='correct'
    && classifyLetter('E','GELD',1)==='correct';
}
function chooseLetter(letter){
  if(!game||game.locked||game.completed)return;
  const chosen=cleanLetter(letter);
  if(!chosen)return;
  const result=classifyLetter(chosen,current().next,game.revealed);

  if(result==='repeat-ignore'){
    feedback('ANFANGSBUCHSTABE IST BEREITS SICHTBAR','hint');
    const btn=q('.wcxt-key[data-letter="'+chosen+'"]');
    btn?.classList.add('is-ignored');
    setTimeout(()=>btn?.classList.remove('is-ignored'),260);
    return;
  }

  if(result==='correct'){
    game.revealed+=1;
    renderSlots();
    const btn=q('.wcxt-key[data-letter="'+chosen+'"]');
    btn?.classList.add('is-hit');
    setTimeout(()=>btn?.classList.remove('is-hit'),260);
    if(game.revealed>=current().next.length){
      applyCorrect();
    }else{
      feedback('');
    }
    return;
  }

  const btn=q('.wcxt-key[data-letter="'+chosen+'"]');
  btn?.classList.add('is-miss');
  setTimeout(()=>btn?.classList.remove('is-miss'),260);
  applyWrong(false);
}
function applyCorrect(){
  if(game.locked||game.completed)return;
  game.locked=true;
  clearInterval(timerId);timerId=0;
  setKeyboardLocked(true);
  renderSlots();
  feedback('RICHTIG · '+current().compound,'good');
  setDebugState('CORRECT');
  transitionId=setTimeout(()=>advanceStep(),520);
}
function applyWrong(timeout=false){
  if(game.locked||game.completed)return;
  game.locked=true;
  game.score-=1;
  setKeyboardLocked(true);
  const target=current().next;
  game.revealed=Math.min(target.length,game.revealed+1);
  q('#wcxtScore').textContent=String(game.score);
  renderPlayerScore();
  renderSlots();

  const completedByHint=game.revealed>=target.length;
  feedback(timeout?'ZEIT ABGELAUFEN · −1 · NÄCHSTER BUCHSTABE':'FALSCH · −1 · NÄCHSTER BUCHSTABE','bad');
  setDebugState('HINT');

  if(completedByHint){
    transitionId=setTimeout(()=>{
      feedback('AUFGEDECKT · '+current().compound,'hint');
      transitionId=setTimeout(()=>advanceStep(),420);
    },420);
    return;
  }

  transitionId=setTimeout(()=>{
    game.locked=false;
    setKeyboardLocked(false);
    feedback('');
    setDebugState('PLAY');
    if(timeout)startTimer(true);
    else startTimer(false);
  },520);
}
function advanceStep(){
  const solved=current().next;
  if(!game.solved.includes(solved))game.solved.push(solved);
  game.step+=1;
  if(game.step>=CHAIN.length){
    finishGame();
    return;
  }
  game.revealed=1;
  game.locked=false;
  feedback('');
  setDebugState('PLAY');
  renderPlay();
  startTimer(true);
}
function formatTime(seconds){
  const sec=Math.max(0,Math.round(seconds));
  const m=Math.floor(sec/60),s=sec%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function finishGame(force=false){
  clearTimers();
  if(!force){
    game.completed=true;
    q('#wcxtProgress').style.width='100%';
  }
  const elapsed=(performance.now()-game.startedAt)/1000;
  const rows=[
    {name:'DJEELOI',score:game.score,time:elapsed,color:'var(--core-red)'},
    ...OTHER_PLAYERS
  ].sort((a,b)=>b.score-a.score||a.time-b.time);

  q('#wcxtResultRows').innerHTML=rows.map((p,i)=>
    '<div class="wcxt-result-row">'+
      '<b>'+(i+1)+'.</b>'+
      '<span><i style="--player:'+p.color+'"></i>'+esc(p.name)+'</span>'+
      '<strong>'+formatTime(p.time)+'</strong>'+
      '<strong>'+p.score+'</strong>'+
    '</div>'
  ).join('');

  q('#wcxtPlayLayout').hidden=true;
  q('#wcxtResult').hidden=false;
  q('#wcxtProgress').style.width='100%';
  setDebugState('RESULT');
}
function resumePlay(){
  if(game.completed){freshGame();return}
  q('#wcxtPlayLayout').hidden=false;
  q('#wcxtResult').hidden=true;
  setDebugState('PLAY');
  renderPlay();
}
function debugHint(){
  if(game.completed)freshGame();
  q('#wcxtPlayLayout').hidden=false;q('#wcxtResult').hidden=true;
  applyWrong(false);
}
function debugCorrect(){
  if(game.completed)freshGame();
  q('#wcxtPlayLayout').hidden=false;q('#wcxtResult').hidden=true;
  game.revealed=current().next.length;
  renderSlots();
  applyCorrect();
}

theme.addEventListener('change',()=>setTheme(theme.value));
q('#wcxtLayoutMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-layout'));
q('#wcxtDataMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-data'));
q('#wcxtReset').addEventListener('click',freshGame);

stateButtons.forEach(btn=>btn.addEventListener('click',()=>{
  const state=btn.dataset.state;
  if(state==='PLAY')resumePlay();
  else if(state==='HINT')debugHint();
  else if(state==='CORRECT')debugCorrect();
  else if(state==='RESULT')finishGame(true);
}));

q('#wcxtKeyboard').addEventListener('click',e=>{
  const btn=e.target.closest('[data-letter]');
  if(btn)chooseLetter(btn.dataset.letter);
});

document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target?.matches?.('select'))return;
  const letter=cleanLetter(e.key);
  if(letter){
    e.preventDefault();
    chooseLetter(letter);
  }
});

setTheme(theme.value);
if(!repeatedInitialRuleSelfTest())console.warn('Wortkette repeated-initial rule self-test failed');
freshGame();
})();