(()=>{
'use strict';
if(!globalThis.SkielsenGameBridge)return;
document.documentElement.dataset.skielsenBuild='lab';
const client=SkielsenGameBridge.createGameClient({gameKey:'minority',build:'lab'});
client.on(SkielsenGameBridge.TYPES.INIT,payload=>{
 globalThis.__SKIELSEN_GAME_INIT__=payload;
 window.dispatchEvent(new CustomEvent('skielsen:game-init',{detail:payload}));
});
client.ready({
 isolatedApp:true,
 compatibilityCopy:true,
 initConsumption:false,
 note:'LAB is a copy of current Minority. Host INIT is exposed for the migration but legacy logic does not consume it yet.'
});
globalThis.SkielsenMinorityLabBridge=client;
})();