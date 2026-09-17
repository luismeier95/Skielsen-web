(()=>{
  const HOLD_MS = 2000;
  const START_PX = 12;

  /*
    Nur Aktionen, die im aktuellen ADMIN-Workflow eine endgültige bzw.
    bewusst zu bestätigende Zustandsänderung auslösen.
    Navigation, Korrektur-Pfeile, Rollenwahl und Coin-Korrekturen sind
    absichtlich NICHT Teil dieser Regel.
  */
  const mandatoryIds = [
    'gameControlStart',
    'quickResultConfirm',
    'gameControlConclude',
    'ttQuickConfirm',
    'ttConfirmSet',
    'ttFinishMatch',
    'publishAdminNews'
  ];

  function upgrade(button){
    if(!button || button.dataset.holdConfirmReady === 'true') return;
    button.dataset.holdConfirmReady = 'true';

    const originalLabel = (button.textContent || '').trim();
    button.dataset.holdOriginalLabel = originalLabel;

    button.classList.add('admin-mandatory-hold');

    const playMarkup =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M7 4l13 8-13 8z"></path>' +
      '</svg>';

    button.innerHTML =
      '<span class="mandatory-hold-fill" aria-hidden="true"></span>' +
      '<span class="mandatory-hold-copy">' +
        '<strong></strong>' +
        '<small>GEDRÜCKT HALTEN ZUM AUSFÜHREN</small>' +
      '</span>' +
      '<span class="mandatory-hold-action">' + playMarkup + '</span>';

    const fill = button.querySelector('.mandatory-hold-fill');
    const copy = button.querySelector('.mandatory-hold-copy');
    const action = button.querySelector('.mandatory-hold-action');
    copy.querySelector('strong').textContent = originalLabel;

    let startTime = 0;
    let raf = 0;
    let holding = false;
    let allowConfirmedClick = false;

    function targetWidth(){
      /*
        100 % = Buttonbreite MINUS rechter Play-Container.
        Damit endet der lila Progress exakt an dessen linker Kante.
      */
      return Math.max(START_PX, button.clientWidth - action.offsetWidth);
    }

    function render(progress){
      const p = Math.max(0, Math.min(1, progress));
      const width = START_PX + (targetWidth() - START_PX) * p;
      button.style.setProperty('--hold-progress', width + 'px');
    }

    function reset(){
      cancelAnimationFrame(raf);
      holding = false;
      startTime = 0;
      button.classList.remove('is-holding');
      if(button.querySelector('.mandatory-hold-action')){
        action.innerHTML = playMarkup;
        render(0);
      }
    }

    function fireConfirmedAction(){
      cancelAnimationFrame(raf);
      holding = false;
      button.classList.remove('is-holding');
      render(1);
      action.innerHTML = '<span class="mandatory-hold-done">✓</span>';

      /*
        Bestehende App-Logik bleibt unverändert:
        Nach 2 s wird ein normaler Click ausgelöst, den alle bereits
        vorhandenen Handler empfangen.
      */
      allowConfirmedClick = true;
      button.click();
      allowConfirmedClick = false;

      /*
        Wiederverwendbare Actions wie "Satz bestätigen" werden danach
        erneut armed. Aktionen, die sich selbst deaktivieren oder ihren
        Text ersetzen, bleiben in ihrem finalen Zustand.
      */
      setTimeout(()=>{
        if(!button.isConnected) return;

        const stillStructured = !!button.querySelector('.mandatory-hold-action');
        if(!stillStructured) return;

        if(button.disabled){
          action.innerHTML = '<span class="mandatory-hold-done">✓</span>';
          render(1);
        }else{
          reset();
        }
      }, 80);
    }

    function tick(now){
      if(!holding) return;
      const progress = (now - startTime) / HOLD_MS;
      render(progress);

      if(progress >= 1){
        fireConfirmedAction();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function begin(){
      if(button.disabled || holding) return;
      holding = true;
      startTime = performance.now();
      button.classList.add('is-holding');
      action.innerHTML = playMarkup;
      raf = requestAnimationFrame(tick);
    }

    function cancel(){
      if(!holding) return;
      reset();
    }

    /*
      Vorhandene Click-Handler dürfen ausschließlich nach erfolgreichem
      2-Sekunden-Hold laufen.
    */
    button.addEventListener('click', event=>{
      if(allowConfirmedClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    button.addEventListener('pointerdown', event=>{
      if(button.disabled) return;
      event.preventDefault();
      try{ button.setPointerCapture(event.pointerId); }catch(_){}
      begin();
    });

    button.addEventListener('pointerup', cancel);
    button.addEventListener('pointercancel', cancel);
    button.addEventListener('lostpointercapture', cancel);
    button.addEventListener('contextmenu', event=>event.preventDefault());

    button.addEventListener('keydown', event=>{
      if((event.code === 'Space' || event.code === 'Enter') && !event.repeat){
        event.preventDefault();
        begin();
      }
    });
    button.addEventListener('keyup', event=>{
      if(event.code === 'Space' || event.code === 'Enter'){
        event.preventDefault();
        cancel();
      }
    });
    button.addEventListener('blur', cancel);

    render(0);
  }

  mandatoryIds.forEach(id=>upgrade(document.getElementById(id)));

  /*
    NEWS ist im SKIELSEN-Modell nach Publish unveränderlich.
    Der irreversible Hold wird deshalb erst aktiv, wenn wirklich Inhalt
    vorhanden ist.
  */
  const newsInput = document.getElementById('adminNewsInput');
  const newsPublish = document.getElementById('publishAdminNews');
  if(newsInput && newsPublish){
    const syncNewsState = ()=>{
      if(newsPublish.textContent.trim() === 'PUBLISHED') return;
      newsPublish.disabled = !newsInput.value.trim();
    };
    newsInput.addEventListener('input', syncNewsState);
    syncNewsState();
  }

  /*
    Tischtennis Quick Result: kein 2-Sekunden-Hold für ungültige Werte.
    Der Button wird erst scharf, wenn BO3 ein valides 2:x-Ergebnis hat.
  */
  const ttA = document.getElementById('ttQuickSetsA');
  const ttB = document.getElementById('ttQuickSetsB');
  const ttQuick = document.getElementById('ttQuickConfirm');

  function validTTQuick(){
    if(!ttA || !ttB) return false;
    const a = Number(ttA.value), b = Number(ttB.value);
    return Number.isInteger(a) &&
           Number.isInteger(b) &&
           a >= 0 && b >= 0 &&
           a <= 2 && b <= 2 &&
           a !== b &&
           Math.max(a,b) === 2;
  }

  function syncTTQuick(){
    if(ttQuick && !ttQuick.dataset.finalized){
      ttQuick.disabled = !validTTQuick();
    }
  }

  if(ttA && ttB && ttQuick){
    ttA.addEventListener('input', syncTTQuick);
    ttB.addEventListener('input', syncTTQuick);
    ttQuick.addEventListener('click', ()=>{
      if(validTTQuick()) ttQuick.dataset.finalized = 'true';
    });
    syncTTQuick();
  }

  window.addEventListener('resize', ()=>{
    document.querySelectorAll('.admin-mandatory-hold').forEach(btn=>{
      if(!btn.classList.contains('is-holding')){
        btn.style.setProperty('--hold-progress', START_PX + 'px');
      }
    });
  });
})();
