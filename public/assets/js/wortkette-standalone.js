(()=>{
'use strict';

const COLORS=['var(--core-red)','var(--core-blue)','var(--core-yellow)','var(--core-green)'];
const START_WORDS=['APFEL','WASSER','AUTO','ZAHN','KAMERA'];

const COMPOUND_GRAPH={
  apfel:[['BAUM','APFELBAUM'],['SAFT','APFELSAFT'],['KUCHEN','APFELKUCHEN']],
  baum:[['HAUS','BAUMHAUS'],['KRONE','BAUMKRONE']],
  haus:[['TÜR','HAUSTÜR'],['TIER','HAUSTIER'],['ARZT','HAUSARZT'],['DACH','HAUSDACH']],
  tür:[['GRIFF','TÜRGRIFF'],['SCHLOSS','TÜRSCHLOSS'],['RAHMEN','TÜRRAHMEN']],
  tier:[['ARZT','TIERARZT'],['PARK','TIERPARK'],['WELT','TIERWELT']],
  arzt:[['PRAXIS','ARZTPRAXIS'],['KITTEL','ARZTKITTEL']],
  praxis:[['TÜR','PRAXISTÜR']],
  griff:[['BRETT','GRIFFBRETT'],['STÜCK','GRIFFSTÜCK']],
  brett:[['SPIEL','BRETTSPIEL']],
  spiel:[['PLATZ','SPIELPLATZ'],['FELD','SPIELFELD'],['ZEUG','SPIELZEUG']],
  platz:[['REGEN','PLATZREGEN'],['MANGEL','PLATZMANGEL']],
  regen:[['BOGEN','REGENBOGEN'],['WASSER','REGENWASSER'],['JACKE','REGENJACKE']],
  wasser:[['FALL','WASSERFALL'],['HAHN','WASSERHAHN'],['FLASCHE','WASSERFLASCHE']],
  fall:[['TÜR','FALLTÜR'],['HÖHE','FALLHÖHE'],['WIND','FALLWIND']],
  höhe:[['PUNKT','HÖHEPUNKT']],
  punkt:[['ZAHL','PUNKTZAHL'],['LANDUNG','PUNKTLANDUNG']],
  zahl:[['WORT','ZAHLWORT'],['SYSTEM','ZAHLSYSTEM']],
  wort:[['SPIEL','WORTSPIEL'],['SCHATZ','WORTSCHATZ']],
  system:[['FEHLER','SYSTEMFEHLER']],
  fehler:[['MELDUNG','FEHLERMELDUNG']],
  dach:[['BODEN','DACHBODEN'],['FENSTER','DACHFENSTER']],
  boden:[['LAMPE','BODENLAMPE'],['BELAG','BODENBELAG']],
  fenster:[['BANK','FENSTERBANK'],['GLAS','FENSTERGLAS'],['RAHMEN','FENSTERRAHMEN']],
  bank:[['KONTO','BANKKONTO'],['RÄUBER','BANKRÄUBER']],
  konto:[['STAND','KONTOSTAND'],['NUMMER','KONTONUMMER']],
  stand:[['ORT','STANDORT'],['PUNKT','STANDPUNKT']],
  ort:[['SCHILD','ORTSSCHILD'],['TEIL','ORTSTEIL']],
  schild:[['KRÖTE','SCHILDKRÖTE']],
  auto:[['BAHN','AUTOBAHN'],['TÜR','AUTOTÜR'],['RADIO','AUTORADIO']],
  bahn:[['HOF','BAHNHOF'],['STEIG','BAHNSTEIG']],
  hof:[['TÜR','HOFTÜR'],['FEST','HOFFEST']],
  zahn:[['ARZT','ZAHNARZT'],['BÜRSTE','ZAHNBÜRSTE']],
  kamera:[['TASCHE','KAMERATASCHE'],['OBJEKTIV','KAMERAOBJEKTIV']],
  tasche:[['GELD','TASCHENGELD'],['TUCH','TASCHENTUCH']],
  geld:[['BEUTEL','GELDBEUTEL'],['SCHEIN','GELDSCHEIN']],
  beutel:[['TIER','BEUTELTIER']]
};

const LOCAL_PAIRS=new Map();
Object.entries(COMPOUND_GRAPH).forEach(([base,rows])=>rows.forEach(([next,compound])=>{
  LOCAL_PAIRS.set(base+'|'+next.toLocaleLowerCase('de-DE'),compound);
}));

const screens=[...document.querySelectorAll('.wk-screen')];
const q=s=>document.querySelector(s);
let playerCount=4,rounds=10,timeLimit=15,currentRound=0,players=[],timer=null,timeLeft=15,phase='SETUP';
const verifyCache=new Map(),continuationCache=new Map();

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'auto'})}
function titleCaseWord(value){
  const cleaned=String(value||'').trim().replace(/\s+/g,' ');
  if(!cleaned)return '';
  return cleaned.charAt(0).toLocaleUpperCase('de-DE')+cleaned.slice(1).toLocaleLowerCase('de-DE');
}
function lettersOnly(value){return String(value||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'')}
function keyWord(word){return titleCaseWord(word).toLocaleLowerCase('de-DE')}
function firstLetter(word){return (lettersOnly(word)[0]||'').toLocaleUpperCase('de-DE')}
function msLabel(ms){return (Math.max(0,ms)/1000).toFixed(1).replace('.',',')+' S'}
function randomStart(){return START_WORDS[Math.floor(Math.random()*START_WORDS.length)]}
function localRows(base){return COMPOUND_GRAPH[keyWord(base)]||[]}
function localExample(p){
  const rows=localRows(p.lastValid).filter(([next])=>firstLetter(next)===p.requiredLetter&&!p.used.has(keyWord(next)));
  const row=rows[0];
  return row?{next:row[0],compound:row[1]}:null;
}
function exactCompound(base,next){return lettersOnly(base)+lettersOnly(next)}

