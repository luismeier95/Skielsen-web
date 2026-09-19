(()=>{
'use strict';
const VERSION=window.SKIELSEN_VERSION||'15.1.30';
const PAGE_IDS={home:'homePage',profile:'profilePage',matches:'matchesPage',matchDetail:'matchDetailPage',games:'gamesPage',ranking:'rankingPage',bets:'betsPage',news:'newsPage',mvpVote:'mvpVotePage',joker:'jokerPage',admin:'adminPage',gameControl:'gameControlPage'};
const TEAM_ORDER=['BLUE','RED','YELLOW','GREEN'];
const SOLO_ORDER=['RED','BLUE','YELLOW','GREEN'];
const COLOR_DE={BLUE:'BLAU',RED:'ROT',YELLOW:'GELB',GREEN:'GRÜN'};
const COLOR_CLASS={BLUE:'team-blue',RED:'team-red',YELLOW:'team-yellow',GREEN:'team-green'};
const SKILL_DEFAULTS=['skill.dexterity','skill.precision','skill.reaction','skill.strategy','skill.knowledge','skill.strength','skill.endurance','skill.luck'];
const SKILL_NAMES={'skill.dexterity':'GESCHICKLICHKEIT','skill.precision':'PRÄZISION','skill.reaction':'REAKTION','skill.strategy':'STRATEGIE','skill.knowledge':'WISSEN','skill.strength':'KRAFT','skill.endurance':'AUSDAUER','skill.luck':'GLÜCK'};
let runtime=null,state=null,client=null,bound=false,currentPage='home',selectedBetParticipant=null,selectedMvpCandidate=null,selectedJokerType=null,selectedJokerGameIndex=null,selectedJokerTarget=null,serverJokerBoard=null,jokerPollTimer=0,jokerBoardPollTimer=0,serverBettingState=null,bettingPollTimer=0,serverVoteState=null,votePollTimer=0,pendingPickDialogGameId=null,pendingPickDismissedFor=null,inlineResultMatchId=null,betReturnPage=null,quickBetParticipant=null,quickBetStake=500,flowToastTimer=0,selectedProfileActor=null,saveTimer=0,selectedMatchDetailId=null,gameControlContext=null,jokerDialogMode=null,jokerDialogMeta=null,jokerRevealTimers=[],jokerRevealAnimations=[],jokerRevealRunning=false,jokerRevealGameIndex=-1,jokerRevealConfig=null,jokerMultiDialogOpenedAt=0,matchResultContinuation=null,pendingUnifiedResult=null,awardRevealGameIndex=-1,awardRevealType=null;

function q(sel,root=document){return root.querySelector(sel)}
function qa(sel,root=document){return [...root.querySelectorAll(sel)]}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function fmt(n,d=0){return Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})}
function initials(s){return String(s||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function pickDet(list,seed){return list.length?list[hash(seed)%list.length]:null}
function nowLabel(){return new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}
function feature(id){return !!(runtime?.features||[]).find(f=>f.feature_id===id&&f.enabled)}
function scoringPoints(place){const p=runtime?.scoring?.placements||{'1':10,'2':5,'3':3,'4':0};return Number(p[String(place)]??({1:10,2:5,3:3,4:0}[place]||0))}
function syncBettingFeatureVisibility(){
 const enabled=feature('feature.betting');
 qa('[data-page="bets"]').forEach(el=>el.hidden=!enabled);
 const detailBet=q('#matchDetailPage .betting-block');if(detailBet)detailBet.hidden=!enabled;
 const controlGate=q('#prototypeControlBetGate');if(controlGate)controlGate.hidden=!enabled;
 const adminGate=q('#prototypeAdminBetGate');if(adminGate)adminGate.hidden=!enabled;
 let changed=false;if(!enabled&&state){for(const g of state.games||[]){for(const m of g.matches||[]){if(m.status==='BETTING_OPEN'){m.status='READY';changed=true}}}}if(changed)saveSoon();
}
function syncBettingLiveIndicator(){
 const open=!!(state&&feature('feature.betting')&&matchNow()?.status==='BETTING_OPEN');
 qa('.sk-header__nav [data-page="bets"]').forEach(link=>{let dot=q('.nav-betting-live-dot',link);if(!dot){dot=document.createElement('span');dot.className='nav-betting-live-dot';dot.setAttribute('aria-hidden','true');link.appendChild(dot)}dot.hidden=!open});
}
function syncProfileSubnavVisibility(page=currentPage){
 const visible=page==='profile';
 document.body.classList.toggle('profile-page-active',visible);
 qa('.mobile-profile-nav,#profilePage .profile-nav').forEach(nav=>{nav.hidden=!visible;nav.setAttribute('aria-hidden',visible?'false':'true')});
}

function syncJokerFeatureVisibility(){
 const enabled=feature('feature.joker');
 qa('[data-page="joker"]').forEach(el=>el.hidden=!enabled);
 const page=q('#jokerPage');if(page)page.dataset.featureEnabled=enabled?'true':'false';
 if(!enabled){
   selectedJokerType=null;selectedJokerGameIndex=null;selectedJokerTarget=null;serverJokerBoard=null;
   closeJokerDialog();closeJokerResolutionDialog();closeJokerRevealDialog(false);closeMultiJokerDialog();
 }
}

function jokerIncompatibilityReason(g,type){
 if(!g||!type)return '';
 if(type==='PICK_OPPONENT'){
   if(state.participants.length!==4)return 'NUR BEI 4 TEILNEHMERN';
   if(!isMatchBasedGame(g))return competitionMode(g).startsWith('FREE_FOR_ALL')?'FREE4ALL':'KEIN DIREKTES MATCHUP';
 }
 return '';
}
function jokerRevealPolicy(type){return type==='PICK_OPPONENT'?'ACTION':'SECRET'}
function isSecretJokerType(type){return !!type&&jokerRevealPolicy(type)==='SECRET'}
function isJokerHistoryGame(g){return !!g&&(Array.isArray(g.placements)&&g.placements.length>0||['RESULTS','VOTING_MVP','VOTING_LVP','AWARD_REVEAL','COMPLETED'].includes(g.phase))}
function jokerIsPubliclyRevealed(g){const a=g?.joker?.accepted;if(!a)return false;return jokerRevealPolicy(a.type)==='ACTION'||!!g.joker?.revealed||isJokerHistoryGame(g)}
function jokerPublicMeta(g,viewerPid=state?.userParticipantId){
 const a=g?.joker?.accepted;if(!a)return '';
 if(jokerIsPubliclyRevealed(g))return `${teamName(participant(a.participantId))} · ${jokerTypeLabel(a.type)}`;
 if(a.participantId===viewerPid)return `DEIN JOKER: ${jokerTypeLabel(a.type)} · GEHEIM`;
 return 'GEHEIMER JOKER AKTIV';
}
function jokerHistoryMarkup(g){
 const accepted=g?.joker?.accepted;if(!accepted)return '';
 const owner=participant(accepted.participantId),ownerName=teamName(owner),type=jokerTypeLabel(accepted.type);
 let detail='';
 if(accepted.type==='PICK_OPPONENT')detail=accepted.targetParticipantId?`WAHL: ${teamName(participant(accepted.targetParticipantId))}`:'';
 else if(accepted.type==='DOUBLE_POINTS'){
   const place=(g.placements||[]).indexOf(accepted.participantId)+1;
   if(place>0)detail=`ERGEBNIS: ${place===1?'GEWONNEN':'VERLOREN'}`;
 }
 return `<div class="v1521-joker-history"><strong>${esc(ownerName)} · ${esc(type)}</strong>${detail?`<span>${esc(detail)}</span>`:''}</div>`;
}
function setText(sel,text,root=document){const e=q(sel,root);if(e)e.textContent=text}
function setHoldLabel(btn,label,disabled){if(!btn)return;btn.disabled=!!disabled;const x=q('.mandatory-hold-copy strong',btn);if(x)x.textContent=label;else btn.textContent=label}
function teamName(p){return p?.name||'TBD'}
function marker(color){return COLOR_CLASS[color]||'team-neutral'}
function stageLabel(stage){return ({FREE_FOR_ALL:'FREE4ALL',MULTI_PARTICIPANT:'ALLE TEILNEHMER',SEMIFINAL_1:'HALBFINALE 1',SEMIFINAL_2:'HALBFINALE 2',THIRD_PLACE:'SPIEL UM PLATZ 3',FINAL:'FINALE',ROUND_ROBIN_1:'ROUND ROBIN 1',ROUND_ROBIN_2:'ROUND ROBIN 2',ROUND_ROBIN_3:'ROUND ROBIN 3'}[stage]||stage||'MATCH')}
function statusLabel(st){return ({BETTING_OPEN:'BETTING OPEN',LIVE:'LIVE',CONCLUDED:'FINAL',SCHEDULED:'GEPLANT',READY:'BEREIT',VOID:'VOID'}[st]||st||'—')}
function gameNow(){return state?.games?.[state.currentGameIndex]||null}
function matchNow(){const g=gameNow();return g?.matches?.[g.matchIndex||0]||null}
function matchContextById(matchId){
 if(!matchId)return null;
 for(let gi=0;gi<(state?.games||[]).length;gi++){const g=state.games[gi],mi=(g.matches||[]).findIndex(m=>m.id===matchId);if(mi>=0)return {g,m:g.matches[mi],gi,mi}}
 return null
}
function gameControlSelection(){
 if(gameControlContext?.matchId){const found=matchContextById(gameControlContext.matchId);if(found){const currentG=gameNow(),currentM=matchNow();return {...found,isCurrent:found.g===currentG&&found.m?.id===currentM?.id}}gameControlContext=null}
 const g=gameNow(),m=matchNow();return {g,m,gi:state?.currentGameIndex||0,mi:g?.matchIndex||0,isCurrent:!!g&&!!m}
}
function openGameControlForMatch(m,returnPage='matchDetail'){
 const found=matchContextById(m?.id);if(!found)return false;
 gameControlContext={matchId:found.m.id,tournamentGameId:found.g.tournament_game_id||null,returnPage};
 openMatchDetail(found.m);return true
}
function returnFromGameControl(){
 const ctx=gameControlContext,target=ctx?.returnPage||'matchDetail',matchId=ctx?.matchId;gameControlContext=null;
 if(target==='matchDetail'&&matchId){const found=matchContextById(matchId);if(found){openMatchDetail(found.m);return}}
 show(PAGE_IDS[target]?target:'home')
}
function participant(id){return state?.participants?.find(p=>p.id===id)||null}
function actor(id){return state?.actors?.find(a=>a.id===id)||null}
function userActor(){return actor(state?.userActorId)}
function userParticipant(){return participant(state?.userParticipantId)}
function actorParticipant(a){return participant(a?.participantId)}
function activeActorIds(){return (state?.actors||[]).map(a=>a.id)}
function realActorIds(){return (state?.actors||[]).filter(a=>!a.isBot).map(a=>a.id)}
function currentMatchSequence(g=gameNow(),m=matchNow()){if(!g||!m)return 1;const ix=(g.matches||[]).indexOf(m);return ix>=0?ix+1:Number(g.matchIndex||0)+1}
function serverBettingApplies(){return !!(client&&runtime?.tournament_id&&gameNow()?.tournament_game_id&&feature('feature.betting'))}
function serverVoteApplies(g=gameNow()){return !!(client&&runtime?.tournament_id&&g?.tournament_game_id)}
function isAdmin(){return !!runtime?.is_admin}
function currentWallet(){return Number(state?.wallets?.[state?.userActorId]||0)}
function addAudit(text){state.audit.unshift({at:nowLabel(),text});state.audit=state.audit.slice(0,100)}
function addNews(headline,body,type='MATCH_REPORT'){state.news.unshift({id:'n'+Date.now()+Math.random(),headline,body,type,at:nowLabel()});state.news=state.news.slice(0,80)}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveState,160)}
async function saveState(){if(!state||!runtime?.test_mode||!client)return;try{await client.rpc('save_tournament_test_runtime_state',{p_tournament_id:runtime.tournament_id,p_state:state,p_state_version:15})}catch(e){console.warn('V15 test state save',e)}}

function buildParticipants(rt){
 const members=(rt.members||[]).map(m=>({id:m.member_id,userId:m.user_id,name:m.display_name||'PLAYER',isBot:false,teamColor:m.team_color||null,soloColor:m.solo_color||null,skillProfile:null}));
 const bots=(rt.bots||[]).map(b=>({id:b.bot_id,userId:null,name:b.display_name||'BOT',isBot:true,teamColor:b.team_color||null,soloColor:b.solo_color||null,skillProfile:b.skill_profile||{}}));
 const actors=[...members,...bots],dbps=(rt.participants||[]).filter(p=>!p.status||p.status==='ACTIVE');
 let participants=[];
 if(String(rt.mode).toUpperCase()==='TEAM'){
   const rows=dbps.filter(p=>String(p.participant_type).toUpperCase()==='TEAM');
   const colors=(rows.length?rows.map(p=>p.identity_color):TEAM_ORDER.slice(0,Math.max(2,Math.min(4,Math.round(Number(rt.expected_active_players||8)/2))))).filter(Boolean).sort((a,b)=>TEAM_ORDER.indexOf(a)-TEAM_ORDER.indexOf(b));
   participants=colors.map(c=>{
     const pr=rows.find(x=>x.identity_color===c)||{},t=(rt.teams||[]).find(x=>x.team_id===pr.team_id)||(rt.teams||[]).find(x=>x.color===c)||{};
     const aa=actors.filter(a=>a.teamColor===c);
     return {id:pr.participant_id||t.participant_id||t.team_id||('team-'+c),teamId:pr.team_id||t.team_id||null,name:t.name||('TEAM '+COLOR_DE[c]),color:c,actorIds:aa.map(a=>a.id),seed:pr.seed??null};
   });
 }else{
   const rows=dbps.filter(p=>String(p.participant_type).toUpperCase()==='SOLO');
   if(rows.length){
     participants=rows.slice().sort((a,b)=>(SOLO_ORDER.indexOf(a.identity_color)-SOLO_ORDER.indexOf(b.identity_color))||(Number(a.seed||0)-Number(b.seed||0))).map(pr=>{
       const a=actors.find(x=>x.id===pr.solo_member_id)||actors.find(x=>x.soloColor===pr.identity_color);
       return {id:pr.participant_id,name:a?.name||('PLAYER '+COLOR_DE[pr.identity_color]),color:pr.identity_color,actorIds:a?[a.id]:[],seed:pr.seed??null,soloMemberId:pr.solo_member_id||null};
     });
   }else{
     const count=Math.max(2,Math.min(4,Number(rt.expected_active_players||actors.length||4)));
     participants=SOLO_ORDER.slice(0,count).map(c=>{const a=actors.find(x=>x.soloColor===c);return a?{id:'solo-'+a.id,name:a.name,color:c,actorIds:[a.id]}:null}).filter(Boolean);
   }
 }
 actors.forEach(a=>{const p=participants.find(p=>p.actorIds.includes(a.id));a.participantId=p?.id||null});
 const userA=members.find(m=>m.userId===rt.current_user_id)||members[0]||bots[0]||null;
 return {actors,participants,userActorId:userA?.id||null,userParticipantId:userA?.participantId||participants[0]?.id||null};
}

function buildRatings(rt,actors){
 const skills=(rt.skills?.length?rt.skills.map(x=>x.skill_id):SKILL_DEFAULTS);
 const commRows=rt.community_snapshots||[], sklRows=rt.skielsen_ratings||[];
 const out={};
 actors.forEach(a=>{
   out[a.id]={};
   skills.forEach((sid,ix)=>{
     const cr=!a.isBot?commRows.find(r=>r.member_id===a.id&&r.skill_id===sid):null;
     const sr=!a.isBot?sklRows.find(r=>r.member_id===a.id&&r.skill_id===sid):null;
     const botV=a.skillProfile?.[sid];
     const fallback=45+(hash(a.id+'|'+sid)%36);
     const community=clamp(Number(cr?.score??botV??fallback),0,100);
     const skielsen=clamp(Number(sr?.score??community),0,100);
     const confidence=clamp(Number(sr?.confidence??0),0,1);
     const evidence=confidence>0&&confidence<.999?Math.log(1-confidence)/Math.log(.90):0;
     out[a.id][sid]={community,skielsen,confidence,evidence};
   });
 });
 return out;
}

function competitionMode(g){return String(g?.competition_mode||'').toUpperCase()}
function isMatchBasedGame(g){return competitionMode(g)==='MATCH_BASED'}
function isFreeForAllGame(g){return competitionMode(g)==='FREE_FOR_ALL'}
function isSharedContestGame(g){return !!g&&!isMatchBasedGame(g)}
function isSharedContestMatch(m){return m?.stage==='FREE_FOR_ALL'||m?.stage==='MULTI_PARTICIPANT'}
function sharedContestStage(g){return competitionMode(g).startsWith('FREE_FOR_ALL')?'FREE_FOR_ALL':'MULTI_PARTICIPANT'}
function createScheduledMatches(g,gameIndex,participants){
 const ps=deterministicOrder(participants,g.game_id+'|'+g.sequence_no).map(p=>p.id);
 // Only MATCH_BASED games receive a bracket. Every other competition mode is one shared contest.
 if(isSharedContestGame(g)){
   return [{id:`g${gameIndex}-m0`,stage:sharedContestStage(g),participantIds:ps,status:'SCHEDULED',placements:null,values:null,scoreA:null,scoreB:null}];
 }
 if(ps.length===2)return [{id:`g${gameIndex}-m0`,stage:'FINAL',a:ps[0],b:ps[1],status:'SCHEDULED',scoreA:null,scoreB:null}];
 if(ps.length===3)return [
   {id:`g${gameIndex}-m0`,stage:'ROUND_ROBIN_1',a:ps[0],b:ps[1],status:'SCHEDULED',scoreA:null,scoreB:null},
   {id:`g${gameIndex}-m1`,stage:'ROUND_ROBIN_2',a:ps[1],b:ps[2],status:'SCHEDULED',scoreA:null,scoreB:null},
   {id:`g${gameIndex}-m2`,stage:'ROUND_ROBIN_3',a:ps[0],b:ps[2],status:'SCHEDULED',scoreA:null,scoreB:null},
   {id:`g${gameIndex}-m3`,stage:'FINAL',a:null,b:null,status:'SCHEDULED',scoreA:null,scoreB:null,placeholderA:'#1 ROUND ROBIN',placeholderB:'#2 ROUND ROBIN'}
 ];
 let a=ps[0],b=ps[1],c=ps[2],d=ps[3];
 const acc=g.joker?.accepted;
 if(acc?.type==='PICK_OPPONENT'&&acc.participantId&&acc.targetParticipantId){
   const rest=ps.filter(x=>x!==acc.participantId&&x!==acc.targetParticipantId);a=acc.participantId;b=acc.targetParticipantId;c=rest[0];d=rest[1];
 }
 return [
   {id:`g${gameIndex}-m0`,stage:'SEMIFINAL_1',a,b,status:'SCHEDULED',scoreA:null,scoreB:null},
   {id:`g${gameIndex}-m1`,stage:'SEMIFINAL_2',a:c,b:d,status:'SCHEDULED',scoreA:null,scoreB:null},
   {id:`g${gameIndex}-m2`,stage:'THIRD_PLACE',a:null,b:null,status:'SCHEDULED',scoreA:null,scoreB:null,placeholderA:'VERLIERER HF 1',placeholderB:'VERLIERER HF 2'},
   {id:`g${gameIndex}-m3`,stage:'FINAL',a:null,b:null,status:'SCHEDULED',scoreA:null,scoreB:null,placeholderA:'SIEGER HF 1',placeholderB:'SIEGER HF 2'}
 ];
}
function serverPhaseForGame(src,current='PLANNED'){
 const st=String(src?.status||'').toUpperCase();
 if(st==='ACTIVE')return 'ACTIVE';
 if(st==='PREPARING'||st==='JOKER_RESOLVED')return 'PREPARING';
 if(st==='COMPLETED')return 'COMPLETED';
 if(st==='PLANNED')return 'PLANNED';
 return current||'PLANNED';
}
function deriveCurrentGameIndexFromRuntime(rt, fallback=0){
 const rows=Array.isArray(rt?.games)?rt.games:[];
 if(!rows.length)return 0;
 const live=rows.findIndex(g=>['ACTIVE','PREPARING','JOKER_RESOLVED'].includes(String(g?.status||'').toUpperCase()));
 if(live>=0)return live;
 const planned=rows.findIndex(g=>String(g?.status||'').toUpperCase()==='PLANNED');
 if(planned>=0)return planned;
 return Math.max(0,Math.min(Number(fallback)||0,rows.length-1));
}
function syncGameMetadataFromRuntime(target,rt){
 const games=Array.isArray(target.games)?target.games:(target.games=[]),runtimeGames=Array.isArray(rt?.games)?rt.games:[];
 const current=games[target.currentGameIndex||0]||null;
 const applyMeta=(g,src)=>{['name','short_name','category','environment','competition_mode','default_play_mode','tracker_type','result_type','rules_text','rules_json','skill_profile','play_mode','format_template','status'].forEach(k=>{if(src?.[k]!==undefined)g[k]=src[k]});g.phase=serverPhaseForGame(src,g.phase)};
 runtimeGames.forEach((src,i)=>{
   let g=games.find(x=>x.tournament_game_id&&src.tournament_game_id&&x.tournament_game_id===src.tournament_game_id)||
         games.find(x=>x.game_id===src.game_id&&Number(x.sequence_no)===Number(src.sequence_no));
   if(!g){
     g={...src,phase:serverPhaseForGame(src,'PLANNED'),matchIndex:0,matches:[],placements:null,joker:{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false},vote:null};
     games.push(g);
   }
   applyMeta(g,src);
 });
 games.forEach((g,i)=>{
   const src=runtimeGames.find(x=>x.tournament_game_id&&g.tournament_game_id&&x.tournament_game_id===g.tournament_game_id)||
             runtimeGames.find(x=>x.game_id===g.game_id&&Number(x.sequence_no)===Number(g.sequence_no))||
             runtimeGames[i];
   if(src)applyMeta(g,src);
 });
 if(current){const ix=games.indexOf(current);if(ix>=0)target.currentGameIndex=ix}
}
function ensureTournamentSchedule(target,participants){
 (target.games||[]).forEach((g,i)=>{
   const matches=Array.isArray(g.matches)?g.matches:[];
   const hasConcluded=matches.some(m=>m.status==='CONCLUDED');
   const sharedValid=isSharedContestGame(g)&&matches.length===1&&isSharedContestMatch(matches[0])&&Array.isArray(matches[0].participantIds);
   const bracketValid=isMatchBasedGame(g)&&matches.length>0&&matches.every(m=>!isSharedContestMatch(m));
   // Repair old V15 states that incorrectly bracketed non-MATCH_BASED games, but never rewrite concluded history.
   if(!hasConcluded&&!(sharedValid||bracketValid)){
     g.matches=createScheduledMatches(g,i,participants);
     g.matchIndex=0;
   }
 });
}

function enforceGameLifecycleInvariant(target=state){
 const games=Array.isArray(target?.games)?target.games:[];
 const ci=Math.max(0,Math.min(Number(target?.currentGameIndex)||0,Math.max(0,games.length-1)));
 games.forEach((g,i)=>{
   g.joker=g.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};
   if(i<=ci)return;

   const matches=Array.isArray(g.matches)?g.matches:[];
   const hasStartedMatch=matches.some(m=>['LIVE','CONCLUDED'].includes(m.status));
   const hasFinalHistory=Array.isArray(g.placements)&&g.placements.length>0||
     ['RESULTS','VOTING_MVP','VOTING_LVP','AWARD_REVEAL','COMPLETED'].includes(g.phase);

   // Future games must stay joker-open until they themselves become current.
   // Repair stale PREPARING/ACTIVE states only when no match/history has actually started.
   if(!hasStartedMatch&&!hasFinalHistory&&['PREPARING','ACTIVE'].includes(g.phase)){
     g.phase='PLANNED';
     g.joker.locked=false;
     g.joker.awaitingPick=false;
     g.joker.resolved=false;
     matches.forEach(m=>{if(!['LIVE','CONCLUDED'].includes(m.status)){m.status='SCHEDULED';m.scoreA=null;m.scoreB=null}});
     g.matchIndex=0;
   }
 });
 return target;
}

function defaultState(rt){
 const core=buildParticipants(rt),skills=(rt.skills?.length?rt.skills.map(x=>x.skill_id):SKILL_DEFAULTS);
 const ratings=buildRatings(rt,core.actors);
 const wallets={},transactions=[];
 core.actors.forEach(a=>{wallets[a.id]=1000;transactions.push({id:'tx-'+a.id,type:'START_CREDIT',actorId:a.id,amount:1000,at:nowLabel(),reason:'STARTGUTHABEN'})});
 const rankings={};core.participants.forEach(p=>rankings[p.id]={points:0,first:0,second:0,third:0,last:0,mvp:0,lvp:0,bonus:0});
 const games=(rt.games||[]).map((g,i)=>({...g,phase:serverPhaseForGame(g,'PLANNED'),matchIndex:0,matches:[],placements:null,joker:{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false},vote:null}));
 games.forEach((g,i)=>{g.matches=createScheduledMatches(g,i,core.participants);if(g.phase==='ACTIVE'&&String(g.tracker_type||'').toUpperCase()==='IN_APP_NATIVE'&&g.matches?.[0])g.matches[0].status='LIVE'});
 const jokers={};core.participants.forEach(p=>jokers[p.id]={DOUBLE_POINTS:'AVAILABLE',PICK_OPPONENT:'AVAILABLE'});
 const s={version:15,createdAt:new Date().toISOString(),currentGameIndex:deriveCurrentGameIndexFromRuntime(rt,0),actors:core.actors,participants:core.participants,userActorId:core.userActorId,userParticipantId:core.userParticipantId,skills,ratings,wallets,transactions,rankings,games,bets:{},betDecisions:{},oddsSnapshots:{},jokers,jokerResolutionSeen:{},audit:[],news:[],matchHistory:[],awards:[],finalBonusApplied:false,tournamentDone:false,selectedProfileActorId:core.userActorId};
 s.audit.push({at:nowLabel(),text:'TURNIER-RUNTIME INITIALISIERT · '+core.actors.length+' PLAYER'});
 return s;
}


function remapParticipantReferences(target,idMap){
 const mapId=id=>idMap[id]||id;if(!Object.keys(idMap).length)return target;
 const remapObjKeys=obj=>Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[mapId(k),v]));
 target.rankings=remapObjKeys(target.rankings);target.jokers=remapObjKeys(target.jokers);
 (target.games||[]).forEach(g=>{g.placements=Array.isArray(g.placements)?g.placements.map(mapId):g.placements;if(g.joker?.accepted){g.joker.accepted.participantId=mapId(g.joker.accepted.participantId);g.joker.accepted.targetParticipantId=mapId(g.joker.accepted.targetParticipantId)}(g.joker?.submissions||[]).forEach(x=>{x.participantId=mapId(x.participantId);x.targetParticipantId=mapId(x.targetParticipantId)});(g.matches||[]).forEach(m=>{m.a=mapId(m.a);m.b=mapId(m.b);m.participantIds=Array.isArray(m.participantIds)?m.participantIds.map(mapId):m.participantIds;m.placements=Array.isArray(m.placements)?m.placements.map(mapId):m.placements;if(m.values)m.values=Object.fromEntries(Object.entries(m.values).map(([k,v])=>[mapId(k),v]))})});
 Object.values(target.bets||{}).flat().forEach(b=>b.participantId=mapId(b.participantId));
 Object.values(target.oddsSnapshots||{}).forEach(o=>{o.a=mapId(o.a);o.b=mapId(o.b);if(Array.isArray(o.selections))o.selections.forEach(x=>x.participantId=mapId(x.participantId))});
 (target.matchHistory||[]).forEach(h=>{h.a=mapId(h.a);h.b=mapId(h.b);h.winner=mapId(h.winner);h.participantIds=Array.isArray(h.participantIds)?h.participantIds.map(mapId):h.participantIds;h.placements=Array.isArray(h.placements)?h.placements.map(mapId):h.placements;if(h.values)h.values=Object.fromEntries(Object.entries(h.values).map(([k,v])=>[mapId(k),v]))});
 (target.awards||[]).forEach(a=>a.participantId=mapId(a.participantId));
 return target;
}

function normalizeLoadedState(loaded,rt){
 if(!loaded||loaded.version!==15)return defaultState(rt);
 const oldParticipants=Array.isArray(loaded.participants)?loaded.participants.map(p=>({...p})):[],core=buildParticipants(rt),idMap={};
 oldParticipants.forEach(op=>{const np=core.participants.find(p=>p.color===op.color)||(op.teamId?core.participants.find(p=>p.teamId===op.teamId):null);if(np&&op.id&&op.id!==np.id)idMap[op.id]=np.id});
 remapParticipantReferences(loaded,idMap);
 loaded.actors=core.actors;loaded.participants=core.participants;loaded.userActorId=core.userActorId;loaded.userParticipantId=core.userParticipantId;
 loaded.skills=loaded.skills||rt.skills?.map(x=>x.skill_id)||SKILL_DEFAULTS;
 loaded.rankings=loaded.rankings||{};core.participants.forEach(p=>loaded.rankings[p.id]=loaded.rankings[p.id]||{points:0,first:0,second:0,third:0,last:0,mvp:0,lvp:0,bonus:0});
 loaded.wallets=loaded.wallets||{};core.actors.forEach(a=>{if(loaded.wallets[a.id]==null)loaded.wallets[a.id]=1000});
 loaded.ratings=loaded.ratings||buildRatings(rt,core.actors);
 loaded.betDecisions=loaded.betDecisions||{};loaded.bets=loaded.bets||{};loaded.oddsSnapshots=loaded.oddsSnapshots||{};loaded.transactions=loaded.transactions||[];loaded.audit=loaded.audit||[];loaded.news=loaded.news||[];loaded.matchHistory=loaded.matchHistory||[];loaded.awards=loaded.awards||[];loaded.jokers=loaded.jokers||{};loaded.jokerResolutionSeen=loaded.jokerResolutionSeen||{};core.participants.forEach(p=>loaded.jokers[p.id]=loaded.jokers[p.id]||{DOUBLE_POINTS:'AVAILABLE',PICK_OPPONENT:'AVAILABLE'});
 syncGameMetadataFromRuntime(loaded,rt);
 loaded.currentGameIndex=deriveCurrentGameIndexFromRuntime(rt,loaded.currentGameIndex);
 (loaded.games||[]).forEach(g=>{g.joker=g.joker||{submissions:[],accepted:null,resolved:false};g.joker.submissions=Array.isArray(g.joker.submissions)?g.joker.submissions:[];g.joker.locked=!!g.joker.locked;g.joker.awaitingPick=!!g.joker.awaitingPick;if(g.phase==='UPCOMING'||g.phase==='JOKER_OPEN')g.phase='PLANNED';if(g.phase==='BRACKET_PENDING')g.phase='PREPARING';if(g.joker.accepted){if(g.joker.revealed==null)g.joker.revealed=jokerRevealPolicy(g.joker.accepted.type)==='ACTION'||isJokerHistoryGame(g);if(g.joker.revealAcknowledged==null)g.joker.revealAcknowledged=isJokerHistoryGame(g)}else{g.joker.revealed=false;g.joker.revealAcknowledged=true}if(g.resultsCommitted==null&&isJokerHistoryGame(g))g.resultsCommitted=true});
 ensureTournamentSchedule(loaded,core.participants);
 enforceGameLifecycleInvariant(loaded);
 return loaded;
}

