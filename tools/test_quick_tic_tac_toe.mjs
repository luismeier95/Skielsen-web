import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const host='00000000-0000-4000-8000-000000000001',guest='00000000-0000-4000-8000-000000000002',third='00000000-0000-4000-8000-000000000003';
const call=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value;
const login=uid=>db.query("select set_config('test.uid',$1,false)",[uid]);
const sql=async p=>db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
const create=()=>call("select public.create_quick_game_lobby('tic_tac_toe') value");
const lobby=id=>call('select public.get_quick_game_lobby($1) value',[id]);
const start=id=>call('select public.start_quick_game_lobby($1) value',[id]);
const state=id=>call('select public.get_quick_tic_tac_toe_state($1) value',[id]);
before(async()=>{
 await sql('./tests/tic_tac_toe_fixture.sql');
 await sql('../supabase/rollback/tic_tac_toe_rules_v3.sql');
 await sql('../supabase/migrations/20260926213328_tic_tac_toe_rules_v3.sql');
 await sql('./tests/quick_tic_tac_toe_fixture.sql');
 await sql('./tests/quick_lobby_rpc_baseline.sql');
 await sql('../supabase/migrations/20260927085749_quick_tic_tac_toe_sessions.sql');
 await sql('../supabase/migrations/20260927090429_quick_tic_tac_toe_play.sql');
});
after(()=>db.close());
test('SOLO lobby capacity, membership, host rights and roster lock',async()=>{
 await login(host);const l=await create();assert.equal(l.max_human_players,2);
 await assert.rejects(start(l.lobby_id),/FILL_REMAINING/);
 await login(guest);
 await call('select public.join_quick_game_lobby($1) value',[l.join_code]);
 await assert.rejects(start(l.lobby_id),/HOST_OPEN/);
 await assert.rejects(call("select public.set_quick_game_seat($1,3::smallint) value",[l.lobby_id]),/INVALID_SEAT/);
 await login(third);
 await assert.rejects(call('select public.join_quick_game_lobby($1) value',[l.join_code]),/LOBBY_FULL/);
 await assert.rejects(state(l.lobby_id),/LOBBY_FORBIDDEN/);
 await login(host);await start(l.lobby_id);
 const s=await state(l.lobby_id);
 assert.equal(s.players.length,2);assert.equal(s.phase,'DIFFICULTY');assert.equal(s.rules_version,3);
 assert.equal(s.players.filter(p=>p.is_bot).length,0);
 assert.equal(new Set(s.players.map(p=>p.participant_id)).size,2);
 assert.equal(s.viewer.is_admin,true);
 await start(l.lobby_id);
 assert.deepEqual((await state(l.lobby_id)).players,s.players,'start retries preserve virtual IDs');
 await assert.rejects(call("select public.set_quick_tic_tac_toe_format($1,'TEAM') value",[l.lobby_id]),/HOST_OPEN/);
 await assert.rejects(call("select public.set_quick_game_seat($1,2::smallint) value",[l.lobby_id]),/OPEN_LOBBY/);
 assert.match((await lobby(l.lobby_id)).launch_path,/quick-games\/tic-tac-toe/);
 assert.equal(await call('select count(*)::int value from public.in_app_game_sessions'),0);
 assert.equal(await call('select count(*)::int value from public.tournaments'),0);
});
test('TEAM seats and bots map to two participants; occupied seats cannot be discarded',async()=>{
 await login(host);let l=await create();
 l=await call("select public.set_quick_tic_tac_toe_format($1,'TEAM') value",[l.lobby_id]);
 assert.equal(l.max_human_players,4);
 await login(guest);await call('select public.join_quick_game_lobby($1) value',[l.join_code]);
 await call("select public.set_quick_game_seat($1,4::smallint) value",[l.lobby_id]);
 await login(host);
 await assert.rejects(call("select public.set_quick_tic_tac_toe_format($1,'SOLO') value",[l.lobby_id]),/OCCUPIED_SEATS/);
 await call('select public.fill_quick_game_lobby_bots($1) value',[l.lobby_id]);await start(l.lobby_id);
 const s=await state(l.lobby_id);
 assert.equal(s.players.length,4);assert.equal(s.players.filter(p=>p.is_bot).length,2);
 assert.equal(s.players[0].participant_id,s.players[1].participant_id);
 assert.equal(s.players[2].participant_id,s.players[3].participant_id);
 assert.notEqual(s.players[0].participant_id,s.players[2].participant_id);
 assert.ok(s.players.filter(p=>p.is_bot).every(p=>p.status==='READY'));
 for(const seconds of [0,3,5,7]){
   const b=await call('select private.quick_tic_tac_toe_new_duel($1,$2,$3,$4) value',
     [s.players,s.players[0].tournament_member_id,s.players[2].tournament_member_id,seconds]);
   assert.equal(b.rules_version,3);assert.equal(b.round_number,1);
   assert.equal(b.turn_seconds,seconds);assert.equal(b.turn_deadline_at,null);
   assert.equal(b.transition.kind,'START');assert.deepEqual(b.round_results,[]);
 }
 await assert.rejects(call('select private.quick_tic_tac_toe_new_duel($1,$2,$3,0) value',
   [s.players,s.players[0].tournament_member_id,s.players[1].tournament_member_id]),/INVALID_DUEL_ACTORS/);
});
test('existing DNA and Minority lobby capacities and routes remain available',async()=>{
 await login(host);
 for(const [game,capacity,path] of [['dna',8,'/dna-test/'],['minority',4,'/minority-test/']]){
   const l=await call('select public.create_quick_game_lobby($1) value',[game]);
   assert.equal(l.max_human_players,capacity);
   await call('select public.fill_quick_game_lobby_bots($1) value',[l.lobby_id]);
   const launched=await start(l.lobby_id);assert.ok(launched.launch_path.startsWith(path));
   assert.equal(await call('select count(*)::int value from private.quick_tic_tac_toe_games where lobby_id=$1',[l.lobby_id]),0);
 }
});
test('anonymous access and direct table access are denied',async()=>{
 await login('');
 await assert.rejects(create(),/AUTH_REQUIRED/);
 assert.equal(await call("select has_table_privilege('authenticated','private.quick_tic_tac_toe_games','SELECT') value"),false);
 assert.equal(await call("select has_function_privilege('anon','public.get_quick_tic_tac_toe_state(uuid)','EXECUTE') value"),false);
 assert.equal(await call("select has_function_privilege('authenticated','private.quick_tic_tac_toe_prepare(uuid)','EXECUTE') value"),false);
});

