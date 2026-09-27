(()=>{
'use strict';
const RULES=globalThis.SkielsenMinorityRules;
const LAB_CONFIG=globalThis.SkielsenMinorityLabConfig;
const JACKPOT=globalThis.SkielsenMinorityJackpotEngine;
const JACKPOT_UI=globalThis.SkielsenMinorityJackpotUI;
if(!RULES||!LAB_CONFIG||!JACKPOT||!JACKPOT_UI)throw new Error('MINORITY_LAB_DEPENDENCY_REQUIRED');
const URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const SESSION_KEY='skielsen.native.supabase.session';
const COLORS=['#1515ff','#ff1717','#f2b705','#00a65a'];
const DEFAULT_NAMES=['BLAU','ROT','GELB','GRÜN'];
const stage=document.querySelector('#minorityStage');
const topState=document.querySelector('#minorityTopState');
const progress=document.querySelector('#minorityProgress');
const feedback=document.querySelector('#minorityFeedback');
const jackpotRoot=document.querySelector('#minorityJackpotOverlay');
const jackpotUI=JACKPOT_UI.create(jackpotRoot);
const params=new URLSearchParams(location.search);
const quickLobby=params.get('quick_lobby');
const qaMode=String(params.get('qa')||'').toLowerCase();
let state={mode:quickLobby?'remote':'local',screen:'setup',difficulty:quickLobby?'NORMAL':'HARDCORE',roundCount:quickLobby?10:LAB_CONFIG.local.defaultRounds,players:[],scores:[0,0,0,0],round:1,roundValue:1,schedule:[],choice:null,reveal:null,qaJackpotConsumed:false};
let poll=0,revealTimer=0,revealTimerKey='',jackpotBusy=false;

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
function placementPoints(index){return [5,4,2,0][index]??0}
function standings(){
 return [1,2,3,4].map((seat,i)=>({seat,name:playerName(seat),score:Number(state.scores[i])||0,color:identity(seat)}))
 .sort((a,b)=>b.score-a.score||a.seat-b.seat);
}
function render(){
 const activeGame=state.screen==='game'||state.screen==='reveal';
 document.body.classList.toggle('minority-game-active',activeGame);
 topState.textContent=activeGame?'SPIEL':state.screen.toUpperCase();
 const pct=activeGame?Math.min(100,Math.round((state.round/Math.max(1,state.roundCount))*100)):state.screen==='ranking'?100:0;
 progress.style.width=pct+'%';
 if(!activeGame&&revealTimer){clearTimeout(revealTimer);revealTimer=0;revealTimerKey=''}
 if(activeGame)window.scrollTo(0,0);
 if(state.screen==='wait_setup')return renderWaitSetup();
 if(state.screen==='setup')return renderSetup();
 if(state.screen==='ready')return renderReady();
 if(activeGame)return renderGame();
 if(state.screen==='ranking')return renderRanking();
}
function renderWaitSetup(){
 stage.innerHTML=`<p class="m-kicker">MINORITY · QUICK GAME</p><h1 class="m-title">WARTEN.</h1><p class="m-copy">Der Host legt Schwierigkeit und QA-Rundenzahl fest. Danach erscheint automatisch der Ready Screen.</p><div class="m-wait" style="margin-top:22px">WARTET AUF DEN HOST …</div>`;
}
function renderSetup(){
 const difficultyCopy={
   EASY:'2 Antworten · Minderheit +1 · kein Pot · keine Chaos Round.',
   NORMAL:'Pot startet bei 1 und wächst ohne Minderheit. Jede 5. Frage hat 3 Antworten.',
   HARDCORE:'LAB: Pot 1 → 2 → 5 → 8 → 13 · Chaos jede 10. Runde · Jackpot ab Pot 5 · 4:0 Führungsstrafe.'
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
         ['HARDCORE','Pot-Stufen + Jackpot + 3/4er Chaos.']
       ].map(([key,copy])=>`<button type="button" class="m-choice ${state.difficulty===key?'active':''}" data-difficulty="${key}"><strong>${key}</strong><span>${copy}</span></button>`).join('')}
     </div>
   </section>

   <section class="m-card m-setup-card">
     <div class="m-card-head">
       <strong>QA-RUNDEN</strong>
       <span>1 AUSWÄHLEN</span>
     </div>
     <div class="m-round-options" role="group" aria-label="QA-Runden">
       ${(state.mode==='remote'?[5,10,15]:LAB_CONFIG.local.roundOptions).map(count=>`<button type="button" class="m-choice m-round-choice ${state.roundCount===count?'active':''}" data-rounds="${count}"><strong>${count}</strong></button>`).join('')}
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
     state.schedule=JACKPOT.buildSchedule({rules:RULES,difficulty:state.difficulty,roundCount:state.roundCount});
     state.scores=[0,0,0,0];state.round=1;state.roundValue=qaMode==='jackpot'?5:1;state.choice=null;state.reveal=null;state.qaJackpotConsumed=false;
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
     <div><b>03</b><span><strong>POT</strong><small>${state.difficulty==='EASY'?'Easy spielt ohne Pot.':'LAB-Pot: 1 → 2 → 5 → 8 → 13. Ohne Minority steigt er auf die nächste Stufe.'}</small></span></div>
     <div><b>04</b><span><strong>JACKPOT</strong><small>${state.difficulty==='HARDCORE'?'Ab Pot 5 wählen die Minority-Gewinner geheim TAKE oder SPIN.':'Jackpot ist ausschließlich ein Hardcore-Feature.'}</small></span></div>
     <div><b>05</b><span><strong>CHAOS ROUND</strong><small>${state.difficulty==='EASY'?'In Easy gibt es keine Chaos Round.':state.mode==='local'?'Im LAB ist jede 10. Runde eine Chaos Round.':'Remote nutzt weiterhin den Stable-Serververtrag.'}</small></span></div>
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
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function localRevealLabel(){
 const counts=state.reveal?.counts||[];
 if(counts.length===2&&counts[0]===counts[1])return 'TIE · '+counts[0]+':'+counts[1];
 if(state.reveal?.isFourZero)return '4:0 · KEINE MINORITY';
 return 'KEINE MINORITY';
}

async function collectJackpotDecision(seat,potValue){
 const player=state.players.find(item=>Number(item.seat)===Number(seat));
 if(player?.is_bot){
   await sleep(180);
   return Math.random()<LAB_CONFIG.jackpot.botSpinProbability?'SPIN':'TAKE';
 }
 return await new Promise(resolve=>jackpotUI.showDecision({
   name:playerName(seat),
   potValue,
   participantCount:state.reveal?.winningSeats?.length||1,
   onChoose:resolve
 }));
}

async function runJackpotSpin(row){
 const player=state.players.find(item=>Number(item.seat)===Number(row.seat));
 return await new Promise(resolve=>jackpotUI.showSpin({
   name:playerName(row.seat),
   base:row.slotBase,
   autoStart:!!player?.is_bot,
   onResolved:resolve
 }));
}

async function runSilentJackpotSpin(row,index=0){
 const stopMs=Math.max(...LAB_CONFIG.slot.reelStopMs)+220+(index*120);
 await sleep(stopMs);
 const symbols=JACKPOT.spin();
 return JACKPOT.spinPayout(row.slotBase,symbols);
}

async function startJackpotFlow(){
 if(jackpotBusy||state.mode!=='local'||!state.reveal?.jackpot)return;
 jackpotBusy=true;
 document.body.classList.add('minority-lab-jackpot-active');
 topState.textContent='JACKPOT';
 let completed=false;

 try{
   const winners=state.reveal.winningSeats.slice();
   const potValue=Number(state.reveal.jackpotPot)||state.roundValue;
   const decisions={};

   if(!winners.length)throw new Error('JACKPOT_REQUIRES_WINNERS');
   for(const seat of winners)decisions[seat]=await collectJackpotDecision(seat,potValue);

   const plan=JACKPOT.resolveDecisions({
     winningSeats:winners,
     potValue,
     decisions
   });

   const nextScores=state.scores.slice();
   for(const row of plan.rows){
     if(row.decision==='TAKE')nextScores[row.seat-1]+=row.takePayout;
   }
   state.scores=nextScores.slice();

   const me=state.players.find(player=>player.is_me);
   const mySeat=Number(me?.seat)||0;
   const myRow=plan.rows.find(row=>row.seat===mySeat)||null;
   const amSpinner=myRow?.decision==='SPIN';
   const shouldWatchBoard=!amSpinner;
   const board=shouldWatchBoard
     ?jackpotUI.showResolutionBoard({rows:plan.rows,playerName})
     :null;

   const spinRows=plan.rows.filter(item=>item.decision==='SPIN');
   const spinTasks=spinRows.map((row,index)=>{
     const isOwnSpin=row.seat===mySeat;
     const task=isOwnSpin&&!shouldWatchBoard
       ?runJackpotSpin(row)
       :runSilentJackpotSpin(row,index);
     return task.then(result=>({row,result}));
   });

   for(const task of spinTasks){
     const {row,result}=await task;
     nextScores[row.seat-1]+=result.payout;
     state.scores=nextScores.slice();
     board?.updateSpin(row.seat,result);
   }

   state.reveal.nextRoundValue=1;
   completed=true;

   if(board){
     await sleep(850);
     board.hide();
   }
 }catch(err){
   console.error('[Minority LAB] Jackpot flow failed',err);
   setFeedback('Jackpot konnte nicht abgeschlossen werden. Runde bleibt zum erneuten Testen stehen.');
 }finally{
   jackpotUI.hide();
   jackpotBusy=false;
   document.body.classList.remove('minority-lab-jackpot-active');
 }

 if(completed)advanceLocal();
 else render();
}

function scheduleRevealAdvance(){
 if(state.screen!=='reveal'||!state.reveal)return;
 const key=state.mode+':'+state.round+':'+JSON.stringify(state.reveal.counts||[]);
 if(revealTimer&&revealTimerKey===key)return;
 if(revealTimer)clearTimeout(revealTimer);
 revealTimerKey=key;

 const specialLocal=state.mode==='local'&&(
   state.reveal.jackpot||
   (state.difficulty!=='EASY'&&!state.reveal.hasMinority)
 );
 const delay=specialLocal?LAB_CONFIG.jackpot.revealLeadMs:2000;

 revealTimer=setTimeout(async()=>{
   revealTimer=0;
   if(state.screen!=='reveal'||jackpotBusy)return;

   if(state.mode==='remote'){
     try{applyRemote(await rpc('advance_quick_minority_game',{p_lobby_id:quickLobby}))}
     catch(err){
       const msg=String(err?.message||err||'');
       if(msg.includes('RESOLVED_STAGE_REQUIRED')){await refreshRemote();return}
       setFeedback(humanError(err));
     }
     return;
   }

   if(state.reveal.jackpot){
     startJackpotFlow();
     return;
   }

   if(state.difficulty!=='EASY'&&!state.reveal.hasMinority){
     jackpotBusy=true;
     document.body.classList.add('minority-lab-jackpot-active');
     topState.textContent='POT';
     jackpotUI.showPotFill({
       from:state.reveal.roundValue,
       to:state.reveal.nextRoundValue,
       label:localRevealLabel(),
       onDone:()=>{
         jackpotBusy=false;
         document.body.classList.remove('minority-lab-jackpot-active');
         advanceLocal();
       }
     });
     return;
   }

   advanceLocal();
 },delay);
}
function renderGame(){
 const q=currentQuestion(),revealed=state.screen==='reveal'&&state.reveal;
 const res=state.reveal;
 const options=q.options||[];
 const myChoice=state.choice;
 const potLabel=state.difficulty==='EASY'
   ?'<span class="m-pot-status-text">POT AUS</span>'
   :'<span class="m-pot-status"><img src="'+LAB_CONFIG.assets.coin+'" alt=""><b>×'+state.roundValue+'</b></span>';

 stage.innerHTML=`
   <section class="m-status m-card" aria-label="Spielregeln">
     <div><strong>${state.roundCount} RUNDEN</strong></div>
     <div><strong>${esc(state.difficulty)}</strong></div>
     <div class="m-status-pot">${potLabel}</div>
   </section>

   <div class="m-round-display">RUNDE ${state.round}/${state.roundCount}</div>

   <div class="m-scorebar" aria-label="Punktestand">
     ${[1,2,3,4].map((seat,i)=>`<div class="m-score" style="--identity:${identity(seat)}"><strong>${Number(state.scores[i])||0}</strong><span>${esc(playerName(seat))}</span></div>`).join('')}
   </div>

   <div class="m-options" data-count="${options.length}">
     ${options.map((label,i)=>{
       const count=revealed?Number(res.counts?.[i]||0):null;
       const isWin=revealed&&res.winningOptions?.includes(i+1);
       const cls=[
         !revealed&&myChoice===i+1?'is-selected':'',
         isWin?'is-winner':'',
         revealed&&!isWin?'is-revealed':''
       ].filter(Boolean).join(' ');
       const lengthClass=String(label).length>=13?'is-xlong':String(label).length>=10?'is-long':'';
       return `<button class="m-option ${cls} ${lengthClass}" type="button" data-choice="${i+1}" ${revealed||myChoice?'disabled':''}><span class="m-option-label">${esc(label)}</span>${revealed?`<span class="m-option-count">${count} × gewählt</span>`:''}</button>`;
     }).join('')}
   </div>`;

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
 }
 if(revealed)scheduleRevealAdvance();
}
function resolveLocalRound(){
 const q=currentQuestion();
 let choices=[state.choice];

 if(qaMode==='jackpot'&&!state.qaJackpotConsumed&&state.difficulty==='HARDCORE'&&JACKPOT.isArmed(state.roundValue)&&q.options.length===2){
   const other=state.choice===1?2:1;
   choices=[state.choice,other,other,other];
   state.qaJackpotConsumed=true;
 }else{
   for(let seat=2;seat<=4;seat++)choices.push(1+Math.floor(Math.random()*q.options.length));
 }

 const base=RULES.resolveRound({
   difficulty:state.difficulty,
   choices,
   optionCount:q.options.length,
   scores:state.scores,
   roundValue:state.roundValue
 });
 const winningOptions=[...new Set(base.winningSeats.map(seat=>choices[seat-1]))];
 const jackpot=JACKPOT.shouldTriggerJackpot({
   difficulty:state.difficulty,
   optionCount:q.options.length,
   hasMinority:base.hasMinority,
   potValue:state.roundValue
 });

 let scores=base.scores.slice();
 if(jackpot&&base.award){
   for(const seat of base.winningSeats)scores[seat-1]-=base.award;
 }

 const nextRoundValue=state.difficulty==='EASY'
   ?1
   :(base.hasMinority?1:JACKPOT.nextPotValue(state.roundValue));

 state.scores=scores;
 state.reveal={
   ...base,
   scores:scores.slice(),
   nextRoundValue,
   winningOptions,
   choices,
   jackpot,
   jackpotPot:state.roundValue
 };
 state.screen='reveal';
 render();
}
function advanceLocal(){
 if(state.round>=state.roundCount){state.screen='ranking';return render()}
 state.round+=1;state.roundValue=state.reveal?.nextRoundValue||1;state.choice=null;state.reveal=null;state.screen='game';render();
}
function renderRanking(){
 const rows=standings().map((p,i)=>({...p,place:i+1,placementPoints:placementPoints(i)}));
 stage.innerHTML=`
   <section class="m-result-hero">
     <span class="m-result-kicker">GAME RANKING</span>
     <h1>ERGEBNIS.</h1>
   </section>

   <section class="m-result-card" id="mResultCard">
     <header>
       <strong>MINORITY · FINALES ERGEBNIS</strong>
       <span>HÖHER IST BESSER</span>
     </header>

     <div class="m-result-columns">
       <span>POSITION</span>
       <span>PLAYER</span>
       <span>MINORITY</span>
       <span></span>
     </div>

     <div class="m-result-rows">
       ${rows.map((p,i)=>`
         <div class="m-result-row" style="--delay:${160+i*130}ms;--identity:${p.color}">
           <b class="m-result-place">${String(p.place).padStart(2,'0')}</b>
           <span class="m-result-player">
             <i></i>
             <span class="m-result-identity is-solo">
               <strong>${esc(p.name)}</strong>
             </span>
           </span>
           <b class="m-result-score">${p.score}</b>
           <span class="m-placement-points"><b>+${p.placementPoints}</b></span>
         </div>`).join('')}
     </div>
   </section>

   <div class="m-result-actions">
     <button class="m-primary m-blocking m-result-action" id="mAgain" type="button">${state.mode==='remote'?'QUICK GAME BEENDEN →':'NOCHMAL'}</button>
   </div>`;

 const card=document.querySelector('#mResultCard');
 requestAnimationFrame(()=>{
   card?.classList.add('is-revealing');
   const resultRows=[...stage.querySelectorAll('.m-result-row')];
   [...resultRows].reverse().forEach((row,i)=>{
     setTimeout(()=>row.classList.add('is-plus-visible'),2000+i*260);
   });
 });

 document.querySelector('#mAgain').addEventListener('click',()=>{
   if(state.mode==='remote')location.assign('../quick-games/');
   else{state.screen='setup';state.choice=null;state.reveal=null;render()}
 });
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
 const incomingRevision=Number(snapshot.revision||0);
 let incomingScreen=String(snapshot.stage||'READY').toLowerCase();
 if(incomingScreen==='playing')incomingScreen='game';
 if(incomingScreen==='resolved')incomingScreen='reveal';
 if(incomingScreen==='finished')incomingScreen='ranking';

 // FINISHED is immutable for this Quick Game. Do not let background polling
 // rebuild the ranking DOM and restart its reveal animation.
 if(incomingScreen==='ranking'&&state.screen==='ranking'&&incomingRevision===Number(state.revision||0)){
   if(poll){clearInterval(poll);poll=0}
   return;
 }

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
 state.revision=incomingRevision||Number(state.revision||0);
 state.screen=incomingScreen;
 setFeedback('');
 render();

 if(state.screen==='ranking'){
   if(poll){clearInterval(poll);poll=0}
   return;
 }
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
window.addEventListener('beforeunload',()=>{if(poll)clearInterval(poll);if(revealTimer)clearTimeout(revealTimer);jackpotUI.hide()});
boot();
})();