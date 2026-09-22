(()=>{
'use strict';
const VERSION=window.SKIELSEN_VERSION||'15.1.129';
const GAME_ID='game.buzzer_time_stop';
const RESULT_RPC='get_buzzer_time_game_result';
const COLORS={BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'};
let db=null,engine=null,installed=false,detailIndex=null,jokerBridgeBound=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const feature=(rt,id)=>!!(rt?.features||[]).find(f=>f.feature_id===id&&f.enabled);
const voteFeature=(rt,type)=>String(rt?.mode||'').toUpperCase()==='TEAM'&&feature(rt,String(type||'').toUpperCase()==='LVP'?'feature.lvp_voting':'feature.mvp_voting');
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
  if(!feature(engine?.runtime,'feature.betting')||!m)return;for(const b of st.bets?.[m.id]||[]){if(b.status!=='PLACED')continue;if(b.participantId===winnerId){b.status='WON';b.payout=Math.ceil(Number(b.stake||0)*Number(b.acceptedOdds||0));st.wallets[b.actorId]=(st.wallets[b.actorId]||0)+b.payout;st.transactions.push({id:'tx-pay-'+b.id,type:'PAYOUT',actorId:b.actorId,amount:b.payout,betId:b.id,at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),reason:m.id})}else{b.status='LOST';b.payout=0}}
}
function commitLocalPoints(st,rt,g,placements){
  if(g.resultsCommitted)return;
  placements.forEach((pid,ix)=>{const r=st.rankings?.[pid];if(!r)return;const place=ix+1;let pts=scoreFor(rt,place);if(feature(rt,'feature.joker')&&g.joker?.accepted?.type==='DOUBLE_POINTS'&&g.joker.accepted.participantId===pid)pts*=2;r.points=Number(r.points||0)+pts;if(place===1)r.first=Number(r.first||0)+1;else if(place===2)r.second=Number(r.second||0)+1;else if(place===3)r.third=Number(r.third||0)+1;else if(place===4)r.last=Number(r.last||0)+1});
  g.resultsCommitted=true;
}
function canonicalRankingSnapshot(st){
  return (st?.participants||[]).map(p=>{
    const r=st.rankings?.[p.id]||{};
    return {
      participant_id:p.id,display_name:p.name||'TEILNEHMER',identity_color:p.color||null,
      points:Number(r.points||0),first:Number(r.first||0),second:Number(r.second||0),
      third:Number(r.third||0),last:Number(r.last||0)
    };
  }).sort((a,b)=>b.points-a.points||b.first-a.first||String(a.display_name).localeCompare(String(b.display_name),'de'))
    .map((r,i)=>({...r,rank:i+1}));
}
function canonicalGamePoints(rt,placements,reveal){
  const out={};
  (placements||[]).forEach((pid,ix)=>out[pid]=scoreFor(rt,ix+1));
  const owner=reveal?.owner?.participant_id;
  const final=Number(reveal?.result?.after);
  if(owner&&Number.isFinite(final))out[owner]=final;
  return out;
}
function captureCanonicalPostgame(st,rt,g,before,result,placements){
  if(!st||!g||!Array.isArray(placements)||!placements.length)return null;
  const reveal=result?.tournament_handoff?.joker_reveal||null;
  const beforeRows=Array.isArray(before)&&before.length?before:canonicalRankingSnapshot(st);
  const beforeBy=new Map(beforeRows.map(r=>[r.participant_id,r]));
  const points=canonicalGamePoints(rt,placements,reveal);
  placements.forEach((pid,ix)=>{
    const r=st.rankings?.[pid],old=beforeBy.get(pid);
    if(!r||!old)return;
    r.points=Number(old.points||0)+Number(points[pid]||0);
  });
  const after=canonicalRankingSnapshot(st),afterBy=new Map(after.map(r=>[r.participant_id,r]));
  const rows=(st.participants||[]).map(p=>{
    const old=beforeBy.get(p.id)||{},now=afterBy.get(p.id)||{},place=placements.indexOf(p.id)+1;
    return {
      participant_id:p.id,display_name:p.name||now.display_name||old.display_name||'TEILNEHMER',identity_color:p.color||now.identity_color||old.identity_color||null,
      game_placement:place>0?place:null,old_points:Number(old.points||0),added_points:Number(points[p.id]||0),new_points:Number(now.points||0),
      old_rank:Number(old.rank||0),new_rank:Number(now.rank||0),movement:Number(old.rank||0)-Number(now.rank||0),
      first:Number(now.first||0),second:Number(now.second||0),third:Number(now.third||0),last:Number(now.last||0)
    };
  });
  const payload={
    phase:'MERGE',tournament_game_id:g.tournament_game_id||null,game_id:g.game_id||null,
    game_name:g.name||null,joker_reveal:reveal,rows,result:result||g.inAppResult||null
  };
  g.inAppCanonicalPostgame=payload;
  return payload;
}
function reconstructCanonicalPostgame(st,rt,g,result){
  if(g?.inAppCanonicalPostgame)return g.inAppCanonicalPostgame;
  if(!st||!g)return null;
  const standings=Array.isArray(result?.standings)?[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)):[];
  const placements=Array.isArray(g.placements)&&g.placements.length?[...g.placements]:standings.map(r=>r.participant_id);
  if(!placements.length)return null;
  const reveal=result?.tournament_handoff?.joker_reveal||null,points=canonicalGamePoints(rt,placements,reveal);
  const after=canonicalRankingSnapshot(st),afterBy=new Map(after.map(r=>[r.participant_id,r]));
  const pseudoBefore=(st.participants||[]).map(p=>{
    const now=afterBy.get(p.id)||{},place=placements.indexOf(p.id)+1;
    return {
      participant_id:p.id,display_name:p.name||now.display_name||'TEILNEHMER',identity_color:p.color||now.identity_color||null,
      points:Number(now.points||0)-Number(points[p.id]||0),
      first:Number(now.first||0)-(place===1?1:0),second:Number(now.second||0)-(place===2?1:0),
      third:Number(now.third||0)-(place===3?1:0),last:Number(now.last||0)-(place===4?1:0)
    };
  }).sort((a,b)=>b.points-a.points||b.first-a.first||String(a.display_name).localeCompare(String(b.display_name),'de'))
    .map((r,i)=>({...r,rank:i+1}));
  const beforeBy=new Map(pseudoBefore.map(r=>[r.participant_id,r]));
  const rows=(st.participants||[]).map(p=>{
    const old=beforeBy.get(p.id)||{},now=afterBy.get(p.id)||{},place=placements.indexOf(p.id)+1;
    return {
      participant_id:p.id,display_name:p.name||now.display_name||'TEILNEHMER',identity_color:p.color||now.identity_color||null,
      game_placement:place>0?place:null,old_points:Number(old.points||0),added_points:Number(points[p.id]||0),new_points:Number(now.points||0),
      old_rank:Number(old.rank||0),new_rank:Number(now.rank||0),movement:Number(old.rank||0)-Number(now.rank||0),
      first:Number(now.first||0),second:Number(now.second||0),third:Number(now.third||0),last:Number(now.last||0)
    };
  });
  return g.inAppCanonicalPostgame={phase:'MERGE',tournament_game_id:g.tournament_game_id||null,game_id:g.game_id||null,game_name:g.name||null,joker_reveal:reveal,rows,result:result||g.inAppResult||null};
}
function getCanonicalPostgame(tournamentGameId,result=null){
  const st=engine?.state,rt=engine?.runtime;if(!st)return null;
  const g=(st.games||[]).find(x=>x.tournament_game_id===tournamentGameId)||currentGame(st);
  return reconstructCanonicalPostgame(st,rt,g,result||g?.inAppResult||null);
}
function completeCanonicalInAppPostgame(tournamentGameId){
  const st=engine?.state;if(!st)return false;
  const g=(st.games||[]).find(x=>x.tournament_game_id===tournamentGameId)||currentGame(st);if(!g)return false;
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0],winnerId=Array.isArray(g.placements)?g.placements[0]:null;
  g.awaitingInAppResultClose=false;
  if(g.joker){g.joker.revealed=true;g.joker.revealAcknowledged=true;g.joker.resolved=true;g.joker.locked=true}
  persistLocalState();window.skielsenInApp?.finishAndExit?.();
  if(typeof engine.beginCanonicalMergedPostGameFlow==='function'){engine.beginCanonicalMergedPostGameFlow(g,m,winnerId);return true}
  if(typeof engine.startPostGameVote==='function'){engine.startPostGameVote(g);return true}
  return false;
}
function initializeVoteOrAdvance(g){
  const st=engine?.state,rt=engine?.runtime;if(!st||!rt||!g)return;
  if(voteFeature(rt,'MVP')){g.phase='VOTING_MVP';g.vote={type:'MVP',votes:{},winnerActorId:null,finalized:false};engine.render();engine.show('home');persistLocalState();return}
  if(voteFeature(rt,'LVP')){g.phase='VOTING_LVP';g.vote={type:'LVP',votes:{},winnerActorId:null,finalized:false};engine.render();engine.show('home');persistLocalState();return}
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
    d.style.setProperty('--v1530-team',COLORS[o.color_key]||o.color||'var(--theme-accent)');
    const set=(id,text)=>{const x=document.getElementById(id);if(x)x.textContent=text??''};
    set('v1530JokerRevealGame',g.name||'BUZZER ZEIT STOPPEN');set('v1530JokerCategory',(j.category||'SECRET')+' JOKER');set('v1530JokerTitle',j.title||g.joker.accepted.type);set('v1530JokerDescription',j.description||'');set('v1530JokerTeam',o.display_name||teamName(engine.state,g.joker.accepted.participantId));set('v1530JokerTeamCaption','JOKER GESETZT VON');set('v1530JokerResultLabel',r.label||'ERGEBNIS');set('v1530JokerResultInitial',revealValue(r,'before'));set('v1530JokerResultFinal',revealValue(r,'after'));set('v1530JokerCaptionTitle',`${o.display_name||'TEAM'} · ${j.title||''}`);set('v1530JokerCaptionText',p.resolution?.success===false?'Der Joker wurde angewendet, brachte aber keinen zusätzlichen Vorteil.':'Der Joker wurde auf die endgültige Game-Wertung angewendet.');
    const start=document.getElementById('v1530JokerRevealStart'),cont=document.getElementById('v1530JokerRevealContinue');if(start)start.dataset.bztBridge='1';if(cont)cont.dataset.bztBridge='1';g.joker.revealed=true;g.joker.revealAcknowledged=false;d.hidden=false;engine.render();persistLocalState();return true;
  }catch(err){console.warn('Buzzer Joker reveal bridge',err);return false}
}
async function continuePostGame(g){if(await showBridgeJokerReveal(g))return;initializeVoteOrAdvance(g)}

