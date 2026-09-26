
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.3";
import {createGame,act,teamView,ORDER,phaseKey,shouldTick} from './quick-state.mjs';
import {DECOYS} from './quick-decoys.mjs';

const sql=postgres(Deno.env.get("SUPABASE_DB_URL")!,{
  prepare:false,
  max:1,
  // Edge isolates must not pin a direct Postgres connection for their full
  // lifetime. Quick Games polls from several devices, so release idle
  // connections aggressively and cap their lifetime.
  idle_timeout:1,
  max_lifetime:5,
  connect_timeout:5
});
const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const BOT_TEAMS=["BLUE","GREEN","YELLOW"];
const ALL_TEAMS=["RED","BLUE","GREEN","YELLOW"];
const POINTS={1:3,2:2,3:1};
let keyPromise=null;
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:corsHeaders})}
function jwtSub(req){
  try{
    const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
    const raw=token.split(".")[1].replaceAll("-","+").replaceAll("_","/");
    return String(JSON.parse(atob(raw+"=".repeat((4-raw.length%4)%4)))?.sub||"");
  }catch(_){return ""}
}
function to64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"")}
function from64(v){const base=String(v||"").replaceAll("-","+").replaceAll("_","/");const raw=atob(base+"=".repeat((4-base.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function key(){
  if(keyPromise)return keyPromise;
  keyPromise=(async()=>{
    const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("JWT_SECRET");
    if(!secret)throw new Error("Server secret unavailable");
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
  })();
  return keyPromise;
}
async function seal(state){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(state));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),data));
  const packed=new Uint8Array(iv.length+cipher.length);packed.set(iv);packed.set(cipher,iv.length);
  return to64(packed);
}
async function open(token){
  const packed=from64(token);
  if(packed.length<29)throw new Error("Invalid session token");
  const iv=packed.slice(0,12),cipher=packed.slice(12);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},await key(),cipher);
  const state=JSON.parse(new TextDecoder().decode(plain));
  if(state?.v!==2||!Array.isArray(state.terms)||!state.terms.length)throw new Error("Invalid session state");
  if(Date.now()-Number(state.iat||0)>21600000)throw new Error("Standalone session expired");
  return state;
}
function teamState(){return {score:0,termScore:0,solved:false,processedHint:0,last:null}}
function blankTeams(){return {RED:teamState(),BLUE:teamState(),GREEN:teamState(),YELLOW:teamState()}}
function resetTerm(state){for(const team of ALL_TEAMS){state.teams[team].termScore=0;state.teams[team].solved=false;state.teams[team].processedHint=0;state.teams[team].last=null}}
function scores(state,keyName){return Object.fromEntries(ALL_TEAMS.map(t=>[t,Number(state.teams[t][keyName]||0)]))}
async function contentFor(state){
  if(state.phase==="COMPLETE")return {phase:"COMPLETE",termNo:state.terms.length,termCount:state.terms.length,gameScores:scores(state,"score")};
  const termId=state.terms[state.term-1];
  if(state.phase==="REVEAL"){
    const rows=await sql.unsafe("select t.canonical_answer,t.category_id,c.name_de as category_name from private.dna_terms t join public.dna_categories c on c.category_id=t.category_id where t.term_id=$1::uuid limit 1",[termId]);
    if(!rows.length)throw new Error("DNA term not found");
    return {phase:"REVEAL",termNo:state.term,termCount:state.terms.length,categoryId:rows[0].category_id,categoryName:rows[0].category_name,answer:rows[0].canonical_answer,termScores:scores(state,"termScore"),gameScores:scores(state,"score")};
  }
  const rows=await sql.unsafe("select t.category_id,c.name_de as category_name,h.hint_text,h.hint_no,h.points_value from private.dna_terms t join public.dna_categories c on c.category_id=t.category_id join private.dna_hints h on h.term_id=t.term_id where t.term_id=$1::uuid and h.hint_no=$2 limit 1",[termId,state.hint]);
  if(!rows.length)throw new Error("DNA hint not found");
  const termRef=await seal({v:2,terms:[String(termId)],answers:await answerCandidates(termId),term:Number(state.term),hint:Number(state.hint),phase:"TERM_REF",teams:{},iat:Date.now()});
  return {phase:"HINT",termNo:state.term,termCount:state.terms.length,categoryId:rows[0].category_id,categoryName:rows[0].category_name,hintNo:Number(rows[0].hint_no),hintText:rows[0].hint_text,points:Number(rows[0].points_value),termRef,redSolved:Boolean(state.teams.RED.solved),redGameScore:Number(state.teams.RED.score||0),redTermScore:Number(state.teams.RED.termScore||0)};
}
async function start(body,userId){
  let requested=Array.isArray(body?.categories)?body.categories.map(String).filter(Boolean):[];
  let count=[5,10,15].includes(Number(body?.termCount))?Number(body.termCount):5;
  let pool=["CASUAL","BALANCED","EXPERT"].includes(String(body?.pool||"").toUpperCase())?String(body.pool).toUpperCase():"BALANCED";
  const quickLobby=body?.quickLobby?String(body.quickLobby):null;
  if(quickLobby){
    const membership=await sql.unsafe("select l.setup_status,l.setup_json from public.quick_game_lobbies l join public.quick_game_lobby_players p on p.lobby_id=l.lobby_id where l.lobby_id=$1::uuid and l.status='LIVE' and p.user_id=$2::uuid limit 1",[quickLobby,userId]);
    if(!membership.length)throw new Error("Quick lobby membership required");
    if(String(membership[0].setup_status)!=="READY")throw new Error("Quick lobby setup required");
    const setup=membership[0].setup_json||{};
    requested=Array.isArray(setup.categories)?setup.categories.map(String).filter(Boolean):[];
    count=[5,10,15].includes(Number(setup.termCount))?Number(setup.termCount):5;
    pool=["CASUAL","BALANCED","EXPERT"].includes(String(setup.pool||"").toUpperCase())?String(setup.pool).toUpperCase():"BALANCED";
  }
  const seed=String(quickLobby||crypto.randomUUID());
  const available=await sql.unsafe("select category_id from public.dna_categories where is_active=true order by sort_order");
  const allowed=new Set(available.map(r=>String(r.category_id)));
  const categories=requested.filter(x=>allowed.has(x));if(!categories.length)categories.push("countries");
  const q="with ranked as (select t.term_id::text as term_id,t.category_id,row_number() over (partition by t.category_id order by case when $1='CASUAL' then case when t.familiarity_tier='MAINSTREAM' then 0 else 1 end when $1='EXPERT' then case when t.familiarity_tier in ('KNOWN','NICHE') then 0 else 1 end else 0 end,case when $1='EXPERT' then case when t.term_difficulty='HARD' then 0 when t.term_difficulty='NORMAL' then 1 else 2 end else 0 end,md5(t.term_id::text||$4::text)) as rn from private.dna_terms t where t.content_status='ACTIVE' and t.category_id=any($2::text[])) select term_id from ranked order by rn,md5(term_id||$4::text) limit $3";
  const rows=await sql.unsafe(q,[pool,categories,count,seed]);
  if(rows.length<count)throw new Error("Not enough active DNA content for this setup");
  const state={v:2,terms:rows.map(r=>String(r.term_id)),term:1,hint:1,phase:"HINT",teams:blankTeams(),quickLobby,quickUserId:quickLobby?userId:null,iat:Date.now()};
  return {state:await seal(state),content:await contentFor(state)};
}
function normalizeAnswer(value){
  return String(value||"")
    .normalize("NFKD")
    .replace(/\p{M}+/gu,"")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g,"ss")
    .replace(/&/g," and ")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .trim()
    .replace(/\s+/g," ");
}
function compactAnswer(value){
  return normalizeAnswer(value).replace(/\s+/g,"");
}
function stripLeadingArticle(value){
  const normalized=normalizeAnswer(value);
  const tokens=normalized.split(" ").filter(Boolean);
  const articles=new Set([
    "the","a","an",
    "der","die","das","den","dem","des",
    "ein","eine","einer","einem","einen","eines",
    "le","la","les","el","los","las"
  ]);
  if(tokens.length>1 && articles.has(tokens[0]))tokens.shift();
  return tokens.join(" ");
}
function semanticCompactAnswer(value){
  return compactAnswer(stripLeadingArticle(value));
}
const CONNECTOR_WORDS=new Set([
  "the","a","an","to","of","and","or","in","on","at","for","from","with",
  "der","die","das","den","dem","des","ein","eine","einer","einem","einen","eines",
  "und","oder","zu","zur","zum","von","vom","im","am","auf","mit",
  "le","la","les","el","los","las","de","del"
]);
function significantAnswerTokens(value){
  return normalizeAnswer(value).split(" ").filter(Boolean).filter(token=>!CONNECTOR_WORDS.has(token));
}
function connectorTolerantMatch(input,candidate){
  const a=significantAnswerTokens(input),b=significantAnswerTokens(candidate);
  if(a.length<2||b.length<2)return false;
  const aa=a.join(""),bb=b.join("");
  return aa.length>=7&&bb.length>=7&&aa===bb;
}
function damerauDistance(a,b){
  const al=a.length,bl=b.length;
  if(!al)return bl;if(!bl)return al;
  const d=Array.from({length:al+1},()=>Array(bl+1).fill(0));
  for(let i=0;i<=al;i++)d[i][0]=i;
  for(let j=0;j<=bl;j++)d[0][j]=j;
  for(let i=1;i<=al;i++){
    for(let j=1;j<=bl;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]){
        d[i][j]=Math.min(d[i][j],d[i-2][j-2]+cost);
      }
    }
  }
  return d[al][bl];
}
function fuzzyCandidateMatch(input,candidate){
  const a=normalizeAnswer(input),b=normalizeAnswer(candidate);
  if(!a||!b)return false;
  if(a===b)return true;
  if(compactAnswer(a)===compactAnswer(b))return true;
  // Formatting and a leading article do not change the intended answer:
  // TRUMANSHOW == TRUMAN SHOW == THE TRUMAN SHOW.
  if(semanticCompactAnswer(a)===semanticCompactAnswer(b))return true;
  // Natural title/name variants may omit or swap low-information connector words.
  // Example: "BACK THE FUTURE" still resolves against "BACK TO THE FUTURE".
  if(connectorTolerantMatch(a,b))return true;

  const maxLen=Math.max(a.length,b.length);
  const distance=damerauDistance(a,b);
  if(maxLen>=5 && distance<=1)return true;
  if(maxLen>=10 && distance<=2 && (1-distance/maxLen)>=0.82)return true;
  if(maxLen>=5 && (1-distance/maxLen)>=0.90)return true;

  const aTokens=a.split(" "),bTokens=b.split(" ");
  const shorter=a.length<=b.length?a:b;
  const longer=a.length<=b.length?b:a;
  const shorterTokens=a.length<=b.length?aTokens:bTokens;
  const longerTokens=a.length<=b.length?bTokens:aTokens;
  const phraseContained=(" "+longer+" ").includes(" "+shorter+" ");
  const tokenCoverage=shorterTokens.length/Math.max(1,longerTokens.length);
  const charCoverage=shorter.length/Math.max(1,longer.length);
  if(phraseContained && shorter.length>=7 &&
     (shorterTokens.length>=2 || charCoverage>=0.55) &&
     (tokenCoverage>=0.45 || charCoverage>=0.55)){
    return true;
  }
  return false;
}
function answerMatchesCandidates(answer,candidates){
  const raw=String(answer||"").trim();
  if(!raw)return false;
  return (candidates||[]).some(candidate=>fuzzyCandidateMatch(raw,String(candidate||"")));
}
function ideaResolution(value,candidates){
  const raw=String(value||"").trim();
  if(!raw||!answerMatchesCandidates(raw,candidates))return null;
  // Hidden grouping key only. The canonical answer text is never returned to
  // the browser before Reveal. "exact" only lets teamView prefer a spelling
  // that a player really submitted over a fuzzy typo submitted by a teammate.
  return {
    key:"__DNA_ACCEPTED_ANSWER__",
    exact:(candidates||[]).some(candidate=>normalizeAnswer(raw)===normalizeAnswer(String(candidate||"")))
  };
}
async function answerCandidates(termId,db=sql){
  const rows=await db.unsafe(
    "select t.canonical_answer as value from private.dna_terms t where t.term_id=$1::uuid "+
    "union all select a.alias_text as value from private.dna_answer_aliases a where a.term_id=$1::uuid",
    [termId]
  );
  return rows.map(r=>String(r.value||"")).filter(Boolean);
}
async function loadQuickTermData(termId,db=sql){
  const rows=await db.unsafe(
    "select t.term_id::text as term_id,t.category_id,c.name_de as category_name,t.canonical_answer,"+
    "coalesce((select json_agg(a.alias_text order by a.alias_text) from private.dna_answer_aliases a where a.term_id=t.term_id),'[]'::json) as aliases,"+
    "coalesce((select json_agg(json_build_object('hintNo',h.hint_no,'hintText',h.hint_text,'points',h.points_value) order by h.hint_no) from private.dna_hints h where h.term_id=t.term_id),'[]'::json) as hints "+
    "from private.dna_terms t join public.dna_categories c on c.category_id=t.category_id where t.term_id=$1::uuid limit 1",
    [termId]
  );
  if(!rows.length)throw new Error("DNA term not found");
  const row=rows[0],aliases=Array.isArray(row.aliases)?row.aliases.map(String).filter(Boolean):[];
  const hints=Array.isArray(row.hints)?row.hints.map(h=>({hintNo:Number(h.hintNo),hintText:String(h.hintText||''),points:Number(h.points||0)})):[];
  if(hints.length!==3)throw new Error("DNA term requires exactly three hints");
  return {
    termId:String(row.term_id),
    categoryId:String(row.category_id),
    categoryName:String(row.category_name||row.category_id),
    answer:String(row.canonical_answer||''),
    answers:[String(row.canonical_answer||''),...aliases].filter(Boolean),
    hints
  };
}
async function hydrateQuickTerm(g,db=sql){
  const termId=String(g.terms[g.term-1]||'');
  if(!termId)throw new Error("DNA term unavailable");
  if(String(g.termData?.termId||'')===termId)return false;
  const data=await loadQuickTermData(termId,db);
  g.termData=data;
  // Keep only the current term's tiny bot-decoy list in the persisted state.
  g.decoys={[termId]:DECOYS[data.categoryId]||[]};
  return true;
}
function quickPerspective(g,userId){
  const own=g.players.find(p=>p.id===userId)?.team;
  if(!own)throw new Error('LOBBY_FORBIDDEN');
  const others=ORDER.filter(k=>k!==own);
  return {own,map:{RED:own,BLUE:others[0],GREEN:others[1],YELLOW:others[2]}};
}
function quickPerspectiveScores(g,userId,keyName){
  const {map}=quickPerspective(g,userId);
  return Object.fromEntries(ORDER.map(local=>[local,Number(g.teams[map[local]]?.[keyName]||0)]));
}
function quickContent(g,userId){
  if(g.stage==='READY')return null;
  if(g.stage==='COMPLETE')return {phase:'COMPLETE',termNo:g.terms.length,termCount:g.terms.length,gameScores:quickPerspectiveScores(g,userId,'score')};
  const data=g.termData;
  if(!data||String(data.termId)!==String(g.terms[g.term-1]))throw new Error('Shared DNA term cache unavailable');
  if(g.stage==='REVEAL'){
    return {phase:'REVEAL',termNo:g.term,termCount:g.terms.length,categoryId:data.categoryId,categoryName:data.categoryName,answer:data.answer,termScores:quickPerspectiveScores(g,userId,'termScore'),gameScores:quickPerspectiveScores(g,userId,'score')};
  }
  if(g.stage==='COUNTDOWN')return {termNo:g.term,termCount:g.terms.length,categoryName:data.categoryName};
  const hint=data.hints[g.hint-1];
  if(!hint)throw new Error('Shared DNA hint unavailable');
  const {own}=quickPerspective(g,userId);
  return {
    phase:'HINT',termNo:g.term,termCount:g.terms.length,categoryId:data.categoryId,categoryName:data.categoryName,
    hintNo:hint.hintNo,hintText:hint.hintText,points:hint.points,
    previousHints:data.hints.slice(0,Math.max(0,g.hint-1)).map(h=>h.hintText),
    redSolved:Boolean(g.teams[own].solved),redGameScore:Number(g.teams[own].score||0),redTermScore:Number(g.teams[own].termScore||0)
  };
}
function quickPollAfter(g,now){
  if(shouldTick(g,now))return 80;
  return g.stage==='VOTE'?300:g.stage==='READY'||g.stage==='IDEA'?500:1000;
}
function quickSnapshot(g,userId,serverReceived,serverNow,actionError=null,knownRevision=null,kind='poll'){
  const {own}=quickPerspective(g,userId);
  const base={
    revision:Number(g.revision||0),phaseKey:phaseKey(g),stage:g.stage,startedAt:g.startedAt,deadline:g.deadline,
    serverNow,serverReceived,pollAfterMs:quickPollAfter(g,serverNow)
  };
  if(kind==='poll'&&Number(knownRevision)===Number(g.revision))return {...base,unchanged:true};
  return {
    ...base,actionError,content:quickContent(g,userId),team:teamView(g,userId),
    solves:ORDER.filter(k=>k!==own&&g.teams[k].solved).map(team=>({team,points:g.teams[team].last?.points||0})),
    gameScores:g.stage==='COMPLETE'?scores(g,'score'):undefined
  };
}
async function initializeQuickGame(lobby,userId,now){
  const roster=await sql.unsafe(
    "select l.setup_status,l.setup_json,json_agg(json_build_object('id',p.user_id::text,'seat',p.seat) order by p.seat) as players "+
    "from public.quick_game_lobbies l join public.quick_game_lobby_players p on p.lobby_id=l.lobby_id "+
    "where l.lobby_id=$1::uuid and l.status='LIVE' group by l.setup_status,l.setup_json",
    [lobby]
  );
  if(!roster.length)throw new Error('Quick lobby unavailable');
  const players=(Array.isArray(roster[0].players)?roster[0].players:[]).map(p=>({id:String(p.id),seat:Number(p.seat),team:ORDER[Math.floor((Number(p.seat)-1)/2)]}));
  if(!players.some(p=>p.id===userId)||String(roster[0].setup_status)!=='READY')throw new Error('Quick lobby membership/setup required');
  const setup=roster[0].setup_json||{};
  const categories=Array.isArray(setup.categories)&&setup.categories.length?setup.categories.map(String).filter(Boolean):['countries'];
  const count=[5,10,15].includes(Number(setup.termCount))?Number(setup.termCount):5;
  const pool=['CASUAL','BALANCED','EXPERT'].includes(String(setup.pool||'').toUpperCase())?String(setup.pool).toUpperCase():'BALANCED';
  const q="with ranked as (select t.term_id::text as term_id,t.category_id,row_number() over (partition by t.category_id order by case when $1='CASUAL' then case when t.familiarity_tier='MAINSTREAM' then 0 else 1 end when $1='EXPERT' then case when t.familiarity_tier in ('KNOWN','NICHE') then 0 else 1 end else 0 end,case when $1='EXPERT' then case when t.term_difficulty='HARD' then 0 when t.term_difficulty='NORMAL' then 1 else 2 end else 0 end,md5(t.term_id::text||$4::text)) as rn from private.dna_terms t where t.content_status='ACTIVE' and t.category_id=any($2::text[])) select term_id from ranked order by rn,md5(term_id||$4::text) limit $3";
  const terms=await sql.unsafe(q,[pool,categories,count,lobby]);
  if(terms.length<count)throw new Error('Not enough active DNA content for this setup');
  const g=createGame(terms.map(r=>String(r.term_id)),players,now);
  await hydrateQuickTerm(g);
  const inserted=await sql.unsafe(
    'insert into private.quick_dna_games(lobby_id,state) values($1::uuid,$2::text::jsonb) on conflict do nothing returning state',
    [lobby,JSON.stringify(g)]
  );
  if(inserted.length)return inserted[0].state;
  const rows=await sql.unsafe('select state from private.quick_dna_games where lobby_id=$1::uuid',[lobby]);
  if(!rows.length)throw new Error('Shared DNA state unavailable');
  return rows[0].state;
}
async function answerMatches(termId,answer){
  return answerMatchesCandidates(answer,await answerCandidates(termId));
}
async function visibleTermContext(state,body){
  const sessionTerm=String(state.terms[state.term-1]||"");
  const fallback={termId:sessionTerm,candidates:await answerCandidates(sessionTerm)};
  const token=String(body?.termRef||"");
  if(!token)return fallback;
  try{
    const ref=await open(token);
    const refTerm=String(ref?.terms?.[0]||"");
    const answers=Array.isArray(ref?.answers)?ref.answers.map(String).filter(Boolean):[];
    if(ref?.phase!=="TERM_REF"||!refTerm)return fallback;
    return {termId:refTerm,candidates:answers.length?answers:await answerCandidates(refTerm)};
  }catch(_){
    return fallback;
  }
}
async function answerProof(state,termId,answer){
  return seal({
    v:2,
    terms:[String(termId)],
    term:Number(state.term),
    hint:Number(state.hint),
    phase:"ANSWER_PROOF",
    teams:{},
    answerNorm:normalizeAnswer(answer),
    iat:Date.now()
  });
}
async function proofIsCorrect(state,termId,answer,token){
  if(!token)return false;
  try{
    const proof=await open(token);
    return proof?.phase==="ANSWER_PROOF"
      && String(proof?.terms?.[0]||"")===String(termId)
      && Number(proof?.term)===Number(state.term)
      && Number(proof?.hint)===Number(state.hint)
      && String(proof?.answerNorm||"")===normalizeAnswer(answer);
  }catch(_){
    return false;
  }
}
async function teammateVote(body){
  const state=await open(body?.state);
  if(state.phase!=="HINT")throw new Error("Teammate vote unavailable");
  const userVote=String(body?.userVote||"").trim();
  const teammateIdea=String(body?.teammateIdea||"").trim();
  if(!userVote)return {vote:null};

  if(userVote==="__NO__"){
    if(!teammateIdea)return {vote:"__NO__"};
    return {vote:Math.random()<0.72?"__NO__":teammateIdea};
  }

  const termContext=await visibleTermContext(state,body);
  const termId=termContext.termId;
  const userCorrect=answerMatchesCandidates(userVote,termContext.candidates);
  const teammateCorrect=teammateIdea?answerMatchesCandidates(teammateIdea,termContext.candidates):false;

  if(teammateIdea && userVote.localeCompare(teammateIdea,undefined,{sensitivity:"accent"})===0){
    return userCorrect
      ? {vote:userVote,answerProof:await answerProof(state,termId,userVote)}
      : {vote:userVote};
  }

  if(userCorrect){
    return {vote:userVote,answerProof:await answerProof(state,termId,userVote)};
  }

  if(teammateCorrect){
    return {vote:Math.random()<0.95?teammateIdea:userVote};
  }

  const roll=Math.random();
  if(teammateIdea && roll<0.42)return {vote:teammateIdea};
  if(roll<0.77)return {vote:userVote};
  return {vote:"__NO__"};
}

