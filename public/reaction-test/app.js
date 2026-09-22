(()=>{
'use strict';

const COLORS=['var(--core-red)','var(--core-blue)','var(--core-green)','var(--core-yellow)'];
const MOCK_PLAYERS=[
  {id:'p1',name:'DJEELOI',participant:'A',color:COLORS[0]},
  {id:'p2',name:'SOFYA',participant:'B',color:COLORS[1]},
  {id:'p3',name:'HANNES',participant:'C',color:COLORS[2]},
  {id:'p4',name:'PIA',participant:'D',color:COLORS[3]}
];
const EASY_LIGHT_STEP_MS=420;
const EASY_HOLD_MIN_MS=700;
const EASY_HOLD_MAX_MS=2200;
const NORMAL_WAIT_MIN_MS=1800;
const NORMAL_WAIT_MAX_MS=4200;

let difficulty='EASY';
let mode=new URLSearchParams(location.search).get('mode')?.toUpperCase()==='TEAM'?'TEAM':'SOLO';
let page='SETUP',playerIndex=0,attempt=1,roundState='READY',armed=false,signalAt=0,timer=0,lightTimer=0,locked=false;
let players=MOCK_PLAYERS.map(p=>Object.assign({},p,{attempts:[]}));

const $=s=>document.querySelector(s);
const setup=$('#rxSetup'),ready=$('#rxReady'),play=$('#rxPlay'),result=$('#rxResult');
const lightZone=$('#rxLightZone'),lights=[...document.querySelectorAll('#rxLights i')];
const pad=$('#rxPad'),padValue=$('#rxPadValue'),padLabel=$('#rxPadLabel');

function current(){return players[playerIndex]}
function validTimes(p){return p.attempts.filter(x=>Number.isFinite(x))}
function best(p){const v=validTimes(p);return v.length?Math.min(...v):null}
function fmt(v){return Number.isFinite(v)?Math.round(v)+' ms':'—'}
function fmtAttempt(v){return Number.isFinite(v)?Math.round(v)+' ms':'FS'}
function randomBetween(min,max){return min+Math.random()*(max-min)}

function setPage(next){
  page=next;
  setup.hidden=next!=='SETUP';
  ready.hidden=next!=='READY';
  play.hidden=next!=='PLAY';
  result.hidden=next!=='RESULT';
  $('#rxProgress').style.width=next==='SETUP'?'20%':next==='READY'?'40%':next==='PLAY'?'75%':'100%';
  $('#rxHeaderState').textContent=next==='SETUP'?'SCHWIERIGKEIT':next==='READY'?'READY':next==='PLAY'?'GAME':'RANKING';
  $('#rxHeaderMode').textContent=mode;
}

function renderReady(){
  $('#rxReadyPlayers').innerHTML=players.map(function(p){
    return '<div class="rx-player-row"><i style="--rx-player:'+p.color+'"></i><strong>'+p.name+'</strong><b class="ready">BEREIT</b></div>';
  }).join('');
  $('#rxReadyTitle').textContent=difficulty==='EASY'?'LICHTER AUS = DRÜCKEN.':'FARBWECHSEL = DRÜCKEN.';
  $('#rxReadyCopy').textContent='Jeder Spieler hat zwei Versuche direkt hintereinander. Die schnellere gültige Reaktionszeit zählt. Zu frühes Drücken ist ein Fehlstart und verbraucht den Versuch.';
}

function clearTimers(){
  clearTimeout(timer);
  clearTimeout(lightTimer);
  timer=0;
  lightTimer=0;
}

function clearRound(){
  clearTimers();
  armed=false;
  locked=false;
  roundState='READY';
  lights.forEach(x=>x.classList.remove('on'));
  pad.className='rx-pad start';
  padValue.textContent='VERSUCH STARTEN';
  padLabel.textContent='ZUM STARTEN DRÜCKEN';
}

function showPlay(){
  clearRound();
  $('#rxPlayerName').textContent=current().name;
  $('#rxAttempt').textContent=attempt+' / 2';
  $('#rxBest').textContent=fmt(best(current()));
  lightZone.hidden=difficulty!=='EASY';
}

function armEasySignal(){
  lights.forEach(x=>x.classList.remove('on'));
  roundState='ARMED';
  armed=true;
  signalAt=performance.now();
  pad.className='rx-pad waiting';
  padValue.textContent='';
  padLabel.textContent='';
}

function armNormalSignal(){
  roundState='ARMED';
  armed=true;
  signalAt=performance.now();
  pad.className='rx-pad signal';
  padValue.textContent='';
  padLabel.textContent='';
}

function beginAttempt(){
  if(roundState!=='READY')return;
  roundState='WAITING';
  locked=false;
  armed=false;
  pad.className='rx-pad waiting';
  padValue.textContent='';
  padLabel.textContent='';
  if(difficulty==='EASY')startEasy();
  else startNormal();
}

function startEasy(){
  let idx=0;
  function step(){
    if(roundState!=='WAITING')return;
    if(idx<5){
      lights[idx].classList.add('on');
      idx+=1;
      lightTimer=setTimeout(step,EASY_LIGHT_STEP_MS);
      return;
    }
    lightTimer=setTimeout(function(){
      if(roundState==='WAITING')armEasySignal();
    },randomBetween(EASY_HOLD_MIN_MS,EASY_HOLD_MAX_MS));
  }
  lightTimer=setTimeout(step,300);
}

function startNormal(){
  timer=setTimeout(function(){
    if(roundState==='WAITING')armNormalSignal();
  },randomBetween(NORMAL_WAIT_MIN_MS,NORMAL_WAIT_MAX_MS));
}

function press(e){
  if(page!=='PLAY'||locked)return;
  if(e)e.preventDefault();
  if(roundState==='READY'){
    beginAttempt();
    return;
  }
  locked=true;
  clearTimers();
  if(roundState==='WAITING'||!armed){
    finishAttempt(null,true);
    return;
  }
  if(roundState==='ARMED'){
    finishAttempt(performance.now()-signalAt,false);
  }
}

function finishAttempt(ms,falseStart){
  current().attempts.push(Number.isFinite(ms)?ms:null);
  armed=false;
  roundState='RESULT';
  pad.className='rx-pad '+(falseStart?'false-start':'result');
  padValue.textContent=falseStart?'FEHLSTART':fmt(ms);
  padLabel.textContent=falseStart?'VERSUCH VERBRAUCHT':'REAKTIONSZEIT';
  setTimeout(function(){
    if(attempt<2){
      attempt+=1;
      showPlay();
      return;
    }
    if(playerIndex<players.length-1){
      playerIndex+=1;
      attempt=1;
      showPlay();
      return;
    }
    renderResult();
    setPage('RESULT');
  },1200);
}

function teamRows(){
  const pairs=[[players[0],players[1]],[players[2],players[3]]];
  return pairs.map(function(pair,i){
    const times=pair.map(best);
    const sum=times.every(Number.isFinite)?times[0]+times[1]:null;
    return {
      name:'TEAM '+String.fromCharCode(65+i),
      color:pair[0].color,
      members:pair.map(x=>x.name).join(' + '),
      sum:sum,
      times:times
    };
  }).sort(function(a,b){return (a.sum??Infinity)-(b.sum??Infinity)});
}

function renderResult(){
  $('#rxResultMeta').textContent=difficulty+' · '+mode;
  if(mode==='TEAM'){
    $('#rxResultColumns').innerHTML='<span>POSITION</span><span>TEAM</span><span>SUMME</span><span>DETAIL</span>';
    $('#rxResultRows').innerHTML=teamRows().map(function(r,i){
      return '<div class="rx-result-row"><b>'+(i+1)+'.</b><span class="rx-result-player"><i style="--rx-player:'+r.color+'"></i><strong>'+r.name+'</strong></span><strong>'+fmt(r.sum)+'</strong><strong>'+r.times.map(fmt).join(' + ')+'</strong></div>';
    }).join('');
    return;
  }
  const sorted=[...players].sort(function(a,b){return (best(a)??Infinity)-(best(b)??Infinity)});
  $('#rxResultColumns').innerHTML='<span>POSITION</span><span>NAME</span><span>BEST</span><span>VERSUCHE</span>';
  $('#rxResultRows').innerHTML=sorted.map(function(p,i){
    return '<div class="rx-result-row"><b>'+(i+1)+'.</b><span class="rx-result-player"><i style="--rx-player:'+p.color+'"></i><strong>'+p.name+'</strong></span><strong>'+fmt(best(p))+'</strong><strong>'+p.attempts.map(fmtAttempt).join(' / ')+'</strong></div>';
  }).join('');
}

function reset(){
  clearRound();
  players=MOCK_PLAYERS.map(p=>Object.assign({},p,{attempts:[]}));
  playerIndex=0;
  attempt=1;
  setPage('SETUP');
}

document.querySelectorAll('[data-difficulty]').forEach(function(btn){
  btn.addEventListener('click',function(){
    difficulty=btn.dataset.difficulty;
    document.querySelectorAll('[data-difficulty]').forEach(x=>x.classList.toggle('active',x===btn));
  });
});
$('#rxToReady').addEventListener('click',function(){renderReady();setPage('READY')});
$('#rxReadyButton').addEventListener('click',function(){setPage('PLAY');showPlay()});
pad.addEventListener('pointerdown',press,{passive:false});
$('#rxClose').addEventListener('click',reset);
setPage('SETUP');
})();