const configure=(id,mode='SOLO',variant='NORMAL',seconds=0)=>call(
 'select public.configure_quick_tic_tac_toe($1,$2,$3,$4) value',[id,mode,variant,seconds]);
const ready=id=>call('select public.ready_quick_tic_tac_toe($1) value',[id]);
const play=id=>call('select public.start_quick_tic_tac_toe($1) value',[id]);
const pick=(id,member,selection='MATCH')=>call('select public.select_quick_tic_tac_toe_player($1,$2,$3) value',[id,member,selection]);
const move=(id,b,cell,duel='main',action=randomUUID())=>call(
 'select public.submit_quick_tic_tac_toe_move($1,$2,$3,$4,$5,$6) value',
 [id,cell,duel,b.round_number,b.board_move_no,action]);
async function newSession(mode='SOLO',humans=2){
 await login(host);const l=await create();
 if(mode!=='SOLO')await call("select public.set_quick_tic_tac_toe_format($1,'TEAM') value",[l.lobby_id]);
 for(const uid of [guest,third,'00000000-0000-4000-8000-000000000004'].slice(0,humans-1)){
   await login(uid);await call('select public.join_quick_game_lobby($1) value',[l.join_code]);
 }
 await login(host);await call('select public.fill_quick_game_lobby_bots($1) value',[l.lobby_id]);
 await start(l.lobby_id);return l.lobby_id;
}
async function allReady(id){
 const s=await state(id);
 for(const p of s.players.filter(p=>!p.is_bot)){await login(p.user_id);await ready(id);}
 await login(host);return play(id);
}
// Advance persisted test timestamps; never sleep or replace the production clock.
async function expireOverlay(id,path=['board_state']){
 await db.query(`update private.quick_tic_tac_toe_games set state_json=jsonb_set(state_json,$2,
   to_jsonb((clock_timestamp()-interval '10 seconds')::text)) where lobby_id=$1`,
 [id,[...path,'transition','ends_at']]);
 return state(id);
}
async function completeFixtureDuel(id,path,winner){
 // The original 22 engine tests exercise legal boards; this fixture drives the
 // real round/point engine to isolate Quick-session completion/decider routing.
 const g=await call('select state_json value from private.quick_tic_tac_toe_games where lobby_id=$1',[id]);
 let b=path.reduce((s,k)=>s[k],g);
 for(let i=0;i<8&&b.status!=='COMPLETE';i++){
   b=await call("select private.tic_tac_toe_finish_round($1,$2,'[0,1,2]') value",[b,winner]);
   b.transition.ends_at='2000-01-01T00:00:00Z';
   b=await call('select private.tic_tac_toe_advance_board($1) value',[b]);
 }
 assert.equal(b.status,'COMPLETE');
 await db.query('update private.quick_tic_tac_toe_games set state_json=jsonb_set(state_json,$2,$3) where lobby_id=$1',[id,path,b]);
 return state(id);
}

