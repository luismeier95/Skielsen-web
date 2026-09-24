(()=>{
'use strict';
const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const FUNCTION_URL=SUPABASE_URL+'/functions/v1/dna-standalone';
const SESSION_KEY='skielsen.native.supabase.session';
const PHASE_MS=10000;
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
const content=$('#dnaContent'),progress=$('#dnaProgress'),headerState=$('#dnaHeaderState'),headerMeta=$('#dnaHeaderMeta');
let phaseTimer=0,phaseRaf=0,scheduled=[];
let s={screen:'BOOT',selected:new Set(['countries']),termCount:5,pool:'BALANCED',token:null,current:null,previousHints:[],idea:'',ideaDone:false,teammateIdea:null,teammateReady:false,opponentsReady:false,userVote:null,teammateVote:null,submitted:false,outcome:null,gameScores:null,ranking:null,mergeComplete:false};
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function clearTimers(){if(phaseTimer)clearTimeout(phaseTimer);if(phaseRaf)cancelAnimationFrame(phaseRaf);phaseTimer=0;phaseRaf=0;scheduled.splice(0).forEach(clearTimeout)}
function later(fn,ms){const id=setTimeout(fn,ms);scheduled.push(id);return id}
function setChrome(strong,meta,pct){headerState.textContent=strong;headerMeta.textContent=meta;progress.style.width=Math.max(0,Math.min(100,pct))+'%'}
function visualHeight(){return window.visualViewport?.height||window.innerHeight}
function syncViewport(){const h=visualHeight();document.documentElement.style.setProperty('--dna-visual-height',h+'px');const base=window.innerHeight||h;document.body.classList.toggle('dna-keyboard-open',h<base*.78)}
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});window.addEventListener('resize',syncViewport,{passive:true});syncViewport();
function getStoredSession(){try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch(_){return null}}
function validSession(session){if(!session?.access_token)return false;if(!session.expires_at)return true;return Number(session.expires_at)>Math.floor(Date.now()/1000)+15}
async function authSession(){const session=getStoredSession();return validSession(session)?session:null}
async function api(action,payload={}){const session=await authSession();if(!session)throw new Error('LOGIN_REQUIRED');const res=await fetch(FUNCTION_URL,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||'DNA Serverfehler');return data}
function page(html){document.body.classList.remove('dna-game-active');content.innerHTML=`<section class="dna-page">${html}</section>`;window.scrollTo(0,0)}
function authGate(){clearTimers();setChrome('LOGIN','STANDALONE · AUTH',0);page(`<section class="dna-auth"><div class="dna-auth-card"><span class="dna-kicker">SKIELSEN ACCOUNT</span><h1>ANMELDUNG ERFORDERLICH.</h1><p>Die DNA-Standalone nutzt die geschützte Content-Datenbank. Öffne zuerst SKIELSEN, melde dich an und kehre danach zu diesem Test zurück.</p><div class="dna-actions"><button class="dna-btn primary" id="dnaGoApp" type="button">ZUR SKIELSEN APP →</button></div></div></section>`);$('#dnaGoApp').addEventListener('click',()=>location.href='../')}
