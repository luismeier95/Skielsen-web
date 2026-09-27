(()=>{
'use strict';
const scriptUrl=document.currentScript?.src||location.href;
const publicRoot=new URL('../',scriptUrl);
const url=relative=>new URL(relative,publicRoot).href;
const games=Object.freeze({
 minority:Object.freeze({
  key:'minority',
  active:'stable',
  builds:Object.freeze({
   stable:Object.freeze({status:'stable',url:url('minority-test/')}),
   lab:Object.freeze({status:'lab',url:url('games/minority/lab/')})
  })
 })
});
globalThis.SkielsenGameManifest=Object.freeze({
 version:1,games,
 resolve(gameKey,build='stable'){
  const target=games[gameKey]?.builds?.[build];
  if(!target)throw new Error(`UNKNOWN_GAME_BUILD: ${gameKey}/${build}`);
  return target.url;
 }
});
})();