function gameWeights(g){
 const raw=g?.skill_profile||{};let entries=Object.entries(raw).filter(([,v])=>Number(v)>0).map(([k,v])=>[k,Number(v)]);
 if(!entries.length)entries=(state.skills||SKILL_DEFAULTS).map(k=>[k,50]);
 return entries;
}
function effectiveActorSkill(actorId,sid){const r=state.ratings?.[actorId]?.[sid];if(!r)return 50;const w=Math.min(Number(r.confidence||0),.50);return Number(r.community)*(1-w)+Number(r.skielsen)*w}
function participantMetric(pid,sid){const p=participant(pid);if(!p?.actorIds?.length)return 50;return p.actorIds.reduce((a,id)=>a+effectiveActorSkill(id,sid),0)/p.actorIds.length}
function participantGameStrength(pid,g){const w=gameWeights(g),den=w.reduce((a,[,v])=>a+v,0)||1;return w.reduce((a,[sid,v])=>a+participantMetric(pid,sid)*v,0)/den}
function probability(a,b,g){const d=participantGameStrength(a,g)-participantGameStrength(b,g);return 1/(1+Math.exp(-d/12))}
function marketParticipantIds(m){return isSharedContestMatch(m)?[...(m.participantIds||[])]:[m?.a,m?.b].filter(Boolean)}
function snapshotSelections(snap){
 if(Array.isArray(snap?.selections)&&snap.selections.length)return snap.selections;
 if(snap?.a&&snap?.b)return [
  {participantId:snap.a,probability:Number(snap.pa),odds:Number(snap.oa),strength:Number(snap.strengthA)},
  {participantId:snap.b,probability:Number(snap.pb),odds:Number(snap.ob),strength:Number(snap.strengthB)}
 ];
 return [];
}
function selectionSnapshot(snap,pid){return snapshotSelections(snap).find(x=>x.participantId===pid)||null}
function snapshotMatchesMarket(snap,m){
 const expected=marketParticipantIds(m).map(String).sort();
 const actual=snapshotSelections(snap).map(x=>String(x.participantId)).sort();
 return expected.length>=2&&expected.length===actual.length&&expected.every((id,i)=>id===actual[i]);
}
function repairInvalidMarketSnapshot(m,snap){
 if(!m||!snap||m.status==='CONCLUDED')return false;
 const bets=state.bets?.[m.id]||[];
 let refunded=0;
 for(const b of bets){
  if(b.status!=='PLACED')continue;
  const stake=Number(b.stake||0);
  if(stake>0){
   state.wallets[b.actorId]=Number(state.wallets[b.actorId]||0)+stake;
   state.transactions.push({id:'tx-refund-'+b.id,type:'REFUND',actorId:b.actorId,amount:stake,betId:b.id,at:nowLabel(),reason:m.id+' · MARKET_MIGRATION'});
   refunded+=stake;
  }
 }
 state.bets[m.id]=[];
 state.betDecisions[m.id]={};
 delete state.oddsSnapshots[m.id];
 if(feature('feature.betting'))m.status='BETTING_OPEN';
 else if(m.status!=='LIVE')m.status='READY';
 selectedBetParticipant=null;
 addAudit('BETTING MARKET REPAIRED · '+stageLabel(m.stage)+' · '+marketParticipantIds(m).length+' PARTICIPANTS · '+fmt(refunded)+' COINS REFUNDED');
 return true;
}
function freezeOdds(m,g){
 if(!m)return null;
 const existing=state.oddsSnapshots[m.id];
 if(existing){
  if(snapshotMatchesMarket(existing,m))return existing;
  if(m.status==='CONCLUDED')return existing;
  repairInvalidMarketSnapshot(m,existing);
 }
 const ids=marketParticipantIds(m);if(ids.length<2)return null;
 const strengths=ids.map(id=>({participantId:id,strength:participantGameStrength(id,g)}));
 let probs=[];
 if(ids.length===2){
  const pa=clamp(probability(ids[0],ids[1],g),.03,.97);
  probs=[pa,1-pa];
 }else{
  // Multinomial logistic (softmax). For two participants this reduces to the same logistic model.
  const maxS=Math.max(...strengths.map(x=>x.strength));
  const exps=strengths.map(x=>Math.exp((x.strength-maxS)/12));
  const den=exps.reduce((a,b)=>a+b,0)||1;
  probs=exps.map(x=>x/den);
 }
 const selections=strengths.map((x,i)=>({participantId:x.participantId,strength:x.strength,probability:probs[i],odds:Math.round((1/probs[i])*100)/100}));
 const snap={marketType:ids.length>2?'MULTI_WINNER':'HEAD_TO_HEAD',selections,frozenAt:new Date().toISOString()};
 if(ids.length===2){Object.assign(snap,{a:ids[0],b:ids[1],pa:probs[0],pb:probs[1],oa:selections[0].odds,ob:selections[1].odds,strengthA:strengths[0].strength,strengthB:strengths[1].strength})}
 state.oddsSnapshots[m.id]=snap;return snap
}