function ingestHigherLowerResult(tournamentGameId,result){
  const canonicalBefore=canonicalRankingSnapshot(engine?.state);
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
  captureCanonicalPostgame(st,rt,g,canonicalBefore,result,placements);
  g.awaitingInAppResultClose=true;
  engine.render();persistLocalState();
  return true;
}

function ingestWordChainResult(tournamentGameId,result){
  const canonicalBefore=canonicalRankingSnapshot(engine?.state);
  const st=engine?.state,rt=engine?.runtime;
  if(!st||!rt||!Array.isArray(result?.standings))return false;
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);if(gi<0)return false;
  const g=st.games[gi],rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
  const placements=rows.map(r=>r.participant_id),valid=new Set((st.participants||[]).map(p=>p.id));
  if(placements.length!==(st.participants||[]).length||new Set(placements).size!==placements.length||placements.some(id=>!valid.has(id)))return false;
  if(g.inAppResult?.finalized_at===result.finalized_at&&g.resultsCommitted)return true;
  g.inAppResult=result;g.placements=[...placements];g.phase='RESULTS';
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];
  if(m){
    m.participantIds=Array.isArray(m.participantIds)&&m.participantIds.length?m.participantIds:[...placements];
    m.placements=[...placements];
    m.values=Object.fromEntries(rows.map(r=>[r.participant_id,Number(r.score||0)]));
    m.status='CONCLUDED';
  }
  if(!g.resultsCommitted){
    if(m)settleLocalBets(st,m,placements[0]);
    commitLocalPoints(st,rt,g,placements);
    st.matchHistory=Array.isArray(st.matchHistory)?st.matchHistory:[];
    st.matchHistory.unshift({gameIndex:gi,game:g.name,stage:m?.stage||'MULTI_PARTICIPANT',participantIds:[...placements],placements:[...placements],values:m?.values?{...m.values}:null,winner:placements[0],at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),source:'IN_APP_WORD_CHAIN'});
    addAudit(st,'IN-APP RESULT · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(st,pid)}`).join(' / '));
    addNews(st,`${teamName(st,placements[0])} GEWINNT ${String(g.name||'WORTKETTE').toUpperCase()}.`,rows.map(r=>`${Number(r.placement)}. ${teamName(st,r.participant_id)} · ${Number(r.minus_points??Math.abs(Math.min(Number(r.score||0),0)))} MINUSPUNKTE`).join(' · '));
  }
  captureCanonicalPostgame(st,rt,g,canonicalBefore,result,placements);
  g.awaitingInAppResultClose=true;
  engine.render();persistLocalState();
  return true;
}