async function germanNounPages(titles){
  const unique=[...new Set(titles.filter(Boolean))];
  if(!unique.length)return new Map();
  const params=new URLSearchParams({
    action:'query',format:'json',origin:'*',redirects:'1',
    prop:'categories',cllimit:'max',titles:unique.join('|')
  });
  const r=await fetch('https://de.wiktionary.org/w/api.php?'+params.toString());
  if(!r.ok)throw new Error('HTTP '+r.status);
  const d=await r.json(),out=new Map();
  Object.values(d?.query?.pages||{}).forEach(page=>{
    if(!page||page.missing!==undefined||page.invalid!==undefined||Number(page.ns)!==0)return;
    const isNoun=(page.categories||[]).some(c=>String(c?.title||'').toLocaleLowerCase('de-DE')==='kategorie:substantiv (deutsch)');
    if(isNoun)out.set(keyWord(page.title),String(page.title));
  });
  return out;
}

async function verifyExactPair(base,next){
  const b=titleCaseWord(base),n=titleCaseWord(next),compound=titleCaseWord(exactCompound(b,n));
  const cacheKey=keyWord(b)+'|'+keyWord(n);
  if(verifyCache.has(cacheKey))return verifyCache.get(cacheKey);

  // Local approved pairs are exact concatenations only.
  const local=LOCAL_PAIRS.get(cacheKey);
  if(local&&keyWord(local)===keyWord(exactCompound(b,n))){
    const result={ok:true,compound:local,source:'curated'};
    verifyCache.set(cacheKey,result);return result;
  }

  try{
    const nouns=await germanNounPages([b,n,compound]);
    const baseOk=nouns.has(keyWord(b)),nextOk=nouns.has(keyWord(n)),compoundOk=nouns.has(keyWord(compound));
    const result={
      ok:baseOk&&nextOk&&compoundOk,
      compound:compoundOk?nouns.get(keyWord(compound)):null,
      baseOk,nextOk,compoundOk,source:'wiktionary'
    };
    verifyCache.set(cacheKey,result);return result;
  }catch(_){
    const result={ok:false,compound:null,baseOk:false,nextOk:false,compoundOk:false,source:'offline'};
    verifyCache.set(cacheKey,result);return result;
  }
}

