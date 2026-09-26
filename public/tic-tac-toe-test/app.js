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
const lifeX=q('#tttxLifeX');
const lifeO=q('#tttxLifeO');
const ruleTitle=q('#tttxRuleTitle');
const ruleText=q('#tttxRuleText');
const resultMeta=q('#tttxResultMeta');
const resultRows=q('#tttxResultRows');

function show(page){
  setup.hidden=page!=='SETUP';
  play.hidden=page!=='PLAY';
  result.hidden=page!=='RESULT';
  progress.style.width=page==='SETUP'?'0%':(page==='PLAY'?'50%':'100%');
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
function renderLifeTrack(symbol,target){
  if(game.mode!=='DISAPPEAR'){
    target.classList.remove('is-visible');
    target.innerHTML='';
    return;
  }
  const count=game.active[symbol].length;
  target.classList.add('is-visible');
  target.style.setProperty('--tttx-life-color',PLAYERS[symbol].color);
  target.innerHTML=[0,1,2].map(i=>{
    const used=i<count;
    const nextOut=count===3&&i===0;
    return `<i class="tttx-life-dot${used?' is-used':''}${nextOut?' is-next-out':''}" aria-hidden="true"></i>`;
  }).join('');
  target.setAttribute('aria-label',count===3
    ? `${PLAYERS[symbol].name}: ältestes Symbol verschwindet beim nächsten eigenen Zug`
    : `${PLAYERS[symbol].name}: ${count} von 3 aktiven Symbolen`);
}
function renderBoard(){
  board.innerHTML=game.board.map((symbol,index)=>{
    const winning=game.winning.includes(index);
    const disabled=game.locked||!!symbol;
    const age=ageClass(symbol,index);
    const color=symbol?PLAYERS[symbol].color:'var(--theme-accent)';
    return `<button class="tttx-cell${winning?' is-winning':''}${age}" style="--tttx-mark-color:${color}" type="button" role="gridcell" data-cell="${index}" ${disabled?'disabled':''} aria-label="${symbol?PLAYERS[symbol].name+' · '+symbol:'Feld '+(index+1)}">${symbol?`<span class="tttx-mark">${symbol}</span>`:''}</button>`;
  }).join('');
  board.querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>move(Number(btn.dataset.cell))));
}
function renderPlay(){
  you.textContent='X';
  turn.textContent=PLAYERS[game.current].name;
  mode.textContent=game.mode;
  renderLifeTrack('X',lifeX);
  renderLifeTrack('O',lifeO);
  renderBoard();
}
function start(){
  newSession();
  show('PLAY');
  renderPlay();
}
function move(index){
  if(!game||game.locked||!Number.isInteger(index)||index<0||index>8||game.board[index])return;

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
}
function row(symbol,placement){
  const won=symbol===game.winner;
  return `<div class="tttx-result-row">
    <b>${placement}.</b>
    <span class="tttx-result-player"><i style="--tttx-player:${PLAYERS[symbol].color}"></i><strong>${PLAYERS[symbol].name}</strong></span>
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
function setupPage(){
  clearTimeout(transitionTimer);
  game=null;
  show('SETUP');
  selectMode(selectedMode);
}

document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>selectMode(btn.dataset.mode)));
q('#tttxStart').addEventListener('click',start);
q('#tttxAgain').addEventListener('click',setupPage);

show('SETUP');
selectMode('NORMAL');
})();