function ingestReactionResult(tournamentGameId,result){
  const st=engine?.state,rt=engine?.runtime;
  if(!st||!rt||!result||result.game_key!=='reaction'||!Array.isArray(result.standings))return false;
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);if(gi<0)return false;
  const g=st.games[gi],rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
  const placements=rows.map(r=>r.participant_id),valid=new Set((st.participants||[]).map(p=>p.id));
  if(placements.length!==(st.participants||[]).length||new Set(placements).size!==placements.length||placements.some(id=>!valid.has(id)))return false;
  if(g.inAppResult?.finalized_at===result.finalized_at&&g.resultsCommitted)return true;
  g.inAppResult=result;g.placements=[...placements];g.phase='RESULTS';
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];
  if(m){
    m.participantIds=Array.isArray(m.participantIds)&&m.participantIds.length?m.participantIds:[...placements];
    m.placements=[...placements];
    m.values=Object.fromEntries(rows.map(r=>[r.participant_id,r.aggregate_ms==null?null:Number(r.aggregate_ms)]));
    m.status='CONCLUDED';
  }
  if(!g.resultsCommitted){
    if(m)settleLocalBets(st,m,placements[0]);
    commitLocalPoints(st,rt,g,placements);
    st.matchHistory=Array.isArray(st.matchHistory)?st.matchHistory:[];
    st.matchHistory.unshift({gameIndex:gi,game:g.name,stage:m?.stage||'MULTI_PARTICIPANT',participantIds:[...placements],placements:[...placements],values:m?.values?{...m.values}:null,winner:placements[0],at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),source:'IN_APP_REACTION'});
    addAudit(st,'IN-APP RESULT · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(st,pid)}`).join(' / '));
    addNews(st,`${teamName(st,placements[0])} GEWINNT ${String(g.name||'REACTION').toUpperCase()}.`,rows.map(r=>`${Number(r.placement)}. ${teamName(st,r.participant_id)} · ${r.aggregate_ms==null?'DNF':fmtMs(r.aggregate_ms)}`).join(' · '));
  }
  g.awaitingInAppResultClose=true;
  engine.render();persistLocalState();
  return true;
}

