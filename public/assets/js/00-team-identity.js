(()=>{
'use strict';

const PALETTE=Object.freeze({
  BLUE:Object.freeze({id:'BLUE',label:'BLAU',hex:'#2979FF',on:'#050505',cssClass:'team-blue'}),
  RED:Object.freeze({id:'RED',label:'ROT',hex:'#FF1744',on:'#050505',cssClass:'team-red'}),
  YELLOW:Object.freeze({id:'YELLOW',label:'PINK',hex:'#FF2ED1',on:'#050505',cssClass:'team-yellow'}),
  GREEN:Object.freeze({id:'GREEN',label:'TÜRKIS',hex:'#00F5D4',on:'#050505',cssClass:'team-green'})
});
const TEAM_ORDER=Object.freeze(['BLUE','RED','YELLOW','GREEN']);
const SOLO_ORDER=Object.freeze(['RED','BLUE','YELLOW','GREEN']);

function normalize(color){return String(color||'').toUpperCase()}
function entry(color){return PALETTE[normalize(color)]||null}
function hex(color,fallback='var(--theme-muted)'){return entry(color)?.hex||fallback}
function label(color,fallback='TEAM'){return entry(color)?.label||fallback}
function on(color,fallback='#050505'){return entry(color)?.on||fallback}
function cssClass(color,fallback='team-neutral'){return entry(color)?.cssClass||fallback}

window.skielsenTeamIdentity=Object.freeze({
  palette:PALETTE,
  teamOrder:TEAM_ORDER,
  soloOrder:SOLO_ORDER,
  normalize,entry,hex,label,on,cssClass
});

const root=document.documentElement;
root.style.setProperty('--team-blue','#2979FF');
root.style.setProperty('--team-red','#FF1744');
root.style.setProperty('--team-yellow','#FF2ED1');
root.style.setProperty('--team-green','#00F5D4');
root.style.setProperty('--team-on-blue','#050505');
root.style.setProperty('--team-on-red','#050505');
root.style.setProperty('--team-on-yellow','#050505');
root.style.setProperty('--team-on-green','#050505');
})();