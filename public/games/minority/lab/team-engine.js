(()=>{
'use strict';

const TEAM_COUNT=4;
const PLAYERS_PER_TEAM=2;
const TEAM_NAMES=['TEAM BLAU','TEAM ROT','TEAM GELB','TEAM GRÜN'];
const TEAM_COLORS=['#1515ff','#ff1717','#f2b705','#00a65a'];

function teamIndexForSeat(seat){
  const n=Math.max(1,Number(seat)||1);
  return Math.min(TEAM_COUNT-1,Math.floor((n-1)/PLAYERS_PER_TEAM));
}
function teamIdForSeat(seat){return 'team-'+(teamIndexForSeat(seat)+1)}
function teamColorForSeat(seat){return TEAM_COLORS[teamIndexForSeat(seat)]}
function teamNameForSeat(seat){return TEAM_NAMES[teamIndexForSeat(seat)]}

function resolveRound({difficulty='NORMAL',choices=[],optionCount=2,scores=[],roundValue=1}={}){
  const diff=String(difficulty||'NORMAL').toUpperCase();
  const normalizedChoices=choices.map(v=>Number(v)||0);
  const playerCount=normalizedChoices.length;
  const count=Math.max(2,Number(optionCount)||2);
  const counts=Array(count).fill(0);

  normalizedChoices.forEach(choice=>{
    if(choice>=1&&choice<=count)counts[choice-1]+=1;
  });

  const positive=counts.filter(v=>v>0);
  const min=positive.length?Math.min(...positive):0;
  const max=positive.length?Math.max(...positive):0;
  const hasMinority=positive.length>1&&min<max;

  const winningSeats=[];
  if(hasMinority){
    normalizedChoices.forEach((choice,index)=>{
      if(choice>=1&&counts[choice-1]===min)winningSeats.push(index+1);
    });
  }

  const nextScores=Array.from({length:playerCount},(_,i)=>Number(scores[i])||0);
  const value=Math.max(1,Number(roundValue)||1);
  const award=hasMinority?(diff==='EASY'?1:value):0;
  if(award)winningSeats.forEach(seat=>{nextScores[seat-1]+=award});

  const penaltySeats=[];
  const unanimous=playerCount>0&&counts.some(v=>v===playerCount);
  if(!hasMinority&&diff==='HARDCORE'&&unanimous){
    const leaderScore=Math.max(...nextScores);
    nextScores.forEach((score,index)=>{
      if(score===leaderScore){
        nextScores[index]-=1;
        penaltySeats.push(index+1);
      }
    });
  }

  const nextRoundValue=diff==='EASY'?1:(hasMinority?1:value+1);

  return {
    counts,
    hasMinority,
    winningSeats,
    penaltySeats,
    award,
    roundValue:value,
    nextRoundValue,
    scores:nextScores,
    unanimous
  };
}

function aggregateTeams(players=[],scores=[]){
  const teams=Array.from({length:TEAM_COUNT},(_,index)=>({
    teamIndex:index,
    teamId:'team-'+(index+1),
    name:TEAM_NAMES[index],
    color:TEAM_COLORS[index],
    score:0,
    members:[]
  }));

  players.forEach(player=>{
    const seat=Number(player.seat)||1;
    const team=teams[teamIndexForSeat(seat)];
    const individualScore=Number(scores[seat-1])||0;
    team.score+=individualScore;
    team.members.push({
      seat,
      name:player.display_name||('PLAYER '+seat),
      score:individualScore,
      is_me:!!player.is_me,
      is_bot:!!player.is_bot
    });
  });

  return teams;
}

function selfTest(){
  const assert=(condition,message)=>{if(!condition)throw new Error('MINORITY_TEAM_SELFTEST:'+message)};
  let r=resolveRound({difficulty:'NORMAL',choices:[1,1,1,1,1,2,2,2],optionCount:2,scores:Array(8).fill(0),roundValue:2});
  assert(r.hasMinority,'5:3 has minority');
  assert(JSON.stringify(r.winningSeats)===JSON.stringify([6,7,8]),'5:3 winners');
  assert(r.scores.slice(5).every(v=>v===2),'5:3 award');

  r=resolveRound({difficulty:'NORMAL',choices:[1,1,1,1,2,2,2,2],optionCount:2,scores:Array(8).fill(0),roundValue:2});
  assert(!r.hasMinority,'4:4 tie');

  r=resolveRound({difficulty:'HARDCORE',choices:Array(8).fill(1),optionCount:2,scores:[3,3,2,1,0,0,0,0],roundValue:5});
  assert(r.unanimous,'8:0 unanimous');
  assert(JSON.stringify(r.penaltySeats)===JSON.stringify([1,2]),'8:0 leader penalty');
  assert(r.scores[0]===2&&r.scores[1]===2,'8:0 penalty applied');

  const players=Array.from({length:8},(_,i)=>({seat:i+1,display_name:'P'+(i+1)}));
  const teams=aggregateTeams(players,[2,3,1,4,0,5,2,2]);
  assert(teams[0].score===5&&teams[1].score===5&&teams[2].score===5&&teams[3].score===4,'team aggregation');

  return {ok:true};
}

globalThis.SkielsenMinorityTeamEngine=Object.freeze({
  version:'0.1.0',
  TEAM_COUNT,
  PLAYERS_PER_TEAM,
  TEAM_NAMES,
  TEAM_COLORS,
  teamIndexForSeat,
  teamIdForSeat,
  teamColorForSeat,
  teamNameForSeat,
  resolveRound,
  aggregateTeams,
  selfTest
});
globalThis.__SKIELSEN_MINORITY_TEAM_SELFTEST__=selfTest();
})();