function completePendingInAppGame(){
  const st=engine?.state;if(!st)return false;
  const gi=Number(st.currentGameIndex||0),g=st.games?.[gi];if(!g?.awaitingInAppResultClose)return false;
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0],winnerId=Array.isArray(g.placements)?g.placements[0]:null;
  g.awaitingInAppResultClose=false;persistLocalState();
  window.skielsenInApp?.finishAndExit?.();
  if(typeof engine.beginPostGameFlow==='function'){engine.beginPostGameFlow(g,m,winnerId);return true}
  void continuePostGame(g);return true;
}

function completeReactionPostgame(mergePayload=null,jokerReveal=null){
  const st=engine?.state;if(!st)return false;
  const gi=Number(st.currentGameIndex||0),g=st.games?.[gi];
  if(!g||!(g.game_id==='game.reaction.tap'||/^REACTION$/i.test(String(g.name||''))))return false;
  const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];
  const winnerId=Array.isArray(g.placements)?g.placements[0]:null;
  g.awaitingInAppResultClose=false;
  const rows=Array.isArray(mergePayload?.rows)?mergePayload.rows:[];
  rows.forEach(row=>{
    const r=st.rankings?.[row.participant_id];if(!r)return;
    if(Number.isFinite(Number(row.new_points)))r.points=Number(row.new_points);
    if(Number.isFinite(Number(row.first)))r.first=Number(row.first);
    if(Number.isFinite(Number(row.second)))r.second=Number(row.second);
    if(Number.isFinite(Number(row.third)))r.third=Number(row.third);
    if(Number.isFinite(Number(row.last)))r.last=Number(row.last);
  });
  if(rows.length)g.resultsCommitted=true;
  if(jokerReveal?.joker?.type&&jokerReveal?.owner?.participant_id){
    g.joker=g.joker||{};
    g.joker.accepted=g.joker.accepted||{participantId:jokerReveal.owner.participant_id,type:jokerReveal.joker.type,status:'ACCEPTED',isBot:false};
  }
  if(g.joker){g.joker.revealed=true;g.joker.revealAcknowledged=true;g.joker.resolved=true;g.joker.locked=true}
  persistLocalState();
  window.skielsenInApp?.finishAndExit?.();
  if(typeof engine.beginCanonicalMergedPostGameFlow==='function'){
    engine.beginCanonicalMergedPostGameFlow(g,m,winnerId);
    return true;
  }
  if(typeof engine.startPostGameVote==='function'){
    engine.startPostGameVote(g);
    return true;
  }
  return false;
}

