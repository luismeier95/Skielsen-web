(function(){
 const games=document.getElementById("gamesPage"), index=document.getElementById("gamesIndex");
 if(!games)return;
 document.addEventListener("click",e=>{
   const nav=e.target.closest('[data-page="games"]');
   if(nav){e.preventDefault();document.querySelectorAll(".app-page").forEach(p=>p.classList.remove("active"));games.classList.add("active");document.querySelectorAll(".main-nav a").forEach(a=>a.classList.remove("active"));nav.classList.add("active");index.style.display="block";games.querySelectorAll(".game-detail").forEach(x=>x.classList.remove("active"));window.scrollTo(0,0);return}
   const open=e.target.closest("[data-game-open]");
   if(open){index.style.display="none";games.querySelectorAll(".game-detail").forEach(x=>x.classList.remove("active"));document.getElementById(open.dataset.gameOpen)?.classList.add("active");window.scrollTo(0,0);return}
   if(e.target.closest("[data-game-back]")){games.querySelectorAll(".game-detail").forEach(x=>x.classList.remove("active"));index.style.display="block";window.scrollTo(0,0)}
 },true);
})();
