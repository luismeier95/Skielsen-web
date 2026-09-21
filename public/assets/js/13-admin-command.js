(()=>{
'use strict';

const VERSION=window.SKIELSEN_VERSION||'15.1.81';
const HOLD_MS=2000;
let difficulty='NORMAL';
let holdButton=null,holdStarted=0,holdRaf=0,lastSignature='';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>window.skielsenV15||null;
const state=()=>api()?.state||null;
const runtime=()=>api()?.runtime||null;
const currentGame=()=>{const s=state();return s?.games?.[s.currentGameIndex||0]||null};
const currentMatch=()=>{const g=currentGame();return g?.matches?.[g.matchIndex||0]||null};
const feature=id=>!!(runtime()?.features||[]).find(f=>f.feature_id===id&&f.enabled);
const isTeamTournament=()=>String(runtime()?.mode||'').toUpperCase()==='TEAM';
const voteFeatureEnabled=type=>isTeamTournament()&&feature(String(type||'').toUpperCase()==='LVP'?'feature.lvp_voting':'feature.mvp_voting');
const voteFeaturesEnabled=()=>voteFeatureEnabled('MVP')||voteFeatureEnabled('LVP');
const isAdmin=()=>!!runtime()?.is_admin;

function ensureHost(){
  let host=document.getElementById('adminCommandBar');
  if(host)return host;
  host=document.createElement('section');
  host.id='adminCommandBar';
  host.className='admin-command-bar';
  host.hidden=true;
  host.setAttribute('aria-label','Admin Command');
  const header=document.querySelector('.sk-header');
  if(header)header.insertAdjacentElement('afterend',host);
  else document.body.prepend(host);
  return host;
}
function contextLabel(g,m){
  const s=state(),gi=Math.max(0,Number(s?.currentGameIndex||0))+1,gt=Math.max(1,Number(s?.games?.length||1));
  const matches=Array.isArray(g?.matches)?g.matches:[],mi=m?Math.max(0,matches.indexOf(m))+1:0;
  return 'SPIEL '+gi+'/'+gt+(mi?' · MATCH '+mi+'/'+Math.max(1,matches.length):'');
}
function readySnapshot(session){
  const rows=Array.isArray(session?.players)?session.players:[];
  const readyStates=new Set(['READY','PLAYING','FINISHED']);
  const ready=rows.filter(p=>readyStates.has(String(p?.status||'').toUpperCase())).length;
  const waiting=rows.filter(p=>!readyStates.has(String(p?.status||'').toUpperCase())).map(p=>String(p?.display_name||'PLAYER'));
  return {ready,total:rows.length,waiting};
}
function betProgress(m){
  const a=api(),s=state(),server=a?.serverBettingState;
  let max=Math.max(1,Number(s?.actors?.length||1));
  let value=Math.max(0,max-Number(a?.bettingPendingCount?.(m)||0));
  if(server?.market_id){
    max=Math.max(1,Number(server.required_count||max));
    value=Math.max(0,Number(server.decided_count||0));
  }
  return {value:Math.min(value,max),max};
}
function voteProgress(g){
  const a=api(),s=state(),server=a?.serverVoteState;
  let value=Object.keys(g?.vote?.votes||{}).length,max=Math.max(1,Number(s?.actors?.length||1));
  if(server?.vote_session_id){
    value=Math.max(0,Number(server.submitted_count||value));
    max=Math.max(1,Number(server.required_count||max));
  }else{
    value=Math.max(value,Number(g?.vote?.serverSubmittedCount||0));
    max=Math.max(1,Number(g?.vote?.serverRequiredCount||max));
  }
  return {value:Math.min(value,max),max};
}
function jokerCount(g){
  const local=(g?.joker?.submissions||[]).filter(x=>String(x?.status||'').toUpperCase()==='PENDING').length;
  return Math.max(local,Number(g?.joker?.resolutionSubmissionCount||0));
}
function inAppGame(g){
  return String(g?.tracker_type||'').toUpperCase()==='IN_APP_NATIVE'||String(g?.play_mode||g?.default_play_mode||'').toUpperCase()==='IN_APP';
}
function model(){
  const a=api(),s=state(),g=currentGame(),m=currentMatch(),context=contextLabel(g,m),session=window.skielsenInApp?.session||null;
  if(s?.tournamentDone)return {tone:'done',status:'ALLES ERLEDIGT',title:'TURNIER ABGESCHLOSSEN',copy:'Alle Games und Pflichtschritte sind abgeschlossen.',context,actions:[{id:'ranking',label:'ENDERGEBNIS',primary:true}]};

  if(session){
    const status=String(session.status||'').toUpperCase(),ready=readySnapshot(session);
    if(['WAITING_FOR_PLAYERS','READY','ASSIGNED','CONNECTED'].includes(status)&&ready.total&&ready.ready<ready.total){
      const missing=ready.total-ready.ready,names=ready.waiting.slice(0,2).join(', ');
      return {tone:'danger',status:'BLOCKER',title:missing+' SPIELER NOCH NICHT BEREIT',copy:ready.ready+' / '+ready.total+' bereit'+(names?' · Warte auf '+names+'.':''),context,actions:[{id:'live',label:'PLAYER STATUS',primary:true},{id:'match',label:'MATCH ANSEHEN'}]};
    }
    if(status==='READY')return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'IN-APP SESSION STARTBEREIT',copy:'Alle ausgewählten Geräte sind bereit. Öffne die Session und starte das Spiel.',context,actions:[{id:'live',label:'SESSION ÖFFNEN',primary:true},{id:'match',label:'MATCH ANSEHEN'}]};
    if(status==='ACTIVE'&&String(session.game?.module_key||'')==='word-chain'&&!String(session.public_state?.word_chain_difficulty||'')){
      return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'SCHWIERIGKEIT WÄHLEN — WORTKETTE',copy:'Alle Player verwenden denselben Schwierigkeitsgrad für diese Session.',context,selector:'difficulty',actions:[{id:'wordchain-difficulty',label:'AUSWÄHLEN',primary:true},{id:'live',label:'SPIEL ÖFFNEN'}]};
    }
    if(status==='ACTIVE')return {tone:'live',status:'MATCH LÄUFT',title:'KEINE ADMIN-AKTION ERFORDERLICH',copy:'Das In-App-Spiel läuft. Du kannst jederzeit direkt zurück ins Spiel wechseln.',context,actions:[{id:'live',label:'LIVE ANSEHEN',primary:true},{id:'match',label:'MATCH ANSEHEN'}]};
  }

  if(g?.vote&&!g.vote.finalized&&voteFeatureEnabled(g.vote.type)){
    const type=String(g.vote.type||'MVP').toUpperCase(),progress=voteProgress(g),ownDone=!!g.vote.votes?.[s?.userActorId];
    return {tone:'wait',status:'WARTET AUF PLAYER',title:type+'-WAHL LÄUFT',copy:progress.value+' von '+progress.max+' Stimmen eingegangen.'+(ownDone?' Deine Stimme ist gespeichert.':' Deine Stimme ist noch offen.'),context,progress,actions:[{id:'vote',label:ownDone?'VOTING STATUS':'JETZT ABSTIMMEN',primary:true}]};
  }
  if(g?.phase==='AWARD_REVEAL'&&voteFeaturesEnabled())return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'AWARD REVEAL',copy:'Die Abstimmung ist abgeschlossen. Das Ergebnis wartet auf den Reveal.',context,actions:[{id:'reveal',label:'REVEAL ANZEIGEN',primary:true}]};

  if(g?.phase==='PLANNED'){
    if(feature('feature.joker')){
      const count=jokerCount(g);
      return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'JOKERRUNDE SCHLIESSEN',copy:count?count+' Joker '+(count===1?'wurde':'wurden')+' für dieses Game gesetzt.':'Joker können noch gesetzt werden. Danach werden Pairings und nächster Schritt festgeschrieben.',context,actions:[{id:'prepare',label:'JOKERRUNDE SCHLIESSEN',primary:true},{id:'joker',label:'JOKER ANSEHEN'}]};
    }
    if(feature('feature.betting'))return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'BETTING ÖFFNEN',copy:'Der Wettmarkt ist der nächste Pflichtschritt vor dem Matchstart.',context,actions:[{id:'prepare',label:'BETTING ÖFFNEN',primary:true},{id:'match',label:'MATCH ANSEHEN'}]};
    return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'MATCH STARTEN',copy:'Der Match kann direkt gestartet werden.',context,actions:[{id:'start',label:'MATCH STARTEN',primary:true,hold:true},{id:'match',label:'MATCH ANSEHEN'}]};
  }
  if(g?.phase==='PREPARING'){
    const waits=feature('feature.joker')&&!!g?.joker?.awaitingPick;
    if(waits){
      const own=g.joker?.accepted?.participantId===s?.userParticipantId;
      return own
        ?{tone:'warning',status:'NÄCHSTER SCHRITT',title:'GEGNER AUSWÄHLEN',copy:'Dein PICK OPPONENT Joker wurde akzeptiert. Die Gegnerwahl blockiert den weiteren Ablauf.',context,actions:[{id:'pick',label:'GEGNER WÄHLEN',primary:true},{id:'match',label:'MATCH ANSEHEN'}]}
        :{tone:'wait',status:'WARTET AUF PLAYER',title:'WARTET AUF JOKER-AKTION',copy:'Ein akzeptierter PICK OPPONENT Joker muss zuerst abgeschlossen werden.',context,actions:[{id:'match',label:'STATUS ANSEHEN',primary:true}]};
    }
    return {tone:'wait',status:'VORBEREITUNG',title:'SPIEL WIRD VORBEREITET',copy:'Pairings und serverseitiger Lifecycle werden synchronisiert.',context,actions:[{id:'match',label:'STATUS ANSEHEN',primary:true}]};
  }
  if(feature('feature.betting')&&m?.status==='BETTING_OPEN'&&!a?.gateComplete?.(m)){
    const progress=betProgress(m),pending=Math.max(0,progress.max-progress.value);
    return {tone:'wait',status:'WARTET AUF PLAYER',title:'BETTING LÄUFT',copy:pending+' von '+progress.max+' Entscheidungen noch offen.',context,progress,actions:[{id:'match',label:'BETTING STATUS',primary:true}]};
  }
  if(m?.status==='READY'||(m?.status==='BETTING_OPEN'&&a?.gateComplete?.(m))){
    return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'MATCH STARTEN',copy:'Alle Vorbedingungen sind erfüllt.',context,actions:[{id:'start',label:'MATCH STARTEN',primary:true,hold:true},{id:'match',label:'MATCH ANSEHEN'}]};
  }
  if(m?.status==='LIVE'){
    if(inAppGame(g))return {tone:'live',status:'MATCH LÄUFT',title:'IN-APP GAME LÄUFT',copy:'Die Session liefert das Ergebnis automatisch an das Turnier.',context,actions:[{id:'live',label:'LIVE ANSEHEN',primary:true},{id:'match',label:'MATCH ANSEHEN'}]};
    return {tone:'warning',status:'NÄCHSTER SCHRITT',title:'ERGEBNIS EINTRAGEN',copy:'Der Match läuft. Sobald das Endergebnis feststeht, trägst du es im Match ein.',context,actions:[{id:'match',label:'ERGEBNIS ERFASSEN',primary:true}]};
  }
  if(g?.phase==='RESULTS'){const parts=['Punkte'];if(feature('feature.joker'))parts.push('Joker');if(voteFeaturesEnabled())parts.push('Votes');return {tone:'wait',status:'AUSWERTUNG',title:'ERGEBNIS WIRD VERARBEITET',copy:parts.join(', ')+' werden für den nächsten Schritt vorbereitet.',context,actions:[{id:'match',label:'MATCH ANSEHEN',primary:true}]};}
  return {tone:'wait',status:'TURNIER LÄUFT',title:g?.name||'AKTUELLER TURNIERSTATUS',copy:'Der nächste operative Schritt wird aus dem aktuellen Turnierzustand ermittelt.',context,actions:[{id:'match',label:'MATCH ANSEHEN',primary:true}]};
}
function actionMarkup(action){
  const cls='admin-command-action '+(action.primary?'primary':'secondary')+(action.hold?' is-hold':'');
  return '<button class="'+cls+'" type="button" data-admin-command-action="'+esc(action.id)+'"'+(action.hold?' data-admin-command-hold="true" aria-label="'+esc(action.label)+' · gedrückt halten"':'')+'>'+(action.hold?'<span class="admin-command-hold-fill" aria-hidden="true"></span>':'')+'<span class="admin-command-action-label">'+esc(action.label)+'</span>'+(action.primary?'<b aria-hidden="true">→</b>':'')+'</button>';
}
function cancelHold(button=holdButton){
  if(!button||button!==holdButton)return;
  cancelAnimationFrame(holdRaf);holdRaf=0;holdStarted=0;holdButton=null;
  button.classList.remove('is-holding');button.style.setProperty('--admin-command-hold','0%');
}
function beginHold(button){
  if(!button||button.disabled||holdButton===button)return;
  if(holdButton)cancelHold(holdButton);
  holdButton=button;holdStarted=performance.now();button.classList.add('is-holding');button.style.setProperty('--admin-command-hold','0%');
  const tick=now=>{
    if(holdButton!==button)return;
    const progress=Math.max(0,Math.min(1,(now-holdStarted)/HOLD_MS));
    button.style.setProperty('--admin-command-hold',(progress*100).toFixed(1)+'%');
    if(progress>=1){
      cancelAnimationFrame(holdRaf);holdRaf=0;holdButton=null;holdStarted=0;
      button.classList.remove('is-holding');button.classList.add('is-confirmed');button.style.setProperty('--admin-command-hold','100%');button.disabled=true;
      void runAction(button.dataset.adminCommandAction);
      return;
    }
    holdRaf=requestAnimationFrame(tick);
  };
  holdRaf=requestAnimationFrame(tick);
}
function bind(host){
  host.querySelectorAll('[data-admin-command-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{
    difficulty=String(btn.dataset.adminCommandDifficulty||'NORMAL').toUpperCase();
    lastSignature='';render();
  }));
  host.querySelectorAll('[data-admin-command-action]').forEach(btn=>{
    const hold=btn.dataset.adminCommandHold==='true';
    if(!hold){btn.addEventListener('click',()=>void runAction(btn.dataset.adminCommandAction));return;}
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
    btn.addEventListener('pointerdown',e=>{if(btn.disabled)return;e.preventDefault();try{btn.setPointerCapture(e.pointerId);}catch(_){}beginHold(btn);});
    btn.addEventListener('pointerup',()=>cancelHold(btn));
    btn.addEventListener('pointercancel',()=>cancelHold(btn));
    btn.addEventListener('lostpointercapture',()=>cancelHold(btn));
    btn.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();beginHold(btn);}});
    btn.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();cancelHold(btn);}});
    btn.addEventListener('blur',()=>cancelHold(btn));
    btn.addEventListener('contextmenu',e=>e.preventDefault());
  });
}
async function runAction(action){
  const a=api(),g=currentGame(),m=currentMatch(),host=ensureHost();
  host.querySelectorAll('button').forEach(btn=>btn.disabled=true);
  try{
    if(action==='prepare'){await a?.prepareCurrentGame?.();a?.render?.();return true;}
    if(action==='start'){
      if(g?.phase==='PLANNED'){const prepared=await a?.prepareCurrentGame?.();if(prepared===false)return false;}
      const ok=await a?.startMatch?.();a?.render?.();return !!ok;
    }
    if(action==='match'){if(m){a?.openMatchDetail?.(m);return true;}a?.show?.('matches');return true;}
    if(action==='joker'){if(!feature('feature.joker'))return false;a?.show?.('joker');return true;}
    if(action==='pick'){if(!feature('feature.joker'))return false;a?.show?.('joker');return true;}
    if(action==='vote'){if(!g?.vote||!voteFeatureEnabled(g.vote.type))return false;a?.show?.('mvpVote');return true;}
    if(action==='ranking'){a?.show?.('ranking');return true;}
    if(action==='reveal'){if(!voteFeaturesEnabled())return false;return !!a?.beginPostGameAwardReveal?.(g);}
    if(action==='live'){
      if(window.skielsenInApp?.session){if(window.skielsenInApp.openFullscreen?.())return true;return !!(await window.skielsenInApp.openActive?.());}
      if(m){a?.openMatchDetail?.(m);return true;}
      return false;
    }
    if(action==='wordchain-difficulty'){
      const ok=await window.skielsenWordChain?.setDifficulty?.(difficulty);
      if(ok)window.skielsenInApp?.poll?.();
      return !!ok;
    }
  }catch(err){
    console.error('Admin command action failed',action,err);
    return false;
  }finally{
    lastSignature='';render();
  }
  return false;
}
function render(){
  const host=ensureHost();
  const visible=!!(state()&&isAdmin()&&document.body.classList.contains('v15-tournament-active')&&!window.skielsenInApp?.fullscreen);
  document.body.classList.toggle('admin-command-visible',visible);
  if(!visible){cancelHold();host.hidden=true;return;}
  const data=model(),signature=JSON.stringify(data);
  host.hidden=false;host.dataset.tone=data.tone||'wait';
  if(lastSignature===signature)return;
  cancelHold();lastSignature=signature;

  let utility='';
  if(data.selector==='difficulty'){
    utility='<div class="admin-command-difficulty" aria-label="Schwierigkeit wählen">'+['EASY','NORMAL','HARDCORE'].map(t=>'<button type="button" data-admin-command-difficulty="'+t+'" class="'+(difficulty===t?'active':'')+'">'+t+'</button>').join('')+'</div>';
  }else if(data.progress){
    const max=Math.max(1,Number(data.progress.max||1)),value=Math.max(0,Math.min(max,Number(data.progress.value||0))),pct=Math.max(0,Math.min(100,value/max*100));
    utility='<div class="admin-command-progress" aria-label="'+value+' von '+max+'"><span><i style="width:'+pct.toFixed(1)+'%"></i></span><b>'+value+' / '+max+'</b></div>';
  }

  const actions=(data.actions||[]).slice(0,2).map(actionMarkup).join('');
  host.innerHTML='<div class="admin-command-inner"><div class="admin-command-brand"><small>ADMIN COMMAND</small><span class="admin-command-state"><i aria-hidden="true"></i>'+esc(data.status||'STATUS')+'</span></div><div class="admin-command-copy"><strong>'+esc(data.title||'NÄCHSTER SCHRITT')+'</strong><span>'+esc(data.copy||'')+'</span></div><div class="admin-command-tools">'+utility+'<div class="admin-command-actions">'+actions+'</div></div><div class="admin-command-context">'+esc(data.context||'')+'<b aria-hidden="true">⌄</b></div></div>';
  bind(host);
}

window.addEventListener('skielsen:tournament-render',render);
window.addEventListener('skielsen:inapp-session',()=>{lastSignature='';render();});
window.addEventListener('popstate',()=>setTimeout(render,0));
window.addEventListener('resize',()=>{if(holdButton)cancelHold(holdButton);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();

let tries=0;
const boot=setInterval(()=>{
  tries++;
  render();
  if(tries>100)clearInterval(boot);
},250);
setInterval(render,1000);

window.skielsenAdminCommand={version:VERSION,render};
})();