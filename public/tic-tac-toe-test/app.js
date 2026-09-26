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
    boardMoves:0,
    movesTotal:0,
    winner:null,
    winning:[],
    locked:false
  };
}
function resetBoardAfterDraw(){
  game.starter=other(game.starter);
  game.current=game.starter;
  game.board=Array(9).fill(null);
  game.active={X:[],O:[]};
  game.boardIndex+=1;
  game.boardMoves=0;
  game.locked=false;
  renderPlay();
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
      +'<path class="tttx-shape" d="M22 22 L78 78 M78 22 L22 78"/>'
      +'<path class="tttx-oldest-shape tttx-oldest-x" d="M18 18 L82 82 M82 18 L18 82"/>'
      +'</svg>';
  }
  return '<svg class="tttx-mark" viewBox="0 0 100 100" aria-hidden="true">'
    +'<circle class="tttx-shape" cx="50" cy="50" r="31"/>'
    +'<circle class="tttx-oldest-shape tttx-oldest-ring-outer" cx="50" cy="50" r="34"/>'
    +'<circle class="tttx-oldest-shape tttx-oldest-ring-inner" cx="50" cy="50" r="22"/>'
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
  you.textContent='X';
  turn.textContent=game.opponent==='BOT'&&game.current==='O'?'BOT':PLAYERS[game.current].name;
  mode.textContent=game.mode;
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
    game.winner=actor;
    renderPlay();
    transitionTimer=setTimeout(renderResult,650);
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
function row(symbol,placement){
  const won=symbol===game.winner;
  return `<div class="tttx-result-row">
    <b>${placement}.</b>
    <span class="tttx-result-player"><i style="--tttx-player:${PLAYERS[symbol].color}"></i><strong>${playerName(symbol)}</strong></span>
    <strong>${won?'SIEG':'NIEDERLAGE'}</strong>
    <strong>${game.boardMoves}</strong>
  </div>`;
}
function renderResult(){
  game.locked=true;
  const loser=other(game.winner);
  resultMeta.textContent=`${game.mode} · ${game.boardIndex} BOARD${game.boardIndex===1?'':'S'}`;
  resultRows.innerHTML=row(game.winner,1)+row(loser,2);
  show('RESULT');
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

show('SETUP');
selectMode('NORMAL');
selectOpponent('BOT');
})();