from pathlib import Path
import json

VERSION='15.1.1'
public=Path('public')

p=public/'assets/js/00-version.js'
s=p.read_text(encoding='utf-8').replace("const VERSION='15.1.0';",f"const VERSION='{VERSION}';")
p.write_text(s,encoding='utf-8')

vp=public/'version.json'
data=json.loads(vp.read_text(encoding='utf-8'));data['version']=VERSION
vp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

idx=public/'index.html';h=idx.read_text(encoding='utf-8')
h=h.replace('SKIELSEN V15.1.0',f'SKIELSEN V{VERSION}')
h=h.replace('V15.1.0',f'V{VERSION}')
h=h.replace('?v=15.1.0',f'?v={VERSION}')
idx.write_text(h,encoding='utf-8')

for name in ['06-db-bootstrap.js','07-tournament-engine.js','08-inapp-runtime.js','10-buzzer-tournament-bridge.js']:
    p=public/'assets/js'/name;s=p.read_text(encoding='utf-8')
    s=s.replace("||'15.1.0'",f"||'{VERSION}'")
    p.write_text(s,encoding='utf-8')

p9=public/'assets/js/09-buzzer-time.js';s9=p9.read_text(encoding='utf-8')
old="let root=null,session=null,db=null,state=null,pollTimer=0,raf=0,busy=false;\nlet localStartPerf=null,lastStartToken=null,serverOffsetMs=0,revealEndPerf=0,engineResultIngested=false;"
new="let root=null,session=null,db=null,state=null,pollTimer=0,raf=0,busy=false;\nlet localStartPerf=null,lastStartToken=null,serverOffsetMs=0,revealEndPerf=0,engineResultIngested=false;\nlet testMode=false,testCtx=null,testEngine=null,testRevealAdvanced=false;"
if old not in s9: raise SystemExit('09 vars anchor missing')
s9=s9.replace(old,new,1)

old="function viewerLabel(){\n  const p=currentViewer();"
new="function viewerLabel(){\n  if(testMode){const c=state?.current||{};return `${String(c.team_name||teamFallback(c.identity_color)).toUpperCase()} · ${String(c.display_name||'PLAYER').toUpperCase()}`}\n  const p=currentViewer();"
if old not in s9: raise SystemExit('viewerLabel anchor missing')
s9=s9.replace(old,new,1)

old="    if(sec)sec.textContent=`${Math.ceil(left/1000)}s`;\n    if(bar)bar.style.width=`${Math.max(0,Math.min(100,left/REVEAL_MS*100))}%`;\n  }"
new="    if(sec)sec.textContent=`${Math.ceil(left/1000)}s`;\n    if(bar)bar.style.width=`${Math.max(0,Math.min(100,left/REVEAL_MS*100))}%`;\n    if(testMode&&left<=0&&!testRevealAdvanced){testRevealAdvanced=true;queueMicrotask(testAdvanceAfterReveal)}\n  }"
if old not in s9: raise SystemExit('frame reveal anchor missing')
s9=s9.replace(old,new,1)

old="async function handleAction(){\n  if(!db||!session||!state?.viewer?.is_current_player)return;"
new="async function handleAction(){\n  if(testMode){testHandleAction();return}\n  if(!db||!session||!state?.viewer?.is_current_player)return;"
if old not in s9: raise SystemExit('handleAction anchor missing')
s9=s9.replace(old,new,1)

