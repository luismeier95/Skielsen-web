(()=>{
'use strict';
const VERSION=window.SKIELSEN_VERSION||'15.1.17';
const GAME_ID='game.buzzer_time_stop';
const RESULT_RPC='get_buzzer_time_game_result';
const COLORS={BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'};
let db=null,engine=null,installed=false,detailIndex=null,jokerBridgeBound=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const feature=(rt,id)=>!!(rt?.features||[]).find(f=>f.feature_id===id&&f.enabled);
const fmtMs=ms=>ms==null||!Number.isFinite(Number(ms))?'—':(Number(ms)/1000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' s';
const marker=color=>({BLUE:'team-blue',RED:'team-red',YELLOW:'team-yellow',GREEN:'team-green'}[String(color||'').toUpperCase()]||'team-neutral');
const participant=(st,id)=>(st?.participants||[]).find(p=>p.id===id)||null;
const teamName=(st,id)=>participant(st,id)?.name||'TEILNEHMER';
const currentGame=(st)=>(st?.games||[])[Number(st?.currentGameIndex)||0]||null;
const isBuzzer=g=>!!g&&(g.game_id===GAME_ID||/BUZZER\s+ZEIT\s+STOPPEN/i.test(String(g.name||'')));
const scoreFor=(rt,place)=>Number(rt?.scoring?.placements?.[String(place)]??({1:10,2:5,3:3,4:0}[place]||0));

async function persistLocalState(){
  const st=engine?.state,rt=engine?.runtime;if(!db||!st||!rt?.test_mode)return;
  try{await db.rpc('save_tournament_test_runtime_state',{p_tournament_id:rt.tournament_id,p_state:st,p_state_version:15})}catch(err){console.warn('Buzzer local state save',err)}
}
function addAudit(st,text){st.audit=Array.isArray(st.audit)?st.audit:[];st.audit.unshift({at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),text});st.audit=st.audit.slice(0,100)}
function addNews(st,headline,body){st.news=Array.isArray(st.news)?st.news:[];st.news.unshift({id:'bzt-'+Date.now()+Math.random(),headline,body,type:'MATCH_REPORT',at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})});st.news=st.news.slice(0,80)}
function settleLocalBets(st,m,winnerId){
  if(!m)return;for(const b of st.bets?.[m.id]||[]){if(b.status!=='PLACED')continue;if(b.participantId===winnerId){b.status='WON';b.payout=Math.ceil(Number(b.stake||0)*Number(b.acceptedOdds||0));st.wallets[b.actorId]=(st.wallets[b.actorId]||0)+b.payout;st.transactions.push({id:'tx-pay-'+b.id,type:'PAYOUT',actorId:b.actorId,amount:b.payout,betId:b.id,at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),reason:m.id})}else{b.status='LOST';b.payout=0}}
}
function commitLocalPoints(st,rt,g,placements){
  if(g.resultsCommitted)return;
  placements.forEach((pid,ix)=>{const r=st.rankings?.[pid];if(!r)return;const place=ix+1;let pts=scoreFor(rt,place);if(feature(rt,'feature.joker')&&g.joker?.accepted?.type==='DOUBLE_POINTS'&&g.joker.accepted.participantId===pid)pts*=2;r.points=Number(r.points||0)+pts;if(place===1)r.first=Number(r.first||0)+1;else if(place===2)r.second=Number(r.second||0)+1;else if(place===3)r.third=Number(r.third||0)+1;else if(place===4)r.last=Number(r.last||0)+1});
  g.resultsCommitted=true;
}
function initializeVoteOrAdvance(g){
  const st=engine?.state,rt=engine?.runtime;if(!st||!rt||!g)return;
  if(feature(rt,'feature.mvp_voting')){g.phase='VOTING_MVP';g.vote={type:'MVP',votes:{},winnerActorId:null,finalized:false};engine.render();engine.show('home');persistLocalState();return}
  if(feature(rt,'feature.lvp_voting')){g.phase='VOTING_LVP';g.vote={type:'LVP',votes:{},winnerActorId:null,finalized:false};engine.render();engine.show('home');persistLocalState();return}
  g.phase='COMPLETED';g.vote=null;
  if(st.currentGameIndex<(st.games||[]).length-1){st.currentGameIndex++;const n=currentGame(st);if(n&&!['ACTIVE','PREPARING'].includes(n.phase))n.phase='PLANNED';engine.render();persistLocalState().finally(()=>engine.prepareCurrentGame?.())}else{st.tournamentDone=true;engine.render();persistLocalState()}
  engine.show('home');
}
function revealValue(result,which){const t=result?.[which+'_text'];if(t)return t;const v=result?.[which];if(v==null)return result?.text||'—';return `${v}${result?.unit?' '+result.unit:''}`}
function resetBridgeJokerUi(){
  const d=document.getElementById('v1530JokerRevealDialog');if(!d)return;
  document.getElementById('v1530JokerTapOverlay')?.classList.remove('hidden');
  document.querySelectorAll('#v1530JokerRevealDialog .v1530-reveal-line').forEach(x=>x.classList.remove('in'));
  document.getElementById('v1530JokerRule')?.classList.remove('in');document.getElementById('v1530JokerTeamReveal')?.classList.remove('in');document.getElementById('v1530JokerResult')?.classList.remove('in');document.getElementById('v1530JokerResultMorph')?.classList.remove('morph');document.getElementById('v1530JokerCaption')?.classList.remove('show');
  const card=document.getElementById('v1530JokerCard3d');if(card)card.style.transform='rotateY(0deg)';const c=document.getElementById('v1530JokerRevealContinue');if(c)c.hidden=true;
}
function bindBridgeJokerControls(){
  if(jokerBridgeBound)return;jokerBridgeBound=true;
  document.addEventListener('click',e=>{
    const start=e.target.closest('#v1530JokerRevealStart');if(start&&start.dataset.bztBridge==='1'){
      e.preventDefault();e.stopImmediatePropagation();document.getElementById('v1530JokerTapOverlay')?.classList.add('hidden');const card=document.getElementById('v1530JokerCard3d');if(card){card.style.transition='transform .9s cubic-bezier(.18,.8,.18,1)';card.style.transform='rotateY(180deg)'}setTimeout(()=>{document.querySelectorAll('#v1530JokerRevealDialog .v1530-reveal-line').forEach(x=>x.classList.add('in'));document.getElementById('v1530JokerRule')?.classList.add('in');document.getElementById('v1530JokerTeamReveal')?.classList.add('in');document.getElementById('v1530JokerResult')?.classList.add('in');document.getElementById('v1530JokerResultMorph')?.classList.add('morph');document.getElementById('v1530JokerCaption')?.classList.add('show');const c=document.getElementById('v1530JokerRevealContinue');if(c)c.hidden=false},900);return;
    }
    const cont=e.target.closest('#v1530JokerRevealContinue');if(cont&&cont.dataset.bztBridge==='1'){
      e.preventDefault();e.stopImmediatePropagation();const d=document.getElementById('v1530JokerRevealDialog');if(d)d.hidden=true;delete cont.dataset.bztBridge;delete document.getElementById('v1530JokerRevealStart')?.dataset.bztBridge;const g=currentGame(engine?.state);if(g?.joker){g.joker.revealAcknowledged=true;g.joker.revealed=true}initializeVoteOrAdvance(g);return;
    }
  },true);
}
async function showBridgeJokerReveal(g){
  const rt=engine?.runtime;if(!feature(rt,'feature.joker')||!g?.joker?.accepted||g.joker.accepted.type==='PICK_OPPONENT'||g.joker.revealAcknowledged)return false;
  const d=document.getElementById('v1530JokerRevealDialog');if(!d||!db)return false;
  try{
    const {data,error}=await db.rpc('get_tournament_game_joker_reveal',{p_tournament_game_id:g.tournament_game_id});if(error||!data?.available||!data?.reveal)return false;
    const p=data.reveal,j=p.joker||{},o=p.owner||{},r=p.result||{};resetBridgeJokerUi();bindBridgeJokerControls();
    d.style.setProperty('--v1530-team',o.color||COLORS[o.color_key]||'#7c5cff');
    const set=(id,text)=>{const x=document.getElementById(id);if(x)x.textContent=text??''};
    set('v1530JokerRevealGame',g.name||'BUZZER ZEIT STOPPEN');set('v1530JokerCategory',(j.category||'SECRET')+' JOKER');set('v1530JokerTitle',j.title||g.joker.accepted.type);set('v1530JokerDescription',j.description||'');set('v1530JokerTeam',o.display_name||teamName(engine.state,g.joker.accepted.participantId));set('v1530JokerTeamCaption','JOKER GESETZT VON');set('v1530JokerResultLabel',r.label||'ERGEBNIS');set('v1530JokerResultInitial',revealValue(r,'before'));set('v1530JokerResultFinal',revealValue(r,'after'));set('v1530JokerCaptionTitle',`${o.display_name||'TEAM'} · ${j.title||''}`);set('v1530JokerCaptionText',p.resolution?.success===false?'Der Joker wurde angewendet, brachte aber keinen zusätzlichen Vorteil.':'Der Joker wurde auf die endgültige Game-Wertung angewendet.');
    const start=document.getElementById('v1530JokerRevealStart'),cont=document.getElementById('v1530JokerRevealContinue');if(start)start.dataset.bztBridge='1';if(cont)cont.dataset.bztBridge='1';g.joker.revealed=true;g.joker.revealAcknowledged=false;d.hidden=false;engine.render();persistLocalState();return true;
  }catch(err){console.warn('Buzzer Joker reveal bridge',err);return false}
}
async function continuePostGame(g){if(await showBridgeJokerReveal(g))return;initializeVoteOrAdvance(g)}

