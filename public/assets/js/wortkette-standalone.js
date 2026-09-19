(()=>{
'use strict';

const COLORS=['var(--core-red)','var(--core-blue)','var(--core-yellow)','var(--core-green)'];
const START_WORDS=['HAUS','LAMPE','TISCH','GARTEN','NASE','ELEFANT','TASSE','APFEL','KAMERA','AUTO','RADIO','ORANGE','EIMER','ROSE','ESEL','LEITER','REGEN','NUDEL','LÖWE','EULE'];
const EXAMPLE_WORDS={A:'APFEL',B:'BAUM',C:'COMPUTER',D:'DOSE',E:'EIMER',F:'FARBE',G:'GARTEN',H:'HAUS',I:'INSEL',J:'JACKE',K:'KAMERA',L:'LAMPE',M:'MAUS',N:'NASE',O:'ORANGE',P:'PIZZA',Q:'QUELLE',R:'RADIO',S:'SONNE',T:'TISCH',U:'UHR',V:'VOGEL',W:'WASSER',X:'XYLOPHON',Y:'YOGA',Z:'ZUCKER','Ä':'ÄRMEL','Ö':'ÖL','Ü':'ÜBUNG'};
const LOCAL_WORDS=new Set([
  'haus','sonne','elefant','tiger','radio','orange','eimer','rose','esel','lampe','ente','tasse','apfel','leiter','regen','nase','auto','ofen','nudel','löwe','eule','erde','engel','garten','nacht','tisch','hund','dose','energie','insel','luft','farbe','eis','salat','telefon','note','essen','stuhl','licht','traum','meer','reise','erde','dorf','fenster','regenbogen','nuss','schrank','kiste','erde','uhr','rad','dach','hase','igel','maus','stern','nebel','blume','ei','idee','echo','obst','tor','ring','gabel','löffel','kuchen','nest','tür','rucksack','kamera','arm','mond','decke','ecke','kissen','socke','hemd','mantel','hose','rock','kleid','jacke','bett','teppich','glas','schere','rasen','baum','wald','fluss','see','berg','straße','stadt','land','insel','wolke','wind','sturm','regen','schnee','hagel','feuer','wasser','erde','luft','brot','käse','milch','kaffee','tee','saft','wein','bier','reis','nudel','suppe','pizza','banane','birne','kirsche','beere','melone','gurke','tomate','kartoffel','zwiebel','pfeffer','salz','zucker','honig','butter','messer','gabel','teller','becher','topf','pfanne','küche','zimmer','treppe','tür','wand','boden','dach','garage','garten','schule','büro','laden','markt','kino','theater','museum','hotel','bank','post','arzt','lehrer','fahrer','bäcker','maler','musik','lied','film','buch','brief','bild','foto','spiel','ball','rad','boot','zug','bus','taxi','flugzeug','schiff','fahrrad','motor','straße','weg','brücke','computer','quelle','vogel','xylophon','yoga','ärmel','öl','übung'
]);

const screens=[...document.querySelectorAll('.wk-screen')];
const q=s=>document.querySelector(s);
let playerCount=4,rounds=10,timeLimit=15,currentRound=0,players=[],timer=null,timeLeft=15,phase='SETUP';
const wikiCache=new Map();

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'auto'})}
function titleCaseWord(value){
  const cleaned=String(value||'').trim().replace(/\s+/g,' ');
  if(!cleaned)return '';
  return cleaned.charAt(0).toLocaleUpperCase('de-DE')+cleaned.slice(1);
}
function lettersOnly(value){return String(value||'').normalize('NFC').replace(/[^A-Za-zÄÖÜäöüß]/g,'')}
function firstLetter(word){const s=lettersOnly(word);return (s[0]||'').toLocaleUpperCase('de-DE')}
function lastLetter(word){const s=lettersOnly(word);let c=(s[s.length-1]||'').toLocaleUpperCase('de-DE');if(c==='ß')c='S';return c}
function keyWord(word){return titleCaseWord(word).toLocaleLowerCase('de-DE')}
function msLabel(ms){return (Math.max(0,ms)/1000).toFixed(1).replace('.',',')+' S'}
function randomStart(){return START_WORDS[Math.floor(Math.random()*START_WORDS.length)]}
function exampleFor(p){
  const required=lastLetter(p.lastValid);
  const preferred=EXAMPLE_WORDS[required];
  if(preferred&&!p.used.has(keyWord(preferred)))return preferred;
  const fallback=[...LOCAL_WORDS].find(w=>firstLetter(w)===required&&!p.used.has(keyWord(w)));
  return fallback?titleCaseWord(fallback).toLocaleUpperCase('de-DE'):'';
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
  const required=lastLetter(p.lastValid)||'—';
  const example=phase==='REVEAL'&&p.result&&!p.result.ok&&p.result.example?'<div class="correct-example"><small>MÖGLICHE RICHTIGE ANTWORT</small><b>'+esc(p.result.example)+'</b><span>'+esc(p.result.example)+' wäre für '+esc(lastLetter(p.lastValid))+' gültig gewesen.</span></div>':'';
  const reveal=phase==='REVEAL'&&p.result?'<div class="answer-reveal"><small>ANTWORT</small><strong>'+esc(p.answer||'—')+'</strong><span>'+esc(p.result.message)+'</span>'+example+'</div>':'';
  const state=phase==='INPUT'
    ?(p.locked?'<div class="player-state wait">EINGELOGGT · WARTET AUF DIE ANDEREN</div>':'<div class="player-state">NOCH NICHT ABGESCHICKT</div>')
    :(p.result?.ok?'<div class="player-state ok">✓ GÜLTIG</div>':'<div class="player-state bad">✕ FEHLER</div>');
  return '<article class="player-card '+(p.locked?'locked ':'')+(phase==='REVEAL'?(p.result?.ok?'valid':'invalid'):'')+'" style="--player-color:'+p.color+'" data-player="'+i+'">'+
    '<div class="player-head"><i></i><div><small>PLAYER / TEAM '+String(i+1).padStart(2,'0')+'</small><strong>'+esc(p.name)+'</strong></div><div class="mistakes"><b>'+p.errors+'</b><span>FEHLER</span></div></div>'+
    '<div class="chain-current"><small>LETZTES GÜLTIGES WORT</small><strong>'+esc(p.lastValid)+'</strong></div>'+
    '<div class="required-letter"><span>NÄCHSTER BUCHSTABE</span><b>'+esc(required)+'</b></div>'+
    '<div class="answer-row"><input data-answer="'+i+'" maxlength="32" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="'+esc(required)+'…"><button data-submit="'+i+'" type="button">LOCK IN</button></div>'+
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
  q('#phaseLabel').textContent=phase==='INPUT'?'EINGEBEN':'AUFLÖSUNG';
  q('#timerValue').textContent=phase==='INPUT'?(timerOff?'∞':String(Math.ceil(timeLeft))):'—';
  q('.timer-shell').classList.toggle('urgent',!timerOff&&phase==='INPUT'&&timeLeft<=5);
  q('.timer-shell').classList.toggle('off',timerOff&&phase==='INPUT');
  q('.progress').classList.toggle('off',timerOff&&phase==='INPUT');
  q('#progressBar').style.width=phase==='INPUT'?(timerOff?'100%':Math.max(0,(timeLeft/timeLimit)*100)+'%'):'0%';
  q('#simulCopy').textContent=timerOff?'Kein Zeitlimit · die Runde endet, sobald alle eingeloggt haben.':'Antwort abschicken, bevor die Zeit abläuft.';
}
function startGame(){
  const custom=titleCaseWord(q('#startWordInput').value),start=custom||titleCaseWord(randomStart());
  if(!lettersOnly(start)){alert('Bitte ein gültiges Startwort eingeben.');return}
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
async function dictionaryExists(word){
  const key=keyWord(word);
  if(wikiCache.has(key))return wikiCache.get(key);
  if(LOCAL_WORDS.has(key)){wikiCache.set(key,true);return true}
  const ctrl=new AbortController(),to=setTimeout(()=>ctrl.abort(),2600);
  try{
    const url='https://de.wiktionary.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles='+encodeURIComponent(titleCaseWord(word));
    const r=await fetch(url,{signal:ctrl.signal});const d=await r.json();
    const pages=Object.values(d?.query?.pages||{}),ok=pages.some(p=>p&&p.missing===undefined);
    wikiCache.set(key,ok);return ok;
  }catch(_){
    const fallback=/^[A-Za-zÄÖÜäöüß]{2,32}$/.test(lettersOnly(word));
    return fallback;
  }finally{clearTimeout(to)}
}
async function validatePlayer(p,roundStarted){
  const required=lastLetter(p.lastValid);
  const word=titleCaseWord(p.answer);
  const responseMs=Math.max(0,(p.submittedAt||performance.now())-roundStarted);
  p.totalMs+=timeLimit>0?Math.min(responseMs,timeLimit*1000):responseMs;
  const fail=message=>({ok:false,message,example:exampleFor(p)});
  if(!word)return fail(timeLimit>0?'ZEIT ABGELAUFEN · KEIN WORT ABGEGEBEN.':'KEIN WORT ABGEGEBEN.');
  if(firstLetter(word)!==required)return fail('MUSS MIT '+required+' BEGINNEN.');
  if(p.used.has(keyWord(word)))return fail('DIESES WORT WAR SCHON IN DEINER KETTE.');
  if(lettersOnly(word).length<2)return fail('ZU KURZ.');
  const exists=await dictionaryExists(word);
  if(!exists)return fail('NICHT IM DEUTSCHEN WIKTIONARY GEFUNDEN.');
  return {ok:true,message:'GÜLTIG · NÄCHSTER BUCHSTABE: '+lastLetter(word)+'.'}
}
async function resolveRound(roundStarted){
  if(phase!=='INPUT')return;phase='CHECK';updateTop();
  q('#phaseLabel').textContent='PRÜFEN …';
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
    const ok=await dictionaryExists('Haus');
    el.textContent=ok?'WIKTIONARY ONLINE':'LOKALER FALLBACK';el.className='wk-dict '+(ok?'ok':'warn');
  }catch(_){el.textContent='LOKALER FALLBACK';el.className='wk-dict warn'}
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