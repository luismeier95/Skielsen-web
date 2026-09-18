(()=>{
'use strict';
const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const screens=[...document.querySelectorAll('.mol-screen')];

let categories=[],facts=[],playerCount=4,players=[],familiarityTier='NORMAL';
let selectedCategory=null,lastCategoryKey=null,sequence=[],index=0,currentPlayer=0,turnNo=1;
let categoryNo=0,categoryStarter=0,categoryWinner=null,pendingChoice=null;
const usedFactIds=new Map();

const q=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'auto'})}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function rest(path){
  return fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'}}).then(async r=>{
    const t=await r.text(),d=t?JSON.parse(t):null;
    if(!r.ok)throw new Error(d?.message||('HTTP '+r.status));
    return d;
  })
}
async function loadCatalog(){
  const [cats,rows]=await Promise.all([
    rest('comparison_fact_categories?select=category_key,display_name,unit,min_facts_required,sort_order&is_active=eq.true&order=sort_order.asc'),
    rest('available_comparison_facts?select=fact_id,category_key,label,value,display_value,description,difficulty,familiarity_tier&is_active=eq.true')
  ]);
  categories=cats;
  facts=rows;
  if(!categories.length||!facts.length)throw new Error('Der Faktenkatalog ist leer.');
}
function renderPlayerInputs(){
  const host=q('#playerNames');host.innerHTML='';
  for(let i=0;i<playerCount;i++){
    const input=document.createElement('input');
    input.value=players[i]?.name||('PLAYER '+(i+1));input.dataset.player=i;input.maxLength=18;
    host.appendChild(input);
  }
}
function readPlayers(){
  players=[...q('#playerNames').querySelectorAll('input')].map((input,i)=>({
    name:(input.value.trim()||('PLAYER '+(i+1))).toUpperCase(),
    score:0,active:true,seat:i
  }));
}
function renderScoreboard(){
  q('#scoreboard').innerHTML=players.map((p,i)=>
    '<div class="score-player '+(i===currentPlayer&&p.active?'active ':'')+(!p.active?'eliminated':'')+'">'+
      '<span>'+esc(p.name)+'</span><b>'+p.score+'</b>'+
    '</div>'
  ).join('');
}
function tierLabel(){return familiarityTier==='EASY'?'EASY':familiarityTier==='HARDCORE'?'HARDCORE':'NORMAL'}
function playableCategories(){
  const counts={};
  facts.filter(f=>f.familiarity_tier===familiarityTier).forEach(f=>counts[f.category_key]=(counts[f.category_key]||0)+1);
  return categories.filter(c=>(counts[c.category_key]||0)>=Number(c.min_facts_required||2));
}
function refreshCatalogStatus(){
  const playable=playableCategories(),tierFacts=facts.filter(f=>f.familiarity_tier===familiarityTier);
  q('#difficultyHint').textContent=tierLabel()+' · nur Fakten dieser Einstufung werden gezogen.';
  q('#loadStatus').textContent=playable.length+' KATEGORIEN · '+tierFacts.length+' '+tierLabel()+'-FAKTEN · '+playable.map(c=>c.display_name).join(' · ');
  q('#startBtn').disabled=!playable.length;
}
function pickCategory(){
  let pool=playableCategories();
  if(pool.length>1&&lastCategoryKey)pool=pool.filter(c=>c.category_key!==lastCategoryKey);
  return pool[Math.floor(Math.random()*pool.length)];
}
async function spinCategory(){
  const roulettePool=playableCategories();
  selectedCategory=pickCategory();
  if(!selectedCategory){alert('Für '+tierLabel()+' gibt es noch keine spielbare Kategorie.');return}
  categoryNo++;
  categoryStarter=(categoryNo-1)%players.length;
  players.forEach(p=>p.active=true);
  categoryWinner=null;pendingChoice=null;
  show('categoryScreen');
  const label=q('#rouletteLabel'),unit=q('#rouletteUnit');
  const delays=[75,75,80,80,90,100,115,130,150,180,220,270,330,410,520];
  let last=null;
  for(let i=0;i<delays.length;i++){
    let c;
    do{c=roulettePool[Math.floor(Math.random()*roulettePool.length)]}while(roulettePool.length>1&&c===last&&i<delays.length-1);
    if(i===delays.length-1)c=selectedCategory;
    last=c;label.textContent=c.display_name;unit.textContent=c.unit||'';
    label.classList.remove('flash');void label.offsetWidth;label.classList.add('flash');
    await wait(delays[i]);
  }
  label.textContent=selectedCategory.display_name;unit.textContent=selectedCategory.unit||'';
  lastCategoryKey=selectedCategory.category_key;
  await wait(900);
  prepareSequence();
}
function categoryFacts(){
  return facts.filter(f=>f.category_key===selectedCategory.category_key&&f.familiarity_tier===familiarityTier);
}
function availableFacts(){
  const all=categoryFacts();
  const usedKey=familiarityTier+'::'+selectedCategory.category_key;
  let used=usedFactIds.get(usedKey);
  if(!used){used=new Set();usedFactIds.set(usedKey,used)}
  let open=all.filter(f=>!used.has(f.fact_id));
  if(open.length<2){used.clear();open=[...all]}
  return open;
}
function markUsed(fact){
  if(!fact?.fact_id)return;
  const usedKey=familiarityTier+'::'+selectedCategory.category_key;
  let used=usedFactIds.get(usedKey);
  if(!used){used=new Set();usedFactIds.set(usedKey,used)}
  used.add(fact.fact_id);
}
function prepareSequence(){
  sequence=shuffle(availableFacts());
  index=0;turnNo=1;currentPlayer=categoryStarter;
  markUsed(sequence[0]);
  q('#categoryTitle').textContent=selectedCategory.display_name;
  q('#referenceLabel').textContent=sequence[0].label;
  q('#referenceValue').textContent=sequence[0].display_value||formatValue(sequence[0].value);
  q('#starterLabel').textContent=players[categoryStarter].name+' BEGINNT';
  show('referenceScreen');
}
function formatValue(v){
  return Number(v).toLocaleString('de-DE',{maximumFractionDigits:2})+(selectedCategory?.unit?' '+selectedCategory.unit:'')
}
function activePlayers(){return players.filter(p=>p.active)}
function nextActiveSeat(from){
  for(let step=1;step<=players.length;step++){
    const ix=(from+step)%players.length;
    if(players[ix].active)return ix;
  }
  return from;
}
function ensureComparableNext(){
  if(index>=sequence.length-1){
    const more=shuffle(availableFacts().filter(f=>f.fact_id!==sequence[index]?.fact_id));
    sequence=[sequence[index],...more];index=0;
  }
  const prev=sequence[index],next=sequence[index+1];
  if(!prev||!next)return false;
  if(Number(prev.value)!==Number(next.value))return true;
  const swapAt=sequence.findIndex((f,i)=>i>index+1&&Number(f.value)!==Number(prev.value));
  if(swapAt<0)return false;
  [sequence[index+1],sequence[swapAt]]=[sequence[swapAt],sequence[index+1]];
  return true;
}
function renderPlay(){
  if(activePlayers().length<=1){finishCategory(activePlayers()[0]);return}
  if(!ensureComparableNext()){
    const more=shuffle(categoryFacts().filter(f=>Number(f.value)!==Number(sequence[index]?.value)));
    if(!more.length){alert('Für diese Kategorie gibt es keine weiteren vergleichbaren Fakten.');return}
    sequence=[sequence[index],...more];index=0;
  }
  const prev=sequence[index],cur=sequence[index+1],p=players[currentPlayer];
  q('#playCategory').textContent=selectedCategory.display_name;
  q('#roundNo').textContent=String(turnNo).padStart(2,'0');
  q('#prevLabel').textContent=prev.label;
  q('#prevValue').textContent=prev.display_value||formatValue(prev.value);
  q('#currentLabel').textContent=cur.label;
  q('#turnLabel').textContent=p.name+' IST DRAN';
  renderScoreboard();show('playScreen');
}
function choose(choice){
  const prev=sequence[index],cur=sequence[index+1],p=players[currentPlayer];
  const correct=Number(cur.value)>Number(prev.value)?'MORE':'LESS';
  const ok=choice===correct;
  markUsed(cur);
  if(!ok)p.active=false;
  pendingChoice={prev,cur,player:p,playerSeat:currentPlayer,ok,choice,correct};
  q('#revealKicker').textContent=selectedCategory.display_name+' · AUFLÖSUNG';
  q('#revealResult').textContent=ok?'RICHTIG':'FALSCH · AUSGESCHIEDEN';
  q('#revealResult').className='reveal-result '+(ok?'correct':'wrong');
  q('#revealPlayer').textContent=p.name;
  q('#revealLabel').textContent=cur.label;
  q('#revealValue').textContent=cur.display_value||formatValue(cur.value);
  q('#revealCompare').textContent=(Number(cur.value)>Number(prev.value)?'MEHR':'WENIGER')+' ALS '+prev.label.toUpperCase();

  const survivors=activePlayers();
  if(!ok&&survivors.length===1)q('#nextBtn').textContent=survivors[0].name+' GEWINNT →';
  else q('#nextBtn').textContent='NÄCHSTER PLAYER / TEAM →';
  show('revealScreen');
}
function next(){
  if(!pendingChoice)return;
  index++;turnNo++;
  const from=pendingChoice.playerSeat;
  pendingChoice=null;
  const survivors=activePlayers();
  if(survivors.length===1){finishCategory(survivors[0]);return}
  currentPlayer=nextActiveSeat(from);
  renderPlay();
}
function finishCategory(winner){
  if(!winner)return;
  categoryWinner=winner;winner.score++;
  q('#winnerTitle').textContent=winner.name+' GEWINNT.';
  q('#winnerCopy').textContent='LAST MAN STANDING · '+selectedCategory.display_name+' · KATEGORIE '+categoryNo;
  const ordered=[...players].sort((a,b)=>Number(b.active)-Number(a.active)||b.score-a.score||a.seat-b.seat);
  q('#finalBoard').innerHTML=ordered.map((p,i)=>
    '<div class="final-row '+(!p.active?'out':'')+'">'+
      '<span>'+String(i+1).padStart(2,'0')+'</span>'+
      '<strong>'+esc(p.name)+'</strong>'+
      '<div class="state">'+(p===winner?'KATEGORIE-SIEG · '+p.score:'AUSGESCHIEDEN · '+p.score+' SIEGE')+'</div>'+
    '</div>'
  ).join('');
  show('finishScreen');
}
function newCategory(){spinCategory()}

q('#playerCount').addEventListener('click',e=>{
  const b=e.target.closest('[data-count]');if(!b)return;
  playerCount=Number(b.dataset.count);
  [...q('#playerCount').children].forEach(x=>x.classList.toggle('active',x===b));
  renderPlayerInputs();
});
q('#difficultyPicker').addEventListener('click',e=>{
  const b=e.target.closest('[data-tier]');if(!b)return;
  familiarityTier=b.dataset.tier;
  [...q('#difficultyPicker').children].forEach(x=>x.classList.toggle('active',x===b));
  refreshCatalogStatus();
});
q('#startBtn').addEventListener('click',()=>{
  readPlayers();categoryNo=0;lastCategoryKey=null;usedFactIds.clear();spinCategory();
});
q('#beginRoundBtn').addEventListener('click',renderPlay);
q('#choiceGrid').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)choose(b.dataset.choice)});
q('#nextBtn').addEventListener('click',next);
q('#restartBtn').addEventListener('click',newCategory);

renderPlayerInputs();
q('#startBtn').disabled=true;
loadCatalog().then(()=>{
  refreshCatalogStatus();
}).catch(err=>{
  q('#loadStatus').textContent='FEHLER: '+err.message;
});
})();
