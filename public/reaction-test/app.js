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
let page='SETUP', playerIndex=0, attempt=1, roundState='READY', armed=false, signalAt=0, timer=0, lightTimer=0, locked=false, resultAnimationRun=0;
let players=MOCK_PLAYERS.map(p=>({...p,attempts:[]}));

const $=s=>document.querySelector(s);
const setup=$('#rxSetup'),ready=$('#rxReady'),play=$('#rxPlay'),result=$('#rxResult');
const lightZone=$('#rxLightZone'),lights=[...document.querySelectorAll('#rxLights i')];
const pad=$('#rxPad'),padValue=$('#rxPadValue'),padLabel=$('#rxPadLabel');

function current(){return players[playerIndex]}
function validTimes(p){return p.attempts.filter(x=>Number.isFinite(x))}
function best(p){const v=validTimes(p);return v.length?Math.min(...v):null}
function fmt(v){return Number.isFinite(v)?Math.round(v)+' ms':'—'}
function gamePoints(place,valid=true){
  if(!valid)return 0;
  return [10,5,3,0][Math.max(0,Number(place)-1)]??0;
}
function countPoints(el,target,delay,run){
  el.textContent='0';
  setTimeout(()=>{
    if(run!==resultAnimationRun||!document.body.contains(el))return;
    if(target<=0){el.textContent='0';return}
    const started=performance.now(),duration=520;
    const step=now=>{
      if(run!==resultAnimationRun||!document.body.contains(el))return;
      const p=Math.min(1,(now-started)/duration);
      const eased=1-Math.pow(1-p,3);
      el.textContent=String(Math.round(target*eased));
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },delay);
}
function animateResultRanking(){
  const card=$('.rx-result-card');
  if(!card)return;
  const run=++resultAnimationRun;
  card.classList.remove('is-revealing');
  void card.offsetWidth;
  card.classList.add('is-revealing');
  [...card.querySelectorAll('.rx-result-row')].forEach((row,i)=>{
    const delay=180+i*150;
    row.style.setProperty('--rx-row-delay',delay+'ms');
    const points=row.querySelector('[data-rx-points]');
    if(points)countPoints(points,Number(points.dataset.rxPoints||0),delay+260,run);
  });
}
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
  clearTimeout(timer);clearTimeout(lightTimer);timer=0;lightTimer=0;armed=false;locked=false;roundState='READY';
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
function armSignal(){
  roundState='ARMED';
  pad.className='rx-pad signal';
  padValue.textContent='JETZT!';
  padLabel.textContent='DRÜCKEN';
  signalAt=performance.now();
  armed=true;
}
function beginAttempt(){
  if(roundState!=='READY')return;
  roundState='WAITING';
  locked=false;
  armed=false;
  pad.className='rx-pad waiting';
  padValue.textContent='WARTEN';
  padLabel.textContent='AUF DAS SIGNAL WARTEN';
  if(difficulty==='EASY')startEasy();else startNormal();
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
  const wait=2000+Math.random()*2000;
  timer=setTimeout(armSignal,wait);
}
function press(e){
  if(page!=='PLAY'||locked)return;
  if(e)e.preventDefault();
  if(roundState==='READY'){beginAttempt();return}
  locked=true;
  clearTimeout(timer);clearTimeout(lightTimer);
  if(roundState==='WAITING'||!armed){finishAttempt(null,true);return}
  if(roundState==='ARMED')finishAttempt(performance.now()-signalAt,false);
}
function finishAttempt(ms,falseStart){
  current().attempts.push(Number.isFinite(ms)?ms:null);
  armed=false;
  roundState='RESULT';
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
  $('#rxResultColumns').innerHTML=mode==='TEAM'
    ?'<span>POSITION</span><span>TEAM</span><span>SUMME</span><span>PUNKTE</span>'
    :'<span>POSITION</span><span>NAME</span><span>BEST</span><span>PUNKTE</span>';
  if(mode==='TEAM'){
    $('#rxResultRows').innerHTML=teamRows().map((r,i)=>{
      const pts=gamePoints(i+1,Number.isFinite(r.sum));
      const detail=r.times.map(fmt).join(' + ');
      return `<div class="rx-result-row">
        <b>${String(i+1).padStart(2,'0')}</b>
        <span class="rx-result-player">
          <i style="--rx-player:${r.color}"></i>
          <span class="rx-result-identity"><strong>${r.name}</strong><small>${r.members} · ${detail}</small></span>
        </span>
        <strong class="rx-result-metric">${fmt(r.sum)}</strong>
        <span class="rx-result-points"><b data-rx-points="${pts}">0</b><small>PTS</small></span>
      </div>`;
    }).join('');
  }else{
    const sorted=[...players].sort((a,b)=>(best(a)??Infinity)-(best(b)??Infinity));
    $('#rxResultRows').innerHTML=sorted.map((p,i)=>{
      const value=best(p),pts=gamePoints(i+1,Number.isFinite(value));
      const detail=p.attempts.map(fmt).join(' / ');
      return `<div class="rx-result-row">
        <b>${String(i+1).padStart(2,'0')}</b>
        <span class="rx-result-player">
          <i style="--rx-player:${p.color}"></i>
          <span class="rx-result-identity"><strong>${p.name}</strong><small>${detail}</small></span>
        </span>
        <strong class="rx-result-metric">${fmt(value)}</strong>
        <span class="rx-result-points"><b data-rx-points="${pts}">0</b><small>PTS</small></span>
      </div>`;
    }).join('');
  }
  requestAnimationFrame(animateResultRanking);
}
function reset(){
  resultAnimationRun++;clearRound();players=MOCK_PLAYERS.map(p=>({...p,attempts:[]}));playerIndex=0;attempt=1;setPage('SETUP');
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
