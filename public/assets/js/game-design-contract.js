(()=>{
'use strict';
const states={
  MODE:{progress:5,strong:'GAME MODE',small:'SETUP'},
  SETUP:{progress:10,strong:'SETUP',small:'GAME STATE'},
  READY:{progress:20,strong:'READY',small:'PLAYER STATUS'},
  PLAY:{progress:40,strong:'04 / 10',small:'GAME PROGRESS'},
  REVEAL:{progress:50,strong:'REVEAL',small:'AUFLÖSUNG'},
  RESULT:{progress:100,strong:'RESULT',small:'FINAL'}
};
let current='SETUP';
const buttons=[...document.querySelectorAll('[data-gdc-state]')];
const panels=[...document.querySelectorAll('[data-gdc-panel]')];
const status=document.getElementById('gdcStatus');
const progress=document.getElementById('gdcProgress');
const metaStrong=document.getElementById('gdcHeaderMetaStrong');
const metaSmall=document.getElementById('gdcHeaderMetaSmall');
function setState(next){
  current=states[next]?next:'SETUP';
  buttons.forEach(b=>b.classList.toggle('active',b.dataset.gdcState===current));
  panels.forEach(p=>p.classList.toggle('active',p.dataset.gdcPanel===current));
  status.classList.toggle('is-result',current==='RESULT');
  progress.style.width=states[current].progress+'%';
  metaStrong.textContent=states[current].strong;
  metaSmall.textContent=states[current].small;
}
buttons.forEach(b=>b.addEventListener('click',()=>setState(b.dataset.gdcState)));
const theme=document.getElementById('gdcTheme');
theme.addEventListener('change',()=>{
  document.documentElement.dataset.themePack=theme.value;
  document.body.dataset.themePack=theme.value;
});
setState(current);
})();