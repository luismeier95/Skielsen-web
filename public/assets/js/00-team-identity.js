(()=>{
'use strict';

const CORE=Object.freeze({
  BLUE:Object.freeze({id:'BLUE',label:'BLAU',hex:'#1515FF',css:'var(--core-blue)'}),
  RED:Object.freeze({id:'RED',label:'ROT',hex:'#FF1717',css:'var(--core-red)'}),
  YELLOW:Object.freeze({id:'YELLOW',label:'GELB',hex:'#F2B705',css:'var(--core-yellow)'}),
  GREEN:Object.freeze({id:'GREEN',label:'GRÜN',hex:'#00A65A',css:'var(--core-green)'})
});
const CORE2=Object.freeze({
  BLUE:Object.freeze({id:'BLUE',label:'BLAU',hex:'#2979FF',css:'var(--core-blue)'}),
  RED:Object.freeze({id:'RED',label:'ROT',hex:'#FF1744',css:'var(--core-red)'}),
  YELLOW:Object.freeze({id:'YELLOW',label:'GELB',hex:'#00F5D4',css:'var(--core-yellow)'}),
  GREEN:Object.freeze({id:'GREEN',label:'GRÜN',hex:'#FF2ED1',css:'var(--core-green)'})
});
const CORE2_ID='theme.skielsen.core2';

function normalize(color){return String(color||'').toUpperCase()}
function currentTheme(){
  return String(
    document.documentElement?.dataset?.themePack||
    document.body?.dataset?.themePack||
    document.documentElement?.dataset?.themeId||
    'theme.skielsen.core'
  );
}
function palette(themeId=currentTheme()){return themeId===CORE2_ID?CORE2:CORE}
function entry(color,themeId=currentTheme()){return palette(themeId)[normalize(color)]||null}
function css(color,fallback='var(--theme-muted)'){return entry(color)?.css||fallback}
function hex(color,themeId=currentTheme(),fallback='#777777'){return entry(color,themeId)?.hex||fallback}
function label(color,fallback='TEAM'){return CORE[normalize(color)]?.label||fallback}

window.skielsenTeamIdentity=Object.freeze({
  coreThemeId:'theme.skielsen.core',
  core2ThemeId:CORE2_ID,
  core:CORE,
  core2:CORE2,
  normalize,currentTheme,palette,entry,css,hex,label
});
})();