test('settings permissions, valid timers and READY invalidation before locked start',async()=>{
 const id=await newSession();
 await assert.rejects(ready(id),/SETUP_INCOMPLETE/);
 await login(guest);await assert.rejects(configure(id),/HOST_REQUIRED/);
 await login(third);await assert.rejects(ready(id),/LOBBY_FORBIDDEN/);
 await login(host);
 for(const seconds of [0,3,5,7])assert.equal((await configure(id,'SOLO','NORMAL',seconds)).turn_seconds,seconds);
 await assert.rejects(configure(id,'SOLO','NORMAL',4),/INVALID_TIMER/);
 await assert.rejects(configure(id,'ALTERNATING'),/INVALID_TEAM_MODE/);
 await assert.rejects(configure(id,'SOLO','UNKNOWN'),/INVALID_VARIANT/);
 await ready(id);await assert.rejects(play(id),/ALL_PLAYERS_READY_REQUIRED/);
 await login(guest);await ready(id);await assert.rejects(play(id),/HOST_REQUIRED/);
 await login(host);let s=await configure(id,'SOLO','DISAPPEAR',3);
 assert.ok(s.players.every(p=>p.status==='ASSIGNED'));
 s=await allReady(id);assert.equal(s.phase,'PLAYING');assert.equal(s.state.board_state.turn_seconds,3);
 assert.equal(s.state.board_state.turn_deadline_at,null);
 const before=s.state.board_state;assert.deepEqual((await play(id)).state.board_state,before);
 await assert.rejects(configure(id),/SETUP_CLOSED/);await assert.rejects(ready(id),/READY_CLOSED/);
});

test('SOLO legal full match, duplicate/stale moves, refresh and immutable Quick result',async()=>{
 const id=await newSession();await configure(id);let s=await allReady(id);
 const winner=s.players[0].participant_id;
 for(let round=0;round<6&&s.phase!=='COMPLETE';round++){
   s=await expireOverlay(id);let b=s.state.board_state;
   const cells=b.starting_participant_id===winner?[0,3,1,4,2]:[0,3,1,4,8,5];
   for(const cell of cells){
     const actor=s.players.find(p=>p.tournament_member_id===b.current_actor_member_id);
     await login(actor.user_id);const action=randomUUID();const old=b;
     s=await move(id,b,cell,'main',action);assert.equal(s.move_accepted,true);
     const duplicate=await move(id,old,cell,'main',action);assert.equal(duplicate.duplicate,true);
     assert.equal(duplicate.state.moves_total,s.state.moves_total);
     const reused=await move(id,old,(cell+1)%9,'main',action);assert.equal(reused.move_error,'ACTION_ID_REUSED');
     const stale=await move(id,old,cell);assert.equal(stale.move_accepted,false);
     b=s.state.board_state;
   }
   s=await expireOverlay(id);
 }
 assert.equal(s.phase,'COMPLETE');assert.equal(s.result.winner_participant_id,winner);
 assert.equal(s.result.rules_version,3);assert.equal(s.result.result_version,3);
 assert.deepEqual(s.result.standings.map(p=>p.rank),[1,2]);
 assert.ok(s.result.duel_results.main.round_results.length>=3);
 assert.equal('tournament_handoff' in s.result,false);
 const result=s.result;await login(host);assert.deepEqual((await state(id)).result,result);
 assert.equal(await call('select count(*)::int value from public.in_app_game_sessions'),0);
 assert.equal(await call('select count(*)::int value from public.quick_game_results where lobby_id=$1',[id]),0);
});

