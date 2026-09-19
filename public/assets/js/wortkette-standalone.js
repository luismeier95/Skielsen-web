(()=>{
'use strict';

const COLORS=['var(--core-red)','var(--core-blue)','var(--core-yellow)','var(--core-green)'];
const START_WORDS=['HAUS','LAMPE','TISCH','GARTEN','NASE','ELEFANT','TASSE','APFEL','KAMERA','AUTO','RADIO','ORANGE','EIMER','ROSE','ESEL','LEITER','REGEN','NUDEL','LÖWE','EULE'];

const COMPOUND_GRAPH={
  haus:[['TÜR','HAUSTÜR'],['DACH','HAUSDACH'],['ARZT','HAUSARZT']],
  tür:[['SCHLOSS','TÜRSCHLOSS'],['GRIFF','TÜRGRIFF'],['RAHMEN','TÜRRAHMEN']],
  schloss:[['GARTEN','SCHLOSSGARTEN'],['TÜR','SCHLOSSTÜR']],
  garten:[['ZAUN','GARTENZAUN'],['HAUS','GARTENHAUS'],['TÜR','GARTENTÜR']],
  zaun:[['PFOSTEN','ZAUNPFOSTEN']],
  lampe:[['SCHIRM','LAMPENSCHIRM'],['LICHT','LAMPENLICHT']],
  schirm:[['STÄNDER','SCHIRMSTÄNDER'],['GRIFF','SCHIRMGRIFF']],
  tisch:[['BEIN','TISCHBEIN'],['PLATTE','TISCHPLATTE'],['DECKE','TISCHDECKE']],
  bein:[['BRUCH','BEINBRUCH']],
  nase:[['RING','NASENRING'],['BLUTEN','NASENBLUTEN'],['LOCH','NASENLOCH']],
  ring:[['FINGER','RINGFINGER'],['GRÖSSE','RINGGRÖSSE']],
  elefant:[['HERDE','ELEFANTENHERDE'],['HAUT','ELEFANTENHAUT']],
  herde:[['TIER','HERDENTIER']],
  tasse:[['KUCHEN','TASSENKUCHEN'],['RAND','TASSENRAND']],
  apfel:[['SAFT','APFELSAFT'],['BAUM','APFELBAUM'],['KUCHEN','APFELKUCHEN']],
  saft:[['FLASCHE','SAFTFLASCHE'],['LADEN','SAFTLADEN']],
  flasche:[['HALS','FLASCHENHALS'],['POST','FLASCHENPOST'],['DECKEL','FLASCHENDECKEL']],
  hals:[['KETTE','HALSKETTE'],['TUCH','HALSTUCH']],
  kette:[['REAKTION','KETTENREAKTION'],['GLIED','KETTENGLIED']],
  reaktion:[['ZEIT','REAKTIONSZEIT']],
  zeit:[['GEIST','ZEITGEIST'],['DRUCK','ZEITDRUCK'],['FENSTER','ZEITFENSTER']],
  kamera:[['TASCHE','KAMERATASCHE'],['OBJEKTIV','KAMERAOBJEKTIV']],
  tasche:[['GELD','TASCHENGELD'],['TUCH','TASCHENTUCH']],
  auto:[['BAHN','AUTOBAHN'],['TÜR','AUTOTÜR'],['RADIO','AUTORADIO']],
  bahn:[['HOF','BAHNHOF'],['STEIG','BAHNSTEIG']],
  hof:[['TÜR','HOFTÜR'],['FEST','HOFFEST']],
  radio:[['SENDER','RADIOSENDER'],['PROGRAMM','RADIOPROGRAMM']],
  sender:[['NAME','SENDERNAME']],
  orange:[['SAFT','ORANGENSAFT'],['SCHALE','ORANGENSCHALE']],
  schale:[['OBST','SCHALENOBST']],
  eimer:[['GRIFF','EIMERGRIFF'],['DECKEL','EIMERDECKEL']],
  griff:[['BRETT','GRIFFBRETT'],['FLÄCHE','GRIFFFLÄCHE']],
  rose:[['GARTEN','ROSENGARTEN'],['DUFT','ROSENDUFT']],
  esel:[['OHR','ESELSOHR'],['BRÜCKE','ESELSBRÜCKE']],
  ohr:[['RING','OHRRING'],['LÄPPCHEN','OHRLÄPPCHEN']],
  leiter:[['WAGEN','LEITERWAGEN'],['BAHN','LEITERBAHN']],
  regen:[['BOGEN','REGENBOGEN'],['WASSER','REGENWASSER'],['JACKE','REGENJACKE']],
  bogen:[['LAMPE','BOGENLAMPE']],
  wasser:[['FLASCHE','WASSERFLASCHE'],['FALL','WASSERFALL'],['HAHN','WASSERHAHN']],
  nudel:[['SUPPE','NUDELSUPPE'],['TEIG','NUDELTEIG']],
  suppe:[['TOPF','SUPPENTOPF'],['LÖFFEL','SUPPENLÖFFEL']],
  löwe:[['ZAHN','LÖWENZAHN'],['MÄHNE','LÖWENMÄHNE']],
  zahn:[['ARZT','ZAHNARZT'],['BÜRSTE','ZAHNBÜRSTE']],
  eule:[['RUF','EULENRUF'],['AUGE','EULENAUGE']],
  auge:[['ARZT','AUGENARZT'],['LID','AUGENLID']],
  dach:[['BODEN','DACHBODEN'],['FENSTER','DACHFENSTER']],
  boden:[['LAMPE','BODENLAMPE'],['BELAG','BODENBELAG']],
  deckel:[['RAND','DECKELRAND']],
  kuchen:[['FORM','KUCHENFORM'],['BLECH','KUCHENBLECH']],
  baum:[['HAUS','BAUMHAUS'],['KRONE','BAUMKRONE']],
  finger:[['RING','FINGERRING'],['ABDRUCK','FINGERABDRUCK']],
  arzt:[['PRAXIS','ARZTPRAXIS'],['KITTEL','ARZTKITTEL']],
  praxis:[['TÜR','PRAXISTÜR']],
  geld:[['BEUTEL','GELDBEUTEL'],['SCHEIN','GELDSCHEIN']],
  name:[['SCHILD','NAMENSSCHILD']],
  programm:[['HEFT','PROGRAMMHEFT']]
};

const LOCAL_COMPOUNDS=new Map();
Object.entries(COMPOUND_GRAPH).forEach(([base,rows])=>rows.forEach(([next,compound])=>{
  LOCAL_COMPOUNDS.set(base+'|'+next.toLocaleLowerCase('de-DE'),compound);
}));

const screens=[...document.querySelectorAll('.wk-screen')];
const q=s=>document.querySelector(s);
let playerCount=4,rounds=10,timeLimit=15,currentRound=0,players=[],timer=null,timeLeft=15,phase='SETUP';
const wikiCache=new Map();

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'auto'})}
function titleCaseWord(value){
  const cleaned=String(value||'').trim().replace(/\s+/g,' ');
  if(!cleaned)return '';
  return cleaned.charAt(0).toLocaleUpperCase('de-DE')+cleaned.slice(1).toLocaleLowerCase('de-DE');
}
function lettersOnly(value){return String(value||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'')}
function keyWord(word){return titleCaseWord(word).toLocaleLowerCase('de-DE')}
function msLabel(ms){return (Math.max(0,ms)/1000).toFixed(1).replace('.',',')+' S'}
function randomStart(){return START_WORDS[Math.floor(Math.random()*START_WORDS.length)]}
function compoundRows(base){return COMPOUND_GRAPH[keyWord(base)]||[]}
function exampleFor(p){
  const used=p.used;
  const row=compoundRows(p.lastValid).find(([next])=>!used.has(keyWord(next)))||compoundRows(p.lastValid)[0];
  return row?{next:row[0],compound:row[1]}:null;
}
function compoundCandidates(base,next){
  const a=lettersOnly(titleCaseWord(base)),b=lettersOnly(titleCaseWord(next));
  const variants=[a+b,a+'s'+b,a+'n'+b,a+'en'+b,a+'e'+b,a+'er'+b];
  return [...new Set(variants.map(x=>x.charAt(0).toLocaleUpperCase('de-DE')+x.slice(1)))];
}
async function findCompound(base,next){
  const pairKey=keyWord(base)+'|'+keyWord(next);

  // Curated list contains only deliberately approved, ordinary German compounds.
  const local=LOCAL_COMPOUNDS.get(pairKey);
  if(local)return local;

  if(wikiCache.has(pairKey))return wikiCache.get(pairKey);

  // Important: the submitted second noun is NOT validated on its own.
  // We generate possible German compound spellings and require the COMBINED
  // word itself to exist as a German noun entry in Wiktionary.
  const candidates=compoundCandidates(base,next);
  const candidateKeys=new Set(candidates.map(keyWord));
  const ctrl=new AbortController(),to=setTimeout(()=>ctrl.abort(),3500);

  try{
    const params=new URLSearchParams({
      action:'query',
      format:'json',
      origin:'*',
      redirects:'1',
      prop:'categories',
      cllimit:'max',
      titles:candidates.join('|')
    });
    const r=await fetch('https://de.wiktionary.org/w/api.php?'+params.toString(),{signal:ctrl.signal});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();

    const pages=Object.values(d?.query?.pages||{});
    const validPage=pages.find(page=>{
      if(!page||page.missing!==undefined||page.invalid!==undefined||Number(page.ns)!==0)return false;
      if(!candidateKeys.has(keyWord(page.title||'')))return false;
      const categories=Array.isArray(page.categories)?page.categories:[];
      return categories.some(c=>String(c?.title||'').toLocaleLowerCase('de-DE')==='kategorie:substantiv (deutsch)');
    });

    const valid=validPage?String(validPage.title||''):null;
    wikiCache.set(pairKey,valid);
    return valid;
  }catch(_){
    // No permissive fallback: if the compound itself cannot be verified,
    // it is rejected. This prevents made-up combinations such as EIMERRAND.
    wikiCache.set(pairKey,null);
    return null;
  }finally{
    clearTimeout(to);
  }
}

