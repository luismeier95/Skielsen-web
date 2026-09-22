(()=>{
'use strict';

const VERSION=window.SKIELSEN_VERSION||'15.1.130';
const POLL_MS=2500,HEARTBEAT_MS=12000;
const BUZZER_MODULE='buzzer-time-stoppen';
const BUZZER_GAME_KEY='buzzer_time_stoppen';
const MORE_LESS_MODULE='more-or-less';
const MORE_LESS_GAME_KEY='higher_lower';
const WORD_CHAIN_MODULE='word-chain';
const WORD_CHAIN_GAME_KEY='word_chain';
const TIC_TAC_TOE_MODULE='tic-tac-toe';
const TIC_TAC_TOE_GAME_KEY='tic_tac_toe';
const REACTION_MODULE='reaction';
const REACTION_GAME_KEY='reaction';
const GAME_FLOW_STEPS=Object.freeze(['MODE_SELECTION','DIFFICULTY_SELECTION','READY','GAME','RANKING','JOKER_RESOLUTION','MERGE','CLOSE']);
const colorHex={BLUE:'var(--core-blue)',RED:'var(--core-red)',YELLOW:'var(--core-yellow)',GREEN:'var(--core-green)'};

let db=null,rt=null,pollTimer=null,pollBusy=false,lastHeartbeat=0;
let playerSession=null,adminSession=null,adminCandidates=[],adminGameId=null,buzzerAssetsPromise=null,buzzerBridgePromise=null,moreLessAssetsPromise=null,wordChainAssetsPromise=null,ticTacToeAssetsPromise=null,reactionAssetsPromise=null,autoLifecycleBusy=false,lastRecoveredResultKey=null,playerSessionMisses=0;
let inAppMinimized=false,inAppManualMinimized=false,inAppSurfaceKey=null,inAppSurfaceLive=false,inAppSurfaceConcluded=false,inAppSurfaceLabel='IN-APP GAME',localTestTicTacToeActive=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusDE=s=>({ASSIGNED:'ZUGEWIESEN',CONNECTED:'VERBUNDEN',READY:'BEREIT',PLAYING:'IM SPIEL',FINISHED:'FERTIG',DISCONNECTED:'GETRENNT',WAITING_FOR_PLAYERS:'WARTET AUF PLAYER',COUNTDOWN:'COUNTDOWN',ACTIVE:'LIVE'}[s]||s||'—');

function hasInAppSurface(){
  return !!(playerSession||inAppSurfaceKey||inAppSurfaceLive);
}
function inAppFullscreen(){
  const layer=document.getElementById('v15InAppLayer');
  return !!(hasInAppSurface()&&layer&&!layer.hidden&&!inAppMinimized);
}

function syncVisibleVersion(){
  document.title=`SKIELSEN V${VERSION}`;
  document.querySelectorAll('.sk-header__version').forEach(x=>x.textContent=`V${VERSION}`);
}
function ensureLiveStrip(){
  let strip=document.getElementById('v15InAppLiveStrip');
  if(strip)return strip;
  strip=document.createElement('button');
  strip.id='v15InAppLiveStrip';
  strip.type='button';
  strip.hidden=true;
  strip.setAttribute('aria-label','Live In-App-Spiel wieder im Vollbild öffnen');
  strip.innerHTML='<span class="v15-inapp-live-main"><i aria-hidden="true"></i><span><b id="v15InAppLiveTitle">IN-APP GAME LIVE</b><small id="v15InAppLiveMeta">ZURÜCK INS VOLLBILD</small></span></span><strong>ÖFFNEN →</strong>';
  strip.addEventListener('click',()=>{if(!openInAppFullscreen('push'))void forceOpenActiveInApp('push')});
  document.body.appendChild(strip);
  return strip;
}
function updateInAppChrome(){
  const layer=document.getElementById('v15InAppLayer');
  const strip=ensureLiveStrip();
  const hasSurface=hasInAppSurface();
  const showStrip=!!(hasSurface&&inAppMinimized&&!inAppSurfaceConcluded);
  strip.hidden=!showStrip;
  document.body.classList.toggle('v15-inapp-minimized-live',showStrip);
  const title=document.getElementById('v15InAppLiveTitle');
  const meta=document.getElementById('v15InAppLiveMeta');
  const status=inAppSurfaceLive?'LIVE':statusDE(playerSession?.status||'OFFEN');
  if(title)title.textContent=(inAppSurfaceLabel||playerSession?.game?.name||'IN-APP GAME').toUpperCase()+' · '+status;
  if(meta)meta.textContent=inAppSurfaceLive?'SPIEL LÄUFT WEITER · ZURÜCK INS SPIEL':'SESSION GEÖFFNET · ZURÜCK INS SPIEL';
  if(layer&&hasSurface)layer.hidden=inAppMinimized;
  document.body.classList.toggle('v15-inapp-fullscreen-open',!!(hasSurface&&layer&&!layer.hidden&&!inAppMinimized));
}
function ensureInAppHistory(){
  if(!inAppSurfaceLive||inAppMinimized)return;
  const nav=window.skielsenHistory?.current();
  if(nav?.area==='inapp')return;
  window.skielsenHistory?.push('inapp','game',{tournamentId:rt?.tournament_id||null,surfaceKey:inAppSurfaceKey||null});
}
function openInAppFullscreen(historyMode='push'){
  if(!hasInAppSurface()||(inAppSurfaceConcluded&&inAppMinimized))return false;
  window.skielsenV15?.restorePresentationForInApp?.();
  inAppManualMinimized=false;
  inAppMinimized=false;
  const layer=ensureLayer();
  layer.hidden=false;
  updateInAppChrome();
  if(historyMode!=='none'&&!window.skielsenHistory?.isRestoring()){
    const nav=window.skielsenHistory?.current();
    const data={tournamentId:rt?.tournament_id||null,surfaceKey:inAppSurfaceKey||null};
    if(nav?.area!=='inapp'){
      if(historyMode==='replace')window.skielsenHistory?.replace('inapp','game',data);
      else window.skielsenHistory?.push('inapp','game',data);
    }
  }
  return true;
}
async function forceOpenActiveInApp(historyMode='push'){
  if(!db||!rt?.tournament_id){
    start(window.skielsenV15?.runtime||rt);
    if(!db||!rt?.tournament_id)return false;
  }
  try{
    const {data,error}=await db.rpc('get_my_active_in_app_game',{p_tournament_id:rt.tournament_id});
    if(error)throw error;
    if(!data)return false;
    playerSession=data;
    playerSessionMisses=0;
    inAppManualMinimized=false;
    inAppMinimized=false;
    renderPlayerSession(playerSession);
    const layer=ensureLayer();
    layer.hidden=false;
    if(playerSession.status==='ACTIVE'){
      inAppSurfaceLive=true;
      inAppSurfaceKey=String(playerSession.session_id||'inapp');
      inAppSurfaceLabel=String(playerSession.game?.name||'IN-APP GAME');
    }
    updateInAppChrome();
    if(historyMode!=='none'&&playerSession.status==='ACTIVE')openInAppFullscreen(historyMode);
    return true;
  }catch(err){
    console.warn('Force open active In-App game',err);
    const strip=ensureLiveStrip(),meta=document.getElementById('v15InAppLiveMeta');
    if(meta)meta.textContent='SESSION KONNTE NICHT GELADEN WERDEN · ERNEUT ANTIPPEN';
    strip.hidden=false;
    return false;
  }
}
function minimizeInApp(useHistory=true){
  if(!hasInAppSurface())return false;
  if(inAppSurfaceConcluded){finishInAppSurface();return true}
  inAppManualMinimized=true;
  inAppMinimized=true;
  const layer=ensureLayer();
  layer.hidden=true;
  updateInAppChrome();
  if(useHistory&&window.skielsenHistory?.current()?.area==='inapp')window.skielsenHistory.back();
  return true;
}
function prepareInAppSurface(key,label,live){
  const nextKey=String(key||'inapp');
  if(inAppSurfaceKey!==nextKey){
    inAppSurfaceKey=nextKey;
    inAppManualMinimized=false;
    inAppMinimized=false;
    inAppSurfaceConcluded=false;
  }
  inAppSurfaceLive=inAppSurfaceConcluded?false:!!live;
  inAppSurfaceLabel=String(label||'IN-APP GAME');
  updateInAppChrome();
  if(inAppSurfaceLive&&!inAppMinimized)ensureInAppHistory();
}
function markInAppConcluded(){
  if(!hasInAppSurface())return false;
  inAppSurfaceConcluded=true;
  inAppSurfaceLive=false;
  updateInAppChrome();
  return true;
}
function clearInAppSurface(){
  const hadInAppHistory=window.skielsenHistory?.current()?.area==='inapp';
  inAppSurfaceLive=false;
  inAppSurfaceConcluded=false;
  inAppSurfaceKey=null;
  inAppSurfaceLabel='IN-APP GAME';
  inAppMinimized=false;
  inAppManualMinimized=false;
  const strip=document.getElementById('v15InAppLiveStrip');
  if(strip)strip.hidden=true;
  document.body.classList.remove('v15-inapp-minimized-live','v15-inapp-fullscreen-open','v15-word-chain-inapp-open');
  if(hadInAppHistory)window.skielsenHistory.back();
}
function ensureLayer(){
  let layer=document.getElementById('v15InAppLayer');
  if(layer)return layer;
  layer=document.createElement('section');
  layer.id='v15InAppLayer';
  layer.hidden=true;
  layer.setAttribute('aria-live','polite');
  layer.innerHTML='<div class="v15-inapp-topstrip"><i></i><i></i><i></i><i></i></div><main class="v15-inapp-shell"><div id="v15InAppPlayerContent"></div></main>';
  document.body.appendChild(layer);
  ensureLiveStrip();
  return layer;
}
function ensureBuzzerBridgeAssets(){
  if(window.skielsenBuzzerBridge)return Promise.resolve();
  if(buzzerBridgePromise)return buzzerBridgePromise;
  buzzerBridgePromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-buzzer-results-css]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href=`assets/css/buzzer-results.css?v=${VERSION}`;link.dataset.buzzerResultsCss='1';document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-buzzer-bridge-js]');
    if(existing){if(window.skielsenBuzzerBridge){resolve();return}existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const script=document.createElement('script');script.src=`assets/js/10-buzzer-tournament-bridge.js?v=${VERSION}`;script.defer=true;script.dataset.buzzerBridgeJs='1';script.onload=()=>resolve();script.onerror=reject;document.head.appendChild(script);
  });
  return buzzerBridgePromise;
}
function ensureBuzzerAssets(){
  if(window.skielsenBuzzerTime)return Promise.resolve();
  if(buzzerAssetsPromise)return buzzerAssetsPromise;
  buzzerAssetsPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-buzzer-css]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=`assets/css/buzzer-time.css?v=${VERSION}`;link.dataset.buzzerCss='1';
      document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-buzzer-js]');
    if(existing){
      if(window.skielsenBuzzerTime){resolve();return}
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=`assets/js/09-buzzer-time.js?v=${VERSION}`;
    script.defer=true;
    script.dataset.buzzerJs='1';
    script.onload=()=>resolve();
    script.onerror=reject;
    document.head.appendChild(script);
  });
  return buzzerAssetsPromise;
}
function ensureMoreLessAssets(){
  if(!document.querySelector('link[data-more-less-css]')&&!document.getElementById('more-less-game-css')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=`assets/css/more-or-less-game.css?v=${VERSION}&fix=molux11`;link.dataset.moreLessCss='1';
    document.head.appendChild(link);
  }
  if(window.skielsenMoreLess?.mount)return Promise.resolve(window.skielsenMoreLess);
  if(moreLessAssetsPromise)return moreLessAssetsPromise;
  moreLessAssetsPromise=new Promise((resolve,reject)=>{
    const finish=()=>{
      if(window.skielsenMoreLess?.mount){resolve(window.skielsenMoreLess);return}
      reject(new Error('MORE_LESS_MODULE_NOT_REGISTERED'));
    };
    const existing=document.querySelector('script[data-more-less-js],#more-less-game-runtime');
    if(existing)existing.remove();
    const script=document.createElement('script');
    script.src=`assets/js/11-more-or-less-game.js?v=${VERSION}&fix=molux11`;
    script.dataset.moreLessJs='1';
    script.onload=finish;
    script.onerror=()=>reject(new Error('MORE_LESS_ASSET_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch(err=>{
    moreLessAssetsPromise=null;
    throw err;
  });
  return moreLessAssetsPromise;
}
function ensureWordChainAssets(){
  if(window.skielsenWordChain)return Promise.resolve();
  if(wordChainAssetsPromise)return wordChainAssetsPromise;
  wordChainAssetsPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-word-chain-css]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=`assets/css/wortkette-game.css?v=${VERSION}&fix=wcv4r590`;link.dataset.wordChainCss='1';
      document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-word-chain-js]');
    if(existing){
      if(window.skielsenWordChain){resolve();return}
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=`assets/js/12-word-chain-game.js?v=${VERSION}&fix=wcv4r590`;
    script.defer=true;script.dataset.wordChainJs='1';
    script.onload=()=>resolve();script.onerror=reject;document.head.appendChild(script);
  });
  return wordChainAssetsPromise;
}
function ensureTicTacToeAssets(){
  if(window.skielsenTicTacToe)return Promise.resolve();
  if(ticTacToeAssetsPromise)return ticTacToeAssetsPromise;
  ticTacToeAssetsPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-tic-tac-toe-css]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=`assets/css/tic-tac-toe-game.css?v=${VERSION}`;link.dataset.ticTacToeCss='1';
      document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-tic-tac-toe-js]');
    if(existing){
      if(window.skielsenTicTacToe){resolve();return}
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=`assets/js/13-tic-tac-toe-game.js?v=${VERSION}`;
    script.defer=true;script.dataset.ticTacToeJs='1';
    script.onload=()=>resolve();script.onerror=reject;document.head.appendChild(script);
  });
  return ticTacToeAssetsPromise;
}
function ensureReactionAssets(){
  if(window.skielsenReaction)return Promise.resolve();
  if(reactionAssetsPromise)return reactionAssetsPromise;
  reactionAssetsPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-reaction-css]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=`assets/css/reaction-game.css?v=${VERSION}`;link.dataset.reactionCss='1';
      document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-reaction-js]');
    if(existing){
      if(window.skielsenReaction){resolve();return}
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=`assets/js/15-reaction-game.js?v=${VERSION}`;
    script.defer=true;script.dataset.reactionJs='1';
    script.onload=()=>resolve();script.onerror=reject;document.head.appendChild(script);
  }).catch(err=>{reactionAssetsPromise=null;throw err});
  return reactionAssetsPromise;
}
function rosterHtml(s){
  const me=s?.me?.tournament_member_id;
  return (s?.players||[]).map(p=>`<div class="v15-inapp-player ${p.tournament_member_id===me?'me':''}"><i style="background:${colorHex[p.identity_color]||'var(--theme-muted)'}"></i><div><strong>${esc(p.display_name||'PLAYER')}</strong><small>SEAT ${esc(p.seat)} · ${esc(statusDE(p.status))}${p.tournament_member_id===me?' · DU':''}</small></div></div>`).join('');
}
function renderBuzzerSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  prepareInAppSurface(String(s.session_id||'buzzer'),s.game?.name||'BUZZER ZEIT STOPPEN',true);
  layer.classList.remove('word-chain-mode');
  layer.classList.add('buzzer-mode');
  window.skielsenWordChain?.unmount?.();
  window.skielsenReaction?.unmount?.();
  let gameRoot=document.getElementById('v15BuzzerRoot');
  if(!gameRoot||gameRoot.dataset.session!==String(s.session_id)){
    window.skielsenBuzzerTime?.unmount?.();
    host.innerHTML=`<div id="v15BuzzerRoot" data-session="${esc(s.session_id)}"><div class="v15-inapp-message">BUZZER WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15BuzzerRoot');
  }
  ensureBuzzerAssets().then(()=>{
    const rootNow=document.getElementById('v15BuzzerRoot');
    if(rootNow&&playerSession?.session_id===s.session_id){
      window.skielsenBuzzerTime?.mount?.(rootNow,s,db);
      window.skielsenBuzzerTime?.updateSession?.(s);
    }
  }).catch(err=>{
    console.warn('Buzzer assets',err);
    if(gameRoot)gameRoot.innerHTML='<div class="v15-inapp-message">BUZZER-MODUL KONNTE NICHT GELADEN WERDEN.</div>';
  });
}
function renderBuzzerTest(g){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  const sessionKey=`test-${g.tournament_game_id||g.game_id||'buzzer'}`;
  prepareInAppSurface(sessionKey,g.name||'BUZZER ZEIT STOPPEN',true);
  layer.classList.add('buzzer-mode');
  let gameRoot=document.getElementById('v15BuzzerRoot');
  if(!gameRoot||gameRoot.dataset.session!==sessionKey){
    window.skielsenBuzzerTime?.unmount?.();
    host.innerHTML=`<div id="v15BuzzerRoot" data-session="${esc(sessionKey)}"><div class="v15-inapp-message">BUZZER TESTMODUS WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15BuzzerRoot');
  }
  ensureBuzzerAssets().then(()=>{
    const rootNow=document.getElementById('v15BuzzerRoot');
    const current=currentGame();
    if(rootNow&&rt?.test_mode&&isBuzzerGame(current)&&buzzerGameIsLive(current))window.skielsenBuzzerTime?.mountTest?.(rootNow,rt,current,window.skielsenV15);
  }).catch(err=>{console.warn('Buzzer test assets',err);if(gameRoot)gameRoot.innerHTML='<div class="v15-inapp-message">BUZZER-TESTMODUL KONNTE NICHT GELADEN WERDEN.</div>'});
}

function renderMoreLessSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  const live=String(s?.status||'').toUpperCase()==='ACTIVE';
  prepareInAppSurface(String(s.session_id||'more-less'),s.game?.name||'MEHR ODER WENIGER',live);
  layer.classList.remove('buzzer-mode','word-chain-mode');
  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenWordChain?.unmount?.();
  window.skielsenReaction?.unmount?.();
  let gameRoot=document.getElementById('v15MoreLessRoot');
  if(!gameRoot||gameRoot.dataset.session!==String(s.session_id)){
    window.skielsenMoreLess?.unmount?.();
    host.innerHTML=`<div id="v15MoreLessRoot" data-session="${esc(s.session_id)}"><div class="v15-inapp-message">MEHR ODER WENIGER WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15MoreLessRoot');
  }
  ensureMoreLessAssets().then(api=>{
    const rootNow=document.getElementById('v15MoreLessRoot');
    const sameSession=String(playerSession?.session_id||'')===String(s.session_id||'');
    if(!rootNow||!sameSession)return;
    const mounted=api?.mount?.(rootNow,s,db);
    if(mounted===false)throw new Error('MORE_LESS_MOUNT_REJECTED');
    api?.updateSession?.(s);
  }).catch(err=>{
    console.warn('More or Less assets',err);
    moreLessAssetsPromise=null;
    const rootNow=document.getElementById('v15MoreLessRoot');
    if(rootNow)rootNow.innerHTML='<div class="v15-inapp-message">MEHR ODER WENIGER KONNTE NICHT INITIALISIERT WERDEN.<br><small>SEITE NEU LADEN ODER ERNEUT ÖFFNEN.</small></div>';
  });
}

function renderWordChainSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  const live=String(s?.status||'').toUpperCase()==='ACTIVE';
  prepareInAppSurface(String(s.session_id||'word-chain'),s.game?.name||'WORTKETTE',live);
  layer.classList.remove('buzzer-mode');
  layer.classList.add('word-chain-mode');
  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenMoreLess?.unmount?.();
  window.skielsenReaction?.unmount?.();
  let gameRoot=document.getElementById('v15WordChainRoot');
  if(!gameRoot||gameRoot.dataset.session!==String(s.session_id)){
    window.skielsenWordChain?.unmount?.();
    host.innerHTML=`<div id="v15WordChainRoot" data-session="${esc(s.session_id)}"><div class="v15-inapp-message">WORTKETTE WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15WordChainRoot');
  }
  ensureWordChainAssets().then(()=>{
    const rootNow=document.getElementById('v15WordChainRoot');
    if(rootNow&&playerSession?.session_id===s.session_id){
      window.skielsenWordChain?.mount?.(rootNow,s,db);
      window.skielsenWordChain?.updateSession?.(s);
    }
  }).catch(err=>{
    console.warn('Wortkette assets',err);
    if(gameRoot)gameRoot.innerHTML='<div class="v15-inapp-message">WORTKETTE-MODUL KONNTE NICHT GELADEN WERDEN.</div>';
  });
}

function renderTicTacToeSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  const live=String(s?.status||'').toUpperCase()==='ACTIVE';
  prepareInAppSurface(String(s.session_id||'tic-tac-toe'),s.game?.name||'TIC TAC TOE',live);
  layer.classList.remove('buzzer-mode','word-chain-mode');
  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenMoreLess?.unmount?.();
  window.skielsenWordChain?.unmount?.();
  window.skielsenReaction?.unmount?.();
  let gameRoot=document.getElementById('v15TicTacToeRoot');
  if(!gameRoot||gameRoot.dataset.session!==String(s.session_id)){
    window.skielsenTicTacToe?.unmount?.();
    host.innerHTML=`<div id="v15TicTacToeRoot" data-session="${esc(s.session_id)}"><div class="v15-inapp-message">TIC TAC TOE WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15TicTacToeRoot');
  }
  ensureTicTacToeAssets().then(()=>{
    const rootNow=document.getElementById('v15TicTacToeRoot');
    if(rootNow&&playerSession?.session_id===s.session_id){
      if(!window.skielsenTicTacToe?.state)window.skielsenTicTacToe?.mount?.(rootNow,s,db);
      else window.skielsenTicTacToe?.updateSession?.(s);
    }
  }).catch(err=>{
    console.warn('Tic Tac Toe assets',err);
    if(gameRoot)gameRoot.innerHTML='<div class="v15-inapp-message">TIC-TAC-TOE-MODUL KONNTE NICHT GELADEN WERDEN.</div>';
  });
}

function renderReactionSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  const live=String(s?.status||'').toUpperCase()==='ACTIVE';
  prepareInAppSurface(String(s.session_id||'reaction'),s.game?.name||'REACTION',live);
  layer.classList.remove('buzzer-mode','word-chain-mode');
  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenMoreLess?.unmount?.();
  window.skielsenWordChain?.unmount?.();
  window.skielsenTicTacToe?.unmount?.();
  let gameRoot=document.getElementById('v15ReactionRoot');
  if(!gameRoot||gameRoot.dataset.session!==String(s.session_id)){
    window.skielsenReaction?.unmount?.();
    host.innerHTML=`<div id="v15ReactionRoot" data-session="${esc(s.session_id)}"><div class="v15-inapp-message">REACTION WIRD GELADEN …</div></div>`;
    gameRoot=document.getElementById('v15ReactionRoot');
  }
  ensureReactionAssets().then(()=>{
    const rootNow=document.getElementById('v15ReactionRoot');
    if(rootNow&&playerSession?.session_id===s.session_id){
      window.skielsenReaction?.mount?.(rootNow,s,db);
      window.skielsenReaction?.updateSession?.(s);
    }
  }).catch(err=>{
    console.warn('Reaction assets',err);
    reactionAssetsPromise=null;
    const rootNow=document.getElementById('v15ReactionRoot');
    if(rootNow)rootNow.innerHTML='<div class="v15-inapp-message">REACTION KONNTE NICHT INITIALISIERT WERDEN.</div>';
  });
}
function wordChainReadyRulesHtml(s,readyMessage,ready,showForceStart){
  const players=Array.isArray(s?.players)?s.players:[];
  const me=String(s?.me?.tournament_member_id||'');
  const playerRows=players.map(p=>{
    const isReady=String(p?.status||'').toUpperCase()==='READY';
    const isMe=String(p?.tournament_member_id||'')===me;
    const accent=colorHex[p?.identity_color]||'var(--theme-muted)';
    return `<div class="v15-wordchain-ready-player ${isReady?'is-ready':'is-waiting'}">
      <i class="v15-wordchain-ready-accent" style="background:${accent}" aria-hidden="true"></i>
      <span class="v15-wordchain-ready-player-copy"><strong>${esc(p?.display_name||'PLAYER')}${isMe?'<small>DU</small>':''}</strong></span>
      <b class="v15-wordchain-ready-state ${isReady?'state-ready':'state-waiting'}">${isReady?'BEREIT':'WARTET'}</b>
    </div>`;
  }).join('')||'<div class="v15-wordchain-ready-empty">NOCH KEINE PLAYER ZUGEWIESEN.</div>';
  const forceButton=showForceStart
    ?'<button class="v15-inapp-btn force" id="v15InAppReadyForceStart" type="button">START ERZWINGEN</button>'
    :'';
  return `<section class="v15-wordchain-ready-page" aria-label="Wortkette Bereitschaft und Regeln">
    <div class="v15-wordchain-ready-top">
      <section class="v15-wordchain-ready-card v15-wordchain-ready-players">
        <div class="v15-wordchain-ready-player-list">${playerRows}</div>
      </section>

      <section class="v15-wordchain-ready-card v15-wordchain-ready-demo-card">
        <div class="v15-wordchain-ready-demo" aria-label="Wortkette Spielbeispiel">
          <img class="v15-wordchain-ready-demo-image" src="assets/images/RulePage.gif?v=${VERSION}" width="914" height="638" alt="Wortkette Spielbeispiel">
        </div>
      </section>
    </div>

    <section class="v15-wordchain-ready-card v15-wordchain-ready-rules-card">
      <div class="v15-wordchain-ready-rules-list">
        <div><b>01</b><span>VERVOLLSTÄNDIGE DAS ZUSAMMENGESETZTE NOMEN.</span></div>
        <div><b>02</b><span>EIN FALSCHES WORT GIBT <strong>−1 PUNKT</strong> UND DECKT EINEN HINWEIS AUF.</span></div>
        <div><b>03</b><span>LÄUFT DIE ZEIT AB, GIBT ES <strong>−1 PUNKT</strong> UND EIN HINWEIS WIRD AUFGEDECKT.</span></div>
        <div><b>04</b><span>DIE WENIGSTEN MINUSPUNKTE GEWINNEN.</span></div>
        <div><b>05</b><span>ALLE SPIELER BEKOMMEN DIE GLEICHE WORTKETTE.</span></div>
      </div>
    </section>

    <footer class="v15-wordchain-ready-footer">
      <div class="v15-wordchain-ready-message" id="v15InAppReadyMessage" aria-live="polite" hidden>${esc(readyMessage)}</div>
      <div class="v15-inapp-actions">
        <button class="v15-inapp-btn ${ready?'secondary':''}" id="v15InAppReady" type="button">${ready?'BEREITS BEREIT ✓':'ICH BIN BEREIT'}</button>
        ${forceButton}
      </div>
    </footer>
  </section>`;
}

function renderPlayerSession(s){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  if(!s){
    window.skielsenBuzzerTime?.unmount?.();
    window.skielsenMoreLess?.unmount?.();
    window.skielsenWordChain?.unmount?.();
    window.skielsenTicTacToe?.unmount?.();
    window.skielsenReaction?.unmount?.();
    layer.classList.remove('buzzer-mode','word-chain-mode');
    document.body.classList.remove('v15-word-chain-inapp-open');
    layer.hidden=true;
    host.innerHTML='';
    clearInAppSurface();
    return;
  }
  const ready=s.me?.status==='READY',active=s.status==='ACTIVE';
  const isWordChain=s.game?.module_key===WORD_CHAIN_MODULE;
  const isMoreLess=s.game?.module_key===MORE_LESS_MODULE;
  const isTicTacToe=s.game?.module_key===TIC_TAC_TOE_MODULE;
  const isReaction=s.game?.module_key===REACTION_MODULE;
  document.body.classList.toggle('v15-word-chain-inapp-open',isWordChain);
  const forceStartWithoutReady=!!s.public_state?.force_start_without_ready;
  const needsWordChainDifficulty=!!(isWordChain&&!String(s.public_state?.word_chain_difficulty||'').trim());
  const needsMoreLessDifficulty=!!(isMoreLess&&!String(s.public_state?.familiarity_tier||'').trim());
  if(isReaction&&!active){renderReactionSession(s);return}
  if(!active&&needsMoreLessDifficulty){renderMoreLessSession(s);return}
  if(!active&&needsWordChainDifficulty){renderWordChainSession(s);return}
  if(active&&!inAppManualMinimized)inAppMinimized=false;
  if(active&&s.game?.module_key===BUZZER_MODULE){
    window.skielsenMoreLess?.unmount?.();
    window.skielsenWordChain?.unmount?.();
    renderBuzzerSession(s);
    return;
  }
  if(active&&s.game?.module_key===MORE_LESS_MODULE){
    renderMoreLessSession(s);
    return;
  }
  if(active&&s.game?.module_key===WORD_CHAIN_MODULE){
    renderWordChainSession(s);
    return;
  }
  if(active&&s.game?.module_key===REACTION_MODULE){
    renderReactionSession(s);
    return;
  }
  if(isTicTacToe){
    renderTicTacToeSession(s);
    return;
  }

  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenMoreLess?.unmount?.();
  window.skielsenWordChain?.unmount?.();
  window.skielsenTicTacToe?.unmount?.();
  window.skielsenReaction?.unmount?.();
  layer.classList.remove('buzzer-mode','word-chain-mode');
  if(active)prepareInAppSurface(String(s.session_id||'inapp'),s.game?.name||'IN-APP GAME',true);
  else prepareInAppSurface(String(s.session_id||'inapp'),s.game?.name||'IN-APP GAME',false);
  const readyMessage=s.status==='READY'
    ?'ALLE AUSGEWÄHLTEN GERÄTE SIND BEREIT. DER ADMIN KANN DIE SESSION JETZT STARTEN.'
    :(isWordChain&&forceStartWithoutReady
      ?'BESTÄTIGE AUF DIESEM GERÄT, DASS DU BEREIT BIST. IN DIESEM QA-TURNIER DARF DER ADMIN DIE WORTKETTE AUCH STARTEN, WENN NOCH NICHT ALLE PLAYER READY SIND.'
      :'BESTÄTIGE AUF DIESEM GERÄT, DASS DU BEREIT BIST. DIE SESSION STARTET ERST, WENN ALLE AUSGEWÄHLTEN PLAYER BEREIT SIND.');
  const showReadyForceStart=!!(rt?.is_admin&&String(s.status||'')==='WAITING_FOR_PLAYERS'&&((isWordChain&&forceStartWithoutReady)||(isMoreLess&&isMoreLessNamedQaTest())));
  const chrome=`<div class="v15-inapp-kicker">SKIELSEN · IN-APP GAME</div><h1 class="v15-inapp-title">${esc(s.game?.name||'IN-APP GAME')}</h1><div class="v15-inapp-meta"><span class="v15-inapp-status" data-status="${esc(s.status)}"><i></i>${esc(statusDE(s.status))}</span><span>SEAT ${esc(s.me?.seat||'—')}</span><span>SESSION ${esc(String(s.session_id||'').slice(0,8).toUpperCase())}</span></div>`;
  if(isWordChain&&!active){
    const readySignature=JSON.stringify({
      session:String(s.session_id||''),
      status:String(s.status||''),
      ready:!!ready,
      force:!!showReadyForceStart,
      players:(s.players||[]).map(p=>[String(p.tournament_member_id||''),String(p.status||''),String(p.identity_color||'')])
    });
    const existingPage=host.querySelector('.v15-wordchain-ready-page');
    if(existingPage&&existingPage.dataset.readySignature===readySignature)return;
    host.innerHTML=chrome+wordChainReadyRulesHtml(s,readyMessage,ready,showReadyForceStart);
    const readyPage=host.querySelector('.v15-wordchain-ready-page');
    if(readyPage)readyPage.dataset.readySignature=readySignature;
  }else{
    host.innerHTML=chrome+`<section class="v15-inapp-panel"><div class="v15-inapp-panel-head"><b>AUSGEWÄHLTE PLAYER</b><span>NUR DIESE ACCOUNTS ERHALTEN DIE SESSION</span></div><div class="v15-inapp-roster">${rosterHtml(s)}</div>${active?`<div class="v15-inapp-gamehost" id="v15InAppGameHost"><h2>SESSION ACTIVE</h2><p>Das Game-Modul <b>${esc(s.game?.module_key||'—')}</b> ist noch nicht implementiert.</p><button class="v15-inapp-btn" id="v15InAppTestAction" type="button">TEST-AKTION SENDEN</button><div class="v15-inapp-feedback" id="v15InAppFeedback"></div></div>`:`<div class="v15-inapp-message" id="v15InAppReadyMessage">${readyMessage}</div><div class="v15-inapp-actions"><button class="v15-inapp-btn ${ready?'secondary':''}" id="v15InAppReady" type="button">${ready?'BEREITS BEREIT ✓':'ICH BIN BEREIT'}</button>${showReadyForceStart?'<button class="v15-inapp-btn force" id="v15InAppReadyForceStart" type="button">START ERZWINGEN</button>':''}</div>`}</section>`;
  }

  document.getElementById('v15InAppReady')?.addEventListener('click',()=>setReady(!ready));
  document.getElementById('v15InAppReadyForceStart')?.addEventListener('click',()=>forceStartFromReadyPage(s));
  document.getElementById('v15InAppTestAction')?.addEventListener('click',async()=>{
    const fb=document.getElementById('v15InAppFeedback');
    if(fb)fb.textContent='WIRD GESENDET …';
    const r=await db.rpc('submit_in_app_game_action',{p_session_id:s.session_id,p_action_type:'TEST_TAP',p_payload:{client_ts:new Date().toISOString()}});
    if(fb)fb.textContent=r.error?'FEHLER: '+(r.error.message||'AKTION NICHT GESPEICHERT'):'AKTION SERVERSEITIG ANGENOMMEN · '+String(r.data?.action_id||'').slice(0,8).toUpperCase();
  });
}
async function recoverCompletedNativeGame(){
  const g=currentGame();
  if(!g?.tournament_game_id||!supportedNativeGame(g)||!db)return false;
  const rpc=isBuzzerGame(g)?'get_buzzer_time_game_result':(isMoreLessGame(g)?'get_higher_lower_game_result':(isWordChainGame(g)?'get_word_chain_game_result':(isReactionGame(g)?'get_reaction_game_result':'get_tic_tac_toe_result')));
  try{
    const {data,error}=await db.rpc(rpc,{p_tournament_game_id:g.tournament_game_id});
    if(error||!data)return false;
    const result=data.result||data;
    if(isTicTacToeGame(g)&&data?.session_id&&result&&!result._session_id)result._session_id=data.session_id;
    const key=String(g.tournament_game_id)+'|'+String(result?.finalized_at||result?.tournament_handoff?.completed_at||'complete');
    if(lastRecoveredResultKey===key)return true;
    const bridge=window.skielsenBuzzerBridge;
    if(!bridge?.ingestInAppGameResult)return false;
    const ok=bridge.ingestInAppGameResult(g.tournament_game_id,result);
    if(ok)lastRecoveredResultKey=key;
    return !!ok;
  }catch(err){console.warn('In-App completed result recovery',err);return false}
}
async function setReady(v){
  if(!playerSession||!db)return;
  const r=await db.rpc('set_in_app_game_ready',{p_session_id:playerSession.session_id,p_ready:!!v});
  if(r.error){console.warn('In-App ready',r.error);return}
  await pollPlayer();
}
async function forceStartCurrent(){
  const s=playerSession||adminSession;
  if(!rt?.is_admin||!db||!s?.session_id)return false;
  const current=currentGame();
  const wordChainAllowed=s.game?.module_key===WORD_CHAIN_MODULE&&s?.public_state?.force_start_without_ready;
  const moreLessAllowed=s.game?.module_key===MORE_LESS_MODULE&&isMoreLessNamedQaTest(current);
  if(!wordChainAllowed&&!moreLessAllowed)return false;
  const r=await db.rpc('start_in_app_game_session',{p_session_id:s.session_id});
  if(r.error){console.warn('In-App force start',r.error);return false}
  await refreshAdmin(true);
  await pollPlayer();
  return true;
}
async function forceStartFromReadyPage(s){
  const current=currentGame();
  const allowed=!!(rt?.is_admin&&String(s?.status||'')==='WAITING_FOR_PLAYERS'&&((s?.game?.module_key===WORD_CHAIN_MODULE&&s?.public_state?.force_start_without_ready)||(s?.game?.module_key===MORE_LESS_MODULE&&isMoreLessNamedQaTest(current))));
  if(!allowed||!db||!s?.session_id)return;
  const btn=document.getElementById('v15InAppReadyForceStart');
  const msg=document.getElementById('v15InAppReadyMessage');
  if(btn){btn.disabled=true;btn.textContent='STARTET …'}
  if(msg){msg.hidden=false;msg.textContent='ADMIN-START WIRD ERZWUNGEN …';}
  const ok=await forceStartCurrent();
  if(!ok){
    if(btn){btn.disabled=false;btn.textContent='START ERZWINGEN'}
    if(msg){msg.hidden=false;msg.textContent='STARTFEHLER · SESSION KONNTE NICHT GESTARTET WERDEN.';}
  }
}
async function pollPlayer(){
  if(localTestTicTacToeActive)return;
  if(pollBusy||!db||!rt?.tournament_id)return;
  pollBusy=true;
  try{
    const testGame=currentGame();
    if(rt?.test_mode&&isBuzzerGame(testGame)&&buzzerGameIsLive(testGame)){playerSession=null;renderBuzzerTest(testGame);return}
    const r=await db.rpc('get_my_active_in_app_game',{p_tournament_id:rt.tournament_id});
    if(r.error){console.warn('In-App session poll',r.error);return}
    if(r.data){
      playerSession=r.data;playerSessionMisses=0;
      renderPlayerSession(playerSession);
    }else{
      if(window.skielsenWordChain?.resultOpen||window.skielsenMoreLess?.resultOpen||window.skielsenReaction?.resultOpen){
        playerSessionMisses=0;
        return;
      }
      playerSessionMisses++;
      if(playerSession&&playerSessionMisses<3){
        console.warn('In-App session poll returned empty; keeping last session snapshot',playerSessionMisses);
      }else{
        playerSession=null;renderPlayerSession(null);await recoverCompletedNativeGame();
      }
    }
    if(playerSession&&Date.now()-lastHeartbeat>HEARTBEAT_MS){
      lastHeartbeat=Date.now();
      db.rpc('heartbeat_in_app_game_session',{p_session_id:playerSession.session_id}).catch?.(()=>{});
    }
    if(rt?.is_admin)await refreshAdmin(false);
  }finally{pollBusy=false}
}

function currentGame(){
  const active=document.getElementById('gameControlPage')?.classList.contains('active');
  const control=window.skielsenV15?.gameControl;
  if(active&&control?.g)return control.g;
  const s=window.skielsenV15?.state;
  return s?.games?.[s.currentGameIndex||0]||null;
}
function isBuzzerGame(g){
  return g?.game_id==='game.buzzer_time_stop'||/BUZZER\s+ZEIT\s+STOPPEN/i.test(String(g?.name||''));
}
function isMoreLessGame(g){
  return g?.game_id==='game.higher_lower'||/MEHR\s+ODER\s+WENIGER/i.test(String(g?.name||''));
}
function isMoreLessNamedQaTest(g=currentGame()){
  const sessionFlag=!!(adminSession?.public_state?.test_bot_mode||playerSession?.public_state?.test_bot_mode);
  const namedTest=!!(rt?.test_mode&&/^Mehr oder Weniger$/i.test(String(rt?.tournament_name||rt?.name||'').trim()));
  return !!(isMoreLessGame(g)&&(sessionFlag||namedTest));
}
function isWordChainGame(g){
  return g?.game_id==='game.wortkette.compound_nouns'||g?.game_id==='game.word_chain'||/WORTKETTE/i.test(String(g?.name||''));
}
function isTicTacToeGame(g){
  return g?.game_id==='game.tictactoe.classic_disappear'||/TIC\s*TAC\s*TOE/i.test(String(g?.name||''));
}
function isReactionGame(g){
  return g?.game_id==='game.reaction.tap'||/^REACTION$/i.test(String(g?.name||''));
}
function currentMatchHasSoloTestBot(g=currentGame()){
  const st=window.skielsenV15?.state;
  const control=window.skielsenV15?.gameControl;
  const localGame=control?.g===g?control.g:(st?.games||[]).find(x=>x.tournament_game_id===g?.tournament_game_id)||g;
  const m=control?.g===g?control.m:(localGame?.matches||[])[localGame?.matchIndex||0];
  if(!m)return false;
  const byId=id=>(st?.participants||[]).find(p=>p.id===id);
  return [m.a,m.b].some(id=>!!byId(id)?.isBotParticipant);
}
function nativeGameIsLive(g){
  if(!g)return false;
  const serverActive=String(g.status||'').toUpperCase()==='ACTIVE';
  const localActive=g.phase==='ACTIVE';
  return serverActive||localActive;
}
function buzzerGameIsLive(g){return isBuzzerGame(g)&&nativeGameIsLive(g)}
function supportedNativeGame(g){return isBuzzerGame(g)||isMoreLessGame(g)||isWordChainGame(g)||isTicTacToeGame(g)||isReactionGame(g)}
function gameKeyFor(g){return isBuzzerGame(g)?BUZZER_GAME_KEY:(isMoreLessGame(g)?MORE_LESS_GAME_KEY:(isWordChainGame(g)?WORD_CHAIN_GAME_KEY:(isTicTacToeGame(g)?TIC_TAC_TOE_GAME_KEY:(isReactionGame(g)?REACTION_GAME_KEY:null))))}
function moduleKeyFor(g){return isBuzzerGame(g)?BUZZER_MODULE:(isMoreLessGame(g)?MORE_LESS_MODULE:(isWordChainGame(g)?WORD_CHAIN_MODULE:(isTicTacToeGame(g)?TIC_TAC_TOE_MODULE:(isReactionGame(g)?REACTION_MODULE:null))))}
function inAppAdminRelevant(){
  const g=currentGame(),tracker=String(g?.tracker_type||'').toUpperCase(),play=String(g?.play_mode||g?.default_play_mode||'').toUpperCase();
  return tracker==='IN_APP_NATIVE'||play==='IN_APP';
}
function ensureAdminPanel(){
  if(!rt?.is_admin)return null;
  const page=document.getElementById('v1536EmbeddedInAppHost')||document.getElementById('gameControlPage');
  if(!page)return null;
  let panel=document.getElementById('v15InAppAdminPanel');
  if(panel){
    if(panel.parentElement!==page)page.appendChild(panel);
    return panel;
  }
  panel=document.createElement('section');
  panel.id='v15InAppAdminPanel';
  panel.innerHTML=`<div class="head"><div><small>V${VERSION} · MATCH DETAIL ADAPTER</small><h2>IN-APP GAME SESSION</h2></div><b id="v15InAppAdminStatus">KEINE SESSION</b></div><div class="v15-inapp-admin-body"><div class="v15-inapp-admin-toolbar"><button class="v15-inapp-admin-btn" id="v15InAppCreate" type="button">SESSION FÜR AKTUELLES GAME ERSTELLEN</button><button class="v15-inapp-admin-btn alt" id="v15InAppReload" type="button">AKTUALISIEREN</button><button class="v15-inapp-admin-btn alt" id="v15InAppStart" type="button" disabled>SESSION STARTEN</button><button class="v15-inapp-admin-btn danger" id="v15InAppForceStart" type="button" hidden disabled>START ERZWINGEN</button><button class="v15-inapp-admin-btn alt" id="v15InAppComplete" type="button" disabled>ABSCHLIESSEN</button><button class="v15-inapp-admin-btn danger" id="v15InAppCancel" type="button" disabled>ABBRECHEN</button></div><div class="v15-inapp-admin-info" id="v15InAppAdminInfo">SERVERSEITIGE SESSION · JEDER PLAYER SPIELT AUF DEM EIGENEN GERÄT.</div><div id="v15InAppCandidateWrap" hidden><div class="v15-inapp-candidates" id="v15InAppCandidates"></div><div class="v15-inapp-admin-toolbar" style="margin-top:10px"><button class="v15-inapp-admin-btn" id="v15InAppAssign" type="button">AUSWAHL ZUWEISEN</button></div></div><div class="v15-inapp-admin-session" id="v15InAppAdminRoster" hidden></div></div>`;
  page.appendChild(panel);
  document.getElementById('v15InAppCreate').addEventListener('click',createAdminSession);
  document.getElementById('v15InAppReload').addEventListener('click',()=>refreshAdmin(true));
  document.getElementById('v15InAppAssign').addEventListener('click',assignSelected);
  document.getElementById('v15InAppStart').addEventListener('click',startAdminSession);
  document.getElementById('v15InAppForceStart').addEventListener('click',startAdminSession);
  document.getElementById('v15InAppCancel').addEventListener('click',cancelAdminSession);
  document.getElementById('v15InAppComplete').addEventListener('click',completeAdminSession);
  return panel;
}
async function createAdminSession(){
  const g=currentGame(),info=document.getElementById('v15InAppAdminInfo');
  if(!g?.tournament_game_id){if(info)info.textContent='AKTUELLES GAME HAT KEINE TOURNAMENT_GAME_ID.';return}
  const manualWordChain=isWordChainGame(g);
  const r=await db.rpc('create_in_app_game_session',{
    p_tournament_game_id:g.tournament_game_id,
    p_game_key:gameKeyFor(g)||'in_app_shell_test',
    p_match_id:null,
    p_public_state:{
      source:`V${VERSION}`,
      game_name:g.name||null,
      game_id:g.game_id||null,
      difficulty_required:manualWordChain,
      word_chain_rules_version:manualWordChain?4:null,
      time_limit_seconds:manualWordChain?15:null
    }
  });
  if(r.error){if(info)info.textContent='SESSION-FEHLER: '+(r.error.message||'UNBEKANNT');return}
  adminGameId=g.tournament_game_id;
  await refreshAdmin(true);
  if(supportedNativeGame(g)&&adminSession){
    await autoAssignNativePlayers();
  }
}
async function loadCandidates(){
  const g=currentGame();
  if(!g?.tournament_game_id)return;
  const r=await db.rpc('list_in_app_game_candidates',{p_tournament_game_id:g.tournament_game_id,p_match_id:null});
  if(r.error){console.warn('In-App candidates',r.error);return}
  adminCandidates=Array.isArray(r.data)?r.data:[];
  renderCandidates();
}
function renderCandidates(){
  const wrap=document.getElementById('v15InAppCandidateWrap'),host=document.getElementById('v15InAppCandidates');
  if(!wrap||!host)return;
  wrap.hidden=!adminSession;
  host.innerHTML=adminCandidates.map(c=>`<label class="v15-inapp-candidate"><input type="checkbox" data-inapp-member="${esc(c.tournament_member_id)}" data-inapp-participant="${esc(c.participant_id)}"><i style="background:${colorHex[c.identity_color]||'var(--theme-muted)'}"></i><span><strong>${esc(c.display_name||'PLAYER')}</strong><small>${esc(c.identity_color||'')} · ${esc(c.participant_type||'PLAYER')}</small></span></label>`).join('')||'<div class="v15-inapp-message">KEINE WÄHLBAREN PLAYER.</div>';
  const assigned=new Set((adminSession?.players||[]).map(p=>p.tournament_member_id));
  host.querySelectorAll('[data-inapp-member]').forEach(x=>x.checked=assigned.has(x.dataset.inappMember));
}
function renderAdmin(){
  const panel=ensureAdminPanel();
  if(panel)panel.hidden=!inAppAdminRelevant();
  if(!panel||panel.hidden)return;
  const st=document.getElementById('v15InAppAdminStatus'),info=document.getElementById('v15InAppAdminInfo'),roster=document.getElementById('v15InAppAdminRoster');
  if(!st)return;
  st.textContent=adminSession?statusDE(adminSession.status):'KEINE SESSION';
  const isBuzzer=adminSession?.game?.module_key===BUZZER_MODULE;
  const isWordChain=adminSession?.game?.module_key===WORD_CHAIN_MODULE;
  const isMoreLess=adminSession?.game?.module_key===MORE_LESS_MODULE;
  const isTicTacToe=adminSession?.game?.module_key===TIC_TAC_TOE_MODULE;
  const isReaction=adminSession?.game?.module_key===REACTION_MODULE;
  const isAutoNative=isBuzzer||isMoreLess||isTicTacToe||isReaction;
  const isMoreLessTest=isMoreLess&&isMoreLessNamedQaTest();
  const forceStartWithoutReady=!!adminSession?.public_state?.force_start_without_ready;
  const assignedPlayers=adminSession?.players?.length||0;
  const minPlayers=Number(adminSession?.game?.min_players||2);
  const waiting=String(adminSession?.status||'')==='WAITING_FOR_PLAYERS';
  const canForceStart=(isWordChain&&forceStartWithoutReady&&assignedPlayers>=minPlayers&&waiting)||(isMoreLessTest&&waiting);
  const startBtn=document.getElementById('v15InAppStart');
  const forceStartBtn=document.getElementById('v15InAppForceStart');
  const createBtn=document.getElementById('v15InAppCreate');
  if(startBtn){startBtn.hidden=!!isAutoNative;startBtn.disabled=!adminSession||adminSession.status!=='READY'}
  if(forceStartBtn){
    forceStartBtn.hidden=!((isWordChain&&forceStartWithoutReady&&waiting)||(isMoreLessTest&&waiting));
    forceStartBtn.disabled=!canForceStart;
  }
  if(createBtn){createBtn.hidden=!!isAutoNative;createBtn.disabled=!!adminSession}
  document.getElementById('v15InAppCancel').disabled=!adminSession;
  const completeBtn=document.getElementById('v15InAppComplete');
  if(completeBtn){completeBtn.hidden=!!isAutoNative;completeBtn.disabled=!!isAutoNative||!adminSession||adminSession.status!=='ACTIVE'}
  if(info&&adminSession){
    const extra=isMoreLessTest&&waiting?' · TEST-BOT · START ERZWINGEN VERFÜGBAR':(isAutoNative?' · AUTO-FLOW · ABSCHLUSS AUTOMATISCH':(forceStartWithoutReady?' · QA-OVERRIDE · ADMIN-START OHNE ALLE READYS ERLAUBT':''));
    info.textContent=`SESSION ${String(adminSession.session_id).slice(0,8).toUpperCase()} · ${adminSession.players?.length||0} PLAYER · ${statusDE(adminSession.status)}${extra}`;
  }else if(info&&isBuzzerGame(currentGame())&&buzzerGameIsLive(currentGame())){
    info.textContent='BUZZER SESSION WIRD AUTOMATISCH VORBEREITET …';
  }
  if(roster){
    roster.hidden=!adminSession;
    roster.innerHTML=(adminSession?.players||[]).map(p=>`<div class="v15-inapp-admin-session-row"><b>${esc(p.seat)}</b><span>${esc(p.display_name)} · ${esc(p.identity_color||'')}</span><b>${esc(statusDE(p.status))}</b></div>`).join('')||'<div class="v15-inapp-message">NOCH KEINE PLAYER ZUGEWIESEN.</div>';
  }
  renderCandidates();
}
async function refreshAdmin(force){
  ensureAdminPanel();
  const g=currentGame();
  if(!g?.tournament_game_id)return;
  if(force||adminGameId!==g.tournament_game_id||!adminSession){
    adminGameId=g.tournament_game_id;
    const r=await db.rpc('get_admin_active_in_app_game',{p_tournament_game_id:g.tournament_game_id});
    if(!r.error)adminSession=r.data||null;
    if(adminSession)await loadCandidates();else adminCandidates=[];
  }else if(adminSession){
    const r=await db.rpc('get_in_app_game_session_admin',{p_session_id:adminSession.session_id});
    if(!r.error)adminSession=r.data||adminSession;
  }
  const tttPrestart=isTicTacToeGame(g)&&['PREPARING','ACTIVE'].includes(String(g?.phase||'').toUpperCase())&&!currentMatchHasSoloTestBot(g);
  const moreLessTest=isMoreLessNamedQaTest(g);
  if(supportedNativeGame(g)&&((nativeGameIsLive(g)&&!rt?.test_mode)||tttPrestart||moreLessTest))await ensureNativeLifecycle(g);
  renderAdmin();
}
async function assignRows(rows){
  if(!adminSession)return false;
  const info=document.getElementById('v15InAppAdminInfo');
  const min=Number(adminSession.game?.min_players||2),max=Number(adminSession.game?.max_players||4);
  if(rows.length<min||rows.length>max){
    if(info)info.textContent=`BITTE ${min} BIS ${max} PLAYER AUSWÄHLEN.`;
    return false;
  }
  const selected=new Set(rows.map(x=>x.member));
  for(const p of adminSession.players||[]){
    if(!selected.has(p.tournament_member_id)){
      await db.rpc('remove_in_app_game_player',{p_session_id:adminSession.session_id,p_tournament_member_id:p.tournament_member_id});
    }
  }
  let seat=1;
  for(const x of rows){
    const r=await db.rpc('assign_in_app_game_player',{
      p_session_id:adminSession.session_id,
      p_tournament_member_id:x.member,
      p_participant_id:x.participant,
      p_seat:seat++
    });
    if(r.error){
      if(info)info.textContent='ZUWEISUNGSFEHLER: '+(r.error.message||'UNBEKANNT');
      return false;
    }
  }
  await refreshAdmin(true);
  return true;
}
async function autoAssignNativePlayers(){
  const g=currentGame(),expectedModule=moduleKeyFor(g);
  if(!adminSession||!expectedModule||adminSession.game?.module_key!==expectedModule)return false;
  await loadCandidates();
  const max=Number(adminSession.game?.max_players||8);
  const candidates=adminCandidates.slice(0,max);
  const assigned=new Set((adminSession.players||[]).map(p=>p.tournament_member_id));
  let nextSeat=Math.max(0,...(adminSession.players||[]).map(p=>Number(p.seat)||0))+1;
  let changed=false;
  for(const c of candidates){
    if(assigned.has(c.tournament_member_id))continue;
    const r=await db.rpc('assign_in_app_game_player',{
      p_session_id:adminSession.session_id,
      p_tournament_member_id:c.tournament_member_id,
      p_participant_id:c.participant_id,
      p_seat:nextSeat++
    });
    if(r.error){console.warn('Native In-App auto assign',r.error);continue}
    changed=true;
  }
  if(changed){
    const r=await db.rpc('get_in_app_game_session_admin',{p_session_id:adminSession.session_id});
    if(!r.error)adminSession=r.data||adminSession;
  }
  const info=document.getElementById('v15InAppAdminInfo');
  if(info){
    const min=Number(adminSession.game?.min_players||2),n=adminSession.players?.length||0;
    info.textContent=n>=min
      ?`${String(g?.name||'IN-APP GAME').toUpperCase()} · ${n} PLAYER AUTOMATISCH ZUGEWIESEN · WARTET AUF BEREITSCHAFT`
      :`${String(g?.name||'IN-APP GAME').toUpperCase()} · ${n} PLAYER ZUGEWIESEN · MINDESTENS ${min} PLAYER-ACCOUNTS BENÖTIGT`;
  }
  return true;
}
async function ensureNativeLifecycle(g){
  if(autoLifecycleBusy||!rt?.is_admin||!db||!g?.tournament_game_id||!supportedNativeGame(g))return;
  if(!isTicTacToeGame(g)&&!nativeGameIsLive(g)&&!isMoreLessNamedQaTest(g))return;
  if(isTicTacToeGame(g)&&currentMatchHasSoloTestBot(g))return;
  autoLifecycleBusy=true;
  try{
    const expectedKey=gameKeyFor(g),expectedModule=moduleKeyFor(g);
    if(isTicTacToeGame(g)){
      const selection=window.skielsenV15?.gameControl;
      const st=window.skielsenV15?.state;
      const localGame=selection?.g===g?selection.g:(st?.games||[]).find(x=>x.tournament_game_id===g.tournament_game_id)||g;
      const m=selection?.g===g?selection.m:(localGame?.matches||[])[localGame?.matchIndex||0];
      if(!m?.a||!m?.b)return;
      if(adminSession&&adminGameId!==g.tournament_game_id){adminSession=null;adminCandidates=[]}
      if(adminSession){
        const ps=new Set((adminSession.players||[]).map(p=>p.participant_id));
        if(!ps.has(m.a)||!ps.has(m.b)){
          adminSession=null;adminCandidates=[];
        }
      }
      if(!adminSession){
        const created=await db.rpc('create_tic_tac_toe_match_session',{
          p_tournament_game_id:g.tournament_game_id,
          p_participant_a_id:m.a,
          p_participant_b_id:m.b
        });
        if(created.error){console.warn('Tic Tac Toe prestart session',created.error);return}
        adminGameId=g.tournament_game_id;
        const fetched=await db.rpc('get_admin_active_in_app_game',{p_tournament_game_id:g.tournament_game_id});
        if(!fetched.error)adminSession=fetched.data||null;
      }
      return;
    }
    const activation=await db.rpc('activate_tournament_game',{p_tournament_game_id:g.tournament_game_id});
    if(activation.error){console.warn('Native In-App server activation',activation.error);return}
    if(activation.data?.status!=='ACTIVE')return;
    if(adminSession&&adminGameId!==g.tournament_game_id){adminSession=null;adminCandidates=[]}
    if(!adminSession){
      const created=await db.rpc('create_in_app_game_session',{
        p_tournament_game_id:g.tournament_game_id,
        p_game_key:expectedKey,
        p_match_id:null,
        p_public_state:{
          source:`V${VERSION}`,
          game_name:g.name||null,
          game_id:g.game_id||null,
          familiarity_tier:expectedModule===MORE_LESS_MODULE?null:String(g?.rules_json?.familiarityTier||g?.game_rules_snapshot?.familiarityTier||'NORMAL').toUpperCase(),
          occurrence_threshold:Number(g?.rules_json?.occurrenceThreshold||g?.game_rules_snapshot?.occurrenceThreshold||35),
          time_limit_seconds:Number(g?.rules_json?.timeLimitSeconds||g?.game_rules_snapshot?.timeLimitSeconds||15),
          difficulty_required:expectedModule===WORD_CHAIN_MODULE||expectedModule===REACTION_MODULE,
          word_chain_rules_version:expectedModule===WORD_CHAIN_MODULE?4:null,
          reaction_difficulty:expectedModule===REACTION_MODULE?null:undefined,
          reaction_rules_version:expectedModule===REACTION_MODULE?3:null,
          auto_created:true
        }
      });
      if(created.error){console.warn('Native In-App auto create',created.error);return}
      adminGameId=g.tournament_game_id;
      const fetched=await db.rpc('get_admin_active_in_app_game',{p_tournament_game_id:g.tournament_game_id});
      if(!fetched.error)adminSession=fetched.data||null;
    }
    if(!adminSession||adminSession.game?.module_key!==expectedModule)return;
    await autoAssignNativePlayers();
    const min=Number(adminSession.game?.min_players||2),players=adminSession.players?.length||0;
    // Wortkette deliberately waits for an explicit admin session start so every
    // player gets the Ready / Rule-Set screen. Other native games keep the
    // existing auto-start behaviour when everybody is ready.
    if(expectedModule!==WORD_CHAIN_MODULE&&adminSession.status==='READY'&&players>=min){
      const started=await db.rpc('start_in_app_game_session',{p_session_id:adminSession.session_id});
      if(started.error){console.warn('Native In-App auto start',started.error)}
      else{
        const fetched=await db.rpc('get_in_app_game_session_admin',{p_session_id:adminSession.session_id});
        if(!fetched.error)adminSession=fetched.data||adminSession;
      }
    }
  }finally{autoLifecycleBusy=false}
}
async function assignSelected(){
  if(!adminSession)return;
  const checked=[...document.querySelectorAll('#v15InAppCandidates [data-inapp-member]:checked')];
  await assignRows(checked.map(x=>({member:x.dataset.inappMember,participant:x.dataset.inappParticipant})));
}
async function startAdminSession(){
  if(!adminSession)return;
  const r=await db.rpc('start_in_app_game_session',{p_session_id:adminSession.session_id});
  if(r.error){
    const info=document.getElementById('v15InAppAdminInfo');
    if(info)info.textContent='STARTFEHLER: '+(r.error.message||'UNBEKANNT');
    return;
  }
  await refreshAdmin(true);
  await pollPlayer();
}
async function cancelAdminSession(){
  if(!adminSession)return;
  if(!confirm('IN-APP SESSION ABBRECHEN?'))return;
  await db.rpc('cancel_in_app_game_session',{p_session_id:adminSession.session_id});
  adminSession=null;adminCandidates=[];renderAdmin();await pollPlayer();
}
async function completeAdminSession(){
  if(!adminSession)return;
  await db.rpc('complete_in_app_game_session',{p_session_id:adminSession.session_id});
  adminSession=null;adminCandidates=[];renderAdmin();await pollPlayer();
}
async function startTestTicTacToe(runtime,g,m){
  rt=runtime||window.skielsenV15?.runtime||rt;
  db=window.skielsenDb?.client||db;
  const st=window.skielsenV15?.state;
  if(!rt?.test_mode||!isTicTacToeGame(g)||!m||!st)return false;
  const pA=(st.participants||[]).find(p=>p.id===m.a);
  const pB=(st.participants||[]).find(p=>p.id===m.b);
  const bot=pA?.isBotParticipant?pA:(pB?.isBotParticipant?pB:null);
  const human=bot?.id===pA?.id?pB:pA;
  if(!bot||!human)return false;

  localTestTicTacToeActive=true;
  playerSession=null;
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  prepareInAppSurface('ttt-test-'+String(m.id||Date.now()),g?.name||'TIC TAC TOE',true);
  layer.classList.remove('buzzer-mode','word-chain-mode');
  layer.hidden=false;
  host.innerHTML='<div id="v15TicTacToeRoot" data-test-bot="true"><div class="v15-inapp-message">TIC TAC TOE TEST-BOT WIRD GELADEN …</div></div>';
  updateInAppChrome();

  try{
    await ensureTicTacToeAssets();
    const rootNow=document.getElementById('v15TicTacToeRoot');
    if(!rootNow)return false;
    window.skielsenTicTacToe?.mountTestBot?.(rootNow,{
      human:{id:human.id,name:human.name,color:human.color},
      bot:{id:bot.id,name:bot.name,color:bot.color},
      onComplete:winnerId=>{
        const a=winnerId===m.a?1:0,b=winnerId===m.b?1:0;
        finishInAppSurface();
        window.skielsenV15?.concludeCurrentMatch?.(a,b);
      }
    });
    openInAppFullscreen('push');
    return true;
  }catch(err){
    localTestTicTacToeActive=false;
    console.warn('Tic Tac Toe local test bot',err);
    host.innerHTML='<div class="v15-inapp-message">TIC-TAC-TOE-TESTBOT KONNTE NICHT GELADEN WERDEN.</div>';
    return false;
  }
}

function finishInAppSurface(){
  localTestTicTacToeActive=false;
  const layer=ensureLayer();
  layer.hidden=true;
  window.skielsenBuzzerTime?.unmount?.();
  window.skielsenMoreLess?.unmount?.();
  window.skielsenWordChain?.unmount?.();
  window.skielsenTicTacToe?.unmount?.();
  window.skielsenReaction?.unmount?.();
  const host=document.getElementById('v15InAppPlayerContent');if(host)host.innerHTML='';
  clearInAppSurface();
  return true;
}
function start(runtime){
  rt=runtime||window.skielsenV15?.runtime||null;
  db=window.skielsenDb?.client||null;
  if(!rt||!db)return false;
  syncVisibleVersion();
  ensureLayer();
  ensureAdminPanel();
  ensureBuzzerBridgeAssets().catch(err=>console.warn('Buzzer bridge assets',err));
  clearInterval(pollTimer);
  void forceOpenActiveInApp('replace').then(opened=>{if(!opened)void pollPlayer()});
  pollTimer=setInterval(pollPlayer,POLL_MS);
  return true;
}
let tries=0;
const boot=setInterval(()=>{
  tries++;
  if(start(window.skielsenV15?.runtime)||tries>80)clearInterval(boot);
},250);

window.skielsenHistory?.register('inapp',()=>{
  if(inAppSurfaceLive)return openInAppFullscreen('none');
  if(window.skielsenHistory?.current()?.area==='inapp')window.skielsenHistory.back();
  return false;
});
window.addEventListener('popstate',()=>{
  const nav=window.skielsenHistory?.current();
  if(nav?.area!=='inapp'&&hasInAppSurface()&&!inAppMinimized)minimizeInApp(false);
});

window.addEventListener('beforeunload',()=>{
  clearInterval(pollTimer);clearInterval(boot);window.skielsenBuzzerTime?.unmount?.();window.skielsenMoreLess?.unmount?.();window.skielsenWordChain?.unmount?.();window.skielsenTicTacToe?.unmount?.();window.skielsenReaction?.unmount?.();
});
window.skielsenInApp={
  start,
  startTestTicTacToe,
  forceStartCurrent,
  poll:pollPlayer,
  minimize:()=>minimizeInApp(true),
  minimizeForNavigation:()=>minimizeInApp(false),
  openFullscreen:()=>openInAppFullscreen('push')||forceOpenActiveInApp('push'),
  openActive:()=>forceOpenActiveInApp('push'),
  finishAndExit:finishInAppSurface,
  markConcluded:markInAppConcluded,
  completeAndExit:()=>window.skielsenBuzzerBridge?.completePendingInAppGame?.()||finishInAppSurface(),
  flowContract:GAME_FLOW_STEPS,
  get fullscreen(){return inAppFullscreen()},
  get minimized(){return inAppMinimized},
  get live(){return inAppSurfaceLive},
  get session(){return playerSession},
  submitAction:async(type,payload={})=>playerSession?db.rpc('submit_in_app_game_action',{p_session_id:playerSession.session_id,p_action_type:type,p_payload:payload}):{data:null,error:new Error('NO_ACTIVE_IN_APP_SESSION')}
};
})();