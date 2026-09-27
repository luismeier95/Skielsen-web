import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
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
 assert.equal(s.players.length,2);assert.equal(s.phase,'SETUP');assert.equal(s.rules_version,3);
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
