(()=>{
'use strict';
const displayMode=()=>{
  if(window.matchMedia?.('(display-mode: fullscreen)').matches)return 'fullscreen';
  if(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true)return 'standalone';
  return 'browser';
};
const syncMode=()=>{
  const mode=displayMode();
  document.documentElement.dataset.skielsenDisplayMode=mode;
  document.documentElement.classList.toggle('skielsen-installed',mode!=='browser');
};
syncMode();
try{window.matchMedia?.('(display-mode: fullscreen)').addEventListener('change',syncMode)}catch(_){}
try{window.matchMedia?.('(display-mode: standalone)').addEventListener('change',syncMode)}catch(_){}

let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  window.dispatchEvent(new CustomEvent('skielsen:pwa-install-available'));
});
window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  syncMode();
});

window.skielsenPwa={
  get displayMode(){return displayMode()},
  get installAvailable(){return !!installPrompt},
  async install(){
    if(!installPrompt)return {available:false};
    const prompt=installPrompt;
    installPrompt=null;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    return {available:true,outcome:choice?.outcome||'unknown'};
  }
};

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(err=>console.warn('PWA service worker registration failed',err));
  },{once:true});
}
})();