test_code=r'''
function testParticipant(pid){return (testEngine?.state?.participants||[]).find(p=>p.id===pid)||null}
function testActor(aid){return (testEngine?.state?.actors||[]).find(a=>a.id===aid)||null}
function testRoundOrder(){
  const ids=testCtx?.participantIds||[];if(!ids.length)return[];
  const start=((Number(testCtx.round||1)-1)%ids.length+ids.length)%ids.length;
  return ids.slice(start).concat(ids.slice(0,start));
}
function testRelayIds(pid){
  const p=testParticipant(pid),ids=(p?.actorIds||[]).filter(Boolean);
  if(testCtx?.teamMode)return (ids.length?ids:[`${pid}-P1`,`${pid}-P2`]).slice(0,2);
  return (ids.length?ids:[`${pid}-P1`]).slice(0,1);
}
function testCurrentPid(){return testCtx?.order?.[testCtx.participantPos]||null}
function testCurrentActorId(){return testRelayIds(testCurrentPid())[testCtx?.relayIndex||0]||null}
function testCurrentName(){
  const pid=testCurrentPid(),aid=testCurrentActorId(),a=testActor(aid),p=testParticipant(pid);
  if(a?.name)return a.name;
  const relay=(testCtx?.relayIndex||0)+1;
  return testCtx?.teamMode?`${p?.name||'TEAM'} · P${relay}`:(p?.name||'PLAYER');
}
function testPickTarget(){
  const rules=testCtx?.game?.rules_json||{},team=testCtx?.teamMode;
  const range=team?(rules.teamTargetSeconds||{}):(rules.singleTargetSeconds||{});
  const min=Number(range.min??(team?6:3)),max=Number(range.max??(team?15:12));
  let n=min,tries=0;
  do{n=Math.floor(Math.random()*(max-min+1))+min;tries++}while((testCtx.targets||[]).slice(-2).includes(n)&&tries<40);
  testCtx.targets.push(n);return n;
}
function testBuildPlayState(phase='READY'){
  const pid=testCurrentPid(),p=testParticipant(pid)||{},relayIds=testRelayIds(pid),aid=testCurrentActorId();
  const liveStarted=phase==='RUNNING'?new Date().toISOString():null;
  state={
    phase,round:testCtx.round,round_count:testCtx.roundCount,target_seconds:testCtx.target,
    current:{participant_id:pid,display_name:testCurrentName(),identity_color:p.color,team_name:p.name||teamFallback(p.color),relay_index:(testCtx.relayIndex||0)+1,relay_count:relayIds.length,live_started_at:liveStarted},
    viewer:{member_id:aid,is_current_player:true,is_current_team:true},reveal:null,result:null
  };
}
function testPrepareRound(){
  testCtx.order=testRoundOrder();testCtx.participantPos=0;testCtx.relayIndex=0;testCtx.roundResults={};
  testCtx.target=testPickTarget();testRevealAdvanced=false;testBuildPlayState('READY');render();
}
function testRow(pid){
  const p=testParticipant(pid)||{},r=testCtx.roundResults[pid]||{splits:[]},splits=r.splits||[];
  const split1=Number(splits[0]||0),split2=testCtx.teamMode?Number(splits[1]||0):null,total=split1+(split2||0);
  return {participant_id:pid,team_name:p.name||teamFallback(p.color),identity_color:p.color,split1_ms:split1,split2_ms:split2,total_ms:total,deviation_ms:Math.abs(total-testCtx.target*1000)};
}
function testStartReveal(){
  const rows=testCtx.participantIds.map(testRow).sort((a,b)=>a.deviation_ms-b.deviation_ms||String(a.team_name).localeCompare(String(b.team_name),'de'));
  const snapshot={round:testCtx.round,target_seconds:testCtx.target,rows:rows.map(r=>({...r}))};
  testCtx.history.push(snapshot);testRevealAdvanced=false;
  state={phase:'REVEAL',round:testCtx.round,round_count:testCtx.roundCount,target_seconds:testCtx.target,current:state?.current||{},viewer:state?.viewer||{},reveal:snapshot,reveal_remaining_ms:REVEAL_MS,result:null};
  render();
}
function testAdvanceAfterReveal(){
  if(!testMode||!testCtx)return;
  if(testCtx.round<testCtx.roundCount){testCtx.round++;testPrepareRound();return}
  testFinalize();
}
function testFinalize(){
  const rows=testCtx.participantIds.map(pid=>{
    const p=testParticipant(pid)||{};
    const deviations=testCtx.history.map(h=>Number((h.rows||[]).find(r=>r.participant_id===pid)?.deviation_ms||0));
    return {participant_id:pid,team_name:p.name||teamFallback(p.color),identity_color:p.color,total_deviation_ms:deviations.reduce((a,b)=>a+b,0),round_deviations_ms:deviations,vector:[...deviations].sort((a,b)=>a-b),draw:Math.random()};
  });
  rows.sort((a,b)=>{
    if(a.total_deviation_ms!==b.total_deviation_ms)return a.total_deviation_ms-b.total_deviation_ms;
    for(let i=0;i<Math.max(a.vector.length,b.vector.length);i++){const d=Number(a.vector[i]||0)-Number(b.vector[i]||0);if(d)return d}
    return a.draw-b.draw;
  });
  const standings=rows.map((r,i)=>({participant_id:r.participant_id,team_name:r.team_name,identity_color:r.identity_color,total_deviation_ms:r.total_deviation_ms,round_deviations_ms:r.round_deviations_ms,placement:i+1}));
  const result={game_key:'buzzer_time_stoppen',standings,history:testCtx.history.map(h=>({round:h.round,target_seconds:h.target_seconds,rows:h.rows.map(r=>({...r}))})),finalized_at:new Date().toISOString(),tiebreak:'TOTAL_DEVIATION_THEN_BEST_ROUND_VECTOR_THEN_RANDOM_DRAW',test_mode:true};
  state={phase:'COMPLETE',round:testCtx.roundCount,round_count:testCtx.roundCount,target_seconds:testCtx.target,current:state?.current||{},viewer:state?.viewer||{},reveal:null,result};
  render();
  if(!engineResultIngested){
    try{engineResultIngested=!!testEngine?.ingestInAppGameResult?.(testCtx.tournamentGameId,result)}catch(err){console.warn('Buzzer test tournament sync',err)}
  }
}
function testHandleAction(){
  if(!testMode||!testCtx||!state?.viewer?.is_current_player)return;
  const btn=document.getElementById('bztAction');if(btn)btn.disabled=true;
  if(state.phase==='READY'){
    localStartPerf=performance.now();testBuildPlayState('RUNNING');render();return;
  }
  if(state.phase!=='RUNNING'||localStartPerf==null)return;
  const elapsed=Math.max(1,Math.round(performance.now()-localStartPerf));localStartPerf=null;
  const pid=testCurrentPid();if(!testCtx.roundResults[pid])testCtx.roundResults[pid]={splits:[]};
  testCtx.roundResults[pid].splits[testCtx.relayIndex]=elapsed;
  const relayCount=testRelayIds(pid).length;
  if(testCtx.relayIndex+1<relayCount){testCtx.relayIndex++;testBuildPlayState('READY');render();return}
  testCtx.relayIndex=0;testCtx.participantPos++;
  if(testCtx.participantPos<testCtx.order.length){testBuildPlayState('READY');render();return}
  testStartReveal();
}
function mountTest(host,runtime,game,engine){
  if(!host||!runtime||!game||!engine)return;
  const key=String(game.tournament_game_id||game.game_id||'buzzer-test');
  const changed=!testMode||root!==host||testCtx?.key!==key;
  root=host;db=null;session={session_id:`test-${key}`,tournament_game_id:game.tournament_game_id||null};testMode=true;testEngine=engine;
  clearInterval(pollTimer);cancelAnimationFrame(raf);
  if(!changed){render();return}
  const st=engine.state||{},m=(game.matches||[])[game.matchIndex||0]||(game.matches||[])[0];
  let participantIds=(m?.participantIds||[]).filter(Boolean);
  if(!participantIds.length)participantIds=(st.participants||[]).map(p=>p.id);
  testCtx={key,game,tournamentGameId:game.tournament_game_id||null,participantIds:[...participantIds],teamMode:String(runtime.mode||'').toUpperCase()==='TEAM',round:1,roundCount:Number(game.rules_json?.rounds||5),participantPos:0,relayIndex:0,target:null,targets:[],order:[],roundResults:{},history:[]};
  state=null;localStartPerf=null;lastStartToken=null;engineResultIngested=false;testRevealAdvanced=false;
  testPrepareRound();
}
'''
anchor="function mount(host,s,client){"
if anchor not in s9: raise SystemExit('mount anchor missing')
s9=s9.replace(anchor,test_code+'\n'+anchor,1)