function ingestHigherLowerResult(tournamentGameId,result){
  const st=engine?.state,rt=engine?.runtime;if(!st||!rt||!Array.isArray(result?.standings))return false;
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);if(gi<0)return false;
  const g=st.games[gi],rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
  const placements=rows.map(r=>r.participant_id),valid=new Set((st.participants||[]).map(p=>p.id));
  if(placements.length!==(st.participants||[]).length||new Set(placements).size!==placements.length||placements.some(id=>!valid.has(id)))return false;
  if(g.inAppResult?.finalized_at===result.finalized_at&&g.resultsCommitted)return true;
  g.inAppResult=result;g.placements=[...placements];g.phase='RESULTS';
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];
  if(m){m.participantIds=Array.isArray(m.participantIds)&&m.participantIds.length?m.participantIds:[...placements];m.placements=[...placements];m.values=Object.fromEntries(rows.map(r=>[r.participant_id,Number(r.category_wins||0)]));m.status='CONCLUDED'}
  if(!g.resultsCommitted){
    if(m)settleLocalBets(st,m,placements[0]);
    commitLocalPoints(st,rt,g,placements);
    st.matchHistory=Array.isArray(st.matchHistory)?st.matchHistory:[];
    st.matchHistory.unshift({gameIndex:gi,game:g.name,stage:m?.stage||'MULTI_PARTICIPANT',participantIds:[...placements],placements:[...placements],values:m?.values?{...m.values}:null,winner:placements[0],at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),source:'IN_APP_MORE_LESS'});
    addAudit(st,'IN-APP RESULT · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(st,pid)}`).join(' / '));
    addNews(st,`${teamName(st,placements[0])} GEWINNT ${String(g.name||'MEHR ODER WENIGER').toUpperCase()}.`,rows.map(r=>`${Number(r.placement)}. ${teamName(st,r.participant_id)} · ${Number(r.category_wins||0)} KATEGORIE-SIEGE`).join(' · '));
  }
  engine.render();persistLocalState();
  if(gi===Number(st.currentGameIndex||0)){
    window.skielsenInApp?.finishAndExit?.();
    if(typeof engine.beginPostGameFlow==='function')engine.beginPostGameFlow(g,m,placements[0]);else continuePostGame(g);
  }
  return true;
}

