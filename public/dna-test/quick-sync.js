/* Shared transport: one ordered request stream, bounded retries and monotonic clock. */
(()=>{
'use strict';
class DnaQuickSync{
 constructor({send,apply,error,now=()=>performance.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
  // Keep host timer APIs behind arrow wrappers. Calling Window methods as
  // DnaQuickSync instance methods can throw `Illegal invocation` in browsers.
  Object.assign(this,{send,apply,error,now,schedule,cancel});this.queue=[];this.running=false;this.stopped=false;this.paused=false;this.revision=-1;this.timer=0;this.anchor=null;this.rtt=Infinity;this.failures=0;this.phaseDeadline=0;this.pollAfter=1000;
 }
 serverNow(){return this.anchor?this.anchor.server+this.now()-this.anchor.local:0}
 request(command={kind:'poll'}){
  if(this.stopped||this.paused)return;
  // Polls carry no writes; there is never more than one pending poll.
  if(command.kind!=='poll'||!this.queue.some(c=>c.kind==='poll'))this.queue.push(command);
  this.cancel(this.timer);void this.drain();
 }
 pause(){this.paused=true;this.cancel(this.timer)}
 resume(){if(this.stopped)return;this.paused=false;this.request()}
 stop(){this.stopped=true;this.paused=false;this.cancel(this.timer);this.queue=[]}
 async drain(){
  if(this.running||this.stopped)return;this.running=true;
  const command=this.queue.shift()||{kind:'poll'},sent=this.now();
  try{
   const wireCommand={...command,knownRevision:this.revision};
   const snapshot=await this.send(wireCommand),received=this.now();
   const rtt=Math.max(0,received-sent-Math.max(0,snapshot.serverNow-(snapshot.serverReceived??snapshot.serverNow)));
   if(this.stopped)return;
   this.failures=0;
   // Prefer recent low-latency samples. Device wall-clock changes are irrelevant.
   if(!this.anchor||rtt<=this.rtt+100||received-this.anchor.local>10000){this.anchor={server:snapshot.serverNow+rtt/2,local:received};this.rtt=rtt}
   this.phaseDeadline=Number(snapshot.deadline||0);
   this.pollAfter=Math.max(250,Math.min(2000,Number(snapshot.pollAfterMs)||1000));
   if(snapshot.revision>this.revision||this.revision<0){
     this.revision=snapshot.revision;
     this.apply(snapshot);
   }
   this.error(null);
  }catch(err){
   this.failures++;
   if(command.kind!=='poll')this.queue.unshift(command);
   if(!this.stopped)this.error(err);
  }finally{
   this.running=false;
   // Writes stay immediate; idle polling remains conservative for DB pressure.
   // Near a shared server deadline we wake exactly at the boundary instead of
   // waiting for the next arbitrary 1 s poll. This removes up to ~1 s of
   // per-device phase skew without increasing steady-state polling load.
   let delay=this.failures?Math.min(4000,500*2**this.failures):this.queue.length?0:this.pollAfter;
   if(!this.failures&&!this.queue.length&&this.phaseDeadline&&this.anchor){
     const until=this.phaseDeadline-this.serverNow()+80;
     if(until>25)delay=Math.min(delay,until);
     else if(until>-750)delay=Math.min(delay,80);
   }
   if(!this.stopped&&!this.paused)this.timer=this.schedule(()=>this.drain(),delay);
  }
 }
}
globalThis.DnaQuickSync=DnaQuickSync;
})();
