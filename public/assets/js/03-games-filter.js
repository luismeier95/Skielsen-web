(function(){
 let env="all", status="all";
 const cards=[...document.querySelectorAll(".game-catalog-card")];
 function apply(){
   cards.forEach(c=>{
     const envOK=env==="all" || (c.dataset.environment||"").split(" ").includes(env);
     const statOK=status==="all" || c.dataset.status===status;
     c.hidden=!(envOK&&statOK);
   });
 }
 document.querySelectorAll("[data-game-filter]").forEach(b=>b.addEventListener("click",()=>{
   env=b.dataset.gameFilter;
   document.querySelectorAll("[data-game-filter]").forEach(x=>x.classList.toggle("active",x===b)); apply();
 }));
 document.querySelectorAll("[data-status-filter]").forEach(b=>b.addEventListener("click",()=>{
   status=b.dataset.statusFilter;
   document.querySelectorAll("[data-status-filter]").forEach(x=>x.classList.toggle("active",x===b)); apply();
 }));
})();