function deterministicOrder(items,seed){const arr=[...items];for(let i=arr.length-1;i>0;i--){const j=hash(seed+'|'+i)%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function buildMatchesForGame(g){
 const ix=Math.max(0,state.games.indexOf(g));
 g.matches=createScheduledMatches(g,ix,state.participants);
 g.matchIndex=0;g.phase='ACTIVE';openCurrentMarket(g);
}
function applyServerBettingState(data,g=gameNow(),m=matchNow()){
 if(!data?.exists||!g||!m)return false;
 serverBettingState=data;
 const snap={marketType:(data.selections||[]).length>2?'MULTI_WINNER':'HEAD_TO_HEAD',selections:(data.selections||[]).map(x=>({participantId:x.participant_id,probability:Number(x.win_probability),odds:Number(x.displayed_odds),strength:selectionSnapshot(state.oddsSnapshots[m.id],x.participant_id)?.strength||0})),frozenAt:new Date().toISOString()};
 if(snap.selections.length===2){Object.assign(snap,{a:snap.selections[0].participantId,b:snap.selections[1].participantId,pa:snap.selections[0].probability,pb:snap.selections[1].probability,oa:snap.selections[0].odds,ob:snap.selections[1].odds})}
 if(snap.selections.length)state.oddsSnapshots[m.id]=snap;
 if(state.userActorId&&data.wallet_balance!=null)state.wallets[state.userActorId]=Number(data.wallet_balance);
 state.betDecisions[m.id]=state.betDecisions[m.id]||{};
 if(data.my_decision)state.betDecisions[m.id][state.userActorId]=data.my_decision;
 state.bets[m.id]=state.bets[m.id]||[];
 if(data.my_bet){
   const existing=(state.bets[m.id]||[]).find(b=>b.serverId===data.my_bet.bet_id||b.actorId===state.userActorId);
   const local={id:data.my_bet.bet_id,serverId:data.my_bet.bet_id,actorId:state.userActorId,participantId:data.my_bet.selected_participant_id,stake:Number(data.my_bet.stake),acceptedOdds:Number(data.my_bet.accepted_odds),status:data.my_bet.status,payout:Number(data.my_bet.payout||0),auto:false,at:nowLabel()};
   if(existing)Object.assign(existing,local);else state.bets[m.id].push(local);
 }
 if(data.status==='OPEN')m.status='BETTING_OPEN';
 if(data.all_decided||['LOCKED','SETTLED'].includes(data.status))m.status=m.status==='LIVE'||m.status==='CONCLUDED'?m.status:'READY';
 renderAll();return true
}
async function refreshServerBettingState(g=gameNow(),m=matchNow()){
 if(!serverBettingApplies()||!g||!m)return null;
 try{
   const {data,error}=await client.rpc('get_betting_market_state',{p_tournament_game_id:g.tournament_game_id,p_match_sequence_no:currentMatchSequence(g,m)});
   if(error)throw error;if(data?.exists)applyServerBettingState(data,g,m);return data||null
 }catch(e){console.warn('Betting state sync failed',e);return null}
}
function startBettingPolling(){
 if(bettingPollTimer||!serverBettingApplies())return;
 bettingPollTimer=setInterval(async()=>{const g=gameNow(),m=matchNow();if(!g||!m||!feature('feature.betting'))return;await refreshServerBettingState(g,m)},1400)
}
function stopBettingPolling(){if(bettingPollTimer){clearInterval(bettingPollTimer);bettingPollTimer=0}}
async function openServerBettingMarket(g,m){
 if(!serverBettingApplies()||!g||!m||!isAdmin())return refreshServerBettingState(g,m);
 const snap=freezeOdds(m,g),ids=marketParticipantIds(m);
 const selections=snapshotSelections(snap).map(x=>({participant_id:x.participantId,win_probability:Number(x.probability),raw_odds:Number(x.odds),displayed_odds:Number(x.odds)}));
 try{
   const {data,error}=await client.rpc('open_betting_market',{p_tournament_game_id:g.tournament_game_id,p_match_sequence_no:currentMatchSequence(g,m),p_stage:m.stage||'FINAL',p_participant_ids:ids,p_selections:selections});
   if(error)throw error;applyServerBettingState(data,g,m);startBettingPolling();return data
 }catch(e){console.warn('Open betting market failed',e);return null}
}
function openCurrentMarket(g){const m=g.matches[g.matchIndex||0];if(!m)return;const ids=marketParticipantIds(m);if(ids.length<2)return;m.status=feature('feature.betting')?'BETTING_OPEN':'READY';if(feature('feature.betting'))freezeOdds(m,g);state.betDecisions[m.id]=state.betDecisions[m.id]||{};state.bets[m.id]=state.bets[m.id]||[];if(feature('feature.betting')){autoResolveBotBets(m,g);void openServerBettingMarket(g,m);startBettingPolling()}addAudit((feature('feature.betting')?'BETTING MARKET OPENED · ':'MATCH BEREIT · ')+g.name+' · '+stageLabel(m.stage)+' · '+ids.length+' PARTICIPANTS')}
async function prepareCurrentGame(){const g=gameNow();if(!g)return;if(g.phase==='PLANNED'){await preparePlannedGame(g);return}if(g.phase==='PREPARING'&&g.joker?.awaitingPick){startJokerResolutionPolling(g);return}if(!g.matches?.length)g.matches=createScheduledMatches(g,state.currentGameIndex,state.participants);if(g.phase!=='ACTIVE'){g.phase='ACTIVE';openCurrentMarket(g)}}

function userBetDecision(){const m=matchNow();if(!m)return null;return serverBettingState?.market_id&&serverBettingState?.match_sequence_no===currentMatchSequence()?serverBettingState.my_decision||null:state.betDecisions?.[m.id]?.[state.userActorId]||null}
function gateComplete(m=matchNow()){if(!m)return false;if(!feature('feature.betting'))return true;if(serverBettingApplies()&&serverBettingState?.market_id&&serverBettingState?.match_sequence_no===currentMatchSequence(gameNow(),m))return !!serverBettingState.all_decided;const d=state.betDecisions[m.id]||{};return activeActorIds().every(id=>!!d[id])}
function bettingPendingCount(m=matchNow()){
 if(!m||!feature('feature.betting'))return 0;
 if(serverBettingApplies()&&serverBettingState?.market_id&&serverBettingState?.match_sequence_no===currentMatchSequence(gameNow(),m))return Math.max(0,Number(serverBettingState.required_count||0)-Number(serverBettingState.decided_count||0));
 const d=state.betDecisions[m.id]||{};return activeActorIds().filter(id=>!d[id]).length;
}

function syncBettingGateStatus(m=matchNow()){
 if(!m)return false;
 if(!feature('feature.betting')){if(m.status==='BETTING_OPEN')m.status='READY';return true}
 const complete=gateComplete(m);if(complete&&m.status==='BETTING_OPEN')m.status='READY';return complete;
}

async function placeBetFor(actorId,pid,stake,odds,auto=false){
 const g=gameNow(),m=matchNow();if(!m||m.status!=='BETTING_OPEN')return false;
 if(!auto&&actorId===state.userActorId&&serverBettingApplies()){
   if(!serverBettingState?.market_id)await refreshServerBettingState(g,m);
   if(!serverBettingState?.market_id)return false;
   try{
     const {data,error}=await client.rpc('submit_betting_decision',{p_market_id:serverBettingState.market_id,p_decision:'BET',p_selected_participant_id:pid,p_stake:Number(stake)});
     if(error)throw error;applyServerBettingState(data,g,m);syncBettingGateStatus(m);return true
   }catch(e){console.warn('Server bet failed',e);setText('#prototypeBetDeadlineCopy','WETTE KONNTE NICHT GESPEICHERT WERDEN · '+String(e?.message||e));return false}
 }
 const decisions=state.betDecisions[m.id]||(state.betDecisions[m.id]={});if(decisions[actorId])return false;const bal=Number(state.wallets[actorId]||0);stake=Math.max(0,Math.min(Number(stake)||0,bal));if(stake<=0)return false;state.wallets[actorId]=bal-stake;decisions[actorId]='BET';const bet={id:'bet-'+Date.now()+'-'+Math.random(),actorId,participantId:pid,stake,acceptedOdds:Number(odds),status:'PLACED',payout:0,auto,at:nowLabel()};(state.bets[m.id]||(state.bets[m.id]=[])).push(bet);state.transactions.push({id:'tx-'+bet.id,type:'STAKE',actorId,amount:-stake,betId:bet.id,at:nowLabel(),reason:m.id});syncBettingGateStatus(m);return true
}
async function skipBetFor(actorId){
 const g=gameNow(),m=matchNow();if(!m||m.status!=='BETTING_OPEN')return false;
 if(actorId===state.userActorId&&serverBettingApplies()){
   if(!serverBettingState?.market_id)await refreshServerBettingState(g,m);
   if(!serverBettingState?.market_id)return false;
   try{
     const {data,error}=await client.rpc('submit_betting_decision',{p_market_id:serverBettingState.market_id,p_decision:'SKIP',p_selected_participant_id:null,p_stake:null});
     if(error)throw error;applyServerBettingState(data,g,m);syncBettingGateStatus(m);return true
   }catch(e){console.warn('Server skip failed',e);setText('#prototypeBetDeadlineCopy','ENTSCHEIDUNG KONNTE NICHT GESPEICHERT WERDEN · '+String(e?.message||e));return false}
 }
 const d=state.betDecisions[m.id]||(state.betDecisions[m.id]={});if(d[actorId])return false;d[actorId]='SKIP';syncBettingGateStatus(m);return true
}
function weightedMarketPick(snap,seed){const sels=snapshotSelections(snap);if(!sels.length)return null;let r=(hash(seed)%1000000)/1000000,acc=0;for(const x of sels){acc+=Number(x.probability||0);if(r<=acc)return x}return sels[sels.length-1]}
function autoResolveBotBets(m=matchNow(),g=gameNow()){if(!m||!g||!feature('feature.betting')||m.status!=='BETTING_OPEN')return;const snap=freezeOdds(m,g);let changed=false;state.actors.filter(a=>a.isBot).forEach((a,ix)=>{const d=state.betDecisions[m.id]||(state.betDecisions[m.id]={});if(d[a.id])return;if((hash(a.id+'|'+m.id)%4)===0){d[a.id]='SKIP';changed=true}else{const choice=weightedMarketPick(snap,a.id+'|'+m.id+'|PICK');if(choice){const bal=Number(state.wallets[a.id]||0),stake=Math.min(bal,50+(ix%3)*25);if(stake>0){state.wallets[a.id]=bal-stake;d[a.id]='BET';const bet={id:'bet-'+Date.now()+'-'+Math.random(),actorId:a.id,participantId:choice.participantId,stake,acceptedOdds:Number(choice.odds),status:'PLACED',payout:0,auto:true,at:nowLabel()};(state.bets[m.id]||(state.bets[m.id]=[])).push(bet);state.transactions.push({id:'tx-'+bet.id,type:'STAKE',actorId:a.id,amount:-stake,betId:bet.id,at:nowLabel(),reason:m.id});changed=true}}}});if(changed)addAudit('AUTOMATIK · BOT-BETTING ABGESCHLOSSEN · '+g.name+' · '+stageLabel(m.stage));syncBettingGateStatus(m);}
function simulateOtherBets(){autoResolveBotBets();renderAll();saveSoon()}
function settleBets(m,winnerId){for(const b of state.bets[m.id]||[]){if(b.status!=='PLACED')continue;if(serverBettingApplies()&&!actor(b.actorId)?.isBot)continue;if(b.participantId===winnerId){b.status='WON';b.payout=Math.ceil(Number(b.stake||0)*Number(b.acceptedOdds||0));state.wallets[b.actorId]=(state.wallets[b.actorId]||0)+b.payout;state.transactions.push({id:'tx-pay-'+b.id,type:'PAYOUT',actorId:b.actorId,amount:b.payout,betId:b.id,at:nowLabel(),reason:m.id})}else{b.status='LOST';b.payout=0}}}

function winner(m){if(m.scoreA==null||m.scoreB==null||m.scoreA===m.scoreB)return null;return m.scoreA>m.scoreB?m.a:m.b}
function loser(m){const w=winner(m);return w?(w===m.a?m.b:m.a):null}
function updateRatingsAfterMatch(m,g){const w=winner(m),l=loser(m);if(!w||!l)return;const weights=gameWeights(g);for(const pid of [w,l]){const opp=pid===w?l:w,actual=pid===w?1:0,p=participant(pid);for(const aid of p.actorIds){for(const [sid,weight] of weights){const r=state.ratings[aid]?.[sid];if(!r)continue;const self=participantMetric(pid,sid),other=participantMetric(opp,sid),expected=1/(1+Math.exp(-(self-other)/12));const delta=8*(weight/100)*(actual-expected);r.skielsen=clamp(r.skielsen+delta,0,100);r.evidence=Number(r.evidence||0)+(weight/100);r.confidence=clamp(1-Math.pow(.90,r.evidence),0,1)}}}}
function showFlowToast(kicker,title,copy='',ms=2200){const t=q('#v1517FlowToast');if(!t)return;if(flowToastTimer){clearTimeout(flowToastTimer);flowToastTimer=0}t.innerHTML=`<small>${esc(kicker||'SKIELSEN')}</small><strong>${esc(title||'GESPEICHERT')}</strong>${copy?`<span>${esc(copy)}</span>`:''}`;t.hidden=false;requestAnimationFrame(()=>t.classList.add('show'));flowToastTimer=setTimeout(()=>{t.classList.remove('show');setTimeout(()=>{t.hidden=true},180);flowToastTimer=0},ms)}
function showResultPopup(m,g,winnerId,onContinue=null){
 const pop=q('#matchResultPop');if(!pop)return false;
 matchResultContinuation=typeof onContinue==='function'?onContinue:null;
 const shared=isSharedContestMatch(m),pa=shared?participant(winnerId):participant(m.a),pb=shared?null:participant(m.b);
 const userBet=(state.bets[m.id]||[]).find(b=>b.actorId===state.userActorId),won=userBet?.status==='WON',lost=userBet?.status==='LOST';
 const net=userBet?(won?Number(userBet.payout||0)-Number(userBet.stake||0):-Number(userBet.stake||0)):0;
 pop.classList.remove('is-win','is-loss','is-shared','is-visible');pop.classList.toggle('is-shared',shared);if(won)pop.classList.add('is-win');else if(lost)pop.classList.add('is-loss');
 setText('#resultPopStage',`${stageLabel(m.stage)} · ABGESCHLOSSEN`);setText('#resultPopGame',g.name);
 setText('#resultPopTeamA',teamName(pa));setText('#resultPopTeamB',shared?'':teamName(pb));
 const ma=q('#resultPopMarkA'),mb=q('#resultPopMarkB');if(ma)ma.className=marker(pa?.color);if(mb)mb.className=marker(pb?.color);
 setText('#resultPopScore',shared?'PLATZ 1':`${m.scoreA??0} : ${m.scoreB??0}`);
 setText('#resultPopBetLabel',userBet?(won?'WETTE GEWONNEN':'WETTE VERLOREN'):'KEINE WETTE');
 setText('#resultPopBetDetail',userBet?`${fmt(userBet.stake)} COINS · QUOTE ${Number(userBet.acceptedOdds||0).toFixed(2).replace('.',',')}`:'KEINE CREDIT-VERÄNDERUNG');
 setText('#resultPopCredits',userBet?`${net>=0?'+':''}${fmt(net)} COINS`:'±0');setText('#resultPopWallet',`${fmt(currentWallet())} COINS`);
 const mvp=q('#resultPopMvp');if(mvp)mvp.hidden=true;const cont=q('#resultPopClose');if(cont){cont.hidden=false;cont.textContent='WEITER'};
 pop.hidden=false;requestAnimationFrame(()=>pop.classList.add('is-visible'));return true
}
function closeResultPopup(){
 const pop=q('#matchResultPop');if(!pop||pop.hidden)return false;
 pop.classList.remove('is-visible');const next=matchResultContinuation;matchResultContinuation=null;
 setTimeout(()=>{pop.hidden=true;pop.classList.remove('is-win','is-loss','is-shared');if(next)next()},180);return true
}
function beginPostGameFlow(g,m,winnerId){
 if(!g)return false;
 window.skielsenInApp?.finishAndExit?.();
 const proceed=()=>continueCompletedGameFlow(g);
 const show=()=>{if(m&&showResultPopup(m,g,winnerId,proceed))return true;proceed();return true};
 if(feature('feature.betting')&&serverBettingApplies()&&m&&winnerId){
   void client.rpc('settle_betting_market',{p_tournament_game_id:g.tournament_game_id,p_match_sequence_no:currentMatchSequence(g,m),p_winner_participant_id:winnerId}).then(({data,error})=>{if(!error&&data)applyServerBettingState(data,g,m);else if(error)console.warn('Server bet settlement failed',error);show()});return true
 }
 return show()
}
function routeToCurrentWork(){
 if(!state)return;if(state.tournamentDone){show('ranking');return}
 const g=gameNow(),m=matchNow();if(!g){show('home');return}
 if(feature('feature.joker')&&g?.joker?.awaitingPick){const own=g.joker.accepted?.participantId===state.userParticipantId;if(own&&serverJokerBoard?.pending_pick)openPendingPickDialog(serverJokerBoard.pending_pick);else show('home');return}
 if(g.vote&&!g.vote.finalized){if(!g.vote.votes?.[state.userActorId])show('mvpVote');else show('home');return}
 if(g.phase==='AWARD_REVEAL'){show('home');beginPostGameAwardReveal(g);return}
 if(g.phase==='ACTIVE'&&m){openMatchDetail(m);return}
 if(g.phase==='PREPARING'){show('home');return}
 show('home')
}
function concludeCurrentMatch(scoreA,scoreB){const g=gameNow(),m=matchNow();if(!g||!m||m.status!=='LIVE')return false;scoreA=Number(scoreA);scoreB=Number(scoreB);if(!Number.isFinite(scoreA)||!Number.isFinite(scoreB)||scoreA<0||scoreB<0||scoreA===scoreB)return false;m.scoreA=scoreA;m.scoreB=scoreB;m.status='CONCLUDED';const w=winner(m),l=loser(m);settleBets(m,w);updateRatingsAfterMatch(m,g);state.matchHistory.unshift({gameIndex:state.currentGameIndex,game:g.name,stage:m.stage,a:m.a,b:m.b,scoreA,scoreB,winner:w,at:nowLabel()});addAudit('RESULT CONFIRMED · '+g.name+' · '+stageLabel(m.stage)+' · '+scoreA+':'+scoreB);const pre=state.oddsSnapshots[m.id];if(pre){const wp=w===m.a?pre.pa:pre.pb;if(wp<.4)addNews('UNDERDOG SCHLÄGT ZURÜCK.',`${teamName(participant(w))} gewinnt ${g.name} mit ${Math.round(wp*100)} % eingefrorener Siegchance.`,'UPSET');else addNews(`${teamName(participant(w))} SETZT SICH DURCH.`,`${g.name} · ${stageLabel(m.stage)} endet ${scoreA}:${scoreB}.`)}else addNews(`${teamName(participant(w))} GEWINNT.`,`${g.name} · ${stageLabel(m.stage)} endet ${scoreA}:${scoreB}.`);
 resolveBracketAfterMatch(g,true);showResultPopup(m,g,w,()=>{if(g.phase==='RESULTS')continueCompletedGameFlow(g);else{renderAll();saveSoon();routeToCurrentWork()}});renderAll();saveSoon();return true}
function rrStandings(g){const ps=state.participants.map(p=>({id:p.id,wins:0,diff:0,for:0}));const map=Object.fromEntries(ps.map(x=>[x.id,x]));g.matches.slice(0,3).forEach(m=>{if(m.status!=='CONCLUDED')return;map[m.a].for+=m.scoreA;map[m.b].for+=m.scoreB;map[m.a].diff+=m.scoreA-m.scoreB;map[m.b].diff+=m.scoreB-m.scoreA;map[winner(m)].wins++});let arr=[...ps];arr.sort((x,y)=>y.wins-x.wins||y.diff-x.diff||y.for-x.for||hash(g.game_id+'|'+x.id)-hash(g.game_id+'|'+y.id));const groups={};arr.forEach(x=>(groups[x.wins]||(groups[x.wins]=[])).push(x));Object.values(groups).forEach(gr=>{if(gr.length===2){const a=gr[0],b=gr[1],hm=g.matches.slice(0,3).find(m=>m.status==='CONCLUDED'&&((m.a===a.id&&m.b===b.id)||(m.a===b.id&&m.b===a.id)));if(hm&&winner(hm)===b.id){const ia=arr.indexOf(a),ib=arr.indexOf(b);if(Math.abs(ia-ib)===1)[arr[ia],arr[ib]]=[arr[ib],arr[ia]]}}});return arr}
function resolveBracketAfterMatch(g,deferPostGame=false){const i=g.matchIndex,m=g.matches[i];if(state.participants.length===4&&i===1){const sf1=g.matches[0],sf2=g.matches[1];g.matches[2].a=loser(sf1);g.matches[2].b=loser(sf2);g.matches[3].a=winner(sf1);g.matches[3].b=winner(sf2)}if(state.participants.length===3&&i===2){const st=rrStandings(g);g.rrStandings=st;g.matches[3].a=st[0].id;g.matches[3].b=st[1].id}
 if(i<g.matches.length-1){g.matchIndex=i+1;openCurrentMarket(g)}else{finishGame(g,deferPostGame)}}
function commitGamePlacementPoints(g){if(!g||g.resultsCommitted)return false;const placements=g.placements||[];placements.forEach((pid,ix)=>{const r=state.rankings[pid],place=ix+1;let pts=scoringPoints(place);if(feature('feature.joker')&&g.joker?.accepted?.type==='DOUBLE_POINTS'&&g.joker.accepted.participantId===pid)pts*=2;r.points+=pts;if(place===1)r.first++;else if(place===2)r.second++;else if(place===3)r.third++;else if(place===4)r.last++});g.resultsCommitted=true;return true}
function secretJokerRevealDetail(g){const a=g?.joker?.accepted;if(!a)return '';const owner=teamName(participant(a.participantId));if(a.type==='DOUBLE_POINTS'){const place=(g.placements||[]).indexOf(a.participantId)+1,base=place>0?scoringPoints(place):0;return `${owner} · PLATZ ${place||'—'} · ${base} → ${base*2} PUNKTE`}return `${owner} · ${jokerTypeLabel(a.type)}`}
function jokerTeamColorHex(p){
 return ({BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'}[p?.color]||'var(--theme-accent)');
}
function jokerDescriptionForType(type){
 if(type==='DOUBLE_POINTS')return 'Deine Platzierungspunkte in diesem Spiel werden verdoppelt.';
 if(type==='PICK_OPPONENT')return 'Du bestimmst deinen Gegner für dieses Spiel.';
 return jokerTypeLabel(type);
}
function localJokerRevealPayload(g){
 const a=g?.joker?.accepted;if(!a)return null;
 const owner=participant(a.participantId),place=(g.placements||[]).indexOf(a.participantId)+1;
 let before=null,after=null,unit=null,displayMode='STATIC',resultType='TEXT',resultText=null,outcome='NEUTRAL',success=null,effectApplied=true;
 if(a.type==='DOUBLE_POINTS'){
   before=place>0?scoringPoints(place):0;after=before*2;unit='PUNKTE';displayMode='MORPH';resultType='PLACEMENT_POINTS';
   success=after>before;outcome=success?'SUCCESS':'NO_SUCCESS';
 }else if(a.type==='PICK_OPPONENT'){
   displayMode='TEXT';resultType='OPPONENT_SELECTION';resultText=a.targetParticipantId?('GEGNER: '+teamName(participant(a.targetParticipantId))):'GEGNER GEWÄHLT';
 }
 return {
   schema_version:1,
   tournament_game_id:g.tournament_game_id||null,
   joker:{type:a.type,category:jokerRevealPolicy(a.type),title:jokerTypeLabel(a.type),description:jokerDescriptionForType(a.type)},
   owner:{participant_id:a.participantId,display_name:teamName(owner),color_key:owner?.color||null,color:jokerTeamColorHex(owner)},
   placement:{rank:place||null,participant_count:(state.participants||[]).length},
   result:{
     type:resultType,display_mode:displayMode,label:'ERGEBNIS',
     before,after,unit,text:resultText,
     before_text:before==null?null:`${before}${unit?' '+unit:''}`,
     after_text:after==null?null:`${after}${unit?' '+unit:''}`
   },
   resolution:{resolved:true,effect_applied:effectApplied,success,outcome}
 };
}
async function loadJokerRevealPayload(g){
 const fallback=localJokerRevealPayload(g);
 if(!client||!g?.tournament_game_id||!feature('feature.joker'))return fallback;
 try{
   const {data,error}=await client.rpc('get_tournament_game_joker_reveal',{p_tournament_game_id:g.tournament_game_id});
   if(!error&&data?.available&&data?.reveal)return data.reveal;
 }catch(e){console.warn('Joker reveal payload fallback',e)}
 return fallback;
}
function revealValueText(result,which){
 const direct=result?.[which+'_text'];if(direct!=null&&direct!=='')return String(direct);
 const v=result?.[which];if(v==null)return result?.text||'—';
 return `${v}${result?.unit?' '+result.unit:''}`;
}
function revealConfigFromPayload(payload,g){
 const owner=payload?.owner||{},joker=payload?.joker||{},result=payload?.result||{},resolution=payload?.resolution||{};
 const loser=resolution.outcome==='NO_SUCCESS'||resolution.success===false;
 return {
   ownerTeamName:owner.display_name||teamName(participant(g?.joker?.accepted?.participantId)),
   ownerTeamColor:owner.color||jokerTeamColorHex(participant(g?.joker?.accepted?.participantId)),
   jokerCategory:(joker.category||jokerRevealPolicy(joker.type||g?.joker?.accepted?.type))+' JOKER',
   jokerTitle:joker.title||jokerTypeLabel(joker.type||g?.joker?.accepted?.type),
   jokerDescription:joker.description||jokerDescriptionForType(joker.type||g?.joker?.accepted?.type),
   spin:{durationMs:3200,fullTurnsBeforeReveal:6},
   result:{
     label:result.label||'ERGEBNIS',
     initial:revealValueText(result,'before'),
     final:revealValueText(result,'after'),
     morphDelayMs:850
   },
   outcome:{
     mode:loser?'loser':'winner',
     loserDelayAfterMorphMs:1050,
     flickerMs:1550,
     crackLeadMs:760,
     breakDelayMs:1420
   },
   teamRevealCaption:'JOKER GESETZT VON',
   captionTitle:`${owner.display_name||teamName(participant(g?.joker?.accepted?.participantId))} · ${joker.title||jokerTypeLabel(joker.type||g?.joker?.accepted?.type)}`,
   captionText:loser?'Der Joker wurde angewendet, hat aber keinen zusätzlichen Vorteil gebracht.':'Der Joker wurde auf die endgültige Game-Wertung angewendet.'
 };
}
function clearJokerRevealTimers(){
 jokerRevealTimers.forEach(clearTimeout);jokerRevealTimers=[];
 jokerRevealAnimations.forEach(a=>{try{a.cancel()}catch(_){}});jokerRevealAnimations=[];
}
function jokerRevealLater(ms,fn){const t=setTimeout(fn,ms);jokerRevealTimers.push(t);return t}
function resetJokerRevealUi(){
 clearJokerRevealTimers();jokerRevealRunning=false;
 const cardCore=q('#v1530JokerCardCore'),card3d=q('#v1530JokerCard3d'),frame=q('#v1530JokerCardFrame'),crack=q('#v1530JokerCrackLayer'),shatter=q('#v1530JokerShatterStage');
 qa('#v1530JokerRevealDialog .v1530-reveal-line').forEach(el=>el.classList.remove('in'));
 q('#v1530JokerRule')?.classList.remove('in');q('#v1530JokerTeamReveal')?.classList.remove('in');q('#v1530JokerResult')?.classList.remove('in');q('#v1530JokerResultMorph')?.classList.remove('morph');
 frame?.classList.remove('revealed','loser-flicker');crack?.classList.remove('show');cardCore?.classList.remove('impact');
 q('#v1530JokerCaption')?.classList.remove('show');q('#v1530JokerLoserLabel')?.classList.remove('show');
 if(shatter){shatter.innerHTML='';shatter.classList.remove('active')}
 if(cardCore){cardCore.style.opacity='1';cardCore.style.transform='none'}
 if(card3d)card3d.style.transform='rotateY(0deg)';
 q('#v1530JokerTapOverlay')?.classList.remove('hidden');
 const cont=q('#v1530JokerRevealContinue');if(cont)cont.hidden=true;
}
function applyJokerRevealConfig(cfg,g){
 const d=q('#v1530JokerRevealDialog');if(!d||!cfg)return;
 d.style.setProperty('--v1530-team',cfg.ownerTeamColor||'var(--theme-accent)');
 setText('#v1530JokerRevealGame',`${String((g?.sequence_no||state.games.indexOf(g)+1)).padStart(2,'0')} · ${g?.name||'GAME'}`);
 setText('#v1530JokerCategory',cfg.jokerCategory);
 const title=q('#v1530JokerTitle');if(title)title.innerHTML=esc(cfg.jokerTitle).replace(/\n/g,'<br>');
 setText('#v1530JokerDescription',cfg.jokerDescription);
 setText('#v1530JokerTeam',cfg.ownerTeamName);setText('#v1530JokerTeamCaption',cfg.teamRevealCaption);
 setText('#v1530JokerResultLabel',cfg.result.label);setText('#v1530JokerResultInitial',cfg.result.initial);setText('#v1530JokerResultFinal',cfg.result.final);
 setText('#v1530JokerCaptionTitle',cfg.captionTitle);setText('#v1530JokerCaptionText',cfg.captionText);
}
function jokerRevealShardMarkup(cfg){
 return `<div class="v1530-shard-card"><img src="${q('#v1530JokerRevealDialog .v1530-front img')?.src||''}" alt=""><div class="v1530-shard-text"><div class="v1530-shard-category">${esc(cfg.jokerCategory)}</div><div class="v1530-shard-title">${esc(cfg.jokerTitle).replace(/\n/g,'<br>')}</div><div class="v1530-shard-rule"></div><div class="v1530-shard-desc">${esc(cfg.jokerDescription)}</div><div class="v1530-shard-bottom"><div class="v1530-shard-team">${esc(cfg.ownerTeamName)}</div><div class="v1530-shard-result">${esc(cfg.result.final)}</div></div></div></div>`;
}
function shatterJokerReveal(cfg){
 const stage=q('#v1530JokerShatterStage'),cardCore=q('#v1530JokerCardCore');if(!stage||!cardCore)return;
 stage.innerHTML='';stage.classList.add('active');
 const pieces=[
  {clip:'polygon(0 0,52% 0,45% 32%,0 42%)',dx:-82,dy:-82,r:-14},
  {clip:'polygon(52% 0,100% 0,100% 38%,58% 30%)',dx:88,dy:-88,r:16},
  {clip:'polygon(0 42%,45% 32%,48% 65%,0 72%)',dx:-105,dy:-5,r:-20},
  {clip:'polygon(45% 32%,58% 30%,66% 68%,48% 65%)',dx:6,dy:-36,r:9},
  {clip:'polygon(58% 30%,100% 38%,100% 72%,66% 68%)',dx:112,dy:5,r:22},
  {clip:'polygon(0 72%,48% 65%,44% 100%,0 100%)',dx:-82,dy:102,r:-17},
  {clip:'polygon(48% 65%,66% 68%,60% 100%,44% 100%)',dx:2,dy:126,r:7},
  {clip:'polygon(66% 68%,100% 72%,100% 100%,60% 100%)',dx:92,dy:108,r:18}
 ];
 pieces.forEach((p,i)=>{
   const shard=document.createElement('div');shard.className='v1530-shard';shard.style.clipPath=p.clip;shard.innerHTML=jokerRevealShardMarkup(cfg);stage.appendChild(shard);
   const a=shard.animate([
     {transform:'translate3d(0,0,0) rotate(0deg) scale(1)',opacity:1,filter:'brightness(1)'},
     {transform:`translate3d(${p.dx*.26}px,${p.dy*.20}px,0) rotate(${p.r*.2}deg) scale(.995)`,opacity:1,offset:.24,filter:'brightness(1.08)'},
     {transform:`translate3d(${p.dx}px,${p.dy}px,0) rotate(${p.r}deg) scale(.94)`,opacity:0,filter:'brightness(.55)'}
   ],{duration:900+Math.abs(p.dy)*1.4,delay:i*18,easing:'cubic-bezier(.18,.75,.22,1)',fill:'forwards'});
   jokerRevealAnimations.push(a);
 });
 cardCore.style.opacity='0';
}
function loserJokerRevealEnd(cfg){
 q('#v1530JokerLoserLabel')?.classList.add('show');q('#v1530JokerCardFrame')?.classList.add('loser-flicker');
 jokerRevealLater(cfg.outcome.crackLeadMs||760,()=>q('#v1530JokerCrackLayer')?.classList.add('show'));
 jokerRevealLater((cfg.outcome.breakDelayMs||1420)-120,()=>q('#v1530JokerCardCore')?.classList.add('impact'));
 jokerRevealLater(cfg.outcome.breakDelayMs||1420,()=>shatterJokerReveal(cfg));
 jokerRevealLater((cfg.outcome.breakDelayMs||1420)+1080,()=>{const b=q('#v1530JokerRevealContinue');if(b)b.hidden=false});
}
function playJokerReveal(){
 if(jokerRevealRunning||!jokerRevealConfig)return;
 jokerRevealRunning=true;q('#v1530JokerTapOverlay')?.classList.add('hidden');
 const cfg=jokerRevealConfig,card3d=q('#v1530JokerCard3d');if(!card3d)return;
 const fullTurns=Number(cfg.spin?.fullTurnsBeforeReveal||6),duration=Number(cfg.spin?.durationMs||3200),finalDeg=fullTurns*360+180;
 const spin=card3d.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${finalDeg}deg)`}],{duration,easing:'cubic-bezier(.18,.8,.18,1)',fill:'forwards'});
 jokerRevealAnimations.push(spin);
 spin.onfinish=()=>{
   card3d.style.transform='rotateY(180deg)';
   jokerRevealLater(180,()=>q('#v1530JokerCategory')?.classList.add('in'));
   jokerRevealLater(560,()=>q('#v1530JokerTitle')?.classList.add('in'));
   jokerRevealLater(860,()=>q('#v1530JokerRule')?.classList.add('in'));
   jokerRevealLater(1140,()=>q('#v1530JokerDescription')?.classList.add('in'));
   jokerRevealLater(1800,()=>{q('#v1530JokerCardFrame')?.classList.add('revealed');q('#v1530JokerTeamReveal')?.classList.add('in')});
   jokerRevealLater(2480,()=>{q('#v1530JokerResult')?.classList.add('in');q('#v1530JokerCaption')?.classList.add('show')});
   const morphAt=2480+(cfg.result.morphDelayMs||850);
   jokerRevealLater(morphAt,()=>q('#v1530JokerResultMorph')?.classList.add('morph'));
   if(cfg.outcome?.mode==='loser')jokerRevealLater(morphAt+(cfg.outcome.loserDelayAfterMorphMs||1050),()=>loserJokerRevealEnd(cfg));
   else jokerRevealLater(morphAt+760,()=>{const b=q('#v1530JokerRevealContinue');if(b)b.hidden=false});
 };
}
function closeJokerRevealDialog(acknowledge=true){
 const d=q('#v1530JokerRevealDialog');if(d)d.hidden=true;clearJokerRevealTimers();jokerRevealRunning=false;
 const g=Number.isInteger(jokerRevealGameIndex)&&jokerRevealGameIndex>=0?state?.games?.[jokerRevealGameIndex]:null;
 jokerRevealGameIndex=-1;jokerRevealConfig=null;
 if(acknowledge&&g){
   g.joker=g.joker||{};g.joker.revealAcknowledged=true;startPostGameVote(g);renderAll();saveSoon();setTimeout(routeToCurrentWork,0);
 }
}
async function showGameJokerReveal(g){
 if(!feature('feature.joker'))return false;
 const d=q('#v1530JokerRevealDialog');if(!g||!d)return false;
 closeJokerResolutionDialog();resetJokerRevealUi();
 const payload=await loadJokerRevealPayload(g);if(!payload)return false;
 const type=payload?.joker?.type||g?.joker?.accepted?.type;if(!type||String(payload?.joker?.category||jokerRevealPolicy(type)).toUpperCase()==='ACTION')return false;
 g.joker=g.joker||{submissions:[],accepted:null,resolved:true,locked:true,awaitingPick:false};
 if(!g.joker.accepted&&payload?.owner?.participant_id)g.joker.accepted={participantId:payload.owner.participant_id,type,status:'ACCEPTED',isBot:false};
 jokerRevealConfig=revealConfigFromPayload(payload,g);jokerRevealGameIndex=state.games.indexOf(g);applyJokerRevealConfig(jokerRevealConfig,g);
 g.joker.revealed=true;g.joker.revealAcknowledged=false;d.hidden=false;return true;
}
function knownPendingJokerCount(g){
 if(!feature('feature.joker'))return 0;
 const local=(g?.joker?.submissions||[]).filter(s=>s.status==='PENDING').length;
 return Math.max(local,Number(g?.joker?.resolutionSubmissionCount||0));
}
function openMultiJokerDialog(g,count){
 if(!feature('feature.joker')||Number(count)<2)return false;
 const d=q('#v1530JokerMultiDialog');if(!d)return false;
 jokerMultiDialogOpenedAt=Date.now();setText('#v1530JokerMultiTitle','MEHRERE JOKER');
 setText('#v1530JokerMultiCount',`${Number(count)} JOKER · AUSWAHL WIRD ERMITTELT …`);
 const host=q('#v1530JokerPickAnimationHost');if(host)host.dataset.pickAnimation='pending';
 d.hidden=false;return true;
}
function closeMultiJokerDialog(){
 const d=q('#v1530JokerMultiDialog');if(d)d.hidden=true;jokerMultiDialogOpenedAt=0;
}
function continueCompletedGameFlow(g){
 if(!g)return false;
 if(feature('feature.joker')){
   showGameJokerReveal(g).then(shown=>{if(!shown){if(g.joker?.accepted)g.joker.revealed=true;startPostGameVote(g);renderAll();saveSoon();setTimeout(routeToCurrentWork,0)}});saveSoon();return true
 }
 startPostGameVote(g);renderAll();saveSoon();setTimeout(routeToCurrentWork,0);return true
}
function finishGame(g,deferPostGame=false){if(!g||!Array.isArray(g.matches)||g.matches.some(m=>m.status!=='CONCLUDED'))return false;let placements=[];if(state.participants.length===2){const f=g.matches[0];placements=[winner(f),loser(f)]}else if(state.participants.length===3){const f=g.matches[3],rr=g.rrStandings||rrStandings(g);placements=[winner(f),loser(f),rr[2].id]}else{const tp=g.matches[2],f=g.matches[3];placements=[winner(f),loser(f),winner(tp),loser(tp)]}g.placements=placements;g.phase='RESULTS';const knownSecret=feature('feature.joker')&&!!g.joker?.accepted&&isSecretJokerType(g.joker.accepted.type);if(knownSecret)g.joker.revealed=true;commitGamePlacementPoints(g);addAudit('GAME COMPLETED · '+g.name+' · PLATZIERUNG '+placements.map((p,i)=>`${i+1}:${teamName(participant(p))}`).join(' / '));if(knownSecret)addAudit('JOKER REVEALED · '+teamName(participant(g.joker.accepted.participantId))+' · '+g.joker.accepted.type);saveSoon();if(deferPostGame)return true;continueCompletedGameFlow(g);return true}

function voteActors(){return state.actors}
function eligibleCandidates(voterId,type=gameNow()?.vote?.type||'MVP'){const va=actor(voterId),vp=actorParticipant(va);return state.actors.filter(c=>c.id!==voterId&&(type==='LVP'||c.participantId!==vp?.id))}
function autoResolveBotVotes(g=gameNow()){if(!g?.vote||g.vote.finalized)return;let changed=false;state.actors.filter(a=>a.isBot).forEach((a,ix)=>{if(g.vote.votes[a.id])return;const cand=eligibleCandidates(a.id,g.vote.type);const chosen=pickDet(cand,g.game_id+'|'+g.vote.type+'|'+a.id+'|'+ix);if(chosen){g.vote.votes[a.id]=chosen.id;changed=true}});if(changed)addAudit('AUTOMATIK · BOT-'+g.vote.type+'-VOTES ABGESCHLOSSEN')}
async function refreshServerVoteState(g=gameNow(),type=g?.vote?.type||null){
 if(!serverVoteApplies(g)||!type)return null;
 try{
   const {data,error}=await client.rpc('get_tournament_vote_state',{p_tournament_game_id:g.tournament_game_id,p_vote_type:type});
   if(error)throw error;if(data?.exists)applyServerVoteState(g,data);return data||null
 }catch(e){console.warn('Vote state sync failed',e);return null}
}
function applyServerVoteState(g,data){
 if(!g||!data?.exists)return false;serverVoteState=data;
 g.vote=g.vote||{type:data.vote_type,votes:{},winnerActorId:null,finalized:false};
 g.vote.type=data.vote_type;g.vote.serverSessionId=data.vote_session_id;g.vote.serverSubmittedCount=Number(data.submitted_count||0);g.vote.serverRequiredCount=Number(data.required_count||0);
 if(data.my_vote_candidate_member_id)g.vote.votes[state.userActorId]=data.my_vote_candidate_member_id;
 if(data.status==='FINALIZED'&&data.award){
   const winId=data.award.winner_member_id;g.vote.winnerActorId=winId;g.vote.finalized=true;
   const results=ensurePostGameVoteResults(g),prev=results[data.vote_type]||{};results[data.vote_type]={type:data.vote_type,winnerActorId:winId,participantId:data.award.winner_participant_id||actor(winId)?.participantId||null,votes:Number(data.award.vote_count||0),totalVotes:Number(data.submitted_count||0),counts:{},committed:!!prev.committed,server:true,revealAcknowledged:!!prev.revealAcknowledged};
 }
 renderAll();return true
}
function startVotePolling(g=gameNow(),type=g?.vote?.type||null){
 if(votePollTimer||!serverVoteApplies(g)||!type)return;
 votePollTimer=setInterval(async()=>{const data=await refreshServerVoteState(g,type);if(data?.status==='FINALIZED'){stopVotePolling();continuePostGameVoting(g)}},1400)
}
function stopVotePolling(){if(votePollTimer){clearInterval(votePollTimer);votePollTimer=0}}
async function ensureServerVoteSession(g,type){
 if(!serverVoteApplies(g))return null;
 try{
   const {data,error}=await client.rpc('open_tournament_vote_session',{p_tournament_game_id:g.tournament_game_id,p_vote_type:type});
   if(error)throw error;if(data?.exists)applyServerVoteState(g,data);startVotePolling(g,type);return data||null
 }catch(e){console.warn('Open vote session failed',e);return null}
}
function requiredPostGameVoteTypes(){const out=[];if(feature('feature.mvp_voting'))out.push('MVP');if(feature('feature.lvp_voting'))out.push('LVP');return out}
function ensurePostGameVoteResults(g){g.postGameVoteResults=g.postGameVoteResults||{};g.postGameReveal=g.postGameReveal||{index:0,done:false};return g.postGameVoteResults}
function startPostGameVoteType(g,type){
 if(!g||!type)return false;
 ensurePostGameVoteResults(g);
 if(g.vote&&!g.vote.finalized&&g.vote.type===type){
   g.phase=type==='MVP'?'VOTING_MVP':'VOTING_LVP';autoResolveBotVotes(g);renderAll();saveSoon();void ensureServerVoteSession(g,type).then(()=>routeToCurrentWork());return true
 }
 g.phase=type==='MVP'?'VOTING_MVP':'VOTING_LVP';g.vote={type,votes:{},winnerActorId:null,finalized:false};selectedMvpCandidate=null;autoResolveBotVotes(g);renderAll();saveSoon();void ensureServerVoteSession(g,type).then(()=>routeToCurrentWork());return true
}
function startPostGameVote(g){
 if(!g)return false;
 const results=ensurePostGameVoteResults(g),types=requiredPostGameVoteTypes();
 if(g.vote&&!g.vote.finalized&&types.includes(g.vote.type))return startPostGameVoteType(g,g.vote.type);
 const next=types.find(type=>!results[type]);
 if(next)return startPostGameVoteType(g,next);
 g.vote=null;return beginPostGameAwardReveal(g)
}
async function submitVote(voterId,candidateId){
 const g=gameNow();if(!g?.vote||g.vote.finalized)return false;if(!eligibleCandidates(voterId,g.vote.type).some(c=>c.id===candidateId))return false;
 if(voterId===state.userActorId&&serverVoteApplies(g)){
   if(!g.vote.serverSessionId)await ensureServerVoteSession(g,g.vote.type);
   if(!g.vote.serverSessionId)return false;
   try{
     const {data,error}=await client.rpc('submit_tournament_vote',{p_vote_session_id:g.vote.serverSessionId,p_candidate_member_id:candidateId});
     if(error)throw error;applyServerVoteState(g,data);selectedMvpCandidate=null;
     if(data?.status==='FINALIZED'){stopVotePolling();continuePostGameVoting(g)}else startVotePolling(g,g.vote.type);
     return true
   }catch(e){console.warn('Submit vote failed',e);setText('#mvpFeedback','STIMME KONNTE NICHT GESPEICHERT WERDEN · '+String(e?.message||e));return false}
 }
 g.vote.votes[voterId]=candidateId;autoResolveBotVotes(g);return true
}
function simulateOtherVotes(){const g=gameNow();if(!g?.vote)return;autoResolveBotVotes(g);if(Object.keys(g.vote.votes).length===voteActors().length)finalizeVote(g);renderAll();saveSoon()}
function finalizeVote(g){
 if(!g?.vote||g.vote.finalized)return;
 const voteType=g.vote.type,counts={};Object.values(g.vote.votes).forEach(id=>counts[id]=(counts[id]||0)+1);
 const max=Math.max(0,...Object.values(counts)),top=Object.keys(counts).filter(id=>counts[id]===max).sort(),winId=top[hash(g.game_id+'|'+voteType)%Math.max(1,top.length)]||null,total=Object.keys(g.vote.votes||{}).length;
 g.vote.winnerActorId=winId;g.vote.counts=counts;g.vote.finalized=true;
 const results=ensurePostGameVoteResults(g);
 if(!results[voteType])results[voteType]={type:voteType,winnerActorId:winId,participantId:actor(winId)?.participantId||null,votes:max,totalVotes:total,counts:{...counts},committed:false};
 addAudit(voteType+' VOTING COMPLETE · RESULT SEALED · '+total+'/'+voteActors().length+' STIMMEN');
 showFlowToast(voteType+' · '+g.name,'WAHL ABGESCHLOSSEN',total+' / '+voteActors().length+' STIMMEN · ERGEBNIS BLEIBT BIS ZUM REVEAL VERDECKT.',1200);
 renderAll();saveSoon();setTimeout(()=>continuePostGameVoting(g),500)
}
function continuePostGameVoting(g){
 if(!g)return false;
 const types=requiredPostGameVoteTypes(),results=ensurePostGameVoteResults(g),next=types.find(type=>!results[type]);
 if(next){g.vote=null;return startPostGameVoteType(g,next)}
 g.vote=null;g.phase='AWARD_REVEAL';g.postGameReveal={index:0,done:false};renderAll();saveSoon();return beginPostGameAwardReveal(g)
}
function voteRevealTypes(g){const results=ensurePostGameVoteResults(g);return requiredPostGameVoteTypes().filter(type=>!!results[type]&&!results[type].revealAcknowledged)}
function commitVoteAward(g,type){
 const r=g?.postGameVoteResults?.[type];if(!r||r.committed)return false;
 const a=actor(r.winnerActorId),pid=a?.participantId||r.participantId;if(!a||!pid)return false;
 if(type==='MVP')state.rankings[pid].mvp=Number(state.rankings[pid].mvp||0)+1;else state.rankings[pid].lvp=Number(state.rankings[pid].lvp||0)+1;
 state.awards.push({gameIndex:state.games.indexOf(g),type,actorId:a.id,participantId:pid,votes:Number(r.votes||0)});
 addNews(type+': '+a.name.toUpperCase()+'.',g.name+' · '+Number(r.votes||0)+' Stimmen. Die einzelnen Voter bleiben vertraulich.',type);
 addAudit(type+' REVEALED · '+a.name+' · '+Number(r.votes||0)+' STIMMEN');r.committed=true;r.revealAcknowledged=true;renderAll();saveSoon();return true
}
function showVoteResult(g,type){
 const pop=q('#mvpCompletePopup'),r=g?.postGameVoteResults?.[type];if(!pop||!r)return false;
 awardRevealGameIndex=state.games.indexOf(g);awardRevealType=type;
 const a=actor(r.winnerActorId),p=actorParticipant(a),types=voteRevealTypes(g),ix=Math.max(0,types.indexOf(type));
 setText('#mvpWinnerVoteCount',Number(r.totalVotes||0)+' / '+voteActors().length+' STIMMEN');setText('#mvpCompleteTitle',type+' WAHL IST ABGESCHLOSSEN.');
 setText('#mvpWinnerGame',type+' · '+g.name);setText('#mvpWinnerName',a?.name||'—');setText('#mvpWinnerTeam',p?.name||'—');setText('#mvpWinnerBadge',initials(a?.name));
 const badge=q('#mvpWinnerBadge');if(badge){badge.className='mvp-winner-badge '+marker(p?.color);badge.dataset.awardType=type}
 const rev=q('#mvpWinnerReveal');if(rev)rev.hidden=true;const show=q('#mvpShowResult');if(show){show.hidden=false;show.textContent=type+' ERGEBNIS ANZEIGEN'}
 const cont=q('#mvpResultContinue');if(cont){cont.hidden=true;cont.textContent=ix<types.length-1?types[ix+1]+' REVEAL →':'WEITER →'}
 pop.hidden=false;requestAnimationFrame(()=>pop.classList.add('is-visible'));return true
}
function revealVoteWinner(){
 const g=state?.games?.[awardRevealGameIndex];if(g&&awardRevealType)commitVoteAward(g,awardRevealType);
 const rev=q('#mvpWinnerReveal');if(rev){rev.hidden=false;q('#mvpWinnerBadge')?.classList.add('reveal')}
 const show=q('#mvpShowResult');if(show)show.hidden=true;const next=q('#mvpResultContinue');if(next)next.hidden=false
}
function hideVoteResultPopup(done){
 const pop=q('#mvpCompletePopup');if(!pop){done?.();return}
 pop.classList.remove('is-visible');setTimeout(()=>{pop.hidden=true;done?.()},180)
}
function continueVoteReveal(){
 const g=state?.games?.[awardRevealGameIndex];if(!g)return;
 const types=voteRevealTypes(g),ix=types.indexOf(awardRevealType),next=ix>=0?types[ix+1]:null;
 hideVoteResultPopup(()=>{
   if(next){g.postGameReveal.index=ix+1;saveSoon();showVoteResult(g,next);return}
   g.postGameReveal={index:types.length,done:true};awardRevealGameIndex=-1;awardRevealType=null;saveSoon();void advanceAfterVotes(true)
 })
}
function beginPostGameAwardReveal(g){
 if(!g)return false;
 const types=voteRevealTypes(g);if(!types.length){void advanceAfterVotes(true);return true}
 g.phase='AWARD_REVEAL';g.vote=null;g.postGameReveal=g.postGameReveal||{index:0,done:false};
 if(g.postGameReveal.done){void advanceAfterVotes(true);return true}
 const ix=Math.max(0,Math.min(Number(g.postGameReveal.index)||0,types.length-1));renderAll();saveSoon();return showVoteResult(g,types[ix])
}
function dismissVoteResult(){hideVoteResultPopup(()=>{const g=gameNow();if(g?.vote&&!g.vote.finalized)show('mvpVote');else show('home')})}
async function advanceAfterVotes(automatic=false){
 const g=gameNow();if(!g)return;
 if(!automatic){dismissVoteResult();return}
 g.phase='COMPLETED';g.vote=null;
 if(state.currentGameIndex<state.games.length-1){
   state.currentGameIndex++;
   const n=gameNow();if(!['ACTIVE','PREPARING'].includes(n.phase))n.phase='PLANNED';
   enforceGameLifecycleInvariant(state);renderAll();saveSoon();await prepareCurrentGame()
 }else{finishTournament()}
 renderAll();saveSoon();setTimeout(routeToCurrentWork,0)
}
function finishTournament(){if(state.finalBonusApplied||state.tournamentDone)return;state.finalBonusApplied=true;const vals=state.participants.map(p=>({p,count:state.rankings[p.id].mvp}));const max=Math.max(...vals.map(x=>x.count),0),leaders=vals.filter(x=>x.count===max&&max>0);if(leaders.length===1){state.rankings[leaders[0].p.id].points+=10;state.rankings[leaders[0].p.id].bonus+=10;addAudit('MVP TEAM BONUS +10 · '+leaders[0].p.name);addNews('MVP-TEAM-BONUS ENTSCHEIDET.',`${leaders[0].p.name} erhält +10 Punkte für die meisten MVP-Titel.`,'TOURNAMENT')}else if(leaders.length>1){addAudit('MVP TEAM BONUS · GLEICHSTAND · KEIN BONUS');addNews('MVP-TITEL IM GLEICHSTAND.',`Bei Gleichstand wird kein +10-Bonus vergeben.`,'SYSTEM')}state.tournamentDone=true;addNews('TURNIER ABGESCHLOSSEN.','Alle ausgewählten Games wurden abgeschlossen.','TOURNAMENT');addAudit('TOURNAMENT COMPLETE')}

function jokerTypeLabel(type){return type==='DOUBLE_POINTS'?'DOPPELTE PUNKTE':'GEGNER WÄHLEN'}
function pickOpponentAllowedForGame(g){return !!g&&state.participants.length===4&&isMatchBasedGame(g)}
function userPendingSubmissionForGame(g){const p=userParticipant();return g?.joker?.submissions?.find(s=>s.participantId===p?.id&&s.status==='PENDING')||null}
function userPendingSubmissionForType(type){const p=userParticipant();for(const g of state.games||[]){const s=g?.joker?.submissions?.find(x=>x.participantId===p?.id&&x.type===type&&x.status==='PENDING');if(s)return {g,s,gi:state.games.indexOf(g)}}return null}
function plannedJokerGames(){return (state.games||[]).map((g,gi)=>({g,gi})).filter(x=>x.g.phase==='PLANNED')}
function jokerOpenListGames(){return (state.games||[]).map((g,gi)=>({g,gi})).filter(x=>!isJokerHistoryGame(x.g)&&['PLANNED','PREPARING','ACTIVE'].includes(x.g.phase))}
function jokerLockedStateLabel(g){if(g?.phase==='ACTIVE')return 'NICHT MEHR VERFÜGBAR · SPIEL LÄUFT';if(g?.phase==='PREPARING')return 'NICHT MEHR VERFÜGBAR · VORBEREITUNG';return 'NICHT MEHR VERFÜGBAR'}
function latestServerJokerSubmissions(board){
 const out=new Map();
 for(const ss of board?.submissions||[]){
   const key=String(ss.tournament_game_id)+'|'+String(ss.joker_type);
   if(!out.has(key))out.set(key,ss);
 }
 return [...out.values()];
}
function primeJokerNotificationBaseline(board){
 if(!state||!board)return;
 state.jokerResolutionSeen=state.jokerResolutionSeen||{};
 for(const ss of latestServerJokerSubmissions(board)){
   if(['ACCEPTED','REJECTED'].includes(ss.status)&&ss.joker_submission_id)state.jokerResolutionSeen[ss.joker_submission_id]=true;
 }
}

function jokerResolutionGame(ss){return (state.games||[]).find(g=>g.tournament_game_id===ss?.tournament_game_id)||null}
function closeJokerResolutionDialog(){const d=q('#v1511JokerResolutionDialog'),card=d?q('.v1511-joker-resolution-card',d):null;if(card?.classList.contains('is-pick')&&pendingPickDialogGameId)pendingPickDismissedFor=pendingPickDialogGameId;if(d)d.hidden=true;pendingPickDialogGameId=null;selectedJokerTarget=null}
function renderBracketSummary(g){
 const ms=g?.matches||[],a=ms.find(x=>x.stage==='SEMIFINAL_1'),b=ms.find(x=>x.stage==='SEMIFINAL_2');
 if(!a||!b)return 'TURNIERBAUM WURDE AKTUALISIERT.';
 const n=x=>x?teamName(participant(x)):'TBD';
 return `HF 1 · ${esc(n(a.a))} VS ${esc(n(a.b))}<br>HF 2 · ${esc(n(b.a))} VS ${esc(n(b.b))}`;
}
function openJokerResolutionNotice(ss){
 const g=jokerResolutionGame(ss),d=q('#v1511JokerResolutionDialog'),card=q('.v1511-joker-resolution-card',d),choices=q('#v1511OpponentChoices'),close=q('#v1511JokerResolutionClose'),confirm=q('#v1511JokerResolutionConfirm');
 if(!d||!card||!g)return;
 card.classList.remove('is-rejected','is-success','is-pick');if(choices){choices.hidden=true;choices.innerHTML=''}if(confirm)confirm.hidden=true;
 setText('#v1511JokerResolutionKicker','JOKER AUFLÖSUNG');
 if(ss.status==='REJECTED'){
   card.classList.add('is-rejected');setText('#v1511JokerResolutionTitle','JOKER NICHT AUSGEWÄHLT');
   setText('#v1511JokerResolutionCopy','Für dieses Game gab es mehrere Joker-Submissions. Deine Submission wurde nicht gezogen und dein Joker bleibt verfügbar.');
   const s=q('#v1511JokerResolutionSummary');if(s)s.innerHTML=`<b>${esc(jokerTypeLabel(ss.joker_type))}</b><br>${String((g.sequence_no||state.games.indexOf(g)+1)).padStart(2,'0')} · ${esc(g.name)}<br><small>STATUS · REJECTED · JOKER NICHT VERBRAUCHT</small>`;
   if(close)close.textContent='VERSTANDEN';
 }else if(ss.status==='ACCEPTED'&&ss.joker_type==='DOUBLE_POINTS'){
   card.classList.add('is-success');setText('#v1511JokerResolutionTitle','DOPPELTE PUNKTE AKZEPTIERT');
   setText('#v1511JokerResolutionCopy','Dein Joker wurde ausgewählt. Nur du siehst jetzt den Typ. Für deine Gegner bleibt er bis zum Abschluss des Games geheim.');
   const s=q('#v1511JokerResolutionSummary');if(s)s.innerHTML=`<b>DOPPELTE PUNKTE</b><br>${String((g.sequence_no||state.games.indexOf(g)+1)).padStart(2,'0')} · ${esc(g.name)}<br><small>STATUS · ACCEPTED · SECRET BIS GAME-ENDE</small>`;
   if(close)close.textContent='VERSTANDEN';
 }
 d.hidden=false;
}
function openPendingPickDialog(pp){
 const g=(state.games||[]).find(x=>x.tournament_game_id===pp?.tournament_game_id),p=userParticipant(),overlay=q('#v1536PickOpponentOverlay'),card=q('#v1536PickCard'),choices=q('#v1536PickChoices'),grid=q('#v1536PickChoiceGrid'),confirm=q('#v1536PickConfirm');
 if(!g||!p||!overlay||!card||!choices||!grid||!confirm)return;if(!g.joker?.awaitingPick)return;if(overlay.hidden===false&&pendingPickDialogGameId===g.tournament_game_id)return;
 pendingPickDialogGameId=g.tournament_game_id;pendingPickDismissedFor=null;selectedJokerTarget=null;setText('#v1536PickOwner',`${teamName(p)} WÄHLT`);grid.innerHTML=state.participants.filter(x=>x.id!==p.id).map(x=>`<button class="v1536-pick-choice" type="button" data-v1536-pick-target="${esc(x.id)}"><i class="${marker(x.color)}"></i><span><strong>${esc(x.name)}</strong><span>ALS GEGNER WÄHLEN</span></span></button>`).join('');confirm.disabled=true;confirm.classList.remove('ready');confirm.textContent='AUSWAHL BESTÄTIGEN';choices.hidden=true;overlay.className='v1536-pick-overlay';overlay.hidden=false;card.classList.remove('flipped');requestAnimationFrame(()=>{setTimeout(()=>card.classList.add('flipped'),320);setTimeout(()=>{choices.hidden=false;overlay.classList.add('selecting')},1350)})
}
function showBracketUpdatedDialog(g){
 const d=q('#v1511JokerResolutionDialog'),card=q('.v1511-joker-resolution-card',d),choices=q('#v1511OpponentChoices'),confirm=q('#v1511JokerResolutionConfirm'),close=q('#v1511JokerResolutionClose');
 if(!d||!card)return;pendingPickDialogGameId=null;selectedJokerTarget=null;card.classList.remove('is-rejected','is-pick');card.classList.add('is-success');
 setText('#v1511JokerResolutionKicker','JOKER ANGEWENDET');setText('#v1511JokerResolutionTitle','TURNIERBAUM AKTUALISIERT');
 setText('#v1511JokerResolutionCopy','Deine Gegnerwahl wurde gespeichert. Die Halbfinals wurden neu aufgebaut und das Betting wird jetzt auf Basis dieses finalen Brackets geöffnet.');
 const s=q('#v1511JokerResolutionSummary');if(s)s.innerHTML=renderBracketSummary(g);
 if(choices){choices.hidden=true;choices.innerHTML=''}if(confirm)confirm.hidden=true;if(close)close.textContent='MATCHES ANSEHEN';d.dataset.afterClose='matches';d.hidden=false;
}
function handleJokerBoardNotifications(board,notify){
 if(!state||!board)return;
 const latest=latestServerJokerSubmissions(board);
 if(notify){
   for(const ss of latest){
     if(!['ACCEPTED','REJECTED'].includes(ss.status))continue;
     if(state.jokerResolutionSeen?.[ss.joker_submission_id])continue;
     state.jokerResolutionSeen[ss.joker_submission_id]=true;
     if(ss.status==='ACCEPTED'&&ss.joker_type==='PICK_OPPONENT'&&board.pending_pick?.joker_submission_id===ss.joker_submission_id){
       openPendingPickDialog(board.pending_pick);
     }else{
       openJokerResolutionNotice(ss);
     }
     saveSoon();
     break;
   }
 }
 if(board.pending_pick&&pendingPickDismissedFor!==board.pending_pick.tournament_game_id&&q('#v1511JokerResolutionDialog')?.hidden!==false&&q('#v1536PickOpponentOverlay')?.hidden!==false)openPendingPickDialog(board.pending_pick);
}
async function refreshServerJokerBoard(notify=false){
 if(!feature('feature.joker')){serverJokerBoard=null;return null}if(!client||!runtime?.tournament_id)return null;
 try{
   const {data,error}=await client.rpc('get_my_joker_board',{p_tournament_id:runtime.tournament_id});if(error)throw error;
   serverJokerBoard=data||null;const p=userParticipant();
   if(p&&serverJokerBoard){
     for(const j of serverJokerBoard.jokers||[]){if(state.jokers[p.id]?.[j.joker_type]!=null)state.jokers[p.id][j.joker_type]=j.status}
     // Reconcile only the latest server record per game/type. Older WITHDRAWN history must never overwrite a newer PENDING submission.
     for(const g of state.games||[]){
       g.joker=g.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};
       g.joker.submissions=(g.joker.submissions||[]).filter(s=>s.participantId!==p.id||s.isBot);
     }
     for(const ss of latestServerJokerSubmissions(serverJokerBoard)){
       const g=(state.games||[]).find(x=>x.tournament_game_id===ss.tournament_game_id);if(!g)continue;
       g.joker.submissions.push({participantId:p.id,type:ss.joker_type,targetParticipantId:ss.target_participant_id||null,status:ss.status,isBot:false,serverId:ss.joker_submission_id,submittedAt:ss.submitted_at});
       if(ss.status==='ACCEPTED'){
         g.joker.accepted={participantId:p.id,type:ss.joker_type,targetParticipantId:ss.target_participant_id||null,status:'ACCEPTED',isBot:false,serverId:ss.joker_submission_id};
         if(g.joker.revealed==null)g.joker.revealed=jokerRevealPolicy(ss.joker_type)==='ACTION'||isJokerHistoryGame(g);
         if(g.joker.revealAcknowledged==null)g.joker.revealAcknowledged=isJokerHistoryGame(g);
       }
     }
     for(const sg of serverJokerBoard.games||[]){
       const gi=(state.games||[]).findIndex(x=>x.tournament_game_id===sg.tournament_game_id);if(gi<0)continue;
       const g=state.games[gi],isCurrent=gi===state.currentGameIndex;
       // Server PREPARING is lifecycle-authoritative only for the game that is actually current.
       // Future TournamentGames remain PLANNED and joker-eligible until their own preparation starts.
       if(isCurrent&&sg.status==='PREPARING'&&g.phase!=='ACTIVE'&&!(g.matches?.length&&g.joker?.resolved&&!g.joker?.awaitingPick))g.phase='PREPARING';
       if(isCurrent&&sg.joker_resolution_state==='WAITING_FOR_PICK'){g.joker.locked=true;g.joker.awaitingPick=true;g.joker.resolved=false}
       if(isCurrent&&sg.joker_resolution_state==='RESOLVED'&&g.phase==='PREPARING'&&!g.joker.awaitingPick){
         g.joker.resolved=true;
         // Server lifecycle is authoritative. Every device must advance the current game,
         // not only the admin browser that called prepare_tournament_game().
         finishJokerPreparation(g);
       }
       if(isCurrent&&sg.status==='ACTIVE'){
         const nativeInApp=String(g?.tracker_type||'').toUpperCase()==='IN_APP_NATIVE'||String(g?.play_mode||g?.default_play_mode||'').toUpperCase()==='IN_APP';
         if(!g.matches?.length)buildMatchesForGame(g);else g.phase='ACTIVE';
         if(nativeInApp){
           const liveMatch=(g.matches||[])[g.matchIndex||0]||(g.matches||[])[0];
           if(liveMatch&&liveMatch.status!=='CONCLUDED')liveMatch.status='LIVE';
         }
       }
     }
     const pp=serverJokerBoard.pending_pick;
     if(pp){
       const gi=(state.games||[]).findIndex(x=>x.tournament_game_id===pp.tournament_game_id);
       const g=gi>=0?state.games[gi]:null;
       if(g&&gi===state.currentGameIndex){g.phase='PREPARING';g.joker.locked=true;g.joker.awaitingPick=true;g.joker.resolved=false;g.joker.revealed=true;g.joker.revealAcknowledged=true;g.joker.accepted={participantId:p.id,type:'PICK_OPPONENT',targetParticipantId:null,status:'ACCEPTED',isBot:false,serverId:pp.joker_submission_id}}
     }
     enforceGameLifecycleInvariant(state);
     handleJokerBoardNotifications(serverJokerBoard,notify);
   }
   return serverJokerBoard
 }catch(e){console.warn('Joker board sync failed',e);return null}
}
function startJokerBoardPolling(){
 if(jokerBoardPollTimer||!feature('feature.joker')||!client)return;
 jokerBoardPollTimer=setInterval(async()=>{const before=JSON.stringify(serverJokerBoard?.pending_pick||null);await refreshServerJokerBoard(true);renderJoker();renderHome();if(JSON.stringify(serverJokerBoard?.pending_pick||null)!==before)saveSoon()},1800)
}
async function submitUserJoker(){
 if(!feature('feature.joker'))return false;
 const p=userParticipant(),g=state.games?.[selectedJokerGameIndex],submittedType=selectedJokerType,submittedGameIndex=selectedJokerGameIndex;
 if(!p||!g||g.phase!=='PLANNED'||!selectedJokerType)return false;
 if(state.jokers[p.id]?.[selectedJokerType]!=='AVAILABLE')return false;
 if(selectedJokerType==='PICK_OPPONENT'&&!pickOpponentAllowedForGame(g))return false;
 const otherOnGame=userPendingSubmissionForGame(g);
 if(otherOnGame&&otherOnGame.type!==selectedJokerType){
   setText('#jokerFeedback','FÜR DIESES GAME HAST DU BEREITS EINEN ANDEREN JOKER EINGEREICHT.');
   return false
 }
 if(client&&g.tournament_game_id){
   try{
     const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('SERVER_TIMEOUT')),8000));
     const response=await Promise.race([
       client.rpc('submit_tournament_joker',{p_tournament_game_id:g.tournament_game_id,p_joker_type:selectedJokerType}),
       timeout
     ]);
     const {data,error}=response||{};
     if(error)throw error;
     if(data?.tournament_game_id&&data.tournament_game_id!==g.tournament_game_id)throw new Error('JOKER_GAME_MISMATCH');
     if(data?.joker_type&&String(data.joker_type).toUpperCase()!==String(selectedJokerType).toUpperCase())throw new Error('JOKER_TYPE_MISMATCH');
     if(!data?.joker_submission_id||String(data?.status||'').toUpperCase()!=='PENDING')throw new Error('JOKER_SERVER_CONFIRMATION_MISSING');

     // The submit RPC is the authoritative confirmation. Do not block the modal on a second board request.
     for(const gx of state.games||[]){
       gx.joker=gx.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};
       gx.joker.submissions=(gx.joker.submissions||[]).filter(ss=>!(ss.participantId===p.id&&ss.type===selectedJokerType&&ss.status==='PENDING'));
     }
     g.joker.submissions.push({
       participantId:p.id,
       type:selectedJokerType,
       targetParticipantId:null,
       status:'PENDING',
       isBot:false,
       serverId:data.joker_submission_id,
       submittedAt:new Date().toISOString()
     });

     void Promise.race([
       refreshServerJokerBoard(false),
       new Promise(resolve=>setTimeout(()=>resolve(null),4000))
     ]).then(()=>{renderJoker();renderHome()}).catch(err=>console.warn('Joker board post-submit refresh',err));
   }catch(e){
     console.warn(e);
     const msg=String(e?.message||e);
     setText('#jokerFeedback','JOKER KONNTE NICHT GESPEICHERT WERDEN · '+msg);
     setText('#v1510JokerDialogKicker','SPEICHERN FEHLGESCHLAGEN');
     setText('#v1510JokerDialogTitle','JOKER NICHT GESPEICHERT');
     setText('#v1510JokerDialogCopy',msg==='SERVER_TIMEOUT'?'Der Server hat nicht rechtzeitig geantwortet. Du kannst den Vorgang erneut versuchen.':'Der Server hat die Submission nicht bestätigt. Du kannst den Vorgang erneut versuchen.');
     return false
   }
 }else{
   const old=userPendingSubmissionForType(selectedJokerType);if(old&&old.g!==g)old.g.joker.submissions=old.g.joker.submissions.filter(s=>s!==old.s);
   g.joker=g.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};
   g.joker.submissions=(g.joker.submissions||[]).filter(s=>!(s.participantId===p.id&&s.status==='PENDING'));
   g.joker.submissions.push({participantId:p.id,type:selectedJokerType,targetParticipantId:null,status:'PENDING',isBot:false,submittedAt:new Date().toISOString()});
 }
 addAudit('JOKER SUBMITTED · '+p.name+' · '+selectedJokerType+' → GAME '+(submittedGameIndex+1)+' '+g.name);
 setText('#jokerFeedback','JOKER GESETZT · '+jokerTypeLabel(submittedType)+' → '+String(submittedGameIndex+1).padStart(2,'0')+' · '+g.name.toUpperCase()+' · SERVER BESTÄTIGT.');
 jokerDialogMeta={type:submittedType,gameIndex:submittedGameIndex,gameName:g.name};
 selectedJokerType=null;selectedJokerGameIndex=null;
 renderAll();saveSoon();return true
}
async function withdrawUserJoker(gameIndex){if(!feature('feature.joker'))return false;const p=userParticipant(),g=state.games?.[gameIndex],sub=userPendingSubmissionForGame(g);if(!p||!g||!sub||g.phase!=='PLANNED')return false;const srv=(serverJokerBoard?.submissions||[]).find(s=>s.tournament_game_id===g.tournament_game_id&&s.status==='PENDING'&&s.joker_type===sub.type);if(client&&srv?.joker_submission_id){try{const {error}=await client.rpc('withdraw_tournament_joker',{p_joker_submission_id:srv.joker_submission_id});if(error)throw error}catch(e){console.warn(e);setText('#jokerFeedback','JOKER KONNTE NICHT ZURÜCKGEZOGEN WERDEN · '+String(e?.message||e));return false}}
 g.joker.submissions=g.joker.submissions.filter(s=>s!==sub);addAudit('JOKER WITHDRAWN · '+p.name+' · '+sub.type+' · '+g.name);await refreshServerJokerBoard();renderAll();saveSoon();return true}
function applyPreparedJokerResult(g,data){g.joker=g.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};g.joker.locked=true;const reportedCount=Number(data?.submission_count||data?.resolution_submission_count||0);if(reportedCount>0)g.joker.resolutionSubmissionCount=reportedCount;if(reportedCount>1)openMultiJokerDialog(g,reportedCount);const jokerEnabled=feature('feature.joker'),type=jokerEnabled?(data?.accepted_joker_type||null):null,pid=jokerEnabled?(data?.accepted_participant_id||null):null,target=jokerEnabled?(data?.target_participant_id||null):null;if(type&&pid){const accepted=(g.joker.submissions||[]).find(s=>s.participantId===pid&&s.type===type)||{participantId:pid,type,targetParticipantId:target,status:'ACCEPTED',isBot:false};accepted.status='ACCEPTED';accepted.targetParticipantId=target||accepted.targetParticipantId||null;g.joker.accepted=accepted;g.joker.revealed=jokerRevealPolicy(type)==='ACTION';g.joker.revealAcknowledged=g.joker.revealed;(g.joker.submissions||[]).forEach(s=>{if(s!==accepted&&s.status==='PENDING')s.status='REJECTED'});if(state.jokers[pid]?.[type])state.jokers[pid][type]='CONSUMED';addAudit(g.joker.revealed?('JOKER ACCEPTED · '+teamName(participant(pid))+' · '+type):('SECRET JOKER ACCEPTED · '+g.name))}else{(g.joker.submissions||[]).forEach(s=>{if(s.status==='PENDING')s.status='REJECTED'});g.joker.accepted=null;g.joker.revealed=false;g.joker.revealAcknowledged=true}
 const waiting=(data?.joker_resolution_state==='WAITING_FOR_PICK'&&type==='PICK_OPPONENT'&&!target);g.joker.awaitingPick=waiting;g.joker.resolved=!waiting;if(waiting){closeMultiJokerDialog();g.phase='PREPARING';addAudit('JOKER PREPARING · WARTET AUF PICK OPPONENT · '+g.name);startJokerResolutionPolling(g);renderAll();saveSoon();return false}if(target&&g.joker.accepted)g.joker.accepted.targetParticipantId=target;closeMultiJokerDialog();finishJokerPreparation(g);return true}
function fallbackResolvePlannedJokers(g){const subs=feature('feature.joker')?[...(g.joker?.submissions||[])]:[];if(subs.length>1){g.joker.resolutionSubmissionCount=subs.length;openMultiJokerDialog(g,subs.length)}let accepted=null;if(subs.length===1)accepted=subs[0];else if(subs.length>1)accepted=subs[hash(g.game_id+'|JOKER')%subs.length];subs.forEach(s=>s.status=s===accepted?'ACCEPTED':'REJECTED');g.joker.submissions=subs;g.joker.accepted=accepted||null;g.joker.locked=true;g.joker.revealed=accepted?jokerRevealPolicy(accepted.type)==='ACTION':false;g.joker.revealAcknowledged=!accepted||g.joker.revealed;if(accepted&&state.jokers[accepted.participantId]?.[accepted.type])state.jokers[accepted.participantId][accepted.type]='CONSUMED';if(accepted?.type==='PICK_OPPONENT'&&!accepted.targetParticipantId){closeMultiJokerDialog();g.joker.awaitingPick=true;g.joker.resolved=false;g.phase='PREPARING';return false}g.joker.resolved=true;g.joker.awaitingPick=false;closeMultiJokerDialog();finishJokerPreparation(g);return true}
async function preparePlannedGame(g){if(!g||g!==gameNow()||g.phase!=='PLANNED')return false;const knownJokerCount=knownPendingJokerCount(g);if(knownJokerCount>1)openMultiJokerDialog(g,knownJokerCount);g.phase='PREPARING';g.joker=g.joker||{submissions:[],accepted:null,resolved:false,locked:false,awaitingPick:false};g.joker.locked=true;renderAll();saveSoon();if(client&&g.tournament_game_id&&isAdmin()){try{const {data,error}=await client.rpc('prepare_tournament_game',{p_tournament_game_id:g.tournament_game_id});if(error)throw error;applyPreparedJokerResult(g,data||{});await refreshServerJokerBoard();return true}catch(e){console.warn('Server prepare transition returned an error',e);try{const {data}=await client.rpc('get_tournament_game_joker_state',{p_tournament_game_id:g.tournament_game_id});if(data&&data.status==='PREPARING'){applyPreparedJokerResult(g,data);await refreshServerJokerBoard();return true}}catch(_){}}}return fallbackResolvePlannedJokers(g)}
function finishJokerPreparation(g){if(!feature('feature.joker')&&g?.joker){g.joker.accepted=null;g.joker.submissions=[];g.joker.locked=true;}g.joker.awaitingPick=false;g.joker.resolved=true;if(jokerPollTimer){clearInterval(jokerPollTimer);jokerPollTimer=0}buildMatchesForGame(g);if(currentPage==='matchDetail'&&g===gameNow()&&matchNow())selectedMatchDetailId=matchNow().id;renderAll();saveSoon()}
function startJokerResolutionPolling(g){if(!client||!g?.tournament_game_id||jokerPollTimer)return;jokerPollTimer=setInterval(async()=>{try{const {data,error}=await client.rpc('get_tournament_game_joker_state',{p_tournament_game_id:g.tournament_game_id});if(error)return;const reportedCount=Number(data?.submission_count||0);if(reportedCount>0)g.joker.resolutionSubmissionCount=reportedCount;if(reportedCount>1)openMultiJokerDialog(g,reportedCount);if(data?.joker_resolution_state==='WAITING_FOR_PICK'){g.phase='PREPARING';g.joker.awaitingPick=true;return}if(data?.joker_resolution_state==='RESOLVED'){if(data.accepted_joker_type&&data.accepted_participant_id){g.joker.accepted=g.joker.accepted||{participantId:data.accepted_participant_id,type:data.accepted_joker_type,status:'ACCEPTED',isBot:false};g.joker.accepted.participantId=data.accepted_participant_id;g.joker.accepted.type=data.accepted_joker_type;g.joker.revealed=jokerRevealPolicy(data.accepted_joker_type)==='ACTION';g.joker.revealAcknowledged=g.joker.revealed;if(data.target_participant_id)g.joker.accepted.targetParticipantId=data.target_participant_id}finishJokerPreparation(g);await refreshServerJokerBoard(false)}}catch(_){ }},1400)}
async function confirmJokerOpponent(){if(!feature('feature.joker'))return false;
 const pp=serverJokerBoard?.pending_pick,g=(state.games||[]).find(x=>x.tournament_game_id===(pendingPickDialogGameId||pp?.tournament_game_id))||gameNow(),p=userParticipant(),overlay=q('#v1536PickOpponentOverlay'),confirm=q('#v1536PickConfirm');
 if(!g||g.phase!=='PREPARING'||!g.joker?.awaitingPick||g.joker?.accepted?.participantId!==p?.id||!selectedJokerTarget)return false;const targetId=selectedJokerTarget;if(confirm){confirm.disabled=true;confirm.classList.remove('ready');confirm.textContent='WIRD GESPEICHERT…'}
 if(client&&g.tournament_game_id){try{const {data,error}=await client.rpc('select_joker_opponent',{p_tournament_game_id:g.tournament_game_id,p_target_participant_id:targetId});if(error)throw error;if(data?.target_participant_id)g.joker.accepted.targetParticipantId=data.target_participant_id}catch(e){console.warn(e);setText('#jokerFeedback','GEGNERWAHL KONNTE NICHT GESPEICHERT WERDEN · '+String(e?.message||e));if(confirm){confirm.disabled=false;confirm.classList.add('ready');confirm.textContent='AUSWAHL BESTÄTIGEN'}return false}}
 if(!g.joker.accepted.targetParticipantId)g.joker.accepted.targetParticipantId=targetId;selectedJokerTarget=null;finishJokerPreparation(g);await refreshServerJokerBoard(false);pendingPickDialogGameId=null;if(overlay){overlay.classList.add('confirming');setTimeout(()=>{overlay.hidden=true;overlay.className='v1536-pick-overlay';const c=q('#v1536PickChoices');if(c)c.hidden=true},420)}renderAll();saveSoon();return true
}

function closeJokerDialog(){const d=q('#v1510JokerDialog');if(d)d.hidden=true;jokerDialogMode=null}
function openJokerConfirmation(){if(!feature('feature.joker'))return false;
 const g=state.games?.[selectedJokerGameIndex],p=userParticipant();if(!g||!p||g.phase!=='PLANNED'||!selectedJokerType)return;
 const d=q('#v1510JokerDialog'),card=q('.v1510-joker-dialog-card',d);if(!d||!card)return;
 jokerDialogMode='confirm';jokerDialogMeta={type:selectedJokerType,gameIndex:selectedJokerGameIndex,gameName:g.name};
 card.classList.remove('is-success');setText('#v1510JokerDialogKicker','JOKER BESTÄTIGEN');setText('#v1510JokerDialogTitle','JOKER EINSETZEN?');
 setText('#v1510JokerDialogCopy','Der Joker wird für dieses PLANNED Game eingereicht. Du kannst ihn bis zur Spielvorbereitung wieder zurückziehen oder auf ein anderes geplantes Game verschieben.');
 const sum=q('#v1510JokerDialogSummary');if(sum)sum.innerHTML=`<b>${esc(jokerTypeLabel(selectedJokerType))}</b><br>${String(selectedJokerGameIndex+1).padStart(2,'0')} · ${esc(g.name)}<br><small>NUR EIN AKZEPTIERTER JOKER WIRD VERBRAUCHT.</small>`;
 const cancel=q('#v1510JokerDialogCancel');if(cancel)cancel.textContent='ABBRECHEN';const confirm=q('#v1510JokerDialogConfirm');if(confirm){confirm.hidden=false;confirm.disabled=false;confirm.textContent='JOKER EINSETZEN'}d.hidden=false
}
function showJokerSuccess(){
 const meta=jokerDialogMeta,d=q('#v1510JokerDialog'),card=q('.v1510-joker-dialog-card',d);if(!d||!card||!meta)return;
 jokerDialogMode='success';card.classList.add('is-success');setText('#v1510JokerDialogKicker','GESPEICHERT');setText('#v1510JokerDialogTitle','JOKER GESETZT');
 setText('#v1510JokerDialogCopy','Deine Submission ist gespeichert. Sie wird erst ausgewertet, wenn dieses Game von PLANNED in PREPARING wechselt.');
 const sum=q('#v1510JokerDialogSummary');if(sum)sum.innerHTML=`<b>${esc(jokerTypeLabel(meta.type))}</b><br>${String(meta.gameIndex+1).padStart(2,'0')} · ${esc(meta.gameName)}<br><small>STATUS · EINGEREICHT</small>`;
 const cancel=q('#v1510JokerDialogCancel');if(cancel)cancel.textContent='VERSTANDEN';const confirm=q('#v1510JokerDialogConfirm');if(confirm)confirm.hidden=true;d.hidden=false
}
async function startMatch(){
 const g=gameNow(),m=matchNow();if(!g||!m)return false;
 if(feature('feature.betting')&&serverBettingApplies())await refreshServerBettingState(g,m);
 if(!feature('feature.betting')&&m.status==='BETTING_OPEN')m.status='READY';
 syncBettingGateStatus(m);
 if(m.status!=='BETTING_OPEN'&&m.status!=='READY'){showFlowToast('MATCH','START NICHT MÖGLICH','MATCHSTATUS · '+String(m.status||'UNBEKANNT'),2600);return false}
 if(!gateComplete(m)){showFlowToast('MATCH','BETTING NOCH OFFEN','ALLE PLAYER MÜSSEN WETTEN ODER ÜBERSPRINGEN.',2600);return false}
 if(!isAdmin()){showFlowToast('MATCH','ADMIN ERFORDERLICH','NUR DER TURNIER-ADMIN KANN DEN MATCH STARTEN.',2600);return false}
 if(client&&g.tournament_game_id){
   const {data,error}=await client.rpc('activate_tournament_game',{p_tournament_game_id:g.tournament_game_id});
   if(error){console.warn('Server game activation failed',error);showFlowToast('MATCH','START FEHLGESCHLAGEN',String(error.message||error),3600);return false}
   if(data?.status!=='ACTIVE'){showFlowToast('MATCH','START NICHT BESTÄTIGT','SERVERSTATUS · '+String(data?.status||'UNBEKANNT'),3200);return false}
 }
 m.status='LIVE';g.phase='ACTIVE';inlineResultMatchId=null;addAudit('MATCH STARTED · '+g.name+' · '+stageLabel(m.stage));renderAll();saveSoon();showFlowToast('MATCH','MATCH GESTARTET',String(g.name||'GAME').toUpperCase(),2200);setTimeout(()=>{window.skielsenInApp?.start?.(runtime);window.skielsenInApp?.poll?.()},0);return true
}
function autofillScore(){const m=matchNow();if(!m)return;const a=3+(hash(m.id+'A')%8),b=2+(hash(m.id+'B')%8);let aa=a,bb=b;if(aa===bb)aa++;const ia=q('#quickResultA'),ib=q('#quickResultB');if(ia)ia.value=aa;if(ib)ib.value=bb;syncQuickResultButton()}
function syncQuickResultButton(){const sel=gameControlSelection(),m=sel.m,a=Number(q('#quickResultA')?.value),b=Number(q('#quickResultB')?.value);const ok=sel.isCurrent&&m?.status==='LIVE'&&Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>=0&&a!==b;setHoldLabel(q('#quickResultConfirm'),'ERGEBNIS BESTÄTIGEN',!ok)}

function ffaPlacementValues(page=document){return qa('[data-v15-ffa-place]',page).map(sel=>({participantId:sel.dataset.v15FfaPlace,place:Number(sel.value)}))}
function ffaPlacementValid(page=document){const m=matchNow(),vals=ffaPlacementValues(page);if(!isSharedContestMatch(m)||m.status!=='LIVE'||vals.length!==(m.participantIds||[]).length)return false;const n=vals.length,places=vals.map(x=>x.place);return places.every(x=>Number.isInteger(x)&&x>=1&&x<=n)&&new Set(places).size===n}
function concludeFreeForAll(){const m=matchNow(),page=q('#gameControlPage');if(!m||!isSharedContestMatch(m)||!ffaPlacementValid(page))return false;const placements=ffaPlacementValues(page).sort((a,b)=>a.place-b.place).map(x=>x.participantId);return concludeSharedPlacements(placements,'GAME CONTROL PLACEMENT')}
function ensureFfaControlUi(page){
 let roster=q('#v15FfaControlRoster',page);if(!roster){roster=document.createElement('div');roster.id='v15FfaControlRoster';roster.className='v15-ffa-control-roster';const gate=q('#prototypeControlBetGate',page);gate?.parentNode?.insertBefore(roster,gate)}
 let panel=q('#v15FfaResultPanel',page);if(!panel){panel=document.createElement('section');panel.id='v15FfaResultPanel';panel.className='utility-panel v15-ffa-result-panel';const quick=q('.quick-result-panel',page);quick?.parentNode?.insertBefore(panel,quick?.nextSibling||null)}
 return {roster,panel};
}
function renderFfaGameControl(g,m,page){
 const {roster,panel}=ensureFfaControlUi(page),ps=freeForAllRoster(m),quick=q('.quick-result-panel',page);if(quick)quick.hidden=true;if(roster)roster.hidden=true;
 const snap=feature('feature.betting')?freezeOdds(m,g):null,decided=Object.keys(state.betDecisions[m.id]||{}).length;setText('#prototypeControlBetTitle',feature('feature.betting')?`MULTI BETTING · ${decided}/${activeActorIds().length} ENTSCHIEDEN`:'BETTING AUS');setText('#prototypeControlBetCopy',feature('feature.betting')?`Mehrwege-Markt mit ${snapshotSelections(snap).length} Participants · Quoten beim Öffnen eingefroren.`:'Betting ist für dieses Turnier deaktiviert.');
 if(!panel)return;panel.hidden=false;
 if(m.status!=='LIVE'){
   panel.innerHTML=`<div class="utility-head"><h2>ENDERGEBNIS</h2><small>GAME CONTROL</small></div><div class="v1514-auto-state"><strong>${m.status==='CONCLUDED'?'ERGEBNIS GESPEICHERT':'NOCH NICHT FREIGEGEBEN'}</strong><span>${m.status==='CONCLUDED'?`BETTING ABGERECHNET · DEIN GUTHABEN ${fmt(currentWallet())} COINS`:'Die Ergebnisauswahl wird hier freigeschaltet, sobald das Game LIVE ist.'}</span></div>`;return
 }
 const mode=resultEntryMode(g,m);
 if(mode==='METRIC'){
   const unit=metricUnitLabel(g),step=['STROKES','LINK_COUNT','PRIZE_LEVEL','POINTS'].includes(resultType(g))?'1':'any';
   panel.innerHTML=`<div class="utility-head"><h2>ENDERGEBNIS · ${esc(unit)}</h2><small>4-PLAYER · GAME CONTROL</small></div><p class="v1514-entry-kicker">${metricLowerWins(g)?'NIEDRIGSTER WERT GEWINNT':'HÖCHSTER WERT GEWINNT'} · ALLE WERTE DIREKT HIER EINTRAGEN. GLEICHSTÄNDE MÜSSEN VORHER NACH DER GAMESPEZIFISCHEN TIEBREAK-REGEL AUFGELÖST WERDEN.</p><div class="v1514-metric-grid">${ps.map(p=>`<label class="v1514-metric-row"><span><i class="${marker(p.color)}"></i>${esc(p.name)}</span><input type="number" step="${step}" min="0" inputmode="decimal" data-v1532-control-metric="${esc(p.id)}" placeholder="${esc(unit)}"></label>`).join('')}</div><button class="quick-result-confirm" id="v1532ControlMetricConfirm" type="button" disabled>ENDERGEBNIS BESTÄTIGEN</button><p class="admin-inline-feedback" id="v1532ControlFeedback"></p>`;
   const sync=()=>{const vals=qa('[data-v1532-control-metric]',panel),ok=vals.length===ps.length&&vals.every(x=>x.value!==''&&Number.isFinite(Number(x.value)));const b=q('#v1532ControlMetricConfirm',panel);if(b)b.disabled=!ok};qa('[data-v1532-control-metric]',panel).forEach(x=>x.addEventListener('input',sync));q('#v1532ControlMetricConfirm',panel)?.addEventListener('click',()=>{const values=Object.fromEntries(qa('[data-v1532-control-metric]',panel).map(x=>[x.dataset.v1532ControlMetric,Number(x.value)]));concludeSharedMetrics(values)});return
 }
 m.resultDraft=m.resultDraft||{};const picked=Array.isArray(m.resultDraft.placements)?m.resultDraft.placements.filter(id=>(m.participantIds||[]).includes(id)):[];m.resultDraft.placements=picked;const remaining=ps.filter(p=>!picked.includes(p.id)),nextPlace=picked.length+1;
 if(remaining.length===1&&picked.length===ps.length-1){const final=[...picked,remaining[0].id];m.resultDraft.placements=[];concludeSharedPlacements(final,'GAME CONTROL PLACEMENT');return}
 panel.innerHTML=`<div class="utility-head"><h2>ENDERGEBNIS · PLATZIERUNG</h2><small>4-PLAYER · GAME CONTROL</small></div><div class="v1514-placement-step"><p class="v1514-entry-kicker">PLATZIERUNG NACHEINANDER ANTIPPEN. DER LETZTE VERBLEIBENDE PARTICIPANT WIRD AUTOMATISCH AUF PLATZ ${ps.length} GESETZT.</p>${picked.length?`<div class="v1514-place-picked">${picked.map((id,i)=>`<span>${i+1}. ${esc(teamName(participant(id)))}</span>`).join('')}</div>`:''}<h4>WER WURDE ${nextPlace}.?</h4><div class="v1514-place-grid">${remaining.map(p=>`<button class="v1514-place-btn" type="button" data-v1532-control-place="${esc(p.id)}"><i class="${marker(p.color)}"></i><span><strong>${esc(p.name)}</strong><small>PLATZ ${nextPlace}</small></span></button>`).join('')}</div>${picked.length?'<button class="v1514-place-undo" id="v1532ControlPlaceUndo" type="button">LETZTE AUSWAHL ZURÜCK</button>':''}</div>`;
 qa('[data-v1532-control-place]',panel).forEach(btn=>btn.addEventListener('click',()=>{m.resultDraft.placements.push(btn.dataset.v1532ControlPlace);renderGameControl()}));q('#v1532ControlPlaceUndo',panel)?.addEventListener('click',()=>{m.resultDraft.placements.pop();renderGameControl()})
}
function clearFfaGameControl(page){const quick=q('.quick-result-panel',page),roster=q('#v15FfaControlRoster',page),panel=q('#v15FfaResultPanel',page);if(quick)quick.hidden=false;if(roster)roster.hidden=true;if(panel)panel.hidden=true}


function participantOrderForDisplay(list){const order=String(runtime?.mode).toUpperCase()==='TEAM'?TEAM_ORDER:SOLO_ORDER;return [...list].sort((a,b)=>order.indexOf(a?.color)-order.indexOf(b?.color))}
function gameIndexOf(g){return Math.max(0,(state.games||[]).indexOf(g))}
function matchResultForParticipant(m,p){if(!p)return '—';if(Array.isArray(m?.placements)){const ix=m.placements.indexOf(p.id);if(ix>=0)return m.values&&m.values[p.id]!=null?`${ix+1}. · ${fmt(m.values[p.id])}`:`${ix+1}.`;return '—'}if(m?.status==='CONCLUDED'){if(m.a===p.id)return m.scoreA??'—';if(m.b===p.id)return m.scoreB??'—'}return '—'}
function matchStatusMarkup(m,g){const provisional=g?.phase==='PLANNED'||(g?.phase==='PREPARING'&&g?.joker?.awaitingPick);const txt=provisional?(g?.joker?.awaitingPick?'WARTET AUF JOKER':'VORLÄUFIG'):statusLabel(m?.status);const cls=m?.status==='LIVE'?'is-live':m?.status==='BETTING_OPEN'?'is-betting':'';return `<span class="v20-match-status ${cls}">${esc(txt)}</span>`}
function compactMatchInner(m,g,gi){
 const title=`<div class="v20-match-title"><strong>${String(gi+1).padStart(2,'0')}</strong><span class="dot">·</span><strong>${esc(g?.name||'MATCH')}</strong></div>`;
 const ids=marketParticipantIds(m),isShared=isSharedContestMatch(m);
 if(isShared){
   const roster=participantOrderForDisplay(ids.map(participant).filter(Boolean));
   if(roster.length===4){
     const slots=[...roster];const team=(p,side)=>`<div class="v20-ffa-team ${side}">${side==='right'?`<b class="v20-ffa-score">${esc(matchResultForParticipant(m,p))}</b>`:''}<div class="v20-ffa-name ${side==='right'?'right':''}">${side==='left'?`<i class="${marker(p?.color)}"></i>`:''}<strong>${esc(p?.name||'—')}</strong>${side==='right'?`<i class="${marker(p?.color)}"></i>`:''}</div>${side==='left'?`<b class="v20-ffa-score">${esc(matchResultForParticipant(m,p))}</b>`:''}</div>`;
     return `<header class="v20-match-head">${title}${matchStatusMarkup(m,g)}</header><div class="v20-compact-body"><div class="v20-ffa-wrap"><div class="v20-ffa-grid">${team(slots[0],'left')}${team(slots[1],'right')}${team(slots[2],'left')}${team(slots[3],'right')}<div class="v20-ffa-crosshair"></div><div class="v20-ffa-vs">VS</div></div></div></div>`;
   }
   if(roster.length===2){
     const row=p=>`<div class="v20-duel-row"><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||'—')}</strong><span>${esc(matchResultForParticipant(m,p))}</span></div>`;
     return `<header class="v20-match-head">${title}${matchStatusMarkup(m,g)}</header><div class="v20-compact-body"><div class="v20-duel-stage">${esc(stageLabel(m?.stage))}</div><div class="v20-duel-rows">${roster.map(row).join('')}</div></div>`;
   }
   const row=p=>`<div class="v20-shared-row"><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||'—')}</strong><b>${esc(matchResultForParticipant(m,p))}</b></div>`;
   return `<header class="v20-match-head">${title}${matchStatusMarkup(m,g)}</header><div class="v20-compact-body"><div class="v20-duel-stage">${esc(stageLabel(m?.stage))}</div><div class="v20-shared-list">${roster.map(row).join('')}</div></div>`;
 }
 const provisional=g?.phase==='PLANNED'||(g?.phase==='PREPARING'&&g?.joker?.awaitingPick),a=!provisional&&m?.a?participant(m.a):null,b=!provisional&&m?.b?participant(m.b):null;
 const row=(p,id,placeholder)=>`<div class="v20-duel-row ${p?'':'unresolved'}"><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||(provisional?'NOCH OFFEN':placeholder||'TBD'))}</strong><span>${esc(matchResultForParticipant(m,p||{id}))}</span></div>`;
 return `<header class="v20-match-head">${title}${matchStatusMarkup(m,g)}</header><div class="v20-compact-body"><div class="v20-duel-stage">${esc(stageLabel(m?.stage))}</div><div class="v20-duel-rows">${row(a,m?.a,m?.placeholderA)}${row(b,m?.b,m?.placeholderB)}</div></div>`
}
function compactMatchMarkup(m,g,gi,extra=''){return `<article tabindex="0" role="button" data-v15-match="${esc(m.id)}" class="match-card v20-compact-match ${extra}">${compactMatchInner(m,g,gi)}</article>`}
function largePairingMarkup(m,g){
 const ids=marketParticipantIds(m),isShared=isSharedContestMatch(m);
 if(isShared){
   const roster=participantOrderForDisplay(ids.map(participant).filter(Boolean));
   if(roster.length===4){
     const team=(p,side)=>`<div class="v20-ffa-team ${side}">${side==='right'?`<b class="v20-ffa-score">${esc(matchResultForParticipant(m,p))}</b>`:''}<div class="v20-ffa-name ${side==='right'?'right':''}">${side==='left'?`<i class="${marker(p?.color)}"></i>`:''}<strong>${esc(p?.name||'—')}</strong>${side==='right'?`<i class="${marker(p?.color)}"></i>`:''}</div>${side==='left'?`<b class="v20-ffa-score">${esc(matchResultForParticipant(m,p))}</b>`:''}</div>`;
     return `<div class="v20-large-pairing v20-large-ffa"><div class="v20-ffa-grid">${team(roster[0],'left')}${team(roster[1],'right')}${team(roster[2],'left')}${team(roster[3],'right')}<div class="v20-ffa-crosshair"></div><div class="v20-ffa-vs">VS</div></div></div>`;
   }
   if(roster.length===2){
     const a=roster[0],b=roster[1];
     const side=(p,right=false)=>`<div class="v20-large-side ${right?'right':''}">${right?'':`<i class="${marker(p?.color)}"></i>`}<div><strong>${esc(p?.name||'—')}</strong></div>${right?`<i class="${marker(p?.color)}"></i>`:''}</div>`;
     return `<div class="v20-large-pairing v20-large-duel">${side(a,false)}<div class="v20-large-center"><b>VS</b></div>${side(b,true)}</div>`;
   }
   const row=p=>`<div class="v20-shared-row"><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||'—')}</strong><b>${esc(matchResultForParticipant(m,p))}</b></div>`;
   return `<div class="v20-large-pairing v20-large-shared-list">${roster.map(row).join('')}</div>`;
 }
 const provisional=g?.phase==='PLANNED'||g?.phase==='PREPARING';
 const a=!provisional&&m?.a?participant(m.a):null,b=!provisional&&m?.b?participant(m.b):null;
 const side=(p,placeholder,right=false)=>`<div class="v20-large-side ${right?'right':''}">${right?'':`<i class="${marker(p?.color)}"></i>`}<div><strong>${esc(p?.name||(provisional?'NOCH OFFEN':placeholder||'TBD'))}</strong></div>${right?`<i class="${marker(p?.color)}"></i>`:''}</div>`;
 return `<div class="v20-large-pairing v20-large-duel">${side(a,m?.placeholderA,false)}<div class="v20-large-center"><b>VS</b></div>${side(b,m?.placeholderB,true)}</div>`
}
function historyIncludesParticipant(h,pid){return h?.a===pid||h?.b===pid||(h?.participantIds||[]).includes(pid)}
function historyOutcome(h,pid){if(Array.isArray(h?.placements)){const ix=h.placements.indexOf(pid);return ix>=0?{label:`PLATZ ${ix+1}`,win:ix===0,loss:ix===h.placements.length-1}:null}if(h?.a===pid||h?.b===pid){const own=h.a===pid?Number(h.scoreA):Number(h.scoreB),opp=h.a===pid?Number(h.scoreB):Number(h.scoreA);return {label:`${fmt(own)} : ${fmt(opp)}`,win:own>opp,loss:own<opp}}return null}
function historyRowMarkup(h,{perspectivePid=null,openMatch=null,game=null}={}){
 const isOpen=!!openMatch,m=openMatch||h,g=game||(state.games||[]).find(x=>x.name===h?.game),name=g?.name||h?.game||'MATCH',stage=stageLabel(m?.stage),a=m?.a?participant(m.a):null,b=m?.b?participant(m.b):null;let left=a,right=b,result='—',cls=isOpen?'is-open':'';
 if(isSharedContestMatch(m)){const ids=m.participantIds||h?.participantIds||[],out=perspectivePid?historyOutcome(h,perspectivePid):null;result=isOpen?statusLabel(m.status):(out?.label||'ERGEBNIS');if(ids.length===2){left=perspectivePid?participant(perspectivePid):participant(ids[0]);const otherId=ids.find(id=>id!==left?.id)||ids[1];right=participant(otherId);return `<div class="v20-history-row ${cls} ${out?.win?'is-win':out?.loss?'is-loss':''}" ${isOpen?`data-v15-match="${esc(m.id)}" role="button" tabindex="0"`:''}><div class="v20-history-meta"><small>${esc(stage)}</small><strong>${esc(name)}</strong><span>${esc(isOpen?'AKTUELLES TURNIER':h?.at||'')}</span></div><div class="v20-history-pair"><span><i class="${marker(left?.color)}"></i>${esc(left?.name||'—')}</span><b>VS</b><span>${esc(right?.name||'—')}<i class="${marker(right?.color)}"></i></span></div><div class="v20-history-result"><strong>${esc(result)}</strong><small>${isOpen?esc(statusLabel(m.status)):'FINAL'}</small></div></div>`}left=perspectivePid?participant(perspectivePid):participant(ids[0]);const count=ids.length;return `<div class="v20-history-row ${cls} ${out?.win?'is-win':out?.loss?'is-loss':''}" ${isOpen?`data-v15-match="${esc(m.id)}" role="button" tabindex="0"`:''}><div class="v20-history-meta"><small>${esc(stage)}</small><strong>${esc(name)}</strong><span>${esc(isOpen?'AKTUELLES TURNIER':h?.at||'')}</span></div><div class="v20-history-pair"><span><i class="${marker(left?.color)}"></i>${esc(left?.name||'—')}</span><b>+</b><span>${count} TEILNEHMER</span></div><div class="v20-history-result"><strong>${esc(result)}</strong><small>${isOpen?esc(statusLabel(m.status)):'FINAL'}</small></div></div>`}
 if(perspectivePid&&a&&b&&a.id!==perspectivePid&&b.id===perspectivePid){left=b;right=a}
 const out=perspectivePid?historyOutcome(h,perspectivePid):null;result=isOpen?statusLabel(m.status):(h?.scoreA!=null&&h?.scoreB!=null?`${fmt(h.scoreA)} : ${fmt(h.scoreB)}`:'FINAL');if(out&&!isOpen)result=out.label;cls+=' '+(out?.win?'is-win':out?.loss?'is-loss':'');return `<div class="v20-history-row ${cls}" ${isOpen?`data-v15-match="${esc(m.id)}" role="button" tabindex="0"`:''}><div class="v20-history-meta"><small>${esc(stage)}</small><strong>${esc(name)}</strong><span>${esc(isOpen?'AKTUELLES TURNIER':h?.at||'')}</span></div><div class="v20-history-pair"><span><i class="${marker(left?.color)}"></i>${esc(left?.name||m?.placeholderA||'TBD')}</span><b>VS</b><span>${esc(right?.name||m?.placeholderB||'TBD')}<i class="${marker(right?.color)}"></i></span></div><div class="v20-history-result"><strong>${esc(result)}</strong><small>${isOpen?esc(statusLabel(m.status)):'FINAL'}</small></div></div>`
}
function renderMatchDetailHistory(m,g){const h2h=q('#h2hDisclosure'),past=q('#pastMatchesDisclosure');if(!h2h||!past)return;const provisional=g?.phase==='PLANNED'||g?.phase==='PREPARING';const shared=provisional||isSharedContestMatch(m)||!m?.a||!m?.b;if(shared){h2h.hidden=true;past.hidden=true;return}h2h.hidden=false;past.hidden=false;const pairHist=state.matchHistory.filter(h=>!isSharedContestMatch(h)&&((h.a===m.a&&h.b===m.b)||(h.a===m.b&&h.b===m.a)));const aw=pairHist.filter(h=>h.winner===m.a).length,bw=pairHist.filter(h=>h.winner===m.b).length;setText('#v20H2HSummary',`${teamName(participant(m.a))} ${aw} : ${bw} ${teamName(participant(m.b))}`);const hh=q('#v20H2HRows');if(hh)hh.innerHTML=pairHist.slice(0,8).map(h=>historyRowMarkup(h)).join('')||'<div class="v20-empty">NOCH KEINE DIREKTEN DUELLE IM AKTUELLEN TURNIER.</div>';const form=q('#v20FormRows');if(form)form.innerHTML=[m.a,m.b].map(pid=>{const p=participant(pid),rows=state.matchHistory.filter(h=>historyIncludesParticipant(h,pid)).slice(0,5);return `<section class="v20-form-column"><header><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||'TEILNEHMER')}</strong></header>${rows.map(h=>historyRowMarkup(h,{perspectivePid:pid})).join('')||'<div class="v20-empty">NOCH KEINE ABGESCHLOSSENEN MATCHES.</div>'}</section>`}).join('')}
function participantCommunityGameStrength(pid,g){const p=participant(pid),w=gameWeights(g),den=w.reduce((a,[,v])=>a+v,0)||1;if(!p?.actorIds?.length)return 50;return w.reduce((sum,[sid,weight])=>{const avg=p.actorIds.reduce((a,id)=>a+Number(state.ratings?.[id]?.[sid]?.community??50),0)/p.actorIds.length;return sum+avg*weight},0)/den}
function participantGameConfidence(pid,g){const p=participant(pid),w=gameWeights(g),den=w.reduce((a,[,v])=>a+v,0)||1;if(!p?.actorIds?.length)return 0;return w.reduce((sum,[sid,weight])=>{const avg=p.actorIds.reduce((a,id)=>a+Number(state.ratings?.[id]?.[sid]?.confidence??0),0)/p.actorIds.length;return sum+avg*weight},0)/den}
function rankingsSorted(){return state.participants.map(p=>({p,r:state.rankings[p.id]})).sort((a,b)=>b.r.points-a.r.points||b.r.first-a.r.first||a.p.name.localeCompare(b.p.name,'de'))}
function renderHome(){
 const g=gameNow(),m=matchNow(),up=userParticipant(),ua=userActor(),hero=q('#homePage .home-dashboard-hero');
 if(hero){setText('h1',runtime.name||'SKIELSEN CUP',hero);setText('p',state.tournamentDone?'TURNIER ABGESCHLOSSEN':g?`GAME ${String(state.currentGameIndex+1).padStart(2,'0')} / ${String(state.games.length).padStart(2,'0')} · ${g.name}`:'KEIN GAME');const pe=q('.home-player-entry strong',hero);if(pe)pe.textContent=(ua?.name||'PLAYER').toUpperCase()+' · '+(up?.name||'');const av=q('.home-player-avatar',hero);if(av)av.textContent=initials(ua?.name)}
 const nm=q('#homePage .home-next-match');if(nm){const head=q('.home-module-head small',nm);if(head)head.textContent=m?statusLabel(m.status):(g?.phase||'—');const card=q('.home-match-card',nm);if(card){if(m&&g){card.hidden=false;card.classList.add('v20-compact-match');card.dataset.v15Match=m.id;card.innerHTML=compactMatchInner(m,g,state.currentGameIndex)}else{card.hidden=true;card.removeAttribute('data-v15-match');card.innerHTML=''}}}
 const bet=q('#homeBetAction'),joker=q('#homeJokerAction'),mvp=q('#homeMvpAction'),d=userBetDecision();if(bet){bet.hidden=!(m?.status==='BETTING_OPEN'&&feature('feature.betting')&&!d);bet.classList.toggle('mandatory-open',!bet.hidden);bet.onclick=()=>{betReturnPage='home';show('bets')}}if(joker){const ownPick=g?.phase==='PREPARING'&&g?.joker?.awaitingPick&&g?.joker?.accepted?.participantId===state.userParticipantId&&g?.joker?.accepted?.type==='PICK_OPPONENT',hasPlanned=plannedJokerGames().length>0;joker.hidden=!(feature('feature.joker')&&(ownPick||hasPlanned));joker.classList.toggle('mandatory-open',!!ownPick);joker.onclick=()=>show('joker');const t=q('strong',joker);if(t)t.textContent=ownPick?'GEGNER WÄHLEN':'JOKER VERWALTEN';const p=q('p',joker);if(p)p.textContent=ownPick?(g?.name||'GAME')+' · Dein PICK OPPONENT Joker wurde akzeptiert.':plannedJokerGames().length+' geplante Games sind noch für Joker verfügbar.'}
 if(mvp){const need=!!(g?.vote&&!g.vote.finalized&&!g.vote.votes?.[state.userActorId]);mvp.hidden=!need;mvp.classList.toggle('mandatory-open',need);mvp.onclick=()=>show('mvpVote');q('strong',mvp).textContent=g?.vote?.type==='LVP'?`${g.name} LVP WÄHLEN`:`${g?.name||''} MVP WÄHLEN`;q('p',mvp).textContent=g?.vote?.type==='LVP'?'Stimme für einen anderen Player. Dein eigener Teampartner ist erlaubt.':'Stimme für einen Spieler außerhalb deines Teams.'}
 const open=[bet,mvp].filter(x=>x&&!x.hidden).length+((joker&&!joker.hidden&&joker.classList.contains('mandatory-open'))?1:0);setText('#homeOpenActionsCount',String(open));setText('#homeOpenActionsLabel',open?'OPEN ACTIONS':'ALLES ERLEDIGT');
 const stand=q('#homePage .home-standings');if(stand){const head=q('.home-module-head',stand);stand.innerHTML=(head?head.outerHTML:'')+rankingsSorted().map((x,i)=>`<div class="home-standing-row ${x.p.id===state.userParticipantId?'mine':''}"><b>${String(i+1).padStart(2,'0')}</b><i class="${marker(x.p.color)}"></i><span>${esc(x.p.name)}</span><strong>${fmt(x.r.points)}</strong></div>`).join('')}
 const story=q('#homePage .home-story');if(story){const n=state.news[0];q('small',story).textContent=n?`${n.type} · ${n.at}`:'SKIELSENSPORT';q('strong',story).textContent=n?.headline||'Noch kein Ergebnis im Turnier.'}
}
function tournamentUpcomingMatches(){
 const rows=[];
 (state.games||[]).forEach((g,gi)=>(g.matches||[]).forEach((m,mi)=>{if(m.status!=='CONCLUDED')rows.push({g,m,gi,mi})}));
 return rows.slice(0,5);
}
function renderMatches(){const page=q('#matchesPage');if(!page)return;const upcoming=tournamentUpcomingMatches();const recent=state.matchHistory.slice(0,8);const sections=qa('.match-section',page);if(sections[0]){const car=q('.match-carousel',sections[0]);if(car)car.innerHTML=upcoming.map(x=>matchCard(x.m,x.g,x.gi,x.mi)).join('')||'<p class="v15-empty">KEINE OFFENEN MATCHES.</p>'}if(sections[1]){const car=q('.match-carousel',sections[1]);if(car)car.innerHTML=recent.map(h=>historyCard(h)).join('')||'<p class="v15-empty">NOCH KEINE ERGEBNISSE.</p>'}const totalOpen=(state.games||[]).reduce((n,g)=>n+(g.matches||[]).filter(m=>m.status!=='CONCLUDED').length,0);const hero=q('.matches-hero p',page);if(hero)hero.textContent=`NÄCHSTE ${Math.min(5,totalOpen)} VON ${totalOpen} OFFENEN MATCHES · ${state.matchHistory.length} ABGESCHLOSSEN`}
function freeForAllRoster(m){return (m.participantIds||[]).map(id=>participant(id)).filter(Boolean)}
function matchCard(m,g,gi,mi){return compactMatchMarkup(m,g,gi,'')}
function historyCard(h){const gi=Math.max(0,(state.games||[]).findIndex(g=>g.name===h.game)),base=(state.games||[])[gi]||{name:h.game},g={...base,phase:'RESULTS'},m=Array.isArray(h.participantIds)?{...h,id:'history-'+gi+'-'+(h.at||''),status:'CONCLUDED'}:{...h,id:'history-'+gi+'-'+(h.at||''),status:'CONCLUDED'};return `<article class="match-card v20-compact-match" tabindex="0">${compactMatchInner(m,g,gi)}</article>`}
function resultType(g){return String(g?.result_type||'').toUpperCase()}
function trackerType(g){return String(g?.tracker_type||'').toUpperCase()}
function resultEntryMode(g,m){
 const tracker=trackerType(g),type=resultType(g);
 if(tracker==='IN_APP_NATIVE')return 'AUTO_IN_APP';
 if(tracker==='IN_APP_STOPWATCH'||tracker==='HYBRID')return 'SPECIAL_TRACKER';
 if(type==='WIN_LOSS')return 'WINNER';
 if(type==='PLACEMENT')return 'PLACEMENT';
 if(['POINTS','DISTANCE','TIME_MS','TIME_DEVIATION_MS','STROKES','LINK_COUNT','PRIZE_LEVEL'].includes(type))return 'METRIC';
 return tracker==='FINAL_ONLY'||tracker==='MANUAL_METRIC'||tracker==='EXTERNAL_WEB'?'METRIC':'SPECIAL_TRACKER';
}
function metricLowerWins(g){const type=resultType(g),rank=String(g?.rules_json?.ranking||'').toUpperCase();if(['TIME_MS','TIME_DEVIATION_MS','STROKES','LINK_COUNT'].includes(type))return true;if(rank.includes('LOWEST')||rank.includes('FASTEST'))return true;return false}
function metricUnitLabel(g){return ({POINTS:'PUNKTE',DISTANCE:'DISTANZ',TIME_MS:'ZEIT',TIME_DEVIATION_MS:'ABWEICHUNG',STROKES:'SCHLÄGE',LINK_COUNT:'LINKS',PRIZE_LEVEL:'LEVEL'}[resultType(g)]||resultType(g)||'WERT')}
function concludeSharedPlacements(placements,source='RESULT',values=null){
 const g=gameNow(),m=matchNow();if(!g||!m||!isSharedContestMatch(m)||m.status!=='LIVE'||!Array.isArray(placements)||placements.length!==(m.participantIds||[]).length)return false;
 if(new Set(placements).size!==placements.length||placements.some(id=>!(m.participantIds||[]).includes(id)))return false;
 m.placements=[...placements];m.values=values?{...values}:m.values||null;m.status='CONCLUDED';g.placements=[...placements];g.phase='RESULTS';const winnerId=placements[0];settleBets(m,winnerId);commitGamePlacementPoints(g);
 state.matchHistory.unshift({gameIndex:state.currentGameIndex,game:g.name,stage:m.stage,participantIds:[...(m.participantIds||[])],placements:[...placements],values:m.values?{...m.values}:null,winner:winnerId,at:nowLabel()});addAudit(source+' CONFIRMED · '+g.name+' · '+placements.map((pid,i)=>`${i+1}:${teamName(participant(pid))}`).join(' / '));
 const winSel=selectionSnapshot(state.oddsSnapshots[m.id],winnerId);if(winSel?.probability<.4)addNews('MULTI-PARTICIPANT UNDERDOG GEWINNT.',`${teamName(participant(winnerId))} gewinnt ${g.name} mit ${Math.round(winSel.probability*100)} % eingefrorener Siegchance.`,'UPSET');else addNews(`${teamName(participant(winnerId))} GEWINNT ${g.name.toUpperCase()}.`,placements.map((pid,i)=>`${i+1}. ${teamName(participant(pid))}`).join(' · '),'MATCH_REPORT');
 const knownSecret=feature('feature.joker')&&!!g.joker?.accepted&&isSecretJokerType(g.joker.accepted.type);if(knownSecret){g.joker.revealed=true;addAudit('JOKER REVEALED · '+teamName(participant(g.joker.accepted.participantId))+' · '+g.joker.accepted.type)}
 addAudit('SKIELSEN RATING · MULTI-PARTICIPANT-RATINGFORMEL NOCH NICHT FACHLICH DEFINIERT · KEIN TEST-DELTA ANGEWENDET');inlineResultMatchId=null;showResultPopup(m,g,winnerId,()=>continueCompletedGameFlow(g));renderAll();saveSoon();return true
}
function concludeSharedMetrics(values){const g=gameNow(),m=matchNow();if(!g||!m||!isSharedContestMatch(m)||m.status!=='LIVE')return false;const ids=[...(m.participantIds||[])];if(ids.some(id=>!Number.isFinite(Number(values?.[id]))))return false;const nums=ids.map(id=>({id,v:Number(values[id])}));if(new Set(nums.map(x=>x.v)).size!==nums.length){setText('#v1513InlineFeedback','GLEICHSTAND · BITTE DEN GAMESPEZIFISCHEN TIEBREAK AUSSPIELEN UND EINDEUTIGE ENDWERTE EINTRAGEN.');return false}nums.sort((a,b)=>metricLowerWins(g)?a.v-b.v:b.v-a.v);return concludeSharedPlacements(nums.map(x=>x.id),'INLINE '+metricUnitLabel(g),Object.fromEntries(nums.map(x=>[x.id,x.v])))}
function v1536OpenResultConfirm(pid,scoreA=null,scoreB=null){
 const p=participant(pid),modal=q('#v1536ResultConfirmModal');if(!p||!modal)return false;
 pendingUnifiedResult={pid,scoreA,scoreB};setText('#v1536ResultConfirmTeam',teamName(p));const bar=q('#v1536ResultConfirmBar');if(bar)bar.className=marker(p.color);
 const score=q('#v1536ResultConfirmScore');if(score){const explicit=scoreA!=null&&scoreB!=null;score.hidden=!explicit;if(explicit)setText('strong',`${Number(scoreA)} : ${Number(scoreB)}`,score)}
 modal.hidden=false;return true
}
function v1536CommitPendingResult(){const x=pendingUnifiedResult;if(!x)return false;pendingUnifiedResult=null;const modal=q('#v1536ResultConfirmModal');if(modal)modal.hidden=true;return concludeWinnerSelection(x.pid,x.scoreA,x.scoreB)}
function concludeWinnerSelection(pid,scoreA=null,scoreB=null){const m=matchNow();if(!m||m.status!=='LIVE'||![m.a,m.b].includes(pid))return false;if(scoreA==null||scoreB==null){scoreA=pid===m.a?1:0;scoreB=pid===m.b?1:0}return concludeCurrentMatch(scoreA,scoreB)}
function renderWinnerEntry(host,m,g){
 const a=participant(m.a),b=participant(m.b);if(!a||!b)return;
 host.innerHTML=`<div class="v1536-result-mode"><button class="active" type="button" data-v1536-result-mode="winner">SIEGER DIREKT WÄHLEN</button><button type="button" data-v1536-result-mode="score">ERGEBNIS EINTRAGEN</button></div>
 <div class="v1536-result-panel active" data-v1536-result-panel="winner"><div class="v1536-result-winner-grid">${[a,b].map(p=>`<button class="v1536-result-winner" type="button" data-v1536-result-winner="${esc(p.id)}"><i class="${marker(p.color)}"></i><span><strong>${esc(p.name)}</strong><small>ALS SIEGER AUSWÄHLEN</small></span></button>`).join('')}</div><div class="v1536-result-actions"><button class="v1536-result-confirm" type="button" data-v1536-confirm-winner disabled>SIEGER BESTÄTIGEN</button></div></div>
 <div class="v1536-result-panel" data-v1536-result-panel="score"><div class="v1536-score-grid"><div class="v1536-score-card"><div class="v1536-score-team"><i class="${marker(a.color)}"></i>${esc(a.name)}</div><input type="number" min="0" step="1" value="0" data-v1536-score="a"></div><div class="v1536-score-colon">:</div><div class="v1536-score-card"><div class="v1536-score-team"><i class="${marker(b.color)}"></i>${esc(b.name)}</div><input type="number" min="0" step="1" value="0" data-v1536-score="b"></div></div><div class="v1536-result-actions"><button class="v1536-result-confirm" type="button" data-v1536-confirm-score disabled>ENDERGEBNIS BESTÄTIGEN</button></div></div>`;
 let selected=null;
 qa('[data-v1536-result-mode]',host).forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.v1536ResultMode;qa('[data-v1536-result-mode]',host).forEach(x=>x.classList.toggle('active',x===btn));qa('[data-v1536-result-panel]',host).forEach(x=>x.classList.toggle('active',x.dataset.v1536ResultPanel===mode))}));
 qa('[data-v1536-result-winner]',host).forEach(btn=>btn.addEventListener('click',()=>{selected=btn.dataset.v1536ResultWinner;qa('[data-v1536-result-winner]',host).forEach(x=>x.classList.toggle('selected',x===btn));const c=q('[data-v1536-confirm-winner]',host);if(c){c.disabled=false;c.classList.add('ready')}}));
 q('[data-v1536-confirm-winner]',host)?.addEventListener('click',()=>{if(selected)v1536OpenResultConfirm(selected)});
 const syncScore=()=>{const av=Number(q('[data-v1536-score="a"]',host)?.value||0),bv=Number(q('[data-v1536-score="b"]',host)?.value||0),c=q('[data-v1536-confirm-score]',host),ok=av!==bv&&av>=0&&bv>=0;if(c){c.disabled=!ok;c.classList.toggle('ready',ok)}};
 qa('[data-v1536-score]',host).forEach(x=>x.addEventListener('input',syncScore));q('[data-v1536-confirm-score]',host)?.addEventListener('click',()=>{const av=Number(q('[data-v1536-score="a"]',host)?.value||0),bv=Number(q('[data-v1536-score="b"]',host)?.value||0);if(av===bv)return;v1536OpenResultConfirm(av>bv?m.a:m.b,av,bv)});syncScore()
}
function renderMetricEntry(host,m,g){const ps=isSharedContestMatch(m)?freeForAllRoster(m):[participant(m.a),participant(m.b)].filter(Boolean),unit=metricUnitLabel(g),step=['STROKES','LINK_COUNT','PRIZE_LEVEL','POINTS'].includes(resultType(g))?'1':'any';host.innerHTML=`<p class="v1514-entry-kicker">${esc(unit)} · ${metricLowerWins(g)?'NIEDRIGSTER WERT GEWINNT':'HÖCHSTER WERT GEWINNT'} · GLEICHSTÄNDE MÜSSEN VORHER NACH DER GAMESPEZIFISCHEN TIEBREAK-REGEL AUFGELÖST WERDEN.</p><div class="v1514-metric-grid">${ps.map(p=>`<label class="v1514-metric-row"><span><i class="${marker(p.color)}"></i>${esc(p.name)}</span><input type="number" step="${step}" min="0" inputmode="decimal" data-v1514-metric="${esc(p.id)}" placeholder="${esc(unit)}"></label>`).join('')}</div><button class="v1513-inline-confirm" id="v1514MetricConfirm" type="button" disabled>ENDERGEBNIS BESTÄTIGEN</button><p class="v1513-inline-note" id="v1513InlineFeedback"></p>`;
 const sync=()=>{const vals=qa('[data-v1514-metric]',host),ok=vals.length===ps.length&&vals.every(x=>x.value!==''&&Number.isFinite(Number(x.value)));q('#v1514MetricConfirm',host).disabled=!ok};qa('[data-v1514-metric]',host).forEach(x=>x.addEventListener('input',sync));q('#v1514MetricConfirm',host)?.addEventListener('click',()=>{const values=Object.fromEntries(qa('[data-v1514-metric]',host).map(x=>[x.dataset.v1514Metric,Number(x.value)]));if(isSharedContestMatch(m))concludeSharedMetrics(values);else{const av=values[m.a],bv=values[m.b];if(av===bv){setText('#v1513InlineFeedback','GLEICHSTAND · TIEBREAK ERFORDERLICH.');return}const awin=metricLowerWins(g)?av<bv:av>bv;m.values=values;concludeWinnerSelection(awin?m.a:m.b)}})}
function returnFromBetting(){const target=betReturnPage;betReturnPage=null;const nav=window.skielsenHistory?.current();if(nav?.area==='tournament'&&nav.view==='bets'){window.skielsenHistory.back();return}if(target==='matchDetail'&&selectedMatchDetailId){const found=matchContextById(selectedMatchDetailId);if(found){openMatchDetail(found.m,'replace');return}}if(target)show(target,'replace')}
function v1536NextStakeUp(v,balance){if(v>=balance)return balance;if(v%100!==0)return Math.min(balance,Math.ceil(v/100)*100);return Math.min(balance,v+100)}
function v1536NextStakeDown(v){if(v<=0)return 0;if(v%100!==0)return Math.max(0,Math.floor(v/100)*100);return Math.max(0,v-100)}
function v1536ShowBetSaved(bet){const modal=q('#v1536BetSavedModal');if(!modal||!bet)return;const p=participant(bet.participantId);setText('#v1536BetTipTeam',teamName(p));const bar=q('#v1536BetTipBar');if(bar){bar.className=marker(p?.color);bar.style.background=({BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'}[p?.color]||'var(--theme-muted)')}setText('#v1536BetSavedStake',fmt(Math.round(Number(bet.stake||0))));setText('#v1536BetSavedPayout',fmt(Math.ceil(Number(bet.stake||0)*Number(bet.acceptedOdds||0))));modal.hidden=false}
function renderMatchQuickBet(m,g){
 const host=q('#v1515MatchQuickBet'),header=q('#v1536BettingHeaderState');if(!host)return;if(!feature('feature.betting')||!m){host.hidden=true;host.innerHTML='';if(header)header.textContent='—';return}
 const isCurrent=matchNow()?.id===m.id,decision=isCurrent?userBetDecision():null;if(header)header.textContent=m.status==='BETTING_OPEN'?'OFFEN':decision?'ABGESCHLOSSEN':'GESCHLOSSEN';
 if(!isCurrent){host.hidden=true;host.innerHTML='';return}
 if(decision==='SKIP'){host.hidden=true;host.innerHTML='';return}
 host.hidden=false;
 const my=(state.bets[m.id]||[]).find(b=>b.actorId===state.userActorId),locked=!!decision;
 if(!['BETTING_OPEN','READY'].includes(m.status)&&!my){host.hidden=true;host.innerHTML='';return}
 const snap=freezeOdds(m,g),sels=snapshotSelections(snap);if(!sels.length){host.hidden=true;host.innerHTML='';return}
 if(my){quickBetParticipant=my.participantId;quickBetStake=Number(my.stake||0)}else{if(!quickBetParticipant||!sels.some(x=>x.participantId===quickBetParticipant))quickBetParticipant=sels[0].participantId;quickBetStake=Math.min(Math.max(0,Number(quickBetStake||500)),Math.max(0,Math.floor(currentWallet())))}
 const selected=selectionSnapshot(snap,quickBetParticipant)||sels[0],balance=my?Math.max(0,Number(currentWallet()||0)+Number(my.stake||0)):Math.max(0,Math.floor(currentWallet())),stake=Math.min(Number(quickBetStake||0),balance),odds=Number(selected?.odds||0),payout=Math.ceil(stake*odds),pct=balance>0?Math.max(0,Math.min(100,stake/balance*100)):0;
 quickBetStake=stake;
 host.innerHTML=`<div class="${locked?'v1536-bet-locked':''}"><div class="v1536-bet-picks">${sels.map(x=>{const p=participant(x.participantId);return `<button class="v1536-bet-pick ${quickBetParticipant===x.participantId?'selected':''}" type="button" data-v1536-bet-pick="${esc(x.participantId)}" ${locked?'disabled':''}><span class="v1536-bet-pick-left"><i class="${marker(p?.color)}"></i><strong>${esc(p?.name||'—')}</strong></span><b>${fmt(x.odds,2)}</b></button>`}).join('')}</div><div class="v1536-bet-composer"><div class="v1536-bet-tile"><div class="v1536-bet-main"><div class="v1536-bet-metrics"><div class="v1536-bet-metric"><span>MÖGLICHE AUSZAHLUNG</span><strong data-v1536-payout>${fmt(payout)}</strong><small>Quote ${Number(odds).toFixed(2).replace('.',',')}</small></div><div class="v1536-bet-divider"></div><div class="v1536-bet-metric"><span>EINSATZ</span><strong data-v1536-stake>${fmt(stake)}</strong></div></div><div class="v1536-bet-steps"><button class="v1536-bet-step plus" type="button" data-v1536-plus ${locked||stake>=balance?'disabled':''}>+</button><button class="v1536-bet-step" type="button" data-v1536-minus ${locked||stake<=0?'disabled':''}>−</button></div></div><div class="v1536-bet-slider-wrap"><input class="v1536-bet-slider" type="range" min="0" max="${balance}" step="1" value="${stake}" data-v1536-slider ${locked?'disabled':''} style="--pct:${pct}%"><div class="v1536-bet-scale"><span>0</span><span>${fmt(balance)}</span></div></div></div><div class="v1536-bet-action"><div class="v1536-bet-selection"><span>DEINE WAHL</span><b>${esc(teamName(participant(quickBetParticipant)))}</b></div><button class="v1536-bet-place ${!locked&&stake>0?'ready':''}" type="button" data-v1536-place ${locked||stake<=0?'disabled':''}>WETTE PLATZIEREN</button><button class="v1536-bet-skip" type="button" data-v1536-skip ${locked?'disabled':''}>ÜBERSPRINGEN</button></div></div></div>`;
 if(locked)return;
 qa('[data-v1536-bet-pick]',host).forEach(b=>b.addEventListener('click',()=>{quickBetParticipant=b.dataset.v1536BetPick;renderMatchQuickBet(m,g)}));
 q('[data-v1536-plus]',host)?.addEventListener('click',()=>{quickBetStake=v1536NextStakeUp(quickBetStake,balance);renderMatchQuickBet(m,g)});q('[data-v1536-minus]',host)?.addEventListener('click',()=>{quickBetStake=v1536NextStakeDown(quickBetStake);renderMatchQuickBet(m,g)});q('[data-v1536-slider]',host)?.addEventListener('input',e=>{quickBetStake=Math.max(0,Math.min(balance,Number(e.target.value||0)));renderMatchQuickBet(m,g)});
 q('[data-v1536-place]',host)?.addEventListener('click',async()=>{const sel=selectionSnapshot(snap,quickBetParticipant);if(sel&&await placeBetFor(state.userActorId,quickBetParticipant,quickBetStake,sel.odds)){const bet=(state.bets[m.id]||[]).findLast?.(b=>b.actorId===state.userActorId)||(state.bets[m.id]||[]).slice().reverse().find(b=>b.actorId===state.userActorId);addAudit('QUICK BET · '+userActor().name+' · '+teamName(participant(quickBetParticipant))+' · '+quickBetStake);renderAll();saveSoon();v1536ShowBetSaved(bet)}});q('[data-v1536-skip]',host)?.addEventListener('click',()=>{if(skipBetFor(state.userActorId)){addAudit('QUICK BET SKIPPED · '+userActor().name);renderAll();saveSoon()}})
}
function renderMatchJokerPublicState(g){
 const block=q('#matchJokerBlock');if(!block)return;block.hidden=!feature('feature.joker');if(block.hidden)return;
 const title=q('#matchJokerState',block),copy=q('.betting-content span',block),a=g?.joker?.accepted,viewer=state?.userParticipantId;
 if(!a){if(title)title.textContent='KEIN JOKER AKTIV';if(copy)copy.textContent=g?.phase==='PLANNED'?'Joker-Submissions werden erst beim Start der Spielvorbereitung ausgewertet.':'Für dieses Game wurde kein Joker ausgewählt.';return}
 const publicNow=jokerIsPubliclyRevealed(g),own=a.participantId===viewer;
 if(!publicNow){if(title)title.textContent=own?`DEIN JOKER · ${jokerTypeLabel(a.type)}`:'GEHEIMER JOKER AKTIV';if(copy)copy.textContent=own?'Nur du siehst den Typ. Für deine Gegner bleibt dieser Joker bis zum Abschluss des Games geheim.':'Ein Gegner hat einen Joker aktiv. Typ, Besitzer und Wirkung werden erst nach dem Finale aufgedeckt.';return}
 if(title)title.textContent=`JOKER · ${jokerTypeLabel(a.type)}`;if(copy)copy.textContent=`${teamName(participant(a.participantId))} · ${jokerRevealPolicy(a.type)==='ACTION'?'Action-Joker wurde bereits während des Games sichtbar.':'Joker wurde nach dem Game aufgedeckt.'}`;
}
function v1536RenderEmbeddedResult(m,g,current){
 const section=q('#v1536MatchResult'),host=q('#v1536MatchResultHost'),inApp=q('#v1536EmbeddedInAppHost');if(!section||!host)return;
 if(!current||!isAdmin()||m?.status!=='LIVE'){section.hidden=true;host.innerHTML='';return}section.hidden=false;const mode=resultEntryMode(g,m);
 if(mode==='AUTO_IN_APP'){host.innerHTML='<div class="v1534-readonly-state"><strong>IN-APP GAME LÄUFT</strong><span>Session, Player-Auswahl und Live-Steuerung werden direkt hier im Match verwaltet. Das Ergebnis kommt aus der serverseitigen In-App-Session.</span></div>';return}
 if(isSharedContestMatch(m)){if(mode==='METRIC'){renderMetricEntry(host,m,g);return}renderSharedPlacementEntry(host,m,g);return}
 if(mode==='WINNER'||mode==='PLACEMENT'){renderWinnerEntry(host,m,g);return}
 if(mode==='METRIC'){renderMetricEntry(host,m,g);return}
 host.innerHTML='<div class="v1534-readonly-state"><strong>SPEZIALTRACKER</strong><span>Dieses Game verwendet seinen spezialisierten Tracker direkt innerhalb des Match-Kontexts.</span></div>'
}
function renderMatchDetailControlEntry(m,g){
 const block=q('#v1536MatchControl'),title=q('#v1536MatchControlTitle'),phase=q('#v1536MatchControlPhase'),gate=q('#v1536MatchControlGate'),btn=q('#v1536MatchControlStart');if(!block||!title||!gate||!btn||!m||!g)return;
 block.hidden=false;block.classList.remove('is-waiting','is-live');gate.innerHTML='';btn.hidden=false;btn.disabled=true;btn.className='v1536-control-action';
 const found=matchContextById(m.id),current=!!found&&found.g===gameNow()&&found.m?.id===matchNow()?.id;if(phase)phase.textContent=g.phase==='PLANNED'?'PLANNED':g.phase==='PREPARING'?'PREPARING':m.status;
 if(!current){title.textContent=m.status==='CONCLUDED'?'MATCH ABGESCHLOSSEN':'MATCHKONTEXT · READ ONLY';btn.hidden=true;block.classList.add('is-waiting');v1536RenderEmbeddedResult(m,g,false);return}
 if(g.phase==='PLANNED'){
   title.innerHTML='<span class="v1536-loader">JOKERRUNDE...</span>';block.classList.add('is-waiting');btn.textContent=isAdmin()?'JOKER SCHLIESSEN → BETTING':'WARTET AUF ADMIN';btn.disabled=!isAdmin();btn.classList.toggle('waiting',!isAdmin())
 }else if(g.phase==='PREPARING'){
   const waits=!!g.joker?.awaitingPick;title.innerHTML=waits?'<span class="v1536-loader">JOKER-AKTION...</span>':'<span class="v1536-loader">VORBEREITUNG...</span>';block.classList.add('is-waiting');const own=waits&&g.joker?.accepted?.participantId===state.userParticipantId&&serverJokerBoard?.pending_pick;if(own){btn.textContent='GEGNER WÄHLEN';btn.disabled=false}else{btn.textContent=waits?'WARTET AUF GEGNERWAHL':'WIRD VORBEREITET';btn.disabled=true;btn.classList.add('waiting')}
 }else if(m.status==='BETTING_OPEN'&&!gateComplete(m)){
   const pending=bettingPendingCount(m);title.innerHTML='<span class="v1536-loader">BETTING LÄUFT...</span>';gate.innerHTML=`<span>BETTING · ${pending} OFFEN</span>`;btn.textContent='WARTET AUF BETTING';btn.disabled=true;btn.classList.add('waiting');block.classList.add('is-waiting')
 }else if(m.status==='READY'||(m.status==='BETTING_OPEN'&&gateComplete(m))){
   title.textContent=feature('feature.betting')?'BETTING ABGESCHLOSSEN':'MATCH BEREIT';if(feature('feature.betting'))gate.innerHTML='<span class="ok">BETTING · 0 OFFEN</span>';btn.textContent=isAdmin()?'MATCH STARTEN':'WARTET AUF ADMIN';btn.disabled=!isAdmin()
 }else if(m.status==='LIVE'){
   title.textContent='MATCH LÄUFT';btn.hidden=true;block.classList.add('is-live')
 }else{
   title.textContent='MATCH ABGESCHLOSSEN';btn.hidden=true
 }
 v1536RenderEmbeddedResult(m,g,current)
}
function refreshOpenMatchDetail(){if(currentPage!=='matchDetail'||!selectedMatchDetailId)return;const m=state.games.flatMap(g=>g.matches||[]).find(x=>x.id===selectedMatchDetailId);if(!m)return;const g=state.games.find(x=>x.matches?.some(mm=>mm.id===m.id))||gameNow();setText('#v20DetailGame',g?.name||'MATCH');setText('#v20DetailStage',`SPIEL ${gameIndexOf(g)+1} · ${stageLabel(m.stage)}`);const st=q('#detailStatus');if(st){const x=q('span',st);if(x)x.textContent=statusLabel(m.status);st.classList.toggle('live',m.status==='LIVE');st.classList.toggle('betting-open',m.status==='BETTING_OPEN');st.classList.toggle('concluded',m.status==='CONCLUDED')}const host=q('#v20MatchDetailPairing');if(host)host.innerHTML=largePairingMarkup(m,g);renderMatchDetailHistory(m,g);renderMatchJokerPublicState(g);renderMatchDetailControlEntry(m,g);renderMatchQuickBet(m,g)}
function openMatchDetail(m,historyMode='push'){if(selectedMatchDetailId!==m.id)inlineResultMatchId=null;selectedMatchDetailId=m.id;gameControlContext=null;show('matchDetail',historyMode);refreshOpenMatchDetail()}

function renderRanking(){
 const page=q('#rankingPage');
 if(!page)return;
 const rows=rankingsSorted(),table=q('.team-ranking-table',page);
 if(table){
  const header=q('.ranking-labels',table);
  table.innerHTML=(header?header.outerHTML:'')+rows.map((x,i)=>`<div class="ranking-row team-row ${x.p.id===state.userParticipantId?'current-team':''}"><b class="rank-pos">${String(i+1).padStart(2,'0')}</b><div class="rank-team"><i class="${marker(x.p.color)}"></i><strong>${esc(x.p.name)}</strong></div><b class="rank-points">${fmt(x.r.points)}</b><span>${x.r.first}</span><span>${x.r.second}</span><span>${x.r.third}</span><span>${x.r.last}</span><span>${x.r.mvp}</span></div>`).join('');
 }
 const leaders=q('#v20RankingLeaders',page);
 if(leaders){
  const defs=[['PUNKTE','points'],['FIRST PLACES','first'],['SECOND PLACES','second'],['THIRD PLACES','third'],['MVP TITEL','mvp']];
  leaders.innerHTML=defs.map(([label,key])=>{
   const top=[...rows].sort((a,b)=>(b.r[key]||0)-(a.r[key]||0)||(b.r.points||0)-(a.r.points||0))[0];
   return `<article class="category-card"><div class="category-top"><span>${label}</span><small>LEADER</small></div><div class="category-team"><i class="${marker(top?.p.color)}"></i><div><strong>${esc(top?.p.name||'—')}</strong><b>${fmt(top?.r?.[key]||0)}</b></div></div></article>`;
  }).join('');
 }
 const placements=runtime?.scoring?.placements||{'1':10,'2':5,'3':3,'4':0};
 const bonus=Number(runtime?.scoring?.config?.mvpTeamBonus??runtime?.scoring?.config?.mvp_team_bonus??10);
 const note=q('.ranking-rule-note',page);
 if(note)note.textContent=`PUNKTE PRO GAME: ${Object.keys(placements).sort((a,b)=>Number(a)-Number(b)).map(k=>`${k}. ${fmt(placements[k])}`).join(' · ')} · MVP-TEAM-BONUS ${bonus>=0?'+':''}${fmt(bonus)} NACH TURNIERENDE`;
}
function renderBets(){
 const page=q('#betsPage');
 if(!page)return;
 const g=gameNow(),m=matchNow(),wallet=currentWallet();
 setText('#walletBalance',fmt(wallet));
 const card=q('.bet-match-card',page),snap=m?(feature('feature.betting')?freezeOdds(m,g):state.oddsSnapshots[m.id]||null):null;
 if(card){
  const top=q('.bet-match-top b',card);if(top)top.textContent=m?statusLabel(m.status):'CLOSED';
  setText('#v20BetMatchMeta',m&&g?`GAME ${gameIndexOf(g)+1} · ${stageLabel(m.stage)}`:'KEIN OFFENER MARKT');
  const game=q('.bet-game',card);if(game)game.innerHTML=`${esc(g?.name||'—')} <small>${esc(m?stageLabel(m.stage):'—')}</small>`;
  const teams=q('.bet-teams',card);
  if(teams){
   const sels=snapshotSelections(snap);
   teams.classList.toggle('free4all-market',isSharedContestMatch(m));
   if(m&&sels.length)teams.innerHTML=isSharedContestMatch(m)?sels.map(x=>betPickMarkup(x.participantId,x.probability,x.odds)).join(''):betPickMarkup(sels[0].participantId,sels[0].probability,sels[0].odds)+`<div class="bet-vs">VS</div>`+betPickMarkup(sels[1].participantId,sels[1].probability,sels[1].odds);
   else teams.innerHTML='<div class="v20-empty">KEIN OFFENER MARKT.</div>';
  }
 }
 const ctx=q('#v20BetContextGrid');
 if(ctx){
  const sels=snapshotSelections(snap);
  ctx.innerHTML=sels.length?sels.map(x=>{const p=participant(x.participantId);return `<article class="v20-bet-context-row"><small>${esc(p?.name||'TEILNEHMER')}</small><strong>${fmt(x.probability*100,1)} % · ${fmt(x.odds,2)}</strong><span>Community ${fmt(participantCommunityGameStrength(x.participantId,g),1)} · Effective ${fmt(x.strength,1)} · Confidence ${fmt(participantGameConfidence(x.participantId,g)*100,0)} %</span></article>`}).join(''):'<div class="v20-empty">SNAPSHOT ÖFFNET MIT DEM MARKT.</div>';
 }
 const community=q('#v20CommunityBets');
 if(community){
  const bets=m?(state.bets[m.id]||[]):[];
  community.innerHTML=bets.length?bets.map(b=>`<div class="community-bet-row"><span>${esc(actor(b.actorId)?.name||'PLAYER')}</span><b>${esc(teamName(participant(b.participantId)))}</b><strong>${fmt(b.stake)} COINS @ ${fmt(b.acceptedOdds,2)}</strong></div>`).join(''):'<div class="v20-empty">NOCH KEINE WETTEN IN DIESEM MARKT.</div>';
 }
 const validPicks=snapshotSelections(snap).map(x=>x.participantId);
 if(selectedBetParticipant&&!validPicks.includes(selectedBetParticipant))selectedBetParticipant=null;
 const dec=userBetDecision();
 setText('#prototypeBetDeadlineTitle',dec?'ENTSCHEIDUNG GESPEICHERT':'JETZT WETTEN ODER ÜBERSPRINGEN');
 setText('#prototypeBetDeadlineCopy',m?.status==='BETTING_OPEN'?(dec?'DEINE ENTSCHEIDUNG IST FÜR DIESEN MARKT GESPERRT.':'MATCHSTART BLEIBT GESPERRT, BIS ALLE PLAYER ENTSCHIEDEN HABEN.'):'AKTUELL KEIN OFFENER MARKT.');
 const stake=q('#stakeRange'),custom=q('#customStake');
 if(stake){stake.max=Math.max(0,Math.floor(wallet));if(Number(stake.value)>wallet)stake.value=Math.floor(wallet)}
 if(custom)custom.max=Math.floor(wallet);
 const btn=q('#placeBetBtn');
 if(btn){btn.disabled=!!dec||m?.status!=='BETTING_OPEN'||!selectedBetParticipant;const bspan=q('span',btn),pick=selectionSnapshot(snap,selectedBetParticipant);if(bspan)bspan.textContent=`${fmt(Number(stake?.value||0))} COINS · QUOTE ${pick?fmt(pick.odds,2):'—'}`}
 const skip=q('#prototypeSkipBet');if(skip)skip.disabled=!!dec||m?.status!=='BETTING_OPEN';
 updateBetSlip();renderBetHistory();
}
function betPickMarkup(pid,p,odds){const x=participant(pid),pct=isSharedContestMatch(matchNow())?fmt(p*100,1):String(Math.round(p*100));return `<button class="bet-pick v20-choice-card ${selectedBetParticipant===pid?'selected':''}" data-v15-bet-pick="${esc(pid)}" data-odds="${odds}" type="button"><i class="${marker(x?.color)}"></i><span><strong>${esc(x?.name||'—')}</strong></span><span class="prediction"><small>SIEGCHANCE</small><b>${pct}%</b></span><span class="odds"><small>QUOTE</small><b>${fmt(odds,2)}</b></span></button>`}
function updateBetSlip(){const m=matchNow(),snap=m?state.oddsSnapshots[m.id]:null,pid=selectedBetParticipant||null,sel=pid?selectionSnapshot(snap,pid):null,odds=sel?.odds,p=pid?participant(pid):null;setText('#betSelectedTeam',pid?teamName(p):'NOCH KEINE AUSWAHL');setText('#betSelectedOdds',odds?fmt(odds,2):'—');const slip=q('#slipSelection');if(slip){slip.classList.remove('team-yellow-selection','team-red-selection','team-blue-selection','team-green-selection');const cls={BLUE:'team-blue-selection',RED:'team-red-selection',YELLOW:'team-yellow-selection',GREEN:'team-green-selection'}[p?.color];if(cls)slip.classList.add(cls)}const range=q('#stakeRange'),stake=Number(range?.value||0);setText('#stakeValue',fmt(stake));setText('#potentialPayout',odds?fmt(Math.ceil(stake*odds)):'0')}
function renderBetHistory(){const host=q('#myBetsList');if(host){const rows=Object.values(state.bets).flat().filter(b=>b.actorId===state.userActorId).slice().reverse();host.innerHTML=rows.map(b=>`<div class="bet-history-row"><span>${esc(teamName(participant(b.participantId)))}</span><b>${fmt(b.stake)} · ${fmt(b.acceptedOdds,2)}</b><em>${esc(b.status)}</em></div>`).join('')||'<div class="v15-empty">NOCH KEINE WETTEN.</div>'}const led=q('#walletLedgerRows');if(led){led.innerHTML=state.transactions.filter(t=>t.actorId===state.userActorId).slice().reverse().slice(0,12).map(t=>`<div class="wallet-row"><span>${esc(t.type)}</span><b>${t.amount>=0?'+':''}${fmt(t.amount)}</b><small>${esc(t.at)}</small></div>`).join('')}}
function renderAdmin(){
 const g=gameNow(),m=matchNow();setText('#prototypeStateLabel',state.tournamentDone?'TURNIER ABGESCHLOSSEN':`STATUS · ${g?.name||'TURNIER'} · ${g?.phase||'—'}`);const sim=q('.prototype-sim-panel span');if(sim)sim.textContent='Diagnose und Recovery. Der operative Spielworkflow läuft über MATCHES und die Match Page.';
 const ob=q('#prototypeOtherBets');if(ob)ob.hidden=true;const ov=q('#prototypeOtherMvp');if(ov)ov.hidden=true;const af=q('#prototypeAutofill');if(af)af.hidden=true;
 const adminBetGate=q('#prototypeAdminBetGate');if(adminBetGate)adminBetGate.hidden=!feature('feature.betting');if(feature('feature.betting')){const total=activeActorIds().length,dec=m?Object.keys(state.betDecisions[m.id]||{}).length:0;setText('#prototypeAdminBetCount',`${dec} / ${total} ENTSCHIEDEN`);setText('#prototypeAdminBetPending','READ ONLY');setText('#prototypeAdminBetGateState','INFO')}
 const themeSel=q('#adminThemeSelect');if(themeSel&&runtime?.theme_pack_id&&themeSel.value!==runtime.theme_pack_id)themeSel.value=runtime.theme_pack_id;
 const coinSel=q('#coinAdjustPlayer');if(coinSel){const cur=coinSel.value;coinSel.innerHTML=state.actors.map(a=>`<option value="${esc(a.id)}">${esc(a.name.toUpperCase())} · ${esc(actorParticipant(a)?.name||'')}${a.isBot?' · BOT':''}</option>`).join('');if(state.actors.some(a=>a.id===cur))coinSel.value=cur}
 const roster=q('#v20AdminRoster');if(roster)roster.innerHTML=state.actors.map(a=>{const p=actorParticipant(a);return `<div><b>${esc(a.name)}</b><span><i class="${marker(p?.color)}"></i>${esc(p?.name||'NICHT ZUGEORDNET')}</span><em>${a.isBot?'BOT':'PLAYER'}</em></div>`}).join('')||'<div class="v20-empty">KEINE PLAYER GELADEN.</div>';const ag=q('#adminGameList');if(ag)ag.innerHTML=state.games.map((x,i)=>`<div class="${i===state.currentGameIndex?'current':''}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(x.name)}</span><em>${esc(x.phase)}</em></div>`).join('')||'<div class="v20-empty">KEINE GAMES GELADEN.</div>';const ar=q('#auditLogRows');if(ar)ar.innerHTML=state.audit.slice(0,18).map(x=>`<div class="audit-row"><b>${esc(x.at)}</b><span>${esc(x.text)}</span></div>`).join('')||'<div class="v20-empty">NOCH KEINE AUDIT-EINTRÄGE.</div>'
}
function renderSharedPlacementEntry(host,m,g){
 const ps=freeForAllRoster(m);m.resultDraft=m.resultDraft||{};
 const picked=Array.isArray(m.resultDraft.placements)?m.resultDraft.placements.filter(id=>(m.participantIds||[]).includes(id)):[];m.resultDraft.placements=picked;
 const remaining=ps.filter(p=>!picked.includes(p.id)),nextPlace=picked.length+1;
 if(remaining.length===1&&picked.length===ps.length-1){const final=[...picked,remaining[0].id];m.resultDraft.placements=[];concludeSharedPlacements(final,'GAME CONTROL PLACEMENT');return}
 host.innerHTML=`<div class="v1514-placement-step"><p class="v1514-entry-kicker">PLATZIERUNG NACHEINANDER ANTIPPEN. DER LETZTE VERBLEIBENDE PARTICIPANT WIRD AUTOMATISCH AUF PLATZ ${ps.length} GESETZT.</p>${picked.length?`<div class="v1514-place-picked">${picked.map((id,i)=>`<span>${i+1}. ${esc(teamName(participant(id)))}</span>`).join('')}</div>`:''}<h4>WER WURDE ${nextPlace}.?</h4><div class="v1514-place-grid">${remaining.map(p=>`<button class="v1514-place-btn" type="button" data-v1535-control-place="${esc(p.id)}"><i class="${marker(p.color)}"></i><span><strong>${esc(p.name)}</strong><small>PLATZ ${nextPlace}</small></span></button>`).join('')}</div>${picked.length?'<button class="v1514-place-undo" id="v1535ControlPlaceUndo" type="button">LETZTE AUSWAHL ZURÜCK</button>':''}</div>`;
 qa('[data-v1535-control-place]',host).forEach(btn=>btn.addEventListener('click',()=>{m.resultDraft.placements.push(btn.dataset.v1535ControlPlace);renderAll()}));
 q('#v1535ControlPlaceUndo',host)?.addEventListener('click',()=>{m.resultDraft.placements.pop();renderAll()})
}
function renderGameControlResult(g,m,page,isCurrent){
 const section=q('#v1534GameControlResult',page),host=q('#v1534GameControlResultHost',page);if(!section||!host)return;
 if(!m){section.hidden=false;host.innerHTML='<div class="v1534-readonly-state"><strong>KEIN MATCH</strong><span>Für diesen Kontext ist kein Match vorhanden.</span></div>';return}
 if(!isCurrent){section.hidden=false;const result=m.status==='CONCLUDED'&&m.scoreA!=null&&m.scoreB!=null?` · ${m.scoreA}:${m.scoreB}`:'';host.innerHTML=`<div class="v1534-readonly-state"><strong>${m.status==='CONCLUDED'?'ERGEBNIS GESPEICHERT'+result:'NICHT AKTUELL · READ ONLY'}</strong><span>Dieser Match-Kontext wird mit derselben aktuellen Game-Control-Seite angezeigt, darf den laufenden Turnierzustand aber nicht verändern.</span></div>`;return}
 if(m.status!=='LIVE'){section.hidden=m.status!=='CONCLUDED';host.innerHTML=m.status==='CONCLUDED'?'<div class="v1534-readonly-state"><strong>ERGEBNIS GESPEICHERT</strong><span>Dieses Match ist abgeschlossen.</span></div>':'';return}
 section.hidden=false;const mode=resultEntryMode(g,m);
 if(mode==='AUTO_IN_APP'){host.innerHTML='<div class="v1534-readonly-state"><strong>IN-APP GAME LÄUFT</strong><span>Session, Player-Auswahl und Live-Steuerung werden direkt in GAME CONTROL verwaltet. Das Ergebnis kommt aus der serverseitigen In-App-Session.</span></div>';return}
 if(isSharedContestMatch(m)){if(mode==='METRIC'){renderMetricEntry(host,m,g);return}renderSharedPlacementEntry(host,m,g);return}
 if(mode==='WINNER'||mode==='PLACEMENT'){renderWinnerEntry(host,m,g);return}
 if(mode==='METRIC'){renderMetricEntry(host,m,g);return}
 host.innerHTML='<div class="v1534-readonly-state"><strong>SPEZIALTRACKER</strong><span>Dieses Game verwendet seinen spezialisierten Tracker innerhalb derselben Game-Control-Seite.</span></div>'
}
function renderGameControl(){
 const page=q('#gameControlPage');if(!page)return;const sel=gameControlSelection(),g=sel.g,m=sel.m,isCurrent=sel.isCurrent;
 page.dataset.controlReadonly=isCurrent?'false':'true';
 const hero=q('.game-control-hero',page);if(hero){setText('h1',g?.name||'GAME',hero);setText('p',m?`SPIEL ${gameIndexOf(g)+1} · ${stageLabel(m.stage)}`:'KEIN MATCH',hero);const ctx=q('.v1534-control-context',hero);if(ctx){ctx.classList.toggle('is-current',!!isCurrent);ctx.textContent=isCurrent?'AKTUELLER TURNIERKONTEXT':'MATCHKONTEXT · READ ONLY'}}
 const pair=q('#v20GameControlPairing',page);if(pair)pair.innerHTML=m?largePairingMarkup(m,g):'<div class="v20-empty">KEIN MATCH.</div>';
 setText('#v1535GameControlStatus',g?.phase==='PLANNED'?'GEPLANT':g?.phase==='PREPARING'?'IN VORBEREITUNG':m?statusLabel(m.status):'—');setText('#v1535GameControlPhase',g?.phase||m?.status||'—');
 const panel=q('#v1535GameControlStatePanel',page),title=q('#v1535GameControlTitle',page),copy=q('#v1535GameControlCopy',page),start=q('#gameControlStart',page);if(panel)panel.classList.remove('is-waiting','is-live');if(start)start.hidden=false;
 if(!isCurrent){if(title)title.textContent=m?.status==='CONCLUDED'?'MATCH ABGESCHLOSSEN':'NICHT AKTUELL';if(copy)copy.textContent=m?.status==='CONCLUDED'?'Dieses Match ist abgeschlossen.':'Dieser Match wird hier nur angezeigt. Die operative Steuerung bleibt beim aktuell laufenden Match.';setHoldLabel(start,m?.status==='CONCLUDED'?'ABGESCHLOSSEN':'READ ONLY',true);panel?.classList.add('is-waiting')}
 else if(g?.phase==='PLANNED'){if(title)title.textContent='SPIEL NOCH NICHT VORBEREITET';if(copy)copy.textContent=feature('feature.joker')?'Joker können bis zum Start der Spielvorbereitung gesetzt, geändert oder zurückgezogen werden. Danach werden Paarungen und Betting finalisiert.':'Starte die Spielvorbereitung, um Paarungen und Match-Lifecycle zu öffnen.';setHoldLabel(start,isAdmin()?'SPIEL VORBEREITEN':'WARTET AUF ADMIN',!isAdmin())}
 else if(g?.phase==='PREPARING'){const waits=!!g?.joker?.awaitingPick;if(title)title.textContent=waits?'WARTET AUF JOKER-AKTION':'SPIEL WIRD VORBEREITET';if(copy)copy.textContent=waits?'Ein akzeptierter PICK OPPONENT Joker muss zuerst abgeschlossen werden.':'Joker werden aufgelöst und die endgültigen Paarungen vorbereitet.';setHoldLabel(start,waits?'WARTET AUF GEGNERWAHL':'SPIEL WIRD VORBEREITET',true);panel?.classList.add('is-waiting')}
 else if(m?.status==='BETTING_OPEN'&&!gateComplete(m)){const pending=bettingPendingCount(m);if(title)title.textContent='BETTING LÄUFT';if(copy)copy.textContent=`${pending} Player-Entscheidung${pending===1?'':'en'} noch offen. Matchstart bleibt bis BET oder SKIP gesperrt.`;setHoldLabel(start,'WARTET AUF BETTING',true);panel?.classList.add('is-waiting')}
 else if(m?.status==='READY'||(m?.status==='BETTING_OPEN'&&gateComplete(m))){if(title)title.textContent='MATCH BEREIT';if(copy)copy.textContent='Alle erforderlichen Vorbedingungen sind erfüllt. Du kannst den Match jetzt starten.';setHoldLabel(start,'MATCH STARTEN',!isAdmin())}
 else if(m?.status==='LIVE'){if(title)title.textContent='MATCH LÄUFT';if(copy)copy.textContent=resultEntryMode(g,m)==='AUTO_IN_APP'?'Das In-App Game liefert sein Ergebnis automatisch.':'Ergebnis bzw. Platzierung wird direkt unterhalb in dieser Game-Control-Seite erfasst.';if(start){start.hidden=true;start.disabled=true}panel?.classList.add('is-live')}
 else if(m?.status==='SCHEDULED'){if(title)title.textContent='MATCH WIRD VORBEREITET';if(copy)copy.textContent='Der Match ist noch nicht für den Start freigegeben.';setHoldLabel(start,'WARTET AUF FREIGABE',true);panel?.classList.add('is-waiting')}
 else {if(title)title.textContent='MATCH ABGESCHLOSSEN';if(copy)copy.textContent='Ergebnis und Betting-Abrechnung sind gespeichert.';setHoldLabel(start,'ABGESCHLOSSEN',true)}
 const betGate=q('#prototypeControlBetGate',page);if(betGate)betGate.hidden=!isCurrent||!feature('feature.betting')||g?.phase!=='ACTIVE';if(feature('feature.betting')&&isCurrent&&m){const complete=gateComplete(m);setText('#prototypeControlBetTitle',m.status==='BETTING_OPEN'?'BETTING OFFEN':complete?'BETTING ABGESCHLOSSEN':'BETTING GESPERRT');setText('#prototypeControlBetCopy',m.status==='BETTING_OPEN'?'WETTMARKT IST OFFEN · ALLE PLAYER MÜSSEN WETTEN ODER ÜBERSPRINGEN.':complete?'ALLE ERFORDERLICHEN BET/SKIP-ENTSCHEIDUNGEN SIND VOLLSTÄNDIG.':'AKTUELL KEIN OFFENER WETTMARKT.')}
 renderGameControlResult(g,m,page,isCurrent)
}
function renderGames(){const page=q('#gamesPage'),grid=q('#gamesIndex .games-grid',page);if(!page||!grid)return;const intro=q('.games-intro p',page);if(intro)intro.textContent=`${state.games.length} AUSGEWÄHLTE SPIELE · AKTUELLES TURNIER`;const count=q('.games-intro > b',page);if(count)count.textContent=state.games.length;grid.innerHTML=state.games.map((g,i)=>{const skills=gameWeights(g).sort((a,b)=>b[1]-a[1]);const top=SKILL_NAMES[skills[0]?.[0]]||'SKIELSEN';return `<button class="game-card game-catalog-card" data-v15-game-card="${i}" data-environment="${String(g.environment||'').toLowerCase()}" data-status="${g.phase==='COMPLETED'?'concluded':'open'}"><div class="game-card-img"><div>${esc(top)}</div><span class="environment-chip">${esc(g.environment||'GAME')}</span></div><div class="game-card-body"><small>GAME ${String(i+1).padStart(2,'0')} · ${esc(g.phase)}</small><h3>${esc(g.name)}</h3><span>${i===state.currentGameIndex?'AKTUELLES GAME':'DETAILS ANZEIGEN'} →</span></div></button>`}).join('')}
function renderGameInfo(index){const g=state.games[index];if(!g)return;let panel=q('#v15GameInfo',q('#gamesPage'));if(!panel){panel=document.createElement('section');panel.id='v15GameInfo';panel.className='v15-game-info';q('#gamesIndex',q('#gamesPage')).appendChild(panel)}const skills=gameWeights(g).sort((a,b)=>b[1]-a[1]);panel.innerHTML=`<button type="button" data-v15-close-game>← GAMES</button><small>GAME ${index+1} · ${esc(g.category||'')}</small><h2>${esc(g.name)}</h2><p>${esc(g.rules_text||'Regeltext wird aus dem kanonischen Game-Katalog geladen.')}</p><div class="v15-game-skill-list">${skills.map(([sid,w])=>`<div><span>${esc(SKILL_NAMES[sid]||sid)}</span><b>${fmt(w)} / 100</b></div>`).join('')}</div>`;panel.hidden=false;gridHide(true);window.scrollTo(0,0)}
function gridHide(v){const grid=q('#gamesIndex .games-grid');if(grid)grid.hidden=v;const fb=q('#gamesFilterbar');if(fb)fb.hidden=v;const ft=q('#gamesFilterToggle');if(ft)ft.hidden=v}
function renderProfile(){const a=actor(state.selectedProfileActorId)||userActor(),p=actorParticipant(a),page=q('#profilePage');if(!a||!page)return;setText('.player-name',a.name.toUpperCase(),page);setText('.avatar',initials(a.name),page);const rr=state.rankings[p?.id]||{},rank=rankingsSorted().findIndex(x=>x.p.id===p?.id)+1,history=state.matchHistory.filter(h=>historyIncludesParticipant(h,p?.id));const wins=history.filter(h=>historyOutcome(h,p?.id)?.win).length;setText('.player-meta',`${history.length} MATCHES · ${wins} WINS · ${rr.mvp||0} MVP`,page);const teamEl=q('.player-team',page);if(teamEl){teamEl.innerHTML='<span class="team-dot"></span>'+esc(p?.name||'—');const dot=q('.team-dot',teamEl);if(dot)dot.style.background=({BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'}[p?.color]||'var(--theme-muted)')}setText('.profile-ranking .rank','#'+String(rank||1).padStart(2,'0'),page);const sel=q('#playerProfileSelect',page);if(sel){sel.innerHTML=state.actors.map(x=>`<option value="${esc(x.id)}" ${x.id===a.id?'selected':''}>${esc(x.name.toUpperCase())} · ${esc(actorParticipant(x)?.name||'')} ${x.id===state.userActorId?'· DU':''}${x.isBot?' · BOT':''}</option>`).join('')}setText('#playerSwitchContext',(a.id===state.userActorId?'EINGELOGGT · ':'PLAYER · ')+a.name.toUpperCase(),page);
 const rows=qa('#playerOverviewDashboard .skills-panel .skill-row',page);(state.skills||[]).slice(0,rows.length).forEach((sid,i)=>{const r=state.ratings[a.id]?.[sid],row=rows[i];if(!r||!row)return;setText('.skill-name',SKILL_NAMES[sid]||runtime?.skills?.find(x=>x.skill_id===sid)?.name||sid,row);const fills=qa('.skill-track > div',row);if(fills[0])fills[0].style.width=clamp(r.community,0,100)+'%';if(fills[1])fills[1].style.width=clamp(r.skielsen,0,100)+'%';const vals=qa('.skill-value',row);if(vals[0])vals[0].textContent=fmt(r.community)+' / 100';if(vals[1])vals[1].textContent=fmt(r.skielsen)+' / 100';const d=q('.skill-delta',row);if(d){const delta=r.skielsen-r.community;d.textContent=(delta>=0?'+':'')+fmt(delta);d.className='skill-delta '+(delta>=0?'delta-positive':'delta-negative');d.title='Confidence '+fmt(r.confidence*100)+' %'}});
 const k=qa('#playerOverviewDashboard .kpi-value',page);if(k[0])k[0].textContent=wins;if(k[1])k[1].textContent=rr.mvp||0;if(k[2])k[2].textContent=fmt(rr.points||0);const form=q('#v20ProfileForm',page);if(form)form.innerHTML=history.slice(0,4).map(h=>`<div class="result ${historyOutcome(h,p.id)?.win?'win':'loss'}">${historyOutcome(h,p.id)?.win?'W':'L'}</div>`).join('')||'<span>—</span>';
 const upcoming=[];(state.games||[]).forEach((gg,gi)=>(gg.matches||[]).forEach(mm=>{if(mm.status==='CONCLUDED')return;if(isSharedContestMatch(mm)?(mm.participantIds||[]).includes(p?.id):(mm.a===p?.id||mm.b===p?.id))upcoming.push({g:gg,m:mm,gi})}));const uh=q('#v20ProfileUpcoming',page);if(uh)uh.innerHTML=upcoming.slice(0,8).map(x=>historyRowMarkup(null,{perspectivePid:p.id,openMatch:x.m,game:x.g})).join('')||'<div class="v20-empty">KEIN BESTÄTIGTES OFFENES PAIRING FÜR DIESEN PLAYER.</div>';const rh=q('#v20ProfileRecent',page);if(rh)rh.innerHTML=history.slice(0,8).map(h=>historyRowMarkup(h,{perspectivePid:p.id})).join('')||'<div class="v20-empty">NOCH KEIN ABGESCHLOSSENES MATCH.</div>';const bar=q('#profileMatchesView .pm-section-bar b',page);if(bar)bar.textContent=`${a.name.toUpperCase()} · ${p?.name||'—'}`;
 const awards=q('#v20AchievementGrid',page),mine=(state.awards||[]).filter(x=>x.actorId===a.id);if(awards)awards.innerHTML=mine.length?mine.slice().reverse().map(x=>`<article class="v20-award-card"><small>GAME ${Number(x.gameIndex)+1} · ${esc(state.games?.[x.gameIndex]?.name||'GAME')}</small><h3>${esc(x.type)}</h3><p>${fmt(x.votes)} Stimmen · aktuelles Turnier</p></article>`).join(''):'<div class="v20-empty">NOCH KEIN MVP/LVP-AWARD IN DIESEM TURNIER.</div>';const ph=q('#v20PlayerHistory',page);if(ph)ph.innerHTML='<div class="v20-empty">FÜR DIESE DEMO WIRD NUR DAS AKTUELLE TURNIER ANGEZEIGT.</div>'}
function renderNews(){const page=q('#newsPage'),host=q('#v15NewsFeed',page);if(!page||!host)return;const rows=state.news.length?state.news:[{headline:'NOCH KEIN MATCH-REPORT.',body:'Sobald im aktuellen Turnier ein Ergebnis gespeichert wird, erzeugt SKIELSEN hier eine faktenbasierte Meldung.',type:'SYSTEM',at:nowLabel()}];host.innerHTML=rows.map(n=>`<article><small>${esc(n.type)} · ${esc(n.at)}</small><h2>${esc(n.headline)}</h2><p>${esc(n.body)}</p></article>`).join('')}
function renderJoker(){const page=q('#jokerPage');if(!page)return;if(!feature('feature.joker')){selectedJokerType=null;selectedJokerGameIndex=null;selectedJokerTarget=null;setText('#jokerFeedback','JOKER SIND IN DEN TURNIERSETTINGS DEAKTIVIERT.');return;}const p=userParticipant();setText('.utility-hero p',`${p?.name||'PLAYER'} · JOKER NUR AUF GEPLANTE SPIELE`,page);
 const states=state.jokers?.[p?.id]||{};const availableTypes=['DOUBLE_POINTS','PICK_OPPONENT'].filter(type=>states[type]==='AVAILABLE');const effectiveType=selectedJokerType||(availableTypes.length===1?availableTypes[0]:null);
 const planned=plannedJokerGames(),openRows=jokerOpenListGames(),gameList=q('#v1508JokerGameList',page);if(gameList){gameList.innerHTML=openRows.map(({g,gi})=>{const isPlanned=g.phase==='PLANNED',pending=isPlanned?userPendingSubmissionForGame(g):null,accepted=g?.joker?.accepted||null;const reason=isPlanned&&!pending?jokerIncompatibilityReason(g,effectiveType):'';const selected=isPlanned&&selectedJokerGameIndex===gi;let meta=pending?`<small>DEIN JOKER: ${esc(jokerTypeLabel(pending.type))}</small>`:'';if(!meta&&accepted){const publicMeta=jokerPublicMeta(g,p?.id);if(publicMeta)meta=`<small>${esc(publicMeta)}</small>`}let action='';if(!isPlanned)action=`<span class="v1526-joker-locked">${esc(jokerLockedStateLabel(g))}</span>`;else action=reason?`<span class="v1521-joker-incompatible">NICHT KOMPATIBEL · ${esc(reason)}</span>`:`<button class="v1521-joker-row-action ${pending?'secondary':''}" data-v15-joker-game="${gi}" ${pending?'data-v15-joker-change="true"':''} type="button">${pending?'JETZT ÄNDERN':'JOKER SETZEN'}</button>`;return `<div class="v1508-joker-game ${isPlanned?'can-submit':'is-locked'} ${selected?'selected':''}"><b>${String(gi+1).padStart(2,'0')}</b><div class="v1521-joker-game-copy"><strong>${esc(g.name)}</strong>${meta}</div><div class="v1521-joker-row-end">${action}</div></div>`}).join('')||'<div class="v1521-joker-empty">KEINE OFFENEN SPIELE FÜR JOKER.</div>'}
 const concluded=q('#v1521JokerConcludedGameList',page);if(concluded){const rows=(state.games||[]).map((g,gi)=>({g,gi})).filter(x=>isJokerHistoryGame(x.g));concluded.innerHTML=rows.map(({g,gi})=>`<div class="v1508-joker-game is-concluded"><b>${String(gi+1).padStart(2,'0')}</b><div class="v1521-joker-game-copy"><strong>${esc(g.name)}</strong></div><div class="v1521-joker-row-end">${jokerHistoryMarkup(g)}</div></div>`).join('')||'<div class="v1521-joker-empty">NOCH KEINE ABGESCHLOSSENEN SPIELE.</div>'}
 qa('[data-joker-type]',page).forEach(b=>{const type=b.dataset.jokerType==='double_points'?'DOUBLE_POINTS':'PICK_OPPONENT',available=states[type]==='AVAILABLE',g=state.games?.[selectedJokerGameIndex],applicable=type!=='PICK_OPPONENT'||!g||pickOpponentAllowedForGame(g);b.disabled=!available||!applicable;b.classList.toggle('selected',selectedJokerType===type);const st=q(`[data-joker-state="${type}"]`,b);if(st)st.textContent=available?'VERFÜGBAR':'VERBRAUCHT'});
 const g=state.games?.[selectedJokerGameIndex],sel=q('#v1508JokerSelection',page);if(sel){sel.hidden=!g||g.phase!=='PLANNED';if(g&&g.phase==='PLANNED'){setText('#v1508JokerSelectionTitle',`${String(selectedJokerGameIndex+1).padStart(2,'0')} · ${g.name}`);setText('#v1508JokerSelectionCopy',selectedJokerType?`${jokerTypeLabel(selectedJokerType)} · Solange das Game PLANNED ist, kannst du die Auswahl noch ändern.`:'Wähle oben einen verfügbaren Joker.')}}
 const pending=g?userPendingSubmissionForGame(g):null,lock=q('#lockJokerBtn',page),withdraw=q('#withdrawJokerBtn',page);if(lock){lock.disabled=!g||g.phase!=='PLANNED'||!selectedJokerType||states[selectedJokerType]!=='AVAILABLE'||(selectedJokerType==='PICK_OPPONENT'&&!pickOpponentAllowedForGame(g));lock.textContent=pending&&pending.type===selectedJokerType?'JOKER AKTUALISIEREN':'JOKER EINSETZEN'}if(withdraw){withdraw.hidden=!pending;withdraw.dataset.gameIndex=pending?String(selectedJokerGameIndex):''}
 const current=gameNow(),accepted=current?.joker?.accepted,ownPick=current?.phase==='PREPARING'&&current?.joker?.awaitingPick&&accepted?.type==='PICK_OPPONENT'&&accepted?.participantId===p?.id;const targets=q('#jokerTargets',page);if(targets){targets.hidden=!ownPick;const host=q('#v1508JokerOpponents',targets);if(host&&ownPick)host.innerHTML=state.participants.filter(x=>x.id!==p.id).map(x=>`<button data-v15-joker-target="${esc(x.id)}" type="button" class="v20-choice-card ${selectedJokerTarget===x.id?'selected':''}"><i class="${marker(x.color)}"></i><span><strong>${esc(x.name)}</strong></span></button>`).join('');const confirm=q('#confirmJokerOpponentBtn',targets);if(confirm)confirm.disabled=!selectedJokerTarget}
 let feedback='';if(ownPick)feedback=`${current.name} · DEIN GEGNER-WÄHLEN-JOKER WURDE AKZEPTIERT.`;else if(pending)feedback=`${jokerTypeLabel(pending.type)} · GESETZT FÜR ${g?.name||'SPIEL'} · SOLANGE GEPLANT ÄNDERBAR.`;else if(!planned.length)feedback='AKTUELL KEIN GEPLANTES SPIEL FÜR EINEN JOKER VERFÜGBAR.';else feedback='Joker können auf geplante Spiele gelegt, geändert oder zurückgezogen werden.';setText('#jokerFeedback',feedback)}
function renderVote(){const g=gameNow(),page=q('#mvpVotePage');if(!page)return;const vote=g?.vote,type=vote?.type||'MVP';setText('.utility-hero h1',type==='LVP'?'WER WAR DER DORSCH?':'WER WAR MVP?',page);setText('.utility-hero p',`${g?.name||'GAME'} · GAME ${state.currentGameIndex+1}`,page);let info=q('#v15VotePolicy',page);if(!info){info=document.createElement('p');info.id='v15VotePolicy';info.className='v15-vote-policy';q('.utility-panel',page)?.prepend(info)}info.textContent=type==='LVP'?'Du kannst jeden anderen Player wählen – auch deinen eigenen Teampartner. Nur du selbst bist ausgeschlossen.':'Du kannst weder dich selbst noch deinen Teampartner wählen. Voter-Identitäten bleiben vertraulich.';const grid=q('#mvpCandidateGrid',page);const eligible=eligibleCandidates(state.userActorId,type);if(grid)grid.innerHTML=eligible.map(a=>{const p=actorParticipant(a);return `<button class="candidate-card v20-choice-card ${selectedMvpCandidate===a.id?'selected':''}" data-v15-vote-candidate="${esc(a.id)}" type="button"><i class="${marker(p?.color)}"></i><span><small>${esc(p?.name||'')}</small><strong>${esc(a.name)}</strong></span></button>`}).join('');const submit=q('#submitMvpVote');if(submit){submit.disabled=!selectedMvpCandidate||!!vote?.votes?.[state.userActorId]||vote?.finalized;submit.textContent=vote?.votes?.[state.userActorId]?'STIMME GESPEICHERT':(type==='LVP'?'LVP STIMME ABGEBEN':'STIMME ABGEBEN')}setText('#mvpFeedback',vote?.votes?.[state.userActorId]?`STIMME GESPEICHERT · ${Number(vote.serverSubmittedCount??Object.keys(vote.votes).length)}/${Number(vote.serverRequiredCount??voteActors().length)} EINGEGANGEN`:vote?'DEINE STIMME IST VERTRAULICH.':'AKTUELL KEINE WAHL OFFEN.')}
function renderAll(){if(!state)return;syncBettingFeatureVisibility();syncBettingLiveIndicator();syncProfileSubnavVisibility(currentPage);syncJokerFeatureVisibility();renderHome();renderMatches();renderRanking();if(feature('feature.betting'))renderBets();renderAdmin();renderGameControl();renderGames();renderProfile();renderNews();renderJoker();renderVote();refreshOpenMatchDetail();updateTheme();}

function show(name,historyMode='push'){if(!state)return;if(name==='bets'&&!feature('feature.betting'))name='home';if(name==='joker'&&!feature('feature.joker'))name='home';if(name!=='gameControl'&&currentPage==='gameControl')gameControlContext=null;syncBettingFeatureVisibility();syncBettingLiveIndicator();syncProfileSubnavVisibility(name);syncJokerFeatureVisibility();const id=PAGE_IDS[name]||PAGE_IDS.home;Object.values(PAGE_IDS).forEach(pid=>q('#'+pid)?.classList.remove('active'));q('#'+id)?.classList.add('active');currentPage=name;document.body.classList.toggle('news-open',name==='news');qa('.sk-header__nav [data-page],.main-nav [data-page],.mobile-nav [data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===name||(name==='matchDetail'&&a.dataset.page==='matches')));if(name==='bets')renderBets();if(name==='mvpVote')renderVote();if(name==='joker'){pendingPickDismissedFor=null;renderJoker();refreshServerJokerBoard(false).then(()=>{renderJoker();if(serverJokerBoard?.pending_pick)openPendingPickDialog(serverJokerBoard.pending_pick)})}if(name==='gameControl')renderGameControl();if(name==='profile')renderProfile();window.scrollTo({top:0,behavior:'auto'});if(historyMode!=='none'&&!window.skielsenHistory?.isRestoring()){const navData={tournamentId:runtime?.tournament_id||null};if(name==='matchDetail'&&selectedMatchDetailId)navData.matchId=selectedMatchDetailId;if(name==='gameControl'&&gameControlContext){navData.matchId=gameControlContext.matchId||null;navData.returnPage=gameControlContext.returnPage||null}if(name==='bets'&&betReturnPage)navData.returnPage=betReturnPage;if(historyMode==='replace')window.skielsenHistory?.replace('tournament',name,navData);else window.skielsenHistory?.push('tournament',name,navData)}}
window.skielsenShow=show;

async function restoreTournamentHistory(entry){
 const name=PAGE_IDS[entry?.view]?entry.view:'home',data=entry?.data||{};
 if(!state)return;
 if(name==='matchDetail'){
   const found=matchContextById(data.matchId);
   if(found){selectedMatchDetailId=found.m.id;gameControlContext=null;show('matchDetail','none');refreshOpenMatchDetail();return}
   show('matches','none');return
 }
 if(name==='gameControl'&&data.matchId){const found=matchContextById(data.matchId);if(found)gameControlContext={matchId:found.m.id,tournamentGameId:found.g.tournament_game_id||null,returnPage:data.returnPage||'matchDetail'}}
 if(name==='bets')betReturnPage=data.returnPage||null;
 show(name,'none');
}
window.skielsenHistory?.register('tournament',restoreTournamentHistory);

function updateTheme(){if(!runtime)return;const theme=runtime.theme_pack_id||'theme.skielsen.core';document.body.dataset.themePack=theme;document.documentElement.dataset.themePack=theme;document.body.classList.add('v15-tournament-active');const anim=feature('feature.theme_animations');document.body.dataset.themeAnimations=anim?'true':'false';document.documentElement.dataset.themeAnimations=anim?'true':'false';const styles=getComputedStyle(document.body),rootCanvas=styles.getPropertyValue('--theme-root-canvas').trim()||styles.getPropertyValue('--theme-page').trim()||'#e9e9e9',browserColor=styles.getPropertyValue('--theme-browser-color').trim()||rootCanvas;document.documentElement.style.backgroundColor=rootCanvas;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',browserColor);const player=userParticipant();if(player)document.documentElement.style.setProperty('--player',({BLUE:'#1515ff',RED:'#ff1717',YELLOW:'#f2b705',GREEN:'#00a65a'}[player.color]||'var(--theme-accent)'))}
function setupHeader(){qa('.sk-header__version,.sk-header__meta').forEach(version=>version.textContent=(version.textContent||'').replace(/V\d+(?:\.\d+){1,2}/,'V'+VERSION));q('#v15TestRibbon')?.remove()}

function resetTransientTournamentPresentation(){
 clearJokerRevealTimers();jokerRevealRunning=false;jokerRevealGameIndex=-1;jokerRevealConfig=null;
 if(flowToastTimer){clearTimeout(flowToastTimer);flowToastTimer=0}
 matchResultContinuation=null;pendingUnifiedResult=null;awardRevealGameIndex=-1;awardRevealType=null;
 pendingPickDialogGameId=null;pendingPickDismissedFor=null;jokerMultiDialogOpenedAt=0;
 ['#matchResultPop','#mvpCompletePopup','#v1510JokerDialog','#v1511JokerResolutionDialog','#v1530JokerRevealDialog','#v1530JokerMultiDialog','#v1536PickOpponentOverlay','#v1536ResultConfirmModal','#v1517FlowToast'].forEach(sel=>{
   const el=q(sel);if(!el)return;el.hidden=true;el.classList.remove('is-visible','show');
 });
}

async function leaveTournamentToAccountHome(){
 resetTransientTournamentPresentation();
 clearTimeout(saveTimer);
 await saveState();
 if(jokerBoardPollTimer){clearInterval(jokerBoardPollTimer);jokerBoardPollTimer=0}
 if(jokerPollTimer){clearInterval(jokerPollTimer);jokerPollTimer=0}
 stopBettingPolling();stopVotePolling();
 q('#v15TestRibbon')?.remove();
 document.body.classList.remove('v15-tournament-active');delete document.body.dataset.themePack;delete document.body.dataset.themeAnimations;delete document.documentElement.dataset.themePack;delete document.documentElement.dataset.themeAnimations;document.documentElement.style.backgroundColor='';
 if(typeof window.skielsenOpenAccountHome==='function'){
   await window.skielsenOpenAccountHome();
   return true;
 }
 return false;
}

async function handleMatchDetailControlAction(btn){
 if(!btn||btn.disabled||!state)return false;
 const g=gameNow(),m=matchNow();if(!g||!m)return false;
 const original=btn.textContent;
 if(g.phase==='PLANNED'){
   if(!isAdmin())return false;
   btn.disabled=true;btn.textContent='WIRD VORBEREITET…';
   try{await prepareCurrentGame();renderAll();saveSoon();return true}
   finally{if(btn.isConnected&&btn.textContent==='WIRD VORBEREITET…'){btn.disabled=false;btn.textContent=original}}
 }
 if(g.phase==='PREPARING'&&g.joker?.awaitingPick){
   const own=g.joker?.accepted?.participantId===state.userParticipantId&&serverJokerBoard?.pending_pick;
   if(own){openPendingPickDialog(serverJokerBoard.pending_pick);return true}
   return false
 }
 btn.disabled=true;btn.textContent='MATCH STARTET…';
 const ok=await startMatch();
 if(!ok&&btn.isConnected){btn.disabled=false;refreshOpenMatchDetail()}
 return ok
}

function bind(){if(bound)return;bound=true;
 document.addEventListener('click',e=>{if(!state)return;const matchStart=e.target.closest?.('#v1536MatchControlStart');if(matchStart){e.preventDefault();e.stopImmediatePropagation();void handleMatchDetailControlAction(matchStart);return}const accountHome=e.target.closest('[data-skielsen-account-home]');if(accountHome){e.preventDefault();e.stopImmediatePropagation();void leaveTournamentToAccountHome();return}const mc=e.target.closest('[data-v15-match]');if(mc){e.preventDefault();e.stopImmediatePropagation();const m=state.games.flatMap(g=>g.matches||[]).find(x=>x.id===mc.dataset.v15Match);if(m)openMatchDetail(m);return}const nav=e.target.closest('[data-page]');if(nav){const page=nav.dataset.page;if(PAGE_IDS[page]){e.preventDefault();e.stopImmediatePropagation();if(page==='bets')betReturnPage=null;show(page);return}}const back=e.target.closest('[data-context-back]');if(back){e.preventDefault();e.stopImmediatePropagation();const nav=window.skielsenHistory?.current();if(nav?.area==='tournament'&&currentPage!=='home'){window.skielsenHistory.back();return}if(currentPage==='gameControl')returnFromGameControl();else show('home');return}},true);
 document.addEventListener('keydown',e=>{if(!state||!['Enter',' '].includes(e.key)||!e.target.closest?.('[data-skielsen-account-home]'))return;e.preventDefault();e.stopImmediatePropagation();void leaveTournamentToAccountHome()},true);
 q('#betsPage')?.addEventListener('click',e=>{const pick=e.target.closest('[data-v15-bet-pick]');if(pick){selectedBetParticipant=pick.dataset.v15BetPick;renderBets();return}const preset=e.target.closest('[data-stake]');if(preset){const r=q('#stakeRange');if(r){r.value=Math.min(Number(preset.dataset.stake),Number(r.max));renderBets()}}});
 q('#matchBetButton')?.addEventListener('click',()=>{betReturnPage='matchDetail';show('bets')});
 q('#stakeRange')?.addEventListener('input',updateBetSlip);q('#customStake')?.addEventListener('change',e=>{let v=clamp(Number(e.target.value)||0,0,currentWallet());const r=q('#stakeRange');if(r){r.value=v;renderBets()}});
 q('#placeBetBtn')?.addEventListener('click',async()=>{const m=matchNow(),snap=m?state.oddsSnapshots[m.id]:null;if(!m||!selectedBetParticipant||userBetDecision())return;const stake=Number(q('#stakeRange')?.value||0),sel=selectionSnapshot(snap,selectedBetParticipant),odds=sel?.odds;if(!odds)return;if(await placeBetFor(state.userActorId,selectedBetParticipant,stake,odds)){addAudit('BET PLACED · '+userActor().name+' · '+teamName(participant(selectedBetParticipant))+' · '+stake);renderAll();saveSoon();returnFromBetting()}});
 q('#prototypeSkipBet')?.addEventListener('click',async()=>{if(await skipBetFor(state.userActorId)){addAudit('BET SKIPPED · '+userActor().name);renderAll();saveSoon();returnFromBetting()}});
 q('#prototypeOtherBets')?.addEventListener('click',simulateOtherBets);q('#prototypeOtherMvp')?.addEventListener('click',simulateOtherVotes);q('#prototypeAutofill')?.addEventListener('click',autofillScore);
 q('#adminThemeSelect')?.addEventListener('change',async e=>{
   if(!isAdmin()||!client||!runtime?.tournament_id)return;
   const select=e.currentTarget,next=select.value,previous=runtime.theme_pack_id||'theme.skielsen.core',feedback=q('#adminThemeFeedback');
   select.disabled=true;if(feedback)feedback.textContent='THEME WIRD GESPEICHERT…';
   try{
     const {data,error}=await client.rpc('set_tournament_theme_pack',{p_tournament_id:runtime.tournament_id,p_theme_pack_id:next});
     if(error)throw error;
     runtime.theme_pack_id=data?.theme_pack_id||next;
     updateTheme();renderAll();saveSoon();
     addAudit('ADMIN THEME · '+runtime.theme_pack_id);
     if(feedback)feedback.textContent='AKTIV · '+String(data?.theme_name||runtime.theme_pack_id).toUpperCase();
     showFlowToast('ADMIN','THEME AKTUALISIERT',String(data?.theme_name||runtime.theme_pack_id).toUpperCase(),1800);
   }catch(err){
     console.error('Theme update failed',err);
     select.value=previous;
     runtime.theme_pack_id=previous;updateTheme();
     if(feedback)feedback.textContent='FEHLER · '+String(err?.message||err);
   }finally{select.disabled=false}
 });
 q('#prototypeReset')?.addEventListener('click',async()=>{
 if(!isAdmin()||!client||!runtime?.tournament_id)return;
 if(!confirm('TURNIER KOMPLETT ZURÜCKSETZEN?\n\nGelöscht werden laufende Matches, Ergebnisse, Betting, Wallets, Votes/Awards, Joker-Submissions, In-App-Sessions, News und Runtime-Daten.\n\nGames, Reihenfolge, Teilnehmer, Teams und Feature-Settings bleiben erhalten.'))return;
 const btn=q('#prototypeReset'),oldLabel=btn?.textContent||'TURNIER KOMPLETT RESETTEN';
 if(btn){btn.disabled=true;btn.textContent='TURNIER WIRD RESETTET…'}
 try{
   stopBettingPolling();stopVotePolling();
   if(jokerBoardPollTimer){clearInterval(jokerBoardPollTimer);jokerBoardPollTimer=0}
   if(jokerPollTimer){clearInterval(jokerPollTimer);jokerPollTimer=0}
   const {data,error}=await client.rpc('reset_tournament_runtime_state',{p_tournament_id:runtime.tournament_id});
   if(error)throw error;if(!data?.reset)throw new Error('RESET_NOT_CONFIRMED');
   state=defaultState(runtime);
   selectedBetParticipant=null;selectedMvpCandidate=null;selectedJokerType=null;selectedJokerGameIndex=null;selectedJokerTarget=null;selectedMatchDetailId=null;gameControlContext=null;serverJokerBoard=null;serverBettingState=null;serverVoteState=null;inlineResultMatchId=null;pendingUnifiedResult=null;matchResultContinuation=null;
   await refreshServerJokerBoard(false);primeJokerNotificationBaseline(serverJokerBoard);enforceGameLifecycleInvariant(state);startJokerBoardPolling();
   addAudit('ADMIN RESET · TURNIERLAUF VOLLSTÄNDIG ZURÜCKGESETZT');
   renderAll();show('home');saveSoon();
   showFlowToast('ADMIN','TURNIER ZURÜCKGESETZT',`${Number(data.games_reset||0)} GAMES · ${Number(data.matches_deleted||0)} MATCHES · NEUER LAUF BEREIT`,2600);
 }catch(err){
   console.error('Tournament runtime reset failed',err);
   alert('TURNIER-RESET FEHLGESCHLAGEN. SERVERZUSTAND WURDE NICHT VOLLSTÄNDIG ZURÜCKGESETZT.\n\n'+String(err?.message||err));
 }finally{if(btn){btn.disabled=false;btn.textContent=oldLabel}}
});
 q('#gameControlStart')?.addEventListener('click',async e=>{const sel=gameControlSelection(),g=sel.g;if(!sel.isCurrent||e.currentTarget.disabled)return;if(g?.phase==='PLANNED'){if(!isAdmin())return;e.currentTarget.disabled=true;await prepareCurrentGame();renderAll();saveSoon();return}e.currentTarget.disabled=true;await startMatch();renderGameControl()});
 q('#mvpCandidateGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-v15-vote-candidate]');if(!b)return;selectedMvpCandidate=b.dataset.v15VoteCandidate;renderVote()});q('#submitMvpVote')?.addEventListener('click',async()=>{const g=gameNow();if(!g?.vote||!selectedMvpCandidate)return;if(await submitVote(state.userActorId,selectedMvpCandidate)){selectedMvpCandidate=null;renderAll();saveSoon()}});
 q('#jokerPage')?.addEventListener('click',e=>{const game=e.target.closest('[data-v15-joker-game]');if(game){selectedJokerGameIndex=Number(game.dataset.v15JokerGame);if(game.dataset.v15JokerChange==='true'){const pending=userPendingSubmissionForGame(state.games?.[selectedJokerGameIndex]);if(pending)selectedJokerType=pending.type}renderJoker();return}const type=e.target.closest('[data-joker-type]');if(type){selectedJokerType=type.dataset.jokerType==='double_points'?'DOUBLE_POINTS':'PICK_OPPONENT';selectedJokerTarget=null;renderJoker();return}const tar=e.target.closest('[data-v15-joker-target]');if(tar){selectedJokerTarget=tar.dataset.v15JokerTarget;renderJoker()}});q('#lockJokerBtn')?.addEventListener('click',openJokerConfirmation);q('#withdrawJokerBtn')?.addEventListener('click',async e=>{const gi=Number(e.currentTarget.dataset.gameIndex);if(Number.isInteger(gi))await withdrawUserJoker(gi)});q('#confirmJokerOpponentBtn')?.addEventListener('click',confirmJokerOpponent);
 q('#v1510JokerDialogCancel')?.addEventListener('click',closeJokerDialog);
 q('#v1510JokerDialog')?.addEventListener('click',e=>{if(e.target.closest('[data-v1510-joker-close]'))closeJokerDialog()});
 q('#v1510JokerDialogConfirm')?.addEventListener('click',async e=>{if(jokerDialogMode!=='confirm')return;e.currentTarget.disabled=true;e.currentTarget.textContent='WIRD GESPEICHERT…';const ok=await submitUserJoker();if(ok){renderJoker();showJokerSuccess()}else{e.currentTarget.disabled=false;e.currentTarget.textContent='JOKER EINSETZEN'}});
 q('#v1536BetSavedContinue')?.addEventListener('click',()=>{const d=q('#v1536BetSavedModal');if(d)d.hidden=true});
 q('#v1536ResultConfirmContinue')?.addEventListener('click',()=>v1536CommitPendingResult());
 q('#v1536PickChoiceGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-v1536-pick-target]');if(!b)return;selectedJokerTarget=b.dataset.v1536PickTarget;qa('[data-v1536-pick-target]',q('#v1536PickChoiceGrid')).forEach(x=>x.classList.toggle('selected',x===b));const c=q('#v1536PickConfirm');if(c){c.disabled=false;c.classList.add('ready')}});
 q('#v1536PickConfirm')?.addEventListener('click',()=>confirmJokerOpponent());
 q('#v1511OpponentChoices')?.addEventListener('click',e=>{const b=e.target.closest('[data-v1511-pick-target]');if(!b)return;selectedJokerTarget=b.dataset.v1511PickTarget;qa('[data-v1511-pick-target]',q('#v1511OpponentChoices')).forEach(x=>x.classList.toggle('selected',x===b));const c=q('#v1511JokerResolutionConfirm');if(c)c.disabled=false});
 q('#v1511JokerResolutionConfirm')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;e.currentTarget.textContent='WIRD GESPEICHERT…';const ok=await confirmJokerOpponent();if(!ok){e.currentTarget.disabled=false;e.currentTarget.textContent='GEGNER FESTLEGEN'}});
 q('#v1511JokerResolutionClose')?.addEventListener('click',()=>{const d=q('#v1511JokerResolutionDialog'),after=d?.dataset.afterClose||'',revealIndex=Number(d?.dataset.revealGameIndex);if(d){delete d.dataset.afterClose;delete d.dataset.revealGameIndex}closeJokerResolutionDialog();if(after==='matches')show('matches');else if(after==='postgame'){const g=Number.isInteger(revealIndex)?state.games?.[revealIndex]:gameNow();if(g){g.joker=g.joker||{};g.joker.revealAcknowledged=true;startPostGameVote(g);renderAll();saveSoon();setTimeout(routeToCurrentWork,0)}}});


 q('#v1530JokerRevealStart')?.addEventListener('click',playJokerReveal);
 q('#v1530JokerRevealContinue')?.addEventListener('click',()=>closeJokerRevealDialog(true));
 q('#mvpCompletePopup')?.setAttribute('hidden','');q('#mvpShowResult')?.addEventListener('click',revealVoteWinner);q('#mvpResultContinue')?.addEventListener('click',continueVoteReveal);
 q('#matchResultPop')?.setAttribute('hidden','');q('#resultPopMvp')?.setAttribute('hidden','');q('#resultPopClose')?.addEventListener('click',closeResultPopup);
 q('#playerProfileSelect')?.addEventListener('change',e=>{state.selectedProfileActorId=e.target.value;renderProfile();saveSoon()});
 q('#gamesPage')?.addEventListener('click',e=>{const c=e.target.closest('[data-v15-game-card]');if(c){renderGameInfo(Number(c.dataset.v15GameCard));return}if(e.target.closest('[data-v15-close-game]')){q('#v15GameInfo').hidden=true;gridHide(false)}});
 q('#publishAdminNews')?.addEventListener('click',()=>{const input=q('#adminNewsInput'),raw=input?.value.trim();if(!raw)return;addNews('ADMIN STORY.',raw,feature('feature.roast_news')?'ROAST NEWS':'ADMIN');addAudit('NEWS PUBLISHED · ADMIN');if(input)input.value='';renderAll();saveSoon()});
 q('#applyCoinAdjustment')?.addEventListener('click',()=>{const who=q('#coinAdjustPlayer')?.value,amount=Number(q('#coinAdjustAmount')?.value),reason=q('#coinAdjustReason')?.value.trim();let a=state.actors.find(x=>x.id===who)||state.actors.find(x=>x.name.toUpperCase()===String(who).toUpperCase())||userActor();if(!a||!Number.isFinite(amount)||!reason){setText('#coinAdjustFeedback','PLAYER, BETRAG UND GRUND SIND PFLICHT.');return}state.wallets[a.id]=Math.max(0,Number(state.wallets[a.id]||0)+amount);state.transactions.push({id:'tx-adj-'+Date.now(),type:'ADMIN_ADJUSTMENT',actorId:a.id,amount,at:nowLabel(),reason});addAudit(`COIN ADJUSTMENT · ${a.name} · ${amount>=0?'+':''}${amount} · ${reason}`);setText('#coinAdjustFeedback','GESPEICHERT · AUDIT LOG AKTUALISIERT.');renderAll();saveSoon()});
}

