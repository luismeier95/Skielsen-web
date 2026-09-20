(()=>{
'use strict';

const COLORS={RED:'var(--core-red)',BLUE:'var(--core-blue)',GREEN:'var(--core-green)',YELLOW:'var(--core-yellow)'};
const PLAYERS=[
  {id:'p-red',name:'DJEELOI',color:'RED'},
  {id:'p-blue',name:'SOFYA',color:'BLUE'},
  {id:'p-green',name:'HANNES',color:'GREEN'},
  {id:'p-yellow',name:'PIA',color:'YELLOW'}
];
const DATA={
  EASY:{
    HEIGHT:[['FREIHEITSSTATUE',93],['KÖLNER DOM',157],['EIFFELTURM',330],['FERNSEHTURM BERLIN',368],['EMPIRE STATE BUILDING',381],['BURJ KHALIFA',828]],
    POPULATION:[['NIEDERLANDE',18],['POLEN',37.6],['SPANIEN',48.6],['ITALIEN',58.9],['FRANKREICH',68],['DEUTSCHLAND',83.5]],
    DISTANCE:[['BERLIN – PRAG',280],['BERLIN – WARSCHAU',520],['BERLIN – WIEN',680],['BERLIN – PARIS',1050],['BERLIN – ROM',1180],['BERLIN – MADRID',1870]]
  },
  NORMAL:{
    HEIGHT:[['FREIHEITSSTATUE',93],['KÖLNER DOM',157],['EIFFELTURM',330],['FERNSEHTURM BERLIN',368],['EMPIRE STATE BUILDING',381],['BURJ KHALIFA',828]],
    AREA:[['NIEDERLANDE',41865],['SCHWEIZ',41285],['PORTUGAL',92212],['DEUTSCHLAND',357588],['SPANIEN',505990],['FRANKREICH',551695]],
    WIKIPEDIA_VIEWS:[['EIFFELTURM',410000],['BRANDENBURGER TOR',530000],['TITANIC',780000],['MONA LISA',910000],['ALBERT EINSTEIN',1200000],['ZWEITER WELTKRIEG',1850000]],
    DISTANCE:[['BERLIN – PRAG',280],['BERLIN – WARSCHAU',520],['BERLIN – WIEN',680],['BERLIN – PARIS',1050],['BERLIN – ROM',1180],['BERLIN – MADRID',1870]]
  },
  HARDCORE:{
    HEIGHT:[['ZUGSPITZE',2962],['FUJI',3776],['MONT BLANC',4806],['KILIMANDSCHARO',5895],['ACONCAGUA',6961],['MOUNT EVEREST',8849]],
    LENGTH:[['PANAMAKANAL',82],['SUEZKANAL',193],['ELBE',1094],['RHEIN',1233],['DONAU',2850],['NIL',6650]],
    AREA:[['DÄNEMARK',42952],['ÖSTERREICH',83879],['ISLAND',103000],['GRIECHENLAND',131957],['NORWEGEN',385207],['SCHWEDEN',450295]],
    WIKIPEDIA_VIEWS:[['TOWER BRIDGE',210000],['SAGRADA FAMÍLIA',295000],['MACHU PICCHU',355000],['POMPEJI',455000],['MARIE CURIE',690000],['NAPOLEON',1010000]]
  }
};
const META={
  HEIGHT:['HÖHE','m'],
  POPULATION:['BEVÖLKERUNG','Mio. Einwohner'],
  AREA:['FLÄCHE','km²'],
  DISTANCE:['ENTFERNUNG','km'],
  WIKIPEDIA_VIEWS:['WIKIPEDIA-AUFRUFE','Aufrufe/Monat'],
  LENGTH:['LÄNGE','km']
};

const content=document.getElementById('molcContent');
const metaStrong=document.getElementById('molcMetaStrong');
const metaSmall=document.getElementById('molcMetaSmall');
const progress=document.getElementById('molcProgress');
const theme=document.getElementById('molcTheme');

let s;

function reset(){
  s={
    screen:'SETUP',
    tier:'NORMAL',
    categoryNo:0,
    categoryCount:5,
    categoryKey:null,
    facts:[],
    factIndex:0,
    currentSeat:0,
    lastSeat:0,
    lastResult:null,
    rouletteTimer:0,
    players:PLAYERS.map(p=>({...p,active:true,wins:0}))
  };
  render();
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function format(key,value){
  if(key==='POPULATION')return Number(value).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mio.';
  if(key==='WIKIPEDIA_VIEWS')return Number(value).toLocaleString('de-DE')+' / Monat';
  return Number(value).toLocaleString('de-DE')+' '+META[key][1];
}
function color(p){return COLORS[p?.color]||'var(--theme-accent)'}
function progressPct(){
  if(s.screen==='SETUP')return 5;
  if(s.screen==='RESULT')return 100;
  return Math.max(12,Math.min(96,((Math.max(1,s.categoryNo)-1)/s.categoryCount)*100+18));
}
function chrome(strong,small){
  metaStrong.textContent=strong;
  metaSmall.textContent=small;
  progress.style.width=progressPct()+'%';
}
function statusHtml(a,b,c){
  return `<section class="skg-status">
    <div><small>${esc(a[0])}</small><strong>${esc(a[1])}</strong></div>
    <div><small>${esc(b[0])}</small><strong>${esc(b[1])}</strong></div>
    <div><small>${esc(c[0])}</small><strong>${esc(c[1])}</strong></div>
  </section>`;
}
function scoreboard(){
  return `<div class="molc-scoreboard">${s.players.map(p=>`<div class="molc-player ${p.active?'':'out'}" style="--player:${color(p)}"><i></i><span>${esc(p.name)}</span><b>${p.wins} SIEGE</b></div>`).join('')}</div>`;
}
function playStatus(p){
  return `<section class="skg-status molc-play-status"><div><small>KATEGORIE</small><strong>${esc(META[s.categoryKey][0])}</strong></div><div><small>ZUG</small><strong>${esc(p.name)}</strong></div></section>`;
}
function setup(){
  chrome('SETUP','5 KATEGORIEN');
  const copy={
    EASY:'Bekannte Fakten · Höhe nur weltbekannte Bauwerke und Statuen.',
    NORMAL:'Gemischtes Wissen · bekannte bis mittelschwere Vergleiche.',
    HARDCORE:'Nischenwissen · Berge und Länge sind freigeschaltet.'
  }[s.tier];
  content.innerHTML=`
    <section class="molc-hero">
      <small>SPIELVORBEREITUNG</small>
      <h1>MEHR<br>ODER<br>WENIGER?</h1>
      <p>Eine Kategorie wird gezogen. Gespielt wird reihum. Wer falsch liegt, scheidet für diese Kategorie aus. Last Man Standing gewinnt die Kategorie.</p>
    </section>
    <section class="skg-card molc-setup-card">
      <small class="skg-kicker">BEKANNTHEITSGRAD</small>
      <div class="molc-difficulty">
        ${[['EASY','bekannte Fakten'],['NORMAL','gemischtes Wissen'],['HARDCORE','Nischenwissen']].map(([tier,label])=>`<button type="button" data-tier="${tier}" class="${s.tier===tier?'active':''}"><b>${tier}</b><span>${label}</span></button>`).join('')}
      </div>
      <div class="molc-setup-note">${copy}</div>
    </section>
    <div class="skg-actions"><button class="skg-btn primary" id="molcStart" type="button">KATEGORIE ZIEHEN →</button></div>
    <p class="molc-dev-note">STANDALONE TEST · LOKALE DATEN · KEINE TURNIERDATEN WERDEN VERÄNDERT.</p>`;
  content.querySelectorAll('[data-tier]').forEach(btn=>btn.addEventListener('click',()=>{s.tier=btn.dataset.tier;setup()}));
  document.getElementById('molcStart').addEventListener('click',startCategory);
}
function shuffled(arr){
  return [...arr].sort(()=>Math.random()-.5);
}
function startCategory(){
  clearTimeout(s.rouletteTimer);
  s.categoryNo++;
  s.players.forEach(p=>p.active=true);
  const keys=Object.keys(DATA[s.tier]);
  s.categoryKey=keys[(s.categoryNo-1)%keys.length];
  s.facts=shuffled(DATA[s.tier][s.categoryKey]);
  s.factIndex=0;
  s.currentSeat=(s.categoryNo-1)%s.players.length;
  s.lastSeat=s.currentSeat;
  s.lastResult=null;
  s.screen='ROULETTE';
  render();
}
function roulette(){
  chrome('PLAY',`KATEGORIE ${s.categoryNo} / ${s.categoryCount}`);
  const keys=Object.keys(DATA[s.tier]);
  content.innerHTML=`
    ${statusHtml(['KATEGORIE',String(s.categoryNo).padStart(2,'0')+' / '+String(s.categoryCount).padStart(2,'0')],['MODUS',s.tier],['STATUS','ZIEHUNG'])}
    <section class="molc-roulette">
      <small>KATEGORIE WIRD GEZOGEN</small>
      <strong id="molcRouletteLabel">—</strong>
      <span id="molcRouletteUnit">&nbsp;</span>
      <div class="molc-dots"><i></i><i></i><i></i></div>
    </section>`;
  const label=document.getElementById('molcRouletteLabel'),unit=document.getElementById('molcRouletteUnit');
  let i=0;
  const tick=()=>{
    const key=i<11?keys[i%keys.length]:s.categoryKey;
    label.textContent=META[key][0];
    unit.textContent=META[key][1];
    i++;
    if(i<12)s.rouletteTimer=setTimeout(tick,70+i*14);
    else s.rouletteTimer=setTimeout(()=>{s.screen='QUESTION';render()},700);
  };
  tick();
}
function nextActive(from){
  for(let i=1;i<=s.players.length;i++){
    const n=(from+i)%s.players.length;
    if(s.players[n].active)return n;
  }
  return from;
}
function question(){
  chrome('PLAY',`KATEGORIE ${s.categoryNo} / ${s.categoryCount}`);
  const ref=s.facts[s.factIndex%s.facts.length],cur=s.facts[(s.factIndex+1)%s.facts.length],p=s.players[s.currentSeat];
  content.innerHTML=`${playStatus(p)}${scoreboard()}
    <section class="molc-compare molc-compare-stacked">
      <div class="molc-compare-half molc-compare-ref"><strong>${esc(ref[0])}</strong><div class="molc-metric"><b>${esc(format(s.categoryKey,ref[1]))}</b></div></div>
      <div class="molc-vs">VS</div>
      <div class="molc-compare-half molc-compare-cur"><strong>${esc(cur[0])}</strong></div>
    </section>
    <div class="skg-choice-actions molc-choice-actions">
      <button class="skg-btn less molc-choice-btn" data-choice="LESS" type="button"><span class="molc-choice-icon">↓</span><b>WENIGER</b></button>
      <button class="skg-btn more molc-choice-btn" data-choice="MORE" type="button"><span class="molc-choice-icon">↑</span><b>MEHR</b></button>
    </div>`;
  content.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>answer(btn.dataset.choice)));
}
function answer(choice){
  const ref=s.facts[s.factIndex%s.facts.length],cur=s.facts[(s.factIndex+1)%s.facts.length],p=s.players[s.currentSeat];
  const correct=Number(cur[1])>Number(ref[1])?'MORE':'LESS';
  s.lastSeat=s.currentSeat;
  if(choice===correct){advanceTurn();return}
  p.active=false;
  s.lastResult={player:p,ok:false,correct,ref,cur};
  s.screen='REVEAL';render();
}
function reveal(){
  chrome('PLAY',`KATEGORIE ${s.categoryNo} / ${s.categoryCount}`);
  const r=s.lastResult,p=r.player,survivors=s.players.filter(x=>x.active),categoryOver=survivors.length===1;
  content.innerHTML=`${playStatus(p)}${scoreboard()}<div class="molc-wrong-flag">FALSCH</div>
    <section class="molc-compare molc-compare-stacked molc-compare-reveal">
      <div class="molc-compare-half molc-compare-ref"><strong>${esc(r.ref[0])}</strong><div class="molc-metric"><b>${esc(format(s.categoryKey,r.ref[1]))}</b></div></div>
      <div class="molc-vs">VS</div>
      <div class="molc-compare-half molc-compare-cur"><strong>${esc(r.cur[0])}</strong><div class="molc-metric"><b>${esc(format(s.categoryKey,r.cur[1]))}</b></div></div>
    </section>
    <div class="skg-actions"><button class="skg-btn primary" id="molcContinue" type="button">${categoryOver?(s.categoryNo>=s.categoryCount?'ERGEBNIS →':'NÄCHSTE KATEGORIE →'):'WEITER →'}</button></div>`;
  document.getElementById('molcContinue').addEventListener('click',continueGame);
}
function advanceTurn(){
  s.factIndex=(s.factIndex+1)%Math.max(1,s.facts.length-1);
  s.currentSeat=nextActive(s.lastSeat);
  s.lastResult=null;s.screen='QUESTION';render();
}
function continueGame(){
  const survivors=s.players.filter(p=>p.active);
  if(survivors.length===1){
    survivors[0].wins++;
    if(s.categoryNo>=s.categoryCount){s.screen='RESULT';render();return}
    startCategory();return;
  }
  advanceTurn();
}
function result(){
  chrome('RESULT','FINAL');
  progress.style.width='100%';
  const rows=[...s.players].sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'de'));
  content.innerHTML=`
    <section class="skg-status is-result" aria-label="Ergebnis"></section>
    <section class="skg-result-table">
      <header><strong>FINALES ERGEBNIS</strong><span>5 KATEGORIEN</span></header>
      <div class="skg-result-columns"><span>NAME</span><span>SIEGE</span><span>PLATZ</span></div>
      ${rows.map((p,i)=>`<div class="skg-result-row molc-result-row ${i===0?'is-first':''}">
        <span class="skg-result-player"><i style="background:${color(p)}"></i><strong>${esc(p.name)}</strong></span>
        <b class="molc-wins">${p.wins}</b>
        <b class="molc-place">${i+1}.</b>
      </div>`).join('')}
    </section>
    <div class="skg-actions"><button class="skg-btn primary" id="molcAgain" type="button">NEUER TEST →</button></div>
    <p class="molc-dev-note">RESULT-SCREEN VERWENDET DAS GEMEINSAME CONTRACT-TABLE-COMPONENT.</p>`;
  document.getElementById('molcAgain').addEventListener('click',reset);
}
function render(){
  clearTimeout(s?.rouletteTimer);
  if(!s)return;
  if(s.screen==='SETUP')setup();
  else if(s.screen==='ROULETTE')roulette();
  else if(s.screen==='QUESTION')question();
  else if(s.screen==='REVEAL')reveal();
  else result();
}
theme.addEventListener('change',()=>{
  document.documentElement.dataset.themePack=theme.value;
  document.body.dataset.themePack=theme.value;
});
document.getElementById('molcReset').addEventListener('click',reset);
document.getElementById('molcMinimize').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
reset();
})();
