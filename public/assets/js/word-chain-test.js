(()=>{
'use strict';
const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const theme=q('#wcxtTheme');
const stateButtons=qa('[data-state]');
const body=document.body;

const STATES={
  PLAY:{prefix:['G'],feedback:'',cls:''},
  HINT:{prefix:['G','E'],feedback:'−1 · NÄCHSTER BUCHSTABE',cls:'is-hint'},
  CORRECT:{prefix:['G','E','L','D'],feedback:'RICHTIG',cls:'is-correct'}
};

function setTheme(value){
  document.documentElement.dataset.themePack=value;
  body.dataset.themePack=value;
}
function renderPrefix(chars){
  q('#wcxtPrefix').innerHTML=chars.map(ch=>'<span>'+ch+'</span>').join('');
}
function renderState(name){
  stateButtons.forEach(b=>b.classList.toggle('active',b.dataset.state===name));
  const play=q('#wcxtPlayLayout'),result=q('#wcxtResult');
  if(name==='RESULT'){
    play.hidden=true;result.hidden=false;q('#wcxtProgress').style.width='100%';return;
  }
  play.hidden=false;result.hidden=true;
  q('#wcxtProgress').style.width='40%';
  const s=STATES[name]||STATES.PLAY;
  const main=q('#wcxtMainBody');
  main.classList.remove('is-hint','is-correct');
  void main.offsetWidth;
  if(s.cls)main.classList.add(s.cls);
  renderPrefix(s.prefix);
  q('#wcxtFeedback').textContent=s.feedback;
  q('#wcxtInput').value=name==='CORRECT'?'':'';
}
theme.addEventListener('change',()=>setTheme(theme.value));
stateButtons.forEach(b=>b.addEventListener('click',()=>renderState(b.dataset.state)));
q('#wcxtLayoutMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-layout'));
q('#wcxtDataMap').addEventListener('click',()=>body.classList.toggle('wcxt-show-data'));
q('#wcxtMinimize')?.addEventListener?.('click',()=>{});
setTheme(theme.value);
renderState('PLAY');
})();