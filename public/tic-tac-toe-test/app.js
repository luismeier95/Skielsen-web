(()=>{
'use strict';

const MODES={
  NORMAL:{
    title:'NORMAL',
    rule:'Klassisches Tic Tac Toe. Drei eigene Symbole in einer Reihe gewinnen.'
  },
  DISAPPEAR:{
    title:'DISAPPEAR',
    rule:'Maximal drei eigene Symbole bleiben aktiv. Beim vierten verschwindet das älteste eigene Symbol.'
  }
};
const PLAYERS={
  X:{name:'PLAYER 1',color:'var(--theme-team-red,var(--core-red))'},
  O:{name:'PLAYER 2',color:'var(--theme-team-blue,var(--core-blue))'}
};
const WINS=[
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let selectedMode='NORMAL';
let selectedOpponent='BOT';
let game=null;
let transitionTimer=0;

const q=s=>document.querySelector(s);
const setup=q('#tttxSetup');
const play=q('#tttxPlay');
const result=q('#tttxResult');
const progress=q('#tttxProgress');
const board=q('#tttxBoard');
const you=q('#tttxYou');
const turn=q('#tttxTurn');
const mode=q('#tttxMode');
const ruleTitle=q('#tttxRuleTitle');
const ruleText=q('#tttxRuleText');
const resultMeta=q('#tttxResultMeta');
const resultRows=q('#tttxResultRows');
const headerState=q('#tttxHeaderState');
const opponentLabel=q('#tttxOpponentLabel');
const scoreX=q('#tttxScoreX');
const scoreO=q('#tttxScoreO');
const roundEl=q('#tttxRound');
const themeSelect=q('#tttxThemeSelect');

function show(page){
  setup.hidden=page!=='SETUP';
  play.hidden=page!=='PLAY';
  result.hidden=page!=='RESULT';
  progress.style.width=page==='SETUP'?'0%':(page==='PLAY'?'50%':'100%');
  if(headerState) headerState.textContent=page==='PLAY'?'SPIEL':(page==='RESULT'?'ERGEBNIS':'SETUP');
  document.body.classList.toggle('tttx-game-active',page==='PLAY');
}
function other(symbol){return symbol==='X'?'O':'X'}
function randomStarter(){return Math.random()<.5?'X':'O'}
function winningCells(cells){
  for(const line of WINS){
    const [a,b,c]=line;
    if(cells[a]&&cells[a]===cells[b]&&cells[a]===cells[c])return line;
  }
  return [];
}
function newSession(){
  clearTimeout(transitionTimer);
  const starter=randomStarter();
  game={
    mode:selectedMode,
    opponent:selectedOpponent,
    board:Array(9).fill(null),
    active:{X:[],O:[]},
    starter,
    current:starter,
    boardIndex:1,
    roundNumber:1,
    wins:{X:0,O:0},
    boardMoves:0,
    movesTotal:0,
    winner:null,
    winning:[],
    locked:false
  };
}
function prepareNextBoard(countRound=false){
  game.starter=other(game.starter);
  game.current=game.starter;
  game.board=Array(9).fill(null);
  game.active={X:[],O:[]};
  game.boardIndex+=1;
  game.boardMoves=0;
  game.winning=[];
  game.locked=false;
  if(countRound)game.roundNumber=Math.min(3,game.wins.X+game.wins.O+1);
  renderPlay();
  scheduleBotIfNeeded();
}
function resetBoardAfterDraw(){
  prepareNextBoard(false);
}
function ageClass(symbol,index){
  if(game.mode!=='DISAPPEAR'||!symbol)return '';
  const order=game.active[symbol];
  const pos=order.indexOf(index);
  if(pos<0)return '';
  if(order.length===1)return ' age-newest';
  if(order.length===2)return pos===0?' age-middle':' age-newest';
  return pos===0?' age-oldest is-next-out':(pos===1?' age-middle':' age-newest');
}
function markSvg(symbol){
  if(symbol==='X'){
    return '<svg class="tttx-mark" viewBox="0 0 100 100" aria-hidden="true">'
      +'<path class="tttx-shape-fill" d="M14 22 L22 14 L50 42 L78 14 L86 22 L58 50 L86 78 L78 86 L50 58 L22 86 L14 78 L42 50 Z"/>'
      +'</svg>';
  }
  return '<svg class="tttx-mark" viewBox="0 0 100 100" aria-hidden="true">'
    +'<path class="tttx-shape-fill" fill-rule="evenodd" d="M50 12a38 38 0 1 1 0 76 38 38 0 0 1 0-76Zm0 14a24 24 0 1 0 0 48 24 24 0 0 0 0-48Z"/>'
    +'</svg>';
}
function renderBoard(){
  const botTurn=game.opponent==='BOT'&&game.current==='O';
  board.innerHTML=game.board.map((symbol,index)=>{
    const winning=game.winning.includes(index);
    const disabled=game.locked||botTurn||!!symbol;
    const age=ageClass(symbol,index);
    const color=symbol?PLAYERS[symbol].color:'var(--theme-accent)';
    return `<button class="tttx-cell${winning?' is-winning':''}${age}" style="--tttx-mark-color:${color}" type="button" role="gridcell" data-cell="${index}" ${disabled?'disabled':''} aria-label="${symbol?PLAYERS[symbol].name+' · '+symbol:'Feld '+(index+1)}">${symbol?markSvg(symbol):''}</button>`;
  }).join('');
  board.querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>move(Number(btn.dataset.cell),'HUMAN')));
}
function renderPlay(){
  if(you)you.textContent='X';
  turn.textContent=game.opponent==='BOT'&&game.current==='O'?'BOT':PLAYERS[game.current].name;
  mode.textContent=game.mode;
  if(scoreX)scoreX.textContent=game.wins.X;
  if(scoreO)scoreO.textContent=game.wins.O;
  if(roundEl)roundEl.textContent='RUNDE '+Math.min(3,game.wins.X+game.wins.O+1);
  if(opponentLabel) opponentLabel.textContent=game.opponent==='BOT'?'BOT':'PLAYER 2';
  renderBoard();
}
function start(){
  newSession();
  show('PLAY');
  renderPlay();
  scheduleBotIfNeeded();
}
function simulateMoveState(index,symbol){
  const cells=[...game.board];
  const active={X:[...game.active.X],O:[...game.active.O]};
  cells[index]=symbol;
  active[symbol].push(index);
  if(game.mode==='DISAPPEAR'&&active[symbol].length>3){
    const oldest=active[symbol].shift();
    cells[oldest]=null;
  }
  return {cells,active};
}
function botChoice(){
  const free=game.board.map((v,i)=>v?null:i).filter(i=>i!==null);
  if(!free.length)return null;

  for(const symbol of ['O','X']){
    for(const index of free){
      const state=simulateMoveState(index,symbol);
      if(winningCells(state.cells).length)return index;
    }
  }

  if(free.includes(4))return 4;
  const corners=[0,2,6,8].filter(i=>free.includes(i));
  if(corners.length)return corners[Math.floor(Math.random()*corners.length)];
  return free[Math.floor(Math.random()*free.length)];
}
function scheduleBotIfNeeded(){
  clearTimeout(transitionTimer);
  if(!game||game.winner||game.opponent!=='BOT'||game.current!=='O')return;
  game.locked=true;
  renderPlay();
  transitionTimer=setTimeout(()=>{
    if(!game||game.winner||game.current!=='O')return;
    game.locked=false;
    const choice=botChoice();
    if(choice!==null)move(choice,'BOT');
  },420);
}
function move(index,source='HUMAN'){
  if(!game||game.locked||!Number.isInteger(index)||index<0||index>8||game.board[index])return;
  if(game.opponent==='BOT'&&game.current==='O'&&source!=='BOT')return;

  const actor=game.current;
  game.locked=true;
  game.board[index]=actor;
  game.active[actor].push(index);
  game.boardMoves+=1;
  game.movesTotal+=1;

  if(game.mode==='DISAPPEAR'&&game.active[actor].length>3){
    const oldest=game.active[actor].shift();
    game.board[oldest]=null;
  }

  game.winning=winningCells(game.board);
  if(game.winning.length){
    game.wins[actor]+=1;
    renderPlay();
    if(game.wins[actor]>=2){
      game.winner=actor;
      transitionTimer=setTimeout(renderResult,650);
    }else{
      transitionTimer=setTimeout(()=>prepareNextBoard(true),850);
    }
    return;
  }

  const full=game.board.every(Boolean);
  if(game.mode==='NORMAL'&&full){
    renderPlay();
    transitionTimer=setTimeout(resetBoardAfterDraw,420);
    return;
  }

  game.current=other(actor);
  game.locked=false;
  renderPlay();
  scheduleBotIfNeeded();
}
function playerName(symbol){
  return game?.opponent==='BOT'&&symbol==='O'?'BOT':PLAYERS[symbol].name;
}
function placementPoints(place){return place===1?5:4}
function row(symbol,placement){
  return `<div class="tttx-result-row" style="--delay:${140+(placement-1)*120}ms">
    <b>${String(placement).padStart(2,'0')}</b>
    <span class="tttx-result-player"><i style="--tttx-player:${PLAYERS[symbol].color}"></i><strong>${playerName(symbol)}</strong></span>
    <strong>${game.wins[symbol]}</strong>
    <span class="tttx-placement-points"><b>+${placementPoints(placement)}</b></span>
  </div>`;
}
function renderResult(){
  game.locked=true;
  const loser=other(game.winner);
  resultMeta.textContent=`BO3 · ${game.mode}`;
  resultRows.innerHTML=row(game.winner,1)+row(loser,2);
  show('RESULT');
  const card=document.querySelector('.tttx-result-card');
  requestAnimationFrame(()=>{
    card?.classList.add('is-revealing');
    const rows=[...resultRows.querySelectorAll('.tttx-result-row')];
    [...rows].reverse().forEach((el,i)=>setTimeout(()=>el.classList.add('is-plus-visible'),2000+i*260));
  });
}
function selectMode(next){
  if(!MODES[next])return;
  selectedMode=next;
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===next));
  ruleTitle.textContent=MODES[next].title;
  ruleText.textContent=MODES[next].rule;
}
function selectOpponent(next){
  if(!['BOT','HUMAN'].includes(next))return;
  selectedOpponent=next;
  document.querySelectorAll('[data-opponent]').forEach(btn=>btn.classList.toggle('active',btn.dataset.opponent===next));
}
function applyTheme(id){
  const theme=String(id||'theme.skielsen.core');
  document.documentElement.dataset.themePack=theme;
  document.body.dataset.themePack=theme;
  if(themeSelect)themeSelect.value=theme;
  try{localStorage.setItem('skielsen.ttt.theme.qa',theme)}catch(_){}
}
function setupThemeQa(){
  if(!themeSelect)return;
  let stored='theme.skielsen.core';
  try{stored=localStorage.getItem('skielsen.ttt.theme.qa')||stored}catch(_){}
  if(![...themeSelect.options].some(o=>o.value===stored))stored='theme.skielsen.core';
  applyTheme(stored);
  themeSelect.addEventListener('change',()=>applyTheme(themeSelect.value));
}
function setupPage(){
  clearTimeout(transitionTimer);
  game=null;
  show('SETUP');
  selectMode(selectedMode);
  selectOpponent(selectedOpponent);
}

document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>selectMode(btn.dataset.mode)));
document.querySelectorAll('[data-opponent]').forEach(btn=>btn.addEventListener('click',()=>selectOpponent(btn.dataset.opponent)));
q('#tttxStart').addEventListener('click',start);
q('#tttxAgain').addEventListener('click',setupPage);

setupThemeQa();
show('SETUP');
selectMode('NORMAL');
selectOpponent('BOT');
})();