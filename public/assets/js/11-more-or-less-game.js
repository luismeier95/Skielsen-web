(()=>{
'use strict';

const POLL_MS=650;
const COLORS={BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'};
let root=null,session=null,db=null,state=null,pollTimer=0,botTimer=0,botTurnKey='',busy=false,resultIngested=false,pendingTier='NORMAL',tierBusy=false,animatedCategoryNo=0,categoryAnimating=false,animationToken=0,feedbackKey='',feedbackTimer=0,recoveryTimer=0,postgamePhase='RANKING',postgameBusy=false,postgameTimers=[],postgameRun=0,postgameRendered=false;
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
function scheduleRecoveryPoll(delay=700){clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{recoveryTimer=0;void poll()},delay)}
function questionPayloadReady(){return !!(state?.category&&state?.reference&&state?.current)}
function scheduleRevealContinue(key,delay=300){
  clearTimeout(feedbackTimer);
  const attempt=()=>{
    feedbackTimer=0;
    if(feedbackKey!==key||state?.phase!=='REVEAL')return;
    if(busy){feedbackTimer=setTimeout(attempt,120);return}
    void act('CONTINUE');
  };
  feedbackTimer=setTimeout(attempt,delay);
}
const selectedTier=()=>String(session?.public_state?.familiarity_tier||'').toUpperCase();
const isAdmin=()=>!!window.skielsenV15?.runtime?.is_admin;
const isTestBotTournament=()=>{
  const runtime=window.skielsenV15?.runtime||{};
  const sessionFlag=!!session?.public_state?.test_bot_mode;
  const namedTest=!!(runtime.test_mode&&/^Mehr oder Weniger$/i.test(String(runtime.tournament_name||runtime.name||'').trim()));
  return sessionFlag||namedTest;
};
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
function scheduleBotTurn(){
  const eligible=isTestBotTournament()&&state?.phase==='QUESTION'&&state?.current_player?.is_bot;
  if(!eligible){
    clearTimeout(botTimer);botTimer=0;botTurnKey='';
    return;
  }
  const key=[state?.category_no,state?.turn_no,state?.current_player?.participant_id].join('|');
  if(botTimer&&botTurnKey===key)return;
  if(botTimer){clearTimeout(botTimer);botTimer=0}
  botTurnKey=key;
  const decide=()=>{
    botTimer=0;
    const stillSame=isTestBotTournament()
      &&state?.phase==='QUESTION'
      &&state?.current_player?.is_bot
      &&[state?.category_no,state?.turn_no,state?.current_player?.participant_id].join('|')===key;
    if(!stillSame){botTurnKey='';return}
    if(busy){
      botTimer=setTimeout(decide,180);
      return;
    }
    const seed=String(key).split('').reduce((n,ch)=>((n*33)+ch.charCodeAt(0))>>>0,5381);
    void act((seed%2)===0?'MORE':'LESS');
  };
  botTimer=setTimeout(decide,850);
}
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
function animateRevealCount(el,finalValue,target,duration=1000){
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
  return `<div class="mol-game-toolbar"><div class="mol-full-meta"><b>${esc(tierLabel(state?.tier))}</b><span>KATEGORIE ${Number(state?.category_no||1)} / ${Number(state?.category_count||5)}</span></div><button class="mol-minimize" data-mol-minimize type="button" aria-label="Spiel minimieren" title="Spiel minimieren">⌄</button></div>`;
}
function setupHeader(){
  return `<div class="mol-game-toolbar"><div class="mol-full-meta"><b>SETUP</b><span>5 KATEGORIEN</span></div><button class="mol-minimize" data-mol-minimize type="button" aria-label="Spiel minimieren" title="Spiel minimieren">⌄</button></div>`;
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
        <div class="mol-difficulty-picker" style="--difficulty-count:${options.length}">
          ${options.map(([tier,copy])=>`<button type="button" data-mol-tier="${tier}" class="${pendingTier===tier?'active':''}" ${admin?'':'disabled'}><b>${tier}</b><span>${copy}</span></button>`).join('')}
        </div>
        <p class="mol-difficulty-hint">${esc(difficultyHint(pendingTier))}</p>
      </section>
      ${admin?`<button type="button" class="mol-setup-start" id="molStartTier" ${tierBusy?'disabled':''}>${tierBusy?'WIRD GESPEICHERT…':'WEITER →'}</button>`:`<div class="mol-full-wait">ADMIN WÄHLT DEN SCHWIERIGKEITSGRAD</div>`}
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
    if(String(session?.status||'').toUpperCase()!=='ACTIVE'){render();void window.skielsenInApp?.poll?.();return true}
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
      <div class="mol-full-play-layout">
        ${playStatusMarkup(current)}
        <div class="mol-full-scoreboard" data-player-count="${Math.min(4,(state?.players||[]).length)}">${scoreboard()}</div>
        <section class="mol-full-compare" id="molFullCompare">
          <div class="mol-full-reference"><strong>${esc(ref.label||'—')}</strong><b>${esc(ref.display_value||ref.value||'—')}</b></div>
          <div class="mol-full-vs" id="molFullCenterCircle">VS</div>
          <div class="mol-full-current"><strong>${esc(cur.label||'—')}</strong><b class="mol-full-pending-value">&nbsp;</b></div>
        </section>
        <div class="mol-full-action-slot">
          ${mine?`<div class="mol-full-choice"><button data-mol-choice="LESS" class="less"><span>↓</span>WENIGER</button><button data-mol-choice="MORE" class="more"><span>↑</span>MEHR</button></div>`:`<div class="mol-full-wait">WARTEN · ${esc(String(who).toUpperCase())} ENTSCHEIDET</div>`}
        </div>
      </div>
    </main>
  </section>`;
}
function revealMarkup(){
  const lr=state?.last_result||{},ok=!!lr.ok,mine=state?.viewer?.member_id===lr.answer_member_id;
  const ref=state?.reference||{},cur=state?.current||{};
  const actor=playerById(lr.participant_id)||playerByMemberId(lr.answer_member_id)||state?.current_player||{};
  const refLabel=lr.reference_label||ref.label||'—';
  const refValue=lr.reference_display_value||lr.reference_value||ref.display_value||ref.value||'—';
  const curLabel=lr.current_label||cur.label||'—';
  const curValue=lr.current_display_value||lr.current_value||cur.display_value||cur.value||'—';
  const curNumeric=Number(lr.current_value??cur.value);
  return `<section class="mol-full-app">
    ${header()}
    <main class="mol-full-content">
      <div class="mol-full-play-layout">
        ${playStatusMarkup(actor)}
        <div class="mol-full-scoreboard" data-player-count="${Math.min(4,(state?.players||[]).length)}">${scoreboard()}</div>
        <section class="mol-full-compare is-feedback ${ok?'is-correct':'is-wrong'}" id="molFullCompare">
          <div class="mol-full-reference"><strong>${esc(refLabel)}</strong><b>${esc(refValue)}</b></div>
          <div class="mol-full-vs mol-full-outcome" id="molFullCenterCircle">VS</div>
          <div class="mol-full-current"><strong>${esc(curLabel)}</strong><b id="molFullCount" data-target="${Number.isFinite(curNumeric)?curNumeric:''}" data-final="${esc(curValue)}">0</b></div>
        </section>
        <div class="mol-full-action-slot">
          ${mine?`<div class="mol-full-choice is-locked" aria-disabled="true"><button class="less" type="button" tabindex="-1"><span>↓</span>WENIGER</button><button class="more" type="button" tabindex="-1"><span>↑</span>MEHR</button></div>`:`<div class="mol-full-wait">WARTEN</div>`}
        </div>
      </div>
    </main>
  </section>`;
}
function clearPostgameTimers(){postgameTimers.forEach(clearTimeout);postgameTimers=[]}
function postgameLater(fn,ms){const id=setTimeout(fn,ms);postgameTimers.push(id);return id}
function canonicalPostgame(){
  return window.skielsenBuzzerBridge?.getCanonicalPostgame?.(session?.tournament_game_id,state?.result)||null;
}
function jokerRevealAllowed(reveal){
  return !!reveal&&String(reveal?.joker?.category||'').toUpperCase()!=='ACTION';
}
function movementText(delta){
  delta=Number(delta||0);return delta>0?'▲ '+delta:(delta<0?'▼ '+Math.abs(delta):'—');
}
function rankingMarkup(){
  const standings=Array.isArray(state?.result?.standings)?[...state.result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)):[];
  const pg=canonicalPostgame(),byId=new Map((pg?.rows||[]).map(r=>[r.participant_id,r]));
  return `<section class="mol-full-app mol-result-page">
    ${header()}
    <main class="mol-result-main">
      <section class="mol-result-status"><strong>ERGEBNIS</strong></section>
      <section class="mol-result-card mol-standard-ranking">
        <header><strong>FINALES ERGEBNIS</strong><span>${standings.length?standings.length+' PARTICIPANTS':'—'}</span></header>
        <div class="mol-result-columns mol-standard-columns"><span>POSITION</span><span>NAME</span><span>SIEGE</span><span>PUNKTE</span></div>
        <div class="mol-result-rows">
          ${standings.map((r,i)=>{
            const p=playerById(r.participant_id),m=byId.get(r.participant_id)||{};
            return `<div class="mol-result-row mol-standard-row" style="--mol-row-delay:${i*120}ms">
              <b>${Number(r.placement||i+1)}.</b>
              <span><i style="--mol-player:${colorOf(p)}"></i><strong>${esc(String(p?.display_name||m.display_name||'TEILNEHMER').toUpperCase())}</strong></span>
              <strong>${Number(r.category_wins||0)}</strong>
              <strong class="mol-added-points">+${Number(m.added_points||0)}</strong>
            </div>`;
          }).join('')}
        </div>
      </section>
      <button type="button" class="mol-result-primary" id="molPostgameContinue">WEITER →</button>
    </main>
  </section>`;
}
function jokerMarkup(reveal){
  const j=reveal?.joker||{},o=reveal?.owner||{},r=reveal?.result||{};
  const before=r.before_text??(r.before!=null?String(r.before)+(r.unit?' '+r.unit:''):'—');
  const after=r.after_text??(r.after!=null?String(r.after)+(r.unit?' '+r.unit:''):(r.text||'—'));
  return `<section class="mol-full-app mol-result-page">
    ${header()}
    <main class="mol-result-main">
      <section class="mol-result-status"><strong>JOKER AUFLÖSUNG</strong></section>
      <section class="mol-joker-card" style="--mol-joker-owner:${esc(o.color||colorOf({identity_color:o.color_key}))}">
        <small>${esc(String(j.category||'SECRET').toUpperCase())} JOKER</small>
        <h2>${esc(j.title||j.type||'JOKER')}</h2>
        <p>${esc(j.description||'Der Joker wurde auf das finale Ergebnis angewendet.')}</p>
        <div class="mol-joker-owner"><i></i><span><small>JOKER GESETZT VON</small><strong>${esc(o.display_name||'TEILNEHMER')}</strong></span></div>
        <div class="mol-joker-value"><span>${esc(before)}</span><b>→</b><strong>${esc(after)}</strong></div>
      </section>
      <button type="button" class="mol-result-primary" id="molPostgameContinue">WEITER ZUM TURNIERSTAND →</button>
    </main>
  </section>`;
}
function mergeMarkup(){
  const pg=canonicalPostgame(),rows=[...(pg?.rows||[])].sort((a,b)=>Number(a.old_rank||999)-Number(b.old_rank||999));
  return `<section class="mol-full-app mol-result-page">
    ${header()}
    <main class="mol-result-main">
      <section class="mol-result-status"><strong>TURNIERSTAND</strong></section>
      <section class="mol-result-card mol-merge-card is-game" data-mol-merge-card>
        <header><strong>GAME → TURNIER</strong><span>NACH MEHR ODER WENIGER</span></header>
        <div class="mol-result-columns mol-merge-columns"><span>POSITION</span><span>NAME</span><span>PUNKTE</span><span>+ GAME</span></div>
        <div class="mol-result-rows mol-merge-rows">
          ${rows.map((r,i)=>`<div class="mol-result-row mol-merge-row" data-mol-merge-row data-new-rank="${Number(r.new_rank||i+1)}" data-old-rank="${Number(r.old_rank||i+1)}" style="--mol-player:${colorOf({identity_color:r.identity_color})}">
            <b><span class="mol-rank-value">${Number(r.old_rank||i+1)}.</span><small class="mol-rank-move"></small></b>
            <span><i style="--mol-player:${colorOf({identity_color:r.identity_color})}"></i><strong>${esc(String(r.display_name||'TEILNEHMER').toUpperCase())}</strong></span>
            <strong class="mol-merge-points"><span class="mol-base-points">${Number(r.old_points||0)}</span><em>+</em><span class="mol-award-points">${Number(r.added_points||0)}</span><b class="mol-total-points">${Number(r.new_points||0)}</b></strong>
            <strong class="mol-added-points">+${Number(r.added_points||0)}</strong>
          </div>`).join('')}
        </div>
      </section>
      <button type="button" class="mol-result-primary" id="molCloseGame" hidden disabled>SPIEL SCHLIESSEN →</button>
    </main>
  </section>`;
}
function animateMerge(){
  clearPostgameTimers();const run=++postgameRun,host=root?.querySelector('.mol-merge-rows');if(!host)return;
  const rows=[...host.querySelectorAll('[data-mol-merge-row]')],card=root?.querySelector('[data-mol-merge-card]');
  postgameBusy=true;
  postgameLater(()=>{if(run!==postgameRun)return;window.skielsenInApp?.launchConfetti?.(root?.querySelector('.mol-merge-card'))},350);
  postgameLater(()=>{if(run!==postgameRun)return;card?.classList.add('is-merging')},900);
  postgameLater(()=>{if(run!==postgameRun)return;card?.classList.add('is-total')},2500);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    card?.classList.remove('is-game');card?.classList.add('is-tournament');
    const before=new Map(rows.map(r=>[r,r.getBoundingClientRect().top]));
    rows.sort((a,b)=>Number(a.dataset.newRank)-Number(b.dataset.newRank)).forEach(r=>host.appendChild(r));
    rows.forEach(r=>{const dy=before.get(r)-r.getBoundingClientRect().top;r.style.transition='none';r.style.transform=`translateY(${dy}px)`});
    void host.offsetHeight;
    rows.forEach(r=>{r.style.transition='transform 1520ms cubic-bezier(.2,.85,.2,1)';r.style.transform='translateY(0)'});
  },4100);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    rows.forEach(r=>{
      const oldRank=Number(r.dataset.oldRank||0),newRank=Number(r.dataset.newRank||oldRank),rv=r.querySelector('.mol-rank-value'),mv=r.querySelector('.mol-rank-move');
      if(rv){rv.textContent=newRank+'.';rv.classList.add('is-updating')}
      if(mv){const delta=oldRank-newRank;mv.textContent=movementText(delta);mv.className='mol-rank-move '+(delta>0?'up':delta<0?'down':'same')+' visible'}
    });
  },5340);
  postgameLater(()=>{
    if(run!==postgameRun)return;
    const close=root?.querySelector('#molCloseGame');if(close){close.hidden=false;close.disabled=false}
    postgameBusy=false;postgamePhase='MERGE_COMPLETE';
  },6100);
}
function renderPostgame(){
  postgameRendered=true;
  window.skielsenInApp?.markConcluded?.();
  const reveal=canonicalPostgame()?.joker_reveal||state?.result?.tournament_handoff?.joker_reveal||null;
  if(postgamePhase==='JOKER'&&jokerRevealAllowed(reveal))root.innerHTML=jokerMarkup(reveal);
  else if(postgamePhase==='MERGE'||postgamePhase==='MERGE_COMPLETE')root.innerHTML=mergeMarkup();
  else root.innerHTML=rankingMarkup();
  bindChrome();
  root.querySelector('#molPostgameContinue')?.addEventListener('click',()=>{
    if(postgameBusy)return;
    if(postgamePhase==='RANKING'&&jokerRevealAllowed(reveal)){postgamePhase='JOKER';renderPostgame();return}
    postgamePhase='MERGE';renderPostgame();animateMerge();
  });
  root.querySelector('#molCloseGame')?.addEventListener('click',()=>{
    if(postgameBusy||postgamePhase!=='MERGE_COMPLETE')return;
    const btn=root.querySelector('#molCloseGame');if(btn){btn.disabled=true;btn.textContent='WIRD GESCHLOSSEN …'}
    const ok=window.skielsenBuzzerBridge?.completeCanonicalInAppPostgame?.(session?.tournament_game_id);
    if(!ok)window.skielsenInApp?.completeAndExit?.();
  });
  if(postgamePhase==='MERGE')animateMerge();
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
  if(state.phase==='QUESTION'&&!questionPayloadReady()){
    clearTimeout(feedbackTimer);feedbackKey='';
    root.innerHTML=`<section class="mol-full-app">${header()}<main class="mol-full-content"><div class="mol-full-wait">NÄCHSTER VERGLEICH WIRD GELADEN…</div></main></section>`;
    bindChrome();scheduleRecoveryPoll();return;
  }
  if(state.phase==='QUESTION'&&Number(state.category_no||1)!==animatedCategoryNo){
    if(!categoryAnimating)void animateCategoryPick();
    return;
  }
  if(categoryAnimating)return;

  if(state.phase==='REVEAL'){
    clearTimeout(botTimer);botTimer=0;
    const lr=state?.last_result||{};
    const key=[state.category_no,lr.answer_member_id,lr.current_label,lr.current_display_value,lr.ok].join('|');
    if(feedbackKey===key&&root.querySelector('.mol-full-compare.is-feedback')){
      bindChrome();
      const existingCard=root.querySelector('.mol-full-compare.is-feedback');
      if(existingCard?.classList.contains('is-resolved')&&!feedbackTimer)scheduleRevealContinue(key,300);
      return;
    }
    feedbackKey=key;clearTimeout(feedbackTimer);
    root.innerHTML=revealMarkup();
    bindChrome();
    const countEl=document.getElementById('molFullCount');
    const finalValue=countEl?.dataset.final||'—';
    const target=countEl?.dataset.target;
    animateRevealCount(countEl,finalValue,target,1000).then(()=>{
      if(feedbackKey!==key)return;
      const circle=document.getElementById('molFullCenterCircle');
      const card=document.getElementById('molFullCompare');
      if(circle){
        circle.textContent=lr.ok?'✓':'✕';
        circle.setAttribute('aria-label',lr.ok?'Richtig':'Falsch');
      }
      card?.classList.add('is-resolved');
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(feedbackKey!==key)return;
        card?.classList.add('is-promoting');
        const mine=state?.viewer?.member_id===lr.answer_member_id;
        const revealActor=playerByMemberId(lr.answer_member_id)||playerById(lr.participant_id)||{};
        const botReveal=!!(revealActor?.is_bot||state?.current_player?.is_bot);
        const viewerKey=String(state?.viewer?.member_id||state?.viewer?.participant_id||'viewer');
        const jitter=[...viewerKey].reduce((n,ch)=>(n+ch.charCodeAt(0))%401,0);
        const delay=mine?480:((botReveal||isAdmin())?900:2200+jitter);
        scheduleRevealContinue(key,delay);
      }));
    });
    return;
  }

  feedbackKey='';clearTimeout(feedbackTimer);
  if(state.phase==='COMPLETE'||state.status==='FINISHED'){
    clearTimeout(recoveryTimer);recoveryTimer=0;renderPostgame();return;
  }
  root.innerHTML=questionMarkup();bindChrome();
  root.querySelectorAll('[data-mol-choice]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.molChoice)));
  scheduleBotTurn();
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
    state=r.data;clearTimeout(recoveryTimer);recoveryTimer=0;
    if((state.phase==='COMPLETE'||state.status==='FINISHED')&&state.result&&!resultIngested){
      resultIngested=!!window.skielsenV15?.ingestInAppGameResult?.(session.tournament_game_id,state.result);
    }
    if(!(state.phase==='COMPLETE'||state.status==='FINISHED')||!postgameRendered)render();
  }finally{busy=false}
}
function mount(nextRoot,nextSession,nextDb){
  if(!nextRoot||!nextSession?.session_id||!nextDb)return false;
  if(session?.session_id!==nextSession.session_id){state=null;resultIngested=false;pendingTier='NORMAL';tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;animationToken++;feedbackKey='';clearTimeout(feedbackTimer);clearTimeout(recoveryTimer);recoveryTimer=0;clearTimeout(botTimer);botTimer=0;botTurnKey='';postgamePhase='RANKING';postgameBusy=false;postgameRendered=false;postgameRendered=false;clearPostgameTimers();postgameRun++}
  root=nextRoot;session=nextSession;db=nextDb;
  const existingTier=selectedTier();if(existingTier)pendingTier=existingTier;
  clearInterval(pollTimer);
  // Paint the game shell immediately. Waiting for the first RPC before rendering
  // leaves the outer "WIRD GELADEN" placeholder stuck when mobile/network timing
  // delays the state request.
  render();
  if(existingTier)void poll();
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
  clearInterval(pollTimer);pollTimer=0;clearTimeout(botTimer);botTimer=0;botTurnKey='';animationToken++;clearTimeout(feedbackTimer);feedbackKey='';clearTimeout(recoveryTimer);recoveryTimer=0;clearPostgameTimers();postgameRun++;root=null;session=null;db=null;state=null;busy=false;resultIngested=false;tierBusy=false;animatedCategoryNo=0;categoryAnimating=false;postgamePhase='RANKING';postgameBusy=false;
}
window.skielsenMoreLess={mount,updateSession,unmount,poll,setTier,get resultOpen(){return !!root&&(state?.phase==='COMPLETE'||state?.status==='FINISHED')}};
})();