async function submit(body,userId){
  const state=await open(body?.state);
  if(state.phase!=="HINT")throw new Error("Submission unavailable");
  const red=state.teams.RED;
  if(red.solved)return {state:await seal(state),outcome:{status:"SOLVED",points:0},content:await contentFor(state)};
  if(red.processedHint>=state.hint&&red.last?.hint===state.hint)return {state:await seal(state),outcome:red.last,content:await contentFor(state)};
  const noAnswer=Boolean(body?.noAnswer);
  const answer=String(body?.answer||"").trim();
  if(state.quickLobby&&!noAnswer&&answer){
    if(!userId||String(state.quickUserId)!==String(userId))throw new Error("Quick lobby user mismatch");
    const context=await sql.unsafe("select (((p.seat-1)/2)+1)::smallint as team_no,(select count(*) from public.quick_game_lobby_players tp where tp.lobby_id=p.lobby_id and (((tp.seat-1)/2)+1)=(((p.seat-1)/2)+1)) as human_count from public.quick_game_lobby_players p where p.lobby_id=$1::uuid and p.user_id=$2::uuid limit 1",[state.quickLobby,userId]);
    if(!context.length)throw new Error("Quick lobby membership required");
    if(Number(context[0].human_count)>=2){
      const shared=await sql.unsafe("select answer from private.quick_dna_team_submissions where lobby_id=$1::uuid and term_no=$2 and hint_no=$3 and team_no=$4 limit 1",[state.quickLobby,state.term,state.hint,context[0].team_no]);
      if(!shared.length||normalizeAnswer(shared[0].answer)!==normalizeAnswer(answer))throw new Error("Team consensus required");
    }
  }
  let outcome;
  if(noAnswer||!answer){
    outcome={hint:state.hint,status:"NO_ANSWER",points:0};
  }else{
    const termContext=await visibleTermContext(state,body);
    const termId=termContext.termId;
    const provenCorrect=await proofIsCorrect(state,termId,answer,String(body?.answerProof||""));
    const correct=provenCorrect || answerMatchesCandidates(answer,termContext.candidates);
    console.log("dna submit evaluation",{termNo:state.term,hint:state.hint,termId,answerNormalized:normalizeAnswer(answer),provenCorrect,correct});
    if(correct){
      const pts=POINTS[state.hint]||0;red.score+=pts;red.termScore+=pts;red.solved=true;
      outcome={hint:state.hint,status:"CORRECT",points:pts};
    }else{
      red.score-=1;red.termScore-=1;
      outcome={hint:state.hint,status:"WRONG",points:-1};
    }
  }
  red.processedHint=state.hint;red.last=outcome;
  return {state:await seal(state),outcome,content:await contentFor(state)};
}
async function bots(body){
  const state=await open(body?.state);
  if(state.phase!=="HINT")return {state:await seal(state),solves:[],content:await contentFor(state)};
  const solves=[],point=POINTS[state.hint]||0,chance=state.hint===1?.14:state.hint===2?.36:.68;
  for(const team of BOT_TEAMS){
    const bot=state.teams[team];if(bot.solved||bot.processedHint>=state.hint)continue;
    bot.processedHint=state.hint;
    if(Math.random()>=.78){bot.last={hint:state.hint,status:"NO_ANSWER",points:0};continue}
    if(Math.random()<chance){bot.score+=point;bot.termScore+=point;bot.solved=true;bot.last={hint:state.hint,status:"CORRECT",points:point};solves.push({team,points:point})}
    else{bot.score-=1;bot.termScore-=1;bot.last={hint:state.hint,status:"WRONG",points:-1}}
  }
  return {state:await seal(state),solves,content:await contentFor(state)};
}
async function recordQuickResult(state,userId){
  if(!state.quickLobby)return;
  if(!userId||String(state.quickUserId)!==String(userId))throw new Error("Quick lobby user mismatch");
  const seats=await sql.unsafe("select seat from public.quick_game_lobby_players where lobby_id=$1::uuid and user_id=$2::uuid limit 1",[state.quickLobby,userId]);
  if(!seats.length)throw new Error("Quick lobby membership required");
  const order=["RED","BLUE","GREEN","YELLOW"],own=order[Math.max(0,Math.min(3,Math.floor((Number(seats[0].seat||1)-1)/2)))]||"RED";
  const remaining=order.filter(x=>x!==own),map={RED:own,BLUE:remaining[0],GREEN:remaining[1],YELLOW:remaining[2]},mapped={};
  for(const local of order)mapped[map[local]]=Number(state.teams[local]?.score||0);
  await sql.unsafe("insert into public.quick_game_results(lobby_id,user_id,score) values($1::uuid,$2::uuid,$3::integer) on conflict(lobby_id,user_id) do update set score=excluded.score,submitted_at=now()",[state.quickLobby,userId,mapped[own]]);
  await sql.unsafe("update public.quick_game_lobbies set bot_scores=case when bot_scores='{}'::jsonb then $2::text::jsonb else bot_scores end,updated_at=now() where lobby_id=$1::uuid",[state.quickLobby,JSON.stringify(mapped)]);
}
async function advance(body,userId){
  const state=await open(body?.state);
  if(state.phase==="HINT"){
    if(state.hint<3)state.hint+=1;
    else state.phase="REVEAL";
  }else if(state.phase==="REVEAL"){
    if(state.term>=state.terms.length){state.phase="COMPLETE";await recordQuickResult(state,userId)}
    else{state.term+=1;state.hint=1;state.phase="HINT";resetTerm(state)}
  }
  return {state:await seal(state),content:await contentFor(state)};
}
async function quickSync(body,userId){
  const lobby=String(body.quickLobby||'');
  const command=body.command||{kind:'poll'};
  const kind=String(command.kind||'poll');
  const serverReceived=Date.now();

  let rows=await sql.unsafe('select state from private.quick_dna_games where lobby_id=$1::uuid',[lobby]);
  let g=rows.length?rows[0].state:null;
  if(!g)g=await initializeQuickGame(lobby,userId,serverReceived);
  quickPerspective(g,userId);

  const now=Date.now();
  const needsHydrate=String(g.termData?.termId||'')!==String(g.terms[g.term-1]||'');
  const transitionDue=shouldTick(g,now);

  // Hot path: one indexed JSONB read, no row lock, no write, no answer/content
  // queries. It is used only when the authoritative state cannot advance yet.
  // This is critical for solved teams: IDEA/VOTE for bot-only remaining teams
  // must collapse immediately instead of waiting 20 s + 10 s for deadlines.
  if(kind==='poll'&&!needsHydrate&&!transitionDue){
    return quickSnapshot(g,userId,serverReceived,Date.now(),null,command.knownRevision,kind);
  }

  const result=await sql.begin(async tx=>{
    const locked=await tx.unsafe('select state from private.quick_dna_games where lobby_id=$1::uuid for update',[lobby]);
    if(!locked.length)throw new Error('Shared DNA state unavailable');
    const current=locked[0].state;
    quickPerspective(current,userId);

    const beforeRevision=Number(current.revision||0);
    const beforeTerm=String(current.terms[current.term-1]||'');
    let hydrated=await hydrateQuickTerm(current,tx);
    const answers=Array.isArray(current.termData?.answers)?current.termData.answers:[];
    const grade=answer=>answerMatchesCandidates(answer,answers);
    const resolveIdea=idea=>ideaResolution(idea,answers);
    const at=Date.now();
    let actionError=null;

    if(kind==='poll'){
      // Another device may already have advanced while we waited for the lock.
      // Early-complete conditions count too; not just expired deadlines.
      if(shouldTick(current,at))actionError=act(current,userId,{kind:'poll'},at,grade,Math.random,resolveIdea);
    }else{
      actionError=act(current,userId,command,at,grade,Math.random,resolveIdea);
    }

    if(String(current.terms[current.term-1]||'')!==beforeTerm)hydrated=(await hydrateQuickTerm(current,tx))||hydrated;
    if(hydrated&&Number(current.revision||0)===beforeRevision)current.revision=beforeRevision+1;
    const changed=Number(current.revision||0)!==beforeRevision||hydrated;

    if(changed){
      await tx.unsafe('update private.quick_dna_games set state=$2::text::jsonb where lobby_id=$1::uuid',[lobby,JSON.stringify(current)]);
    }
    if(current.stage==='COMPLETE'&&g.stage!=='COMPLETE'){
      for(const p of current.players)await tx.unsafe(
        'insert into public.quick_game_results(lobby_id,user_id,score) values($1::uuid,$2::uuid,$3::integer) on conflict(lobby_id,user_id) do update set score=excluded.score',
        [lobby,p.id,current.teams[p.team].score]
      );
      await tx.unsafe('update public.quick_game_lobbies set bot_scores=$2::text::jsonb where lobby_id=$1::uuid',[lobby,JSON.stringify(scores(current,'score'))]);
    }
    return {g:current,actionError};
  });

  g=result.g;
  return quickSnapshot(g,userId,serverReceived,Date.now(),result.actionError,command.knownRevision,kind);
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  try{
    const body=await req.json().catch(()=>({}));const action=String(body?.action||"").toLowerCase();const userId=jwtSub(req);
    if(!userId)throw new Error("Authenticated user required");
    // Legacy browser-local Quick Games cannot advance or overwrite shared scores.
    if(action!=='quick_sync'&&(body.quickLobby||(body.state&&(await open(body.state)).quickLobby)))throw new Error('DNA_UPDATE_REQUIRED');
    const result=action==='quick_sync'?await quickSync(body,userId):action==="start"?await start(body,userId):action==="teammate_vote"?await teammateVote(body):action==="submit"?await submit(body,userId):action==="bots"?await bots(body):action==="advance"?await advance(body,userId):null;
    if(!result)return reply({error:"Unknown action"},400);
    return reply(result);
  }catch(err){console.error("dna-standalone",err);return reply({error:String(err?.message||err)},400)}
});
