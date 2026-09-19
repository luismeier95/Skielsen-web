(()=>{
'use strict';

const VERSION=window.SKIELSEN_VERSION||'15.1.39';

const TOKEN_MAP=Object.freeze({
  root_canvas:'--theme-root-canvas',
  browser_color:'--theme-browser-color',
  page:'--theme-page',
  on_page:'--theme-on-page',
  surface:'--theme-surface',
  on_surface:'--theme-on-surface',
  surface_soft:'--theme-surface-soft',
  on_surface_soft:'--theme-on-surface-soft',
  surface_muted:'--theme-surface-muted',
  on_surface_muted:'--theme-on-surface-muted',
  border:'--theme-border',
  border_strong:'--theme-border-strong',
  muted:'--theme-muted',
  faint:'--theme-faint',
  placeholder:'--theme-placeholder',
  header:'--theme-header',
  on_header:'--theme-on-header',
  nav:'--theme-nav',
  on_nav:'--theme-on-nav',
  nav_muted:'--theme-nav-muted',
  inverse_surface:'--theme-inverse-surface',
  on_inverse:'--theme-on-inverse',
  accent:'--theme-accent',
  on_accent:'--theme-on-accent',
  accent_2:'--theme-accent-2',
  primary_action:'--theme-primary-action',
  on_primary_action:'--theme-on-primary-action',
  secondary_action:'--theme-secondary-action',
  on_secondary_action:'--theme-on-secondary-action',
  secondary_border:'--theme-secondary-border',
  success_bg:'--theme-success-bg',
  on_success:'--theme-on-success',
  danger_bg:'--theme-danger-bg',
  on_danger:'--theme-on-danger',
  warning_bg:'--theme-warning-bg',
  on_warning:'--theme-on-warning',
  disabled_bg:'--theme-disabled-bg',
  on_disabled:'--theme-on-disabled',
  disabled_border:'--theme-disabled-border',
  input_bg:'--theme-input-bg',
  on_input:'--theme-on-input',
  input_border:'--theme-input-border',
  chip_bg:'--theme-chip-bg',
  on_chip:'--theme-on-chip',
  ribbon_bg:'--theme-ribbon-bg',
  on_ribbon:'--theme-on-ribbon',
  ribbon_border:'--theme-ribbon-border',
  dialog_bg:'--theme-dialog-bg',
  on_dialog:'--theme-on-dialog',
  overlay:'--theme-overlay',
  shadow:'--theme-shadow',
  shadow_soft:'--theme-shadow-soft',
  focus:'--theme-focus',
  less_action:'--theme-less-action',
  on_less_action:'--theme-on-less-action',
  more_action:'--theme-more-action',
  on_more_action:'--theme-on-more-action'
});

const REQUIRED=Object.freeze(Object.keys(TOKEN_MAP));
const COLOR_KEYS=new Set([
  'root_canvas','browser_color','page','on_page','surface','on_surface','surface_soft','on_surface_soft',
  'surface_muted','on_surface_muted','border','border_strong','muted','faint','placeholder','header','on_header',
  'nav','on_nav','nav_muted','inverse_surface','on_inverse','accent','on_accent','accent_2','primary_action',
  'on_primary_action','secondary_action','on_secondary_action','secondary_border','success_bg','on_success',
  'danger_bg','on_danger','warning_bg','on_warning','disabled_bg','on_disabled','disabled_border','input_bg',
  'on_input','input_border','chip_bg','on_chip','ribbon_bg','on_ribbon','ribbon_border','dialog_bg','on_dialog',
  'overlay','focus','less_action','on_less_action','more_action','on_more_action'
]);
const SHADOW_KEYS=new Set(['shadow','shadow_soft']);
let appliedProperties=new Set();

function unwrap(input){
  if(!input||typeof input!=='object')return null;
  return input.theme_contract&&typeof input.theme_contract==='object'?input.theme_contract:input;
}
function valueSafe(value){
  const v=String(value??'').trim();
  return !!v&&!/[;{}]/.test(v)&&!/url\s*\(/i.test(v);
}
function cssSupports(prop,value){
  try{return !window.CSS||typeof window.CSS.supports!=='function'||window.CSS.supports(prop,value)}
  catch(_){return false}
}
const CONTRAST_PAIRS=Object.freeze([
  ['on_page','page'],['on_surface','surface'],['on_surface_soft','surface_soft'],['on_surface_muted','surface_muted'],
  ['on_header','header'],['on_nav','nav'],['on_inverse','inverse_surface'],['on_accent','accent'],
  ['on_primary_action','primary_action'],['on_secondary_action','secondary_action'],['on_disabled','disabled_bg'],
  ['on_input','input_bg'],['on_chip','chip_bg'],['on_success','success_bg'],['on_danger','danger_bg'],
  ['on_warning','warning_bg'],['on_ribbon','ribbon_bg'],['on_dialog','dialog_bg'],['placeholder','input_bg']
]);
function rgb(hex){
  let v=String(hex||'').trim().toLowerCase();
  if(/^#[0-9a-f]{3}$/.test(v))v='#'+[...v.slice(1)].map(x=>x+x).join('');
  if(!/^#[0-9a-f]{6}$/.test(v))return null;
  return [1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255);
}
function luminance(hex){
  const x=rgb(hex);if(!x)return null;
  const lin=n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);
  return .2126*lin(x[0])+.7152*lin(x[1])+.0722*lin(x[2]);
}
function contrast(fg,bg){
  const a=luminance(fg),b=luminance(bg);if(a==null||b==null)return null;
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function validate(input,options={}){
  const contract=unwrap(input);
  if(!contract||Number(contract.version)<2||!contract.tokens||typeof contract.tokens!=='object'){
    return {ok:false,error:'THEME_CONTRACT_V2_REQUIRED',contract:null};
  }
  const tokens=contract.tokens,missing=REQUIRED.filter(key=>!valueSafe(tokens[key]));
  if(missing.length)return {ok:false,error:'THEME_CONTRACT_MISSING_TOKENS',missing,contract:null};
  const invalid=[];
  for(const key of REQUIRED){
    const value=String(tokens[key]).trim();
    if(COLOR_KEYS.has(key)&&!cssSupports('color',value))invalid.push(key);
    else if(SHADOW_KEYS.has(key)&&!cssSupports('box-shadow',value))invalid.push(key);
  }
  if(invalid.length)return {ok:false,error:'THEME_CONTRACT_INVALID_VALUES',invalid,contract:null};
  const contrastFailures=[];
  for(const [fg,bg] of CONTRAST_PAIRS){
    const ratio=contrast(tokens[fg],tokens[bg]);
    if(ratio==null||ratio<4.5)contrastFailures.push({fg,bg,ratio});
  }
  if(options.themePackId&&!['theme.skielsen.core','theme.skielsen.core2'].includes(options.themePackId)){
    for(const [fg,bg] of [['on_less_action','less_action'],['on_more_action','more_action']]){
      const ratio=contrast(tokens[fg],tokens[bg]);
      if(ratio==null||ratio<4.5)contrastFailures.push({fg,bg,ratio});
    }
  }
  if(contrastFailures.length)return {ok:false,error:'THEME_CONTRACT_CONTRAST_FAILED',contrastFailures,contract:null};
  return {ok:true,error:null,contract:{version:Number(contract.version),tokens:{...tokens}}};
}
function clearInlineProperties(){
  const roots=[document.documentElement,document.body].filter(Boolean);
  for(const prop of appliedProperties)for(const root of roots)root.style.removeProperty(prop);
  appliedProperties=new Set();
}
function setThemeIdentity(themePackId,animations,context){
  const theme=String(themePackId||'theme.skielsen.core');
  document.documentElement.dataset.themePack=theme;
  document.body.dataset.themePack=theme;
  document.documentElement.dataset.themeAnimations=animations?'true':'false';
  document.body.dataset.themeAnimations=animations?'true':'false';
  document.body.classList.toggle('skielsen-theme-context',context==='workflow');
}
function apply(themePackId,input,options={}){
  const theme=String(themePackId||'theme.skielsen.core');
  const animations=!!options.animations,context=options.context||'tournament';
  setThemeIdentity(theme,animations,context);
  const checked=validate(input,{themePackId:theme});
  if(!checked.ok){
    console.warn('SKIELSEN Theme Contract rejected',theme,checked.error,checked.missing||checked.invalid||'');
    return false;
  }
  clearInlineProperties();
  const roots=[document.documentElement,document.body];
  for(const [key,prop] of Object.entries(TOKEN_MAP)){
    const value=String(checked.contract.tokens[key]).trim();
    for(const root of roots)root.style.setProperty(prop,value);
    appliedProperties.add(prop);
  }
  const tokens=checked.contract.tokens;
  document.documentElement.style.backgroundColor=String(tokens.root_canvas);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',String(tokens.browser_color));
  return true;
}
function clear(){
  clearInlineProperties();
  for(const root of [document.documentElement,document.body]){
    if(!root)continue;
    delete root.dataset.themePack;
    delete root.dataset.themeAnimations;
  }
  document.body?.classList.remove('skielsen-theme-context');
  document.documentElement.style.backgroundColor='';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content','#e9e9e9');
}
function catalogRow(catalog,themePackId){
  return (Array.isArray(catalog)?catalog:[]).find(row=>row?.theme_pack_id===themePackId)||null;
}
function contractFromCatalog(catalog,themePackId){
  return catalogRow(catalog,themePackId)?.theme_contract||null;
}

window.skielsenThemeContract={
  version:VERSION,
  contractVersion:2,
  tokenMap:TOKEN_MAP,
  requiredTokens:REQUIRED,
  validate,
  apply,
  clear,
  catalogRow,
  contractFromCatalog
};
})();