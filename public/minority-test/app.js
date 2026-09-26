(()=>{
'use strict';
const RULES=globalThis.SkielsenMinorityRules;
const URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const SESSION_KEY='skielsen.native.supabase.session';
const COLORS=['#1515ff','#ff1717','#f2b705','#00a65a'];
const DEFAULT_NAMES=['BLAU','ROT','GELB','GRÜN'];
const stage=document.querySelector('#minorityStage');
const topState=document.querySelector('#minorityTopState');
const progress=document.querySelector('#minorityProgress');
const feedback=document.querySelector('#minorityFeedback');
const params=new URLSearchParams(location.search);
const quickLobby=params.get('quick_lobby');
let state={mode:quickLobby?'remote':'local',screen:'setup',difficulty:'NORMAL',roundCount:10,players:[],scores:[0,0,0,0],round:1,roundValue:1,schedule:[],choice:null,reveal:null};
let poll=0;

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function setFeedback(v=''){feedback.textContent=v}
function setScreen(name){state.screen=name;render()}
function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
async function rpc(name,args={}){
 const s=session();if(!s?.access_token)throw new Error('AUTH_REQUIRED');
 const res=await fetch(URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data?.message||data?.error||name);
 return data;
}
function identity(seat){return COLORS[(seat-1)%COLORS.length]}
function playerName(seat){
 const p=state.players.find(x=>Number(x.seat)===seat);
 return p?.display_name||DEFAULT_NAMES[seat-1];
}
function isMe(seat){
 const p=state.players.find(x=>Number(x.seat)===seat);
 return !!p?.is_me;
}
function standings(){
 return [1,2,3,4].map((seat,i)=>({seat,name:playerName(seat),score:Number(state.scores[i])||0,color:identity(seat)}))
 .sort((a,b)=>b.score-a.score||a.seat-b.seat);
}
function render(){
 topState.textContent=state.screen.toUpperCase();
 const pct=state.screen==='game'||state.screen==='reveal'?Math.min(100,Math.round(((state.round-1)/Math.max(1,state.roundCount))*100)):state.screen==='ranking'?100:0;
 progress.style.width=pct+'%';
 if(state.screen==='wait_setup')return renderWaitSetup();
 if(state.screen==='setup')return renderSetup();
 if(state.screen==='ready')return renderReady();
 if(state.screen==='game'||state.screen==='reveal')return renderGame();
 if(state.screen==='ranking')return renderRanking();
}
function renderWaitSetup(){
 stage.innerHTML=`<p class="m-kicker">MINORITY · QUICK GAME</p><h1 class="m-title">WARTEN.</h1><p class="m-copy">Der Host legt Schwierigkeit und QA-Rundenzahl fest. Danach erscheint automatisch der Ready Screen.</p><div class="m-wait" style="margin-top:22px">WARTET AUF DEN HOST …</div>`;
}
function renderSetup(){
 const difficultyCopy={
   EASY:'2 Antworten · Minderheit +1 · kein Pot · keine Chaos Round.',
   NORMAL:'Pot startet bei 1 und wächst ohne Minderheit. Jede 5. Frage hat 3 Antworten.',
   HARDCORE:'Wie Normal. Jede 5. Frage hat 3 oder 4 Antworten. Bei 4:0 verliert die Führung −1.'
 };
 stage.innerHTML=`
   <div class="m-hero">
     <small class="m-kicker">SCHWIERIGKEIT</small>
     <h1 class="m-title">MINORITY.</h1>
     <p class="m-copy">Wähle die Regeln für dieses Match.</p>
   </div>

   <section class="m-card m-setup-card">
     <div class="m-card-head">
       <strong>SCHWIERIGKEIT</strong>
       <span>1 AUSWÄHLEN</span>
     </div>
     <div class="m-choice-grid" role="group" aria-label="Schwierigkeitsgrad">
       ${[
         ['EASY','Direkt. Minderheit = +1.'],
         ['NORMAL','Pot-System + 3er Chaos Round.'],
         ['HARDCORE','Pot + 3/4er Chaos + 4:0 Strafe.']
       ].map(([key,copy])=>`<button type="button" class="m-choice ${state.difficulty===key?'active':''}" data-difficulty="${key}"><strong>${key}</strong><span>${copy}</span></button>`).join('')}
     </div>
   </section>

   <section class="m-card m-setup-card">
     <div class="m-card-head">
       <strong>QA-RUNDEN</strong>
       <span>1 AUSWÄHLEN</span>
     </div>
     <div class="m-round-options" role="group" aria-label="QA-Runden">
       ${[5,10,15].map(count=>`<button type="button" class="m-choice m-round-choice ${state.roundCount===count?'active':''}" data-rounds="${count}"><strong>${count}</strong></button>`).join('')}
     </div>
   </section>

   <section class="m-rule-note">
     <small>AKTIVE REGEL</small>
     <strong id="mRuleTitle">${esc(state.difficulty)}</strong>
     <span id="mRuleText">${esc(difficultyCopy[state.difficulty])}</span>
   </section>

   <button class="m-primary m-blocking" id="mSetupNext" type="button">WEITER →</button>`;

 const updateDifficulty=()=>{
   stage.querySelectorAll('[data-difficulty]').forEach(btn=>btn.classList.toggle('active',btn.dataset.difficulty===state.difficulty));
   document.querySelector('#mRuleTitle').textContent=state.difficulty;
   document.querySelector('#mRuleText').textContent=difficultyCopy[state.difficulty];
 };
 stage.querySelectorAll('[data-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{
   state.difficulty=btn.dataset.difficulty;
   updateDifficulty();
 }));
 stage.querySelectorAll('[data-rounds]').forEach(btn=>btn.addEventListener('click',()=>{
   state.roundCount=Number(btn.dataset.rounds);
   stage.querySelectorAll('[data-rounds]').forEach(item=>item.classList.toggle('active',Number(item.dataset.rounds)===state.roundCount));
 }));

 document.querySelector('#mSetupNext').addEventListener('click',async e=>{
   if(state.mode==='remote'){
     e.currentTarget.disabled=true;setFeedback('');
     try{
       const snapshot=await rpc('configure_quick_minority_game',{p_lobby_id:quickLobby,p_difficulty:state.difficulty,p_round_count:state.roundCount});
       applyRemote(snapshot);
     }catch(err){setFeedback(humanError(err));e.currentTarget.disabled=false}
   }else{
     state.players=[1,2,3,4].map((seat,i)=>({seat,display_name:i===0?'DU':'BOT '+i,is_me:i===0,is_bot:i>0}));
     state.schedule=RULES.buildLocalSchedule(state.difficulty,state.roundCount);
     state.scores=[0,0,0,0];state.round=1;state.roundValue=1;state.choice=null;state.reveal=null;
     setScreen('ready');
   }
 });
}
function renderReady(){
 stage.innerHTML=`
   <div class="m-hero">
     <small class="m-kicker">READY</small>
     <h1 class="m-title">MINORITY.</h1>
     <p class="m-copy">Kurzer Check der aktiven Regeln vor dem Start.</p>
   </div>

   <section class="m-card m-ready-summary">
     <div><small>MODUS</small><strong>SOLO</strong></div>
     <div><small>SCHWIERIGKEIT</small><strong>${esc(state.difficulty)}</strong></div>
     <div><small>RUNDEN</small><strong>${state.roundCount}</strong></div>
   </section>

   <section class="m-card m-ready-rules">
     <div><b>01</b><span><strong>VERDECKTE WAHL</strong><small>Alle wählen gleichzeitig. Ein Tap auf eine Kachel ist final.</small></span></div>
     <div><b>02</b><span><strong>MINDERHEIT</strong><small>Die am seltensten gewählte echte Minderheit gewinnt den aktuellen Rundenwert.</small></span></div>
     <div><b>03</b><span><strong>POT</strong><small>${state.difficulty==='EASY'?'Easy spielt ohne Pot.':'Ohne Minderheit steigt der Wert der nächsten Runde um +1.'}</small></span></div>
     <div><b>05</b><span><strong>CHAOS ROUND</strong><small>${state.difficulty==='EASY'?'In Easy gibt es keine Chaos Round.':state.difficulty==='NORMAL'?'Jede 5. Frage hat 3 Antworten.':'Jede 5. Frage hat 3 oder 4 Antworten.'}</small></span></div>
   </section>

   <section class="m-card m-ready-roster">
     ${[1,2,3,4].map(seat=>{
       const p=state.players.find(item=>Number(item.seat)===seat);
       const status=isMe(seat)?(p?.ready?'BEREIT':'DU'):(p?.is_bot?'BOT':(p?.ready?'BEREIT':'WARTET'));
       return `<div class="m-ready-player" style="--identity:${identity(seat)}"><i></i><strong>${esc(playerName(seat))}</strong><span>${status}</span></div>`;
     }).join('')}
   </section>

   <div class="m-ready-actions">
     <button class="m-secondary" id="mReadyBack" type="button">← ZURÜCK</button>
     <button class="m-primary m-blocking" id="mReady" type="button">ICH BIN BEREIT →</button>
   </div>`;
 const me=state.players.find(p=>p.is_me);
 const readyButton=document.querySelector('#mReady');
 if(me?.ready){readyButton.disabled=true;readyButton.textContent='WARTET AUF DIE ANDEREN …'}
 document.querySelector('#mReadyBack').addEventListener('click',()=>{
   if(state.mode==='local')setScreen('setup');
   else history.back();
 });
 readyButton.addEventListener('click',async e=>{
   if(state.mode==='remote'){
     e.currentTarget.disabled=true;
     try{applyRemote(await rpc('ready_quick_minority_game',{p_lobby_id:quickLobby}))}
     catch(err){setFeedback(humanError(err));e.currentTarget.disabled=false}
   }else setScreen('game');
 });
}
function currentQuestion(){return state.schedule[Math.max(0,state.round-1)]||state.question||{options:['—','—'],optionCount:2}}
function renderGame(){
 const q=currentQuestion(),revealed=state.screen==='reveal'&&state.reveal;
 const res=state.reveal;
 const options=q.options||[];
 const myChoice=state.choice;
 stage.innerHTML=`
   <div class="m-game-head">
     <div><div class="m-round">RUNDE ${state.round} / ${state.roundCount}</div><h1 class="m-title" style="font-size:42px">WÄHLE.</h1></div>
     <div class="m-pot"><small>${state.difficulty==='EASY'?'WERT':'POT'}</small><strong>${state.roundValue}</strong></div>
   </div>
   <div class="m-question"><small>${options.length>2?'CHAOS ROUND':'MINORITY'}</small><h2>Was wählst du?</h2></div>
   <div class="m-options" data-count="${options.length}">${options.map((label,i)=>{
     const count=revealed?Number(res.counts?.[i]||0):null;
     const isWin=revealed&&res.winningOptions?.includes(i+1);
     const cls=[myChoice===i+1?'is-selected':'',isWin?'is-winner':'',revealed&&!isWin?'is-majority':''].filter(Boolean).join(' ');
     const lengthClass=String(label).length>=13?'is-xlong':String(label).length>=10?'is-long':'';
     return `<button class="m-option ${cls} ${lengthClass}" type="button" data-choice="${i+1}" ${revealed||myChoice?'disabled':''}><span class="m-option-label">${esc(label)}</span>${revealed?`<span class="m-option-count">${count} × gewählt</span>`:''}</button>`;
   }).join('')}</div>
   ${revealed?revealHtml(res):myChoice?`<div class="m-wait">AUSWAHL GELOCKT · WARTET AUF DIE ANDEREN …</div>`:`<div class="m-wait">TIPPE AUF EINE ANTWORT</div>`}
   <div class="m-scorebar">${[1,2,3,4].map((seat,i)=>`<div class="m-score" style="--identity:${identity(seat)}"><strong>${Number(state.scores[i])||0}</strong><span>${esc(playerName(seat))}</span></div>`).join('')}</div>`;
 if(!revealed&&!myChoice){
   stage.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',async()=>{
     const choice=Number(btn.dataset.choice);
     if(state.choice)return;
     state.choice=choice;
     setFeedback('');
     render();
     if(state.mode==='remote'){
       try{applyRemote(await rpc('submit_quick_minority_choice',{p_lobby_id:quickLobby,p_choice:choice}))}
       catch(err){state.choice=null;setFeedback(humanError(err));render()}
     }else{
       resolveLocalRound();
     }
   }));
 }else{
   document.querySelector('#mNext')?.addEventListener('click',async e=>{
     e.currentTarget.disabled=true;
     if(state.mode==='remote'){
       try{applyRemote(await rpc('advance_quick_minority_game',{p_lobby_id:quickLobby}))}
       catch(err){setFeedback(humanError(err));e.currentTarget.disabled=false}
     }else advanceLocal();
   });
 }
}
function revealHtml(res){
 const meSeat=(state.players.find(p=>p.is_me)||{seat:1}).seat;
 const won=(res.winningSeats||[]).includes(Number(meSeat));
 const penalized=(res.penaltySeats||[]).includes(Number(meSeat));
 let text=res.hasMinority?(won?'DU BIST DIE MINDERHEIT.':'MINDERHEIT GEFUNDEN.'):'KEINE MINDERHEIT.';
 if(penalized)text='FÜHRUNGSSTRAFE −1.';
 return `<div class="m-reveal-banner ${won?'win':''} ${penalized?'penalty':''}">${text}</div><button class="m-primary m-lock" id="mNext" type="button">${state.round>=state.roundCount?'ERGEBNIS →':'NÄCHSTE RUNDE →'}</button>`;
}
function resolveLocalRound(){
 const q=currentQuestion();
 const choices=[state.choice];
 for(let seat=2;seat<=4;seat++)choices.push(1+Math.floor(Math.random()*q.options.length));
 const res=RULES.resolveRound({difficulty:state.difficulty,choices,optionCount:q.options.length,scores:state.scores,roundValue:state.roundValue});
 const winningOptions=[...new Set(res.winningSeats.map(seat=>choices[seat-1]))];
 state.scores=res.scores;state.reveal={...res,winningOptions};state.screen='reveal';render();
}
function advanceLocal(){
 if(state.round>=state.roundCount){state.screen='ranking';return render()}
 state.round+=1;state.roundValue=state.reveal?.nextRoundValue||1;state.choice=null;state.reveal=null;state.screen='game';render();
}
function renderRanking(){
 const rows=standings();
 stage.innerHTML=`
   <p class="m-kicker">END GAME RANKING</p><h1 class="m-title">ERGEBNIS.</h1>
   <div class="m-ranking">${rows.map((p,i)=>`<div class="m-rank-row" style="--identity:${p.color}"><b>#${i+1}</b><i></i><strong>${esc(p.name)}</strong><span>${p.score}</span></div>`).join('')}</div>
   <button class="m-primary" id="mAgain" type="button" style="margin-top:16px">${state.mode==='remote'?'ZURÜCK ZU QUICK GAMES':'NOCHMAL'}</button>`;
 document.querySelector('#mAgain').addEventListener('click',()=>{if(state.mode==='remote')location.assign('../quick-games/');else{state.screen='setup';state.choice=null;state.reveal=null;render()}});
}
function humanError(err){
 const m=String(err?.message||err||'');
 if(m.includes('AUTH'))return 'Bitte zuerst in Skielsen anmelden.';
 if(m.includes('HOST'))return 'Nur der Host kann diese Aktion ausführen.';
 if(m.includes('WAITING'))return 'Wartet noch auf andere Spieler.';
 if(m.includes('ALREADY'))return 'Deine Auswahl ist bereits bestätigt.';
 return m||'Minority konnte nicht synchronisiert werden.';
}
function applyRemote(snapshot){
 if(!snapshot)return;
 state.mode='remote';
 state.difficulty=snapshot.difficulty||state.difficulty;
 state.roundCount=Number(snapshot.roundCount||snapshot.round_count||state.roundCount);
 state.players=Array.isArray(snapshot.players)?snapshot.players:state.players;
 state.scores=Array.isArray(snapshot.scores)?snapshot.scores:state.scores;
 state.round=Number(snapshot.round||1);
 state.roundValue=Number(snapshot.roundValue||snapshot.round_value||1);
 state.choice=snapshot.myChoice??snapshot.my_choice??null;
 state.question=snapshot.question||state.question;
 state.schedule=[];
 state.reveal=snapshot.reveal||null;
 state.screen=String(snapshot.stage||'READY').toLowerCase();
 if(state.screen==='playing')state.screen='game';
 if(state.screen==='resolved')state.screen='reveal';
 if(state.screen==='finished')state.screen='ranking';
 setFeedback('');
 render();
 if(state.mode==='remote'&&!poll)poll=setInterval(refreshRemote,600);
}
async function refreshRemote(){
 if(!quickLobby)return;
 try{applyRemote(await rpc('get_quick_minority_game',{p_lobby_id:quickLobby}))}
 catch(err){const msg=String(err?.message||err||'');if(msg.includes('NOT_CONFIGURED'))return;setFeedback(humanError(err))}
}
async function boot(){
 if(!RULES){setFeedback('Minority Rules konnten nicht geladen werden.');return}
 if(!quickLobby){render();return}
 try{applyRemote(await rpc('get_quick_minority_game',{p_lobby_id:quickLobby}))}
 catch(err){
   const msg=String(err?.message||err||'');
   if(msg.includes('NOT_CONFIGURED')){
     try{const lobby=await rpc('get_quick_game_lobby',{p_lobby_id:quickLobby});state.screen=lobby?.is_host?'setup':'wait_setup';render();if(!poll)poll=setInterval(refreshRemote,600);return}
     catch(inner){setFeedback(humanError(inner));render();return}
   }
   setFeedback(humanError(err));render();
 }
}
window.addEventListener('beforeunload',()=>{if(poll)clearInterval(poll)});
boot();
})();