async function hydrateCanonicalTournamentResults(target,rt){
 if(!target||!client||!rt?.tournament_id||rt.test_mode)return target;
 const ps=Array.isArray(target.participants)?target.participants:[],rankings=target.rankings||(target.rankings={});
 ps.forEach(p=>{
   const prev=rankings[p.id]||{};
   rankings[p.id]={...prev,points:0,first:0,second:0,third:0,last:0,mvp:0,lvp:0,bonus:0};
 });
 const gameIds=(Array.isArray(rt.games)?rt.games:target.games||[]).map(g=>g?.tournament_game_id).filter(Boolean);
 if(!gameIds.length)return target;
 let placements=[],ledger=[],awardStates=[],placementError=null,ledgerError=null;
 try{
   const pr=await client.from('game_placements')
     .select('tournament_game_id,participant_id,placement,base_points,multiplier,final_points,created_at')
     .in('tournament_game_id',gameIds)
     .order('placement',{ascending:true});
   placements=Array.isArray(pr.data)?pr.data:[];placementError=pr.error||null;
 }catch(e){placementError=e}
 try{
   const lr=await client.from('points_ledger')
     .select('participant_id,source_type,source_id,points_delta,reason,created_at')
     .eq('tournament_id',rt.tournament_id);
   ledger=Array.isArray(lr.data)?lr.data:[];ledgerError=lr.error||null;
 }catch(e){ledgerError=e}
 const voteTypes=requiredPostGameVoteTypes();
 if(voteTypes.length&&gameIds.length){
   const requests=[];
   for(const tournamentGameId of gameIds)for(const type of voteTypes){
     requests.push(client.rpc('get_tournament_vote_state',{p_tournament_game_id:tournamentGameId,p_vote_type:type})
       .then(({data,error})=>({tournamentGameId,type,data,error}))
       .catch(error=>({tournamentGameId,type,data:null,error})));
   }
   awardStates=await Promise.all(requests);
 }
 if(placementError)console.warn('V15 canonical game placements hydrate',placementError);
 if(ledgerError)console.warn('V15 canonical points ledger hydrate',ledgerError);

 const byGame=new Map();
 placements.forEach(row=>{
   const r=rankings[row.participant_id];
   if(r){
     const place=Number(row.placement)||0;
     if(place===1)r.first++;
     else if(place===2)r.second++;
     else if(place===3)r.third++;
     else if(place===4)r.last++;
   }
   if(row.tournament_game_id){
     if(!byGame.has(row.tournament_game_id))byGame.set(row.tournament_game_id,[]);
     byGame.get(row.tournament_game_id).push(row);
   }
 });
 if(!ledgerError){
   ledger.forEach(row=>{
     const r=rankings[row.participant_id];if(!r)return;
     const delta=Number(row.points_delta)||0;r.points+=delta;
     const src=String(row.source_type||'').toUpperCase(),reason=String(row.reason||'').toUpperCase();
     if(src.includes('BONUS')||reason.includes('BONUS'))r.bonus+=delta;
   });
 }else{
   placements.forEach(row=>{const r=rankings[row.participant_id];if(r)r.points+=Number(row.final_points)||0});
 }
 const awardsByGame=new Map();
 for(const item of awardStates){
   if(item.error){console.warn('V15 canonical vote history hydrate',item.type,item.error);continue}
   const data=item.data;
   if(data?.status!=='FINALIZED'||!data.award)continue;
   const row={tournament_game_id:item.tournamentGameId,award_type:item.type,winner_member_id:data.award.winner_member_id||null,winner_participant_id:data.award.winner_participant_id||null,vote_count:Number(data.award.vote_count||0),submitted_count:Number(data.submitted_count||0)};
   const r=rankings[row.winner_participant_id],type=String(row.award_type||'').toUpperCase();
   if(r){
     if(type==='MVP')r.mvp++;
     else if(type==='LVP')r.lvp++;
   }
   if(!awardsByGame.has(row.tournament_game_id))awardsByGame.set(row.tournament_game_id,[]);
   awardsByGame.get(row.tournament_game_id).push(row);
 }
 const requiredAwards=voteTypes;
 (target.games||[]).forEach(g=>{
   const rows=(byGame.get(g.tournament_game_id)||[]).slice().sort((a,b)=>Number(a.placement)-Number(b.placement));
   if(rows.length){
     g.placements=rows.map(row=>row.participant_id);
     g.resultsCommitted=true;
     g.joker=g.joker||{submissions:[],accepted:null,resolved:true,locked:true,awaitingPick:false};
     g.joker.revealed=true;g.joker.revealAcknowledged=true;
   }
   const gameAwards=awardsByGame.get(g.tournament_game_id)||[];
   if(gameAwards.length){
     const results=ensurePostGameVoteResults(g);
     gameAwards.forEach(row=>{
       const type=String(row.award_type||'').toUpperCase();if(!type)return;
       results[type]={type,winnerActorId:row.winner_member_id||null,participantId:row.winner_participant_id||null,votes:Number(row.vote_count||0),totalVotes:Number(row.submitted_count||row.vote_count||0),counts:{},committed:true,server:true,revealAcknowledged:true};
     });
   }
   g.postGameServerComplete=!!rows.length&&(requiredAwards.length===0||requiredAwards.every(type=>!!g.postGameVoteResults?.[type]));
   if(g.postGameServerComplete)g.postGameReveal={index:requiredAwards.length,done:true};
 });
 const pendingPostGame=(target.games||[]).findIndex(g=>g.resultsCommitted&&!g.postGameServerComplete);
 if(pendingPostGame>=0){
   target.currentGameIndex=pendingPostGame;
   const g=target.games[pendingPostGame];g.phase='RESULTS';
   if(g.joker){g.joker.revealed=true;g.joker.revealAcknowledged=true}
 }
 return target;
}

