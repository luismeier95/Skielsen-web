(()=>{
'use strict';

const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const theme=q('#wcxtTheme');
const stateButtons=qa('[data-state]');
const body=document.body;

const TIME_LIMIT=15;
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

function clean(v){
  return String(v||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'').toLocaleUpperCase('de-DE');
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
  renderPlay({clearInput:true});
  startTimer(true);
}
function current(){
  return CHAIN[Math.min(game.step,CHAIN.length-1)];
}
function setDebugState(name){
  stateButtons.forEach(b=>b.classList.toggle('active',b.dataset.state===name));
}
function renderPrefix(){
  const target=current().next;
  const prefix=target.slice(0,Math.min(game.revealed,target.length));
  q('#wcxtPrefix').innerHTML=[...prefix].map(ch=>'<span>'+esc(ch)+'</span>').join('');
}
function renderChain(){
  q('#wcxtChain').innerHTML=game.solved.map((word,i)=>'<span>'+esc(word)+'</span>'+(i<game.solved.length-1?'<b>→</b>':'')).join('');
}
function renderPlayerScore(){
  q('#wcxtPlayerSelf b').textContent=String(game.score);
}
function renderPlay({clearInput=false}={}){
  q('#wcxtPlayLayout').hidden=false;
  q('#wcxtResult').hidden=true;
  const stepNo=Math.min(game.step+1,CHAIN.length);
  q('#wcxtStep').textContent=String(stepNo).padStart(2,'0')+' / '+String(CHAIN.length).padStart(2,'0');
  q('#wcxtScore').textContent=String(game.score);
  q('#wcxtBase').textContent=current().base;
  q('#wcxtProgress').style.width=((game.step/CHAIN.length)*100)+'%';
  renderPrefix();
  renderChain();
  renderPlayerScore();
  if(clearInput)q('#wcxtInput').value='';
  q('#wcxtInput').disabled=game.locked||game.completed;
  if(!game.locked&&!game.completed)setTimeout(()=>q('#wcxtInput')?.focus({preventScroll:true}),30);
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
function normalizeTail(raw,target=current().next,revealed=game.revealed){
  let tail=clean(raw);
  const prefix=String(target||'').slice(0,Math.max(0,Number(revealed)||0));
  const repeatedInitial=prefix.length===1&&tail.startsWith(prefix);
  const realDoubleInitial=prefix.length===1&&String(target||'').startsWith(prefix+prefix);
  if(repeatedInitial&&!realDoubleInitial)tail=tail.slice(1);
  return tail;
}
function repeatedInitialRuleSelfTest(){
  const normalTarget='GELD',normalPrefix=normalTarget.slice(0,1);
  const normal=normalPrefix+normalizeTail('GELD',normalTarget,1)===normalTarget;
  const doubleTarget='LLAMA',doublePrefix=doubleTarget.slice(0,1);
  const double=doublePrefix+normalizeTail('LAMA',doubleTarget,1)===doubleTarget;
  return normal&&double;
}
function assembledGuess(){
  const target=current().next;
  const prefix=target.slice(0,game.revealed);
  return prefix+normalizeTail(q('#wcxtInput').value);
}
function submit(){
  if(game.locked||game.completed)return;
  const guess=assembledGuess();
  if(!clean(q('#wcxtInput').value)){
    feedback('WORT EINGEBEN','hint');
    q('#wcxtInput').focus({preventScroll:true});
    return;
  }
  if(guess===current().next)applyCorrect();
  else applyWrong(false);
}
function applyCorrect(){
  if(game.locked||game.completed)return;
  game.locked=true;
  clearInterval(timerId);timerId=0;
  q('#wcxtInput').disabled=true;
  q('#wcxtInput').value='';
  renderPrefix();
  feedback('RICHTIG · '+current().compound,'good');
  setDebugState('CORRECT');
  transitionId=setTimeout(()=>advanceStep(),520);
}
function applyWrong(timeout=false){
  if(game.locked||game.completed)return;
  game.locked=true;
  game.score-=1;
  q('#wcxtInput').disabled=true;
  const target=current().next;
  game.revealed=Math.min(target.length,game.revealed+1);
  q('#wcxtScore').textContent=String(game.score);
  renderPlayerScore();
  renderPrefix();
  q('#wcxtInput').value='';
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
    q('#wcxtInput').disabled=false;
    feedback('');
    setDebugState('PLAY');
    if(timeout)startTimer(true);
    else startTimer(false);
    q('#wcxtInput').focus({preventScroll:true});
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
  renderPlay({clearInput:true});
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

q('#wcxtInput').addEventListener('input',e=>{e.target.value=clean(e.target.value)});
q('#wcxtInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();submit()}
});
q('#wcxtMinimize')?.addEventListener?.('click',()=>{});

setTheme(theme.value);
if(!repeatedInitialRuleSelfTest())console.warn('Wortkette repeated-initial rule self-test failed');
freshGame();
})();