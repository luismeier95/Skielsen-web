(function(){
  const btn=document.getElementById('mobileMoreBtn');
  const menu=document.getElementById('mobileMoreMenu');
  const backdrop=document.getElementById('mobileMoreBackdrop');
  const closeBtn=document.getElementById('mobileMoreClose');
  if(!btn||!menu||!backdrop)return;
  function openMore(){
    menu.classList.add('open');
    menu.setAttribute('aria-hidden','false');
    btn.setAttribute('aria-expanded','true');
    backdrop.hidden=false;
    document.body.classList.add('mobile-more-open');
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
  menu.querySelectorAll('[data-page]').forEach(a=>a.addEventListener('click',closeMore));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMore()});
  window.addEventListener('resize',()=>{if(window.innerWidth>800&&menu.classList.contains('open'))closeMore()});
  window.skielsenCloseMobileMore=closeMore;
})();