function renderNames(){
  const host=q('#playerNames'),old=[...host.querySelectorAll('input')].map(x=>x.value);
  host.innerHTML='';
  for(let i=0;i<playerCount;i++){
    const wrap=document.createElement('label');wrap.className='name-field';
    wrap.innerHTML='<i style="background:'+COLORS[i]+'"></i><input maxlength="18" value="'+esc(old[i]||('PLAYER '+(i+1)))+'" aria-label="Player '+(i+1)+'">';
    host.appendChild(wrap);
  }
}
function setSegment(host,attr,value){
  host.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',String(btn.dataset[attr])===String(value)));
}
function readPlayers(startWord){
  players=[...q('#playerNames').querySelectorAll('input')].map((input,i)=>({
    name:(input.value.trim()||('PLAYER '+(i+1))).toLocaleUpperCase('de-DE'),
    color:COLORS[i],errors:0,totalMs:0,lastValid:startWord,used:new Set([keyWord(startWord)]),
    locked:false,answer:'',result:null,submittedAt:0
  }));
}
function playerCard(p,i){
  const ex=phase==='REVEAL'&&p.result&&!p.result.ok?p.result.example:null;
  const example=ex?'<div class="correct-example"><small>EINE GÜLTIGE LÖSUNG</small><b>'+esc(p.lastValid)+' + '+esc(ex.next)+' = '+esc(ex.compound)+'</b><span>Mit '+esc(ex.next)+' wäre ein gültiges zusammengesetztes Nomen entstanden.</span></div>':'';
  const compound=p.result?.compound?'<div class="compound-result"><small>GÜLTIGES KOMPOSITUM</small><b>'+esc(p.lastValid)+' + '+esc(p.answer)+' = '+esc(p.result.compound)+'</b><span>'+esc(p.answer)+' wird dein neues Ausgangswort.</span></div>':'';
  const reveal=phase==='REVEAL'&&p.result?'<div class="answer-reveal"><small>DEINE ANTWORT</small><strong>'+esc(p.answer||'—')+'</strong><span>'+esc(p.result.message)+'</span>'+compound+example+'</div>':'';
  const state=phase==='INPUT'
    ?(p.locked?'<div class="player-state wait">EINGELOGGT · WARTET AUF DIE ANDEREN</div>':'<div class="player-state">NOCH NICHT ABGESCHICKT</div>')
    :(p.result?.ok?'<div class="player-state ok">✓ GÜLTIGES KOMPOSITUM</div>':'<div class="player-state bad">✕ KEIN GÜLTIGES KOMPOSITUM</div>');
  return '<article class="player-card '+(p.locked?'locked ':'')+(phase==='REVEAL'?(p.result?.ok?'valid':'invalid'):'')+'" style="--player-color:'+p.color+'" data-player="'+i+'">'+
    '<div class="player-head"><i></i><div><small>PLAYER / TEAM '+String(i+1).padStart(2,'0')+'</small><strong>'+esc(p.name)+'</strong></div><div class="mistakes"><b>'+p.errors+'</b><span>FEHLER</span></div></div>'+
    '<div class="chain-current"><small>AKTUELLES AUSGANGSWORT</small><strong>'+esc(p.lastValid)+'</strong></div>'+
    '<div class="compound-prompt"><span>BILDE EIN ZUSAMMENGESETZTES NOMEN MIT DIESEM WORT</span><b>+</b></div>'+
    '<div class="answer-row"><input data-answer="'+i+'" maxlength="32" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="NOMEN …"><button data-submit="'+i+'" type="button">LOCK IN</button></div>'+
    state+reveal+'</article>';
}
function renderBoard(){
  q('#playerBoard').innerHTML=players.map(playerCard).join('');
  q('#playerBoard').querySelectorAll('[data-submit]').forEach(btn=>btn.addEventListener('click',()=>lockAnswer(Number(btn.dataset.submit))));
  q('#playerBoard').querySelectorAll('[data-answer]').forEach(input=>{
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lockAnswer(Number(input.dataset.answer))}});
    if(phase!=='INPUT')input.disabled=true;
  });
  if(phase==='INPUT'){
    players.forEach((p,i)=>{
      const input=q('[data-answer="'+i+'"]'),btn=q('[data-submit="'+i+'"]');
      if(p.locked){input.value=p.answer;input.disabled=true;btn.disabled=true;btn.textContent='EINGELOGGT'}
    });
  }
}
function updateTop(){
  const timerOff=timeLimit<=0;
  q('#roundLabel').textContent=String(currentRound).padStart(2,'0')+' / '+String(rounds).padStart(2,'0');
  q('#phaseLabel').textContent=phase==='INPUT'?'KOMPOSITUM BILDEN':'AUFLÖSUNG';
  q('#timerValue').textContent=phase==='INPUT'?(timerOff?'∞':String(Math.ceil(timeLeft))):'—';
  q('.timer-shell').classList.toggle('urgent',!timerOff&&phase==='INPUT'&&timeLeft<=5);
  q('.timer-shell').classList.toggle('off',timerOff&&phase==='INPUT');
  q('.progress').classList.toggle('off',timerOff&&phase==='INPUT');
  q('#progressBar').style.width=phase==='INPUT'?(timerOff?'100%':Math.max(0,(timeLeft/timeLimit)*100)+'%'):'0%';
  q('#simulCopy').textContent=timerOff?'Kein Zeitlimit · die Runde endet, sobald alle eingeloggt haben.':'Bilde ein zusammengesetztes Nomen und logge es vor Ablauf der Zeit ein.';
}
function startGame(){
  const custom=titleCaseWord(q('#startWordInput').value),start=custom||titleCaseWord(randomStart());
  if(!lettersOnly(start)){alert('Bitte ein gültiges Start-Nomen eingeben.');return}
  readPlayers(start);currentRound=0;show('playScreen');startRound();
}
function startRound(){
  currentRound++;phase='INPUT';timeLeft=timeLimit;
  players.forEach(p=>{p.locked=false;p.answer='';p.result=null;p.submittedAt=0});
  q('#nextRoundBtn').hidden=true;renderBoard();updateTop();
  const started=performance.now();
  clearInterval(timer);
  if(timeLimit>0){
    const deadline=started+timeLimit*1000;
    timer=setInterval(()=>{
      const now=performance.now();timeLeft=Math.max(0,(deadline-now)/1000);updateTop();
      if(timeLeft<=0){clearInterval(timer);players.forEach((p,i)=>{if(!p.locked)lockAnswer(i,true)});if(players.every(p=>p.locked))resolveRound(started)}
    },100);
  }
  q('#playScreen').dataset.roundStarted=String(started);
  setTimeout(()=>q('[data-answer="0"]')?.focus(),60);
}
function lockAnswer(i,timeout=false){
  if(phase!=='INPUT')return;
  const p=players[i];if(!p||p.locked)return;
  const input=q('[data-answer="'+i+'"]');
  p.answer=timeout?'':titleCaseWord(input?.value||'');
  p.locked=true;p.submittedAt=performance.now();
  renderBoard();
  if(players.every(x=>x.locked)){
    clearInterval(timer);
    resolveRound(Number(q('#playScreen').dataset.roundStarted)||performance.now());
  }
}
async function validatePlayer(p,roundStarted){
  const word=titleCaseWord(p.answer);
  const responseMs=Math.max(0,(p.submittedAt||performance.now())-roundStarted);
  p.totalMs+=timeLimit>0?Math.min(responseMs,timeLimit*1000):responseMs;
  const fail=message=>({ok:false,message,example:exampleFor(p)});
  if(!word)return fail(timeLimit>0?'ZEIT ABGELAUFEN · KEIN NOMEN ABGEGEBEN.':'KEIN NOMEN ABGEGEBEN.');
  if(lettersOnly(word).length<2)return fail('ZU KURZ.');
  if(p.used.has(keyWord(word)))return fail('DIESES NOMEN WAR SCHON IN DEINER KETTE.');
  const compound=await findCompound(p.lastValid,word);
  if(!compound)return fail('DAS KOMPOSITUM AUS '+p.lastValid.toLocaleUpperCase('de-DE')+' + '+word.toLocaleUpperCase('de-DE')+' IST NICHT ALS DEUTSCHES NOMEN BELEGT. DAS EINZELWORT ALLEIN REICHT NICHT.');
  return {ok:true,compound,message:'GÜLTIG: '+compound.toLocaleUpperCase('de-DE')+'.'}
}
async function resolveRound(roundStarted){
  if(phase!=='INPUT')return;phase='CHECK';updateTop();
  q('#phaseLabel').textContent='KOMPOSITA PRÜFEN …';
  const results=await Promise.all(players.map(p=>validatePlayer(p,roundStarted)));
  players.forEach((p,i)=>{
    p.result=results[i];
    if(results[i].ok){p.lastValid=titleCaseWord(p.answer);p.used.add(keyWord(p.answer))}
    else p.errors++;
  });
  phase='REVEAL';renderBoard();updateTop();
  const btn=q('#nextRoundBtn');btn.hidden=false;btn.textContent=currentRound>=rounds?'ERGEBNIS →':'NÄCHSTE RUNDE →';
}
function finish(){
  clearInterval(timer);phase='FINISH';
  const ranked=players.map((p,i)=>({...p,seat:i})).sort((a,b)=>a.errors-b.errors||a.totalMs-b.totalMs||a.seat-b.seat);
  q('#winnerTitle').textContent=ranked[0].name+' GEWINNT.';
  q('#finalBoard').innerHTML=ranked.map((p,i)=>'<div class="final-row '+(i===0?'winner':'')+'"><span>'+String(i+1).padStart(2,'0')+'</span><i style="background:'+p.color+'"></i><strong>'+esc(p.name)+'</strong><b>'+p.errors+' FEHLER</b><small>'+msLabel(p.totalMs)+' GESAMTZEIT</small></div>').join('');
  show('finishScreen');
}
async function probeDictionary(){
  const el=q('#dictionaryStatus');
  try{
    const compound=await findCompound('Orange','Saft');
    el.textContent=compound?'KOMPOSITUM-PRÜFUNG STRIKT':'NUR KURATIERTE KOMPOSITA';el.className='wk-dict '+(compound?'strict':'warn');
  }catch(_){el.textContent='NUR KURATIERTE KOMPOSITA';el.className='wk-dict warn'}
}

q('#playerCount').addEventListener('click',e=>{const b=e.target.closest('button[data-count]');if(!b)return;playerCount=Number(b.dataset.count);setSegment(q('#playerCount'),'count',playerCount);renderNames()});
q('#roundCount').addEventListener('click',e=>{const b=e.target.closest('button[data-rounds]');if(!b)return;rounds=Number(b.dataset.rounds);setSegment(q('#roundCount'),'rounds',rounds)});
q('#timeLimit').addEventListener('click',e=>{const b=e.target.closest('button[data-time]');if(!b)return;timeLimit=Number(b.dataset.time);setSegment(q('#timeLimit'),'time',timeLimit)});
q('#randomStartBtn').addEventListener('click',()=>{q('#startWordInput').value=randomStart()});
q('#startBtn').addEventListener('click',startGame);
q('#nextRoundBtn').addEventListener('click',()=>currentRound>=rounds?finish():startRound());
q('#restartBtn').addEventListener('click',()=>{clearInterval(timer);phase='SETUP';show('setupScreen')});

renderNames();probeDictionary();
})();