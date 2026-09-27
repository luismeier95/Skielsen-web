(()=>{
'use strict';
const CONFIG=globalThis.SkielsenMinorityLabConfig;
const ENGINE=globalThis.SkielsenMinorityJackpotEngine;
if(!CONFIG||!ENGINE)throw new Error('MINORITY_JACKPOT_DEPENDENCY_REQUIRED');

function makeUi(root){
 if(!root)throw new Error('MINORITY_JACKPOT_ROOT_REQUIRED');
 const timers=new Set();
 function later(fn,ms){
  const handle=setTimeout(()=>{timers.delete(handle);fn()},ms);
  timers.add(handle);
  return handle;
 }
 function clearTimers(){for(const handle of timers)clearTimeout(handle);timers.clear()}
 function hide(){clearTimers();root.classList.remove('is-open','is-blocking');root.innerHTML=''}
 function potAsset(value){return CONFIG.assets.potStages[Math.max(0,ENGINE.potStage(value)-1)]}
 function playerColor(seat){return ['#1515ff','#ff1717','#f2b705','#00a65a'][(Number(seat)-1)%4]}
 function coinMarkup(count){
  const offsets=[[-28,-8], [18,10], [-8,0], [32,7], [-18,-5]];
  return Array.from({length:Math.min(5,Math.max(1,count))},(_,i)=>{
   const [x,end]=offsets[i%offsets.length];
   return `<i class="mj-coin" style="--x:${x}px;--end:${end}px;--delay:${i*60}ms"><img src="${CONFIG.assets.coin}" alt=""></i>`;
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
  later(()=>{
   root.querySelector('.mj-pot').src=potAsset(to);
   root.querySelector('[data-value]').textContent=to;
   root.querySelector('[data-fraction]').textContent=`${to} / ${CONFIG.pot.max} POT`;
  },260);
  later(()=>{hide();onDone?.()},CONFIG.jackpot.potFillMs);
 }
 function showDecision({name,potValue,participantCount=1,onChoose}={}){
  hide();root.classList.add('is-open','is-blocking');
  const solo=Number(participantCount)===1;
  const ruleStrip=solo?'':`<div class="mj-rule-strip">
    <span><b>ALLE TAKE</b> voller Pot</span>
    <span><b>JEMAND SPIN</b> TAKE −1</span>
    <span><b>NUR 1× SPIN</b> Einsatz +1</span>
   </div>`;
  const takeSub=solo?'Punkte sofort sichern':`+${Math.max(0,potValue-1)}, falls jemand SPIN wählt`;
  const spinValue=solo?potValue+1:potValue;
  const spinSub=solo?'Du bist der einzige Spinner':`Einsatz ${potValue+1}, wenn nur du SPIN wählst`;
  root.innerHTML=`<section class="mj-panel mj-decision ${solo?'is-solo':''}">
   <img class="mj-logo" src="${CONFIG.assets.jackpotLogo}" alt="JACKPOT">
   <small class="mj-kicker">GEHEIME ENTSCHEIDUNG</small>
   <h2>TAKE ODER SPIN?</h2>
   <p>${name||'DU'} hat die Minority getroffen.</p>
   ${ruleStrip}
   <div class="mj-actions">
    <button type="button" data-choice="TAKE"><strong>TAKE</strong><b>+${potValue} SICHER</b><span>${takeSub}</span></button>
    <button type="button" data-choice="SPIN" class="is-spin"><strong>SPIN</strong><b>EINSATZ ${spinValue}</b><span>${spinSub}</span></button>
   </div>
  </section>`;
  root.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{const choice=btn.dataset.choice;hide();onChoose?.(choice)}));
 }
 function showResolutionBoard({rows,playerName}={}){
  hide();root.classList.add('is-open','is-blocking');
  root.innerHTML=`<section class="mj-panel mj-resolution">
   <small class="mj-kicker">JACKPOT</small>
   <h2>ERGEBNIS.</h2>
   <p>Diese Spieler durften über den Pot entscheiden.</p>
   <div class="mj-reveal-list">${rows.map(row=>{
    const isSpin=row.decision==='SPIN';
    const detail=isSpin
      ?'SPIN · EINSATZ '+row.slotBase
      :'TAKE';
    const status=isSpin
      ?'<div class="loader mj-loader" aria-label="Spin läuft"></div>'
      :'<b class="mj-payout is-ready">+'+row.takePayout+'</b>';
    return `<div class="mj-reveal-row" data-seat="${row.seat}" style="--identity:${playerColor(row.seat)}"><i></i><span><strong>${playerName(row.seat)}</strong><small data-detail>${detail}</small></span><div class="mj-row-status" data-status>${status}</div></div>`;
   }).join('')}</div>
  </section>`;

  return {
   updateSpin(seat,result){
    const row=root.querySelector('[data-seat="'+Number(seat)+'"]');
    if(!row)return;
    const detail=row.querySelector('[data-detail]');
    const status=row.querySelector('[data-status]');
    detail.textContent='SPIN · EINSATZ '+result.base;
    status.innerHTML='<b class="mj-payout is-ready">+'+result.payout+'</b>';
   },
   hide
  };
 }
 function showSpin({name,base,autoStart=false,onResolved}={}){
  hide();root.classList.add('is-open','is-blocking');
  const symbols=CONFIG.slot.symbols;
  root.innerHTML=`<section class="mj-panel mj-slot">
   <div class="mj-logo-text">JACKPOT</div>
   <small class="mj-kicker">SLOT · ${name}</small><h2>EINSATZ ${base}</h2>
   <div class="mj-reels">${[0,1,2].map((_,i)=>`<div class="mj-reel" data-reel="${i}"><img src="${symbols[i].asset}" alt="${symbols[i].label}"></div>`).join('')}</div>
   <div class="mj-slot-result is-empty" data-result aria-live="polite"></div>
   <button class="mj-spin-button" type="button">SPIN →</button>
  </section>`;
  const button=root.querySelector('.mj-spin-button');
  const startSpin=()=>{
   if(button.disabled)return;
   button.disabled=true;button.textContent='DREHT …';
   const ids=ENGINE.spin();
   const reels=[...root.querySelectorAll('[data-reel]')];
   let tick=0;
   const interval=setInterval(()=>{
    tick++;
    reels.forEach((reel,i)=>{
     if(reel.classList.contains('is-stopped'))return;
     const symbol=symbols[(tick+i)%symbols.length];
     const img=reel.querySelector('img');
     img.src=symbol.asset;
     img.alt=symbol.label;
    });
   },CONFIG.slot.tickMs);
   CONFIG.slot.reelStopMs.forEach((ms,i)=>later(()=>{
    const symbol=symbols.find(s=>s.id===ids[i]);
    const img=reels[i].querySelector('img');
    img.src=symbol.asset;
    img.alt=symbol.label;
    reels[i].classList.add('is-stopped');
    if(i===reels.length-1){
     clearInterval(interval);
     const result=ENGINE.spinPayout(base,ids);
     const resultNode=root.querySelector('[data-result]');
     button.textContent='AUSWERTUNG …';

     later(()=>{
      resultNode.classList.remove('is-empty');
      const delta=result.payout-result.base;
      const deltaSign=delta>0?'+':delta===0?'±':'';
      const deltaClass=delta>0?'is-positive':delta<0?'is-negative':'is-neutral';
      resultNode.innerHTML=`<strong>${result.label}</strong><div class="mj-slot-values mj-slot-values--triple"><span><small>EINSATZ</small><b>+${result.base}</b></span><span class="mj-slot-delta ${deltaClass}"><small>SPIN-EFFEKT</small><b>${deltaSign}${delta}</b></span><span><small>AUSZAHLUNG</small><b>+${result.payout}</b></span></div>`;
      button.disabled=false;
      button.textContent='WEITER →';
      button.onclick=()=>{hide();onResolved?.(result)};
      if(autoStart)later(()=>button.click(),360);
     },CONFIG.slot.resultRevealDelayMs);
    }
   },ms));
  };
  button.addEventListener('click',startSpin,{once:true});
  if(autoStart)later(()=>button.click(),360);
 }
 return {hide,showPotFill,showDecision,showResolutionBoard,showSpin};
}
globalThis.SkielsenMinorityJackpotUI=Object.freeze({create:makeUi});
})();