function ingestInAppGameResult(tournamentGameId,result){
  if(result?.game_key==='higher_lower')return ingestHigherLowerResult(tournamentGameId,result);
  const st=engine?.state,rt=engine?.runtime;if(!st||!rt||!result||result.game_key!=='buzzer_time_stoppen'||!Array.isArray(result.standings))return false;
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);if(gi<0)return false;const g=st.games[gi],rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)),placements=rows.map(r=>r.participant_id),valid=new Set((st.participants||[]).map(p=>p.id));
  if(placements.length!==(st.participants||[]).length||new Set(placements).size!==placements.length||placements.some(id=>!valid.has(id)))return false;
  if(g.inAppResult?.finalized_at===result.finalized_at&&g.resultsCommitted)return true;
  g.inAppResult=result;g.placements=[...placements];g.phase='RESULTS';const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];if(m){m.participantIds=Array.isArray(m.participantIds)&&m.participantIds.length?m.participantIds:[...placements];m.placements=[...placements];m.values=Object.fromEntries(rows.map(r=>[r.participant_id,Number(r.total_deviation_ms||0)]));m.status='CONCLUDED'}
  if(!g.resultsCommitted){if(m)settleLocalBets(st,m,placements[0]);commitLocalPoints(st,rt,g,placements);st.matchHistory=Array.isArray(st.matchHistory)?st.matchHistory:[];st.matchHistory.unshift({gameIndex:gi,game:g.name,stage:m?.stage||'MULTI_PARTICIPANT',participantIds:[...placements],placements:[...placements],values:m?.values?{...m.values}:null,winner:placements[0],at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),source:'IN_APP_BUZZER'});addAudit(st,'IN-APP RESULT · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(st,pid)}`).join(' / '));addNews(st,`${teamName(st,placements[0])} GEWINNT ${String(g.name||'BUZZER').toUpperCase()}.`,rows.map(r=>`${Number(r.placement)}. ${teamName(st,r.participant_id)} · ${fmtMs(r.total_deviation_ms)}`).join(' · '))}
  engine.render();persistLocalState();if(gi===Number(st.currentGameIndex||0)){window.skielsenInApp?.finishAndExit?.();if(typeof engine.beginPostGameFlow==='function')engine.beginPostGameFlow(g,m,placements[0]);else continuePostGame(g)}return true;
}

