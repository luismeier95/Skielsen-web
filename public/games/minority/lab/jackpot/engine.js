(()=>{
'use strict';
const CONFIG=globalThis.SkielsenMinorityLabConfig;
if(!CONFIG)throw new Error('MINORITY_LAB_CONFIG_REQUIRED');

function clampPot(value){
 const n=Math.max(1,Number(value)||1);
 const steps=CONFIG.pot.steps;
 for(const step of steps)if(n<=step)return step;
 return CONFIG.pot.max;
}
function nextPotValue(value){
 const current=clampPot(value);
 const steps=CONFIG.pot.steps;
 const index=steps.indexOf(current);
 return steps[Math.min(steps.length-1,index+1)];
}
function potStage(value){
 const current=clampPot(value);
 return CONFIG.pot.steps.indexOf(current)+1;
}
function isArmed(value){return clampPot(value)>=CONFIG.pot.jackpotArmedAt}
function shouldTriggerJackpot({difficulty,optionCount,hasMinority,potValue}={}){
 return String(difficulty).toUpperCase()===CONFIG.jackpot.difficulty
  && Number(optionCount)===CONFIG.jackpot.optionCount
  && !!hasMinority
  && isArmed(potValue);
}
function shuffled(list,randomFn=Math.random){
 const out=list.slice();
 for(let i=out.length-1;i>0;i--){const j=Math.floor(randomFn()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
function buildSchedule({rules,difficulty,roundCount,randomFn=Math.random}={}){
 if(!rules?.questionPools)throw new Error('MINORITY_RULES_REQUIRED');
 const diff=String(difficulty||'NORMAL').toUpperCase();
 const count=Math.max(CONFIG.local.defaultRounds,Number(roundCount)||CONFIG.local.defaultRounds);
 const bags={2:[],3:[],4:[]};
 const draw=n=>{
  if(!bags[n].length)bags[n]=shuffled(rules.questionPools[n],randomFn);
  return bags[n].pop().slice();
 };
 const rounds=[];
 for(let round=1;round<=count;round++){
  let optionCount=2;
  if(diff!=='EASY'&&round%CONFIG.local.chaosEvery===0){
   optionCount=diff==='NORMAL'?3:(randomFn()<0.5?3:4);
  }
  rounds.push({id:'lab-'+round,options:draw(optionCount),optionCount,chaos:optionCount>2});
 }
 return rounds;
}
function resolveDecisions({winningSeats,potValue,decisions}={}){
 const winners=(Array.isArray(winningSeats)?winningSeats:[]).map(Number).filter(Number.isFinite);
 const pot=clampPot(potValue);
 const normalized={};
 for(const seat of winners){
  const value=String(decisions?.[seat]||'').toUpperCase();
  if(value!=='TAKE'&&value!=='SPIN')throw new Error('MISSING_JACKPOT_DECISION:'+seat);
  normalized[seat]=value;
 }
 const spinners=winners.filter(seat=>normalized[seat]==='SPIN');
 const spinCount=spinners.length;
 const rows=winners.map(seat=>{
  const decision=normalized[seat];
  if(decision==='TAKE')return {seat,decision,takePayout:spinCount?Math.max(0,pot-1):pot,slotBase:null,loneWolf:false};
  const loneWolf=spinCount===1;
  return {seat,decision,takePayout:null,slotBase:pot+(loneWolf?1:0),loneWolf};
 });
 return {potValue:pot,spinCount,rows,spinners};
}
function spin(randomFn=Math.random){
 const symbols=CONFIG.slot.symbols;
 return Array.from({length:CONFIG.slot.reelCount},()=>symbols[Math.floor(randomFn()*symbols.length)].id);
}
function classifySpin(symbolIds){
 const ids=Array.isArray(symbolIds)?symbolIds.slice(0,CONFIG.slot.reelCount):[];
 if(ids.length!==CONFIG.slot.reelCount)throw new Error('INVALID_SLOT_RESULT');
 const counts={};
 ids.forEach(id=>{counts[id]=(counts[id]||0)+1});
 const max=Math.max(...Object.values(counts));
 if(max===3){
  if(ids[0]==='seven')return {kind:'JACKPOT_777',label:'JACKPOT · 777',multiplier:CONFIG.slot.sevenTripleMultiplier};
  return {kind:'TRIPLE',label:'FULL MATCH',multiplier:CONFIG.slot.tripleMultiplier};
 }
 if(max===2){
  const pairId=Object.keys(counts).find(id=>counts[id]===2);
  const symbol=CONFIG.slot.symbols.find(item=>item.id===pairId);
  return {kind:'PAIR',label:'PAIR · '+(symbol?.label||pairId),multiplier:Number(symbol?.pairMultiplier)||0};
 }
 if(ids.includes('seven'))return {kind:'SINGLE_SEVEN',label:'7 RETTET DEN SPIN',multiplier:CONFIG.slot.singleSevenMultiplier};
 return {kind:'BUST',label:'BUST',multiplier:0};
}
function spinPayout(base,symbolIds){
 const result=classifySpin(symbolIds);
 return {...result,base:Number(base)||0,payout:Math.round((Number(base)||0)*result.multiplier),symbols:symbolIds.slice()};
}
function expectedRtp(){
 // Exact RTP for 3 independent uniform reels with the configured 4 symbols.
 const symbols=CONFIG.slot.symbols;
 let total=0,weight=0;
 for(const a of symbols)for(const b of symbols)for(const c of symbols){
  total+=classifySpin([a.id,b.id,c.id]).multiplier;weight+=1;
 }
 return total/weight;
}
function assert(condition,message){if(!condition)throw new Error('JACKPOT_SELFTEST:'+message)}
function selfTest(){
 assert(nextPotValue(1)===2,'pot 1->2');
 assert(nextPotValue(2)===5,'pot 2->5');
 assert(nextPotValue(5)===8,'pot 5->8');
 assert(nextPotValue(13)===13,'pot cap');
 let p=resolveDecisions({winningSeats:[1,2,3],potValue:8,decisions:{1:'TAKE',2:'TAKE',3:'TAKE'}});
 assert(p.rows.every(r=>r.takePayout===8),'all take full pot');
 p=resolveDecisions({winningSeats:[1,2,3],potValue:8,decisions:{1:'SPIN',2:'TAKE',3:'TAKE'}});
 assert(p.rows.find(r=>r.seat===1).slotBase===9,'lone wolf +1');
 assert(p.rows.find(r=>r.seat===2).takePayout===7,'take -1');
 p=resolveDecisions({winningSeats:[1,2,3],potValue:8,decisions:{1:'SPIN',2:'SPIN',3:'TAKE'}});
 assert(p.rows.find(r=>r.seat===1).slotBase===8,'multi spin base pot');
 assert(Math.abs(expectedRtp()-0.9453125)<1e-12,'RTP');
 return {ok:true,rtp:expectedRtp()};
}
globalThis.SkielsenMinorityJackpotEngine=Object.freeze({
 version:'0.2.0',clampPot,nextPotValue,potStage,isArmed,shouldTriggerJackpot,
 buildSchedule,resolveDecisions,spin,classifySpin,spinPayout,expectedRtp,selfTest
});
globalThis.__SKIELSEN_MINORITY_JACKPOT_SELFTEST__=selfTest();
})();