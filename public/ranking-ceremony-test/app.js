(()=>{
'use strict';

const ceremony=document.getElementById('ceremony');
const replay=document.getElementById('replay');
const showFinal=document.getElementById('showFinal');
const confetti=document.getElementById('confetti');
let timers=[];

const colors=['#FF1717','#1515FF','#F2B705','#00A65A','#c5a35a','#ffffff'];
const paths=[
  [-330,-210],[-285,-265],[-250,-150],[-210,-310],[-175,-205],[-140,-275],[-95,-175],[-55,-330],
  [-25,-220],[15,-300],[55,-170],[95,-285],[135,-210],[175,-315],[215,-180],[255,-270],[300,-205],[345,-300],
  [-365,-105],[-310,-80],[-260,-120],[-205,-65],[-150,-125],[-95,-75],[-40,-130],[30,-78],[88,-120],[145,-64],
  [205,-118],[265,-70],[320,-126],[370,-82]
];

function makeConfetti(){
  confetti.innerHTML='';
  paths.forEach((point,i)=>{
    const piece=document.createElement('i');
    piece.style.setProperty('--c',colors[i%colors.length]);
    piece.style.setProperty('--x',point[0]+'px');
    piece.style.setProperty('--y',point[1]+'px');
    piece.style.setProperty('--r',((i*47)%180)+'deg');
    piece.style.setProperty('--d',(3.04+(i%7)*.045)+'s');
    confetti.appendChild(piece);
  });
}
function clearTimers(){
  timers.forEach(clearTimeout);
  timers=[];
}
function countTo(el,target,duration=760){
  const start=performance.now();
  const step=now=>{
    const p=Math.min(1,(now-start)/duration);
    const eased=1-Math.pow(1-p,3);
    el.textContent=String(Math.round(target*eased));
    if(p<1)requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function scheduleCounts(){
  const counters=[...document.querySelectorAll('[data-count]')];
  counters.forEach(el=>el.textContent='0');
  counters.forEach(el=>{
    const rank=Number(el.closest('.award')?.dataset.rank||0);
    const delay=rank===2?2050:rank===3?2300:3400;
    timers.push(setTimeout(()=>countTo(el,Number(el.dataset.count||0),720),delay));
  });
}
function replayCeremony(){
  clearTimers();
  ceremony.classList.remove('is-running','is-final');
  void ceremony.offsetWidth;
  makeConfetti();
  requestAnimationFrame(()=>ceremony.classList.add('is-running'));
  scheduleCounts();
}
function finalState(){
  clearTimers();
  ceremony.classList.remove('is-running');
  ceremony.classList.add('is-final');
  document.querySelectorAll('[data-count]').forEach(el=>el.textContent=el.dataset.count||'0');
}
replay.addEventListener('click',replayCeremony);
showFinal.addEventListener('click',finalState);
window.addEventListener('keydown',e=>{
  if(e.key==='r'||e.key==='R')replayCeremony();
  if(e.key==='f'||e.key==='F')finalState();
});
makeConfetti();
if(matchMedia('(prefers-reduced-motion: reduce)').matches)finalState();
else timers.push(setTimeout(replayCeremony,180));
})();