async function discoverContinuations(base){
  const k=keyWord(base);
  if(continuationCache.has(k))return continuationCache.get(k);
  const curated=localRows(base).map(([next,compound])=>({next,compound,source:'curated'}));
  if(curated.length){continuationCache.set(k,curated);return curated}

  try{
    const params=new URLSearchParams({
      action:'query',format:'json',origin:'*',list:'prefixsearch',
      pssearch:titleCaseWord(base),psnamespace:'0',pslimit:'40'
    });
    const r=await fetch('https://de.wiktionary.org/w/api.php?'+params.toString());
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json(),baseText=titleCaseWord(base),baseKey=keyWord(baseText);
    const raw=(d?.query?.prefixsearch||[])
      .map(x=>String(x?.title||''))
      .filter(title=>keyWord(title).startsWith(baseKey)&&keyWord(title)!==baseKey)
      .map(title=>({title,suffix:title.slice(baseText.length)}))
      .filter(x=>lettersOnly(x.suffix).length>=2&&keyWord(baseText+x.suffix)===keyWord(x.title))
      .slice(0,24);

    const suffixNouns=await germanNounPages(raw.map(x=>x.suffix));
    const rows=raw
      .filter(x=>suffixNouns.has(keyWord(x.suffix)))
      .map(x=>({next:suffixNouns.get(keyWord(x.suffix)),compound:x.title,source:'wiktionary'}));

    continuationCache.set(k,rows);
    return rows;
  }catch(_){
    continuationCache.set(k,[]);
    return [];
  }
}

async function assignRequiredLetters(){
  for(const p of players){
    const options=(await discoverContinuations(p.lastValid)).filter(o=>!p.used.has(keyWord(o.next)));
    if(!options.length){
      p.requiredLetter='—';
      p.noContinuation=true;
      continue;
    }
    p.noContinuation=false;
    const letters=[...new Set(options.map(o=>firstLetter(o.next)).filter(Boolean))];
    p.requiredLetter=letters[Math.floor(Math.random()*letters.length)]||firstLetter(options[0].next);
  }
}