old="function unmount(){\n  clearInterval(pollTimer);cancelAnimationFrame(raf);"
new="function unmount(){\n  clearInterval(pollTimer);cancelAnimationFrame(raf);\n  testMode=false;testCtx=null;testEngine=null;testRevealAdvanced=false;"
if old not in s9: raise SystemExit('unmount anchor missing')
s9=s9.replace(old,new,1)
old="window.skielsenBuzzerTime={mount,updateSession,unmount,poll};"
new="window.skielsenBuzzerTime={mount,mountTest,updateSession,unmount,poll};"
if old not in s9: raise SystemExit('export anchor missing')
s9=s9.replace(old,new,1)
p9.write_text(s9,encoding='utf-8')

p8=public/'assets/js/08-inapp-runtime.js';s8=p8.read_text(encoding='utf-8')
anchor="function renderPlayerSession(s){"
test_renderer=r'''function renderBuzzerTest(g){
  const layer=ensureLayer(),host=document.getElementById('v15InAppPlayerContent');
  layer.hidden=false;layer.classList.add('buzzer-mode');
  const sessionKey=`test-${g.tournament_game_id||g.game_id||'buzzer'}`;
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
'''
if anchor not in s8: raise SystemExit('08 renderPlayerSession anchor missing')
s8=s8.replace(anchor,test_renderer+'\n'+anchor,1)

old="  try{\n    const r=await db.rpc('get_my_active_in_app_game',{p_tournament_id:rt.tournament_id});"
new="  try{\n    const testGame=currentGame();\n    if(rt?.test_mode&&isBuzzerGame(testGame)&&buzzerGameIsLive(testGame)){playerSession=null;renderBuzzerTest(testGame);return}\n    const r=await db.rpc('get_my_active_in_app_game',{p_tournament_id:rt.tournament_id});"
if old not in s8: raise SystemExit('08 pollPlayer anchor missing')
s8=s8.replace(old,new,1)

old="  if(isBuzzerGame(g)&&buzzerGameIsLive(g))await ensureBuzzerLifecycle(g);"
new="  if(isBuzzerGame(g)&&buzzerGameIsLive(g)&&!rt?.test_mode)await ensureBuzzerLifecycle(g);"
if old not in s8: raise SystemExit('08 lifecycle anchor missing')
s8=s8.replace(old,new,1)
p8.write_text(s8,encoding='utf-8')
