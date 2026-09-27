(()=>{
'use strict';
const CHANNEL='skielsen-game';
const VERSION=1;
const TYPES=Object.freeze({
 READY:'SKIELSEN_GAME_READY',
 INIT:'SKIELSEN_GAME_INIT',
 STATE:'SKIELSEN_GAME_STATE',
 SCORE_UPDATE:'SKIELSEN_SCORE_UPDATE',
 JOKER_REQUIRED:'SKIELSEN_JOKER_REQUIRED',
 FINISHED:'SKIELSEN_GAME_FINISHED',
 CLOSE:'SKIELSEN_GAME_CLOSE',
 ERROR:'SKIELSEN_GAME_ERROR'
});
const makeId=()=>`msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const valid=m=>!!m&&m.channel===CHANNEL&&m.version===VERSION&&typeof m.type==='string';
const envelope=(type,payload={},meta={})=>({channel:CHANNEL,version:VERSION,id:makeId(),type,payload,meta,timestamp:Date.now()});
function on(map,type,fn){if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);return()=>map.get(type)?.delete(fn)}
function emit(map,message,event){for(const fn of map.get(message.type)||[])fn(message.payload,message,event);for(const fn of map.get('*')||[])fn(message.payload,message,event)}
function createGameClient({gameKey='unknown',build='lab',targetOrigin=location.origin}={}){
 const listeners=new Map();
 const parentWindow=window.parent;
 const receive=event=>{if(event.source!==parentWindow||event.origin!==targetOrigin||!valid(event.data))return;emit(listeners,event.data,event)};
 window.addEventListener('message',receive);
 const send=(type,payload={},meta={})=>{if(parentWindow===window)return false;parentWindow.postMessage(envelope(type,payload,{gameKey,build,...meta}),targetOrigin);return true};
 return {
  TYPES,gameKey,build,send,on:(type,fn)=>on(listeners,type,fn),
  ready:capabilities=>send(TYPES.READY,{gameKey,build,capabilities}),
  state:payload=>send(TYPES.STATE,payload),
  score:payload=>send(TYPES.SCORE_UPDATE,payload),
  finish:payload=>send(TYPES.FINISHED,payload),
  close:(payload={})=>send(TYPES.CLOSE,payload),
  error:payload=>send(TYPES.ERROR,payload),
  destroy(){listeners.clear();window.removeEventListener('message',receive)}
 };
}
function createHost(iframe,{initPayload={},targetOrigin=location.origin,autoInit=true}={}){
 if(!(iframe instanceof HTMLIFrameElement))throw new TypeError('iframe required');
 const listeners=new Map();let init=initPayload;
 const send=(type,payload={},meta={})=>{if(!iframe.contentWindow)return false;iframe.contentWindow.postMessage(envelope(type,payload,meta),targetOrigin);return true};
 const sendInit=(payload=init)=>{init=payload||{};return send(TYPES.INIT,init,{host:true})};
 const receive=event=>{
  if(event.source!==iframe.contentWindow||event.origin!==targetOrigin||!valid(event.data))return;
  if(event.data.type===TYPES.READY&&autoInit)sendInit();
  emit(listeners,event.data,event);
 };
 window.addEventListener('message',receive);
 return {TYPES,send,sendInit,setInitPayload:v=>{init=v||{}},on:(type,fn)=>on(listeners,type,fn),destroy(){listeners.clear();window.removeEventListener('message',receive)}};
}
globalThis.SkielsenGameBridge=Object.freeze({CHANNEL,VERSION,TYPES,valid,envelope,createGameClient,createHost});
})();