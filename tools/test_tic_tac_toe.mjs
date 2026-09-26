// PostgreSQL tests use a temporary PGlite installation, never a production database.
// npm install --prefix <temp-directory> @electric-sql/pglite@0.5.8
// PGLITE_MODULE=<temp-directory>/node_modules/@electric-sql/pglite/dist/index.js node --test tools/test_tic_tac_toe.mjs
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const MA='00000000-0000-4000-8000-000000000003', MB='00000000-0000-4000-8000-000000000004';
const call=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value;
before(async()=>{
  await db.exec(await readFile(new URL('./tests/tic_tac_toe_fixture.sql',import.meta.url),'utf8'));
  // Captured existing functions form the same baseline that production extends.
  await db.exec(await readFile(new URL('../supabase/rollback/tic_tac_toe_rules_v3.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260926213328_tic_tac_toe_rules_v3.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
const fresh=(seconds=0)=>call('select private.tic_tac_toe_new_board($1,$2,$3,$4,$1,$5) value',[A,B,MA,MB,seconds]);
const advance=b=>call('select private.tic_tac_toe_advance_board($1) value',[b]);
async function expire(b){
  if(b.transition)b.transition.ends_at=new Date(Date.now()-10000).toISOString();
  return advance(b);
}
const move=(b,cell,variant='NORMAL',alternating=false,order={},cursor={})=>call(
  'select private.tic_tac_toe_apply_move($1,$2,$3,$4,$5,$6,$7,$8,null) value',
  [b,b.current_turn_participant_id,b.current_actor_member_id,cell,variant,alternating,order,cursor]);
const finish=(b,winner)=>call('select private.tic_tac_toe_finish_round($1,$2,$3) value',[b,winner,[]]);

test('NORMAL: draw records a round, alternates starter, keeps first move untimed',async()=>{
  let b=await expire(await fresh(3));
  for(const cell of [0,1,2,4,3,5,7,6,8]) b=(await move(b,cell)).board_state;
  assert.equal(b.transition.kind,'TIE');
  assert.equal(b.round_results.length,1);
  assert.deepEqual(b.match_points,{[A]:0,[B]:0});
  b=await expire(b);
  assert.equal(b.round_number,2);
  assert.equal(b.starting_participant_id,B);
  assert.deepEqual(b.symbols,{[A]:'X',[B]:'O'});
  assert.equal(b.turn_deadline_at,null);
});
test('weighted wins and mathematical early clinch after round 3',async()=>{
  let b=await expire(await fresh());
  for(let r=1;r<=3;r++){
    b=await finish(b,A);
    if(r<3)b=await expire(b);
  }
  assert.equal(b.match_points[A],4);
  assert.equal(b.winner_participant_id,A);
  assert.equal(b.completion_reason,'EARLY_CLINCH');
  assert.equal((await expire(b)).status,'COMPLETE');
});
for(const [name,outcomes,winner] of [
  ['win + win',[A,A],A],['win + tie',[A,null],A],['tie + win',[null,A],A],
  ['split wins',[A,B],null],['tie + tie',[null,null],null]
])test('Overtime: '+name,async()=>{
  let b=await expire(await fresh());
  for(let r=1;r<=4;r++) b=await expire(await finish(b,null));
  assert.equal(b.round_number,5);
  b=await finish(b,outcomes[0]);
  assert.equal(b.winner_participant_id,null,'must play full 2-round block');
  b=await expire(b);
  b=await finish(b,outcomes[1]);
  assert.equal(b.winner_participant_id,winner);
  b=await expire(b);
  assert.equal(b.status,winner?'COMPLETE':'PLAYING');
  if(!winner)assert.equal(b.round_number,7);
});
for(const seconds of [0,3,5,7])test('Timer '+seconds+': first move untimed, then authoritative deadline',async()=>{
  let b=await fresh(seconds);
  assert.equal(b.turn_deadline_at,null);
  const same=await advance(b);
  assert.deepEqual(same,b,'refresh must not restart overlay');
  b=await expire(b);
  b=(await move(b,0)).board_state;
  if(seconds){
    assert.ok(Math.abs(Date.parse(b.turn_deadline_at)-Date.now()-seconds*1000)<300);
    assert.deepEqual(await advance(b),b,'refresh must not restart timer');
  }else assert.equal(b.turn_deadline_at,null);
});
test('DISAPPEAR removes oldest before checking win',async()=>{
  let b=await expire(await fresh());
  for(const c of [0,1,3,2,8,6,4])b=(await move(b,c,'DISAPPEAR')).board_state;
  assert.equal(b.board[0],null);
  assert.deepEqual(b.active_mark_order[A],[3,8,4]);
  assert.equal(b.round_results.length,0);
});
test('timeout policy avoids winning move when a losing move exists',async()=>{
  let b=await expire(await fresh());
  for(const c of [0,3,1,4])b=(await move(b,c)).board_state;
  for(let i=0;i<15;i++){
    const cell=await call('select private.tic_tac_toe_worst_move($1,$2) value',[b,'NORMAL']);
    assert.equal(cell,7);
  }
});
test('ALTERNATING: actor cursor persists through round transition',async()=>{
  let b=await expire(await fresh());
  const order={[A]:[MA,MB],[B]:[MB,MA]};
  let cursor={[A]:0,[B]:0};
  for(const c of [0,3,1,4,2]){
    const a=await move(b,c,'NORMAL',true,order,cursor);
    b=a.board_state;cursor=a.member_cursor;
  }
  b=await expire(b);
  assert.equal(b.current_actor_member_id,b.actors[B]);
  assert.equal(b.actors[A],MB);
});

const S='00000000-0000-4000-8000-000000000010',T='00000000-0000-4000-8000-000000000011',
 G='00000000-0000-4000-8000-000000000012',D='00000000-0000-4000-8000-000000000013',
 MA2='00000000-0000-4000-8000-000000000014',MB2='00000000-0000-4000-8000-000000000015';
async function login(uid=MA){await db.query("select set_config('test.uid',$1,false)",[uid]);}
const state=()=>call('select public.get_tic_tac_toe_state($1) value',[S]);
async function fixture(mode='SOLO',seconds=3){
  await db.exec(`truncate public.in_app_game_sessions,public.in_app_game_definitions,
    public.in_app_game_session_players,public.in_app_game_actions,public.tournament_members,
    public.in_app_team_lineups,public.in_app_team_mode_configs,public.tournaments,
    public.tournament_games,public.participants,public.teams,public.tournament_game_participants,
    public.tournament_game_representatives,public.scoring_placement_points,public.game_placements,
    public.tournament_game_results,private.test_handoff_calls;`);
  await db.query("insert into public.tournaments(tournament_id,creator_user_id,mode,scoring_profile_id) values($1,$2,$3,'scoring.skielsen.default')",[T,MA,mode==='SOLO'?'SOLO':'TEAM']);
  await db.query("insert into public.tournament_games(tournament_game_id,tournament_id,game_id,status) values($1,$2,'game.tictactoe.classic_disappear','ACTIVE')",[G,T]);
  await db.query("insert into public.in_app_game_definitions(game_definition_id,game_key) values($1,'tic_tac_toe')",[D]);
  await db.query("insert into public.in_app_game_sessions(session_id,tournament_id,tournament_game_id,game_definition_id,status,version,state_json,public_state_json) values($1,$2,$3,$4,'READY',1,'{}',$5)",[S,T,G,D,{tournament_mode:mode==='SOLO'?'SOLO':'TEAM'}]);
  await db.query("insert into public.participants(participant_id,tournament_id,identity_color,seed,status) values($1,$3,'RED',1,'ACTIVE'),($2,$3,'BLUE',2,'ACTIVE')",[A,B,T]);
  for(const [i,m,p] of [[1,MA,A],[2,MB,B],...(mode==='SOLO'?[]:[[3,MA2,A],[4,MB2,B]])]){
    await db.query("insert into public.tournament_members(tournament_member_id,tournament_id,user_id,display_name_snapshot) values($1,$2,$1,$3)",[m,T,'PLAYER '+i]);
    await db.query("insert into public.in_app_game_session_players(session_id,tournament_member_id,participant_id,seat,status) values($1,$2,$3,$4,'READY')",[S,m,p,i]);
  }
  await db.exec("insert into public.scoring_placement_points values('scoring.skielsen.default',1,5),('scoring.skielsen.default',2,4)");
  await login();
  if(mode!=='SOLO')await call('select public.set_tic_tac_toe_team_mode($1,$2) value',[S,mode]);
  if(mode==='SELECTED_PLAYER'){
    await call("select public.select_tic_tac_toe_player($1,$2,'MATCH') value",[S,MA2]);
    await login(MB);
    await call("select public.select_tic_tac_toe_player($1,$2,'MATCH') value",[S,MB2]);
    await login();
  }
  await call('select public.set_tic_tac_toe_timer($1,$2) value',[S,seconds]);
  await call("select public.set_tic_tac_toe_variant($1,'NORMAL') value",[S]);
  await call('select public.start_tic_tac_toe_match($1) value',[S]);
}
async function setBoard(path,b){
  await db.query('update public.in_app_game_sessions set state_json=jsonb_set(state_json,$1,$2) where session_id=$3',[path,b,S]);
}
async function winDuel(path,winner){
  let s=await state(),b=path.reduce((o,k)=>o[k],s.state);
  for(let i=0;i<3;i++){
    b=await finish(b,winner);
    b.transition.ends_at=new Date(Date.now()-10000).toISOString();
    await setBoard(path,b);
    s=await state();
    b=path.reduce((o,k)=>o[k],s.state);
  }
  return s;
}
for(const mode of ['SOLO','ALTERNATING','SELECTED_PLAYER']){
  test(mode+': real RPC start, ready gate preserved, result separates duel and tournament points',async()=>{
    await fixture(mode,7);
    const initial=await state(),b=initial.state.board_state;
    assert.equal(b.rules_version,3);
    assert.equal(b.turn_seconds,7);
    assert.equal(b.transition.kind,'START');
    if(mode==='SELECTED_PLAYER')assert.deepEqual(b.actors,{[A]:MA2,[B]:MB2});
    const end=await winDuel(['board_state'],A);
    assert.equal(end.status,'FINISHED');
    assert.equal(end.result.result_version,3);
    assert.equal(end.result.duel_results.main.round_results.length,3);
    assert.equal(end.result.tournament_handoff.finalized,true);
    assert.ok(end.result.match_points[A]>=4);
    assert.deepEqual((await db.query('select final_points from public.game_placements order by placement')).rows.map(r=>r.final_points),[5,4]);
    assert.deepEqual((await db.query('select kind from private.test_handoff_calls order by kind')).rows.map(r=>r.kind),['joker','ledger']);
  });
}
test('SIMULTANEOUS 1:1 selects a full v3 decider with the configured timer',async()=>{
  await fixture('SIMULTANEOUS',3);
  await winDuel(['subgames','1'],A);
  let s=await winDuel(['subgames','2'],B);
  assert.equal(s.phase,'DECIDER_SELECTION');
  await call("select public.select_tic_tac_toe_player($1,$2,'DECIDER') value",[S,MA2]);
  await login(MB);
  await call("select public.select_tic_tac_toe_player($1,$2,'DECIDER') value",[S,MB2]);
  s=await state();
  assert.equal(s.state.decider.turn_seconds,3);
  assert.equal(s.state.decider.round_number,1);
  assert.equal(s.state.decider.turn_deadline_at,null);
  s=await winDuel(['decider'],B);
  assert.equal(s.result.duel_results.decider.round_results.length,3);
  assert.equal(s.result.winner_participant_id,B);
  assert.equal(s.result.tournament_handoff.finalized,true);
});
test('SIMULTANEOUS 2:0 finalizes without decider',async()=>{
  await fixture('SIMULTANEOUS',0);
  await winDuel(['subgames','1'],A);
  const s=await winDuel(['subgames','2'],A);
  assert.equal(s.status,'FINISHED');
  assert.equal(s.result.completion_reason,'PARALLEL_2_0');
});
test('timeout auto-move persists once; stale requests cannot play or roll it back',async()=>{
  await fixture('SOLO',3);
  let b=await expire((await state()).state.board_state);
  await setBoard(['board_state'],b);
  await login(b.current_actor_member_id);
  const id='00000000-0000-4000-8000-000000000021';
  const first=await call('select public.submit_tic_tac_toe_move($1,0,$2,1,0) value',[S,id]);
  assert.equal(first.accepted,true);
  assert.equal((await call('select public.submit_tic_tac_toe_move($1,0,$2,1,0) value',[S,id])).idempotent_replay,true);
  b=(await state()).state.board_state;
  b.turn_deadline_at=new Date(Date.now()-1000).toISOString();
  await setBoard(['board_state'],b);
  await login(b.current_actor_member_id);
  const late=await call("select public.submit_tic_tac_toe_move($1,4,'00000000-0000-4000-8000-000000000022',1,1) value",[S]);
  assert.equal(late.accepted,false);
  const s=await state();
  assert.equal(s.state.board_state.board_move_no,2);
  assert.equal(s.state.board_state.last_move_source,'TIMEOUT');
  assert.equal(s.status,'ACTIVE');
  assert.deepEqual((await state()).state,s.state);
});
test('unauthorized settings and not-ready starts remain rejected',async()=>{
  await fixture('SOLO');
  await db.query("update public.in_app_game_sessions set status='WAITING_FOR_PLAYERS' where session_id=$1",[S]);
  await assert.rejects(call('select public.start_tic_tac_toe_match($1) value',[S]),/PLAYERS_NOT_READY/);
  await login(MB);
  await assert.rejects(call('select public.set_tic_tac_toe_timer($1,5) value',[S]),/ADMIN_REQUIRED/);
  await login();
  await assert.rejects(call('select public.set_tic_tac_toe_timer($1,4) value',[S]),/INVALID_TURN_SECONDS/);
});
test('session creation and catalog use rules v3 without the legacy fixed decider timer',async()=>{
  await fixture('SOLO');
  await db.exec('delete from public.in_app_game_sessions; delete from public.in_app_game_session_players');
  await db.query("update public.participants set participant_type='SOLO',solo_member_id=case when participant_id=$1 then $2::uuid else $3::uuid end",[A,MA,MB]);
  await db.exec('update public.in_app_game_definitions set is_active=true');
  const id=await call('select public.create_tic_tac_toe_match_session($1,$2,$3) value',[G,A,B]);
  const config=await call('select public_state_json value from public.in_app_game_sessions where session_id=$1',[id]);
  assert.equal(config.rules_version,3);
  assert.equal(config.tic_tac_toe_turn_seconds,0);
  assert.equal(config.decider_turn_seconds,undefined);
  const catalog=await call("select rules_json value from public.available_games where game_id='game.tictactoe.classic_disappear'");
  assert.equal(catalog.rulesVersion,3);
  assert.equal(catalog.teamPlay.decider.timeoutResult,undefined);
  assert.deepEqual(catalog.timer.options,[0,3,5,7]);
});