function resultMarkup(payload){
  const st=engine?.state,result=payload?.result||payload||{},standings=Array.isArray(result.standings)?result.standings:[],history=Array.isArray(result.history)?result.history:[],points=Object.fromEntries((payload?.placements||[]).map(x=>[x.participant_id,x]));if(!standings.length&&!history.length)return '<div class="v15-buzzer-empty">NOCH KEIN ABGESCHLOSSENES BUZZER-ERGEBNIS.</div>';
  const finalRows=[...standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)).map((r,i)=>{const p=participant(st,r.participant_id),pt=points[r.participant_id],name=r.team_name||p?.name||'TEILNEHMER',color=r.identity_color||p?.color;return `<tr><td><i class="${marker(color)}"></i><b>${Number(r.placement||i+1)}.</b> ${esc(name)}</td><td>${fmtMs(r.total_deviation_ms)}</td><td>${pt?Number(pt.final_points):'—'}</td></tr>`}).join('');
  const rounds=history.map(h=>`<section class="v15-buzzer-round"><header><div><small>RUNDE ${Number(h.round||0)}</small><strong>ZIEL ${Number(h.target_seconds||0)} SEKUNDEN</strong></div></header><div class="v15-buzzer-table-scroll"><table><thead><tr><th>TEAM</th><th>ZEIT 1</th><th>ZEIT 2</th><th>GESAMT</th><th>ABW.</th></tr></thead><tbody>${(h.rows||[]).map(r=>{const p=participant(st,r.participant_id),name=r.team_name||p?.name||'TEILNEHMER',color=r.identity_color||p?.color;return `<tr><td><i class="${marker(color)}"></i>${esc(name)}</td><td>${fmtMs(r.split1_ms)}</td><td>${r.split2_ms==null?'—':fmtMs(r.split2_ms)}</td><td>${fmtMs(r.total_ms)}</td><td>${fmtMs(r.deviation_ms)}</td></tr>`}).join('')}</tbody></table></div></section>`).join('');
  return `<section class="v15-buzzer-history"><div class="v15-buzzer-history-head"><div><small>BUZZER ZEIT STOPPEN</small><h3>ERGEBNIS & RUNDENVERLAUF</h3></div><span>5 RUNDEN · NIEDRIGSTE ABWEICHUNG GEWINNT</span></div><section class="v15-buzzer-final"><header><strong>ENDPLATZIERUNG</strong><small>TIEBREAK: BESTE EINZELRUNDEN · DANACH LOS</small></header><div class="v15-buzzer-table-scroll"><table><thead><tr><th>TEAM</th><th>GESAMTABWEICHUNG</th><th>PUNKTE</th></tr></thead><tbody>${finalRows}</tbody></table></div></section>${rounds}</section>`;
}
async function enhanceDetails(index){
  const st=engine?.state,g=st?.games?.[index],panel=document.getElementById('v15GameInfo');if(!panel||!isBuzzer(g))return;let host=panel.querySelector('[data-v15-buzzer-result]');if(!host){host=document.createElement('div');host.dataset.v15BuzzerResult='1';host.innerHTML='<div class="v15-buzzer-empty">ERGEBNIS WIRD GELADEN …</div>';panel.appendChild(host)}if(g.inAppResult)host.innerHTML=resultMarkup(g.inAppResult);if(!db||!g.tournament_game_id)return;
  try{const {data,error}=await db.rpc(RESULT_RPC,{p_tournament_game_id:g.tournament_game_id});if(error)throw error;if(data){g.inAppResult=data.result||g.inAppResult;host.innerHTML=resultMarkup(data)}else if(!g.inAppResult)host.innerHTML='<div class="v15-buzzer-empty">NOCH KEIN ABGESCHLOSSENES BUZZER-ERGEBNIS.</div>'}catch(err){console.warn('Buzzer result details',err);if(!g.inAppResult)host.innerHTML='<div class="v15-buzzer-empty">BUZZER-ERGEBNIS KONNTE NICHT GELADEN WERDEN.</div>'}
}
function bindDetails(){
  document.addEventListener('click',e=>{const c=e.target.closest('[data-v15-game-card]');if(!c)return;detailIndex=Number(c.dataset.v15GameCard);setTimeout(()=>enhanceDetails(detailIndex),0)},true);
}
function attach(){
  engine=window.skielsenV15||engine;db=window.skielsenDb?.client||db;if(!engine||!db)return false;
  if(!engine.ingestInAppGameResult)engine.ingestInAppGameResult=ingestInAppGameResult;
  if(!installed){installed=true;bindDetails();bindBridgeJokerControls()}
  return true;
}
let tries=0;const boot=setInterval(()=>{tries++;if(attach()||tries>80)clearInterval(boot)},250);
window.skielsenBuzzerBridge={version:VERSION,attach,ingestInAppGameResult,enhanceDetails};
})();