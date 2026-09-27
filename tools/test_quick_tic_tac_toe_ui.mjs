// Actual Quick pages + production module + actual PostgreSQL RPCs in PGlite.
// No live accounts or database writes. Module paths point to existing runtimes.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const db=new PGlite();
for(const file of ['tools/tests/tic_tac_toe_fixture.sql','supabase/rollback/tic_tac_toe_rules_v3.sql',
 'supabase/migrations/20260926213328_tic_tac_toe_rules_v3.sql','tools/tests/quick_tic_tac_toe_fixture.sql',
 'tools/tests/quick_lobby_rpc_baseline.sql','supabase/migrations/20260927085749_quick_tic_tac_toe_sessions.sql',
 'supabase/migrations/20260927090429_quick_tic_tac_toe_play.sql']){
 await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
}
const uid='00000000-0000-4000-8000-000000000001';
await db.query("select set_config('test.uid',$1,false)",[uid]);
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=createServer(async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/Skielsen-web/,'');
  if(path.endsWith('/'))path+='index.html';
  const target=resolve(root,'.'+path);if(!target.startsWith(root))throw Error('path');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(target)]||'application/octet-stream');
  res.end(await readFile(target));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/Skielsen-web`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
try{
 for(const mode of ['SOLO','ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS']){
  const context=await browser.newContext({viewport:mode==='SOLO'?{width:320,height:568}:{width:1280,height:800}});
  await context.addInitScript(uid=>{
   localStorage.setItem('skielsen.native.supabase.session',JSON.stringify({access_token:'fixture',user:{id:uid}}));
   // Exercise the HTTP/LAN UUID fallback, even on localhost's secure context.
   Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
  },uid);
  const calls=[];
  await context.route('https://rlppuqjolkrwumrrjajq.supabase.co/rest/v1/rpc/*',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop();
   const args=route.request().postDataJSON();calls.push(name);
   assert.match(name,/^[a-z_]+$/);Object.keys(args).forEach(k=>assert.match(k,/^p_[a-z_]+$/));
   try{
    const keys=Object.keys(args);
    const q=`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) value`;
    const data=(await db.query(q,Object.values(args))).rows[0].value;
    await route.fulfill({json:data});
   }catch(err){await route.fulfill({status:400,json:{message:err.message}});}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/quick-games/');
  await page.locator('[data-game="tic_tac_toe"]').click();
  await page.locator('#qgLobby').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-seat]').count(),2);
  if(mode!=='SOLO'){
   await page.locator('[data-format="TEAM"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-seat]').length===4);
  }
  await page.locator('#qgFill').click();await page.locator('#qgStart').click();
  await page.waitForURL('**/tic-tac-toe/?quick_lobby=*');
  const id=new URL(page.url()).searchParams.get('quick_lobby');
  if(mode!=='SOLO')await page.locator(`[data-team-mode="${mode}"]`).click();
  if(mode==='SELECTED_PLAYER')await page.locator('[data-player-pick]').first().click();
  await page.locator('[data-save-settings]').click();
  await page.locator('[data-ready-toggle]').click();
  await page.locator('[data-start-match]:not(:disabled)').click();
  await page.locator('.tttp-game-v3').waitFor();
  assert.ok(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--theme-on-page').trim()),'host supplies complete theme tokens');
  await page.locator('[data-cell]:not(:disabled)').first().click({timeout:15000});
  await page.waitForFunction(()=>window.skielsenTicTacToe.state.state.moves_total>0);
  const metrics=await page.locator('.tttp-board').boundingBox();
  assert.ok(metrics.x>=0&&metrics.x+metrics.width<=page.viewportSize().width);
  await page.reload();await page.locator('.tttp-game-v3').waitFor();
  assert.ok(calls.includes('submit_quick_tic_tac_toe_move'));
  assert.ok(!calls.includes('submit_tic_tac_toe_move'));
  // Isolate result rendering; rule correctness is covered by the SQL suite.
  const g=(await db.query('select * from private.quick_tic_tac_toe_games where lobby_id=$1',[id])).rows[0];
  const ids=[...new Set(g.players.map(p=>p.participant_id))];
  const result={standings:ids.map((participant_id,i)=>({participant_id,rank:i+1})),duel_results:{main:g.state_json.board_state,subgames:g.state_json.subgames}};
  await db.query("update private.quick_tic_tac_toe_games set phase='COMPLETE',result_json=$2,revision=revision+1 where lobby_id=$1",[id,result]);
  await page.locator('[data-quick-exit]').waitFor();
  assert.equal(await page.locator('[aria-label="Spielranking"] .tttp-result-row').count(),2);
  assert.equal(await page.locator('.tttp-joker-card,.tttp-merge-card').count(),0);
  await page.locator('[data-quick-exit]').click();await page.waitForURL(base+'/quick-games/');
  console.log('PASS Quick page + SQL:',mode,'including base path, settings, READY, move, refresh, result and exit');
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await db.close();await new Promise(r=>server.close(r));}
