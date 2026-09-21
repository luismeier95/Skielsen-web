(function(){
  const btn=document.getElementById('mobileMoreBtn');
  const menu=document.getElementById('mobileMoreMenu');
  const backdrop=document.getElementById('mobileMoreBackdrop');
  const closeBtn=document.getElementById('mobileMoreClose');
  if(!btn||!menu||!backdrop)return;

  let dockObserver=null;

  function isVisible(el){
    if(!el||el.hidden)return false;
    const style=getComputedStyle(el),rect=el.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
  }

  function syncDock(){
    if(window.innerWidth>800){
      document.documentElement.style.removeProperty('--mobile-more-bottom');
      return;
    }
    // MORE is an overlay above the primary bottom navigation. Secondary docks
    // (Admin Command / profile tabs) must never reduce the drawer viewport.
    const nav=document.querySelector('.mobile-nav');
    const boundary=isVisible(nav)?nav.getBoundingClientRect().top:window.innerHeight-76;
    const bottom=Math.max(0,Math.round(window.innerHeight-Math.max(0,Math.min(window.innerHeight,boundary))));
    document.documentElement.style.setProperty('--mobile-more-bottom',bottom+'px');
  }

  function observeDock(){
    if(typeof ResizeObserver!=='function')return;
    dockObserver?.disconnect();
    dockObserver=new ResizeObserver(()=>{if(menu.classList.contains('open'))syncDock()});
    [document.querySelector('.mobile-nav')]
      .filter(Boolean).forEach(el=>dockObserver.observe(el));
  }

  function openMore(){
    syncDock();
    observeDock();
    menu.classList.add('open');
    menu.setAttribute('aria-hidden','false');
    btn.setAttribute('aria-expanded','true');
    backdrop.hidden=false;
    document.body.classList.add('mobile-more-open');
    requestAnimationFrame(syncDock);
  }

  function closeMore(){
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    btn.setAttribute('aria-expanded','false');
    backdrop.hidden=true;
    document.body.classList.remove('mobile-more-open');
  }

  btn.addEventListener('click',()=>menu.classList.contains('open')?closeMore():openMore());
  backdrop.addEventListener('click',closeMore);
  if(closeBtn)closeBtn.addEventListener('click',closeMore);

  // Keep navigation deterministic: select the page first, then close the drawer.
  menu.addEventListener('click',e=>{
    if(!e.target.closest('[data-page]'))return;
    requestAnimationFrame(closeMore);
  });

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMore()});
  window.addEventListener('resize',()=>{
    if(window.innerWidth>800&&menu.classList.contains('open'))closeMore();
    syncDock();
  });
  window.addEventListener('skielsen:tournament-render',()=>{
    if(!menu.classList.contains('open'))return;
    requestAnimationFrame(()=>{observeDock();syncDock()});
  });

  syncDock();
  window.skielsenCloseMobileMore=closeMore;
})();
