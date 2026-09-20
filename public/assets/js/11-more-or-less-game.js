(()=>{
'use strict';

const POLL_MS=650;
const COLORS={BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'};
let root=null,session=null,db=null,state=null,pollTimer=0,busy=false,resultIngested=false,pendingTier='NORMAL',tierBusy=false,animatedCategoryNo=0,categoryAnimating=false,animationToken=0,feedbackKey='',feedbackTimer=0;
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
function playerByMemberId(id){return (state?.players||[]).find(p=>p.member_id===id)||null}
function playStatusMarkup(player){
  const name=String(player?.display_name||player?.member_name||'PLAYER').toUpperCase();
  return `<section class="mol-full-play-status">
    <div><small>KATEGORIE</small><strong>${esc(categoryLabel())}</strong></div>
    <div><small>ZUG</small><strong>${esc(name)}</strong></div>
  </section>`;
}
function countFrame(finalValue,target,progress){
  const n=Number(target);
  if(!Number.isFinite(n))return progress>=1?String(finalValue||'—'):'0';
  if(progress>=1)return String(finalValue||target||'—');
  const decimals=Math.abs(n%1)>0.0001?1:0,step=decimals?0.1:1;
  const current=Math.max(0,Math.min(n-step,Math.floor(n*progress/step)*step));
  const suffix=String(finalValue||'').replace(/^[\d\s.,+-]+/,'').trim();
  const number=current.toLocaleString('de-DE',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  return number+(suffix?' '+suffix:'');
}
function animateRevealCount(el,finalValue,target,duration=2000){
  return new Promise(resolve=>{
    if(!el){resolve();return}
    const start=performance.now();
    const step=now=>{
      const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3);
      el.textContent=countFrame(finalValue,target,eased);
      if(p<1)requestAnimationFrame(step);
      else{el.textContent=String(finalValue||target||'—');resolve()}
    };
    requestAnimationFrame(step);
  });
}
function scoreboard(){
  return (state?.players||[]).map(p=>`<div class="mol-full-score ${p.active?'':'out'}" style="--mol-player:${colorOf(p)}">
    <i></i><span>${esc(String(p.display_name||'TEILNEHMER').toUpperCase())}</span><b>${Number(p.category_wins||0)}</b>
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
      <h1>MEHR<br>ODER<br>WENIGER?</h1>
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
      ${playStatusMarkup(current)}
      <div class="mol-full-scoreboard">${scoreboard()}</div>
      <section class="mol-full-compare">
        <div class="mol-full-reference"><strong>${esc(ref.label||'—')}</strong><b>${esc(ref.display_value||ref.value||'—')}</b></div>
        <div class="mol-full-vs">VS</div>
        <div class="mol-full-current"><strong>${esc(cur.label||'—')}</strong><b class="mol-full-pending-value">&nbsp;</b></div>
      </section>
      ${mine?`<div class="mol-full-choice"><button data-mol-choice="LESS" class="less"><span>↓</span>WENIGER</button><button data-mol-choice="MORE" class="more"><span>↑</span>MEHR</button></div>`:`<div class="mol-full-wait">WARTEN · ${esc(String(who).toUpperCase())} ENTSCHEIDET</div>`}
    </main>
  </section>`;
}
function revealMarkup(){
  const lr=state?.last_result||{},ok=!!lr.ok,mine=state?.viewer?.member_id===lr.answer_member_id;
  const survivors=(state?.players||[]).filter(x=>x.active),categoryOver=survivors.length===1;
  const ref=state?.reference||{},cur=state?.current||{};
  const actor=playerByMemberId(lr.answer_member_id)||state?.current_player||{};
  const refLabel=lr.reference_label||ref.label||'—';
  const refValue=lr.reference_display_value||lr.reference_value||ref.display_value||ref.value||'—';
  const curLabel=lr.current_label||cur.label||'—';
  const curValue=lr.current_display_value||lr.current_value||cur.display_value||cur.value||'—';
  const curNumeric=Number(lr.current_value??cur.value);
  return `<section class="mol-full-app">
    ${header()}
    <main class="mol-full-content">
      ${playStatusMarkup(actor)}
      <div class="mol-full-scoreboard">${scoreboard()}</div>
      <section class="mol-full-compare is-feedback ${ok?'is-correct':'is-wrong'}">
        <div class="mol-full-reference"><strong>${esc(refLabel)}</strong><b>${esc(refValue)}</b></div>
        <div class="mol-full-vs mol-full-outcome" aria-label="${ok?'Richtig':'Falsch'}">${ok?'✓':'✕'}</div>
        <div class="mol-full-current"><strong>${esc(curLabel)}</strong><b id="molFullCount" data-target="${Number.isFinite(curNumeric)?curNumeric:''}" data-final="${esc(curValue)}">0</b></div>
      </section>
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
      <div class="mol-full-final">
        <div class="mol-full-final-head"><span>PLATZ</span><span></span><span>NAME</span><span>SIEGE</span></div>
        ${standings.map((r,i)=>{
          const p=playerById(r.participant_id);
          return `<div class="mol-full-final-row" style="--mol-player:${colorOf(p)}"><span>${Number(r.placement||i+1)}.</span><i></i><strong>${esc(String(p?.display_name||'TEILNEHMER').toUpperCase())}</strong><b>${Number(r.category_wins||0)}</b></div>`;
        }).join('')}
      </div>
      <p class="mol-full-finished-note">ERGEBNIS WIRD AN DAS TURNIER ÜBERGEBEN.</p>
    </main>
  </section>`;
}
function render(){
  if(!root)return;
  root.closest('#v15InAppLayer')?.classList.remove('buzzer-mode');
  if(!selectedTier()){
    feedbackKey='';clearTimeout(feedbackTimer);
    root.innerHTML=difficultyMarkup();
    bindDifficulty();
    bindChrome();
    return;
  }
  if(!state){
    feedbackKey='';clearTimeout(feedbackTimer);
    root.innerHTML=`<section class="mol-full-app">${header()}<main class="mol-full-content"><div class="mol-full-wait">SPIELDATEN WERDEN GELADEN…</div></main></section>`;
    bindChrome();
    return;
  }
  if(state.phase==='QUESTION'&&Number(state.category_no||1)!==animatedCategoryNo){
    if(!categoryAnimating)void animateCategoryPick();
    return;
  }
  if(categoryAnimating)return;

  if(state.phase==='REVEAL'){
    const lr=state?.last_result||{};
    const key=[state.category_no,lr.answer_member_id,lr.current_label,lr.current_display_value,lr.ok].join('|');
    if(feedbackKey===key&&root.querySelector('.mol-full-compare.is-feedback')){bindChrome();return}
    feedbackKey=key;clearTimeout(feedbackTimer);
    root.innerHTML=revealMarkup();
    bindChrome();
    const countEl=document.getElementById('molFullCount');
    const finalValue=countEl?.dataset.final||'—';
    const target=countEl?.dataset.target;
    animateRevealCount(countEl,finalValue,target).then(()=>{
      const currentKey=feedbackKey;
      if(currentKey!==key)return;
      if(lr.ok){
        feedbackTimer=setTimeout(()=>{
          if(feedbackKey!==key)return;
          root.querySelector('.mol-full-compare.is-feedback')?.classList.add('is-promoting');
          const mine=state?.viewer?.member_id===lr.answer_member_id;
          if(mine)feedbackTimer=setTimeout(()=>{if(feedbackKey===key)void act('CONTINUE')},500);
        },250);
      }else{
        const mine=state?.viewer?.member_id===lr.answer_member_id;
        if(mine&&feedbackKey===key)requestAnimationFrame(()=>void act('CONTINUE'));
      }
    });
    return;
  }

  feedbackKey='';clearTimeout(feedbackTimer);
  if(state.phase==='COMPLETE'||state.status==='FINISHED')root.innerHTML=completeMarkup();
  else root.innerHTML=questionMarkup();
  bindChrome();
  root.querySelectorAll('[data-mol-choice]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.molChoice)));
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
  }finally{busy=false}
  await poll();
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
  if(session?.session_id!==nextSession.session_id){state=null;resultIngested=false;pendingTier='NORMAL';tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;animationToken++;feedbackKey='';clearTimeout(feedbackTimer)}
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
  clearInterval(pollTimer);pollTimer=0;animationToken++;clearTimeout(feedbackTimer);feedbackKey='';root=null;session=null;db=null;state=null;busy=false;resultIngested=false;tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;
}
window.skielsenMoreLess={mount,updateSession,unmount,poll,setTier};
})();