function ingestTicTacToeResult(tournamentGameId,result){
  const st=engine?.state,rt=engine?.runtime;
  if(!st||!rt||!result||result.game_key!=='tic_tac_toe'||!Array.isArray(result.standings))return false;
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);
  if(gi<0)return false;
  const g=st.games[gi],m=(g.matches||[])[g.matchIndex||0];
  if(!m||!m.a||!m.b)return false;
  const rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999));
  if(rows.length!==2)return false;
  const ids=new Set(rows.map(r=>r.participant_id));
  if(!ids.has(m.a)||!ids.has(m.b))return false;
  const resultKey=String(result._session_id||result.finalized_at||result.completed_at||result.tournament_handoff?.completed_at||'')+'|'+String(m.id||g.matchIndex||0);
  g.ticTacToeHandledResults=g.ticTacToeHandledResults||{};
  if(resultKey&&g.ticTacToeHandledResults[resultKey])return true;
  const winnerId=rows[0]?.participant_id;
  if(winnerId!==m.a&&winnerId!==m.b)return false;
  if(typeof engine.concludeCurrentMatch!=='function')return false;
  const finalized=!!result?.tournament_handoff?.finalized;
  const canonicalBefore=finalized?canonicalRankingSnapshot(st):null;
  const ok=winnerId===m.a
    ?engine.concludeCurrentMatch(1,0,{deferCanonicalPostgame:finalized})
    :engine.concludeCurrentMatch(0,1,{deferCanonicalPostgame:finalized});
  if(ok){
    if(resultKey)g.ticTacToeHandledResults[resultKey]=true;
    g.inAppMatchResult=result;
    if(finalized){
      const finalPlacements=[...(result?.tournament_handoff?.placements||[])]
        .sort((a,b)=>Number(a.placement||999)-Number(b.placement||999))
        .map(x=>x.participant_id);
      if(finalPlacements.length){
        g.placements=[...finalPlacements];
        g.inAppResult=result;
        captureCanonicalPostgame(st,rt,g,canonicalBefore,result,finalPlacements);
        g.awaitingInAppResultClose=true;
      }
    }
    persistLocalState();
  }
  return !!ok;
}