test('expired timer commits one weakest move even when the triggering client action is stale',async()=>{
 for(const seconds of [0,3,5,7]){
   const id=await newSession();await configure(id,'SOLO','NORMAL',seconds);let s=await allReady(id);
   s=await expireOverlay(id);let b=s.state.board_state;
   await login(s.players.find(p=>p.tournament_member_id===b.current_actor_member_id).user_id);
   s=await move(id,b,0);b=s.state.board_state;
   if(seconds===0){assert.equal(b.turn_deadline_at,null);assert.deepEqual((await state(id)).state.board_state,b);continue;}
   assert.ok(b.turn_deadline_at);
   await db.query(`update private.quick_tic_tac_toe_games set state_json=jsonb_set(state_json,
     '{board_state,turn_deadline_at}','"2000-01-01T00:00:00Z"') where lobby_id=$1`,[id]);
   await login(s.players.find(p=>p.tournament_member_id===b.current_actor_member_id).user_id);
   s=await move(id,b,4);assert.equal(s.move_accepted,false);
   assert.equal(s.state.board_state.board_move_no,2);
   assert.ok([1,3,5,7].includes(s.state.board_state.last_move),'weakest available edge selected');
   const refreshed=await state(id);assert.equal(refreshed.state.board_state.board_move_no,2);
   assert.equal(refreshed.state.board_state.turn_deadline_at,s.state.board_state.turn_deadline_at);
 }
});

test('ALTERNATING rotates human/bot actors; bot pacing survives repeated polls',async()=>{
 const id=await newSession('ALTERNATING',1);await configure(id,'ALTERNATING','DISAPPEAR',0);let s=await allReady(id);
 assert.equal(s.players.filter(p=>p.is_bot).length,3);
 s=await expireOverlay(id);let b=s.state.board_state;
 if(s.players.find(p=>p.tournament_member_id===b.current_actor_member_id).is_bot){
   await db.query(`update private.quick_tic_tac_toe_games set state_json=jsonb_set(state_json,
     '{board_state,bot_due_at}','"2000-01-01T00:00:00Z"') where lobby_id=$1`,[id]);
   s=await state(id);b=s.state.board_state;
 }
 const human=s.players.find(p=>!p.is_bot);
 assert.equal(b.current_actor_member_id,human.tournament_member_id);
 const cell=b.board.findIndex(v=>v===null);s=await move(id,b,cell);
 assert.notEqual(s.state.board_state.actors[human.participant_id],human.tournament_member_id);
 const count=s.state.moves_total;
 assert.equal((await state(id)).state.moves_total,count);
 await db.query(`update private.quick_tic_tac_toe_games set state_json=jsonb_set(state_json,
   '{board_state,bot_due_at}','"2000-01-01T00:00:00Z"') where lobby_id=$1`,[id]);
 s=await state(id);assert.equal(s.state.moves_total,count+1);
 assert.equal((await state(id)).state.moves_total,count+1);
 assert.equal(s.state.variant,'DISAPPEAR');
});

test('SELECTED_PLAYER permits own-team choice and auto-selects a bot-only opponent',async()=>{
 const id=await newSession('SELECTED_PLAYER',2);let s=await configure(id,'SELECTED_PLAYER');
 assert.equal(s.phase,'PLAYER_SELECTION');assert.equal(s.lineups.length,1);
 await assert.rejects(pick(id,s.players[2].tournament_member_id),/OWN_TEAM_PLAYER_REQUIRED/);
 await assert.rejects(ready(id),/SETUP_INCOMPLETE/);
 s=await pick(id,s.players[1].tournament_member_id);assert.equal(s.phase,'READY_TO_START');
 s=await allReady(id);const a=s.players[0].participant_id;
 assert.equal(s.state.board_state.actors[a],s.players[1].tournament_member_id);
 await assert.rejects(pick(id,s.players[0].tournament_member_id),/SELECTION_CLOSED/);
 s=await completeFixtureDuel(id,['board_state'],a);assert.equal(s.phase,'COMPLETE');
});

