(()=>{
'use strict';
const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const screens=[...document.querySelectorAll('.mol-screen')];
let categories=[],facts=[],playerCount=4,players=[],selectedCategory=null,sequence=[],index=0,currentPlayer=0,round=1,pendingChoice=null;

const q=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'auto'})}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function rest(path){
  return fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'}}).then(async r=>{const t=await r.text();const d=t?JSON.parse(t):null;if(!r.ok)throw new Error(d?.message||('HTTP '+r.status));return d})
}
async function loadCatalog(){
  const [cats,rows]=await Promise.all([
    rest('comparison_fact_categories?select=category_key,display_name,unit,min_facts_required,sort_order&is_active=eq.true&order=sort_order.asc'),
    rest('available_comparison_facts?select=fact_id,category_key,label,value,display_value,description,difficulty&is_active=eq.true')
  ]);
  const counts={};rows.forEach(f=>counts[f.category_key]=(counts[f.category_key]||0)+1);
  categories=cats.filter(c=>(counts[c.category_key]||0)>=Number(c.min_facts_required||2));
  facts=rows;
  if(!categories.length)throw new Error('Noch keine Kategorie hat genügend Fakten.');
}
function renderPlayerInputs(){
  const host=q('#playerNames');host.innerHTML='';
  for(let i=0;i<playerCount;i++){
    const input=document.createElement('input');input.value=players[i]?.name||('PLAYER '+(i+1));input.dataset.player=i;input.maxLength=18;host.appendChild(input);
  }
}
function readPlayers(){
  players=[...q('#playerNames').querySelectorAll('input')].map((input,i)=>({name:(input.value.trim()||('PLAYER '+(i+1))).toUpperCase(),score:0}));
}
function renderScoreboard(){
  q('#scoreboard').innerHTML=players.map((p,i)=>'<div class="score-player '+(i===currentPlayer?'active':'')+'"><span>'+esc(p.name)+'</span><b>'+p.score+'</b></div>').join('');
}
async function spinCategory(){
  selectedCategory=categories[Math.floor(Math.random()*categories.length)];
  show('categoryScreen');
  const label=q('#rouletteLabel'),unit=q('#rouletteUnit');
  const delays=[75,75,80,80,90,100,115,130,150,180,220,270,330,410,520];
  let last=null;
  for(let i=0;i<delays.length;i++){
    let c;
    do{c=categories[Math.floor(Math.random()*categories.length)]}while(categories.length>1&&c===last&&i<delays.length-1);
    if(i===delays.length-1)c=selectedCategory;
    last=c;label.textContent=c.display_name;unit.textContent=c.unit||'';
    label.classList.remove('flash');void label.offsetWidth;label.classList.add('flash');
    await wait(delays[i]);
  }
  label.textContent=selectedCategory.display_name;unit.textContent=selectedCategory.unit||'';
  await wait(900);
  prepareSequence();
}
function prepareSequence(){
  sequence=shuffle(facts.filter(f=>f.category_key===selectedCategory.category_key));
  index=0;currentPlayer=0;round=1;
  q('#categoryTitle').textContent=selectedCategory.display_name;
  q('#referenceLabel').textContent=sequence[0].label;
  q('#referenceValue').textContent=sequence[0].display_value||formatValue(sequence[0].value);
  show('referenceScreen');
}
function formatValue(v){return Number(v).toLocaleString('de-DE',{maximumFractionDigits:2})+(selectedCategory?.unit?' '+selectedCategory.unit:'')}
function renderPlay(){
  if(index>=sequence.length-1){finish();return}
  const prev=sequence[index],cur=sequence[index+1],p=players[currentPlayer];
  q('#playCategory').textContent=selectedCategory.display_name;
  q('#roundNo').textContent=String(round).padStart(2,'0');
  q('#prevLabel').textContent=prev.label;
  q('#prevValue').textContent=prev.display_value||formatValue(prev.value);
  q('#currentLabel').textContent=cur.label;
  q('#turnLabel').textContent=p.name+' IST DRAN';
  renderScoreboard();show('playScreen');
}
function choose(choice){
  const prev=sequence[index],cur=sequence[index+1],p=players[currentPlayer];
  const correct=Number(cur.value)>Number(prev.value)?'MORE':Number(cur.value)<Number(prev.value)?'LESS':'EQUAL';
  const ok=choice===correct||(correct==='EQUAL'&&choice==='MORE');
  if(ok)p.score++;
  pendingChoice={prev,cur,player:p,ok,choice,correct};
  q('#revealKicker').textContent=selectedCategory.display_name+' · AUFLÖSUNG';
  q('#revealResult').textContent=ok?'RICHTIG':'FALSCH';
  q('#revealResult').className='reveal-result '+(ok?'correct':'wrong');
  q('#revealPlayer').textContent=p.name;
  q('#revealLabel').textContent=cur.label;
  q('#revealValue').textContent=cur.display_value||formatValue(cur.value);
  const rel=Number(cur.value)>Number(prev.value)?'MEHR':Number(cur.value)<Number(prev.value)?'WENIGER':'GLEICH VIEL';
  q('#revealCompare').textContent=rel+' ALS '+prev.label.toUpperCase();
  q('#nextBtn').textContent=index+2>=sequence.length?'ERGEBNIS →':'NÄCHSTER PLAYER →';
  show('revealScreen');
}
function next(){
  index++;round++;currentPlayer=(currentPlayer+1)%players.length;
  if(index>=sequence.length-1)finish();else renderPlay();
}
function finish(){
  const sorted=players.map((p,i)=>({...p,seat:i})).sort((a,b)=>b.score-a.score||a.seat-b.seat);
  q('#finalBoard').innerHTML=sorted.map((p,i)=>'<div class="final-row"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(p.name)+'</strong><b>'+p.score+' P</b></div>').join('');
  show('finishScreen');
}

q('#playerCount').addEventListener('click',e=>{const b=e.target.closest('[data-count]');if(!b)return;playerCount=Number(b.dataset.count);[...q('#playerCount').children].forEach(x=>x.classList.toggle('active',x===b));renderPlayerInputs()});
q('#startBtn').addEventListener('click',()=>{readPlayers();players.forEach(p=>p.score=0);spinCategory()});
q('#beginRoundBtn').addEventListener('click',renderPlay);
q('#choiceGrid').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)choose(b.dataset.choice)});
q('#nextBtn').addEventListener('click',next);
q('#restartBtn').addEventListener('click',()=>{players.forEach(p=>p.score=0);spinCategory()});

renderPlayerInputs();
q('#startBtn').disabled=true;
loadCatalog().then(()=>{
  q('#loadStatus').textContent=categories.length+' KATEGORIEN · '+facts.length+' FAKTEN BEREIT';
  q('#startBtn').disabled=false;
}).catch(err=>{
  q('#loadStatus').textContent='FEHLER: '+err.message;
});
})();
