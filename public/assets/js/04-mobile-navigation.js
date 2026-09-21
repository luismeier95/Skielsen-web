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
    // The primary mobile navigation is a fixed 76px dock. MORE always overlays
    // every secondary dock and therefore must not depend on runtime measurements.
    document.documentElement.style.setProperty('--mobile-more-bottom','76px');
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
    menu.style.removeProperty('transition');
    menu.style.removeProperty('transform');
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    btn.setAttribute('aria-expanded','false');
    backdrop.hidden=true;
    document.body.classList.remove('mobile-more-open');
  }

  btn.addEventListener('click',()=>menu.classList.contains('open')?closeMore():openMore());
  backdrop.addEventListener('click',closeMore);
  if(closeBtn)closeBtn.addEventListener('click',closeMore);

  // Selecting a destination always closes MORE immediately.
  menu.addEventListener('click',e=>{
    if(!e.target.closest('[data-page]'))return;
    closeMore();
    requestAnimationFrame(closeMore);
  });

  // Swipe down to dismiss the bottom sheet.
  let dragStartY=0,dragStartX=0,dragY=0,dragStartedAt=0,dragging=false;
  function clearDrag(){
    dragging=false;dragY=0;
    menu.style.removeProperty('transition');
    menu.style.removeProperty('transform');
  }
  menu.addEventListener('touchstart',e=>{
    if(!menu.classList.contains('open')||menu.scrollTop>0||!e.touches?.length)return;
    const t=e.touches[0];
    dragStartY=t.clientY;dragStartX=t.clientX;dragY=0;dragStartedAt=performance.now();dragging=false;
  },{passive:true});
  menu.addEventListener('touchmove',e=>{
    if(!menu.classList.contains('open')||!e.touches?.length)return;
    const t=e.touches[0],dy=t.clientY-dragStartY,dx=t.clientX-dragStartX;
    if(dy<=0||Math.abs(dx)>Math.abs(dy))return;
    if(dy<8&&!dragging)return;
    dragging=true;dragY=dy;
    e.preventDefault();
    menu.style.transition='none';
    menu.style.transform='translateY('+Math.min(dy,menu.offsetHeight)+'px)';
  },{passive:false});
  menu.addEventListener('touchend',()=>{
    if(!dragging){clearDrag();return}
    const elapsed=Math.max(1,performance.now()-dragStartedAt);
    const velocity=dragY/elapsed;
    if(dragY>=58||velocity>=0.45){
      clearDrag();
      closeMore();
    }else{
      clearDrag();
    }
  },{passive:true});
  menu.addEventListener('touchcancel',clearDrag,{passive:true});

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