test('SIMULTANEOUS boards, 2:0 result and 1:1 full v3 decider with actor authorization',async()=>{
 for(const split of [false,true]){
   const id=await newSession('SIMULTANEOUS',4);await configure(id,'SIMULTANEOUS','NORMAL',7);let s=await allReady(id);
   assert.equal(s.phase,'PARALLEL_PLAYING');assert.equal(s.viewer.my_subgame,'1');
   await login(guest);assert.equal((await state(id)).viewer.my_subgame,'2');
   const a=s.players[0].participant_id,b=s.players[2].participant_id;
   s=await completeFixtureDuel(id,['subgames','1'],a);assert.equal(s.phase,'PARALLEL_PLAYING');
   s=await completeFixtureDuel(id,['subgames','2'],split?b:a);
   if(!split){assert.equal(s.phase,'COMPLETE');assert.equal(s.result.winner_participant_id,a);continue;}
   assert.equal(s.phase,'DECIDER_SELECTION');
   await login(host);s=await pick(id,s.players[1].tournament_member_id,'DECIDER');
   await assert.rejects(pick(id,s.players[2].tournament_member_id,'DECIDER'),/OWN_TEAM_PLAYER_REQUIRED/);
   await login(third);s=await pick(id,s.players[2].tournament_member_id,'DECIDER');
   assert.equal(s.phase,'DECIDER_PLAYING');assert.equal(s.state.decider.rules_version,3);
   assert.equal(s.state.decider.turn_seconds,7);assert.equal(s.state.decider.round_number,1);
   assert.equal(s.state.decider.turn_deadline_at,null);assert.equal(s.state.decider.transition.kind,'START');
   s=await expireOverlay(id,['decider']);
   await login(host);assert.equal((await move(id,s.state.decider,0,'decider')).move_accepted,false);
   s=await completeFixtureDuel(id,['decider'],b);assert.equal(s.phase,'COMPLETE');
   assert.equal(s.result.winner_participant_id,b);assert.ok(s.result.duel_results.decider.round_results.length>=3);
   assert.equal(s.result.duel_results.subgames['1'].winner_participant_id,a);
 }
});

test('new RPC grants are restricted and all internal orchestration helpers stay private',async()=>{
 for(const signature of ['configure_quick_tic_tac_toe(uuid,text,text,integer)','select_quick_tic_tac_toe_player(uuid,uuid,text)',
   'ready_quick_tic_tac_toe(uuid,boolean)','start_quick_tic_tac_toe(uuid)','submit_quick_tic_tac_toe_move(uuid,integer,text,integer,integer,uuid)']){
   assert.equal(await call("select has_function_privilege('anon',$1,'EXECUTE') value",['public.'+signature]),false);
   assert.equal(await call("select has_function_privilege('authenticated',$1,'EXECUTE') value",['public.'+signature]),true);
 }
 for(const signature of ['quick_ttt_lock(uuid)','quick_ttt_bot_move(jsonb,text)','quick_ttt_bot_selections(jsonb,jsonb)',
   'quick_ttt_settle(uuid,jsonb)','quick_ttt_tick(uuid)','quick_ttt_view(uuid)']){
   assert.equal(await call("select has_function_privilege('authenticated',$1,'EXECUTE') value",['private.'+signature]),false);
 }
});

test('SIMULTANEOUS bot-only team selects its decider without waiting for a nonexistent client',async()=>{
 const id=await newSession('SIMULTANEOUS',1);await configure(id,'SIMULTANEOUS');let s=await allReady(id);
 const a=s.players[0].participant_id,b=s.players[2].participant_id;
 s=await completeFixtureDuel(id,['subgames','1'],a);
 s=await completeFixtureDuel(id,['subgames','2'],b);
 assert.equal(s.phase,'DECIDER_SELECTION');
 assert.equal(s.lineups.filter(l=>l.lineup_role==='DECIDER').length,1);
 s=await pick(id,s.players[0].tournament_member_id,'DECIDER');
 assert.equal(s.phase,'DECIDER_PLAYING');
 s=await completeFixtureDuel(id,['decider'],a);assert.equal(s.phase,'COMPLETE');
});

test('authenticated role can use guarded RPCs but cannot read private games or bypass membership',async()=>{
 const id=await newSession();
 await db.exec('set role authenticated');
 try{
   assert.equal((await state(id)).quick_game,true);
   await configure(id);
   await assert.rejects(db.query('select * from private.quick_tic_tac_toe_games'),/permission denied/);
   await login(third);await assert.rejects(state(id),/LOBBY_FORBIDDEN/);
 }finally{await db.exec('reset role');}
});