async function activate(rt){resetTransientTournamentPresentation();runtime=rt;client=window.skielsenDb?.client||null;if(!client){console.error('V15: no Supabase client');return}try{const {data,error}=await client.from('participants').select('participant_id,participant_type,team_id,solo_member_id,identity_color,status,seed').eq('tournament_id',rt.tournament_id).eq('status','ACTIVE');if(!error&&Array.isArray(data))rt.participants=data;else if(error)console.warn('V15 participants hydrate',error)}catch(e){console.warn('V15 participants hydrate',e)}let loaded=null;if(rt.test_mode){try{const {data,error}=await client.rpc('get_tournament_test_runtime_state',{p_tournament_id:rt.tournament_id});if(!error&&data?.state)loaded=data.state}catch(e){console.warn(e)}}state=normalizeLoadedState(loaded,rt);if(!state.games?.length)state=defaultState(rt);await hydrateCanonicalTournamentResults(state,rt);ensureTournamentSchedule(state,state.participants);enforceGameLifecycleInvariant(state);selectedProfileActor=state.selectedProfileActorId||state.userActorId;document.getElementById('dbBootstrapOverlay')?.setAttribute('hidden','');document.body.classList.add('v15-tournament-active');setupHeader();bind();window.skielsenInApp?.start?.(runtime);await refreshServerJokerBoard(false);enforceGameLifecycleInvariant(state);startJokerBoardPolling();if(serverJokerBoard?.pending_pick){const pgi=(state.games||[]).findIndex(x=>x.tournament_game_id===serverJokerBoard.pending_pick.tournament_game_id);if(pgi===state.currentGameIndex)openPendingPickDialog(serverJokerBoard.pending_pick)}if(gameNow()?.phase==='PREPARING'&&gameNow()?.joker?.awaitingPick)startJokerResolutionPolling(gameNow());if(gameNow()?.phase==='ACTIVE'&&feature('feature.betting')){await refreshServerBettingState(gameNow(),matchNow());startBettingPolling();if(matchNow()?.status==='READY'&&!serverBettingState?.exists)openCurrentMarket(gameNow())}renderAll();syncJokerFeatureVisibility();const historyMode=rt.__historyMode||(window.skielsenHistory?.current()?.area==='workflow'?'push':'replace');show('home',historyMode);{const rg=gameNow();if(rg?.phase==='RESULTS'){if(rg.joker){rg.joker.revealed=true;rg.joker.revealAcknowledged=true}startPostGameVote(rg)}else if(['VOTING_MVP','VOTING_LVP'].includes(rg?.phase)){startPostGameVote(rg)}else if(rg?.phase==='AWARD_REVEAL'){const results=ensurePostGameVoteResults(rg);Object.values(results).forEach(r=>{if(r)r.revealAcknowledged=true});rg.postGameReveal={index:requiredPostGameVoteTypes().length,done:true};void advanceAfterVotes(true)}}saveSoon()}
window.skielsenV15Activate=activate;
window.skielsenV15={get state(){return state},get runtime(){return runtime},get gameControl(){return gameControlSelection()},render:renderAll,show,openGameControlForMatch,simulateOtherBets,simulateOtherVotes,prepareCurrentGame,beginPostGameFlow,startPostGameVote,beginPostGameAwardReveal,refreshServerBettingState,refreshServerVoteState,leaveToAccountHome:leaveTournamentToAccountHome};
})();
