(()=>{
'use strict';
const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const THEME_QA_KEY='skielsen.dna.theme.qa';
const FUNCTION_URL=SUPABASE_URL+'/functions/v1/dna-standalone';
const SESSION_KEY='skielsen.native.supabase.session';
const IDEA_PHASE_MS=20000;
const VOTE_PHASE_MS=10000;
const MOTION_SCALE=3.0625;
const REVEAL_TIE_ORDER=['BLUE','RED','YELLOW','GREEN'];
const CATEGORIES=[
  ['countries','LÄNDER'],['cities','STÄDTE'],['animals','TIERE'],['movies','FILME'],['car_brands','AUTOMARKEN'],['companies','UNTERNEHMEN'],['football_clubs','FUSSBALLVEREINE'],['food','ESSEN & GERICHTE'],['technology','TECHNOLOGIE'],['professions','BERUFE'],['video_games','VIDEOSPIELE'],['historical_people','HISTORISCHE PERSONEN'],['music','MUSIK']
];
const TEAMS={
  RED:{name:'TEAM ROT',members:'DJEELOI + SOFYA',color:'var(--core-red)',existing:12},
  BLUE:{name:'TEAM BLAU',members:'HANNES + PIA',color:'var(--core-blue)',existing:9},
  GREEN:{name:'TEAM GRÜN',members:'MATS + LENA',color:'var(--core-green)',existing:7},
  YELLOW:{name:'TEAM GELB',members:'TOM + ANNA',color:'var(--core-yellow)',existing:4}
};
const TEAM_ORDER=['RED','BLUE','GREEN','YELLOW'];
const DECOYS={
 countries:['KANADA','CHILE','NORWEGEN','PORTUGAL','MONGOLEI'],cities:['WIEN','LISSABON','PRAG','TOKYO','DUBAI'],animals:['WOLF','DELFIN','RABE','PINGUIN','GEPARD'],movies:['INCEPTION','GLADIATOR','MATRIX','ALIEN','ROCKY'],car_brands:['VOLVO','MAZDA','HONDA','LOTUS','AUDI'],companies:['SONY','IKEA','NIKE','SAMSUNG','GOOGLE'],football_clubs:['REAL MADRID','AJAX','LIVERPOOL','JUVENTUS','BENFICA'],food:['RAMEN','PAELLA','SUSHI','FALAFEL','RISOTTO'],technology:['BLUETOOTH','NFC','LIDAR','OLED','GPS'],professions:['ARCHITEKT','PILOT','INGENIEUR','ARZT','JOURNALIST'],video_games:['MINECRAFT','TETRIS','FORTNITE','PORTAL','DOOM'],historical_people:['NEWTON','DARWIN','MOZART','NAPOLEON','GANDHI'],music:['QUEEN','ABBA','METALLICA','ADELE','COLDPLAY']
};
const $=s=>document.querySelector(s);
const content=$('#dnaContent'),progress=$('#dnaProgress'),headerState=$('#dnaHeaderState'),headerMeta=$('#dnaHeaderMeta'),themeSelect=$('#dnaThemeSelect');
let phaseTimer=0,phaseRaf=0,scheduled=[];
let s={screen:'BOOT',selected:new Set(['countries']),termCount:5,pool:'BALANCED',token:null,current:null,previousHints:[],idea:'',answerProof:null,ideaDone:false,teammateIdea:null,teammateReady:false,opponentsReady:false,userVote:null,teammateVote:null,submitted:false,outcome:null,gameScores:null,ranking:null,mergeComplete:false};
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function clearTimers(){if(phaseTimer)clearTimeout(phaseTimer);if(phaseRaf)cancelAnimationFrame(phaseRaf);phaseTimer=0;phaseRaf=0;scheduled.splice(0).forEach(clearTimeout)}
function later(fn,ms){const id=setTimeout(fn,ms);scheduled.push(id);return id}
function motionMs(ms){return Math.round(Number(ms||0)*MOTION_SCALE)}
function setChrome(strong,meta,pct){headerState.textContent=strong;if(headerMeta)headerMeta.textContent='';progress.style.width=Math.max(0,Math.min(100,pct))+'%'}
function visualHeight(){return window.visualViewport?.height||window.innerHeight}
function setPinnedHintStage(top,height){
 const t=Math.round(Number(top)||0),h=Math.round(Number(height)||0);
 if(!(t>0&&h>0))return;
 s.hintStageGeometry={top:t,height:h};
 document.documentElement.style.setProperty('--dna-pinned-hint-top',t+'px');
 document.documentElement.style.setProperty('--dna-pinned-hint-height',h+'px');
 document.body.classList.add('dna-hint-stage-pinned');
}
function clearPinnedHintStage(){
 s.hintStageGeometry=null;
 document.documentElement.style.removeProperty('--dna-pinned-hint-top');
 document.documentElement.style.removeProperty('--dna-pinned-hint-height');
 document.body.classList.remove('dna-hint-stage-pinned');
}
function freezeCurrentHintStage(){
 if(s.hintStageGeometry){
   setPinnedHintStage(s.hintStageGeometry.top,s.hintStageGeometry.height);
   return;
 }
 const stage=content?.querySelector?.('.dna-hints');
 if(!stage)return;
 const rect=stage.getBoundingClientRect();
 if(rect.height>0)setPinnedHintStage(rect.top,rect.height);
}
function syncKeyboardHintStageGeometry(){
 const stage=content?.querySelector?.('.dna-hints');
 if(!stage)return;
 stage.style.removeProperty('--dna-measured-hint-top');
 stage.style.removeProperty('--dna-measured-hint-height');

 if(!document.body.classList.contains('dna-keyboard-open')){
   if(s.hintStageGeometry){
     stage.style.setProperty('--dna-measured-hint-top',s.hintStageGeometry.top+'px');
     stage.style.setProperty('--dna-measured-hint-height',s.hintStageGeometry.height+'px');
   }
   return;
 }

 const timer=content?.querySelector?.('#dnaTimer');
 const interaction=content?.querySelector?.('#dnaInteraction');
 if(!timer||!interaction)return;

 const timerRect=timer.getBoundingClientRect();
 const interactionRect=interaction.getBoundingClientRect();
 const gap=8;
 const top=Math.round(timerRect.bottom+gap);
 const bottom=Math.round(interactionRect.top-gap);
 const height=Math.max(72,bottom-top);

 stage.style.setProperty('--dna-measured-hint-top',top+'px');
 stage.style.setProperty('--dna-measured-hint-height',height+'px');
 setPinnedHintStage(top,height);
}
function fitKeyboardHint(){
 syncKeyboardHintStageGeometry();
 const stage=content?.querySelector?.('.dna-hints');
 const slots=[...(content?.querySelectorAll?.('.dna-hint-slot:not(.is-empty)')||[])];
 if(!stage||!slots.length)return;

 const keyboard=document.body.classList.contains('dna-keyboard-open');
 const pinned=document.body.classList.contains('dna-hint-stage-pinned');
 s.hintTypeScale=s.hintTypeScale||{};

 slots.forEach(slot=>{
   const card=slot.querySelector('.dna-hint-card');
   const hint=slot.querySelector('.dna-hint-text');
   if(!card||!hint)return;

   const slotNo=String(slot.dataset.hintSlot||'');
   const remembered=s.hintTypeScale[slotNo];

   hint.style.removeProperty('font-size');
   hint.style.removeProperty('line-height');

   let size=parseFloat(getComputedStyle(hint).fontSize)||16;
   let lineHeight=(keyboard||pinned)?1.05:1.06;

   // IDEA/keyboard is authoritative. Recreated VOTE/feedback DOM gets exactly the
   // type size that fitted in IDEA; it may shrink further for safety but never grow.
   if(pinned&&!keyboard&&remembered){
     size=Math.min(size,Number(remembered.size)||size);
     lineHeight=Number(remembered.lineHeight)||1.05;
   }else if(keyboard||pinned){
     size=Math.min(size,16);
   }

   hint.style.fontSize=size+'px';
   hint.style.lineHeight=String(lineHeight);
   const minSize=(keyboard||pinned)?9.5:11;

   const fits=()=>{
     const cardRect=card.getBoundingClientRect();
     const hintRect=hint.getBoundingClientRect();
     // Extra visual reserve protects descenders such as g/j/y from touching the
     // rounded container edge even when the DOM technically still fits.
     return card.scrollHeight<=card.clientHeight+1 && hintRect.bottom<=cardRect.bottom-9;
   };

   for(let guard=0;guard<32&&!fits()&&size>minSize;guard++){
     size=Math.max(minSize,size-.5);
     hint.style.fontSize=size+'px';
   }

   if(keyboard&&slotNo){
     s.hintTypeScale[slotNo]={size,lineHeight};
   }
 });
}
let hintFitRaf=0;
function queueKeyboardHintFit(){
 cancelAnimationFrame(hintFitRaf);
 hintFitRaf=requestAnimationFrame(()=>requestAnimationFrame(fitKeyboardHint));
}
let viewportBaselineHeight=0,viewportBaselineWidth=0;
function keyboardInputFocused(){
 const el=document.activeElement;
 return Boolean(el?.classList?.contains('dna-input'));
}
function syncViewport(){
 const vv=window.visualViewport;
 const h=vv?.height||window.innerHeight;
 const w=vv?.width||window.innerWidth;
 const top=Math.max(0,vv?.offsetTop||0);
 const inner=window.innerHeight||h;
 const bottom=Math.max(0,inner-h-top);
 const widthChanged=!viewportBaselineWidth||Math.abs(w-viewportBaselineWidth)>90;
 if(widthChanged){
   viewportBaselineWidth=w;
   viewportBaselineHeight=h;
 }else if(!keyboardInputFocused()&&h>viewportBaselineHeight){
   viewportBaselineHeight=h;
 }
 const baseline=Math.max(viewportBaselineHeight||h,h);
 const touchLike=(navigator.maxTouchPoints||0)>0||window.matchMedia?.('(pointer: coarse)')?.matches;
 const viewportShrunk=(baseline-h)>Math.max(90,baseline*.14);
 const focusKeyboard=Boolean(touchLike&&keyboardInputFocused()&&(baseline-h>60||bottom>40));
 const keyboardOpen=viewportShrunk||bottom>80||focusKeyboard;
 document.documentElement.style.setProperty('--dna-visual-height',h+'px');
 document.documentElement.style.setProperty('--dna-visual-top',top+'px');
 document.documentElement.style.setProperty('--dna-keyboard-bottom',bottom+'px');
 document.body.classList.toggle('dna-keyboard-open',keyboardOpen);
 queueKeyboardHintFit();
}
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',syncViewport,{passive:true});
window.addEventListener('resize',syncViewport,{passive:true});
function settleKeyboardViewport(){
 [0,60,140,280,520,850].forEach(ms=>setTimeout(syncViewport,ms));
}
document.addEventListener('focusin',e=>{if(e.target?.classList?.contains('dna-input'))settleKeyboardViewport()});
document.addEventListener('focusout',e=>{if(e.target?.classList?.contains('dna-input'))setTimeout(syncViewport,180)});
syncViewport();
function getStoredSession(){try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch(_){return null}}
function validSession(session){if(!session?.access_token)return false;if(!session.expires_at)return true;return Number(session.expires_at)>Math.floor(Date.now()/1000)+15}
async function authSession(){const session=getStoredSession();return validSession(session)?session:null}
async function loadThemeCatalog(){
 const session=await authSession();
 if(!session)return [];
 try{
  const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/list_theme_pack_contracts',{
   method:'POST',
   headers:{
    apikey:SUPABASE_KEY,
    Authorization:'Bearer '+session.access_token,
    'Content-Type':'application/json'
   },
   body:'{}'
  });
  const data=await res.json().catch(()=>[]);
  if(!res.ok)throw new Error(data?.message||data?.error||'THEME_CATALOG_FAILED');
  return (Array.isArray(data)?data:[]).filter(row=>
   window.skielsenThemeContract?.validate?.(
    row?.theme_contract,
    {themePackId:row?.theme_pack_id}
   )?.ok
  );
 }catch(err){
  console.warn('DNA Theme QA catalog failed',err);
  return [];
 }
}
let themeCatalog=[];
function participantPalette(themeId){
 const core2=themeId==='theme.skielsen.core2';
 const palette=core2
  ? {blue:'#2979FF',red:'#FF1744',yellow:'#00F5D4',green:'#FF2ED1'}
  : {blue:'#1515FF',red:'#FF1717',yellow:'#F2B705',green:'#00A65A'};
 for(const root of [document.documentElement,document.body]){
  root.style.setProperty('--core-blue',palette.blue);
  root.style.setProperty('--core-red',palette.red);
  root.style.setProperty('--core-yellow',palette.yellow);
  root.style.setProperty('--core-green',palette.green);
 }
}
function applyQaTheme(themeId,persist=true){
 const id=String(themeId||'theme.skielsen.core');
 const row=themeCatalog.find(item=>item?.theme_pack_id===id)
  || themeCatalog.find(item=>item?.theme_pack_id==='theme.skielsen.core');
 if(row?.theme_contract){
  const ok=window.skielsenThemeContract?.apply?.(
   row.theme_pack_id,
   row.theme_contract,
   {animations:false,context:'tournament'}
  );
  if(!ok)return false;
  participantPalette(row.theme_pack_id);
  if(themeSelect)themeSelect.value=row.theme_pack_id;
  if(persist){try{localStorage.setItem(THEME_QA_KEY,row.theme_pack_id)}catch(_){}}
  queueKeyboardHintFit();
  return true;
 }
 participantPalette('theme.skielsen.core');
 return false;
}
function renderThemeQa(){
 if(!themeSelect)return;
 themeSelect.innerHTML=themeCatalog
  .map(row=>`<option value="${esc(row.theme_pack_id)}">${esc(row.name||row.theme_pack_id)}</option>`)
  .join('');
 themeSelect.disabled=!themeCatalog.length;
 const stored=(()=>{try{return localStorage.getItem(THEME_QA_KEY)}catch(_){return null}})();
 const initial=themeCatalog.some(row=>row.theme_pack_id===stored)?stored:'theme.skielsen.core';
 applyQaTheme(initial,false);
 themeSelect.addEventListener('change',()=>applyQaTheme(themeSelect.value,true));
}
async function api(action,payload={}){const session=await authSession();if(!session)throw new Error('LOGIN_REQUIRED');const res=await fetch(FUNCTION_URL,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||'DNA Serverfehler');return data}
function setScrollLock(on){document.documentElement.classList.toggle('dna-scroll-lock',Boolean(on));document.body.classList.toggle('dna-game-active',Boolean(on))}
function page(html){setScrollLock(false);content.innerHTML=`<section class="dna-page">${html}</section>`;window.scrollTo(0,0)}
function authGate(){clearTimers();setChrome('LOGIN','STANDALONE · AUTH',0);page(`<section class="dna-auth"><div class="dna-auth-card"><span class="dna-kicker">SKIELSEN ACCOUNT</span><h1>ANMELDUNG ERFORDERLICH.</h1><p>Die DNA-Standalone nutzt die geschützte Content-Datenbank. Öffne zuerst SKIELSEN, melde dich an und kehre danach zu diesem Test zurück.</p><div class="dna-actions"><button class="dna-btn primary" id="dnaGoApp" type="button">ZUR SKIELSEN APP →</button></div></div></section>`);$('#dnaGoApp').addEventListener('click',()=>location.href='../')}
function setup(){clearTimers();s.screen='SETUP';setChrome('SETUP','DNA · TEAM',5);const selected=[...s.selected];page(`<section class="dna-hero"><span class="dna-kicker">TEAM QUIZ · MOBILE FIRST</span><h1>DNA.</h1><p>Drei Hinweise führen zum Begriff. Je früher euer Team löst, desto mehr Punkte.</p></section><section class="dna-card"><div class="dna-card-head"><strong>CONTENT</strong><span>${selected.length>1?'MIX · '+selected.length+' KATEGORIEN':'EINE KATEGORIE'}</span></div><div class="dna-category-grid">${CATEGORIES.map(([id,label])=>`<button class="dna-category ${s.selected.has(id)?'active':''}" data-cat="${id}" type="button">${label}</button>`).join('')}</div></section><section class="dna-card"><div class="dna-card-head"><strong>ANZAHL BEGRIFFE</strong><span>SESSION</span></div><div class="dna-choice-grid" style="--dna-choice-count:3">${[5,10,15].map(n=>`<button class="dna-choice ${s.termCount===n?'active':''}" data-terms="${n}" type="button"><strong>${n}</strong><span>BEGRIFFE</span></button>`).join('')}</div></section><section class="dna-card"><div class="dna-card-head"><strong>CONTENT MIX</strong><span>BEKANNTHEIT</span></div><div class="dna-choice-grid" style="--dna-choice-count:3">${[['CASUAL','CASUAL','Vor allem Mainstream'],['BALANCED','AUSGEWOGEN','Mainstream + Known'],['EXPERT','EXPERT','Mehr Known + Nische']].map(([id,a,b])=>`<button class="dna-choice ${s.pool===id?'active':''}" data-pool="${id}" type="button"><strong>${a}</strong><span>${b}</span></button>`).join('')}</div></section><section class="dna-summary"><div><small>CONTENT</small><strong>${selected.length===1?(CATEGORIES.find(x=>x[0]===selected[0])?.[1]||selected[0]):'MIX · '+selected.length}</strong></div><div><small>BEGRIFFE</small><strong>${s.termCount}</strong></div><div><small>POOL</small><strong>${s.pool==='BALANCED'?'AUSGEWOGEN':s.pool}</strong></div></section><div class="dna-actions"><button class="dna-btn primary dna-blocking" id="dnaSetupNext" type="button">WEITER →</button></div>`);
 function refreshSetupSelection(){
  const selected=[...s.selected];
  content.querySelectorAll('[data-cat]').forEach(btn=>btn.classList.toggle('active',s.selected.has(btn.dataset.cat)));
  content.querySelectorAll('[data-terms]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.terms)===s.termCount));
  content.querySelectorAll('[data-pool]').forEach(btn=>btn.classList.toggle('active',btn.dataset.pool===s.pool));
  const contentMeta=content.querySelector('.dna-card-head span');
  if(contentMeta)contentMeta.textContent=selected.length>1?'MIX · '+selected.length+' KATEGORIEN':'EINE KATEGORIE';
  const summary=content.querySelectorAll('.dna-summary strong');
  if(summary[0])summary[0].textContent=selected.length===1?(CATEGORIES.find(x=>x[0]===selected[0])?.[1]||selected[0]):'MIX · '+selected.length;
  if(summary[1])summary[1].textContent=String(s.termCount);
  if(summary[2])summary[2].textContent=s.pool==='BALANCED'?'AUSGEWOGEN':s.pool;
 }
 content.querySelectorAll('[data-cat]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.cat;if(s.selected.has(id)){if(s.selected.size>1)s.selected.delete(id)}else s.selected.add(id);refreshSetupSelection()}));
 content.querySelectorAll('[data-terms]').forEach(btn=>btn.addEventListener('click',()=>{s.termCount=Number(btn.dataset.terms);refreshSetupSelection()}));
 content.querySelectorAll('[data-pool]').forEach(btn=>btn.addEventListener('click',()=>{s.pool=btn.dataset.pool;refreshSetupSelection()}));
 $('#dnaSetupNext').addEventListener('click',ready)}
function ready(){clearTimers();s.screen='READY';setChrome('READY',`${s.termCount} BEGRIFFE`,12);page(`<section class="dna-hero"><span class="dna-kicker">LETZTER CHECK VOR DEM SPIEL</span><h1>BEREIT?</h1></section><section class="dna-ready-rules"><div><strong>+3</strong><span>HINWEIS 1 · SEHR SCHWER</span></div><div><strong>+2 / +1</strong><span>HINWEIS 2 / 3</span></div><div><strong>−1</strong><span>FALSCHE TEAMANTWORT</span></div><div><strong>20s + 10s</strong><span>IDEE → ABSTIMMUNG</span></div></section><section class="dna-card"><div class="dna-card-head"><strong>TEAMS</strong><span>STANDALONE SIMULATION</span></div><div class="dna-team-list">${TEAM_ORDER.map((key,i)=>`<div class="dna-team-row" style="--team:${TEAMS[key].color}"><i></i><div class="dna-team-ident"><strong>${TEAMS[key].name}</strong><span>${TEAMS[key].members}</span></div><b class="dna-ready-state ${i===0?'':'ready'}" data-ready="${key}">${i===0?'WARTET':'BEREIT'}</b></div>`).join('')}</div></section><section class="dna-card"><span class="dna-kicker">SO FUNKTIONIERT ES</span><p style="margin:10px 0 0;font-size:10px;line-height:1.5;font-weight:800">Phase 1: Jeder Spieler gibt geheim eine Idee ein. Phase 2: Nur euer Team sieht die Ideen und stimmt ab. Einigkeit aktiviert Submit – abgeschickt wird erst nach einem bewussten Klick.</p></section><div class="dna-actions"><button class="dna-btn" id="dnaBackSetup" type="button">← SETUP</button><button class="dna-btn primary dna-blocking" id="dnaReady" type="button">ICH BIN BEREIT</button></div>`);$('#dnaBackSetup').addEventListener('click',setup);$('#dnaReady').addEventListener('click',()=>{const own=$('[data-ready="RED"]');own.textContent='BEREIT';own.classList.add('ready');const btn=$('#dnaReady');btn.textContent='SPIEL STARTEN';btn.onclick=startGame})}
async function startGame(){clearTimers();setChrome('LÄDT','CONTENT WIRD GEZOGEN',15);page(`<section class="dna-auth"><div class="dna-auth-card"><span class="dna-kicker">SERVERAUTORITATIV</span><h1>DNA WIRD VORBEREITET.</h1><p>Nur der erste freigegebene Hinweis wird an den Browser übertragen.</p></div></section>`);try{const res=await api('start',{categories:[...s.selected],termCount:s.termCount,pool:s.pool});s.token=res.state;s.previousHints=[];enterContent(res.content)}catch(err){if(String(err.message)==='LOGIN_REQUIRED')return authGate();showFatal(err)}}
function showFatal(err){clearTimers();setChrome('FEHLER','DNA STANDALONE',0);page(`<div class="dna-error">${esc(err?.message||err)}</div><div class="dna-actions"><button class="dna-btn primary" id="dnaRetry" type="button">ZURÜCK ZUM SETUP</button></div>`);$('#dnaRetry').addEventListener('click',setup)}
function overallPct(c){if(!c?.termCount)return 15;if(c.phase==='COMPLETE')return 100;const base=((c.termNo-1)/c.termCount)*100;const hint=c.hintNo||3;return Math.max(16,Math.min(96,base+(hint-1)/3*(100/c.termCount)))}
function enterContent(c){clearTimers();s.current=c;if(c.phase==='HINT'){if(c.hintNo===1){s.previousHints=[];s.hintTypeScale={};clearPinnedHintStage()}startIdea()}else if(c.phase==='REVEAL'){clearPinnedHintStage();showReveal(c)}else if(c.phase==='COMPLETE'){clearPinnedHintStage();showRanking(c.gameScores)}else showFatal(new Error('Unbekannter DNA-State'))}
function teamScoreLabel(){return Number(s.current?.redGameScore||0)}
function hintDifficulty(no){return no===1?'SEHR SCHWER':no===2?'SCHWER':'MITTEL'}
function hintPoints(no){return no===1?3:no===2?2:1}
function gameShell(interactionHtml,phaseLabel){
 setScrollLock(true);
 const c=s.current;
 setChrome(phaseLabel,'',overallPct(c));

 const released=new Map();
 s.previousHints.forEach((text,i)=>released.set(i+1,text));
 released.set(c.hintNo,c.hintText);

 const hintSlots=[1,2,3].map(no=>{
   const text=released.get(no);
   const current=no===c.hintNo;
   if(!text){
     return `<article class="dna-hint-slot is-empty" data-hint-slot="${no}" aria-hidden="true"></article>`;
   }
   return `<article class="dna-hint-slot ${current?'is-current':'is-previous'}" data-hint-slot="${no}">
     <div class="dna-hint-card">
       <div class="dna-hint-head">
         <small>HINWEIS ${no} · ${hintDifficulty(no)}</small>
         <b>+${hintPoints(no)}</b>
       </div>
       <p class="dna-hint-text">${esc(text)}</p>
     </div>
   </article>`;
 }).join('');

 content.innerHTML=`<section class="dna-game">
   <div class="dna-timer" id="dnaTimer"><i></i></div>
   <section class="dna-hints">
     <div class="dna-hint-stage">${hintSlots}</div>
   </section>
   <section class="dna-interaction" id="dnaInteraction">${interactionHtml}</section>
 </section>
 <div class="dna-solve-strip" id="dnaSolves"></div>`;

 if(s.hintStageGeometry){
   const stage=$('.dna-hints');
   stage?.style.setProperty('--dna-measured-hint-top',s.hintStageGeometry.top+'px');
   stage?.style.setProperty('--dna-measured-hint-height',s.hintStageGeometry.height+'px');
 }
 queueKeyboardHintFit();
 const interaction=$('#dnaInteraction');
 if(interaction&&window.ResizeObserver){
   const ro=new ResizeObserver(()=>queueKeyboardHintFit());
   ro.observe(interaction);
   later(()=>ro.disconnect(),IDEA_PHASE_MS+VOTE_PHASE_MS+3000);
 }
}
function startTimer(duration,onTimeout){const bar=$('#dnaTimer'),fill=bar?.querySelector('i');const ms=Math.max(1000,Number(duration)||VOTE_PHASE_MS);const start=performance.now(),deadline=start+ms;if(fill){fill.style.width='100%';fill.style.transform='none'}function frame(now){const left=Math.max(0,deadline-now),ratio=Math.max(0,Math.min(1,left/ms));if(fill)fill.style.width=(ratio*100).toFixed(2)+'%';bar?.classList.toggle('warning',left<=5000&&left>2500);bar?.classList.toggle('danger',left<=2500);if(left>0)phaseRaf=requestAnimationFrame(frame);else if(fill)fill.style.width='0%'}phaseRaf=requestAnimationFrame(frame);phaseTimer=setTimeout(()=>{if(fill)fill.style.width='0%';onTimeout()},ms+40)}
function maybeFinishIdea(){if(s.ideaDone&&s.teammateReady&&s.opponentsReady){clearTimers();startVote()}}
function teammateIdea(){const list=DECOYS[s.current.categoryId]||['KEINE IDEE'];return Math.random()<.18?null:list[Math.floor(Math.random()*list.length)]}
function startIdea(){clearTimers();s.screen='GAME';s.idea='';s.ideaDone=Boolean(s.current.redSolved);s.teammateIdea=null;s.teammateReady=Boolean(s.current.redSolved);s.opponentsReady=false;s.userVote=null;s.teammateVote=null;s.submitted=false;s.outcome=null;s.answerProof=null;const solved=s.current.redSolved;gameShell(solved?`<div class="dna-lock-state"><div><strong>BEGRIFF GELÖST</strong><span>DEIN TEAM SPIELT DIESEN BEGRIFF NICHT WEITER.</span></div></div>`:`<div class="dna-interaction-head"><strong>DEINE IDEE</strong><span>GEHEIM · NUR DU</span></div><div class="dna-idea-form"><input class="dna-input" id="dnaIdea" type="text" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="characters" enterkeyhint="done" maxlength="80" placeholder="Antwort eingeben …"><button class="dna-btn primary dna-save" id="dnaIdeaSave" type="button" disabled>IDEE SPEICHERN</button></div><button class="dna-btn dna-skip" id="dnaIdeaSkip" type="button">KEINE IDEE</button>`,'IDEE');
 if(!solved){const input=$('#dnaIdea'),save=$('#dnaIdeaSave');input.addEventListener('input',()=>save.disabled=!input.value.trim());input.addEventListener('keydown',e=>{if(e.key==='Enter'&&input.value.trim()){e.preventDefault();save.click()}});save.addEventListener('click',()=>{s.idea=input.value.trim();s.ideaDone=true;renderIdeaLocked('IDEE GESPEICHERT',s.idea);maybeFinishIdea()});$('#dnaIdeaSkip').addEventListener('click',()=>{s.idea='';s.ideaDone=true;renderIdeaLocked('ÜBERSPRUNGEN','KEINE IDEE');maybeFinishIdea()});later(()=>{try{input.focus({preventScroll:true})}catch(_){input.focus()}syncViewport()},80);later(()=>{s.teammateIdea=teammateIdea();s.teammateReady=true;maybeFinishIdea()},900+Math.random()*800)}
 later(()=>{s.opponentsReady=true;maybeFinishIdea()},1200+Math.random()*1000);startTimer(IDEA_PHASE_MS,()=>{if(!s.ideaDone){s.idea='';s.ideaDone=true}clearTimers();startVote()})}
function renderIdeaLocked(title,value){const host=$('#dnaInteraction');if(!host)return;host.innerHTML=`<div class="dna-lock-state"><div><strong>${esc(title)}</strong><span>${esc(value)}</span></div></div>`}
function normalize(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE')}
function candidates(){const map=new Map();const add=(value,who)=>{if(!value)return;const key=normalize(value);if(!key)return;const row=map.get(key)||{value,who:[]};if(!row.who.includes(who))row.who.push(who);map.set(key,row)};add(s.idea,'D');add(s.teammateIdea,'S');return [...map.values()]}
function startVote(){clearTimers();freezeCurrentHintStage();try{document.activeElement?.blur?.()}catch(_){}syncViewport();teammateVoteSeq=0;clearTimeout(reconsiderTimer);const solved=s.current.redSolved;if(solved){s.teammateReady=true;s.opponentsReady=false;gameShell(`<div class="dna-lock-state"><div><strong>TEAMABSTIMMUNG LÄUFT</strong><span>DEIN TEAM HAT BEREITS GELÖST.</span></div></div>`,'ABSTIMMUNG');later(()=>{s.opponentsReady=true;clearTimers();resolveVote(true)},900+Math.random()*600);startTimer(VOTE_PHASE_MS,()=>resolveVote(true));return}
 const list=candidates();s.userVote=null;s.teammateVote=null;s.submitted=false;s.opponentsReady=false;gameShell(`<div class="dna-interaction-head"><strong>TEAM-ANTWORT</strong><span>ANTIPPEN ≠ ABSENDEN</span></div><div class="dna-vote-list" id="dnaVoteList">${list.map((c,i)=>voteCard(c.value,c.who.join(' + '),'v'+i)).join('')}${voteCard('__NO__','SICHER PASSEN','no')}</div><div class="dna-consensus" id="dnaConsensus">NOCH KEINE EINIGKEIT</div><div class="dna-vote-actions"><button class="dna-btn" id="dnaVoteClear" type="button">AUSWAHL LÖSEN</button><button class="dna-btn primary" id="dnaSubmit" type="button" disabled>ANTWORT ABSENDEN</button></div>`,'ABSTIMMUNG');
 content.querySelectorAll('[data-vote]').forEach(btn=>btn.addEventListener('click',()=>{
  s.userVote=btn.dataset.vote;
  s.answerProof=null;
  // Every user choice starts one immediate server-side teammate check.
  const seq=++teammateVoteSeq;
  s.teammateVote=null;
  renderVotes();
  reconsiderVoteNow(seq,s.userVote);
}));$('#dnaVoteClear').addEventListener('click',()=>{s.userVote=null;s.answerProof=null;renderVotes()});$('#dnaSubmit').addEventListener('click',submitVote);
 later(()=>{
   // Never overwrite a user-triggered reconsideration with the stale initial bot vote.
   if(s.userVote||s.submitted||teammateVoteSeq>0)return;
   const ownIdea=s.teammateIdea?normalize(s.teammateIdea):'__NO__';
   const found=[...content.querySelectorAll('[data-vote]')].find(x=>normalize(x.dataset.vote)===ownIdea);
   s.teammateVote=found?.dataset.vote||'__NO__';
   renderVotes();
 },650+Math.random()*550);later(()=>{s.opponentsReady=true;if(s.submitted)resolveVote(false)},1300+Math.random()*1100);startTimer(VOTE_PHASE_MS,()=>{if(s.submitted)return;if(phaseTimer){clearTimeout(phaseTimer);phaseTimer=0}submitNoAnswerTimeout()})}
function voteCard(value,source,key){const display=value==='__NO__'?'KEINE ANTWORT':value;return `<button class="dna-vote" type="button" data-vote="${esc(value)}" data-key="${key}"><span><strong>${esc(display)}</strong><small>${esc(source)}</small></span><span class="dna-voters"><i data-voter="D">D</i><i data-voter="S">S</i></span></button>`}
let reconsiderTimer=0,teammateVoteSeq=0;
async function reconsiderVoteNow(seq,requestedVote){
  clearTimeout(reconsiderTimer);
  if(!requestedVote||s.submitted)return;
  const line=$('#dnaConsensus');
  if(line)line.textContent='TEAMKOLLEGE PRÜFT …';
  try{
    const res=await api('teammate_vote',{state:s.token,termRef:s.current?.termRef||'',userVote:requestedVote,teammateIdea:s.teammateIdea||''});
    if(s.submitted||s.userVote!==requestedVote||seq!==teammateVoteSeq)return;
    s.teammateVote=res?.vote||null;
    s.answerProof=res?.answerProof||null;
    renderVotes();
  }catch(err){
    if(seq!==teammateVoteSeq)return;
    console.error('DNA teammate_vote failed',err);
    renderVotes();
  }
}
function renderVotes(){content.querySelectorAll('[data-vote]').forEach(btn=>{const v=btn.dataset.vote;btn.classList.toggle('active',s.userVote===v);const ds=btn.querySelector('[data-voter="D"]'),ss=btn.querySelector('[data-voter="S"]');ds?.classList.toggle('on',s.userVote===v);ss?.classList.toggle('on',s.teammateVote===v)});const consensus=Boolean(s.userVote&&s.teammateVote&&s.userVote===s.teammateVote);const line=$('#dnaConsensus'),submit=$('#dnaSubmit');if(line){line.textContent=consensus?'EINIGKEIT · SUBMIT IST FREIGEGEBEN':'NOCH KEINE EINIGKEIT';line.classList.toggle('dna-submit-ok',consensus)}if(submit)submit.disabled=!consensus||s.submitted}
async function submitVote(){if(s.submitted||!s.userVote||s.userVote!==s.teammateVote)return;s.submitted=true;renderVotes();const noAnswer=s.userVote==='__NO__';try{const res=await api('submit',{state:s.token,termRef:s.current?.termRef||'',answerProof:s.answerProof||'',answer:noAnswer?'':s.userVote,noAnswer});s.token=res.state;s.current=res.content;s.outcome=res.outcome;renderSubmitted(noAnswer?s.userVote:s.userVote);if(s.opponentsReady)resolveVote(false)}catch(err){showFatal(err)}}
async function submitNoAnswerTimeout(){if(s.submitted)return;s.submitted=true;try{const res=await api('submit',{state:s.token,termRef:s.current?.termRef||'',answer:'',noAnswer:true});s.token=res.state;s.current=res.content;s.outcome=res.outcome;renderSubmitted('__NO__');resolveVote(false)}catch(err){showFatal(err)}}
function renderSubmitted(value){const host=$('#dnaInteraction');if(!host)return;host.innerHTML=`<div class="dna-lock-state"><div><strong>ANTWORT EINGEREICHT</strong><span>${value==='__NO__'?'KEINE ANTWORT':esc(value)}</span></div></div>`}
let resolving=false;async function resolveVote(solvedSpectator){if(resolving)return;resolving=true;clearTimers();try{const bot=await api('bots',{state:s.token});s.token=bot.state;s.current=bot.content;showOpponentSolves(bot.solves||[]);if(solvedSpectator){showOwnFeedback({status:'SOLVED',points:0},true)}else showOwnFeedback(s.outcome||{status:'NO_ANSWER',points:0},false);later(async()=>{try{if(s.current?.hintText&&!s.previousHints.includes(s.current.hintText))s.previousHints.push(s.current.hintText);const next=await api('advance',{state:s.token});s.token=next.state;resolving=false;enterContent(next.content)}catch(err){resolving=false;showFatal(err)}},1150)}catch(err){resolving=false;showFatal(err)}}
function showOpponentSolves(solves){const host=$('#dnaSolves');if(!host)return;host.innerHTML=(solves||[]).map(row=>`<div class="dna-solve-toast" style="--team:${TEAMS[row.team]?.color||'var(--theme-accent)'}">${TEAMS[row.team]?.name||row.team} HAT GELÖST · +${Number(row.points||0)}</div>`).join('')}
function showOwnFeedback(outcome,spectator){const host=$('#dnaInteraction');if(!host)return;if(spectator){host.innerHTML=`<div class="dna-feedback neutral"><div><strong>BEGRIFF GELÖST</strong><span>WARTET AUF DIE ANDEREN TEAMS</span></div></div>`;return}const status=outcome?.status||'NO_ANSWER',pts=Number(outcome?.points||0);if(status==='CORRECT')host.innerHTML=`<div class="dna-feedback correct"><div><strong>RICHTIG · +${pts}</strong><span>DEIN TEAM IST FÜR DIESEN BEGRIFF FERTIG</span></div></div>`;else if(status==='WRONG')host.innerHTML=`<div class="dna-feedback wrong"><div><strong>FALSCH · −1</strong><span>NÄCHSTER HINWEIS</span></div></div>`;else host.innerHTML=`<div class="dna-feedback neutral"><div><strong>KEINE ANTWORT · ±0</strong><span>NÄCHSTER HINWEIS</span></div></div>`}
function showReveal(c){clearTimers();setScrollLock(true);setChrome('REVEAL',`${String(c.termNo).padStart(2,'0')} / ${String(c.termCount).padStart(2,'0')} · ${c.categoryName}`,Math.min(98,(c.termNo/c.termCount)*100));const tieRank=Object.fromEntries(REVEAL_TIE_ORDER.map((k,i)=>[k,i]));const revealRows=TEAM_ORDER.map(k=>({key:k,score:Number(c.termScores?.[k]||0)})).sort((a,b)=>b.score-a.score||(tieRank[a.key]??99)-(tieRank[b.key]??99));content.innerHTML=`<section class="dna-reveal"><section class="dna-reveal-answer"><div><small>DIE LÖSUNG</small><h1>${esc(c.answer)}</h1></div></section><section class="dna-term-scores">${revealRows.map((r,i)=>`<div class="dna-term-score" data-team="${r.key}" style="--team:${TEAMS[r.key].color};--delay:${motionMs(90+i*80)}ms"><i></i><span><small>${TEAMS[r.key].name}</small><strong>${signed(r.score)}</strong></span></div>`).join('')}</section></section>`;const revealTitle=content.querySelector('.dna-reveal-answer h1');if(revealTitle){const len=String(c.answer||'').length;if(len>30)revealTitle.classList.add('dna-answer-xlong');else if(len>20)revealTitle.classList.add('dna-answer-long')}requestAnimationFrame(()=>content.querySelector('.dna-term-scores')?.classList.add('is-revealing'));later(async()=>{try{const next=await api('advance',{state:s.token});s.token=next.state;if(next.content?.phase==='COMPLETE')enterContent(next.content);else showTermCountdown(next.content)}catch(err){showFatal(err)}},3000)}
function showTermCountdown(nextContent){
 clearTimers();clearPinnedHintStage();setScrollLock(true);s.screen='COUNTDOWN';
 const termNo=String(nextContent?.termNo||'').padStart(2,'0');
 const termCount=String(nextContent?.termCount||'').padStart(2,'0');
 setChrome('NÄCHSTER BEGRIFF',`${termNo} / ${termCount}`,overallPct(nextContent));
 content.innerHTML=`<section class="dna-term-countdown"><div class="dna-countdown-inner"><span class="dna-countdown-round">${termNo} / ${termCount}</span><strong class="dna-countdown-category">${esc(String(nextContent?.categoryName||'').toUpperCase())}</strong><b class="dna-countdown-number" id="dnaCountdownNumber">3</b></div></section>`;
 const number=$('#dnaCountdownNumber');
 later(()=>{if(number)number.textContent='2'},1000);
 later(()=>{if(number)number.textContent='1'},2000);
 later(()=>enterContent(nextContent),3000);
}
function signed(n){n=Number(n||0);return n>0?'+'+n:String(n)}
function placementPoints(i){return [5,4,2,0][i]??0}
function showRanking(scores){clearTimers();setScrollLock(false);s.screen='RANKING';s.gameScores=scores||{};const rows=TEAM_ORDER.map((k,idx)=>({key:k,score:Number(s.gameScores[k]||0),stable:idx})).sort((a,b)=>b.score-a.score||a.stable-b.stable).map((r,i)=>({...r,place:i+1,points:placementPoints(i)}));s.ranking=rows;setChrome('RANKING','DNA SCORE · FINAL',100);page(`<section class="dna-hero"><span class="dna-kicker">GAME RANKING</span><h1>ERGEBNIS.</h1></section><section class="dna-result-card" id="dnaResultCard"><header><strong>DNA · FINALES ERGEBNIS</strong><span>HÖHER IST BESSER</span></header><div class="dna-columns"><span>POSITION</span><span>TEAM</span><span>DNA</span><span></span></div><div class="dna-result-rows">${rows.map((r,i)=>resultRow(r,i)).join('')}</div></section><div class="dna-actions"><button class="dna-btn primary dna-blocking" id="dnaToMerge" type="button">WEITER ZUR TURNIERTABELLE →</button></div>`);requestAnimationFrame(()=>{$('#dnaResultCard')?.classList.add('is-revealing');const resultRows=[...content.querySelectorAll('.dna-result-row')];[...resultRows].reverse().forEach((row,i)=>later(()=>row.classList.add('is-plus-visible'),2000+motionMs(i*260)))});$('#dnaToMerge').addEventListener('click',showMerge)}
function resultRow(r,i){return `<div class="dna-result-row" data-team="${r.key}" style="--delay:${motionMs(160+i*130)}ms"><b class="dna-place">${String(r.place).padStart(2,'0')}</b><span class="dna-result-team" style="--team:${TEAMS[r.key].color}"><i></i><span><strong>${TEAMS[r.key].name}</strong><small>${TEAMS[r.key].members}</small></span></span><b class="dna-metric">${r.score}</b><span class="dna-placement-points"><b>+${r.points}</b></span></div>`}
function showMerge(){
 clearTimers();s.screen='MERGE';s.mergeComplete=false;setScrollLock(false);
 const add=Object.fromEntries(s.ranking.map(r=>[r.key,r.points]));
 const byTeam=Object.fromEntries(TEAM_ORDER.map((k,idx)=>[k,{key:k,old:TEAMS[k].existing,add:add[k]||0,final:TEAMS[k].existing+(add[k]||0),stable:idx}]));
 const finalRows=Object.values(byTeam).sort((a,b)=>b.final-a.final||a.stable-b.stable).map((r,i)=>({...r,after:i+1}));

 setChrome('MERGE','TURNIER RANKING',100);

 const pageEl=content.querySelector('.dna-page');
 const hero=pageEl?.querySelector('.dna-hero');
 const kicker=hero?.querySelector('.dna-kicker');
 const title=hero?.querySelector('h1');
 const card=$('#dnaResultCard');
 const rowsHost=card?.querySelector('.dna-result-rows');
 const columns=card?.querySelector('.dna-columns');
 const headerStrong=card?.querySelector('header strong');
 const headerMeta=card?.querySelector('header span');
 const action=$('#dnaToMerge');

 if(!pageEl||!hero||!card||!rowsHost||!columns||!action){
   showFatal(new Error('Merge surface unavailable'));
   return;
 }

 // Keep the exact visible result table; mutate it in place instead of re-rendering.
 card.classList.remove('is-revealing');
 card.classList.remove('dna-result-card');
 card.classList.add('dna-merge-card');
 card.id='dnaMergeCard';
 rowsHost.classList.remove('dna-result-rows');
 rowsHost.classList.add('dna-merge-rows');
 rowsHost.id='dnaMergeRows';
 if(kicker)kicker.textContent='END GAME MERGE';
 if(title)title.textContent='PUNKTE.';
 if(headerStrong)headerStrong.textContent='TURNIERSTAND';
 if(headerMeta)headerMeta.textContent='DNA → TURNIERPUNKTE';

 const heads=[...columns.children];
 if(heads[2])heads[2].textContent='PUNKTE';
 if(heads[3]){heads[3].textContent='';heads[3].id='dnaMovementHeader'}

 [...rowsHost.children].forEach(row=>{
   const key=row.dataset.team;
   const data=byTeam[key];
   if(!data)return;
   row.classList.remove('dna-result-row');
   row.classList.add('dna-merge-row','is-stable','is-plus-visible');

   const metric=row.querySelector('.dna-metric');
   if(metric){
     const stack=document.createElement('span');
     stack.className='dna-points-stack';
     stack.innerHTML=`<b class="dna-old-points">${data.old}</b><b class="dna-final-points">${data.final}</b>`;
     metric.replaceWith(stack);
   }

   const placement=row.querySelector('.dna-placement-points');
   if(placement){
     placement.className='dna-merge-stage';
     const plus=placement.querySelector('b');
     if(plus){plus.className='dna-plus-points';plus.textContent='+'+data.add}
     if(!placement.querySelector('.dna-movement')){
       const movement=document.createElement('b');
       movement.className='dna-movement';
       placement.appendChild(movement);
     }
   }
 });

 action.id='dnaClose';
 action.disabled=true;
 action.textContent='MERGE LÄUFT …';
 let confettiHost=$('#dnaConfetti');
 if(!confettiHost){
   confettiHost=document.createElement('div');
   confettiHost.className='dna-confetti';
   confettiHost.id='dnaConfetti';
   confettiHost.setAttribute('aria-hidden','true');
   pageEl.appendChild(confettiHost);
 }

 // No second row/plus appear pass: the same visible rows continue straight into the morph.
 later(()=>startPointMorph(finalRows),motionMs(420));
}
function startPointMorph(finalRows){
 const card=$('#dnaMergeCard');
 const rows=[...content.querySelectorAll('.dna-merge-row')];
 if(!card||!rows.length)return;
 rows.forEach(row=>row.classList.add('is-stable'));

 const wait=ms=>new Promise(resolve=>later(resolve,ms));
 const run=async()=>{
   // Deliberately stage the additions bottom -> top instead of moving all bonuses at once.
   for(const row of [...rows].reverse()){
     const plus=row.querySelector('.dna-plus-points');
     const old=row.querySelector('.dna-old-points');
     if(!plus||!old)continue;

     const pr=plus.getBoundingClientRect(),or=old.getBoundingClientRect();
     // Stop just to the right of the current score. The +X must never overlap the digits.
     const targetLeft=or.right+8;
     const dx=targetLeft-pr.left;
     const anim=plus.animate(
       [
         {transform:'translate3d(0,0,0)',opacity:1,offset:0},
         {transform:`translate3d(${dx*.90}px,0,0)`,opacity:1,offset:.72},
         {transform:`translate3d(${dx}px,0,0)`,opacity:.28,offset:.90},
         {transform:`translate3d(${dx}px,0,0)`,opacity:0,offset:1}
       ],
       {duration:motionMs(240),easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}
     );
     await anim.finished.catch(()=>{});
     try{anim.cancel()}catch(_){}
     plus.style.opacity='0';
     plus.style.transform='none';

     // Only after the bonus is fully gone do we swap to the summed value and pulse it.
     row.classList.add('is-summed','is-arrived');
     await wait(motionMs(100));
   }

   // Give the completed additions breathing room before introducing the next concept.
   await wait(motionMs(180));
   const header=$('#dnaMovementHeader');
   if(header)header.textContent='BEWEGUNG';
   await wait(motionMs(220));
   reorderMergeRows(finalRows);
 };
 run();
}
function reorderMergeRows(finalRows){
 const host=$('#dnaMergeRows');if(!host)return;
 const current=[...host.children];
 const rowByTeam=Object.fromEntries(current.map(el=>[el.dataset.team,el]));
 current.forEach(el=>el.classList.add('is-stable'));

 // IMPORTANT: movement is derived from the actual DOM order, not a separate points sort.
 const beforePos=Object.fromEntries(current.map((el,index)=>[el.dataset.team,index+1]));

 // Keep DOM order unchanged while rows visibly travel to their target slots.
 const slotTops=current.map(el=>el.getBoundingClientRect().top);
 const duration=motionMs(580);
 const swapAnimations=[];

 finalRows.forEach((r,targetIndex)=>{
   const el=rowByTeam[r.key];if(!el)return;
   const currentTop=el.getBoundingClientRect().top;
   const targetTop=slotTops[targetIndex]??currentTop;
   const dy=targetTop-currentTop;
   el.classList.add('is-swapping');
   const anim=el.animate(
     [
       {transform:'translate3d(0,0,0)'},
       {transform:`translate3d(0,${dy}px,0)`}
     ],
     {duration,easing:'cubic-bezier(.2,.72,.18,1)',fill:'forwards'}
   );
   swapAnimations.push({el,anim});
 });

 Promise.all(swapAnimations.map(({anim})=>anim.finished.catch(()=>{}))).then(()=>{
   // Commit the visual destination, then change DOM order in the same task.
   swapAnimations.forEach(({anim})=>{try{anim.commitStyles()}catch(_){}});
   swapAnimations.forEach(({anim})=>{try{anim.cancel()}catch(_){}});
   finalRows.forEach((r,i)=>{
     const el=rowByTeam[r.key];if(!el)return;
     host.appendChild(el);
     const place=el.querySelector('.dna-place');
     if(place)place.textContent=String(i+1).padStart(2,'0');
   });
   swapAnimations.forEach(({el})=>{
     el.style.transform='none';
     el.classList.remove('is-swapping');
     el.classList.add('is-stable');
   });

   // Force layout after the DOM has its final order, then derive AFTER positions from DOM.
   host.getBoundingClientRect();
   const afterRows=[...host.children];
   const afterPos=Object.fromEntries(afterRows.map((el,index)=>[el.dataset.team,index+1]));

   later(()=>{
     afterRows.forEach(el=>{
       const key=el.dataset.team;
       const before=beforePos[key];
       const after=afterPos[key];
       const delta=(before??after)-after;
       const movement=el.querySelector('.dna-movement');
       if(!movement)return;
       movement.textContent=delta>0?`↑ ${delta}`:delta<0?`↓ ${Math.abs(delta)}`:'—';
       movement.className='dna-movement '+(delta>0?'up':delta<0?'down':'same');
       movement.classList.add('is-visible');
     });
     later(()=>{confetti(finalRows[0]?.key);s.mergeComplete=true;const b=$('#dnaClose');if(b){b.disabled=false;b.textContent='SPIEL SCHLIESSEN →';b.addEventListener('click',resetAll)}},motionMs(420));
   },motionMs(120));
 });
}
function confetti(key){
 const host=$('#dnaConfetti');if(!host||!key)return;
 const waves=6;
 const piecesPerWave=18;
 const waveGap=560;
 for(let wave=0;wave<waves;wave++){
   later(()=>{
     if(!host.isConnected)return;
     for(let i=0;i<piecesPerWave;i++){
       const el=document.createElement('i');
       el.style.setProperty('--team',TEAMS[key].color);
       el.style.left=(Math.random()*100)+'%';
       el.style.setProperty('--dur',(2.15+Math.random()*1.15)+'s');
       el.style.setProperty('--wait',(Math.random()*.24)+'s');
       el.style.setProperty('--drift',(-95+Math.random()*190)+'px');
       host.appendChild(el);
     }
   },wave*waveGap);
 }
 // Long rain: keep the host alive until the final wave has fully fallen.
 later(()=>host.remove(),waves*waveGap+3800);
}
function resetAll(){clearTimers();resolving=false;clearTimeout(reconsiderTimer);s={screen:'SETUP',selected:new Set(['countries']),termCount:5,pool:'BALANCED',token:null,current:null,previousHints:[],idea:'',ideaDone:false,teammateIdea:null,teammateReady:false,opponentsReady:false,userVote:null,teammateVote:null,submitted:false,outcome:null,gameScores:null,ranking:null,mergeComplete:false};setup()}
async function boot(){const session=await authSession();if(!session)return authGate();themeCatalog=await loadThemeCatalog();renderThemeQa();setup()}
boot();
})();