function ingestInAppGameResult(tournamentGameId,result){
  if(result?.game_key==='higher_lower')return ingestHigherLowerResult(tournamentGameId,result);
  if(result?.game_key==='word_chain')return ingestWordChainResult(tournamentGameId,result);
  if(result?.game_key==='tic_tac_toe')return ingestTicTacToeResult(tournamentGameId,result);
  if(result?.game_key==='reaction')return ingestReactionResult(tournamentGameId,result);
  const st=engine?.state,rt=engine?.runtime;if(!st||!rt||!result||result.game_key!=='buzzer_time_stoppen'||!Array.isArray(result.standings))return false;
  const canonicalBefore=canonicalRankingSnapshot(st);
  const gi=(st.games||[]).findIndex(g=>g.tournament_game_id===tournamentGameId);if(gi<0)return false;const g=st.games[gi],rows=[...result.standings].sort((a,b)=>Number(a.placement||999)-Number(b.placement||999)),placements=rows.map(r=>r.participant_id),valid=new Set((st.participants||[]).map(p=>p.id));
  if(placements.length!==(st.participants||[]).length||new Set(placements).size!==placements.length||placements.some(id=>!valid.has(id)))return false;
  if(g.inAppResult?.finalized_at===result.finalized_at&&g.resultsCommitted)return true;
  g.inAppResult=result;g.placements=[...placements];g.phase='RESULTS';const m=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];if(m){m.participantIds=Array.isArray(m.participantIds)&&m.participantIds.length?m.participantIds:[...placements];m.placements=[...placements];m.values=Object.fromEntries(rows.map(r=>[r.participant_id,Number(r.total_deviation_ms||0)]));m.status='CONCLUDED'}
  if(!g.resultsCommitted){if(m)settleLocalBets(st,m,placements[0]);commitLocalPoints(st,rt,g,placements);st.matchHistory=Array.isArray(st.matchHistory)?st.matchHistory:[];st.matchHistory.unshift({gameIndex:gi,game:g.name,stage:m?.stage||'MULTI_PARTICIPANT',participantIds:[...placements],placements:[...placements],values:m?.values?{...m.values}:null,winner:placements[0],at:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),source:'IN_APP_BUZZER'});addAudit(st,'IN-APP RESULT · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(st,pid)}`).join(' / '));addNews(st,`${teamName(st,placements[0])} GEWINNT ${String(g.name||'BUZZER').toUpperCase()}.`,rows.map(r=>`${Number(r.placement)}. ${teamName(st,r.participant_id)} · ${fmtMs(r.total_deviation_ms)}`).join(' · '))}
  captureCanonicalPostgame(st,rt,g,canonicalBefore,result,placements);g.awaitingInAppResultClose=true;engine.render();persistLocalState();return true;
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
window.skielsenBuzzerBridge={version:VERSION,attach,ingestInAppGameResult,completePendingInAppGame,completeCanonicalInAppPostgame,getCanonicalPostgame,completeReactionPostgame,enhanceDetails};
})();