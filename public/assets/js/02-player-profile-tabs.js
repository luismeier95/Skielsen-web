(function(){
  function init(){
    const profile=document.getElementById("profilePage");
    if(!profile) return;
    const tabs=[...document.querySelectorAll("[data-player-section]")];

    function show(section){
      document.body.classList.remove("profile-matches-open","profile-subpage-open");
      profile.dataset.playerSectionOpen=section;

      tabs.forEach(tab=>{
        tab.classList.remove("active");
        tab.classList.toggle("is-current",tab.dataset.playerSection===section);
      });
      window.scrollTo(0,0);
    }

    tabs.forEach(tab=>{
      tab.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
        show(tab.dataset.playerSection);
      });
    });
    show("overview");
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