async function exampleFor(p){
  const local=localExample(p);if(local)return local;
  const options=(await discoverContinuations(p.lastValid))
    .filter(o=>firstLetter(o.next)===p.requiredLetter&&!p.used.has(keyWord(o.next)));
  return options[0]||null;
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
    requiredLetter:'—',noContinuation:false,locked:false,answer:'',result:null,submittedAt:0
  }));
}
function playerCard(p,i){
  const ex=phase==='REVEAL'&&p.result&&!p.result.ok?p.result.example:null;
  const example=ex?'<div class="correct-example"><small>EINE GÜLTIGE LÖSUNG</small><b>'+esc(p.lastValid)+' + '+esc(ex.next)+' = '+esc(ex.compound)+'</b><span>'+esc(ex.next)+' beginnt mit der Vorgabe '+esc(p.requiredLetter)+' und beide Nomen bleiben unverändert.</span></div>':'';
  const compound=p.result?.compound?'<div class="compound-result"><small>GÜLTIGES KOMPOSITUM</small><b>'+esc(p.lastValid)+' + '+esc(p.answer)+' = '+esc(p.result.compound)+'</b><span>'+esc(p.answer)+' wird dein neues Ausgangswort.</span></div>':'';
  const reveal=phase==='REVEAL'&&p.result?'<div class="answer-reveal"><small>DEINE ANTWORT</small><strong>'+esc(p.answer||'—')+'</strong><span>'+esc(p.result.message)+'</span>'+compound+example+'</div>':'';
  const state=phase==='INPUT'
    ?(p.locked?'<div class="player-state wait">EINGELOGGT · WARTET AUF DIE ANDEREN</div>':(p.noContinuation?'<div class="player-state bad">KEINE LÖSBARE FORTSETZUNG GEFUNDEN.</div>':'<div class="player-state">NOCH NICHT ABGESCHICKT</div>'))
    :(p.result?.ok?'<div class="player-state ok">✓ GÜLTIGES KOMPOSITUM</div>':'<div class="player-state bad">✕ FEHLER</div>');
  return '<article class="player-card '+(p.locked?'locked ':'')+(phase==='REVEAL'?(p.result?.ok?'valid':'invalid'):'')+'" style="--player-color:'+p.color+'" data-player="'+i+'">'+
    '<div class="player-head"><i></i><div><small>PLAYER / TEAM '+String(i+1).padStart(2,'0')+'</small><strong>'+esc(p.name)+'</strong></div><div class="mistakes"><b>'+p.errors+'</b><span>FEHLER</span></div></div>'+
    '<div class="chain-current"><small>AKTUELLES AUSGANGSWORT</small><strong>'+esc(p.lastValid)+'</strong></div>'+
    '<div class="compound-prompt"><span>NEUES NOMEN MUSS MIT DIESEM BUCHSTABEN BEGINNEN<strong>BEIDE NOMEN BLEIBEN UNVERÄNDERT</strong></span><b>'+esc(p.requiredLetter)+'</b></div>'+
    '<div class="answer-row"><input data-answer="'+i+'" maxlength="32" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="'+esc(p.requiredLetter)+'…"><button data-submit="'+i+'" type="button" '+(p.noContinuation?'disabled':'')+'>LOCK IN</button></div>'+
    state+reveal+'</article>';
}
function renderBoard(){
  q('#playerBoard').innerHTML=players.map(playerCard).join('');
  q('#playerBoard').querySelectorAll('[data-submit]').forEach(btn=>btn.addEventListener('click',()=>lockAnswer(Number(btn.dataset.submit))));
  q('#playerBoard').querySelectorAll('[data-answer]').forEach(input=>{
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lockAnswer(Number(input.dataset.answer))}});
    const p=players[Number(input.dataset.answer)];
    if(phase!=='INPUT'||p?.noContinuation)input.disabled=true;
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
  q('#phaseLabel').textContent=phase==='INPUT'?'BUCHSTABE + KOMPOSITUM':'AUFLÖSUNG';
  q('#timerValue').textContent=phase==='INPUT'?(timerOff?'∞':String(Math.ceil(timeLeft))):'—';
  q('.timer-shell').classList.toggle('urgent',!timerOff&&phase==='INPUT'&&timeLeft<=5);
  q('.timer-shell').classList.toggle('off',timerOff&&phase==='INPUT');
  q('.progress').classList.toggle('off',timerOff&&phase==='INPUT');
  q('#progressBar').style.width=phase==='INPUT'?(timerOff?'100%':Math.max(0,(timeLeft/timeLimit)*100)+'%'):'0%';
  q('#simulCopy').textContent=timerOff?'Kein Zeitlimit · die Runde endet, sobald alle eingeloggt haben.':'Beachte deinen Vorgabe-Buchstaben und bilde ein exaktes Kompositum.';
}
async function startGame(){
  const custom=titleCaseWord(q('#startWordInput').value),start=custom||titleCaseWord(randomStart());
  if(!lettersOnly(start)){alert('Bitte ein gültiges Start-Nomen eingeben.');return}
  const continuations=await discoverContinuations(start);
  if(!continuations.length){alert('Für dieses Start-Nomen konnte keine unveränderte, belegte Fortsetzung gefunden werden. Bitte anderes Startwort wählen.');return}
  readPlayers(start);currentRound=0;show('playScreen');await startRound();
}
async function startRound(){
  currentRound++;phase='INPUT';timeLeft=timeLimit;
  players.forEach(p=>{p.locked=false;p.answer='';p.result=null;p.submittedAt=0});
  q('#nextRoundBtn').hidden=true;
  q('#phaseLabel').textContent='VORGABE WIRD ERMITTELT …';
  await assignRequiredLetters();
  renderBoard();updateTop();
  const started=performance.now();
  clearInterval(timer);
  if(timeLimit>0){
    const deadline=started+timeLimit*1000;
    timer=setInterval(()=>{
      const now=performance.now();timeLeft=Math.max(0,(deadline-now)/1000);updateTop();
      if(timeLeft<=0){
        clearInterval(timer);
        players.forEach((p,i)=>{if(!p.locked&&!p.noContinuation)lockAnswer(i,true)});
        if(players.filter(p=>!p.noContinuation).every(p=>p.locked))resolveRound(started);
      }
    },100);
  }
  q('#playScreen').dataset.roundStarted=String(started);
  setTimeout(()=>q('[data-answer="0"]:not(:disabled)')?.focus(),60);
}
function lockAnswer(i,timeout=false){
  if(phase!=='INPUT')return;
  const p=players[i];if(!p||p.locked||p.noContinuation)return;
  const input=q('[data-answer="'+i+'"]');
  p.answer=timeout?'':titleCaseWord(input?.value||'');
  p.locked=true;p.submittedAt=performance.now();
  renderBoard();
  if(players.filter(x=>!x.noContinuation).every(x=>x.locked)){
    clearInterval(timer);
    resolveRound(Number(q('#playScreen').dataset.roundStarted)||performance.now());
  }
}
async function validatePlayer(p,roundStarted){
  const word=titleCaseWord(p.answer);
  const responseMs=Math.max(0,(p.submittedAt||performance.now())-roundStarted);
  p.totalMs+=timeLimit>0?Math.min(responseMs,timeLimit*1000):responseMs;
  const fail=async message=>({ok:false,message,example:await exampleFor(p)});
  if(p.noContinuation)return fail('FÜR DAS AUSGANGSWORT KONNTE KEINE LÖSBARE VORGABE ERMITTELT WERDEN.');
  if(!word)return fail(timeLimit>0?'ZEIT ABGELAUFEN · KEIN NOMEN ABGEGEBEN.':'KEIN NOMEN ABGEGEBEN.');
  if(firstLetter(word)!==p.requiredLetter)return fail('FALSCHER BUCHSTABE · GEFORDERT WAR '+p.requiredLetter+'.');
  if(lettersOnly(word).length<2)return fail('ZU KURZ.');
  if(p.used.has(keyWord(word)))return fail('DIESES NOMEN WAR SCHON IN DEINER KETTE.');

  const verified=await verifyExactPair(p.lastValid,word);
  if(!verified.ok){
    if(verified.baseOk===false||verified.nextOk===false){
      return fail('BEIDE TEILE MÜSSEN EIGENSTÄNDIGE DEUTSCHE NOMEN SEIN.');
    }
    return fail('DAS EXAKTE KOMPOSITUM '+exactCompound(p.lastValid,word).toLocaleUpperCase('de-DE')+' IST NICHT ALS DEUTSCHES NOMEN BELEGT. KEINE FUGENELEMENTE ODER BEUGUNGEN ERLAUBT.');
  }
  return {ok:true,compound:verified.compound,message:'GÜLTIG: '+String(verified.compound).toLocaleUpperCase('de-DE')+'.'}
}
async function resolveRound(roundStarted){
  if(phase!=='INPUT')return;phase='CHECK';updateTop();
  q('#phaseLabel').textContent='KOMPOSITA PRÜFEN …';
  const results=await Promise.all(players.map(p=>validatePlayer(p,roundStarted)));
  players.forEach((p,i)=>{
    p.result=results[i];
    if(results[i].ok){p.lastValid=titleCaseWord(p.answer);p.used.add(keyWord(p.answer))}
    else if(!p.noContinuation)p.errors++;
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
    const test=await verifyExactPair('Haus','Tür');
    el.textContent=test.ok?'EXAKT-KOMPOSITUM ONLINE':'KURATIERTER FALLBACK';
    el.className='wk-dict '+(test.ok?'strict':'warn');
  }catch(_){el.textContent='KURATIERTER FALLBACK';el.className='wk-dict warn'}
}

q('#playerCount').addEventListener('click',e=>{const b=e.target.closest('button[data-count]');if(!b)return;playerCount=Number(b.dataset.count);setSegment(q('#playerCount'),'count',playerCount);renderNames()});
q('#roundCount').addEventListener('click',e=>{const b=e.target.closest('button[data-rounds]');if(!b)return;rounds=Number(b.dataset.rounds);setSegment(q('#roundCount'),'rounds',rounds)});
q('#timeLimit').addEventListener('click',e=>{const b=e.target.closest('button[data-time]');if(!b)return;timeLimit=Number(b.dataset.time);setSegment(q('#timeLimit'),'time',timeLimit)});
q('#randomStartBtn').addEventListener('click',()=>{q('#startWordInput').value=randomStart()});
q('#startBtn').addEventListener('click',()=>startGame());
q('#nextRoundBtn').addEventListener('click',()=>currentRound>=rounds?finish():startRound());
q('#restartBtn').addEventListener('click',()=>{clearInterval(timer);phase='SETUP';show('setupScreen')});

renderNames();probeDictionary();
})();