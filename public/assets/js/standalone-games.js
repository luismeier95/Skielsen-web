(()=>{
'use strict';

const ROOT_ID='suiteGameRoot';
const menu=document.getElementById('suiteMenu');
const stage=document.getElementById('suiteStage');
const layer=document.getElementById('v15InAppLayer');
const query=new URLSearchParams(window.location.search);
const embedMode=query.get('embed')==='1';
const requestedGame=String(query.get('game')||'');
let currentGame=null;
let activeMock=null;

const PLAYERS=[
  {id:'p-red',member_id:'m-red',name:'DJEELOI',display_name:'DJEELOI',color:'RED',identity_color:'RED',actorIds:['a-red']},
  {id:'p-blue',member_id:'m-blue',name:'SOFYA',display_name:'SOFYA',color:'BLUE',identity_color:'BLUE',actorIds:['a-blue']},
  {id:'p-green',member_id:'m-green',name:'HANNES',display_name:'HANNES',color:'GREEN',identity_color:'GREEN',actorIds:['a-green']},
  {id:'p-yellow',member_id:'m-yellow',name:'PIA',display_name:'PIA',color:'YELLOW',identity_color:'YELLOW',actorIds:['a-yellow']}
];
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const nowIso=()=>new Date().toISOString();

function root(){
  return document.getElementById(ROOT_ID);
}
function unmountAll(){
  try{window.skielsenBuzzerTime?.unmount?.()}catch(_){}
  try{window.skielsenMoreLess?.unmount?.()}catch(_){}
  try{window.skielsenWordChain?.unmount?.()}catch(_){}
  activeMock=null;
  layer.classList.remove('buzzer-mode','word-chain-mode');
  const r=root();if(r){r.id=ROOT_ID;r.innerHTML=''}
}
function showMenu(){
  unmountAll();
  currentGame=null;
  stage.hidden=true;
  menu.hidden=false;
  window.scrollTo({top:0,behavior:'auto'});
  return true;
}
function prepareRoot(id){
  const r=root();
  r.id=id;
  r.innerHTML='';
  return r;
}
function restoreRootId(){
  const el=document.getElementById('v15MoreLessRoot')||document.getElementById('v15WordChainRoot')||document.getElementById('v15BuzzerStandaloneRoot');
  if(el)el.id=ROOT_ID;
}
function beforeSwitch(){
  try{window.skielsenBuzzerTime?.unmount?.()}catch(_){}
  try{window.skielsenMoreLess?.unmount?.()}catch(_){}
  try{window.skielsenWordChain?.unmount?.()}catch(_){}
  restoreRootId();
  layer.classList.remove('buzzer-mode','word-chain-mode');
}

window.skielsenV15={
  runtime:{is_admin:true},
  ingestInAppGameResult(){return true}
};
window.skielsenInApp={
  minimize(){return embedMode?true:showMenu()},
  finishAndExit(){return true}
};

/* ---------------- BUZZER ---------------- */
function startBuzzer(){
  const host=prepareRoot('v15BuzzerStandaloneRoot');
  const participants=PLAYERS.slice(0,2).map(p=>({id:p.id,name:p.name,color:p.color,actorIds:[...p.actorIds]}));
  const actors=PLAYERS.slice(0,2).map(p=>({id:p.actorIds[0],name:p.name}));
  const ids=participants.map(p=>p.id);
  const game={
    game_id:'game.buzzer.time_stoppen',
    tournament_game_id:'standalone-buzzer',
    name:'Buzzer Zeit Stoppen',
    rules_json:{rounds:5,singleTargetSeconds:{min:3,max:12}},
    matchIndex:0,
    matches:[{id:'buzzer-match',participantIds:ids,status:'LIVE'}]
  };
  const engine={state:{participants,actors}};
  window.skielsenBuzzerTime.mountTest(host,{mode:'SOLO'},game,engine);
}

/* ---------------- MEHR ODER WENIGER ---------------- */
const MOL_FACTS={
  HEIGHT:[
    ['FREIHEITSSTATUE',93],['KÖLNER DOM',157],['EIFFELTURM',330],['FERNSEHTURM BERLIN',368],['EMPIRE STATE BUILDING',381],['BURJ KHALIFA',828]
  ],
  POPULATION:[
    ['NIEDERLANDE',18.0],['POLEN',37.6],['SPANIEN',48.6],['ITALIEN',58.9],['FRANKREICH',68.0],['DEUTSCHLAND',83.5]
  ],
  AREA:[
    ['NIEDERLANDE',41865],['SCHWEIZ',41285],['PORTUGAL',92212],['DEUTSCHLAND',357588],['SPANIEN',505990],['FRANKREICH',551695]
  ],
  DISTANCE:[
    ['BERLIN – PRAG',280],['BERLIN – WARSCHAU',520],['BERLIN – WIEN',680],['BERLIN – PARIS',1050],['BERLIN – ROM',1180],['BERLIN – MADRID',1870]
  ],
  WIKIPEDIA_VIEWS:[
    ['EIFFELTURM',410000],['BRANDENBURGER TOR',530000],['TITANIC',780000],['MONA LISA',910000],['ALBERT EINSTEIN',1200000],['ZWEITER WELTKRIEG',1850000]
  ],
  LENGTH:[
    ['PANAMAKANAL',82],['SUEZKANAL',193],['ELBE',1094],['RHEIN',1233],['DONAU',2850],['NIL',6650]
  ]
};
const MOL_META={
  HEIGHT:['HÖHE','m'],POPULATION:['BEVÖLKERUNG','Mio. Einwohner'],AREA:['FLÄCHE','km²'],
  DISTANCE:['ENTFERNUNG','km'],WIKIPEDIA_VIEWS:['WIKIPEDIA-AUFRUFE','Aufrufe/Monat'],LENGTH:['LÄNGE','km']
};
function molDisplay(key,value){
  if(key==='POPULATION')return Number(value).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mio.';
  return Number(value).toLocaleString('de-DE')+' '+MOL_META[key][1];
}
function createMoreLessMock(){
  const ctx={tier:null,categoryNo:0,categoryCount:5,categoryKey:null,facts:[],factIndex:0,currentSeat:0,lastSeat:0,phase:'QUESTION',lastResult:null,result:null,
    players:PLAYERS.map(p=>({participant_id:p.id,member_id:p.member_id,display_name:p.display_name,identity_color:p.identity_color,active:true,category_wins:0}))
  };
  function pool(){
    const base=['HEIGHT','POPULATION','AREA','DISTANCE','WIKIPEDIA_VIEWS'];
    return ctx.tier==='HARDCORE'?[...base.slice(0,4),'LENGTH']:base;
  }
  function nextActive(from){
    for(let i=1;i<=ctx.players.length;i++){const n=(from+i)%ctx.players.length;if(ctx.players[n].active)return n}
    return from;
  }
  function setupCategory(){
    ctx.categoryNo++;
    ctx.categoryKey=pool()[(ctx.categoryNo-1)%pool().length];
    ctx.facts=[...MOL_FACTS[ctx.categoryKey]].sort(()=>Math.random()-.5);
    ctx.factIndex=0;
    ctx.players.forEach(p=>p.active=true);
    ctx.currentSeat=(ctx.categoryNo-1)%ctx.players.length;
    ctx.lastSeat=ctx.currentSeat;
    ctx.phase='QUESTION';ctx.lastResult=null;
  }
  function standingResult(){
    const rows=[...ctx.players].sort((a,b)=>b.category_wins-a.category_wins||a.display_name.localeCompare(b.display_name,'de'));
    return {game_key:'higher_lower',standings:rows.map((p,i)=>({participant_id:p.participant_id,placement:i+1,category_wins:p.category_wins})),finalized_at:nowIso(),test_mode:true};
  }
  function state(){
    if(ctx.result)return {phase:'COMPLETE',status:'FINISHED',tier:ctx.tier,category_no:ctx.categoryCount,category_count:ctx.categoryCount,players:clone(ctx.players),result:clone(ctx.result)};
    const ref=ctx.facts[ctx.factIndex%ctx.facts.length],cur=ctx.facts[(ctx.factIndex+1)%ctx.facts.length];
    const p=ctx.players[ctx.currentSeat];
    return {
      phase:ctx.phase,status:'ACTIVE',tier:ctx.tier,category_no:ctx.categoryNo,category_count:ctx.categoryCount,
      category:{category_key:ctx.categoryKey,display_name:MOL_META[ctx.categoryKey][0],unit:MOL_META[ctx.categoryKey][1]},
      players:clone(ctx.players),
      current_player:{participant_id:p.participant_id,display_name:p.display_name,member_name:p.display_name},
      viewer:{is_turn:ctx.phase==='QUESTION',member_id:p.member_id},
      reference:{label:ref[0],value:ref[1],display_value:molDisplay(ctx.categoryKey,ref[1]),reference_period:ctx.categoryKey==='WIKIPEDIA_VIEWS'?'2026-08':null},
      current:{label:cur[0],value:cur[1],display_value:molDisplay(ctx.categoryKey,cur[1]),reference_period:ctx.categoryKey==='WIKIPEDIA_VIEWS'?'2026-08':null},
      last_result:ctx.lastResult?clone(ctx.lastResult):null
    };
  }
  async function rpc(name,args){
    if(name==='set_higher_lower_tier'){
      ctx.tier=String(args?.p_tier||'NORMAL').toUpperCase();
      ctx.categoryNo=0;ctx.result=null;ctx.players.forEach(p=>p.category_wins=0);
      setupCategory();
      return {data:{ok:true},error:null};
    }
    if(name==='get_higher_lower_state')return {data:state(),error:null};
    if(name==='higher_lower_action'){
      const action=String(args?.p_action_type||'').toUpperCase();
      if(ctx.phase==='QUESTION'&&(action==='MORE'||action==='LESS')){
        const ref=ctx.facts[ctx.factIndex%ctx.facts.length],cur=ctx.facts[(ctx.factIndex+1)%ctx.facts.length];
        const correct=Number(cur[1])>Number(ref[1])?'MORE':'LESS';
        const p=ctx.players[ctx.currentSeat],ok=action===correct;
        if(!ok)p.active=false;
        ctx.lastSeat=ctx.currentSeat;
        ctx.lastResult={participant_id:p.participant_id,answer_member_id:p.member_id,ok,current_label:cur[0],current_display_value:molDisplay(ctx.categoryKey,cur[1]),correct_choice:correct,reference_label:ref[0]};
        ctx.phase='REVEAL';
        return {data:state(),error:null};
      }
      if(ctx.phase==='REVEAL'&&action==='CONTINUE'){
        const survivors=ctx.players.filter(p=>p.active);
        if(survivors.length===1){
          survivors[0].category_wins++;
          if(ctx.categoryNo>=ctx.categoryCount){
            ctx.result=standingResult();
            return {data:{...state(),result:clone(ctx.result)},error:null};
          }
          setupCategory();
          return {data:state(),error:null};
        }
        ctx.factIndex=(ctx.factIndex+1)%Math.max(1,ctx.facts.length-1);
        ctx.currentSeat=nextActive(ctx.lastSeat);
        ctx.phase='QUESTION';ctx.lastResult=null;
        return {data:state(),error:null};
      }
      return {data:state(),error:null};
    }
    return {data:null,error:new Error('UNKNOWN_STANDALONE_RPC '+name)};
  }
  return {rpc};
}
function startMoreLess(){
  const host=prepareRoot('v15MoreLessRoot');
  activeMock=createMoreLessMock();
  const session={session_id:'standalone-more-less',tournament_game_id:'standalone-more-less-game',public_state:{}};
  window.skielsenMoreLess.mount(host,session,activeMock);
}

/* ---------------- WORTKETTE ---------------- */
const WC_CHAIN=['HAUS','TÜR','SCHLOSS','GARTEN','ZAUN','PFOSTEN','LOCH','KARTE','SPIEL','PLATZ','REGEN'];
function createWordChainMock(){
  const startedAt=Date.now();
  const ctx={position:0,score:0,wrong:0,currentWrong:0,completed:false,completedAt:null,deadline:Date.now()+15000,opponentSchedule:null};
  const opponents=[
    {p:PLAYERS[1],score:-4,delay:1800},
    {p:PLAYERS[2],score:-6,delay:3600},
    {p:PLAYERS[3],score:-3,delay:5400}
  ];
  function target(){return WC_CHAIN[ctx.position+1]}
  function maybeFinishOpponents(){
    if(!ctx.completedAt||!ctx.opponentSchedule)return;
    const now=Date.now();
    opponents.forEach((o,i)=>{if(!o.completedAt&&now>=ctx.opponentSchedule[i])o.completedAt=ctx.opponentSchedule[i]});
  }
  function liveRows(){
    maybeFinishOpponents();
    const now=Date.now();
    const rows=[{
      p:PLAYERS[0],completed:ctx.completed,score:ctx.completed?ctx.score:null,started_at:new Date(startedAt).toISOString(),
      completed_at:ctx.completedAt?new Date(ctx.completedAt).toISOString():null,
      elapsed_ms:ctx.completedAt?ctx.completedAt-startedAt:now-startedAt
    },...opponents.map(o=>({
      p:o.p,completed:!!o.completedAt,score:o.completedAt?o.score:null,started_at:new Date(startedAt).toISOString(),
      completed_at:o.completedAt?new Date(o.completedAt).toISOString():null,
      elapsed_ms:o.completedAt?o.completedAt-startedAt:now-startedAt
    }))];
    rows.sort((a,b)=>{
      if(a.completed!==b.completed)return a.completed?-1:1;
      if(a.completed&&b.completed){
        if(a.score!==b.score)return b.score-a.score;
        return a.elapsed_ms-b.elapsed_ms;
      }
      return PLAYERS.indexOf(a.p)-PLAYERS.indexOf(b.p);
    });
    let rank=0;
    return rows.map(r=>({
      rank:r.completed?++rank:null,participant_id:r.p.id,tournament_member_id:r.p.member_id,display_name:r.p.display_name,identity_color:r.p.identity_color,
      started_at:r.started_at,completed_at:r.completed_at,completed:r.completed,score:r.score,minus_points:r.score==null?null:Math.abs(Math.min(r.score,0)),
      wrong_count:r.score==null?null:Math.abs(Math.min(r.score,0)),elapsed_ms:r.elapsed_ms
    }));
  }
  function tournamentResult(rows){
    const done=rows.filter(r=>r.completed).sort((a,b)=>Number(a.rank||999)-Number(b.rank||999));
    return {game_key:'word_chain',standings:done.map((r,i)=>({participant_id:r.participant_id,placement:i+1,score:r.score,minus_points:r.minus_points,duration_ms:r.elapsed_ms})),finalized_at:nowIso(),test_mode:true};
  }
  function state(extra={}){
    const rows=liveRows(),finished=rows.filter(r=>r.completed).length,total=rows.length;
    if(ctx.completed){
      const allDone=finished===total;
      return {run_id:'standalone-run',word_chain_session_id:'standalone-chain',completed:true,step:10,total_steps:10,score:ctx.score,wrong_count:ctx.wrong,current_wrong_count:ctx.currentWrong,
        occurrence_threshold:1,time_limit_seconds:15,deadline_at:null,server_now:nowIso(),solved_words:[...WC_CHAIN],full_chain:[...WC_CHAIN],
        finished_players:finished,total_players:total,waiting_for_others:!allDone,live_standings:rows,
        tournament_complete:allDone,tournament_result:allDone?tournamentResult(rows):null,...extra};
    }
    const t=target(),prefix=t.slice(0,Math.min(t.length,1+ctx.currentWrong));
    return {run_id:'standalone-run',word_chain_session_id:'standalone-chain',completed:false,step:ctx.position+1,total_steps:10,
      base_word:WC_CHAIN[ctx.position],base_noun:WC_CHAIN[ctx.position],revealed_prefix:prefix,score:ctx.score,wrong_count:ctx.wrong,current_wrong_count:ctx.currentWrong,
      occurrence_threshold:1,time_limit_seconds:15,deadline_at:new Date(ctx.deadline).toISOString(),server_now:nowIso(),
      solved_words:WC_CHAIN.slice(0,ctx.position+1),ignore_repeated_initial:false,finished_players:finished,total_players:total,waiting_for_others:false,live_standings:rows,...extra};
  }
  function advance(){
    ctx.position++;ctx.currentWrong=0;ctx.deadline=Date.now()+15000;
    if(ctx.position>=WC_CHAIN.length-1){
      ctx.completed=true;ctx.completedAt=Date.now();
      ctx.opponentSchedule=opponents.map(o=>ctx.completedAt+o.delay);
    }
  }
  async function rpc(name,args={}){
    if(name==='start_word_chain_tournament_player'||name==='get_word_chain_tournament_state')return {data:state(),error:null};
    if(name==='submit_word_chain_tournament'){
      if(ctx.completed)return {data:state(),error:null};
      const timeout=!!args.p_timeout,guess=String(args.p_guess||'').trim().toLocaleUpperCase('de-DE'),t=target();
      if(!timeout&&guess===t){
        const compound=WC_CHAIN[ctx.position]+t;
        advance();
        return {data:state({accepted_attempt:true,correct:true,compound}),error:null};
      }
      ctx.score--;ctx.wrong++;ctx.currentWrong++;
      const auto=ctx.currentWrong>=Math.max(1,t.length-1);
      if(auto)advance();else ctx.deadline=Date.now()+15000;
      return {data:state({accepted_attempt:true,correct:false,timeout,timeout_applied:timeout,auto_completed:auto}),error:null};
    }
    return {data:null,error:new Error('UNKNOWN_STANDALONE_RPC '+name)};
  }
  return {rpc};
}
function startWordChain(){
  layer.classList.add('word-chain-mode');
  const host=prepareRoot('v15WordChainRoot');
  activeMock=createWordChainMock();
  const session={session_id:'standalone-word-chain',tournament_game_id:'standalone-word-chain-game',public_state:{}};
  window.skielsenWordChain.mount(host,session,activeMock);
}

/* ---------------- LAUNCHER ---------------- */
function startGame(kind){
  beforeSwitch();
  currentGame=kind;
  menu.hidden=true;stage.hidden=false;
  if(kind==='buzzer')startBuzzer();
  else if(kind==='more-less')startMoreLess();
  else if(kind==='word-chain')startWordChain();
  window.scrollTo({top:0,behavior:'auto'});
}
document.querySelectorAll('[data-suite-game]').forEach(btn=>btn.addEventListener('click',()=>startGame(btn.dataset.suiteGame)));
document.getElementById('suiteBack').addEventListener('click',showMenu);
document.getElementById('suiteReset').addEventListener('click',()=>{if(currentGame)startGame(currentGame)});
document.addEventListener('keydown',e=>{if(!embedMode&&e.key==='Escape'&&!stage.hidden)showMenu()});
if(embedMode)document.body.classList.add('suite-embedded');
if(['buzzer','more-less','word-chain'].includes(requestedGame))queueMicrotask(()=>startGame(requestedGame));
})();
