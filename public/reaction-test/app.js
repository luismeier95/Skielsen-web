(()=>{
'use strict';

const COLORS=['var(--core-red)','var(--core-blue)','var(--core-green)','var(--core-yellow)'];
const MOCK_PLAYERS=[
  {id:'p1',name:'DJEELOI',participant:'A',color:COLORS[0]},
  {id:'p2',name:'SOFYA',participant:'B',color:COLORS[1]},
  {id:'p3',name:'HANNES',participant:'C',color:COLORS[2]},
  {id:'p4',name:'PIA',participant:'D',color:COLORS[3]}
];
let difficulty='EASY';
let mode=new URLSearchParams(location.search).get('mode')?.toUpperCase()==='TEAM'?'TEAM':'SOLO';
let page='SETUP', playerIndex=0, attempt=1, armed=false, signalAt=0, timer=0, lightTimer=0, locked=false;
let players=MOCK_PLAYERS.map(p=>({...p,attempts:[]}));

const $=s=>document.querySelector(s);
const setup=$('#rxSetup'),ready=$('#rxReady'),play=$('#rxPlay'),result=$('#rxResult');
const lightZone=$('#rxLightZone'),lights=[...document.querySelectorAll('#rxLights i')];
const pad=$('#rxPad'),padValue=$('#rxPadValue'),padLabel=$('#rxPadLabel');

function current(){return players[playerIndex]}
function validTimes(p){return p.attempts.filter(x=>Number.isFinite(x))}
function best(p){const v=validTimes(p);return v.length?Math.min(...v):null}
function fmt(v){return Number.isFinite(v)?Math.round(v)+' ms':'—'}
function setPage(next){
  page=next;setup.hidden=next!=='SETUP';ready.hidden=next!=='READY';play.hidden=next!=='PLAY';result.hidden=next!=='RESULT';
  $('#rxProgress').style.width=next==='SETUP'?'20%':next==='READY'?'40%':next==='PLAY'?'75%':'100%';
  $('#rxHeaderState').textContent=next==='SETUP'?'SCHWIERIGKEIT':next==='READY'?'READY':next==='PLAY'?'GAME':'RANKING';
  $('#rxHeaderMode').textContent=mode;
}
function renderReady(){
  $('#rxReadyPlayers').innerHTML=players.map((p,i)=>`<div class="rx-player-row"><i style="--rx-player:${p.color}"></i><strong>${p.name}</strong><b class="${i===0?'ready':''}">${i===0?'BEREIT':'WARTET'}</b></div>`).join('');
  $('#rxReadyTitle').textContent=difficulty==='EASY'?'LICHTER AUS = DRÜCKEN.':'FARBWECHSEL = DRÜCKEN.';
  $('#rxReadyCopy').textContent='Jeder Spieler hat zwei Versuche direkt hintereinander. Die schnellere gültige Reaktionszeit zählt. Zu frühes Drücken ist ein Fehlstart und verbraucht den Versuch.';
}
function clearRound(){
  clearTimeout(timer);clearTimeout(lightTimer);timer=0;lightTimer=0;armed=false;locked=false;
  lights.forEach(x=>x.classList.remove('on'));
  pad.className='rx-pad waiting';
  padValue.textContent='WARTEN';
  padLabel.textContent='AUF DAS SIGNAL WARTEN';
}
function showPlay(){
  clearRound();
  $('#rxPlayerName').textContent=current().name;
  $('#rxAttempt').textContent=attempt+' / 2';
  $('#rxBest').textContent=fmt(best(current()));
  lightZone.hidden=difficulty!=='EASY';
  if(difficulty==='EASY')startEasy();else startNormal();
}
function armSignal(){
  pad.className='rx-pad signal';
  padValue.textContent='JETZT!';
  padLabel.textContent='DRÜCKEN';
  signalAt=performance.now();
  armed=true;
}
function startEasy(){
  let idx=0;
  const step=()=>{
    if(idx<5){
      lights[idx].classList.add('on');
      idx++;
      lightTimer=setTimeout(step,420);
      return;
    }
    lights.forEach(x=>x.classList.remove('on'));
    armSignal();
  };
  lightTimer=setTimeout(step,350);
}
function startNormal(){
  const wait=1400+Math.random()*3000;
  timer=setTimeout(armSignal,wait);
}
function press(e){
  if(page!=='PLAY'||locked)return;
  if(e)e.preventDefault();
  locked=true;
  clearTimeout(timer);clearTimeout(lightTimer);
  if(!armed){finishAttempt(null,true);return}
  finishAttempt(performance.now()-signalAt,false);
}
function finishAttempt(ms,falseStart){
  current().attempts.push(Number.isFinite(ms)?ms:null);
  armed=false;
  pad.className='rx-pad '+(falseStart?'false-start':'result');
  padValue.textContent=falseStart?'FEHLSTART':fmt(ms);
  padLabel.textContent=falseStart?'VERSUCH VERBRAUCHT':'REAKTIONSZEIT';
  setTimeout(()=>{
    if(attempt<2){attempt++;showPlay();return}
    if(playerIndex<players.length-1){playerIndex++;attempt=1;showPlay();return}
    renderResult();setPage('RESULT');
  },1200);
}
function teamRows(){
  const pairs=[[players[0],players[1]],[players[2],players[3]]];
  return pairs.map((pair,i)=>{
    const times=pair.map(best),sum=times.every(Number.isFinite)?times[0]+times[1]:null;
    return {name:'TEAM '+String.fromCharCode(65+i),color:pair[0].color,members:pair.map(x=>x.name).join(' + '),sum,times};
  }).sort((a,b)=>(a.sum??Infinity)-(b.sum??Infinity));
}
function renderResult(){
  $('#rxResultMeta').textContent=difficulty+' · '+mode;
  if(mode==='TEAM'){
    $('#rxResultColumns').innerHTML='<span>POSITION</span><span>TEAM</span><span>SUMME</span><span>DETAIL</span>';
    $('#rxResultRows').innerHTML=teamRows().map((r,i)=>`<div class="rx-result-row"><b>${i+1}.</b><span class="rx-result-player"><i style="--rx-player:${r.color}"></i><strong>${r.name}</strong></span><strong>${fmt(r.sum)}</strong><strong>${r.times.map(fmt).join(' + ')}</strong></div>`).join('');
  }else{
    const sorted=[...players].sort((a,b)=>(best(a)??Infinity)-(best(b)??Infinity));
    $('#rxResultColumns').innerHTML='<span>POSITION</span><span>NAME</span><span>BEST</span><span>VERSUCHE</span>';
    $('#rxResultRows').innerHTML=sorted.map((p,i)=>`<div class="rx-result-row"><b>${i+1}.</b><span class="rx-result-player"><i style="--rx-player:${p.color}"></i><strong>${p.name}</strong></span><strong>${fmt(best(p))}</strong><strong>${p.attempts.map(fmt).join(' / ')}</strong></div>`).join('');
  }
}
function reset(){
  clearRound();players=MOCK_PLAYERS.map(p=>({...p,attempts:[]}));playerIndex=0;attempt=1;setPage('SETUP');
}
document.querySelectorAll('[data-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{
  difficulty=btn.dataset.difficulty;
  document.querySelectorAll('[data-difficulty]').forEach(x=>x.classList.toggle('active',x===btn));
}));
$('#rxToReady').addEventListener('click',()=>{renderReady();setPage('READY')});
$('#rxReadyButton').addEventListener('click',()=>{setPage('PLAY');showPlay()});
pad.addEventListener('pointerdown',press,{passive:false});
$('#rxClose').addEventListener('click',reset);
setPage('SETUP');
})();
