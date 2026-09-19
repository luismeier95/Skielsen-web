(()=>{
'use strict';

const POLL_MS=650;
const COLORS={BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'};
let root=null,session=null,db=null,state=null,pollTimer=0,busy=false,resultIngested=false,pendingTier='NORMAL',tierBusy=false,animatedCategoryNo=0,categoryAnimating=false,animationToken=0;
const CATEGORY_POOL=[
  {category_key:'HEIGHT',display_name:'HÖHE',unit:'m'},
  {category_key:'POPULATION',display_name:'BEVÖLKERUNG',unit:'Einwohner'},
  {category_key:'AREA',display_name:'FLÄCHE',unit:'km²'},
  {category_key:'LENGTH',display_name:'LÄNGE',unit:'km'},
  {category_key:'DISTANCE',display_name:'ENTFERNUNG',unit:'km'},
  {category_key:'WIKIPEDIA_VIEWS',display_name:'WIKIPEDIA-AUFRUFE',unit:'Aufrufe/Monat'}
];

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playerById=id=>(state?.players||[]).find(p=>p.participant_id===id)||null;
const colorOf=p=>COLORS[String(p?.identity_color||'').toUpperCase()]||'var(--theme-accent)';
const tierLabel=t=>String(t||'NORMAL').toUpperCase();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const selectedTier=()=>String(session?.public_state?.familiarity_tier||'').toUpperCase();
const isAdmin=()=>!!window.skielsenV15?.runtime?.is_admin;
function categoryPoolForTier(tier){
  const t=tierLabel(tier);
  return CATEGORY_POOL.filter(c=>c.category_key!=='LENGTH'||t==='HARDCORE');
}
function difficultyHint(tier){
  const t=tierLabel(tier);
  return t==='HARDCORE'
    ?'HARDCORE · LÄNGE + BERGE FREIGESCHALTET.'
    :t+' · HÖHE NUR BAUWERKE/STATUEN · LÄNGE & BERGE NUR HARDCORE.';
}
function periodLabel(period){
  if(!period||!/^[0-9]{4}-[0-9]{2}$/.test(period))return '';
  const [y,m]=period.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,1))).toUpperCase();
}
function categoryLabel(){
  const c=state?.category||{};
  let label=String(c.display_name||c.category_key||'KATEGORIE').toUpperCase();
  if(c.category_key==='HEIGHT'&&state?.tier!=='HARDCORE')label='HÖHE · BAUWERKE & STATUEN';
  if(c.category_key==='DISTANCE')label='ENTFERNUNG · HAUPTSTÄDTE';
  if(c.category_key==='WIKIPEDIA_VIEWS'){
    const p=periodLabel(state?.reference?.reference_period||state?.current?.reference_period);
    label='WIKIPEDIA-AUFRUFE'+(p?' · '+p:'');
  }
  return label;
}
function scoreboard(){
  return (state?.players||[]).map(p=>`<div class="mol-full-score ${p.active?'':'out'}" style="--mol-player:${colorOf(p)}">
    <i></i><span>${esc(String(p.display_name||'TEILNEHMER').toUpperCase())}</span>
    <b>${Number(p.category_wins||0)} SIEGE</b>
  </div>`).join('');
}
function minimizeGame(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return !!window.skielsenInApp?.minimize?.();
}
function bindChrome(){
  root?.querySelectorAll('[data-mol-minimize]').forEach(btn=>btn.addEventListener('click',minimizeGame));
}
function header(){
  return `<header class="mol-full-header"><div><img src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>MEHR ODER WENIGER</span></div><div class="mol-full-header-right"><div class="mol-full-meta"><b>${esc(tierLabel(state?.tier))}</b><span>KATEGORIE ${Number(state?.category_no||1)} / ${Number(state?.category_count||5)}</span></div><button class="mol-minimize" data-mol-minimize type="button" aria-label="Spiel minimieren" title="Spiel minimieren">⌄</button></div></header>`;
}
function setupHeader(){
  return `<header class="mol-full-header"><div><img src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>MEHR ODER WENIGER</span></div><div class="mol-full-header-right"><div class="mol-full-meta"><b>SETUP</b><span>5 KATEGORIEN</span></div><button class="mol-minimize" data-mol-minimize type="button" aria-label="Spiel minimieren" title="Spiel minimieren">⌄</button></div></header>`;
}
function difficultyMarkup(){
  const admin=isAdmin();
  const options=[
    ['EASY','bekannte Fakten'],
    ['NORMAL','gemischtes Wissen'],
    ['HARDCORE','Nischenwissen']
  ];
  return `<section class="mol-full-app mol-setup-app">
    ${setupHeader()}
    <main class="mol-full-content mol-setup-content">
      <div class="mol-full-kicker">SPIELVORBEREITUNG</div>
      <h1>MEHR<br>ODER<br>WENIGER?</h1>
      <p class="mol-setup-lead">Eine Kategorie wird zufällig gezogen. Wer falsch liegt, scheidet für diese Kategorie aus. Last Man Standing gewinnt die Kategorie.</p>
      <section class="mol-setup-card">
        <small>BEKANNTHEITSGRAD</small>
        <div class="mol-difficulty-picker">
          ${options.map(([tier,copy])=>`<button type="button" data-mol-tier="${tier}" class="${pendingTier===tier?'active':''}" ${admin?'':'disabled'}><b>${tier}</b><span>${copy}</span></button>`).join('')}
        </div>
        <p class="mol-difficulty-hint">${esc(difficultyHint(pendingTier))}</p>
      </section>
      ${admin?`<button type="button" class="mol-setup-start" id="molStartTier" ${tierBusy?'disabled':''}>${tierBusy?'WIRD GESTARTET…':'KATEGORIE ZIEHEN →'}</button>`:`<div class="mol-full-wait">ADMIN WÄHLT DEN SCHWIERIGKEITSGRAD</div>`}
      <p class="mol-setup-feedback" id="molSetupFeedback"></p>
    </main>
  </section>`;
}
function categoryAnimationMarkup(){
  return `<section class="mol-full-app mol-category-app">
    ${header()}
    <main class="mol-full-content mol-category-content">
      <div class="mol-full-kicker">KATEGORIE WIRD GEZOGEN</div>
      <div class="mol-category-roulette">
        <div class="mol-category-label" id="molCategoryRouletteLabel">—</div>
        <div class="mol-category-unit" id="molCategoryRouletteUnit">&nbsp;</div>
      </div>
      <div class="mol-category-dots"><i></i><i></i><i></i></div>
    </main>
  </section>`;
}
function bindDifficulty(){
  root?.querySelectorAll('[data-mol-tier]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!isAdmin()||tierBusy)return;
    pendingTier=btn.dataset.molTier||'NORMAL';
    render();
  }));
  document.getElementById('molStartTier')?.addEventListener('click',()=>setTier(pendingTier));
}
async function setTier(tier){
  if(!db||!session?.session_id||tierBusy||!isAdmin())return false;
  tierBusy=true;render();
  try{
    const r=await db.rpc('set_higher_lower_tier',{p_session_id:session.session_id,p_tier:tier});
    if(r.error)throw r.error;
    session={...session,public_state:{...(session.public_state||{}),familiarity_tier:tierLabel(tier)}};
    state=null;animatedCategoryNo=0;categoryAnimating=false;animationToken++;
    await poll();
    return true;
  }catch(err){
    console.warn('More or Less tier selection',err);
    const fb=document.getElementById('molSetupFeedback');if(fb)fb.textContent='SCHWIERIGKEIT KONNTE NICHT GESPEICHERT WERDEN · '+String(err?.message||err);
    return false;
  }finally{tierBusy=false;if(!state)render()}
}
async function animateCategoryPick(){
  if(categoryAnimating||!state?.category)return;
  const categoryNo=Number(state.category_no||1),token=++animationToken;
  categoryAnimating=true;
  root.innerHTML=categoryAnimationMarkup();
  bindChrome();
  const label=root.querySelector('#molCategoryRouletteLabel'),unit=root.querySelector('#molCategoryRouletteUnit');
  let pool=categoryPoolForTier(state.tier);
  const selected={category_key:state.category.category_key,display_name:state.category.display_name||state.category.category_key,unit:state.category.unit||''};
  if(!pool.some(c=>c.category_key===selected.category_key))pool=[...pool,selected];
  const delays=[75,75,80,80,90,100,115,130,150,180,220,270,330,410,520];
  let last=null;
  for(let i=0;i<delays.length;i++){
    if(token!==animationToken)return;
    let c;
    do{c=pool[Math.floor(Math.random()*pool.length)]}while(pool.length>1&&c===last&&i<delays.length-1);
    if(i===delays.length-1)c=selected;
    last=c;
    if(label){label.textContent=c.display_name;label.classList.remove('flash');void label.offsetWidth;label.classList.add('flash')}
    if(unit)unit.textContent=c.unit||'';
    await wait(delays[i]);
  }
  if(token!==animationToken)return;
  if(label)label.textContent=selected.display_name;
  if(unit)unit.textContent=selected.unit||'';
  await wait(900);
  if(token!==animationToken)return;
  animatedCategoryNo=categoryNo;categoryAnimating=false;render();
}
function questionMarkup(){
  const current=state?.current_player||{},mine=!!state?.viewer?.is_turn,ref=state?.reference||{},cur=state?.current||{};
  const who=current.member_name||current.display_name||'PLAYER';
  return `<section class="mol-full-app">
    ${header()}
    <main class="mol-full-content">
      <div class="mol-full-kicker">${esc(categoryLabel())}</div>
      <div class="mol-full-scoreboard">${scoreboard()}</div>
      <section class="mol-full-compare">
        <div class="mol-full-reference"><small>REFERENZ</small><strong>${esc(ref.label||'—')}</strong><b>${esc(ref.display_value||ref.value||'—')}</b></div>
        <div class="mol-full-vs">VS</div>
        <div class="mol-full-current"><small>${mine?'DU BIST DRAN':esc(String(who).toUpperCase()+' IST DRAN')}</small><strong>${esc(cur.label||'—')}</strong><span>IST DER WERT …</span></div>
      </section>
      ${mine?`<div class="mol-full-choice"><button data-mol-choice="LESS" class="less"><span>↓</span>WENIGER</button><button data-mol-choice="MORE" class="more"><span>↑</span>MEHR</button></div>`:`<div class="mol-full-wait">WARTEN · ${esc(String(who).toUpperCase())} ENTSCHEIDET</div>`}
    </main>
  </section>`;
}
function revealMarkup(){
  const lr=state?.last_result||{},p=playerById(lr.participant_id),mine=state?.viewer?.member_id===lr.answer_member_id;
  const survivors=(state?.players||[]).filter(x=>x.active);
  const categoryOver=survivors.length===1;
  return `<section class="mol-full-app">
    ${header()}
    <main class="mol-full-content reveal">
      <div class="mol-full-kicker">${esc(categoryLabel())} · AUFLÖSUNG</div>
      <div class="mol-full-result ${lr.ok?'correct':'wrong'}">${lr.ok?'RICHTIG':'FALSCH'}</div>
      <section class="mol-full-reveal-card" style="--mol-player:${colorOf(p)}">
        <small>${esc(String(p?.display_name||'PLAYER').toUpperCase())}</small>
        <strong>${esc(lr.current_label||state?.current?.label||'—')}</strong>
        <b>${esc(lr.current_display_value||state?.current?.display_value||'—')}</b>
        <p>${esc(String(lr.correct_choice||'').toUpperCase())} ALS ${esc(String(lr.reference_label||'REFERENZ').toUpperCase())}</p>
      </section>
      <div class="mol-full-scoreboard">${scoreboard()}</div>
      ${mine?`<button class="mol-full-continue" id="molFullContinue" type="button">${categoryOver?'KATEGORIE ABSCHLIESSEN →':'NÄCHSTER ZUG →'}</button>`:`<div class="mol-full-wait">AUFLÖSUNG · WARTET AUF WEITER</div>`}
    </main>
  </section>`;
}
function completeMarkup(){
  const standings=Array.isArray(state?.result?.standings)?state.result.standings:[];
  return `<section class="mol-full-app">
    ${header()}
    <main class="mol-full-content complete">
      <div class="mol-full-kicker">SPIEL BEENDET</div>
      <h1>MEHR<br>ODER<br>WENIGER.</h1>
      <div class="mol-full-final">${standings.map((r,i)=>{
        const p=playerById(r.participant_id);
        return `<div class="mol-full-final-row" style="--mol-player:${colorOf(p)}"><span>${Number(r.placement||i+1)}.</span><i></i><strong>${esc(String(p?.display_name||'TEILNEHMER').toUpperCase())}</strong><b>${Number(r.category_wins||0)} KATEGORIE-SIEGE</b></div>`;
      }).join('')}</div>
      <p class="mol-full-finished-note">ERGEBNIS WIRD AN DAS TURNIER ÜBERGEBEN.</p>
    </main>
  </section>`;
}
function render(){
  if(!root)return;
  root.closest('#v15InAppLayer')?.classList.remove('buzzer-mode');
  if(!selectedTier()){
    root.innerHTML=difficultyMarkup();
    bindDifficulty();
    bindChrome();
    return;
  }
  if(!state){
    root.innerHTML=`<section class="mol-full-app">${header()}<main class="mol-full-content"><div class="mol-full-wait">SPIELDATEN WERDEN GELADEN…</div></main></section>`;
    bindChrome();
    return;
  }
  if(state.phase==='QUESTION'&&Number(state.category_no||1)!==animatedCategoryNo){
    if(!categoryAnimating)void animateCategoryPick();
    return;
  }
  if(categoryAnimating)return;
  if(state.phase==='COMPLETE'||state.status==='FINISHED')root.innerHTML=completeMarkup();
  else if(state.phase==='REVEAL')root.innerHTML=revealMarkup();
  else root.innerHTML=questionMarkup();
  bindChrome();
  root.querySelectorAll('[data-mol-choice]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.molChoice)));
  document.getElementById('molFullContinue')?.addEventListener('click',()=>act('CONTINUE'));
}
async function act(type){
  if(!db||!session?.session_id||busy)return;
  busy=true;
  try{
    root?.querySelectorAll('button').forEach(b=>b.disabled=true);
    const r=await db.rpc('higher_lower_action',{p_session_id:session.session_id,p_action_type:type});
    if(r.error){console.warn('More or Less action',r.error);return}
    if(r.data?.result&&!resultIngested){
      resultIngested=!!window.skielsenV15?.ingestInAppGameResult?.(session.tournament_game_id,r.data.result);
    }
    await poll();
  }finally{busy=false}
}
async function poll(){
  if(!db||!session?.session_id||busy)return;
  if(!selectedTier()){render();return}
  busy=true;
  try{
    const r=await db.rpc('get_higher_lower_state',{p_session_id:session.session_id});
    if(r.error){console.warn('More or Less state',r.error);return}
    if(!r.data)return;
    state=r.data;
    if((state.phase==='COMPLETE'||state.status==='FINISHED')&&state.result&&!resultIngested){
      resultIngested=!!window.skielsenV15?.ingestInAppGameResult?.(session.tournament_game_id,state.result);
    }
    render();
  }finally{busy=false}
}
function mount(nextRoot,nextSession,nextDb){
  if(!nextRoot||!nextSession?.session_id||!nextDb)return false;
  if(session?.session_id!==nextSession.session_id){state=null;resultIngested=false;pendingTier='NORMAL';tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;animationToken++}
  root=nextRoot;session=nextSession;db=nextDb;
  const existingTier=selectedTier();if(existingTier)pendingTier=existingTier;
  clearInterval(pollTimer);
  if(existingTier)void poll();else render();
  pollTimer=setInterval(poll,POLL_MS);
  return true;
}
function updateSession(nextSession){
  if(nextSession?.session_id!==session?.session_id)return;
  const before=selectedTier();
  session=nextSession;
  const after=selectedTier();
  if(after)pendingTier=after;
  if(!after){state=null;render();return}
  if(!before&&after)void poll();
}
function unmount(){
  clearInterval(pollTimer);pollTimer=0;animationToken++;root=null;session=null;db=null;state=null;busy=false;resultIngested=false;tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;
}
window.skielsenMoreLess={mount,updateSession,unmount,poll,setTier};
})();
