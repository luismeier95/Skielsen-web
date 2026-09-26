// Pure authoritative Quick Game state machine. Called only under the lobby row lock.
export const ORDER=['RED','BLUE','GREEN','YELLOW'];
export const durations={IDEA:20000,VOTE:10000,FEEDBACK:1150,REVEAL:3000,COUNTDOWN:3000};
export const COUNTDOWN_SYNC_LEAD=1200;
export const voteKey=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE');
export const phaseKey=g=>`${g.term}:${g.hint}:${g.stage}`;
const freshTeam=()=>({score:0,termScore:0,solved:false,processedHint:0,last:null});
export function createGame(terms,players,now,decoys={}){
  return {terms,players,term:1,hint:1,stage:'READY',startedAt:now,deadline:null,revision:0,
    ready:{},seen:{},ideas:{},ideaKeys:{},ideaExact:{},votes:{},botIdeas:{},botVotes:{},decoys,submissions:{},teams:Object.fromEntries(ORDER.map(k=>[k,freshTeam()]))};
}
const teamOf=(g,id)=>g.players.find(p=>p.id===id)?.team;
const active=g=>ORDER.filter(k=>!g.teams[k].solved);
const humans=(g,k)=>g.players.filter(p=>p.team===k).sort((a,b)=>Number(a.seat??999)-Number(b.seat??999));
function enter(g,stage,now){
 g.stage=stage;
 // COUNTDOWN is announced slightly before its visible 3-second clock begins.
 // Clients can render the category first, then every device starts 3/2/1 from
 // the same server timestamp even when their snapshot arrives a few hundred ms apart.
 const lead=stage==='COUNTDOWN'?COUNTDOWN_SYNC_LEAD:0;
 g.startedAt=now+lead;
 g.deadline=durations[stage]?g.startedAt+durations[stage]:null;
}
function newHint(g,now,random){
  g.ideas={};g.ideaKeys={};g.ideaExact={};g.votes={};g.botIdeas={};g.botVotes={};g.submissions={};
  const list=g.decoys[g.terms[g.term-1]]||[];
  for(const k of active(g))if(humans(g,k).length===1)g.botIdeas[k]=random()<.18||!list.length?'':list[Math.floor(random()*list.length)];
  enter(g,'IDEA',now);
}
function evaluate(g,grade,random){
  for(const k of active(g)){
    const t=g.teams[k];let answer=g.submissions[k]?.answer||'__NO__';
    let correct=false;
    if(!humans(g,k).length){
      // Bot-only teams roll once, under the same lock, for every device.
      answer=random()<.78?'BOT':'__NO__';
      correct=answer==='BOT'&&random()<(g.hint===1?.14:g.hint===2?.36:.68);
    }else correct=answer!=='__NO__'&&grade(answer);
    const points=answer==='__NO__'?0:correct?4-g.hint:-1;
    t.last={hint:g.hint,status:answer==='__NO__'?'NO_ANSWER':correct?'CORRECT':'WRONG',points};
    t.score+=points;t.termScore+=points;t.solved=correct;t.processedHint=g.hint;
  }
}
export function tick(g,now,grade,random=Math.random){
  // At most one transition per request: every phase gets its full server duration
  // after a total network outage, instead of skipping unseen questions.
  if(g.stage==='READY'&&g.players.every(p=>g.ready[p.id]))enter(g,'COUNTDOWN',now);
  else if(g.stage==='IDEA'&&(now>=g.deadline||g.players.filter(p=>!g.teams[p.team].solved).every(p=>Object.hasOwn(g.ideas,p.id))))enter(g,'VOTE',now);
  else if(g.stage==='VOTE'&&(now>=g.deadline||active(g).filter(k=>humans(g,k).length).every(k=>g.submissions[k]))){evaluate(g,grade,random);enter(g,'FEEDBACK',now)}
  else if(g.deadline&&now>=g.deadline){
    if(g.stage==='FEEDBACK'){
      if(g.hint<3){g.hint++;newHint(g,now,random)}else enter(g,'REVEAL',now);
    }else if(g.stage==='REVEAL'){
      if(g.term===g.terms.length)enter(g,'COMPLETE',now);
      else{g.term++;g.hint=1;for(const t of Object.values(g.teams)){const score=t.score;Object.assign(t,freshTeam(),{score})}enter(g,'COUNTDOWN',now)}
    }else if(g.stage==='COUNTDOWN')newHint(g,now,random);
  }
}
export function act(g,id,command,now,grade,random=Math.random,resolveIdea=null){
  const team=teamOf(g,id);if(!team)throw new Error('LOBBY_FORBIDDEN');
  // Backward-compatible defaults for sessions created before fuzzy IDEA grouping.
  g.ideaKeys||={};g.ideaExact||={};
  g.seen[id]=now;
  // Settle an expired phase before accepting input; the browser cannot extend it.
  const expired=!!g.deadline&&now>=g.deadline;
  if(expired)tick(g,now,grade,random);
  const kind=command.kind||'poll';let error=null;
  if(kind==='ready')g.ready[id]=true;
  else if(kind!=='poll'){
    if(command.phase!==phaseKey(g))error='PHASE_CHANGED';
    else if(g.teams[team].solved)error='TEAM_SOLVED';
    else if(kind==='idea'&&g.stage==='IDEA'){
      // First acknowledged idea is immutable. Retried requests are idempotent.
      if(!Object.hasOwn(g.ideas,id)){
        const value=String(command.value||'').trim().slice(0,80);
        const meta=value&&typeof resolveIdea==='function'?resolveIdea(value):null;
        g.ideas[id]=value;
        g.ideaKeys[id]=String(meta?.key||voteKey(value));
        g.ideaExact[id]=Boolean(meta?.exact);
      }
    }else if(kind==='vote'&&g.stage==='VOTE'&&!g.submissions[team]){
      const key=voteKey(command.value);
      const candidates=humans(g,team).map(p=>voteKey(g.ideas[p.id])).filter(Boolean);
      if(g.botIdeas[team])candidates.push(voteKey(g.botIdeas[team]));
      if(key&&key!=='__NO__'&&!candidates.includes(key))error='INVALID_TEAM_VOTE';
      else{
        const changed=g.votes[id]!== (key||null);
        g.votes[id]=key||null;
        if(humans(g,team).length===1&&changed){
          const bot=voteKey(g.botIdeas[team]);
          g.botVotes[team]=!key?null:grade(key)||key===bot?key:
            key==='__NO__'?(!bot||random()<.72?'__NO__':bot):
            bot&&grade(bot)?(random()<.95?bot:key):
            random()<.42&&bot?bot:random()<.77?key:'__NO__';
        }
      }
    }else if(kind==='submit'&&g.stage==='VOTE'){
      if(!g.submissions[team]){
        const mates=humans(g,team),votes=mates.map(p=>g.votes[p.id]);
        if(mates.length===1)votes.push(g.botVotes[team]);
        if(!votes[0]||!votes.every(v=>v===votes[0]))error='TEAM_CONSENSUS_REQUIRED';
        else g.submissions[team]={answer:votes[0],by:id};
      }
    }else error='ACTION_UNAVAILABLE';
  }
  // Do not consume a second phase on the same request after a deadline transition.
  if(!expired)tick(g,now,grade,random);
  g.revision++;
  return error;
}
export function teamView(g,id){
  const own=teamOf(g,id);if(!own)throw new Error('LOBBY_FORBIDDEN');
  g.ideaKeys||={};g.ideaExact||={};
  const mates=humans(g,own),other=mates.find(p=>p.id!==id);
  const ideasVisible=['VOTE','FEEDBACK'].includes(g.stage);
  // Equivalent ideas share one server-side grouping key. During IDEA every
  // player still sees only the exact text they typed. Once VOTE opens, members
  // of one group receive the same *user-provided* display text so the client
  // naturally renders one card. Prefer an exact accepted spelling if a teammate
  // actually submitted it; never inject an unseen canonical answer.
  const displayByKey=new Map();
  if(ideasVisible){
    for(const p of mates){
      const value=g.ideas[p.id]||'';if(!value)continue;
      const key=g.ideaKeys[p.id]||voteKey(value),exact=Boolean(g.ideaExact[p.id]),current=displayByKey.get(key);
      if(!current||(!current.exact&&exact))displayByKey.set(key,{value,exact});
    }
  }
  const ideas=mates.map(p=>{
    const raw=g.ideas[p.id]||'',key=g.ideaKeys[p.id]||voteKey(raw);
    const visible=ideasVisible?(displayByKey.get(key)?.value||raw):(p.id===id?raw:null);
    return {id:p.id,is_me:p.id===id,submitted:Object.hasOwn(g.ideas,p.id),idea:visible};
  });
  if(!other)ideas.push({id:'__BOT__',is_me:false,is_bot:true,submitted:true,idea:ideasVisible?g.botIdeas[own]||'':null});
  return {ideas,votes:mates.map(p=>({id:p.id,is_me:p.id===id,vote:g.votes[p.id]||null})),
    botVote:other?null:g.botVotes[own]||null,submission:g.submissions[own]||null,
    outcome:g.teams[own].last,solved:g.teams[own].solved,
    players:g.players.map(p=>({id:p.id,is_me:p.id===id,team:p.team,ready:!!g.ready[p.id],lastSeen:g.seen[p.id]||null}))};
}
