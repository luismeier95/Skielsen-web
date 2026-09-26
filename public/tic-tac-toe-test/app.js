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
let selectedTurnSeconds=0;
let game=null;
let transitionTimer=0;
let turnDeadline=0;
let turnTickTimer=0;


const q=s=>document.querySelector(s);
const setup=q('#tttxSetup');
const ready=q('#tttxReady');
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
const turnTimerEl=q('#tttxTurnTimer');
const turnTimerBar=q('#tttxTurnTimerBar');
const turnTimerTrack=q('#tttxTurnTimerTrack');
const readyMode=q('#tttxReadyMode');
const readyTimer=q('#tttxReadyTimer');
const readyTimeout=q('#tttxReadyTimeout');
const readyOpponent=q('#tttxReadyOpponent');
const themeSelect=q('#tttxThemeSelect');

function show(page){
  setup.hidden=page!=='SETUP';
  ready.hidden=page!=='READY';
  play.hidden=page!=='PLAY';
  result.hidden=page!=='RESULT';
  progress.style.width=page==='SETUP'?'0%':(page==='READY'?'33%':(page==='PLAY'?'66%':'100%'));
  if(headerState) headerState.textContent=page==='READY'?'READY':(page==='PLAY'?'SPIEL':(page==='RESULT'?'ERGEBNIS':'SETUP'));
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
    points:{X:0,O:0},
    turnSeconds:selectedTurnSeconds,
    boardMoves:0,
    movesTotal:0,
    winner:null,
    winning:[],
    lastMove:null,
    locked:false
  };
}
function prepareNextBoard(countRound=false){
  stopTurnTimer();
  game.starter=other(game.starter);
  game.current=game.starter;
  game.board=Array(9).fill(null);
  game.active={X:[],O:[]};
  game.boardIndex+=1;
  game.boardMoves=0;
  game.winning=[];
  game.lastMove=null;
  if(countRound)game.roundNumber+=1;

  const overtimeStart=countRound&&game.roundNumber>=5&&game.roundNumber%2===1;
  game.locked=overtimeStart;
  renderPlay();

  if(overtimeStart){
    showOvertimeOverlay(()=>{
      if(!game)return;
      game.locked=false;
      renderPlay();
      startTurnTimer();
      scheduleBotIfNeeded();
    });
    return;
  }

  game.locked=false;
  renderPlay();
  startTurnTimer();
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
function cellCenter(index,rect,cell){
  const r=cell.getBoundingClientRect();
  return {
    x:r.left-rect.left+r.width/2,
    y:r.top-rect.top+r.height/2
  };
}
function renderWinningLine(){
  if(!game?.winning?.length||!Number.isInteger(game.lastMove))return;
  const boardRect=board.getBoundingClientRect();
  if(!boardRect.width||!boardRect.height)return;
  const lastCell=board.querySelector('[data-cell="'+game.lastMove+'"]');
  if(!lastCell)return;
  const start=cellCenter(game.lastMove,boardRect,lastCell);
  const endpoints=game.winning
    .filter(index=>index!==game.lastMove)
    .map(index=>({index,cell:board.querySelector('[data-cell="'+index+'"]')}))
    .filter(item=>item.cell)
    .map(item=>({index:item.index,point:cellCenter(item.index,boardRect,item.cell)}));

  if(!endpoints.length)return;

  let targets=endpoints;
  const lastPos=game.winning.indexOf(game.lastMove);
  if(lastPos===0||lastPos===game.winning.length-1){
    const targetIndex=lastPos===0?game.winning[game.winning.length-1]:game.winning[0];
    const target=endpoints.find(item=>item.index===targetIndex);
    targets=target?[target]:[endpoints[endpoints.length-1]];
  }

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('tttx-win-line');
  svg.setAttribute('viewBox',`0 0 ${boardRect.width} ${boardRect.height}`);
  svg.style.setProperty('--tttx-win-color',PLAYERS[game.current].color);

  targets.forEach(({point})=>{
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',start.x);
    line.setAttribute('y1',start.y);
    line.setAttribute('x2',point.x);
    line.setAttribute('y2',point.y);
    const length=Math.hypot(point.x-start.x,point.y-start.y);
    line.style.setProperty('--tttx-win-length',String(length));
    line.style.strokeDasharray=String(length);
    line.style.strokeDashoffset=String(length);
    svg.appendChild(line);
  });
  board.appendChild(svg);
}
function showOvertimeOverlay(done){
  const host=document.createElement('div');
  host.className='tttx-overtime-overlay';
  host.setAttribute('aria-live','polite');
  host.innerHTML='<b>OVERTIME</b><span>'+playerName(game.starter)+' BEGINNT</span>';
  board.appendChild(host);
  transitionTimer=setTimeout(()=>{
    host.remove();
    done();
  },1800);
}
function startRoundCountdown(done){
  clearTimeout(transitionTimer);
  transitionTimer=setTimeout(()=>{
    if(!game)return;
    let value=3;
    const host=document.createElement('div');
    host.className='tttx-round-countdown';
    host.setAttribute('aria-live','polite');
    host.innerHTML='<b>3</b>';
    board.appendChild(host);

    const tick=()=>{
      if(!game)return;
      value-=1;
      if(value>0){
        const label=host.querySelector('b');
        if(label)label.textContent=String(value);
        transitionTimer=setTimeout(tick,1000);
        return;
      }
      host.remove();
      done();
    };
    transitionTimer=setTimeout(tick,1000);
  },340);
}

function stopTurnTimer(){
  clearInterval(turnTickTimer);
  turnTickTimer=0;
  turnDeadline=0;
}
function setTimerBarProgress(ratio){
  const r=Math.max(0,Math.min(1,Number(ratio)||0));
  if(turnTimerBar)turnTimerBar.style.transform='scaleX('+r+')';
}
function updateTurnTimer(){
  const seconds=Number(game?.turnSeconds||0);
  if(!seconds){
    if(turnTimerEl)turnTimerEl.textContent='AUS';
    if(turnTimerTrack)turnTimerTrack.classList.add('is-passive');
    setTimerBarProgress(1);
    return;
  }
  if(turnTimerTrack)turnTimerTrack.classList.remove('is-passive');
  if(!turnDeadline||!game||game.locked||game.winning.length){
    if(turnTimerEl)turnTimerEl.textContent=seconds.toFixed(0);
    setTimerBarProgress(1);
    return;
  }
  const total=seconds*1000;
  const left=Math.max(0,turnDeadline-performance.now());
  if(turnTimerEl)turnTimerEl.textContent=(left/1000).toFixed(1);
  setTimerBarProgress(left/total);
  if(turnTimerTrack){
    turnTimerTrack.classList.toggle('danger',left<=1000);
    turnTimerTrack.classList.toggle('warning',left>1000&&left<=Math.min(2500,total*.4));
  }
}
function startTurnTimer(){
  stopTurnTimer();
  const seconds=Number(game?.turnSeconds||0);
  updateTurnTimer();
  if(!seconds||!game||game.winner||game.locked||game.winning.length)return;
  turnDeadline=performance.now()+seconds*1000;
  updateTurnTimer();
  turnTickTimer=setInterval(()=>{
    if(!game||game.winner||game.locked||game.winning.length){
      stopTurnTimer();
      return;
    }
    updateTurnTimer();
    if(performance.now()>=turnDeadline){
      const actor=game.current;
      stopTurnTimer();
      const index=worstMoveChoice(actor);
      if(index!==null)move(index,'TIMEOUT');
    }
  },50);
}
function simulateStateFrom(cells,active,index,symbol){
  const nextCells=[...cells];
  const nextActive={X:[...active.X],O:[...active.O]};
  nextCells[index]=symbol;
  nextActive[symbol].push(index);
  if(game.mode==='DISAPPEAR'&&nextActive[symbol].length>3){
    const oldest=nextActive[symbol].shift();
    nextCells[oldest]=null;
  }
  return {cells:nextCells,active:nextActive};
}
function badnessScore(index,symbol){
  const first=simulateStateFrom(game.board,game.active,index,symbol);
  if(winningCells(first.cells).length)return 1000;
  const rival=other(symbol);
  const free=first.cells.map((v,i)=>v?null:i).filter(i=>i!==null);
  let opponentCanWin=false;
  for(const reply of free){
    const second=simulateStateFrom(first.cells,first.active,reply,rival);
    if(winningCells(second.cells).length){opponentCanWin=true;break;}
  }
  let score=0;
  if(opponentCanWin)score-=500;
  if(index===4)score+=30;
  else if([0,2,6,8].includes(index))score+=15;
  else score+=5;
  return score;
}
function worstMoveChoice(symbol){
  const free=game.board.map((v,i)=>v?null:i).filter(i=>i!==null);
  if(!free.length)return null;
  const scored=free.map(index=>({index,score:badnessScore(index,symbol)}));
  const worst=Math.min(...scored.map(x=>x.score));
  const pool=scored.filter(x=>x.score===worst);
  return pool[Math.floor(Math.random()*pool.length)].index;
}
function roundPointsFor(winner){
  return winner===game.starter?1:2;
}
function futureRoundPointsFor(symbol,roundNo){
  const offset=roundNo-game.roundNumber;
  let starter=game.starter;
  for(let i=0;i<offset;i++)starter=other(starter);
  return symbol===starter?1:2;
}
function decisionBlockEndRound(){
  if(game.roundNumber<4)return 4;
  return game.roundNumber%2===0?game.roundNumber:game.roundNumber+1;
}
function maxFuturePointsUntilDecision(symbol){
  const end=decisionBlockEndRound();
  let total=0;
  for(let r=game.roundNumber+1;r<=end;r++)total+=futureRoundPointsFor(symbol,r);
  return total;
}
function clinchedWinner(){
  const px=game.points.X,po=game.points.O;
  if(px===po)return null;
  const leader=px>po?'X':'O';
  const trailer=other(leader);
  return game.points[leader] > game.points[trailer] + maxFuturePointsUntilDecision(trailer)
    ? leader
    : null;
}
function shouldFinishMatch(){
  const clinched=clinchedWinner();
  if(clinched)return clinched;
  if(game.roundNumber>=4&&game.roundNumber%2===0&&game.points.X!==game.points.O){
    return game.points.X>game.points.O?'X':'O';
  }
  return null;
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
  if(game.winning.length)requestAnimationFrame(renderWinningLine);
}
function renderPlay(){
  if(you)you.textContent='X';
  if(turn)turn.textContent=game.opponent==='BOT'&&game.current==='O'?'BOT':PLAYERS[game.current].name;
  mode.textContent=game.mode;
  if(scoreX)scoreX.textContent=game.points.X;
  if(scoreO)scoreO.textContent=game.points.O;
  if(roundEl)roundEl.textContent='RUNDE '+game.roundNumber;
  updateTurnTimer();
  if(opponentLabel) opponentLabel.textContent=game.opponent==='BOT'?'BOT':'PLAYER 2';
  renderBoard();
}
function renderReadySummary(){
  if(readyMode)readyMode.textContent=selectedMode;
  if(readyTimer)readyTimer.textContent=selectedTurnSeconds?selectedTurnSeconds+' SEK':'AUS';
  if(readyTimeout)readyTimeout.textContent=selectedTurnSeconds
    ? 'ZEIT ABGELAUFEN → SCHLECHTESTER LEGALER ZUG WIRD AUTOMATISCH GESETZT'
    : 'KEIN ZUGTIMER · KEIN AUTO-ZUG';
  if(readyOpponent)readyOpponent.textContent=selectedOpponent==='BOT'?'BOT':'PLAYER 2';
}
function openReady(){
  renderReadySummary();
  show('READY');
}
function start(){
  newSession();
  show('PLAY');
  renderPlay();
  startTurnTimer();
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
  if(game.opponent==='BOT'&&game.current==='O'&&source!=='BOT'&&source!=='TIMEOUT')return;

  const actor=game.current;
  stopTurnTimer();
  game.locked=true;
  game.board[index]=actor;
  game.lastMove=index;
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
    game.points[actor]+=roundPointsFor(actor);
    renderPlay();
    const finishedWinner=shouldFinishMatch();
    if(finishedWinner){
      game.winner=finishedWinner;
      transitionTimer=setTimeout(renderResult,3000);
    }else{
      startRoundCountdown(()=>prepareNextBoard(true));
    }
    return;
  }

  const full=game.board.every(Boolean);
  if(game.mode==='NORMAL'&&full){
    renderPlay();
    startRoundCountdown(()=>prepareNextBoard(true));
    return;
  }

  game.current=other(actor);
  game.locked=false;
  renderPlay();
  startTurnTimer();
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
    <strong>${game.points[symbol]}</strong>
    <span class="tttx-placement-points"><b>+${placementPoints(placement)}</b></span>
  </div>`;
}
function renderResult(){
  stopTurnTimer();
  game.locked=true;
  const loser=other(game.winner);
  resultMeta.textContent=`4+ RUNDEN · ${game.turnSeconds?game.turnSeconds+'S':'ZEIT AUS'} · ${game.mode}`;
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
function selectTurnSeconds(value){
  const next=Number(value);
  if(![0,3,5,7].includes(next))return;
  selectedTurnSeconds=next;
  document.querySelectorAll('[data-turn-seconds]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.turnSeconds)===next));
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
  stopTurnTimer();
  game=null;
  show('SETUP');
  selectMode(selectedMode);
  selectOpponent(selectedOpponent);
  selectTurnSeconds(selectedTurnSeconds);
}

document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>selectMode(btn.dataset.mode)));
document.querySelectorAll('[data-opponent]').forEach(btn=>btn.addEventListener('click',()=>selectOpponent(btn.dataset.opponent)));
document.querySelectorAll('[data-turn-seconds]').forEach(btn=>btn.addEventListener('click',()=>selectTurnSeconds(btn.dataset.turnSeconds)));
q('#tttxStart').addEventListener('click',openReady);
q('#tttxReadyStart').addEventListener('click',start);
q('#tttxReadyBack').addEventListener('click',()=>show('SETUP'));
q('#tttxAgain').addEventListener('click',setupPage);

setupThemeQa();
show('SETUP');
selectMode('NORMAL');
selectOpponent('BOT');
selectTurnSeconds(0);
})();