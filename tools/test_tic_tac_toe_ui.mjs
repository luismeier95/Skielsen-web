// Browser regression tests mount the actual production module and styles.
// PLAYWRIGHT_MODULE must point to an installed playwright/index.mjs.
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const css=await Promise.all(['app.css','tournament-theme-runtime.css','tic-tac-toe-game.css'].map(p=>readFile(new URL('../public/assets/css/'+p,import.meta.url),'utf8')));
const script=await readFile(new URL('../public/assets/js/13-tic-tac-toe-game.js',import.meta.url),'utf8');
const failures=[];
const shots=join(tmpdir(),'skielsen-ttt-v3-screenshots');await mkdir(shots,{recursive:true});
const initial={
  session_id:'session',phase:'PLAYING',status:'ACTIVE',version:1,variant:'NORMAL',team_mode:'SOLO',turn_seconds:3,
  viewer:{tournament_member_id:'ma',participant_id:'a',is_admin:true},
  players:[{tournament_member_id:'ma',participant_id:'a',display_name:'ALICE',identity_color:'RED',seat:1,status:'READY'},
    {tournament_member_id:'mb',participant_id:'b',display_name:'BOB',identity_color:'BLUE',seat:2,status:'READY'}],
  state:{board_state:{rules_version:3,round_number:1,round_results:[],match_points:{a:0,b:0},
    board:Array(9).fill(null),board_move_no:0,active_mark_order:{a:[],b:[]},symbols:{a:'X',b:'O'},
    actors:{a:'ma',b:'mb'},starting_participant_id:'a',current_turn_participant_id:'a',
    current_actor_member_id:'ma',status:'PLAYING',turn_seconds:3,transition:null,turn_deadline_at:null}}
};
async function mount(page,width,height,dark=false){
  await page.setViewportSize({width,height});
  page.on('pageerror',err=>failures.push(err.message));
  await page.setContent('<!doctype html><html><body class="v15-tournament-active v15-inapp-fullscreen-open"><section id="v15InAppLayer"><main class="v15-inapp-shell"><div id="v15InAppPlayerContent"><div id="game"></div></div></main></section></body></html>');
  for(const content of css)await page.addStyleTag({content});
  await page.addStyleTag({content:`:root{--sk-header-height:48px;--theme-page:${dark?'#171717':'#f2f2f2'};--theme-on-page:${dark?'#fafafa':'#111'};--theme-surface:${dark?'#222':'#fff'};--theme-on-surface:${dark?'#fafafa':'#111'};--theme-surface-soft:${dark?'#333':'#eee'};--theme-on-surface-soft:${dark?'#fafafa':'#111'};--theme-muted:${dark?'#ccc':'#555'};--theme-border:#888;--theme-border-strong:#666;--theme-accent:#7560ef;--theme-surface-muted:#ccc;--core-red:#ff1717;--core-blue:#1515ff;--theme-header:#fff;--theme-on-header:#111}`});
  await page.evaluate(s=>{
    window.fixture=structuredClone(s);window.calls=[];window.testClosed=false;
    window.skielsenV15={startMatch:async()=>true,ingestInAppGameResult:()=>true};
    window.skielsenBuzzerBridge={
      getCanonicalPostgame:()=>({rows:[
        {display_name:'ALICE',identity_color:'RED',game_placement:1,old_rank:2,new_rank:1,old_points:2,added_points:5,new_points:7},
        {display_name:'BOB',identity_color:'BLUE',game_placement:2,old_rank:1,new_rank:2,old_points:3,added_points:4,new_points:7}
      ]}),
      completeCanonicalInAppPostgame:()=>{window.testClosed=true;return true;}
    };
    window.mockDb={rpc:async(name,args)=>{
      window.calls.push({name,args});
      if(name==='get_tic_tac_toe_state')return {data:{...structuredClone(window.fixture),server_now:new Date().toISOString()}};
      return {data:{accepted:true}};
    }};
  },initial);
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.skielsenTicTacToe.mount(document.getElementById('game'),{session_id:'session',tournament_game_id:'game'},window.mockDb));
  await page.locator('.tttp-game-v3').waitFor();
}
try{
  for(const [w,h] of [[320,568],[390,844],[720,900],[721,900],[1280,800],[844,390]]){
    const page=await browser.newPage();await mount(page,w,h,w===721);
    const metrics=await page.evaluate(()=>{
      const board=document.querySelector('.tttp-board'),round=document.querySelector('.tttp-round-display'),score=document.querySelector('.tttp-match-score');
      const header=document.querySelector('.tttp-config-bar');
      return {
        board:board.getBoundingClientRect().toJSON(),last:document.querySelector('.tttp-live-name').getBoundingClientRect().bottom,
        roundSize:getComputedStyle(round).fontSize,scoreSize:getComputedStyle(score).fontSize,
        widths:[...header.children].map(x=>x.getBoundingClientRect().width),
        small:[...document.querySelectorAll('#game *')].filter(x=>x.childNodes.length&&[...x.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(x).fontSize)<12).map(x=>x.className),
        gaps:[round.getBoundingClientRect().top-header.getBoundingClientRect().bottom,score.getBoundingClientRect().top-round.getBoundingClientRect().bottom,
          document.querySelector('.tttp-board-area').getBoundingClientRect().top-score.getBoundingClientRect().bottom]
      };
    });
    assert.ok(metrics.board.right<=w&&metrics.board.left>=0,JSON.stringify(metrics));
    assert.ok(metrics.last<=h,JSON.stringify(metrics));
    assert.equal(metrics.roundSize,metrics.scoreSize);
    assert.ok(Math.max(...metrics.widths)-Math.min(...metrics.widths)<1);
    assert.ok(Math.max(...metrics.gaps)-Math.min(...metrics.gaps)<1);
    assert.deepEqual(metrics.small,[]);
    await page.screenshot({path:join(shots,w+'x'+h+'.png')});
    await page.locator('[data-cell="0"]').click();
    const move=await page.evaluate(()=>window.calls.find(x=>x.name==='submit_tic_tac_toe_move'));
    assert.equal(move.args.p_expected_round,1);assert.equal(move.args.p_expected_move,0);
    await page.close();console.log('PASS viewport',w,h);
  }
  const page=await browser.newPage();await mount(page,390,844);
  for(const kind of ['START','WIN','TIE','OVERTIME']){
    await page.evaluate(kind=>{
      window.fixture.state.board_state.transition={kind,participant_id:'a',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+2000).toISOString()};
      window.fixture.version++;
    },kind);
    await page.locator('.tttp-overlay-card').waitFor();
    await page.waitForFunction(kind=>document.querySelector('.tttp-overlay-card')?.textContent.includes({START:'BEGINNT',WIN:'GEWINNT',TIE:'TIE',OVERTIME:'OVERTIME'}[kind]),kind);
    assert.equal(await page.locator('[data-cell]:enabled').count(),0);
  }
  const overlayEnd=await page.evaluate(()=>window.fixture.state.board_state.transition.ends_at);
  await page.evaluate(()=>window.skielsenTicTacToe.mount(document.getElementById('game'),{session_id:'session',tournament_game_id:'game'},window.mockDb));
  await page.locator('.tttp-overlay-card').waitFor();
  assert.equal(await page.evaluate(()=>window.skielsenTicTacToe.state.state.board_state.transition.ends_at),overlayEnd);
  await page.evaluate(()=>{
    window.fixture.state.board_state.transition=null;
    window.fixture.state.board_state.turn_deadline_at=new Date(Date.now()+3000).toISOString();
    window.fixture.state.board_state.board_move_no=1;
    window.fixture.version++;
  });
  await page.locator('.tttp-timer-bar:not(.is-passive)').waitFor();
  const before=Number(await page.locator('.tttp-timer-bar').getAttribute('aria-valuenow'));
  await page.evaluate(()=>window.skielsenTicTacToe.mount(document.getElementById('game'),{session_id:'session',tournament_game_id:'game'},window.mockDb));
  await page.locator('.tttp-timer-bar:not(.is-passive)').waitFor();
  const after=Number(await page.locator('.tttp-timer-bar').getAttribute('aria-valuenow'));
  assert.ok(after<=before+.1,'remount must not restart server deadline');
  const other=await browser.newPage();await mount(other,1280,800);
  const shared=await page.evaluate(()=>structuredClone(window.fixture));
  await other.evaluate(s=>{
    // Simulate a second device whose wall clock is an hour ahead.
    Date.now=()=>new Date().getTime()+3600000;
    window.fixture=s;window.fixture.version++;
  },shared);
  await other.locator('.tttp-timer-bar:not(.is-passive)').waitFor();
  const remaining=await Promise.all([page,other].map(p=>p.locator('.tttp-timer-bar').getAttribute('aria-valuenow')));
  assert.ok(Math.abs(Number(remaining[0])-Number(remaining[1]))<=.2,'device wall-clock skew must not affect countdown');
  await other.close();
  await page.evaluate(()=>{
    window.fixture.status='FINISHED';window.fixture.phase='COMPLETE';window.fixture.version++;
    window.fixture.result={tournament_handoff:{finalized:true,joker_reveal:{joker:{category:'SECRET',title:'TEST'},owner:{display_name:'ALICE',color_key:'RED'},result:{before:5,after:10}}}};
  });
  await page.locator('[data-ttt-postgame-next]').waitFor();
  await page.locator('[data-ttt-postgame-next]').click();
  await page.locator('.tttp-joker-card').waitFor();
  await page.locator('[data-ttt-postgame-next]').click();
  const rowsBefore=await page.locator('[data-ttt-merge-row]').elementHandles();
  assert.equal(rowsBefore.length,2);
  await page.locator('[data-ttt-postgame-close]:not([hidden]):enabled').waitFor({timeout:10000});
  assert.equal(await page.locator('[data-ttt-merge-row]').count(),2);
  for(const row of rowsBefore)assert.equal(await row.evaluate(x=>x.isConnected),true,'merge must keep row nodes');
  await page.locator('[data-ttt-postgame-close]').click();
  assert.equal(await page.evaluate(()=>window.testClosed),true);
  await page.evaluate(()=>{
    window.fixture.phase='DIFFICULTY';window.fixture.status='READY';window.fixture.result=null;window.fixture.version++;
  });
  await page.locator('[data-turn-seconds="7"]').click();
  await page.locator('[data-variant="DISAPPEAR"]').click();
  await page.locator('[data-save-settings]').click();
  await page.waitForFunction(()=>window.calls.some(x=>x.name==='set_tic_tac_toe_variant'));
  const settings=await page.evaluate(()=>window.calls.filter(x=>['set_tic_tac_toe_timer','set_tic_tac_toe_variant'].includes(x.name)));
  assert.equal(settings[0].args.p_turn_seconds,7);
  assert.equal(settings[1].args.p_variant,'DISAPPEAR');
  await page.evaluate(()=>{window.fixture.phase='READY_TO_START';window.fixture.version++;});
  await page.locator('.tttp-ready-roster').waitFor();
  assert.ok(await page.evaluate(()=>document.querySelector('.tttp-ready-roster').getBoundingClientRect().bottom<=document.querySelector('.tttp-ready-rules').getBoundingClientRect().top));
  assert.equal(await page.locator('[data-ready-toggle]').count(),1);
  console.log('PASS overlays, timer remount, Result → Joker → Merge → Close');
  await page.close();
  assert.deepEqual(failures,[]);
  console.log('Screenshots:',shots);
}finally{await browser.close();}
