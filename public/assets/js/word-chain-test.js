(()=>{
'use strict';

const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const theme=q('#wcxtTheme');
const stateButtons=qa('[data-state]');
const body=document.body;

const TIME_LIMIT=15;
const LETTERS=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'];
const DIFFICULTIES={
  EASY:{threshold:50,showWordLength:true},
  NORMAL:{threshold:35,showWordLength:false},
  HARDCORE:{threshold:15,showWordLength:false}
};
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
let selectedTier='NORMAL';
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
function showSetup(){
  clearTimers();
  game=null;
  q('#wcxtSetupPage').hidden=false;
  q('#wcxtShell').hidden=true;
  q('#wcxtPlayLayout').hidden=true;
  q('#wcxtResult').hidden=true;
  q('#wcxtProgress').style.width='0%';
  q('#wcxtTime').classList.remove('urgent');
  setDebugState('PLAY');
  qa('[data-tier]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tier===selectedTier));
}
function freshGame(){
  clearTimers();
  const config=DIFFICULTIES[selectedTier]||DIFFICULTIES.NORMAL;
  game={
    step:0,
    score:0,
    revealed:1,
    inputBuffer:'',
    solved:['AUTO'],
    difficulty:selectedTier,
    occurrenceThreshold:config.threshold,
    showWordLength:config.showWordLength,
    startedAt:performance.now(),
    deadline:performance.now()+TIME_LIMIT*1000,
    completed:false,
    locked:false
  };
  q('#wcxtSetupPage').hidden=true;
  q('#wcxtShell').hidden=false;
  q('#wcxtPlayLayout').hidden=false;
  renderPlay();
  startTimer(true);
}
function current(){
  return CHAIN[Math.min(game.step,CHAIN.length-1)];
}
function setDebugState(name){
  stateButtons.forEach(b=>b.classList.toggle('active',b.dataset.state===name));
}
function normalizedInputBuffer(){
  const target=current().next;
  const revealedPrefix=target.slice(0,Math.min(game.revealed,target.length));
  let typed=String(game.inputBuffer||'');
  if(revealedPrefix.length===1&&typed.startsWith(revealedPrefix)){
    const realDoubleInitial=target.startsWith(revealedPrefix+revealedPrefix);
    if(!realDoubleInitial)typed=typed.slice(1);
  }
  return typed;
}
function assembledGuess(){
  const target=current().next;
  const prefix=target.slice(0,Math.min(game.revealed,target.length));
  return prefix+normalizedInputBuffer();
}
function renderSlots(){
  const target=current().next;
  const revealed=Math.min(game.revealed,target.length);
  const prefix=target.slice(0,revealed);
  const typed=normalizedInputBuffer();

  if(game.showWordLength){
    const chars=[...target];
    q('#wcxtSlots').innerHTML=chars.map((ch,i)=>{
      if(i<revealed)return '<span class="wcxt-slot is-revealed" aria-label="'+esc(ch)+'">'+esc(ch)+'</span>';
      const typedIndex=i-revealed;
      const typedChar=typed.charAt(typedIndex);
      if(typedChar)return '<span class="wcxt-slot is-typed" aria-label="eingegeben '+esc(typedChar)+'">'+esc(typedChar)+'</span>';
      return '<span class="wcxt-slot" aria-label="verborgen"></span>';
    }).join('');
  }else{
    const visible=[
      ...[...prefix].map(ch=>'<span class="wcxt-slot is-revealed" aria-label="'+esc(ch)+'">'+esc(ch)+'</span>'),
      ...[...typed].map(ch=>'<span class="wcxt-slot is-typed" aria-label="eingegeben '+esc(ch)+'">'+esc(ch)+'</span>')
    ];
    q('#wcxtSlots').innerHTML=visible.join('');
  }
  fitSlotText();
}
function renderChain(){
  q('#wcxtChain').innerHTML=game.solved.map((word,i)=>
    '<span>'+esc(word)+'</span>'+(i<game.solved.length-1?'<b>→</b>':'')
  ).join('');
}
function renderPlayerScore(){
  q('#wcxtPlayerSelf b').textContent=String(game.score);
}
function fitSingleLine(el,max=52,min=20){
  if(!el)return;
  el.style.fontSize=max+'px';
  let size=max;
  while(el.scrollWidth>el.clientWidth&&size>min){
    size-=1;
    el.style.fontSize=size+'px';
  }
}
function fitSlotText(){
  const slots=q('#wcxtSlots');
  if(!slots)return;
  const count=Math.max(1,slots.children.length);
  slots.style.setProperty('--slot-count',String(count));
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
  requestAnimationFrame(()=>fitSingleLine(q('#wcxtBase'),52,22));
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
function repeatedInitialRuleSelfTest(){
  const oldGame=game;
  game={revealed:1,inputBuffer:'GELD',step:0};
  const saved=CHAIN[0];
  CHAIN[0]={base:'X',next:'GELD',compound:'XGELD'};
  const normal=assembledGuess()==='GELD';
  game.inputBuffer='LAMA';
  CHAIN[0]={base:'X',next:'LLAMA',compound:'XLLAMA'};
  const doubled=assembledGuess()==='LLAMA';
  CHAIN[0]=saved;
  game=oldGame;
  return normal&&doubled;
}
function typeLetter(letter){
  if(!game||game.locked||game.completed)return;
  const chosen=cleanLetter(letter);
  if(!chosen)return;
  const maxInput=32;
  if(game.inputBuffer.length>=maxInput)return;
  game.inputBuffer+=chosen;
  renderSlots();
  feedback('');
}
function eraseLetter(){
  if(!game||game.locked||game.completed||!game.inputBuffer)return;
  game.inputBuffer=game.inputBuffer.slice(0,-1);
  renderSlots();
  feedback('');
}
function submitWord(){
  if(!game||game.locked||game.completed)return;
  if(!game.inputBuffer){
    feedback('WORT EINGEBEN · MIT ENTER BESTÄTIGEN','hint');
    return;
  }
  const guess=assembledGuess();
  if(guess===current().next)applyCorrect();
  else applyWrong(false);
}
function applyCorrect(){
  if(game.locked||game.completed)return;
  game.locked=true;
  game.revealed=current().next.length;
  game.inputBuffer='';
  clearInterval(timerId);timerId=0;
  renderSlots();
  feedback('RICHTIG · '+current().compound,'good');
  setDebugState('CORRECT');
  transitionId=setTimeout(()=>advanceStep(),520);
}
function applyWrong(timeout=false){
  if(game.locked||game.completed)return;
  game.locked=true;
  game.score-=1;
  game.inputBuffer='';
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
  game.inputBuffer='';
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
  if(!game){freshGame();return}
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
  if(!game){freshGame();return}
  if(game.completed){freshGame();return}
  q('#wcxtPlayLayout').hidden=false;
  q('#wcxtResult').hidden=true;
  setDebugState('PLAY');
  renderPlay();
}
function debugHint(){
  if(!game){freshGame();return}
  if(game.completed)freshGame();
  q('#wcxtPlayLayout').hidden=false;q('#wcxtResult').hidden=true;
  applyWrong(false);
}
function debugCorrect(){
  if(!game){freshGame();return}
  if(game.completed)freshGame();
  q('#wcxtPlayLayout').hidden=false;q('#wcxtResult').hidden=true;
  game.inputBuffer=current().next.slice(game.revealed);
  submitWord();
}

theme.addEventListener('change',()=>setTheme(theme.value));
q('#wcxtLayoutMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-layout'));
q('#wcxtDataMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-data'));
q('#wcxtReset').addEventListener('click',showSetup);

qa('[data-tier]').forEach(btn=>btn.addEventListener('click',()=>{
  selectedTier=btn.dataset.tier;
  qa('[data-tier]').forEach(other=>other.classList.toggle('active',other===btn));
}));
q('#wcxtStart').addEventListener('click',freshGame);

stateButtons.forEach(btn=>btn.addEventListener('click',()=>{
  const state=btn.dataset.state;
  if(state==='PLAY')resumePlay();
  else if(state==='HINT')debugHint();
  else if(state==='CORRECT')debugCorrect();
  else if(state==='RESULT')finishGame(true);
}));


document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target?.matches?.('select'))return;
  if(e.key==='Enter'){
    e.preventDefault();
    submitWord();
    return;
  }
  if(e.key==='Backspace'){
    e.preventDefault();
    eraseLetter();
    return;
  }
  const letter=cleanLetter(e.key);
  if(letter){
    e.preventDefault();
    typeLetter(letter);
  }
});

setTheme(theme.value);
if(!repeatedInitialRuleSelfTest())console.warn('Wortkette repeated-initial rule self-test failed');
showSetup();
})();