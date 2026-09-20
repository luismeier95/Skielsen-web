(()=>{
'use strict';
const VERSION='15.1.58';
window.SKIELSEN_VERSION=VERSION;
function syncVersion(root=document){
  document.title=`SKIELSEN V${VERSION}`;
  root.querySelectorAll('[data-skielsen-version]').forEach(el=>el.textContent=`V${VERSION}`);
}
window.skielsenSyncVersion=syncVersion;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>syncVersion(),{once:true});
else syncVersion();
})();
