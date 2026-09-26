import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame,act,teamView,phaseKey,tick} from '../supabase/functions/dna-standalone/quick-state.mjs';
import {DECOYS} from '../supabase/functions/dna-standalone/quick-decoys.mjs';
const players=[{id:'a',team:'RED'},{id:'b',team:'RED'},{id:'c',team:'BLUE'}];
const grade=a=>a==='USB';
function send(g,id,kind,now,value,phase=phaseKey(g)){return act(g,id,{kind,value,phase},now,grade,()=>.99)}
function ready(){const g=createGame(['one','two'],players,-5000);for(const p of players)send(g,p.id,'ready',-4100);assert.equal(g.stage,'COUNTDOWN');tick(g,g.deadline,grade,()=>.99);assert.equal(g.stage,'IDEA');return g}
function voting(){const g=ready();send(g,'a','idea',200,'USB');send(g,'b','idea',300,'usb');send(g,'c','idea',400,'OTHER');return g}
test('all devices must be ready; term 1 begins with the shared category countdown',()=>{
 const g=createGame(['one'],players,0);send(g,'a','ready',100);send(g,'b','ready',500);assert.equal(g.stage,'READY');
 send(g,'c','ready',9000);
 assert.equal(g.stage,'COUNTDOWN');assert.equal(g.term,1);assert.equal(g.hint,1);
 assert.equal(g.startedAt,10200);assert.equal(g.deadline,13200);
 send(g,'a','poll',10000);assert.equal(g.deadline,13200);
 send(g,'a','poll',13200);assert.equal(g.stage,'IDEA');assert.equal(g.deadline,33200);
});
test('accepted typo ideas share one server group without leaking a correction during IDEA',()=>{
 const g=createGame(['one'],[{id:'a',team:'RED'},{id:'b',team:'RED'}],0);
 const resolver=value=>value==='GIRAFFE'?{key:'__DNA_ACCEPTED_ANSWER__',exact:true}:value==='GURAFFE'?{key:'__DNA_ACCEPTED_ANSWER__',exact:false}:null;
 act(g,'a',{kind:'ready'},100,grade,()=>.99,resolver);act(g,'b',{kind:'ready'},100,grade,()=>.99,resolver);tick(g,g.deadline,grade,()=>.99);
 act(g,'b',{kind:'idea',value:'GURAFFE',phase:phaseKey(g)},g.startedAt+100,grade,()=>.99,resolver);
 assert.equal(teamView(g,'b').ideas.find(i=>i.is_me).idea,'GURAFFE');
 assert.equal(teamView(g,'b').ideas.find(i=>!i.is_me).idea,null);
 act(g,'a',{kind:'idea',value:'GIRAFFE',phase:phaseKey(g)},g.startedAt+200,grade,()=>.99,resolver);
 assert.equal(g.stage,'VOTE');
 const view=teamView(g,'b');
 assert.deepEqual(view.ideas.map(i=>i.idea),['GIRAFFE','GIRAFFE']);
});
test('fuzzy grouping never invents unseen canonical text if nobody typed it',()=>{
 const g=createGame(['one'],[{id:'a',team:'RED'},{id:'b',team:'RED'}],0);
 const resolver=value=>['GURAFFE','GIRAFF'].includes(value)?{key:'__DNA_ACCEPTED_ANSWER__',exact:false}:null;
 act(g,'a',{kind:'ready'},100,grade,()=>.99,resolver);act(g,'b',{kind:'ready'},100,grade,()=>.99,resolver);tick(g,g.deadline,grade,()=>.99);
 act(g,'a',{kind:'idea',value:'GURAFFE',phase:phaseKey(g)},g.startedAt+100,grade,()=>.99,resolver);
 act(g,'b',{kind:'idea',value:'GIRAFF',phase:phaseKey(g)},g.startedAt+200,grade,()=>.99,resolver);
 assert.equal(g.stage,'VOTE');
 const values=teamView(g,'a').ideas.map(i=>i.idea);
 assert.deepEqual(values,['GURAFFE','GURAFFE']);
 assert.equal(values.includes('GIRAFFE'),false);
});
test('ideas remain private until every active player is done, then both candidates arrive',()=>{
 const g=ready();send(g,'a','idea',200,'USB');send(g,'b','idea',400,'PHONE');
 assert.equal(g.stage,'IDEA');assert.equal(teamView(g,'a').ideas.find(i=>!i.is_me).idea,null);
 send(g,'c','idea',19000,'OTHER');assert.equal(g.stage,'VOTE');assert.equal(g.deadline,29000);
 assert.equal(teamView(g,'a').ideas.find(i=>!i.is_me).idea,'PHONE');
 assert.equal(teamView(g,'c').ideas.some(i=>i.idea==='USB'),false);
});
test('missing idea becomes no idea at the shared deadline, saved teammate answer survives',()=>{
 const g=ready();send(g,'a','idea',200,'USB');send(g,'b','poll',20100);
 assert.equal(g.stage,'VOTE');assert.equal(teamView(g,'b').ideas.find(i=>!i.is_me).idea,'USB');
 const phase='1:1:IDEA';assert.equal(send(g,'b','idea',20110,'LATE',phase),'PHASE_CHANGED');assert.equal(g.ideas.b,undefined);
});
test('case-normalized consensus; first submit wins; polling and retries do not duplicate score',()=>{
 const g=voting();send(g,'a','vote',500,'usb');send(g,'b','vote',600,'USB');
 assert.equal(g.submissions.RED,undefined);
 send(g,'a','submit',700);send(g,'b','submit',701);assert.equal(g.submissions.RED.answer,'USB');
 send(g,'a','poll',10400);assert.equal(g.stage,'FEEDBACK');assert.equal(g.teams.RED.score,3);
 send(g,'b','submit',10401,undefined,'1:1:VOTE');assert.equal(g.teams.RED.score,3);
});
test('a timely team submit beats the other device timeout; no submit means zero points',()=>{
 const g=voting();send(g,'a','vote',9000,'USB');send(g,'b','vote',9001,'USB');send(g,'a','submit',10399);
 send(g,'b','poll',10400);assert.equal(g.teams.RED.score,3);assert.equal(g.teams.BLUE.score,0);
 const h=voting();send(h,'a','vote',9000,'USB');send(h,'b','vote',9001,'USB');send(h,'b','poll',10400);assert.equal(h.teams.RED.score,0);
});
test('late submit is rejected; changing votes after submit cannot replace the answer',()=>{
 const g=voting();send(g,'a','vote',500,'USB');send(g,'b','vote',600,'USB');
 assert.equal(send(g,'a','submit',10400),'PHASE_CHANGED');assert.equal(g.teams.RED.score,0);
 const h=voting();send(h,'a','vote',500,'USB');send(h,'b','vote',600,'USB');send(h,'a','submit',700);
 assert.equal(send(h,'b','vote',701,'__NO__'),'ACTION_UNAVAILABLE');assert.equal(h.submissions.RED.answer,'USB');
});
test('duplicate idea retries are idempotent and outsiders cannot read or change state',()=>{
 const g=ready();send(g,'a','idea',200,'USB');send(g,'a','idea',201,'PHONE');assert.equal(g.ideas.a,'USB');
 assert.throws(()=>send(g,'outsider','poll',300),/FORBIDDEN/);assert.throws(()=>teamView(g,'outsider'),/FORBIDDEN/);
});
test('all teams, reveals, countdown and completion follow one persisted state',()=>{
 const g=ready();let now=100;
 for(let guard=0;g.stage!=='COMPLETE'&&guard<40;guard++){
  now=g.deadline;assert.ok(now);tick(g,now,grade,()=>.99);
  if(g.stage==='COUNTDOWN'){assert.equal(g.startedAt-now,1200);assert.equal(g.deadline-g.startedAt,3000)}
 }
 assert.equal(g.stage,'COMPLETE');assert.equal(g.term,2);
});
test('wrong, no-answer and changed consensus score correctly across all three hints',()=>{
 const g=createGame(['one'],[{id:'a',team:'RED'},{id:'b',team:'RED'}],0,{one:['PHONE']});
 send(g,'a','ready',100);send(g,'b','ready',100);tick(g,g.deadline,grade,()=>.99);
 send(g,'a','idea',g.startedAt+100,'WRONG');send(g,'b','idea',g.startedAt+101,'WRONG');
 send(g,'a','vote',300,'WRONG');send(g,'b','vote',301,'WRONG');send(g,'a','submit',400);
 assert.equal(g.teams.RED.score,-1);assert.equal(g.stage,'FEEDBACK');
 tick(g,g.deadline,grade,()=>.99);
 send(g,'a','idea',2000,'');send(g,'b','idea',2001,'');
 send(g,'a','vote',2100,'__NO__');send(g,'b','vote',2101,'__NO__');send(g,'b','submit',2200);
 assert.equal(g.teams.RED.score,-1);assert.equal(g.teams.RED.last.status,'NO_ANSWER');
 tick(g,g.deadline,grade,()=>.99);
 send(g,'a','idea',4000,'USB');send(g,'b','idea',4001,'WRONG');
 send(g,'a','vote',4100,'USB');send(g,'b','vote',4101,'WRONG');
 assert.equal(send(g,'a','submit',4200),'TEAM_CONSENSUS_REQUIRED');
 send(g,'b','vote',4300,'USB');send(g,'b','submit',4400);
 assert.equal(g.teams.RED.score,0);assert.equal(g.teams.RED.solved,true);assert.equal(g.teams.RED.last.points,1);
});
test('persisted JSON state survives reconnect without leaking ideas or restarting deadlines',()=>{
 let g=createGame(['one'],[{id:'a',team:'RED'},{id:'b',team:'RED'}],0);
 send(g,'a','ready',100);send(g,'b','ready',100);tick(g,g.deadline,grade,()=>.99);send(g,'a','idea',g.startedAt+100,'USB');
 g=JSON.parse(JSON.stringify(g));
 assert.equal(teamView(g,'b').ideas.find(i=>!i.is_me).idea,null);
 send(g,'b','idea',500,'USB');assert.equal(g.stage,'VOTE');
 const deadline=g.deadline;g=JSON.parse(JSON.stringify(g));send(g,'a','poll',deadline-1);
 assert.equal(g.deadline,deadline);assert.equal(g.stage,'VOTE');
});
test('bot teammate uses shared candidates, cooperates with correct vote and still needs Submit',()=>{
 const g=createGame(['one'],[{id:'a',team:'RED'}],0,{one:['PHONE']});
 act(g,'a',{kind:'ready'},100,grade,()=>.5);tick(g,g.deadline,grade,()=>.5);send(g,'a','idea',g.startedAt+100,'USB');
 assert.equal(teamView(g,'a').ideas.find(i=>!i.is_me).idea,'PHONE');
 send(g,'a','vote',300,'USB');assert.equal(teamView(g,'a').botVote,'USB');assert.equal(g.submissions.RED,undefined);
 send(g,'a','submit',400);assert.equal(g.teams.RED.score,3);
});
const context={};vm.runInNewContext(readFileSync(new URL('../public/dna-test/quick-sync.js',import.meta.url),'utf8'),context);
const Sync=context.DnaQuickSync;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('hint fitter detects clipped text inside a fitting card and may shrink below 9.5 px',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('const textFits=hint.scrollHeight<=hint.clientHeight+1'));
 assert.ok(app.includes('const minSize=(keyboard||pinned)?8.5:11'));
 const css=readFileSync(new URL('../public/dna-test/style.css',import.meta.url),'utf8');
 assert.ok(css.includes('padding:4px 10px 6px!important'));
 assert.ok(css.includes('gap:2px!important'));
});
test('Quick Games hot poll path is read-only and cached',()=>{
 const edge=readFileSync(new URL('../supabase/functions/dna-standalone/index.ts',import.meta.url),'utf8');
 assert.ok(edge.includes("if(kind==='poll'&&!needsHydrate&&!deadlineExpired)"));
 assert.ok(edge.includes("return quickSnapshot(g,userId,serverReceived,Date.now(),null,command.knownRevision,kind)"));
 assert.ok(edge.includes("if(kind==='poll'&&Number(knownRevision)===Number(g.revision))return {...base,unchanged:true}"));
 assert.ok(edge.includes("g.termData=data"));
 assert.ok(edge.includes("previousHints:data.hints.slice"));
});
test('Quick sync avoids redundant UI work for unchanged revisions and adapts polling by phase',async()=>{
 let applyCount=0,scheduledDelay=null,call=0;
 const sync=new Sync({
  now:()=>0,cancel:()=>{},schedule:(fn,ms)=>{scheduledDelay=ms;return 1},error:()=>{},apply:()=>applyCount++,
  send:async command=>{
   call++;
   assert.equal(command.knownRevision,call===1?-1:5);
   return {revision:5,serverReceived:1000,serverNow:1000,deadline:0,pollAfterMs:300};
  }
 });
 sync.request();await flush();assert.equal(applyCount,1);assert.equal(scheduledDelay,300);
 sync.request();await flush();assert.equal(applyCount,1);sync.stop();
});
test('hidden-tab pause cancels polling and resume restarts without recreating sync',async()=>{
 let scheduled=0,cancelled=0;
 const sync=new Sync({now:()=>0,schedule:()=>{scheduled++;return 1},cancel:()=>{cancelled++},error:()=>{},apply:()=>{},send:async()=>({revision:1,serverNow:0,serverReceived:0,pollAfterMs:500})});
 sync.request();await flush();sync.pause();assert.equal(sync.paused,true);const before=scheduled;sync.request();assert.equal(scheduled,before);sync.resume();await flush();assert.equal(sync.paused,false);assert.ok(cancelled>0);sync.stop();
});
test('Quick Games releases Edge Postgres connections and does not poll at 500 ms',()=>{
 const edge=readFileSync(new URL('../supabase/functions/dna-standalone/index.ts',import.meta.url),'utf8');
 const sync=readFileSync(new URL('../public/dna-test/quick-sync.js',import.meta.url),'utf8');
 assert.ok(edge.includes('idle_timeout:1'));
 assert.ok(edge.includes('max_lifetime:5'));
 assert.ok(sync.includes('this.queue.length?0:this.pollAfter'));
});
test('shared countdown is driven only by server timestamps, not local setTimeout steps',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("showTermCountdown(c,true)"));
 assert.ok(app.includes("now<startedAt?'':String(Math.max(1,Math.min(3,Math.ceil(left/1000))))"));
});
test('Quick Games sends READY on the first Ready tap instead of requiring a second Spiel starten tap',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("if(s.quickLobby){btn.disabled=true;btn.textContent='BEREIT WIRD GESPEICHERT …';startSharedQuickGame(true);return}"));
});
test('shared DNA JSON is persisted as an object, not a JSON string',()=>{
 const edge=readFileSync(new URL('../supabase/functions/dna-standalone/index.ts',import.meta.url),'utf8');
 assert.ok(edge.includes("values($1::uuid,$2::text::jsonb) on conflict do nothing"));
 assert.ok(edge.includes("set state=$2::text::jsonb where lobby_id=$1::uuid"));
});
test('default browser timers are wrapped so receiver-sensitive host APIs are not rebound',async()=>{
 let scheduled=false,cancelled=false;
 const host={
  setTimeout(){if(this!==host)throw new TypeError('Illegal invocation');scheduled=true;return 1},
  clearTimeout(){if(this!==host)throw new TypeError('Illegal invocation');cancelled=true},
  performance:{now(){if(this!==host.performance)throw new TypeError('Illegal invocation');return 0}}
 };
 const browserContext={globalThis:{},performance:host.performance,setTimeout:host.setTimeout.bind(host),clearTimeout:host.clearTimeout.bind(host)};
 browserContext.globalThis=browserContext;
 vm.runInNewContext(readFileSync(new URL('../public/dna-test/quick-sync.js',import.meta.url),'utf8'),browserContext);
 const BrowserSync=browserContext.DnaQuickSync;
 const sync=new BrowserSync({send:async()=>({revision:1,serverNow:0}),apply:()=>{},error:()=>{}});
 sync.request();await flush();sync.stop();
 assert.equal(scheduled,true);assert.equal(cancelled,true);
});
test('sync wakes at a shared phase deadline instead of waiting for the next 1 s idle poll',async()=>{
 let local=0,scheduledDelay=null;
 const sync=new Sync({
  now:()=>local,
  cancel:()=>{},
  schedule:(fn,ms)=>{scheduledDelay=ms;return 1},
  error:()=>{},
  apply:()=>{},
  send:async()=>({revision:1,serverReceived:100000,serverNow:100000,deadline:100300})
 });
 sync.request();await flush();
 assert.ok(scheduledDelay>=300&&scheduledDelay<450,`unexpected deadline wake delay ${scheduledDelay}`);
 sync.stop();
});
test('every term, including term 1, gets the synchronized category countdown',()=>{
 const g=createGame(['one','two'],players,0);
 for(const p of players)send(g,p.id,'ready',100);
 assert.equal(g.stage,'COUNTDOWN');assert.equal(g.term,1);
 assert.equal(g.startedAt-100,1200);assert.equal(g.deadline-g.startedAt,3000);
 const deadline=g.deadline;tick(g,deadline,grade,()=>.99);
 assert.equal(g.stage,'IDEA');assert.equal(g.term,1);
});
test('two monotonic device clocks converge despite different origins and server processing time',async()=>{
 async function device(origin){let local=origin;const sync=new Sync({now:()=>local,schedule:()=>0,cancel:()=>{},error:()=>{},apply:()=>{},send:async()=>{local+=500;return {serverReceived:100050,serverNow:100450,revision:1}}});sync.request();await flush();return sync.serverNow()}
 assert.equal(await device(0),100500);assert.equal(await device(9000000),100500);
});
test('writes stay ordered; failed input retries; old snapshots cannot rewind the UI',async()=>{
 let release,attempt=0,applied=[],calls=[],scheduled;
 const sync=new Sync({now:()=>0,cancel:()=>{},schedule:fn=>{scheduled=fn;return 1},error:()=>{},apply:s=>applied.push(s.revision),send:async command=>{
  calls.push(command.kind);if(attempt++===0)await new Promise(r=>release=r);
  if(attempt===1)throw new Error('offline');return {revision:attempt===2?5:4,serverNow:0};
 }});
 sync.request({kind:'idea'});sync.request({kind:'vote'});assert.deepEqual(calls,['idea']);release();await flush();
 scheduled();await flush();scheduled();await flush();assert.deepEqual(calls,['idea','idea','vote']);assert.deepEqual(applied,[5]);sync.stop();
});
test('response from a stopped connection cannot mutate the UI',async()=>{
 let release,applied=false;const sync=new Sync({now:()=>0,schedule:()=>0,cancel:()=>{},error:()=>{},apply:()=>applied=true,send:()=>new Promise(r=>release=r)});
 sync.request();sync.stop();release({revision:1,serverNow:0});await flush();assert.equal(applied,false);
});
test('server bot decoys are unchanged from the standalone content',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 const literal=app.match(/const DECOYS=(\{[\s\S]*?\n\});/)[1];
 assert.equal(JSON.stringify(vm.runInNewContext('('+literal+')')),JSON.stringify(DECOYS));
});
test('same vote retry does not reroll the server bot',()=>{
 const g=createGame(['one'],[{id:'a',team:'RED'}],0,{one:['PHONE']});
 act(g,'a',{kind:'ready'},100,grade,()=>.5);tick(g,g.deadline,grade,()=>.5);send(g,'a','idea',g.startedAt+100,'WRONG');
 act(g,'a',{kind:'vote',value:'WRONG',phase:phaseKey(g)},300,grade,()=>.99);
 const vote=g.botVotes.RED;
 act(g,'a',{kind:'vote',value:'WRONG',phase:phaseKey(g)},301,grade,()=>.01);
 assert.equal(g.botVotes.RED,vote);
});
test('answer matcher keeps the accepted DNA representation and typo examples',()=>{
 const edge=readFileSync(new URL('../supabase/functions/dna-standalone/index.ts',import.meta.url),'utf8');
 const start=edge.indexOf('function normalizeAnswer('),end=edge.indexOf('async function answerCandidates(');
 assert.ok(start>=0&&end>start);
 const matcher=vm.runInNewContext(`(()=>{${edge.slice(start,end)};return fuzzyCandidateMatch})()`);
 const resolution=vm.runInNewContext(`(()=>{${edge.slice(start,end)};return ideaResolution})()`);
 assert.deepEqual(JSON.parse(JSON.stringify(resolution('GIRAFFE',['GIRAFFE']))),{key:'__DNA_ACCEPTED_ANSWER__',exact:true});
 assert.deepEqual(JSON.parse(JSON.stringify(resolution('GURAFFE',['GIRAFFE']))),{key:'__DNA_ACCEPTED_ANSWER__',exact:false});
 const cases=[
  ['USB','USB',true],['SPAGHETTI CARBONARA','Spaghetti Carbonara',true],
  ['TRUMANSHOW','The Truman Show',true],['Micheal Jackson','Michael Jackson',true],
  ['Breath of the Wild','The Legend of Zelda: Breath of the Wild',true],
  ['Zelda Breath of the Wild','The Legend of Zelda: Breath of the Wild',true],
  ['Red Dead Redemption','Red Dead Redemption 2',true],['BACK THE FUTURE','Back to the Future',true],
  ['Phone','USB',false],['Michael Jordan','Michael Jackson',false]
 ];
 for(const [input,candidate,expected] of cases)assert.equal(matcher(input,candidate),expected,`${input} -> ${candidate}`);
});
test('Quick Game voter initials stay attached to the same people on both devices',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 const start=app.indexOf('function makeQuickVoters('),end=app.indexOf('async function loadQuickLobby(');
 const fn=vm.runInNewContext(`(()=>{${app.slice(start,end)};return makeQuickVoters})()`,{s:{quickLobby:null,quickVoters:null}});
 const lobby=[
  {user_id:'djeeloi-id',seat:1,display_name:'Djeeloi'},
  {user_id:'sofya-id',seat:2,display_name:'Sofya'}
 ];
 const d=fn(lobby,lobby[0],0),s=fn(lobby,lobby[1],0);
 assert.deepEqual(d.map(x=>[x.id,x.marker]),[['djeeloi-id','D'],['sofya-id','S']]);
 assert.deepEqual(s.map(x=>[x.id,x.marker]),[['djeeloi-id','D'],['sofya-id','S']]);
 assert.equal(d[0].is_me,true);assert.equal(s[0].is_me,false);
 assert.equal(d[1].is_me,false);assert.equal(s[1].is_me,true);
});
test('server team views expose stable player ids independent of viewer perspective',()=>{
 const g=createGame(['one'],[{id:'djeeloi-id',seat:1,team:'RED'},{id:'sofya-id',seat:2,team:'RED'}],0);
 send(g,'djeeloi-id','ready',100);send(g,'sofya-id','ready',100);tick(g,g.deadline,grade,()=>.99);
 send(g,'djeeloi-id','idea',g.startedAt+100,'USB');send(g,'sofya-id','idea',g.startedAt+200,'PHONE');
 const d=teamView(g,'djeeloi-id'),s=teamView(g,'sofya-id');
 assert.deepEqual(d.ideas.map(x=>x.id),['djeeloi-id','sofya-id']);
 assert.deepEqual(s.ideas.map(x=>x.id),['djeeloi-id','sofya-id']);
 assert.equal(d.ideas[0].is_me,true);assert.equal(s.ideas[0].is_me,false);
});
test('vote cards recover both ideas, merge normalized duplicates and always include no answer',()=>{
 const app=readFileSync(new URL('../public/dna-test/app.js',import.meta.url),'utf8');
 const fn=app.slice(app.indexOf('function sharedVoteMarkup('),app.indexOf('function applySharedQuickState('));
 const ctx={normalize:v=>v.trim().replace(/\s+/g,' ').toUpperCase(),voteCard:(value,who)=>JSON.stringify({value,who}),currentVoterSlots:()=>[{id:'a',marker:'D',order:0,is_me:true},{id:'b',marker:'S',order:1,is_me:false}]};
 vm.runInNewContext(fn,ctx);
 const markup=ctx.sharedVoteMarkup({ideas:[{id:'a',is_me:true,idea:'usb'},{id:'b',is_me:false,idea:' USB '}]});
 assert.ok(markup.includes('D + S'));assert.equal(markup.split('"USB"').length-1,1);assert.ok(markup.includes('__NO__'));
 const recovered=ctx.sharedVoteMarkup({ideas:[{id:'a',is_me:true,idea:''},{id:'b',is_me:false,idea:'PHONE'}]});assert.ok(recovered.includes('PHONE'));
});
