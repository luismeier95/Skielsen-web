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
    assert.ok([6,7,8].includes(cell));
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
