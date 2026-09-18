(()=>{
'use strict';

const POLL_MS=650;
const COLORS={BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'};
let root=null,session=null,db=null,state=null,pollTimer=0,busy=false,resultIngested=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playerById=id=>(state?.players||[]).find(p=>p.participant_id===id)||null;
const colorOf=p=>COLORS[String(p?.identity_color||'').toUpperCase()]||'#7c5cff';
const tierLabel=t=>String(t||'NORMAL').toUpperCase();
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
function header(){
  return `<header class="mol-full-header"><div><img src="assets/images/skielsen-logo.png" alt="SKIELSEN"><span>MEHR ODER WENIGER</span></div><div class="mol-full-meta"><b>${esc(tierLabel(state?.tier))}</b><span>KATEGORIE ${Number(state?.category_no||1)} / ${Number(state?.category_count||5)}</span></div></header>`;
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
  if(!root||!state)return;
  root.closest('#v15InAppLayer')?.classList.remove('buzzer-mode');
  if(state.phase==='COMPLETE'||state.status==='FINISHED')root.innerHTML=completeMarkup();
  else if(state.phase==='REVEAL')root.innerHTML=revealMarkup();
  else root.innerHTML=questionMarkup();
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
  if(session?.session_id!==nextSession.session_id){state=null;resultIngested=false}
  root=nextRoot;session=nextSession;db=nextDb;
  clearInterval(pollTimer);
  poll();
  pollTimer=setInterval(poll,POLL_MS);
  return true;
}
function updateSession(nextSession){
  if(nextSession?.session_id===session?.session_id)session=nextSession;
}
function unmount(){
  clearInterval(pollTimer);pollTimer=0;root=null;session=null;db=null;state=null;busy=false;resultIngested=false;
}
window.skielsenMoreLess={mount,updateSession,unmount,poll};
})();
