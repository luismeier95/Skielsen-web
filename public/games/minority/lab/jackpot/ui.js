(()=>{
'use strict';
const CONFIG=globalThis.SkielsenMinorityLabConfig;
const ENGINE=globalThis.SkielsenMinorityJackpotEngine;
if(!CONFIG||!ENGINE)throw new Error('MINORITY_JACKPOT_DEPENDENCY_REQUIRED');

function makeUi(root){
 if(!root)throw new Error('MINORITY_JACKPOT_ROOT_REQUIRED');
 let timer=0;
 function clearTimer(){if(timer){clearTimeout(timer);timer=0}}
 function hide(){clearTimer();root.classList.remove('is-open');root.innerHTML=''}
 function potAsset(value){return CONFIG.assets.potStages[Math.max(0,ENGINE.potStage(value)-1)]}
 function playerColor(seat){return ['#1515ff','#ff1717','#f2b705','#00a65a'][(Number(seat)-1)%4]}
 function coinMarkup(count){
  const offsets=[[-28,-8], [18,10], [-8,0], [32,7], [-18,-5]];
  return Array.from({length:Math.min(5,Math.max(1,count))},(_,i)=>{
   const [x,end]=offsets[i%offsets.length];
   return `<i class="mj-coin" style="--x:${x}px;--end:${end}px;--delay:${i*60}ms"></i>`;
  }).join('');
 }
 function showPotFill({from,to,label='KEINE MINDERHEIT',onDone}={}){
  hide();root.classList.add('is-open');
  const diff=Math.max(1,Number(to)-Number(from));
  root.innerHTML=`<div class="mj-compact">
   <div class="mj-event-title"><small>${label}</small><strong>POT +${diff}</strong></div>
   <div class="mj-pot-wrap">${coinMarkup(diff)}<img class="mj-pot" src="${potAsset(from)}" alt="Pot"></div>
   <div class="mj-counter"><b data-value>${from}</b><span data-fraction>${from} / ${CONFIG.pot.max} POT</span></div>
  </div>`;
  timer=setTimeout(()=>{
   root.querySelector('.mj-pot').src=potAsset(to);
   root.querySelector('[data-value]').textContent=to;
   root.querySelector('[data-fraction]').textContent=`${to} / ${CONFIG.pot.max} POT`;
  },260);
  timer=setTimeout(()=>{hide();onDone?.()},CONFIG.jackpot.potFillMs);
 }
 function showDecision({name,potValue,onChoose}={}){
  hide();root.classList.add('is-open','is-blocking');
  root.innerHTML=`<section class="mj-panel mj-decision">
   <div class="mj-logo-text">JACKPOT</div>
   <small class="mj-kicker">GEHEIME ENTSCHEIDUNG</small>
   <h2>TAKE ODER SPIN?</h2>
   <p>${name||'DU'} hat die Minority getroffen.</p>
   <div class="mj-rule-strip">
    <span><b>ALLE TAKE</b> voller Pot</span>
    <span><b>JEMAND SPIN</b> TAKE −1</span>
    <span><b>NUR 1× SPIN</b> Slot +1</span>
   </div>
   <div class="mj-actions">
    <button type="button" data-choice="TAKE"><strong>TAKE</strong><b>+${potValue} SICHER</b><span>+${Math.max(0,potValue-1)}, falls jemand SPIN wählt</span></button>
    <button type="button" data-choice="SPIN" class="is-spin"><strong>SPIN</strong><b>SLOT MIT ${potValue}</b><span>Slot mit ${potValue+1}, wenn nur du SPIN wählst</span></button>
   </div>
  </section>`;
  root.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{const choice=btn.dataset.choice;hide();onChoose?.(choice)}));
 }
 function showDecisionReveal({rows,spinCount=0,playerName,onDone}={}){
  hide();root.classList.add('is-open','is-blocking');
  root.innerHTML=`<section class="mj-panel mj-reveal">
   <small class="mj-kicker">JACKPOT REVEAL</small><h2>ENTSCHEIDUNGEN.</h2>
   <div class="mj-reveal-list">${rows.map(row=>`<div class="mj-reveal-row" style="--identity:${playerColor(row.seat)}"><i></i><span><strong>${playerName(row.seat)}</strong><small>${row.decision==='SPIN'?(row.loneWolf?'LONE WOLF · SLOT +1':'SLOT MACHINE'):(spinCount===0?'TAKE · VOLLER POT':'TAKE · −1 WEGEN SPINNER')}</small></span><b>${row.decision==='SPIN'?'SPIN '+row.slotBase:'+'+row.takePayout}</b></div>`).join('')}</div>
  </section>`;
  timer=setTimeout(()=>{hide();onDone?.()},CONFIG.jackpot.decisionRevealMs);
 }
 function showSpin({name,base,autoStart=false,onResolved}={}){
  hide();root.classList.add('is-open','is-blocking');
  const symbols=CONFIG.slot.symbols;
  root.innerHTML=`<section class="mj-panel mj-slot">
   <div class="mj-logo-text">JACKPOT</div>
   <small class="mj-kicker">SLOT · ${name}</small><h2>BASIS ${base}</h2>
   <div class="mj-reels">${[0,1,2].map((_,i)=>`<div class="mj-reel" data-reel="${i}"><span>${symbols[i].glyph}</span></div>`).join('')}</div>
   <div class="mj-slot-result" data-result>SPIN BEREIT</div>
   <button class="mj-spin-button" type="button">SPIN →</button>
  </section>`;
  const button=root.querySelector('.mj-spin-button');
  const startSpin=()=>{
   if(button.disabled)return;
   button.disabled=true;button.textContent='DREHT …';
   const ids=ENGINE.spin();
   const reels=[...root.querySelectorAll('[data-reel]')];
   let tick=0;
   const interval=setInterval(()=>{tick++;reels.forEach((reel,i)=>{reel.querySelector('span').textContent=symbols[(tick+i)%symbols.length].glyph})},60);
   [700,950,1200].forEach((ms,i)=>setTimeout(()=>{
    const symbol=symbols.find(s=>s.id===ids[i]);reels[i].querySelector('span').textContent=symbol.glyph;reels[i].classList.add('is-stopped');
    if(i===2){
     clearInterval(interval);
     const result=ENGINE.spinPayout(base,ids);
     root.querySelector('[data-result]').innerHTML=`<strong>${result.label}</strong><b>+${result.payout}</b><span>${String(result.multiplier).replace('.',',')}× BASIS</span>`;
     button.disabled=false;button.textContent='WEITER →';button.onclick=()=>{hide();onResolved?.(result)};
     if(autoStart)setTimeout(()=>button.click(),360);
    }
   },ms));
  };
  button.addEventListener('click',startSpin,{once:true});
  if(autoStart)setTimeout(()=>button.click(),360);
 }
 return {hide,showPotFill,showDecision,showDecisionReveal,showSpin};
}
globalThis.SkielsenMinorityJackpotUI=Object.freeze({create:makeUi});
})();