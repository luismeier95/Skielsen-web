(()=>{
'use strict';
const KEY='__skielsen_nav_v1';
const handlers=new Map();
let restoring=false;

function cloneData(data){
  if(!data||typeof data!=='object')return {};
  try{return JSON.parse(JSON.stringify(data))}catch(_){return {}}
}
function current(){
  const raw=history.state&&history.state[KEY];
  return raw&&raw.area&&raw.view?raw:null;
}
function same(a,b){
  if(!a||!b||a.area!==b.area||a.view!==b.view)return false;
  try{return JSON.stringify(a.data||{})===JSON.stringify(b.data||{})}catch(_){return false}
}
function write(mode,area,view,data={}){
  if(!area||!view)return null;
  const next={version:1,area:String(area),view:String(view),data:cloneData(data)};
  const prev=current();
  if(mode==='push'&&same(prev,next))return prev;
  const base=history.state&&typeof history.state==='object'?{...history.state}:{};
  base[KEY]=next;
  if(mode==='replace')history.replaceState(base,'',location.href);
  else history.pushState(base,'',location.href);
  return next;
}
function register(area,handler){
  if(area&&typeof handler==='function')handlers.set(String(area),handler);
}
async function restore(entry){
  if(!entry?.area)return false;
  const handler=handlers.get(entry.area);
  if(!handler)return false;
  restoring=true;
  try{await handler(entry);return true}
  catch(err){console.error('SKIELSEN history restore failed',err);return false}
  finally{restoring=false}
}
window.addEventListener('popstate',event=>{
  const entry=event.state&&event.state[KEY];
  if(entry)void restore(entry);
});
window.skielsenHistory={
  push:(area,view,data)=>write('push',area,view,data),
  replace:(area,view,data)=>write('replace',area,view,data),
  register,
  current,
  restore,
  isRestoring:()=>restoring,
  back:()=>history.back(),
  forward:()=>history.forward()
};
})();
