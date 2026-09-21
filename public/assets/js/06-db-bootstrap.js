(async()=>{
  const APP_VERSION=window.SKIELSEN_VERSION||'15.1.81';
  const SUPABASE_URL='https://rlppuqjolkrwumrrjajq.supabase.co';
  const SUPABASE_KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
  const SHOP_DOC="<!doctype html>\n<html lang=\"de\" data-theme-id=\"theme.skielsen.core\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>SKIELSEN · Tournament Shop</title>\n<link rel=\"stylesheet\" href=\"assets/css/shop.css?v=__SKIELSEN_VERSION__\">\n</head>\n<body>\n<header class=\"topbar\">\n  <div class=\"topbar-inner\">\n    <div class=\"logo\"><img alt=\"SKIELSEN\" src=\"assets/images/skielsen-logo.png\"><small>V__SKIELSEN_VERSION__ · TOURNAMENT BUILDER</small></div>\n    <div class=\"shop-top-actions\"><button class=\"shop-home-nav\" id=\"shopHomeBtn\" type=\"button\">MEIN SKIELSEN</button><div class=\"top-meta\">ADMIN-EINRICHTUNG<br>SHOP-PROTOTYP</div></div>\n  </div>\n</header>\n<div class=\"color-strip\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i></div>\n\n<nav class=\"setup-steps\" aria-label=\"Turnier Setup\">\n  <div class=\"steps-inner\">\n    <div class=\"step done\"><b>01</b><span>TURNIER</span></div>\n    <div class=\"step active\"><b>02</b><span>SHOP & SPIELE</span></div>\n    <div class=\"step\"><b>03</b><span>ABSCHLUSS</span></div>\n    <div class=\"step\"><b>04</b><span>LOBBY</span></div>\n  </div>\n</nav>\n\n<main class=\"page\">\n  <button class=\"shop-local-back\" id=\"shopBackBtn\" type=\"button\">← ZURÜCK</button>\n  <section class=\"hero\">\n    <div class=\"eyebrow\">02 / TURNIER-SHOP</div>\n    <h1>BAU DEIN TURNIER.</h1>\n    <p>Spiele auswählen und optionale Design- oder Zusatzpakete hinzufügen. Die Reihenfolge legst du erst nach dem Abschluss fest; danach wird die Lobby geöffnet und der Einladungscode erzeugt.</p>\n  </section>\n\n  <section class=\"price-ladder\" id=\"priceLadder\">\n    <div class=\"tier\" data-tier=\"free\"><small>01 · KOSTENLOS</small><strong>1–4 SPIELE · 0,00 €</strong></div>\n    <div class=\"tier\" data-tier=\"standard\"><small>02 · ERWEITERT</small><strong>5–9 SPIELE · 4,99 €</strong></div>\n    <div class=\"tier\" data-tier=\"max\"><small>03 · MAXIMAL</small><strong>10+ SPIELE · 9,99 €</strong></div>\n  </section>\n\n  <div class=\"shop-layout\">\n    <div class=\"shop-main\">\n      <section class=\"shop-section\">\n        <header class=\"section-head\">\n          <div><small>01 / SPIELEKATALOG</small><h2>SPIELE AUSWÄHLEN</h2></div>\n          <div class=\"section-count\"><span id=\"selectedCount\">0</span>/10</div>\n        </header>\n        <div class=\"catalog-tools\">\n          <input class=\"search\" id=\"gameSearch\" type=\"search\" placeholder=\"SPIEL SUCHEN …\">\n          <div class=\"filter-block\">\n            <span class=\"filter-label\">SPIELART</span>\n            <div class=\"filters filter-scroll\" id=\"typeFilters\">\n              <button class=\"filter active\" data-tag-filter=\"all\">ALLE</button>\n            </div>\n          </div>\n          <div class=\"filter-block\">\n            <span class=\"filter-label\">ORT</span>\n            <div class=\"filters filter-scroll\" id=\"environmentFilters\">\n              <button class=\"filter active\" data-env-filter=\"all\">ALLE ORTE</button>\n              <button class=\"filter\" data-env-filter=\"indoor\">DRINNEN</button>\n              <button class=\"filter\" data-env-filter=\"outdoor\">DRAUSSEN</button>\n            </div>\n          </div>\n        </div>\n        <div class=\"games-grid\" id=\"gamesGrid\"></div>\n      </section>\n\n      <section class=\"shop-section\" id=\"extrasStart\">\n        <header class=\"section-head\">\n          <div><small>02 / DESIGNPAKET</small><h2>DESIGN & EXTRAS</h2></div>\n          <div class=\"section-count\">OPTIONAL</div>\n        </header>\n        <div class=\"pack-body\">\n          <p class=\"extras-gate-note\">SCHAU DIR VOR DEM ABSCHLUSS EINMAL DIE DESIGNS UND OPTIONALEN ERWEITERUNGEN AN. DU MUSST NICHTS HINZUFÜGEN.</p>\n          <div class=\"theme-preview\">\n            <article class=\"theme-preview-card active\" data-theme-card=\"theme.skielsen.core\">\n              <small>STANDARD · 0,00 €</small><strong>SKIELSEN CORE</strong>\n              <div class=\"swatches\"><i style=\"background:#050505\"></i><i style=\"background:#fff\"></i><i style=\"background:#7c5cff\"></i></div>\n            </article>\n            <article class=\"theme-preview-card\" data-theme-card=\"theme.jga.night\">\n              <small>THEME PACK · 2,99 €</small><strong>JGA NIGHT</strong>\n              <div class=\"swatches\"><i style=\"background:#050505\"></i><i style=\"background:#15151b\"></i><i style=\"background:#ff3d9a\"></i><i style=\"background:#b56cff\"></i></div>\n            </article>\n            <article class=\"theme-preview-card\" data-theme-card=\"theme.christmas.winter_clash\">\n              <small>THEME PACK · 2,99 €</small><strong>WINTER CLASH</strong>\n              <div class=\"swatches\"><i style=\"background:#0b5b36\"></i><i style=\"background:#b91f2c\"></i><i style=\"background:#e6bd58\"></i><i style=\"background:#fff8e8\"></i></div>\n            </article>\n            <article class=\"theme-preview-card\" data-theme-card=\"theme.summer.sunset_showdown\">\n              <small>THEME PACK · 2,99 €</small><strong>SUNSET SHOWDOWN</strong>\n              <div class=\"swatches\"><i style=\"background:#00a6b4\"></i><i style=\"background:#43d0c1\"></i><i style=\"background:#ffd447\"></i><i style=\"background:#ff6f61\"></i></div>\n            </article>\n            <article class=\"theme-preview-card\" data-theme-card=\"theme.girly.pink_chaos\">\n              <small>THEME PACK · 2,99 €</small><strong>PINK CHAOS</strong>\n              <div class=\"swatches\"><i style=\"background:#ff4fb3\"></i><i style=\"background:#ff7bc7\"></i><i style=\"background:#b983ff\"></i><i style=\"background:#fff7fd\"></i></div>\n            </article>\n          </div>\n\n          <div class=\"premium-shop\">\n            <div class=\"premium-shop-head\"><small>PREMIUM</small><strong>OPTIONALE ANIMATIONEN</strong><span>THEME UND ANIMATION WERDEN GETRENNT GEKAUFT.</span></div>\n            <button class=\"premium-option\" id=\"themeAnimationToggle\" type=\"button\">\n              <span><b>THEME ANIMATIONS</b><small id=\"themeAnimationCopy\">Animierte Banner passend zum gewählten Theme.</small></span><strong>+ 1,99 €</strong><em>HINZUFÜGEN</em>\n            </button>\n            <div class=\"premium-option premium-option-composite\" id=\"gameAnimationsToggle\" role=\"button\" tabindex=\"0\" aria-label=\"Game Animations hinzufügen oder entfernen\">\n              <span class=\"premium-option-copy\"><b>GAME ANIMATIONS</b><small>Player Card Reveal, MVP-Wahl und weitere Inszenierungen freischalten.</small></span>\n              <button class=\"premium-info-inline\" id=\"gameAnimationsInfo\" type=\"button\" aria-label=\"Beispielanimation anzeigen\" title=\"Beispielanimation anzeigen\">ⓘ</button>\n              <strong class=\"premium-option-price\">+ 3,99 €</strong>\n              <em class=\"premium-option-action\">HINZUFÜGEN</em>\n            </div>\n          </div>\n        </div>\n      </section>\n\n      <section class=\"shop-section\">\n        <header class=\"section-head\">\n          <div><small>03 / ZUSATZPAKET</small><h2>ZUSATZFUNKTIONEN</h2></div>\n          <div class=\"section-count\">WAHLWEISE</div>\n        </header>\n        <div class=\"pack-body\">\n          <article class=\"feature-pack\" id=\"jgaFeaturePack\">\n            <div class=\"feature-pack-head\">\n              <div>\n                <small>PACK.JGA · MVP-VORSCHAU 0,00 €</small>\n                <h3>JGA EXPERIENCE</h3>\n                <p>Dieses Paket schaltet die zusätzlichen Funktionen frei. Welche davon im Turnier aktiv sind, entscheidet der Admin später in den TURNIER SETTINGS. Standardmäßig sind alle eingeschaltet.</p>\n              </div>\n              <button class=\"pack-toggle\" id=\"jgaPackToggle\">HINZUFÜGEN</button>\n            </div>\n            <div class=\"feature-list\">\n              <div class=\"feature-row\">\n                <div><strong>LVP-WAHL</strong><small>Least Valuable Player · sarkastische Zusatzauszeichnung</small></div>\n                <span class=\"feature-unlock\">FREIGESCHALTET</span>\n              </div>\n              <div class=\"feature-row\">\n                <div><strong>ROAST-NEWS</strong><small>JGA-Newsfeed mit härterer, humorvoller Tonalität</small></div>\n                <span class=\"feature-unlock\">FREIGESCHALTET</span>\n              </div>\n            </div>\n          </article>\n\n          <div class=\"architecture-note\">\n            <strong>SPIELER-SKINS SIND NICHT TEIL DIESES WARENKORBS.</strong>\n            <p>Skins gehören dem einzelnen Nutzer und werden in einem separaten Spieler-Shop gekauft. Das Turnierdesign gilt dagegen für alle Teilnehmer des Turniers.</p>\n          </div>\n        </div>\n      </section>\n    </div>\n\n    <aside class=\"cart\">\n      <header class=\"cart-head\"><small>AKTUELLER WARENKORB</small><h2>DEIN TURNIER</h2></header>\n\n      <section class=\"selected-games-panel\" aria-label=\"Ausgewählte Spiele\">\n        <div class=\"selected-games-head\">\n          <small>AUSGEWÄHLTE SPIELE</small>\n          <strong id=\"selectedGamesStickyCount\">0 SPIELE</strong>\n        </div>\n        <div class=\"selected-games-list\" id=\"selectedGamesStickyList\">\n          <div class=\"selected-games-empty\">NOCH KEINE SPIELE AUSGEWÄHLT.</div>\n        </div>\n      </section>\n\n      <div class=\"cart-section-label\">DIGITALE INHALTE</div>\n      <div class=\"cart-lines\">\n        <div class=\"cart-line\">\n          <div><small>SPIELPAKET</small><strong id=\"cartTierLabel\">NOCH KEINE SPIELE</strong></div>\n          <b id=\"cartGamePrice\">0,00 €</b>\n        </div>\n        <div class=\"cart-line\">\n          <div><small>TOURNAMENT_THEME</small><strong id=\"cartTheme\">SKIELSEN CORE</strong></div>\n          <b id=\"cartThemePrice\">0,00 €</b>\n        </div>\n        <div class=\"cart-line\">\n          <div><small>THEME ANIMATIONS</small><strong id=\"cartThemeAnimations\">NICHT AKTIV</strong></div>\n          <b id=\"cartThemeAnimationPrice\">0,00 €</b>\n        </div>\n        <div class=\"cart-line\">\n          <div><small>GAME ANIMATIONS</small><strong id=\"cartGameAnimations\">NICHT AKTIV</strong></div>\n          <b id=\"cartGameAnimationPrice\">0,00 €</b>\n        </div>\n        <div class=\"cart-line\">\n          <div><small>ZUSATZPAKET</small><strong id=\"cartFeature\">KEINS</strong></div>\n          <b class=\"prototype-free\">0,00 €</b>\n        </div>\n      </div>\n\n      <div class=\"total-line\"><span>DIGITALER ZWISCHENSTAND</span><strong id=\"cartTotal\">0,00 €</strong></div>\n\n      <div class=\"cart-section-label physical\">PHYSISCHE SPIELE</div>\n      <div class=\"cart-physical\" id=\"cartPhysicalGames\">\n        <div class=\"physical-cart-empty\">NOCH KEINE PHYSISCHEN SPIELE IM WARENKORB.</div>\n      </div>\n      <div class=\"physical-subtotal\"><span>PHYSISCHER ZWISCHENSTAND</span><strong id=\"cartPhysicalTotal\">0,00 €</strong></div>\n\n      <div class=\"per-player\">\n        <small>UMGERECHNET PRO AKTIVEM SPIELER</small>\n        <strong id=\"perPlayerPrice\">0,00 €</strong>\n        <span id=\"perPlayerSub\">BEI 8 SPIELERN</span>\n      </div>\n\n      <div class=\"checkout-wrap\">\n        <div class=\"material-cost-note\"><b>ℹ PHYSISCHE SPIELE SIND NOCH NICHT VERBINDLICH.</b><span>Im nächsten Schritt kannst du Material und Spielgeräte abwählen, wenn du sie bereits besitzt oder selbst organisierst. Erst danach entsteht die endgültige Bestellsumme.</span></div>\n        <button class=\"checkout\" id=\"checkoutButton\" disabled>MINDESTENS 1 SPIEL AUSWÄHLEN</button>\n        <p class=\"checkout-note\">Digitale Inhalte bleiben bestehen. Physische Spiele werden im Material-Check einzeln bestätigt oder abbestellt.</p>\n      </div>\n    </aside>\n  </div>\n</main>\n\n<div class=\"mobile-total-bar\" id=\"mobileTotalBar\">\n  <div class=\"mobile-selected-games\" id=\"mobileSelectedGames\" aria-label=\"Ausgewählte Spiele\"></div>\n  <div class=\"mobile-total-meta\"><small>VORLÄUFIGER WARENKORB</small><strong id=\"mobileTotal\">0,00 €</strong><span id=\"mobileCount\">0 SPIELE AUSGEWÄHLT</span></div>\n  <button class=\"mobile-total-button\" id=\"mobileCheckout\">EXTRAS ANSEHEN ↓</button>\n</div>\n\n<div class=\"modal\" id=\"gameDetailModal\" aria-hidden=\"true\">\n  <section class=\"modal-card game-detail-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"gameDetailTitle\">\n    <div class=\"game-detail-head\">\n      <div class=\"game-detail-headline\"><div><small id=\"gameDetailCategory\">SPIEL</small><h2 id=\"gameDetailTitle\">SPIEL</h2></div><button class=\"detail-close\" id=\"closeGameDetail\" aria-label=\"Schließen\">×</button></div>\n      <div class=\"detail-chips\" id=\"gameDetailChips\"></div>\n    </div>\n    <div class=\"detail-body\">\n      <section class=\"detail-section\"><h3>KURZBESCHREIBUNG</h3><p id=\"gameDetailDescription\"></p></section>\n      <section class=\"detail-section\"><h3>REGELN</h3><p class=\"detail-rules\" id=\"gameDetailRules\"></p></section>\n      <section class=\"detail-section\"><h3>BENÖTIGTES MATERIAL</h3><div class=\"material-list\" id=\"gameDetailMaterials\"></div><div class=\"external-warning\" id=\"gameDetailExternal\" hidden></div></section>\n      <button class=\"detail-add\" id=\"gameDetailAdd\">ZUM TURNIER +</button>\n    </div>\n  </section>\n</div>\n\n<div class=\"modal\" id=\"checkoutModal\" aria-hidden=\"true\">\n  <section class=\"modal-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"checkoutTitle\">\n    <small>ABSCHLUSS SIMULIERT · LOBBY FREIGEGEBEN</small>\n    <h2 id=\"checkoutTitle\">TURNIER ANGELEGT.</h2>\n    <p id=\"checkoutSummary\">Die Auswahl wurde gespeichert. In der echten App wird dieser Zustand erst nach bestätigter Zahlung freigeschaltet.</p>\n    <div class=\"invite-code\" id=\"inviteCode\">SKL-7K4P</div>\n    <div class=\"modal-actions\">\n      <button class=\"secondary\" id=\"closeModal\">WEITER →</button>\n      <button class=\"primary\" id=\"openLobby\">LOBBY ÖFFNEN →</button>\n    </div>\n  </section>\n</div>\n\n<div class=\"game-animation-demo\" id=\"gameAnimationDemo\" aria-hidden=\"true\"><section class=\"game-animation-card\"><small>PREMIUM PREVIEW</small><h3>PLAYER CARD REVEAL</h3><div class=\"game-animation-stage\"><div class=\"demo-player-card\">PLAYER CARD</div></div><button id=\"closeGameAnimationDemo\" type=\"button\">SCHLIESSEN</button></section></div>\n<script>\nlet AVAILABLE_GAMES = [];\n\nconst SHOP_CONFIG = {\n  pricingTiers: [\n    { id:'free', min:1, max:4, price:0, label:'KOSTENLOS · BIS 4 SPIELE' },\n    { id:'standard', min:5, max:9, price:4.99, label:'ERWEITERT · 5–9 SPIELE' },\n    { id:'max', min:10, max:null, price:9.99, label:'MAXIMAL · 10+ SPIELE' }\n  ],\n  themes: {\n    'theme.skielsen.core': { id:'theme.skielsen.core', name:'SKIELSEN CORE', prototypePrice:0 },\n    'theme.skielsen.core2': { id:'theme.skielsen.core2', name:'SKIELSEN CORE 2', prototypePrice:0 },\n    'theme.jga.night': { id:'theme.jga.night', name:'JGA NIGHT', prototypePrice:2.99 },\n    'theme.christmas.winter_clash': { id:'theme.christmas.winter_clash', name:'WINTER CLASH', prototypePrice:2.99 },\n    'theme.summer.sunset_showdown': { id:'theme.summer.sunset_showdown', name:'SUNSET SHOWDOWN', prototypePrice:2.99 },\n    'theme.girly.pink_chaos': { id:'theme.girly.pink_chaos', name:'PINK CHAOS', prototypePrice:2.99 }\n  },\n  featurePacks: {\n    'pack.jga': {\n      id:'pack.jga',\n      name:'JGA EXPERIENCE',\n      prototypePrice:0,\n      features:['feature.lvp_voting','feature.roast_news']\n    }\n  }\n};\n\nconst state = {\n  selectedGameIds: [],\n  tagFilter:'all',\n  environmentFilter:'all',\n  search:'',\n  themeId:'theme.skielsen.core',\n  featurePackId:null,\n  features: {\n    'feature.lvp_voting':false,\n    'feature.roast_news':false\n  },\n  expectedPlayers:8,\n  themeAnimations:false,\n  gameAnimations:false,\n  mode:'team',\n  extrasVisited:false,\n  catalogInitialized:false\n};\n\nconst euro = n => Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});\nconst getGame = id => AVAILABLE_GAMES.find(g=>g.id===id);\nconst isCoreTheme = id => id==='theme.skielsen.core'||id==='theme.skielsen.core2';\n\nfunction gameTier(){\n  const n=state.selectedGameIds.length;\n  if(n===0) return {id:'none',price:0,label:'NOCH KEINE SPIELE'};\n  return SHOP_CONFIG.pricingTiers.find(t=>n>=t.min && (t.max===null || n<=t.max));\n}\n\nfunction iconFor(key){\n  const icons={\n    cards:'▤', target:'◎', dice:'◆', music:'♫', ring:'○',\n    blocks:'▦', cups:'▽', paddle:'◒', disc:'●'\n  };\n  return icons[key]||'◆';\n}\n\nfunction envLabel(env){\n  if(env.includes('indoor')&&env.includes('outdoor')) return 'DRINNEN / DRAUSSEN';\n  return env.includes('outdoor')?'DRAUSSEN':'DRINNEN';\n}\n\nfunction externalEquipment(g){\n  return (g.equipment||[]).filter(x=>x.procurementPolicy==='EXTERNAL_REQUIRED');\n}\n\nfunction externalLabel(g){\n  const ext=externalEquipment(g);\n  if(!ext.length) return '';\n  return ext.map(x=>x.name).join(' + ')+' NÖTIG';\n}\n\nfunction shopEquipmentForGame(g){\n  const seen=new Set();\n  return (g?.equipment||[]).filter(item=>{\n    const id=item.equipmentId||item.equipment_id;\n    const shop=item.procurementPolicy==='SKIELSEN_SHOP' && !!item.productId;\n    if(!shop||seen.has(id)) return false;\n    seen.add(id);\n    return true;\n  });\n}\n\nfunction gamePhysicalPriceSummary(g){\n  const items=shopEquipmentForGame(g);\n  if(!items.length) return null;\n  let cents=0,open=false;\n  items.forEach(item=>{\n    const qty=Math.max(Number(item.quantity)||1,1);\n    if(item.priceCents===null||item.priceCents===undefined) open=true;\n    else cents+=Number(item.priceCents)*qty;\n  });\n  return {items,cents,open};\n}\n\nfunction selectedPhysicalCartItems(){\n  const byEquipment=new Map();\n  state.selectedGameIds.forEach(gameId=>{\n    const game=getGame(gameId);\n    shopEquipmentForGame(game).forEach(item=>{\n      const equipmentId=item.equipmentId||item.equipment_id;\n      let row=byEquipment.get(equipmentId);\n      if(!row){\n        row={\n          equipmentId,\n          name:item.productName||item.name||equipmentId,\n          equipmentName:item.name||equipmentId,\n          quantity:Math.max(Number(item.quantity)||1,1),\n          priceCents:item.priceCents,\n          variantCount:Number(item.variantCount)||0,\n          gameNames:[]\n        };\n        byEquipment.set(equipmentId,row);\n      }else{\n        row.quantity=Math.max(row.quantity,Math.max(Number(item.quantity)||1,1));\n      }\n      if(game?.name && !row.gameNames.includes(game.name)) row.gameNames.push(game.name);\n    });\n  });\n  return [...byEquipment.values()];\n}\n\nfunction modeLabel(g){\n  const team=(g.supportsModes||[]).includes('team');\n  const solo=(g.supportsModes||[]).includes('solo');\n  if(team&&solo) return 'TEAM & SOLO';\n  if(team) return 'NUR TEAMSPIEL';\n  if(solo) return 'NUR SOLOSPIEL';\n  return '';\n}\n\nfunction gamesForCurrentMode(){\n  return AVAILABLE_GAMES.filter(g=>g.active&&(g.supportsModes||[]).includes(state.mode));\n}\n\nfunction renderTypeFilters(){\n  const host=document.getElementById('typeFilters');\n  const tags=new Map();\n  gamesForCurrentMode().forEach(g=>(g.filterTags||[]).forEach(t=>tags.set(t.id,t)));\n  const list=[...tags.values()].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.label.localeCompare(b.label,'de'));\n  host.innerHTML='<button class=\"filter '+(state.tagFilter==='all'?'active':'')+'\" data-tag-filter=\"all\">ALLE</button>'+\n    list.map(t=>`<button class=\"filter ${state.tagFilter===t.id?'active':''}\" data-tag-filter=\"${t.id}\">${t.label}</button>`).join('');\n  host.querySelectorAll('[data-tag-filter]').forEach(btn=>btn.addEventListener('click',()=>{\n    state.tagFilter=btn.dataset.tagFilter;\n    renderTypeFilters();\n    renderGames();\n  }));\n}\n\nfunction renderGames(){\n  const grid=document.getElementById('gamesGrid');\n  const q=state.search.trim().toLowerCase();\n  const filtered=gamesForCurrentMode().filter(g=>{\n    const envOk=state.environmentFilter==='all'||g.environment.includes(state.environmentFilter);\n    const tagOk=state.tagFilter==='all'||(g.filterTags||[]).some(t=>t.id===state.tagFilter);\n    const searchPool=[g.name,g.category,g.shortDescription||'',...(g.filterTags||[]).map(t=>t.label)].join(' ').toLowerCase();\n    const searchOk=!q||searchPool.includes(q);\n    return envOk&&tagOk&&searchOk;\n  });\n\n  grid.innerHTML=filtered.map(g=>{\n    const selected=state.selectedGameIds.includes(g.id);\n    const extLabel=externalLabel(g);\n    const shopPrice=gamePhysicalPriceSummary(g);\n    const typeLabel=(g.filterTags||[])[0]?.label||g.category;\n    return `\n      <article class=\"game-card ${selected?'selected':''}\" data-open-game=\"${g.id}\" tabindex=\"0\" role=\"button\" aria-label=\"${g.name} – Details öffnen\">\n        <div class=\"game-card-top\">\n          <span class=\"game-no\">${String(Math.max(1,Math.round((g.sortOrder||10)/10))).padStart(2,'0')} · ${iconFor(g.iconKey)}</span>\n          <div class=\"game-card-top-right\">\n            <span class=\"game-chip\">${envLabel(g.environment)}</span>\n            ${shopPrice?`<span class=\"game-shop-inline\">IM SHOP · ${(shopPrice.items||[]).some(x=>Number(x.variantCount)>1)?'AB ':''}${shopPrice.open?(shopPrice.cents?euro(shopPrice.cents/100)+' + PREIS OFFEN':'PREIS OFFEN'):euro(shopPrice.cents/100)}</span>`:''}\n          </div>\n        </div>\n        <div>\n          <div class=\"game-category\">${typeLabel}</div>\n          <h3 class=\"game-name\">${g.name}</h3>\n        </div>\n        <div class=\"game-summary\">${g.shortDescription||'Kurzbeschreibung und Regeln öffnen.'}</div>\n        ${extLabel?`<div class=\"game-external\">⚠ ${extLabel}</div>`:''}\n        <div class=\"game-meta\"><span>${modeLabel(g)}</span></div>\n        <div class=\"game-detail-hint\">BESCHREIBUNG · REGELN · MATERIAL →</div>\n        <button class=\"game-add\" data-game-id=\"${g.id}\">${selected?'ENTFERNEN':'ZUM TURNIER +'}</button>\n      </article>`;\n  }).join('') || `<div class=\"empty\" style=\"grid-column:1/-1\">${state.catalogInitialized?'KEINE KOMPATIBLEN SPIELE FÜR DIE AKTUELLEN FILTER GEFUNDEN.':'SPIELEKATALOG WIRD GELADEN …'}</div>`;\n\n  grid.querySelectorAll('[data-game-id]').forEach(btn=>{\n    btn.addEventListener('click',e=>{e.stopPropagation();toggleGame(btn.dataset.gameId)});\n  });\n  grid.querySelectorAll('[data-open-game]').forEach(card=>{\n    const open=()=>openGameDetail(card.dataset.openGame);\n    card.addEventListener('click',open);\n    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});\n  });\n}\n\nfunction humanRuleFallback(g){\n  const obj=g.rulesJson||{};\n  const pairs=[];\n  const labels={\n    ruleset:'Regelwerk',mode:'Modus',races:'Rennen',solo:'Solo',tracking:'Erfassung',turnOrder:'Reihenfolge',\n    placement:'Platzierung',elimination:'Ausscheiden',afterElimination:'Danach',teamThrowOrder:'Reihenfolge im Team',\n    teamRoleSwap:'Rollenwechsel',drinkWhileDriving:'Fahren während des Trinkens',eachTeamPlayerDrives:'Rennen je Teamspieler',\n    drinkRequirement:'Getränkeregel',result:'Ergebnis',optionalEventTracking:'Wahlweise Ereigniserfassung'\n  };\n  const values={\n    CLASSIC:'Klassisch',FINAL_RESULT_ONLY:'Nur Endergebnis',ALTERNATING:'abwechselnd',SUDDEN_DEATH_ELIMINATION:'Ausscheidung bis zur Entscheidung',\n    REVERSE_ELIMINATION_ORDER:'umgekehrte Ausscheidungsreihenfolge',ONE_PLAYER_PER_TEAM_ROUND_ROBIN:'teamweise rotierend',\n    PLAYER_WHO_TOPPLES_TOWER:'wer den Turm umwirft',REBUILD_TOWER:'Turm neu aufbauen',AFTER_EACH_RACE:'nach jedem Rennen',\n    FINAL_CUP_PLACEMENT:'Endplatzierung im Cup',CONFIGURABLE_NON_ALCOHOL_SPECIFIC:'frei konfigurierbar / alkoholfrei möglich',HARDCORE:'vollständig',\n    '1V1':'1 gegen 1'\n  };\n  Object.entries(obj).forEach(([k,v])=>{\n    if(v===null||typeof v==='object') return;\n    let shown=values[String(v)]??(typeof v==='boolean'?(v?'Ja':'Nein'):String(v).replaceAll('_',' '));\n    pairs.push(`${labels[k]||k}: ${shown}`);\n  });\n  return pairs.length?pairs.join('\\n'):'Für dieses Spiel ist das Regelwerk im Katalog hinterlegt.';\n}\n\nfunction materialBadge(item){\n  if(item.procurementPolicy==='EXTERNAL_REQUIRED') return 'EXTERN · NICHT IM SHOP';\n  if(item.procurementPolicy==='SKIELSEN_SHOP') return 'IM SHOP ERHÄLTLICH';\n  if(item.procurementPolicy==='INCLUDED_IN_APP') return 'IN DER APP';\n  return 'BENÖTIGT';\n}\n\nfunction openGameDetail(id){\n  const g=getGame(id); if(!g) return;\n  const modal=document.getElementById('gameDetailModal');\n  document.getElementById('gameDetailCategory').textContent=`${g.category} · ${envLabel(g.environment)}`;\n  document.getElementById('gameDetailTitle').textContent=g.name;\n  document.getElementById('gameDetailDescription').textContent=g.shortDescription||'Keine Kurzbeschreibung hinterlegt.';\n  document.getElementById('gameDetailRules').textContent=g.rulesText||humanRuleFallback(g);\n  document.getElementById('gameDetailChips').innerHTML=`<span>${modeLabel(g)}</span>`;\n  const items=g.equipment||[];\n  const material=document.getElementById('gameDetailMaterials');\n  if(items.length){\n    material.innerHTML=items.map(item=>{const price=item.procurementPolicy==='SKIELSEN_SHOP'&&item.productId?(item.priceCents==null?' · PREIS OFFEN':' · '+(Number(item.variantCount)>1?'AB ':'')+euro((Number(item.priceCents)*Math.max(Number(item.quantity)||1,1))/100)):'';return `<div class=\"material-row ${item.procurementPolicy==='EXTERNAL_REQUIRED'?'external':''}\"><div><strong>${item.quantity&&item.quantity>1?item.quantity+'× ':''}${item.name}</strong><small>${item.description||item.notes||''}</small></div><span class=\"material-badge\">${materialBadge(item)}${price}</span></div>`}).join('');\n  }else if(g.playMode==='IN_APP'){\n    material.innerHTML='<div class=\"material-row\"><div><strong>Smartphone mit SKIELSEN</strong><small>Das Spiel läuft direkt in der App.</small></div><span class=\"material-badge\">IN DER APP</span></div>';\n  }else if(g.playMode==='EXTERNAL_WEB'){\n    material.innerHTML='<div class=\"material-row\"><div><strong>Smartphone / Browser + Internet</strong><small>Das Spiel wird über einen externen Online-Anbieter gespielt.</small></div><span class=\"material-badge\">EXTERN</span></div>';\n  }else{\n    material.innerHTML='<div class=\"material-row\"><div><strong>Kein zusätzliches Material hinterlegt</strong><small>Die Materialliste kann im Spielekatalog ergänzt werden.</small></div><span class=\"material-badge\">INFO</span></div>';\n  }\n  const ext=externalEquipment(g),warning=document.getElementById('gameDetailExternal');\n  if(ext.length){warning.hidden=false;warning.textContent='⚠ VORAUSSETZUNG: '+ext.map(x=>x.name).join(' + ')+' muss vorhanden sein. Diese externen Komponenten werden nicht über den SKIELSEN-Shop angeboten.'}else{warning.hidden=true;warning.textContent=''}\n  const add=document.getElementById('gameDetailAdd');\n  add.dataset.gameId=g.id;add.classList.toggle('selected',state.selectedGameIds.includes(g.id));add.textContent=state.selectedGameIds.includes(g.id)?'AUS TURNIER ENTFERNEN':'ZUM TURNIER +';\n  modal.classList.add('open');modal.setAttribute('aria-hidden','false');\n}\n\nfunction toggleGame(id){\n  const game=getGame(id);\n  if(!game||!game.active||!(game.supportsModes||[]).includes(state.mode)) return;\n  const i=state.selectedGameIds.indexOf(id);\n  if(i>=0) state.selectedGameIds.splice(i,1);\n  else state.selectedGameIds.push(id);\n  render();\n}\n\n\nfunction applyTheme(){\n  applyShopThemeContract(state.themeId);\n  document.documentElement.dataset.themeAnimations=state.themeAnimations?'true':'false';\n  document.querySelectorAll('[data-theme-card]').forEach(card=>card.classList.toggle('active',card.dataset.themeCard===state.themeId));\n  const themeAnim=document.getElementById('themeAnimationToggle');\n  const core=isCoreTheme(state.themeId);\n  if(core && state.themeAnimations) state.themeAnimations=false;\n  if(themeAnim){\n    themeAnim.classList.toggle('disabled',core);\n    themeAnim.classList.toggle('active',!core&&state.themeAnimations);\n    themeAnim.querySelector('em').textContent=!core&&state.themeAnimations?'AKTIV':'HINZUFÜGEN';\n  }\n  const gameAnim=document.getElementById('gameAnimationsToggle');\n  if(gameAnim){\n    gameAnim.classList.toggle('active',state.gameAnimations);\n    gameAnim.querySelector('em').textContent=state.gameAnimations?'AKTIV':'HINZUFÜGEN';\n  }\n  document.documentElement.dataset.themeAnimations=state.themeAnimations?'true':'false';\n}\n\nfunction renderFeaturePack(){\n  const pack=document.getElementById('jgaFeaturePack');\n  const button=document.getElementById('jgaPackToggle');\n  const active=state.featurePackId==='pack.jga';\n  pack.classList.toggle('active',active);\n  button.textContent=active?'ENTFERNEN':'HINZUFÜGEN';\n}\n\nfunction focusSelectedGame(gameId){\n  state.tagFilter='all';\n  state.environmentFilter='all';\n  state.search='';\n\n  const search=document.getElementById('gameSearch');\n  if(search) search.value='';\n\n  document.querySelectorAll('[data-env-filter]').forEach(btn=>{\n    btn.classList.toggle('active',btn.dataset.envFilter==='all');\n  });\n\n  renderTypeFilters();\n  renderGames();\n\n  requestAnimationFrame(()=>{\n    const card=[...document.querySelectorAll('[data-open-game]')].find(el=>el.dataset.openGame===gameId);\n    if(!card)return;\n    card.classList.remove('catalog-focus');\n    void card.offsetWidth;\n    card.classList.add('catalog-focus');\n    card.scrollIntoView({behavior:'smooth',block:'center'});\n    setTimeout(()=>card.classList.remove('catalog-focus'),1200);\n  });\n}\n\nfunction renderSelectedGamesOverview(){\n  const selected=state.selectedGameIds.map(getGame).filter(Boolean);\n  const countLabel=`${selected.length} ${selected.length===1?'SPIEL':'SPIELE'}`;\n  document.getElementById('selectedGamesStickyCount').textContent=countLabel;\n\n  const desktop=document.getElementById('selectedGamesStickyList');\n  desktop.replaceChildren();\n\n  if(!selected.length){\n    const empty=document.createElement('div');\n    empty.className='selected-games-empty';\n    empty.textContent='NOCH KEINE SPIELE AUSGEWÄHLT.';\n    desktop.appendChild(empty);\n  }else{\n    selected.forEach(game=>{\n      const row=document.createElement('button');\n      row.type='button';\n      row.className='selected-game-row';\n      row.dataset.selectedGameId=game.id;\n      row.title='Im Spielekatalog anzeigen';\n\n      const check=document.createElement('span');\n      check.className='selected-game-check';\n      check.textContent='✓';\n\n      const name=document.createElement('span');\n      name.className='selected-game-name';\n      name.textContent=game.name;\n\n      const jump=document.createElement('span');\n      jump.className='selected-game-jump';\n      jump.textContent='↗';\n\n      row.append(check,name,jump);\n      row.addEventListener('click',()=>focusSelectedGame(game.id));\n      desktop.appendChild(row);\n    });\n  }\n\n  const mobile=document.getElementById('mobileSelectedGames');\n  mobile.replaceChildren();\n\n  selected.forEach(game=>{\n    const chip=document.createElement('button');\n    chip.type='button';\n    chip.className='mobile-game-chip';\n    chip.dataset.selectedGameId=game.id;\n    chip.title='Im Spielekatalog anzeigen';\n\n    const check=document.createElement('b');\n    check.textContent='✓';\n\n    const name=document.createElement('span');\n    name.textContent=game.name;\n\n    chip.append(check,name);\n    chip.addEventListener('click',()=>focusSelectedGame(game.id));\n    mobile.appendChild(chip);\n  });\n}\n\nfunction renderCart(){\n  const tier=gameTier();\n  const theme=SHOP_CONFIG.themes[state.themeId];\n  const feature=state.featurePackId?SHOP_CONFIG.featurePacks[state.featurePackId]:null;\n  const themePrice=theme?.prototypePrice||0;\n  const themeAnimationPrice=(!isCoreTheme(state.themeId)&&state.themeAnimations)?Number(theme?.animationAddonPrice??1.99):0;\n  const gameAnimationPrice=state.gameAnimations?3.99:0;\n  const digitalTotal=tier.price+themePrice+themeAnimationPrice+gameAnimationPrice+(feature?.prototypePrice||0);\n\n  const physicalItems=selectedPhysicalCartItems();\n  const physicalKnownCents=physicalItems.reduce((sum,item)=>{\n    return sum+(item.priceCents==null?0:Number(item.priceCents)*Math.max(Number(item.quantity)||1,1));\n  },0);\n  const physicalOpen=physicalItems.some(item=>item.priceCents===null||item.priceCents===undefined);\n  const physicalVariable=physicalItems.some(item=>Number(item.variantCount)>1);\n  const physicalKnownTotal=physicalKnownCents/100;\n  const provisionalKnownTotal=digitalTotal+physicalKnownTotal;\n  const per=state.expectedPlayers>0?provisionalKnownTotal/state.expectedPlayers:0;\n\n  document.getElementById('selectedCount').textContent=state.selectedGameIds.length;\n  renderSelectedGamesOverview();\n  document.getElementById('cartTierLabel').textContent=tier.label;\n  document.getElementById('cartGamePrice').textContent=euro(tier.price);\n  document.getElementById('cartTheme').textContent=theme.name;\n  document.getElementById('cartThemePrice').textContent=euro(themePrice);\n  document.getElementById('cartThemeAnimations').textContent=themeAnimationPrice?'AKTIV':'NICHT AKTIV';\n  document.getElementById('cartThemeAnimationPrice').textContent=euro(themeAnimationPrice);\n  document.getElementById('cartGameAnimations').textContent=gameAnimationPrice?'AKTIV':'NICHT AKTIV';\n  document.getElementById('cartGameAnimationPrice').textContent=euro(gameAnimationPrice);\n  document.getElementById('cartFeature').textContent=feature?feature.name:'KEINS';\n  document.getElementById('cartTotal').textContent=euro(digitalTotal);\n  document.getElementById('perPlayerPrice').textContent=(physicalOpen||physicalVariable)?`AB ${euro(per)}`:euro(per);\n  document.getElementById('perPlayerSub').textContent=`BEI ${state.expectedPlayers} SPIELERN · DIGITAL + PHYSISCH`;\n\n  const physicalBox=document.getElementById('cartPhysicalGames');\n  physicalBox.innerHTML=physicalItems.length?physicalItems.map(item=>{\n    const qty=Math.max(Number(item.quantity)||1,1);\n    const price=item.priceCents==null?'PREIS OFFEN':`${Number(item.variantCount)>1?'AB ':''}${euro((Number(item.priceCents)*qty)/100)}`;\n    const gameInfo=item.gameNames.length?'FÜR '+item.gameNames.join(' · '):'';\n    return `<div class=\"physical-cart-line\"><div><small>PHYSISCHES SPIEL / SPIELGERÄT</small><strong>${item.name}</strong><span>${qty>1?qty+'× · ':''}${gameInfo}</span></div><b>${price}</b></div>`;\n  }).join(''):'<div class=\"physical-cart-empty\">FÜR DEINE AUSWAHL SIND KEINE PHYSISCHEN SHOP-ARTIKEL HINTERLEGT.</div>';\n  document.getElementById('cartPhysicalTotal').textContent=physicalOpen\n    ?(physicalKnownCents?`${physicalVariable?'AB ':''}${euro(physicalKnownTotal)} + PREIS OFFEN`:'PREIS OFFEN')\n    :`${physicalVariable?'AB ':''}${euro(physicalKnownTotal)}`;\n\n  document.querySelectorAll('.tier').forEach(el=>el.classList.toggle('active',el.dataset.tier===tier.id));\n\n  const btn=document.getElementById('checkoutButton');\n  const hasGames=state.selectedGameIds.length>0;\n  btn.disabled=!hasGames;\n  if(!hasGames) btn.textContent='MINDESTENS 1 SPIEL AUSWÄHLEN';\n  else if(!state.extrasVisited) btn.textContent='DESIGN & EXTRAS ANSEHEN ↓';\n  else btn.textContent='WEITER ZUM MATERIAL-CHECK →';\n\n  const mobileBtn=document.getElementById('mobileCheckout');\n  document.getElementById('mobileTotal').textContent=(physicalOpen||physicalVariable)?'AB '+euro(provisionalKnownTotal):euro(provisionalKnownTotal);\n  document.getElementById('mobileCount').textContent=`${state.selectedGameIds.length} ${state.selectedGameIds.length===1?'SPIEL':'SPIELE'} · DIGITAL + PHYSISCH`;\n  mobileBtn.disabled=!hasGames;\n  mobileBtn.textContent=!hasGames?'SPIEL AUSWÄHLEN':(state.extrasVisited?'MATERIAL-CHECK →':'DESIGN & EXTRAS ↓');\n}\n\nfunction render(){\n  renderTypeFilters();\n  renderGames();\n  renderThemeCatalog();\n  applyTheme();\n  renderFeaturePack();\n  renderCart();\n}\n\ndocument.querySelectorAll('[data-env-filter]').forEach(btn=>{\n  btn.addEventListener('click',()=>{\n    state.environmentFilter=btn.dataset.envFilter;\n    document.querySelectorAll('[data-env-filter]').forEach(x=>x.classList.toggle('active',x===btn));\n    renderGames();\n  });\n});\n\ndocument.getElementById('gameSearch').addEventListener('input',e=>{\n  state.search=e.target.value;\n  renderGames();\n});\n\ndocument.querySelectorAll('[data-theme-card]').forEach(card=>card.addEventListener('click',()=>{\n  state.themeId=card.dataset.themeCard;\n  state.extrasVisited=true;\n  applyTheme();\n  renderCart();\n}));\ndocument.getElementById('themeAnimationToggle').addEventListener('click',()=>{\n  if(isCoreTheme(state.themeId)) return;\n  state.extrasVisited=true;\n  state.themeAnimations=!state.themeAnimations;\n  applyTheme();renderCart();\n});\ndocument.getElementById('gameAnimationsToggle').addEventListener('click',e=>{\n  if(e.target.closest('#gameAnimationsInfo')) return;\n  state.extrasVisited=true;\n  state.gameAnimations=!state.gameAnimations;\n  applyTheme();renderCart();\n});\ndocument.getElementById('gameAnimationsToggle').addEventListener('keydown',e=>{\n  if(e.key!=='Enter'&&e.key!==' ')return;\n  e.preventDefault();\n  state.extrasVisited=true;\n  state.gameAnimations=!state.gameAnimations;\n  applyTheme();renderCart();\n});\ndocument.getElementById('gameAnimationsInfo')?.addEventListener('click',e=>{e.stopPropagation();const m=document.getElementById('gameAnimationDemo');if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false')});\ndocument.getElementById('closeGameAnimationDemo')?.addEventListener('click',()=>{const m=document.getElementById('gameAnimationDemo');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')});\ndocument.getElementById('gameAnimationDemo')?.addEventListener('click',e=>{if(e.target.id==='gameAnimationDemo')document.getElementById('closeGameAnimationDemo')?.click()});\n\ndocument.getElementById('jgaPackToggle').addEventListener('click',()=>{\n  state.extrasVisited=true;\n  const adding=state.featurePackId!=='pack.jga';\n  state.featurePackId=adding?'pack.jga':null;\n  state.features['feature.lvp_voting']=adding;\n  state.features['feature.roast_news']=adding;\n  renderFeaturePack();\n  renderCart();\n});\n\n\n\nfunction createInviteCode(){\n  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n  let code='SKL-';\n  for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];\n  return code;\n}\n\ndocument.getElementById('closeGameDetail').addEventListener('click',()=>{\n  const modal=document.getElementById('gameDetailModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');\n});\ndocument.getElementById('gameDetailModal').addEventListener('click',e=>{if(e.target.id==='gameDetailModal'){e.currentTarget.classList.remove('open');e.currentTarget.setAttribute('aria-hidden','true')}});\ndocument.getElementById('gameDetailAdd').addEventListener('click',()=>{\n  const id=document.getElementById('gameDetailAdd').dataset.gameId;if(!id)return;toggleGame(id);openGameDetail(id);\n});\nfunction goToExtras(){\n  if(!state.selectedGameIds.length)return;\n  state.extrasVisited=true;\n  renderCart();\n  const extras=document.getElementById('extrasStart');\n  if(!extras)return;\n  extras.classList.remove('extras-focus');\n  void extras.offsetWidth;\n  extras.classList.add('extras-focus');\n  extras.scrollIntoView({behavior:'smooth',block:'start'});\n  setTimeout(()=>extras.classList.remove('extras-focus'),1200);\n}\n\nfunction goToCheckout(){\n  document.querySelector('.cart')?.scrollIntoView({behavior:'smooth',block:'start'});\n}\n\ndocument.getElementById('mobileCheckout').addEventListener('click',()=>{\n  if(!state.selectedGameIds.length)return;\n  if(!state.extrasVisited) goToExtras();\n  else document.getElementById('checkoutButton').click();\n});\n\ndocument.getElementById('checkoutButton').addEventListener('click',()=>{\n  if(!state.selectedGameIds.length) return;\n  if(!state.extrasVisited){\n    goToExtras();\n    return;\n  }\n  const btn=document.getElementById('checkoutButton');\n  btn.disabled=true;\n  btn.textContent='MATERIAL-CHECK WIRD GELADEN …';\n  window.parent.postMessage({\n    type:'SKIELSEN_SHOP_CHECKOUT',\n    payload:{\n      gameIds:[...state.selectedGameIds],\n      themeId:state.themeId,\n      featurePackId:state.featurePackId,\n      features:state.featurePackId==='pack.jga'?{'feature.lvp_voting':true,'feature.roast_news':true}:{},\n      themeAnimations:!isCoreTheme(state.themeId)&&state.themeAnimations,\n      gameAnimations:state.gameAnimations,\n      activePlayers:state.expectedPlayers\n    }\n  },'*');\n});\n\ndocument.getElementById('closeModal').addEventListener('click',()=>{\n  window.parent.postMessage({type:'SKIELSEN_SHOP_OPEN_LOBBY'},'*');\n});\ndocument.getElementById('openLobby').addEventListener('click',()=>{\n  window.parent.postMessage({type:'SKIELSEN_SHOP_OPEN_LOBBY'},'*');\n});\ndocument.getElementById('shopBackBtn').addEventListener('click',()=>window.parent.postMessage({type:'SKIELSEN_SHOP_NAV_BACK'},'*'));\ndocument.getElementById('shopHomeBtn').addEventListener('click',()=>window.parent.postMessage({type:'SKIELSEN_SHOP_NAV_HOME'},'*'));\n\nfunction shopThemeTokens(theme){return theme?.themeContract?.tokens||{};}\nconst SHOP_THEME_VARS=['--theme-page-bg','--theme-surface','--theme-surface-soft','--theme-surface-muted','--theme-border','--theme-border-strong','--theme-text','--theme-text-muted','--theme-inverse','--theme-on-inverse','--theme-accent','--theme-accent-soft','--theme-positive','--theme-negative','--theme-warning','--theme-button-primary-bg','--theme-button-primary-text','--theme-button-secondary-bg','--theme-button-secondary-text','--theme-button-secondary-border','--theme-header-contract','--theme-on-header-contract','--theme-click-ring'];\nfunction resetShopThemeContract(){\n  const root=document.documentElement;\n  SHOP_THEME_VARS.forEach(name=>root.style.removeProperty(name));\n  root.style.removeProperty('background-color');\n  root.removeAttribute('data-theme-contract');\n}\nfunction applyShopThemeContract(themeId){\n  const theme=SHOP_CONFIG.themes[themeId],t=shopThemeTokens(theme),root=document.documentElement;\n  resetShopThemeContract();\n  root.dataset.themeId=themeId;\n  root.dataset.themePack=themeId;\n  if(document.body){document.body.dataset.themeId=themeId;document.body.dataset.themePack=themeId;}\n  if(isCoreTheme(themeId))return;\n  if(!t||!Object.keys(t).length)return;\n  root.dataset.themeContract='2';\n  const vars={\n    '--theme-page-bg':t.page,'--theme-surface':t.surface,'--theme-surface-soft':t.surface_soft,'--theme-surface-muted':t.surface_muted,\n    '--theme-border':t.border,'--theme-border-strong':t.border_strong,'--theme-text':t.on_surface,'--theme-text-muted':t.muted,\n    '--theme-inverse':t.inverse_surface,'--theme-on-inverse':t.on_inverse,'--theme-accent':t.accent,\n    '--theme-accent-soft':t.surface_muted,'--theme-positive':t.success_bg,'--theme-negative':t.danger_bg,'--theme-warning':t.warning_bg,\n    '--theme-button-primary-bg':t.primary_action,'--theme-button-primary-text':t.on_primary_action,\n    '--theme-button-secondary-bg':t.secondary_action,'--theme-button-secondary-text':t.on_secondary_action,'--theme-button-secondary-border':t.secondary_border,\n    '--theme-header-contract':t.header,'--theme-on-header-contract':t.on_header,'--theme-click-ring':t.focus\n  };\n  for(const [k,v] of Object.entries(vars))if(v)root.style.setProperty(k,String(v));\n  root.style.backgroundColor=String(t.root_canvas||t.page||'');\n}\nfunction renderThemeCatalog(){\n  const host=document.querySelector('.theme-preview');if(!host)return;\n  host.replaceChildren();\n  Object.values(SHOP_CONFIG.themes).forEach(theme=>{\n    const card=document.createElement('article');card.className='theme-preview-card'+(theme.id===state.themeId?' active':'');card.dataset.themeCard=theme.id;\n    const meta=document.createElement('small');meta.textContent=(theme.id==='theme.skielsen.core'?'STANDARD':'THEME PACK')+' · '+euro(theme.prototypePrice||0);\n    const title=document.createElement('strong');title.textContent=String(theme.name||theme.id).toUpperCase();\n    const sw=document.createElement('div');sw.className='swatches';const t=shopThemeTokens(theme);\n    [t.header,t.surface,t.accent,t.accent_2].filter(Boolean).slice(0,4).forEach(value=>{const i=document.createElement('i');i.style.background=String(value);sw.appendChild(i)});\n    card.append(meta,title,sw);card.addEventListener('click',()=>{state.themeId=theme.id;state.extrasVisited=true;applyTheme();renderCart()});host.appendChild(card);\n  });\n}\nfunction syncThemeCatalogFromMessage(msg){\n  const rows=Array.isArray(msg.themes)?msg.themes:[];if(!rows.length)return;\n  SHOP_CONFIG.themes=Object.fromEntries(rows.map(row=>[row.theme_pack_id,{id:row.theme_pack_id,name:row.name||row.theme_pack_id,prototypePrice:Number(row.price_cents||0)/100,animationAddonPrice:Number(row.animation_addon_cents||0)/100,themeContract:row.theme_contract||null}]));\n  renderThemeCatalog();\n}\nfunction initShopFromParent(msg){\n    syncThemeCatalogFromMessage(msg);\n    const incoming=Array.isArray(msg.games)?msg.games:[];\n    AVAILABLE_GAMES=incoming.map(g=>({\n      ...g,\n      active:g.active!==false,\n      supportsModes:(Array.isArray(g.supportsModes)?g.supportsModes:[]).map(x=>String(x).toLowerCase()),\n      environment:Array.isArray(g.environment)?g.environment.map(x=>String(x).toLowerCase()):[]\n    }));\n    state.catalogInitialized=true;\n    state.mode=msg.mode==='SOLO'?'solo':'team';\n    state.tagFilter='all';\n    state.environmentFilter='all';\n    state.search='';\n    const search=document.getElementById('gameSearch');if(search)search.value='';\n    document.querySelectorAll('[data-env-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.envFilter==='all'));\n    const topMeta=document.querySelector('.top-meta');\n    if(topMeta) topMeta.innerHTML=`${state.mode==='solo'?'SINGLE':'TEAM'}-TURNIER<br>NUR KOMPATIBLE SPIELE`;\n    const maxPlayers=state.mode==='solo'?4:8;\n    state.expectedPlayers=Math.min(Number(msg.activePlayers)||maxPlayers,maxPlayers);\n    state.themeId=msg.themeId&&SHOP_CONFIG.themes[msg.themeId]?msg.themeId:'theme.skielsen.core';\n    state.featurePackId=msg.featurePackId||null;\n    state.themeAnimations=!!msg.themeAnimations && !isCoreTheme(state.themeId);\n    state.gameAnimations=!!msg.gameAnimations;\n    state.extrasVisited=!!msg.extrasVisited || state.themeId!=='theme.skielsen.core' || !!state.featurePackId || state.themeAnimations || state.gameAnimations;\n    const checkoutButton=document.getElementById('checkoutButton');if(checkoutButton){checkoutButton.disabled=false;checkoutButton.textContent='WEITER ZUM MATERIAL-CHECK →';}\n    state.selectedGameIds=(msg.selectedGameIds||[]).filter(id=>AVAILABLE_GAMES.some(g=>g.id===id&&(g.supportsModes||[]).includes(state.mode)));\n    render();\n}\nwindow.SKIELSEN_SHOP_INIT=initShopFromParent;\n\nwindow.addEventListener('message',event=>{\n  const msg=event.data||{};\n  if(msg.type==='SKIELSEN_SHOP_INIT') initShopFromParent(msg);\n  if(msg.type==='SKIELSEN_SHOP_CREATED'){\n    const modal=document.getElementById('checkoutModal');\n    const result=msg.result||{};\n    document.getElementById('inviteCode').textContent=result.join_code||'—';\n    const tier=gameTier();\n    document.getElementById('checkoutSummary').textContent=\n      `${state.selectedGameIds.length} Spiele · ${SHOP_CONFIG.themes[state.themeId].name} · ${state.featurePackId?SHOP_CONFIG.featurePacks[state.featurePackId].name:'kein Zusatzpaket'} · ${euro(tier.price)} Spielpaket. Die digitale Auswahl wurde übernommen.`;\n    modal.classList.add('open');\n    modal.setAttribute('aria-hidden','false');\n    renderCart();\n  }\n  if(msg.type==='SKIELSEN_SHOP_ERROR'){\n    renderCart();\n    alert(msg.message||'TURNIER KONNTE NICHT ANGELEGT WERDEN.');\n  }\n});\n\nwindow.parent.postMessage({type:'SKIELSEN_SHOP_READY'},'*');\nrender();\n<\/script>\n</body>\n</html>\n";
  let supabase=null,session=null,catalog=[],themeCatalog=[],mode='TEAM',teamCount=4,soloPlayerCount=4,lastResult=null,shopReady=false,pendingShopInit=false,pendingShopPayload=null,materialState=[],authMode='signin',creationContext={type:'NEW'},activeGroupId=null,lobbyState=null,lobbyPollTimer=null,lobbyAssignMemberId=null,lobbyJoinCode=null,currentWorkflowStep='auth',shopDraftActive=false,postCartLocked=false,activeDraftTournamentId=null,exitConfirmAction=null,tournamentSettings=null,lobbyVisualChoice='tournament';

  // Explizite DOM-Referenzen. Die vorherige Version verließ sich hier auf
  // implizite Browser-Globals und lief deshalb direkt in den Fehlerzustand.
  const overlay=document.getElementById('dbBootstrapOverlay');
  const authStep=document.getElementById('dbbAuthStep');
  const homeStep=document.getElementById('dbbHomeStep');
  const createStartStep=document.getElementById('dbbCreateStartStep');
  const joinAccountStep=document.getElementById('dbbJoinAccountStep');
  const groupCreateStep=document.getElementById('dbbGroupCreateStep');
  const groupDetailStep=document.getElementById('dbbGroupDetailStep');
  const setupStep=document.getElementById('dbbSetupStep');
  const shopStep=document.getElementById('dbbShopStep');
  const materialStep=document.getElementById('dbbMaterialStep');
  const checkoutStep=document.getElementById('dbbCheckoutStep');
  const orderStep=document.getElementById('dbbOrderStep');
  const settingsStep=document.getElementById('dbbSettingsStep');
  const lobbyStep=document.getElementById('dbbLobbyStep');
  const startedStep=document.getElementById('dbbStartedStep');
  const authFeedback=document.getElementById('dbbAuthFeedback');
  const setupFeedback=document.getElementById('dbbSetupFeedback');
  const shopFrame=document.getElementById('dbbShopFrame');
  const globalHome=document.getElementById('dbbGlobalHome');
  const exitConfirm=document.getElementById('dbbExitConfirm');

  function setFeedback(el,msg,type=''){el.textContent=msg||'';el.className='dbb-feedback'+(type?' '+type:'')}
  async function loadThemeCatalog(force=false){
    if(themeCatalog.length&&!force)return themeCatalog;
    if(!supabase)return [];
    try{
      const {data,error}=await supabase.rpc('list_theme_pack_contracts',{});
      if(error)throw error;
      themeCatalog=(Array.isArray(data)?data:[]).filter(row=>window.skielsenThemeContract?.validate?.(row?.theme_contract,{themePackId:row?.theme_pack_id})?.ok);
      return themeCatalog;
    }catch(err){console.warn('Theme catalog load failed',err);themeCatalog=[];return []}
  }
  function themeCatalogRow(themeId){return themeCatalog.find(row=>row?.theme_pack_id===themeId)||null}
  function isCoreThemeId(themeId){return themeId==='theme.skielsen.core'||themeId==='theme.skielsen.core2'}
  function applyAppTheme(themeId,animations=false){
    if(!themeId){window.skielsenThemeContract?.clear?.();return}
    const id=String(themeId||'theme.skielsen.core'),row=themeCatalogRow(id);
    if(row?.theme_contract&&window.skielsenThemeContract?.apply?.(id,row.theme_contract,{animations:!!animations,context:'workflow'}))return;
    document.body.dataset.themePack=id;document.documentElement.dataset.themePack=id;
    document.body.dataset.themeAnimations=animations?'true':'false';document.documentElement.dataset.themeAnimations=animations?'true':'false';
    document.body.classList.add('skielsen-theme-context');
  }
  function updateGlobalNav(){
    globalHome.hidden=currentWorkflowStep==='auth'||currentWorkflowStep==='home'||currentWorkflowStep==='shop';
  }
  function workflowThemeState(){
    const theme=lobbyState?.theme_pack_id||tournamentSettings?.theme_pack_id||pendingShopPayload?.themeId||lastResult?.theme_pack_id||'theme.skielsen.core';
    const animations=!!(lobbyState?.theme_animations??lastResult?.theme_animations??pendingShopPayload?.themeAnimations);
    return {theme,animations};
  }
  function showStep(which,historyMode='push'){
    currentWorkflowStep=which;
    if(['auth','home','createStart','joinAccount','groupCreate','groupDetail','setup','shop'].includes(which))applyAppTheme(null,false);
    else {const t=workflowThemeState();applyAppTheme(t.theme,t.animations);}
    authStep.classList.toggle('dbb-hidden',which!=='auth');
    homeStep.classList.toggle('dbb-hidden',which!=='home');
    createStartStep.classList.toggle('dbb-hidden',which!=='createStart');
    joinAccountStep.classList.toggle('dbb-hidden',which!=='joinAccount');
    groupCreateStep.classList.toggle('dbb-hidden',which!=='groupCreate');
    groupDetailStep.classList.toggle('dbb-hidden',which!=='groupDetail');
    setupStep.classList.toggle('dbb-hidden',which!=='setup');
    shopStep.classList.toggle('dbb-hidden',which!=='shop');
    materialStep.classList.toggle('dbb-hidden',which!=='material');
    checkoutStep.classList.toggle('dbb-hidden',which!=='checkout');
    orderStep.classList.toggle('dbb-hidden',which!=='order');
    settingsStep.classList.toggle('dbb-hidden',which!=='settings');
    lobbyStep.classList.toggle('dbb-hidden',which!=='lobby');
    startedStep.classList.toggle('dbb-hidden',which!=='started');
    if(which!=='lobby' && lobbyPollTimer){clearInterval(lobbyPollTimer);lobbyPollTimer=null}
    updateGlobalNav();
    if(which!=='shop') window.scrollTo(0,0);
    if(historyMode!=='none'&&!window.skielsenHistory?.isRestoring()){
      const navData={tournamentId:lastResult?.tournament_id||null,groupId:activeGroupId||null};
      if(historyMode==='replace')window.skielsenHistory?.replace('workflow',which,navData);
      else window.skielsenHistory?.push('workflow',which,navData);
    }
  }

  async function restoreWorkflowHistory(entry){
    const target=entry?.view||'home';
    if(lastResult?.status==='LIVE'&&!['home','auth'].includes(target)){
      overlay.hidden=false;
      document.body.classList.remove('v15-tournament-active');
      if(session)await enterAccountHome(session,'replace');
      else showStep('auth','replace');
      return;
    }
    if(currentWorkflowStep==='shop'&&shopDraftActive&&target!=='shop'){
      window.skielsenHistory?.forward();
      setTimeout(()=>confirmUnpaidCartExit(target==='home'?'home':'setup'),80);
      return;
    }
    switch(target){
      case 'auth':
        showStep('auth','none');
        break;
      case 'home':
        if(session)await enterAccountHome(session,'none');
        else showStep('auth','none');
        break;
      case 'createStart':
      case 'joinAccount':
      case 'groupCreate':
      case 'groupDetail':
      case 'setup':
        if(target==='setup')updateCreationContext();
        showStep(target,'none');
        break;
      case 'shop':
        showStep('shop','none');
        pendingShopInit=true;
        if(!shopFrame.srcdoc){
          shopReady=false;
          shopFrame.srcdoc=SHOP_DOC.replaceAll('__SKIELSEN_VERSION__',APP_VERSION);
        }else{
          sendShopInit();
          setTimeout(sendShopInit,120);
        }
        break;
      case 'material':
        renderMaterialCheck();
        showStep('material','none');
        break;
      case 'checkout':
        renderFinalCheckout();
        showStep('checkout','none');
        break;
      case 'order':
        renderPostShopOrder();
        showStep('order','none');
        break;
      case 'settings':
        try{await loadTournamentSettings()}catch(_){}
        showStep('settings','none');
        break;
      case 'lobby':
        if(lastResult?.tournament_id)await openStandaloneLobby(lastResult,lastResult.join_code||lobbyJoinCode,'none');
        else if(session)await enterAccountHome(session,'none');
        break;
      default:
        showStep(target,'none');
    }
  }
  window.skielsenHistory?.register('workflow',restoreWorkflowHistory);

  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function categoryLabel(c){return ({THROWING:'WURFSPIEL',SPORT:'SPORT',DEXTERITY:'GESCHICKLICHKEIT',ENDURANCE:'AUSDAUER',WORD:'WORTSPIEL',MUSIC:'MUSIKQUIZ',RACING:'RENNSPIEL',DICE:'WÜRFELSPIEL',TIMING:'ZEITSPIEL',CARD:'KARTENSPIEL',QUIZ:'QUIZ',REACTION:'REAKTION',CHALLENGE:'HERAUSFORDERUNG',BOARD:'BRETTSPIEL',STRATEGY:'STRATEGIE',KNOWLEDGE:'WISSEN'})[c]||String(c||'SPIEL')}
  function iconKey(c){return ({THROWING:'target',SPORT:'target',DEXTERITY:'blocks',DICE:'dice',CARD:'cards',MUSIC:'music',WORD:'cards',QUIZ:'cards',KNOWLEDGE:'cards',REACTION:'target'})[c]||'target'}
  function envList(e){e=String(e||'').toUpperCase();if(e==='OUTDOOR')return ['outdoor'];if(e==='INDOOR'||e==='DIGITAL'||e==='CONSOLE')return ['indoor'];return ['indoor','outdoor']}
  function toShopGame(g){
    return {
      id:g.game_id,
      slug:g.slug||g.game_id,
      name:String(g.name||g.game_id).toUpperCase(),
      shortName:String(g.short_name||g.name||'').toUpperCase(),
      category:categoryLabel(g.category),
      environment:envList(g.environment),
      supportsModes:[...(g.supports_team?['team']:[]),...(g.supports_solo?['solo']:[])],
      shortDescription:g.short_description||'',
      rulesText:g.rules_text||'',
      rulesJson:g.rules_json||{},
      filterTags:g.filterTags||[],
      equipment:(g.equipment||[]).map(x=>({
        equipmentId:x.equipment_id,
        name:x.name,
        equipmentType:x.equipment_type,
        description:x.description||'',
        quantity:x.quantity||1,
        required:x.is_required!==false,
        notes:x.notes||'',
        procurementPolicy:x.procurement_policy||'UNSPECIFIED',
        procurementNote:x.procurement_note||'',
        productId:x.default_product?.product_id||null,
        productName:x.default_product?.name||null,
        priceCents:x.default_product?.sale_price_cents??x.default_product?.price_cents??null,
        currency:x.default_product?.currency||'EUR',
        variantCount:Array.isArray(x.product_variants)?x.product_variants.length:0
      })),
      active:true,
      sortOrder:g.sort_order||0,
      iconKey:iconKey(g.category),
      competitionMode:g.competition_mode,
      playMode:g.default_play_mode
    };
  }
  async function loadCatalog(){
    // Der eigentliche Spielekatalog ist Pflicht. Zusatzdaten wie Material und
    // Filter dürfen den kompletten App-Start dagegen niemals blockieren.
    const {data:games,error:gamesError}=await supabase.from('available_games')
      .select('game_id,slug,name,short_name,category,environment,family_id,supports_team,supports_solo,tracker_type,result_type,competition_mode,default_play_mode,sort_order,short_description,rules_text,rules_json')
      .eq('is_active',true).order('sort_order',{ascending:true}).order('name',{ascending:true});
    if(gamesError) throw new Error('Spielekatalog: '+(gamesError.message||'unbekannter Fehler'));

    let reqs=[],tags=[],tagMap=[];
    const extras=await Promise.allSettled([
      supabase.from('game_equipment_requirements').select('game_id,equipment_id,quantity,is_required,notes'),
      supabase.from('game_shop_filter_tags').select('filter_tag_id,label_de,sort_order').eq('is_active',true).order('sort_order',{ascending:true}),
      supabase.from('game_shop_filter_assignments').select('game_id,filter_tag_id')
    ]);
    if(extras[0].status==='fulfilled' && !extras[0].value.error) reqs=extras[0].value.data||[];
    if(extras[1].status==='fulfilled' && !extras[1].value.error) tags=extras[1].value.data||[];
    if(extras[2].status==='fulfilled' && !extras[2].value.error) tagMap=extras[2].value.data||[];

    const equipmentIds=[...new Set(reqs.map(r=>r.equipment_id).filter(Boolean))];
    let equipment=[];
    if(equipmentIds.length){
      try{
        const {data,error}=await supabase.from('equipment')
          .select('equipment_id,name,equipment_type,description,procurement_policy,procurement_note')
          .in('equipment_id',equipmentIds).eq('is_active',true);
        if(!error) equipment=data||[];
      }catch(_){}
    }

    let products=[];
    if(equipmentIds.length){
      try{
        const {data,error}=await supabase.from('shop_products')
          .select('product_id,equipment_id,name,product_type,price_cents,purchase_price_cents,sale_price_cents,variant_label,currency,purchase_url,is_default,is_active,sort_order')
          .in('equipment_id',equipmentIds).eq('is_active',true).order('sort_order',{ascending:true});
        if(!error) products=data||[];
      }catch(_){}
    }

    const defaultProductByEquipment={};
    const productsByEquipment={};
    products.forEach(p=>{
      (productsByEquipment[p.equipment_id]??=[]).push(p);
      if(p.is_default && !defaultProductByEquipment[p.equipment_id]) defaultProductByEquipment[p.equipment_id]=p;
    });

    const equipmentById=Object.fromEntries(equipment.map(e=>[
      e.equipment_id,
      {...e,default_product:defaultProductByEquipment[e.equipment_id]||null,product_variants:productsByEquipment[e.equipment_id]||[]}
    ]));

    const reqsByGame={};
    reqs.forEach(r=>{
      const e=equipmentById[r.equipment_id];if(!e)return;
      (reqsByGame[r.game_id]??=[]).push({...e,quantity:r.quantity,is_required:r.is_required,notes:r.notes});
    });

    const tagsById=Object.fromEntries(tags.map(t=>[t.filter_tag_id,{id:t.filter_tag_id,label:t.label_de,sortOrder:t.sort_order||0}]));
    const tagsByGame={};
    tagMap.forEach(x=>{
      const tag=tagsById[x.filter_tag_id]; if(!tag)return;
      (tagsByGame[x.game_id]??=[]).push(tag);
    });
    Object.values(tagsByGame).forEach(arr=>arr.sort((a,b)=>a.sortOrder-b.sortOrder||a.label.localeCompare(b.label,'de')));

    catalog=(games||[]).map(g=>({...g,equipment:reqsByGame[g.game_id]||[],filterTags:tagsByGame[g.game_id]||[]}));
    return catalog;
  }
  function sendShopInit(){
    if(!shopFrame?.contentWindow){pendingShopInit=true;return}
    if(!shopReady){pendingShopInit=true;return}
    const compatibleCatalog=catalog.filter(g=>mode==='SOLO'?g.supports_solo:g.supports_team);
    const games=compatibleCatalog.map(toShopGame);
    const expectedPlayers=mode==='SOLO'?soloPlayerCount:teamCount*2;
    const saved=pendingShopPayload||{};
    const initPayload={
      type:'SKIELSEN_SHOP_INIT',games,mode,activePlayers:expectedPlayers,
      comparisonPlayers:saved.comparisonPlayers||expectedPlayers,
      selectedGameIds:saved.gameIds||[],themeId:saved.themeId||'theme.skielsen.core',
      themes:themeCatalog.map(row=>({theme_pack_id:row.theme_pack_id,name:row.name,price_cents:Number(row.price_cents||0),animation_addon_cents:Number(row.animation_addon_cents||0),theme_contract:row.theme_contract})),
      featurePackId:saved.featurePackId||null,themeAnimations:!!saved.themeAnimations,
      gameAnimations:!!saved.gameAnimations,extrasVisited:!!saved.extrasVisited
    };
    let delivered=false;
    try{
      const directInit=shopFrame.contentWindow.SKIELSEN_SHOP_INIT;
      if(typeof directInit==='function'){directInit(initPayload);delivered=true;}
    }catch(_){ }
    if(!delivered){try{shopFrame.contentWindow.postMessage(initPayload,'*');delivered=true}catch(_){}}
    pendingShopInit=!delivered;
  }

  // Android/content:// war beim READY-Handshake zwischen Parent und srcdoc-iframe
  // unzuverlässig. Der load-Event ist die robuste zweite Initialisierungsschiene.
  shopFrame.addEventListener('load',()=>{
    shopReady=true;
    pendingShopInit=true;
    setTimeout(sendShopInit,0);
    setTimeout(sendShopInit,120);
    setTimeout(sendShopInit,400);
  });
  function accountDisplayName(sess=session){
    const u=sess?.user||{};
    return String(u?.user_metadata?.display_name||u?.user_metadata?.name||u?.email?.split('@')[0]||'PLAYER').trim();
  }
  function initials(name){
    const parts=String(name||'SK').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0,2).map(x=>x[0]).join('')||'SK').toUpperCase();
  }
  function readLocalGroups(){
    try{return JSON.parse(localStorage.getItem('skielsen.prototype.groups')||'[]')}catch(_){return []}
  }
  function writeLocalGroups(groups){try{localStorage.setItem('skielsen.prototype.groups',JSON.stringify(groups))}catch(_){}}
  function renderGroupsHome(){
    const wrap=document.getElementById('dbbMyGroups');
    const groups=readLocalGroups().filter(g=>!g.owner_id||g.owner_id===session?.user?.id);
    if(!groups.length){wrap.innerHTML='<div class="dbb-list-empty">NOCH KEINE FESTE GRUPPE. Gruppen dürfen später mehr Mitglieder haben als ein einzelnes Turnier aktive Plätze.</div>';return}
    wrap.innerHTML=groups.map(g=>`<button class="dbb-group-card" data-open-group="${escapeHtml(g.id)}" type="button"><i style="background:var(--core-blue)"></i><div><small>FESTE GRUPPE · EWIGE TABELLE</small><strong>${escapeHtml(g.name)}</strong><span>${Number(g.member_count||1)} MITGLIEDER · TURNIERKADER JE NACH MODUS</span></div><b class="dbb-card-arrow">→</b></button>`).join('');
  }
  async function renderMyTournaments(){
    const wrap=document.getElementById('dbbMyTournaments');
    const {data,error}=await supabase.from('tournaments').select('tournament_id,name,mode,status,expected_active_players,creator_user_id,created_at,game_order_finalized_at').order('created_at',{ascending:false});
    if(error){wrap.innerHTML='<div class="dbb-list-empty">TURNIERE KONNTEN NICHT GELADEN WERDEN: '+escapeHtml(error.message||'FEHLER')+'</div>';return}
    const rows=Array.isArray(data)?data:[];
    if(!rows.length){wrap.innerHTML='<div class="dbb-list-empty">NOCH KEIN TURNIER. Erstelle eines oder tritt per Invite-Code bei.</div>';return}
    wrap.innerHTML=rows.map(t=>{const admin=t.creator_user_id===session?.user?.id;const deletable=admin&&!['LIVE','COMPLETED'].includes(String(t.status||'').toUpperCase());return `<div class="dbb-tournament-row"><button class="dbb-tournament-card" data-open-tournament="${escapeHtml(t.tournament_id)}" data-tournament-name="${escapeHtml(t.name||'TURNIER')}" data-status="${escapeHtml(t.status||'')}" type="button"><i style="background:${String(t.mode).toUpperCase()==='SOLO'?'var(--core-yellow)':'var(--core-red)'}"></i><div><small>${escapeHtml(String(t.status||'LOBBY').toUpperCase())} · ${admin?'DU BIST ADMIN':'DU BIST PLAYER'}</small><strong>${escapeHtml(String(t.name||'TURNIER').toUpperCase())}</strong><span>${escapeHtml(String(t.mode||'TEAM').toUpperCase())}</span></div><b class="dbb-card-arrow">→</b></button>${deletable?`<button class="dbb-tournament-delete" data-delete-tournament="${escapeHtml(t.tournament_id)}" data-delete-name="${escapeHtml(t.name||'TURNIER')}" type="button">LÖSCHEN</button>`:''}</div>`}).join('');
  }
  async function enterAccountHome(sess,historyMode='push'){
    session=sess;
    const name=accountDisplayName(sess),ini=initials(name);
    document.getElementById('dbbHomeName').textContent=name.toUpperCase();
    document.getElementById('dbbHomeEmail').textContent=sess?.user?.email||'—';
    document.getElementById('dbbHomeAvatar').textContent=ini;
    document.getElementById('dbbJoinName').textContent=name.toUpperCase();
    document.getElementById('dbbJoinAvatar').textContent=ini;
    const mainJoinName=document.querySelector('#joinPage .jl-user strong'); if(mainJoinName)mainJoinName.textContent=name.toUpperCase();
    const mainJoinAvatar=document.querySelector('#joinPage .jl-avatar'); if(mainJoinAvatar)mainJoinAvatar.textContent=ini;
    renderGroupsHome();
    showStep('home',historyMode);
    await renderMyTournaments();
  }

  window.skielsenOpenAccountHome=async function(){
    overlay.hidden=false;
    document.body.classList.remove('v15-tournament-active');
    await enterAccountHome(session);
  };

  function updateCreationContext(){
    const box=document.getElementById('dbbCreationContext');
    const parts=[];
    if(creationContext.type==='REMATCH'){
      parts.push('<b>REVANCHE.</b> Parent: '+escapeHtml(creationContext.parentName||'LETZTES TURNIER')+'. Diese Revanche erzeugt bzw. verlängert automatisch die Turnierserie <b>'+escapeHtml(creationContext.seriesName||'REVANCHE-SERIE')+'</b>.');
    }
    if(creationContext.groupId){
      parts.push('<b>GRUPPENKONTEXT.</b> '+escapeHtml(creationContext.groupName||'GRUPPE')+' · Die Gruppe kann größer als der aktive Turnierkader sein. Historische Serien können auch später derselben Gruppe zugeordnet werden.');
    }
    if(!parts.length){box.hidden=true;box.textContent='';return}
    box.hidden=false;box.innerHTML=parts.join('<br><br>');
  }
  async function enterSetup(sess){
    session=sess;
    document.getElementById('dbbSignedInAs').textContent=(accountDisplayName(sess)+' · '+(sess?.user?.email||'')).toUpperCase();
    updateCreationContext();
    showStep('setup');
    if(!catalog.length){
      setFeedback(setupFeedback,'SPIELEKATALOG WIRD GELADEN …');
      try{await loadCatalog();setFeedback(setupFeedback,catalog.length+' SPIELE AUS SUPABASE GELADEN.','ok')}
      catch(err){setFeedback(setupFeedback,'SPIELEKATALOG KONNTE NICHT GELADEN WERDEN: '+(err?.message||err),'error')}
    }
  }
  async function signIn(){
    const email=document.getElementById('dbbEmail').value.trim(),password=document.getElementById('dbbPassword').value;
    if(!email||!password){setFeedback(authFeedback,'E-MAIL UND PASSWORT FEHLEN.','error');return}
    setFeedback(authFeedback,'ANMELDUNG LÄUFT …');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error){setFeedback(authFeedback,error.message,'error');return}setFeedback(authFeedback,'ANGEMELDET.','ok');session=data.session;await loadThemeCatalog(true);await enterAccountHome(data.session,'replace');
  }
  async function signUp(){
    const email=document.getElementById('dbbEmail').value.trim(),password=document.getElementById('dbbPassword').value,displayName=document.getElementById('dbbDisplayName').value.trim()||'Player';
    if(!email||password.length<6){setFeedback(authFeedback,'GÜLTIGE E-MAIL + PASSWORT MIT MINDESTENS 6 ZEICHEN.','error');return}
    setFeedback(authFeedback,'KONTO WIRD ERSTELLT …');const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName}}});if(error){setFeedback(authFeedback,error.message,'error');return}if(data.session){setFeedback(authFeedback,'KONTO ERSTELLT UND ANGEMELDET.','ok');session=data.session;await loadThemeCatalog(true);await enterAccountHome(data.session,'replace')}else setFeedback(authFeedback,'KONTO ERSTELLT. FALLS DIE E-MAIL-BESTÄTIGUNG AKTIV IST: E-MAIL BESTÄTIGEN UND DANACH ANMELDEN.','ok');
  }
  async function openShop(){
    const name=document.getElementById('dbbTournamentName').value.trim();
    if(name.length<3){
      setFeedback(setupFeedback,'TURNIERNAME MUSS MINDESTENS 3 ZEICHEN HABEN.','error');
      return;
    }
    try{
      if(!catalog.length){
        setFeedback(setupFeedback,'SPIELEKATALOG WIRD GELADEN …');
        await loadCatalog();
      }
      if(!catalog.length){
        setFeedback(setupFeedback,'KEINE SPIELE AUS SUPABASE GELADEN.','error');
        return;
      }
      setFeedback(setupFeedback,catalog.length+' SPIELE AUS SUPABASE GELADEN.','ok');
      shopDraftActive=true;
      postCartLocked=false;
      showStep('shop');
      if(!shopFrame.srcdoc){
        shopReady=false;
        pendingShopInit=true;
        shopFrame.srcdoc=SHOP_DOC.replaceAll('__SKIELSEN_VERSION__',APP_VERSION);
      }else{
        // Bereits geladener Shop: direkt erneut mit dem aktuellen DB-Katalog versorgen.
        shopReady=true;
        sendShopInit();
        setTimeout(sendShopInit,120);
      }
    }catch(err){
      setFeedback(setupFeedback,'SPIELEKATALOG KONNTE NICHT GELADEN WERDEN: '+(err?.message||err),'error');
    }
  }
  function gripDots(){
    return '<span class="dbb-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  }

  function updateOrderNumbers(){
    const rows=[...document.querySelectorAll('#dbbOrderGames .dbb-order-row')];
    rows.forEach((row,index)=>{
      const no=row.querySelector('.dbb-order-no');
      if(no) no.textContent=String(index+1).padStart(2,'0');

      const nameBox=row.querySelector('.dbb-order-name');
      nameBox?.querySelector('.dbb-final-badge')?.remove();
      if(index===rows.length-1 && nameBox){
        const finale=document.createElement('span');
        finale.className='dbb-final-badge';
        finale.textContent='FINALE';
        nameBox.appendChild(finale);
      }

      const handle=row.querySelector('.dbb-drag-handle');
      const gameName=catalog.find(g=>g.game_id===row.dataset.gameId)?.name||'Spiel';
      if(handle) handle.setAttribute('aria-label',gameName+' verschieben, Position '+(index+1));
    });
  }

  function syncPostShopOrderFromDom(){
    const rows=[...document.querySelectorAll('#dbbOrderGames .dbb-order-row')];
    lastResult.game_ids=rows.map(row=>row.dataset.gameId);
    lastResult.game_names=lastResult.game_ids.map(id=>catalog.find(g=>g.game_id===id)?.name||id);
    updateOrderNumbers();
  }

  function moveOrderRowByKeyboard(row,delta){
    const wrap=document.getElementById('dbbOrderGames');
    const rows=[...wrap.querySelectorAll('.dbb-order-row')];
    const index=rows.indexOf(row);
    const next=index+delta;
    if(index<0||next<0||next>=rows.length)return;
    if(delta<0) wrap.insertBefore(row,rows[next]);
    else wrap.insertBefore(rows[next],row);
    syncPostShopOrderFromDom();
    row.querySelector('.dbb-drag-handle')?.focus();
    if(navigator.vibrate) navigator.vibrate(12);
  }

  function bindPostShopDrag(){
    const wrap=document.getElementById('dbbOrderGames');
    let dragState=null;

    const clearDropHints=()=>{
      wrap.querySelectorAll('.dbb-drop-before').forEach(x=>x.classList.remove('dbb-drop-before'));
    };

    const cleanup=()=>{
      if(!dragState)return;
      dragState.row.classList.remove('dbb-dragging');
      clearDropHints();
      syncPostShopOrderFromDom();

      window.removeEventListener('pointermove',onGlobalPointerMove,true);
      window.removeEventListener('pointerup',onGlobalPointerUp,true);
      window.removeEventListener('pointercancel',onGlobalPointerUp,true);

      if(navigator.vibrate) navigator.vibrate(10);
      dragState=null;
    };

    const rearrangeAt=(clientY)=>{
      if(!dragState)return;
      const dragged=dragState.row;
      const others=[...wrap.querySelectorAll('.dbb-order-row')].filter(row=>row!==dragged);

      let before=null;
      for(const row of others){
        const rect=row.getBoundingClientRect();
        if(clientY < rect.top + rect.height/2){
          before=row;
          break;
        }
      }

      clearDropHints();

      if(before){
        before.classList.add('dbb-drop-before');
        if(dragged.nextElementSibling!==before){
          wrap.insertBefore(dragged,before);
        }
      }else if(wrap.lastElementChild!==dragged){
        wrap.appendChild(dragged);
      }

      updateOrderNumbers();
    };

    function onGlobalPointerMove(e){
      if(!dragState || e.pointerId!==dragState.pointerId)return;
      e.preventDefault();

      // Auto-Scroll nur während eines echten Griffs.
      if(e.clientY<95){
        window.scrollBy({top:-16,behavior:'auto'});
      }else if(e.clientY>window.innerHeight-95){
        window.scrollBy({top:16,behavior:'auto'});
      }

      rearrangeAt(e.clientY);
    }

    function onGlobalPointerUp(e){
      if(!dragState || e.pointerId!==dragState.pointerId)return;
      e.preventDefault();
      cleanup();
    }

    wrap.querySelectorAll('.dbb-drag-handle').forEach(handle=>{
      handle.addEventListener('keydown',e=>{
        const row=handle.closest('.dbb-order-row');
        if(e.key==='ArrowUp'){
          e.preventDefault();
          moveOrderRowByKeyboard(row,-1);
        }
        if(e.key==='ArrowDown'){
          e.preventDefault();
          moveOrderRowByKeyboard(row,1);
        }
      });

      // WICHTIG: Nur diese kleine Griff-Box startet das Rearrange.
      // Die restliche Zeile besitzt keinerlei Drag-Listener und bleibt normales Scroll-Gebiet.
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==undefined && e.button!==0)return;
        if(dragState)return;

        const row=handle.closest('.dbb-order-row');
        if(!row)return;

        dragState={
          row,
          handle,
          pointerId:e.pointerId
        };

        row.classList.add('dbb-dragging');
        clearDropHints();

        // Listener liegen bewusst am Window statt am verschobenen DOM-Element.
        // Dadurch bricht der Drag nicht mehr ab, wenn die Zeile im DOM umsortiert wird.
        window.addEventListener('pointermove',onGlobalPointerMove,{capture:true,passive:false});
        window.addEventListener('pointerup',onGlobalPointerUp,{capture:true,passive:false});
        window.addEventListener('pointercancel',onGlobalPointerUp,{capture:true,passive:false});

        if(navigator.vibrate) navigator.vibrate(18);

        e.preventDefault();
        e.stopPropagation();
      });
    });
  }


  function orderEnvironment(game){
    const env=String(game?.environment||'').toUpperCase();
    if(env==='OUTDOOR') return 'OUTDOOR';
    if(env==='INDOOR'||env==='DIGITAL'||env==='CONSOLE') return 'INDOOR';
    return 'FLEX';
  }

  function physicalEquipmentIds(game){
    return new Set((game?.equipment||[])
      .filter(e=>String(e.equipment_type||e.equipmentType||'').toUpperCase()==='PHYSICAL')
      .map(e=>e.equipment_id||e.equipmentId)
      .filter(Boolean));
  }

  function sharedCount(a,b){
    if(!a||!b)return 0;
    let count=0;
    for(const x of a) if(b.has(x)) count++;
    return count;
  }

  function buildOrderBlocks(ids){
    const selected=ids.map((id,index)=>({
      game:catalog.find(g=>g.game_id===id)||{game_id:id,name:id},
      originalIndex:index
    }));

    const familyCounts={};
    selected.forEach(x=>{
      const family=x.game.family_id;
      if(family) familyCounts[family]=(familyCounts[family]||0)+1;
    });

    const consumed=new Set();
    const blocks=[];

    selected.forEach(item=>{
      if(consumed.has(item.game.game_id))return;
      const family=item.game.family_id;
      let members;

      // Mehrere Spiele derselben Familie bleiben als atomarer Block zusammen,
      // z. B. alle drei Frisbee- oder Nerf-Modi.
      if(family && familyCounts[family]>1){
        members=selected.filter(x=>x.game.family_id===family);
      }else{
        members=[item];
      }

      members.forEach(x=>consumed.add(x.game.game_id));
      const games=members.map(x=>x.game);
      const envs=games.map(orderEnvironment);
      const fixed=envs.filter(e=>e!=='FLEX');
      const environment=fixed.length && fixed.every(e=>e===fixed[0]) ? fixed[0] : 'FLEX';

      const equipment=new Set();
      games.forEach(g=>physicalEquipmentIds(g).forEach(id=>equipment.add(id)));

      blocks.push({
        games,
        environment,
        equipment,
        categories:new Set(games.map(g=>g.category).filter(Boolean)),
        originalIndex:Math.min(...members.map(x=>x.originalIndex)),
        familyId:family&&familyCounts[family]>1?family:null
      });
    });

    return blocks;
  }

  function suggestTournamentOrder(){
    if(!lastResult?.game_ids?.length)return;
    const feedback=document.getElementById('dbbOrderFeedback');
    const blocks=buildOrderBlocks(lastResult.game_ids);
    const remaining=[...blocks];
    const ordered=[];

    let lastEnvironment=null;
    let environmentRun=0;
    let previousBlock=null;

    while(remaining.length){
      let targetEnvironment;
      if(!lastEnvironment){
        targetEnvironment=remaining.some(b=>b.environment==='OUTDOOR')?'OUTDOOR':'INDOOR';
      }else if(environmentRun>=2){
        targetEnvironment=lastEnvironment==='OUTDOOR'?'INDOOR':'OUTDOOR';
      }else{
        targetEnvironment=lastEnvironment;
      }

      let bestIndex=0;
      let bestScore=-Infinity;

      remaining.forEach((block,index)=>{
        const assignedEnvironment=block.environment==='FLEX'?targetEnvironment:block.environment;
        let score=0;

        // Hauptziel: ungefähr zwei draußen, dann zwei drinnen.
        if(assignedEnvironment===targetEnvironment) score+=60;
        if(block.environment==='FLEX') score+=18;

        // Nach zwei Spielen derselben Umgebung wird ein Wechsel deutlich bevorzugt.
        if(lastEnvironment && assignedEnvironment===lastEnvironment && environmentRun>=2) score-=70;
        if(lastEnvironment && assignedEnvironment!==lastEnvironment && environmentRun>=2) score+=35;

        // Bereits aufgebautes physisches Material möglichst weiterverwenden.
        const commonEquipment=previousBlock?sharedCount(block.equipment,previousBlock.equipment):0;
        score+=commonEquipment*24;

        // Etwas Abwechslung zwischen Spielarten, sofern keine stärkere Regel dagegen spricht.
        if(previousBlock){
          const sameCategory=[...block.categories].some(c=>previousBlock.categories.has(c));
          score+=sameCategory?-8:10;
        }

        // Familienblöcke werden nicht aufgeteilt; ein Block aus 3 Frisbee-Spielen
        // zählt daher auch als 3 Outdoor-Spiele in Folge und löst danach den Wechsel aus.
        if(block.familyId) score+=8;

        // Stabiler Tie-Break: ursprüngliche Auswahlreihenfolge möglichst respektieren.
        score-=block.originalIndex*0.01;

        if(score>bestScore){
          bestScore=score;
          bestIndex=index;
        }
      });

      const [chosen]=remaining.splice(bestIndex,1);
      const assignedEnvironment=chosen.environment==='FLEX'?targetEnvironment:chosen.environment;
      ordered.push(chosen);

      if(assignedEnvironment===lastEnvironment){
        environmentRun+=chosen.games.length;
      }else{
        lastEnvironment=assignedEnvironment;
        environmentRun=chosen.games.length;
      }
      previousBlock=chosen;
    }

    lastResult.game_ids=ordered.flatMap(block=>block.games.map(g=>g.game_id));
    lastResult.game_names=lastResult.game_ids.map(id=>catalog.find(g=>g.game_id===id)?.name||id);
    renderPostShopOrder();
    setFeedback(
      feedback,
      'VORSCHLAG ERSTELLT · SPIELFAMILIEN BLEIBEN ZUSAMMEN · ORTSWECHSEL WERDEN REDUZIERT · CA. 2× DRAUSSEN / 2× DRINNEN.',
      'ok'
    );
    if(navigator.vibrate) navigator.vibrate([12,40,12]);
  }

  function renderPostShopOrder(){
    const wrap=document.getElementById('dbbOrderGames');
    const ids=lastResult?.game_ids||[];
    wrap.innerHTML=ids.map((id,index)=>{
      const name=catalog.find(g=>g.game_id===id)?.name||id;
      return '<div class="dbb-order-row" data-game-id="'+escapeHtml(id)+'">'
        +'<div class="dbb-order-no">'+String(index+1).padStart(2,'0')+'</div>'
        +'<div class="dbb-order-name">'+escapeHtml(name)+'</div>'
        +'<button class="dbb-drag-handle" type="button" aria-label="'+escapeHtml(name)+' verschieben, Position '+(index+1)+'">'+gripDots()+'</button>'
        +'</div>';
    }).join('');
    bindPostShopDrag();
    updateOrderNumbers();
  }

  function euroFromCents(cents){
    if(cents===null||cents===undefined)return 'PREIS OFFEN';
    return (Number(cents)/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  }

  function buildMaterialState(payload){
    const byEquipment=new Map();

    (payload?.gameIds||[]).forEach(gameId=>{
      const game=catalog.find(g=>g.game_id===gameId);
      if(!game)return;

      (game.equipment||[]).forEach(eq=>{
        if(eq.is_required===false)return;
        if((eq.procurement_policy||'')==='INCLUDED_IN_APP')return;

        const type=String(eq.equipment_type||'').toUpperCase();
        if(!['PHYSICAL','HARDWARE','SOFTWARE'].includes(type))return;

        let item=byEquipment.get(eq.equipment_id);
        if(!item){
          const product=eq.default_product||null;
          const hasProduct=!!product;
          const policy=eq.procurement_policy||'UNSPECIFIED';
          const defaultChoice=hasProduct ? 'PURCHASE' : 'SELF_PROCURE';

          const variants=(Array.isArray(eq.product_variants)?eq.product_variants:[]).map(v=>({
            productId:v.product_id,
            productName:v.name,
            variantLabel:v.variant_label||v.name,
            priceCents:v.sale_price_cents??v.price_cents??null,
            currency:v.currency||'EUR',
            purchaseUrl:v.purchase_url||null,
            isDefault:!!v.is_default,
            sortOrder:Number(v.sort_order)||0
          })).sort((a,b)=>a.sortOrder-b.sortOrder||String(a.variantLabel).localeCompare(String(b.variantLabel),'de'));
          item={
            equipmentId:eq.equipment_id,
            name:eq.name||eq.equipment_id,
            equipmentType:type,
            procurementPolicy:policy,
            procurementNote:eq.procurement_note||'',
            quantityRequired:Math.max(Number(eq.quantity)||1,1),
            gameIds:[],
            gameNames:[],
            productId:product?.product_id||null,
            productName:product?.name||null,
            priceCents:product?.sale_price_cents??product?.price_cents??null,
            currency:product?.currency||'EUR',
            purchaseUrl:product?.purchase_url||null,
            variants,
            choice:defaultChoice
          };
          byEquipment.set(eq.equipment_id,item);
        }else{
          item.quantityRequired=Math.max(item.quantityRequired,Math.max(Number(eq.quantity)||1,1));
        }

        if(!item.gameIds.includes(gameId)){
          item.gameIds.push(gameId);
          item.gameNames.push(game.name||gameId);
        }
      });
    });

    return [...byEquipment.values()].sort((a,b)=>{
      const ap=a.choice==='PURCHASE'?0:1;
      const bp=b.choice==='PURCHASE'?0:1;
      return ap-bp || a.name.localeCompare(b.name,'de');
    });
  }

  function renderMaterialCheck(){
    const list=document.getElementById('dbbMaterialList');
    const warning=document.getElementById('dbbMaterialPriceWarning');
    list.replaceChildren();

    const purchase=materialState.filter(x=>x.choice==='PURCHASE');
    const owned=materialState.filter(x=>x.choice==='ALREADY_OWNED');
    const openPrice=purchase.filter(x=>x.priceCents===null||x.priceCents===undefined);
    const knownTotal=purchase.reduce((sum,x)=>sum+(x.priceCents==null?0:Number(x.priceCents)*x.quantityRequired),0);

    document.getElementById('dbbMaterialNeeded').textContent=String(materialState.length);
    document.getElementById('dbbMaterialPurchase').textContent=String(purchase.length);
    document.getElementById('dbbMaterialOwned').textContent=String(owned.length);
    document.getElementById('dbbMaterialTotal').textContent=euroFromCents(knownTotal);

    if(!materialState.length){
      const empty=document.createElement('div');
      empty.className='dbb-material-empty';
      empty.textContent='FÜR DIESE SPIELE IST KEIN EXTERNES MATERIAL ERFORDERLICH.';
      list.appendChild(empty);
    }

    materialState.forEach(item=>{
      const card=document.createElement('article');
      card.className='dbb-material-card';

      const top=document.createElement('div');
      top.className='dbb-material-top';

      const left=document.createElement('div');
      const name=document.createElement('div');
      name.className='dbb-material-name';
      name.textContent=item.name.toUpperCase();

      const meta=document.createElement('div');
      meta.className='dbb-material-meta';
      meta.textContent=`${item.quantityRequired}× benötigt · ${item.equipmentType}${item.variants?.length>1&&item.choice==='PURCHASE'?' · '+(item.variants.find(v=>v.productId===item.productId)?.variantLabel||'VARIANTE GEWÄHLT'):''}`;

      left.append(name,meta);

      const price=document.createElement('div');
      price.className='dbb-material-price';
      if(item.productId){
        price.textContent=item.priceCents==null?'PREIS OFFEN':euroFromCents(item.priceCents*item.quantityRequired);
        const small=document.createElement('small');
        small.textContent=item.quantityRequired>1 && item.priceCents!=null
          ? `${item.quantityRequired} × ${euroFromCents(item.priceCents)}`
          :'SKIELSEN SHOP';
        price.appendChild(small);
      }else{
        price.textContent='EXTERN';
        const small=document.createElement('small');
        small.textContent='NICHT IM SKIELSEN SHOP';
        price.appendChild(small);
      }

      top.append(left,price);

      const games=document.createElement('div');
      games.className='dbb-material-games';
      games.innerHTML='<b>BENÖTIGT FÜR:</b> '+item.gameNames.map(escapeHtml).join(' · ');

      const policy=document.createElement('span');
      policy.className='dbb-material-policy'+(item.procurementPolicy==='EXTERNAL_REQUIRED'?' external':'');
      policy.textContent=item.procurementPolicy==='SKIELSEN_SHOP'
        ?'IM SKIELSEN SHOP'
        :item.procurementPolicy==='EXTERNAL_REQUIRED'
          ?'EXTERN ERFORDERLICH'
          :'MATERIAL ERFORDERLICH';

      if(item.productId){
        if(Array.isArray(item.variants)&&item.variants.length>1){
          const variants=document.createElement('div');
          variants.className='dbb-material-variants';
          item.variants.forEach(v=>{
            const btn=document.createElement('button');
            btn.type='button';
            btn.className='dbb-material-variant'+(item.choice==='PURCHASE'&&item.productId===v.productId?' active':'');
            const left=document.createElement('span');
            const title=document.createElement('strong');
            title.textContent=v.variantLabel||v.productName||'VARIANTE';
            const sub=document.createElement('small');
            sub.textContent=v.productName||'';
            left.append(title,sub);
            const amount=document.createElement('b');
            amount.textContent=v.priceCents==null?'PREIS OFFEN':euroFromCents(Number(v.priceCents)*item.quantityRequired);
            btn.append(left,amount);
            btn.addEventListener('click',()=>{
              item.productId=v.productId;item.productName=v.productName;item.priceCents=v.priceCents;item.currency=v.currency;item.purchaseUrl=v.purchaseUrl;item.choice='PURCHASE';renderMaterialCheck();
            });
            variants.appendChild(btn);
          });
          const cancel=document.createElement('button');
          cancel.type='button';
          cancel.className='dbb-material-variant-cancel'+(item.choice==='ALREADY_OWNED'?' active':'');
          cancel.textContent='ABBESTELLEN · ICH HABE EIN GEEIGNETES SET';
          cancel.addEventListener('click',()=>{item.choice='ALREADY_OWNED';renderMaterialCheck();});
          variants.appendChild(cancel);
          card.append(top,games,policy,variants);
        }else{
          const choices=document.createElement('div');
          choices.className='dbb-material-choice';

          const first=document.createElement('button');
          first.type='button';
          first.dataset.materialEquipment=item.equipmentId;
          first.className='buy'+(item.choice==='PURCHASE'?' active':'');
          first.textContent=item.priceCents==null
            ?'✓ MITBESTELLEN · PREIS OFFEN'
            :'✓ MITBESTELLEN · '+euroFromCents(item.priceCents*item.quantityRequired);
          first.addEventListener('click',()=>{item.choice='PURCHASE';renderMaterialCheck();});

          const cancel=document.createElement('button');
          cancel.type='button';
          cancel.className=item.choice==='ALREADY_OWNED'?'active':'';
          cancel.textContent='ABBESTELLEN';
          cancel.addEventListener('click',()=>{item.choice='ALREADY_OWNED';renderMaterialCheck();});

          choices.append(first,cancel);
          card.append(top,games,policy,choices);
        }
      }else{
        const info=document.createElement('div');
        info.className='dbb-material-external-note';
        info.textContent='MUSS SELBST ORGANISIERT WERDEN · KEIN KAUF ÜBER SKIELSEN';
        card.append(top,games,policy,info);
      }
      list.appendChild(card);
    });

    if(openPrice.length){
      warning.hidden=false;
      warning.textContent=`${openPrice.length} ausgewählte${openPrice.length===1?'r Artikel hat':' Artikel haben'} noch keinen Preis in der Datenbank. Die Auswahl wird gespeichert; vor einer echten Bezahlung muss der Preis hinterlegt werden.`;
    }else{
      warning.hidden=true;
      warning.textContent='';
    }
    renderProcurementList();
  }

  function procurementItems(){
    return materialState.filter(x=>x.choice!=='PURCHASE').map(x=>({name:x.name,quantity:x.quantityRequired||1,games:x.gameNames||[]}));
  }
  function renderProcurementList(){
    const items=procurementItems();
    const box=document.getElementById('dbbProcureBox'),host=document.getElementById('dbbProcureList');
    if(box&&host){box.hidden=!items.length;host.innerHTML=items.map(x=>`<div class="dbb-procure-item"><strong>${escapeHtml(x.name)}</strong><span>${x.quantity}× · ${x.games.map(escapeHtml).join(' / ')}</span></div>`).join('');}
  }
  function printProcurementList(items=procurementItems()){
    const list=Array.isArray(items)?items:[];
    const w=window.open('','_blank','width=760,height=800');if(!w)return;
    const title=escapeHtml(lastResult?.name||document.getElementById('dbbTournamentName')?.value||'SKIELSEN TURNIER');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Besorgungsliste</title><link rel="stylesheet" href="assets/css/procurement-print.css?v=${APP_VERSION}">
</head><body><small>SKIELSEN · BESORGUNGSLISTE</small><h1>${title}</h1><ul>${list.map(x=>`<li><b>${escapeHtml(x.name||'MATERIAL')}</b>${Number(x.quantity||x.quantity_required||1)}×${x.games?.length?' · '+x.games.map(escapeHtml).join(' / '):''}</li>`).join('')}</ul><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  function digitalPriceCents(payload=pendingShopPayload){
    const p=payload||{};
    const n=Array.isArray(p.gameIds)?p.gameIds.length:0;
    const games=n<=4?0:(n<=9?499:999);
    const themeId=p.themeId||'theme.skielsen.core';
    const themeRow=themeCatalogRow(themeId);
    const theme=Math.max(0,Number(themeRow?.price_cents??(isCoreThemeId(themeId)?0:299)));
    const themeAnimations=(!isCoreThemeId(themeId)&&p.themeAnimations)?Math.max(0,Number(themeRow?.animation_addon_cents??199)):0;
    const gameAnimations=p.gameAnimations?399:0;
    return games+theme+themeAnimations+gameAnimations;
  }
  function materialPurchaseCents(){
    return materialState.filter(x=>x.choice==='PURCHASE').reduce((sum,x)=>sum+(x.priceCents==null?0:Number(x.priceCents)*Number(x.quantityRequired||1)),0);
  }
  function renderFinalCheckout(){
    const digital=digitalPriceCents();
    const material=materialPurchaseCents();
    const total=digital+material;
    const players=Math.max(1,Number(pendingShopPayload?.activePlayers)||Number(lastResult?.expected_active_players)||1);
    document.getElementById('dbbCheckoutDigital').textContent=euroFromCents(digital);
    document.getElementById('dbbCheckoutMaterial').textContent=euroFromCents(material);
    document.getElementById('dbbCheckoutTotal').textContent=euroFromCents(total);
    document.getElementById('dbbCheckoutPerPlayer').textContent=euroFromCents(Math.round(total/players));
    document.getElementById('dbbCheckoutPerPlayerSub').textContent=`BEI ${players} SPIELERN`;
  }
  function openFinalCheckout(){
    postCartLocked=true;
    renderFinalCheckout();
    setFeedback(document.getElementById('dbbCheckoutFeedback'),'');
    showStep('checkout');
  }

  function openMaterialCheck(payload){
    postCartLocked=false;
    pendingShopPayload={...(payload||{}),extrasVisited:true};
    applyAppTheme(pendingShopPayload.themeId||'theme.skielsen.core',!!pendingShopPayload.themeAnimations);
    materialState=buildMaterialState(pendingShopPayload);
    renderMaterialCheck();
    setFeedback(document.getElementById('dbbMaterialFeedback'),'MATERIAL-CHECK AUS DEM SPIELEKATALOG ERSTELLT.','ok');
    showStep('material');
  }

  function materialDecisionPayload(){
    return materialState.map(item=>({
      equipment_id:item.equipmentId,
      quantity_required:item.quantityRequired,
      procurement_choice:item.choice,
      product_id:item.choice==='PURCHASE'?item.productId:null,
      note:null
    }));
  }

  async function saveMaterialForExistingDraft(){
    if(!activeDraftTournamentId)return;
    const feedback=document.getElementById('dbbCheckoutFeedback');
    const btn=document.getElementById('dbbFinalizeCheckout');
    btn.disabled=true;
    setFeedback(feedback,'MATERIALAUSWAHL WIRD AKTUALISIERT …');
    const {error}=await supabase.rpc('save_tournament_equipment_decisions',{
      p_tournament_id:activeDraftTournamentId,
      p_decisions:materialDecisionPayload()
    });
    btn.disabled=false;
    if(error){setFeedback(feedback,error.message||'MATERIAL KONNTE NICHT GESPEICHERT WERDEN.','error');return}
    setFeedback(document.getElementById('dbbOrderFeedback'),'MATERIALAUSWAHL AKTUALISIERT. SHOP BLEIBT ABGESCHLOSSEN.','ok');
    renderPostShopOrder();
    showStep('order');
  }

  async function createFromShop(payload){
    const name=document.getElementById('dbbTournamentName').value.trim();
    const materialFeedback=document.getElementById('dbbCheckoutFeedback');
    const materialButton=document.getElementById('dbbFinalizeCheckout');
    materialButton.disabled=true;
    setFeedback(materialFeedback,'BESTELLUNG WIRD ABGESCHLOSSEN UND TURNIER ANGELEGT …');

    const args={
      p_name:name,
      p_mode:mode,
      p_game_ids:payload.gameIds,
      p_expected_active_players:payload.activePlayers,
      p_theme_pack_id:payload.themeId||'theme.skielsen.core',
      p_feature_pack_id:payload.featurePackId||null,
      p_feature_overrides:payload.features||{},
      p_equipment_decisions:materialDecisionPayload()
    };
    const {data,error}=await supabase.rpc('create_tournament_from_shop_with_equipment',args);
    if(error){
      materialButton.disabled=false;
      setFeedback(materialFeedback,error.message||'TURNIER KONNTE NICHT ANGELEGT WERDEN.','error');
      return;
    }
    const result=data||{};
    const premium=await supabase.rpc('save_tournament_premium_entitlements',{
      p_tournament_id:result.tournament_id,
      p_theme_animations:!!payload.themeAnimations,
      p_game_animations:!!payload.gameAnimations
    });
    if(premium.error){
      materialButton.disabled=false;
      setFeedback(materialFeedback,premium.error.message||'PREMIUM-AUSWAHL KONNTE NICHT GESPEICHERT WERDEN.','error');
      return;
    }
    const provisional=[...payload.gameIds].sort((a,b)=>{const ga=catalog.find(g=>g.game_id===a),gb=catalog.find(g=>g.game_id===b);return (ga?.sort_order??0)-(gb?.sort_order??0)||String(a).localeCompare(String(b));});
    activeDraftTournamentId=result.tournament_id||null;
    shopDraftActive=false;
    postCartLocked=true;
    lastResult={...result,game_ids:provisional,game_names:provisional.map(id=>catalog.find(g=>g.game_id===id)?.name||id),theme_pack_id:payload.themeId||'theme.skielsen.core',feature_pack_id:payload.featurePackId||null,theme_animations:!!payload.themeAnimations,game_animations:!!payload.gameAnimations,expected_active_players:payload.activePlayers,user_id:session?.user?.id||null,creation_context:{...creationContext},created_at:new Date().toISOString()};
    try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_ ){}
    window.SKIELSEN_DB_CONTEXT=lastResult;window.skielsenDb={client:supabase,context:lastResult};
    renderPostShopOrder();
    materialButton.disabled=false;
    setFeedback(document.getElementById('dbbOrderFeedback'),'BESTELLUNG ABGESCHLOSSEN. JETZT SPIELREIHENFOLGE FESTLEGEN.','ok');
    showStep('order');
  }
  async function finalizePostShopOrder(){
    if(!lastResult?.tournament_id||!lastResult?.game_ids?.length)return;
    const feedback=document.getElementById('dbbOrderFeedback');
    const btn=document.getElementById('dbbFinalizeOrder');
    btn.disabled=true;setFeedback(feedback,'REIHENFOLGE WIRD GESPEICHERT …');
    const {data,error}=await supabase.rpc('finalize_tournament_game_order',{p_tournament_id:lastResult.tournament_id,p_game_ids:lastResult.game_ids});
    if(error){
      btn.disabled=false;
      const message=(error.message==='TOURNAMENT_ORDER_NOT_ALLOWED')?'DIE REIHENFOLGE KANN FÜR DIESES TURNIER NICHT MEHR GEÄNDERT WERDEN.':(error.message==='GAME_ORDER_INVALID')?'DIE SPIELREIHENFOLGE IST UNVOLLSTÄNDIG ODER ENTHÄLT DOPPELTE SPIELE.':(error.message||'REIHENFOLGE KONNTE NICHT GESPEICHERT WERDEN.');
      setFeedback(feedback,message,'error');return;
    }
    const existingJoinCode=lastResult.join_code||null;
    lastResult={...lastResult,...(data||{}),status:'LOBBY',game_order_finalized:true};
    activeDraftTournamentId=null;
    postCartLocked=true;
    if(!lastResult.join_code&&existingJoinCode)lastResult.join_code=existingJoinCode;
    lastResult.game_names=lastResult.game_ids.map(id=>catalog.find(g=>g.game_id===id)?.name||id);
    if(creationContext.type==='REMATCH'){
      lastResult.creation_type='REMATCH';
      lastResult.parent_tournament_id=creationContext.parentTournamentId||null;
      lastResult.series_id=creationContext.seriesId||('series_'+(creationContext.parentTournamentId||lastResult.tournament_id));
      lastResult.series_name=creationContext.seriesName||'REVANCHE-SERIE';
    }
    if(creationContext.groupId){lastResult.group_id=creationContext.groupId;lastResult.group_name=creationContext.groupName||null}
    try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_ ){}
    window.SKIELSEN_DB_CONTEXT=lastResult;window.skielsenDb={client:supabase,context:lastResult};
    btn.disabled=false;
    await openStandaloneLobby(lastResult,lastResult.join_code||null);
  }

  const LOBBY_COLORS={RED:['ROT','var(--core-red)'],BLUE:['BLAU','var(--core-blue)'],YELLOW:['GELB','var(--core-yellow)'],GREEN:['GRÜN','var(--core-green)']};
  const LOBBY_TEAM_COLOR_ORDER=['BLUE','RED','YELLOW','GREEN'];
  const LOBBY_SOLO_COLOR_ORDER=['RED','BLUE','YELLOW','GREEN'];
  function lobbyInitials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?'}
  function lobbyErrorMessage(message){return ({JOIN_CODE_INVALID:'CODE NICHT ERKANNT · FORMAT SKL-XXXXXXXX',JOIN_CODE_NOT_FOUND_OR_CLOSED:'CODE UNGÜLTIG ODER DIE LOBBY IST BEREITS GESCHLOSSEN.',TOURNAMENT_FULL:'DAS TURNIER IST BEREITS VOLL.',TEAM_FULL:'DIESES TEAM HAT BEREITS 2 SPIELER.',TEAM_ASSIGNMENT_NOT_ALLOWED:'DU DARFST NUR DICH SELBST ZUORDNEN.',TEAM_RENAME_NOT_ALLOWED:'DIESEN TEAMNAMEN DARFST DU NICHT ÄNDERN.',TEAM_NAME_ALREADY_USED:'DIESER TEAMNAME WIRD BEREITS VERWENDET.',PLAYER_COUNT_NOT_COMPLETE:'NOCH NICHT ALLE ERWARTETEN SPIELER SIND BEIGETRETEN.',TEAM_ASSIGNMENTS_INCOMPLETE:'NOCH NICHT ALLE SPIELER SIND EINEM TEAM ZUGEORDNET.',NOT_ENOUGH_TEAMS:'MINDESTENS ZWEI TEAMS MÜSSEN BESETZT SEIN.',NOT_ENOUGH_PLAYERS:'MINDESTENS ZWEI SPIELER SIND ERFORDERLICH.',TOURNAMENT_NOT_STARTABLE:'DAS TURNIER KANN AUS DIESEM STATUS NICHT GESTARTET WERDEN.',TOURNAMENT_SETTINGS_NOT_CONFIRMED:'DIE TURNIER SETTINGS MÜSSEN VOR DEM START BESTÄTIGT WERDEN.',ADMIN_CAN_ONLY_ASSIGN_UNASSIGNED:'DER ADMIN KANN NUR NOCH NICHT ZUGEWIESENE SPIELER EINORDNEN.',TEAM_NOT_ACTIVE:'DIESES TEAM IST FÜR DIE GEWÄHLTE TEAMANZAHL NICHT AKTIV.'})[message]||message||'UNBEKANNTER FEHLER'}

  async function fetchLobbyState(){
    if(!lastResult?.tournament_id)return null;
    const {data,error}=await supabase.rpc('get_tournament_lobby',{p_tournament_id:lastResult.tournament_id});
    if(error)throw error;
    lobbyState=data||null;
    return lobbyState;
  }

  function ensureChristmasLobbySnow(){
    const back=document.getElementById('dbbXmasSnowBack'),front=document.getElementById('dbbXmasSnowFront');
    if(!back||!front||back.childElementCount||front.childElementCount)return;
    const fill=(host,count,opt)=>{for(let i=0;i<count;i++){const symbol=Math.random()>opt.symbolThreshold;const flake=document.createElement('span');flake.className='dbb-xmas-flake'+(symbol?' symbol':'');const size=opt.minSize+Math.random()*(opt.maxSize-opt.minSize);const duration=opt.minDuration+Math.random()*(opt.maxDuration-opt.minDuration);const alpha=opt.minAlpha+Math.random()*(opt.maxAlpha-opt.minAlpha);flake.style.setProperty('--x',(Math.random()*100).toFixed(2)+'%');flake.style.setProperty('--size',size.toFixed(1)+'px');flake.style.setProperty('--duration',duration.toFixed(2)+'s');flake.style.setProperty('--delay',(-Math.random()*duration).toFixed(2)+'s');flake.style.setProperty('--drift',((Math.random()*2-1)*opt.maxDrift).toFixed(1)+'px');flake.style.setProperty('--alpha',alpha.toFixed(2));flake.style.setProperty('--blur',(Math.random()*opt.maxBlur).toFixed(1)+'px');flake.style.setProperty('--sway',(2.8+Math.random()*3.5).toFixed(2)+'s');flake.style.setProperty('--static-y',(8+Math.random()*82).toFixed(1)+'%');if(symbol)flake.textContent=Math.random()>.5?'❄':'✦';host.appendChild(flake);}};
    fill(back,28,{minSize:3,maxSize:8,minDuration:10,maxDuration:18,maxDrift:24,minAlpha:.22,maxAlpha:.50,maxBlur:1.1,symbolThreshold:.90});
    fill(front,14,{minSize:7,maxSize:16,minDuration:7,maxDuration:12,maxDrift:42,minAlpha:.42,maxAlpha:.82,maxBlur:.35,symbolThreshold:.62});
  }

  function renderStandaloneLobby(){
    const st=lobbyState;if(!st)return;
    const tournamentTheme=st.theme_pack_id||lastResult?.theme_pack_id||'theme.skielsen.core';
    const animations=!!(st.theme_animations??lastResult?.theme_animations);
    lobbyStep.dataset.themePack=tournamentTheme;applyAppTheme(tournamentTheme,animations);
    if(tournamentTheme==='theme.christmas.winter_clash'&&animations)ensureChristmasLobbySnow();

    const members=Array.isArray(st.members)?st.members:[];
    const bots=Array.isArray(st.bots)?st.bots:[];
    const actors=[...members,...bots];
    const teams=Array.isArray(st.teams)?st.teams:[];
    const expected=Number(st.expected_active_players||actors.length||0);
    const isTeam=String(st.mode).toUpperCase()==='TEAM';
    const teamCount=isTeam?Math.max(2,Math.min(4,Math.round(expected/2)||4)):0;
    const activeColors=LOBBY_TEAM_COLOR_ORDER.slice(0,teamCount||4);
    const isAdmin=!!st.is_admin;
    const assigned=isTeam?actors.filter(m=>m.team_color&&activeColors.includes(m.team_color)).length:actors.filter(m=>m.solo_color).length;
    const occupiedTeams=isTeam?new Set(actors.map(m=>m.team_color).filter(c=>activeColors.includes(c))).size:0;
    const readyCount=actors.length>=2&&(!expected||actors.length===expected);
    const readyAssign=assigned===actors.length;
    const teamsFull=!isTeam||activeColors.every(c=>actors.filter(x=>x.team_color===c).length===2);
    const settingsReady=!isAdmin||!!st.settings_confirmed;
    const ready=readyCount&&readyAssign&&(!isTeam||occupiedTeams===teamCount)&&teamsFull&&settingsReady;

    document.getElementById('dbbLobbyHeroTitle').textContent=String(st.name||'TURNIER').toUpperCase()+' · LOBBY';
    document.getElementById('dbbLobbyName').textContent=String(st.name||'TURNIER').toUpperCase();
    document.getElementById('dbbLobbyMode').textContent=st.mode||'—';
    document.getElementById('dbbLobbyStatus').textContent=st.status||'LOBBY';
    document.getElementById('dbbLobbyRole').textContent=isAdmin?('TOURNAMENT ADMIN'+(bots.length?' · TEST MODE':'')):'PLAYER';
    document.getElementById('dbbLobbyJoined').textContent=actors.length+' / '+(expected||'—');
    document.getElementById('dbbLobbyAssigned').textContent=assigned+' / '+actors.length;
    document.getElementById('dbbLobbyAssignedHint').textContent=isTeam?'TEAMZUGEORDNET':'FARBE VERGEBEN';
    document.getElementById('dbbJoinCode').textContent=lobbyJoinCode||lastResult?.join_code||'NUR BEIM ADMIN / JOIN GESPEICHERT';
    document.getElementById('dbbLobbyCodeHelp').textContent=(lobbyJoinCode||lastResult?.join_code)?'Teile diesen Code mit echten Spielern. Test-Bots werden nur für diesen Testlauf angelegt.':'Der Klartext-Code wird aus Sicherheitsgründen nicht aus der Datenbank zurückgelesen.';

    document.getElementById('dbbTeamLobbyPanel').hidden=!isTeam;document.getElementById('dbbSoloLobbyPanel').hidden=isTeam;
    if(isTeam){
      document.querySelector('#dbbTeamLobbyPanel .dbb-lobby-panel-head span').textContent=activeColors.map(c=>LOBBY_COLORS[c][0]).join(' · ')+' · 2 PLAYER JE TEAM';
      document.getElementById('dbbLobbyTeams').innerHTML=activeColors.map(color=>{
        const info=LOBBY_COLORS[color],team=teams.find(t=>t.color===color)||{name:'TEAM '+info[0]};
        const teamMembers=members.filter(m=>m.team_color===color),teamBots=bots.filter(m=>m.team_color===color);
        const teamActors=[...teamMembers,...teamBots];
        const meInTeam=teamMembers.some(m=>m.user_id===st.current_user_id),canRename=isAdmin||meInTeam;
        const slots=[0,1].map(i=>{const m=teamActors[i];if(m){const bot=!!m.is_bot;return `<div class="dbb-lobby-team-slot occupied${bot?' bot':''}"><span>${escapeHtml(m.display_name)}${m.user_id===st.current_user_id?' · DU':''}${bot?'<i class="dbb-lobby-bot-pill">BOT</i>':''}</span><b>${m.user_id===lastResult?.user_id?'ADMIN':''}</b></div>`}return `<button class="dbb-lobby-team-slot" type="button" data-lobby-slot="${color}" aria-label="Freien Platz in Team ${info[0]} belegen">＋</button>`}).join('');
        return `<article class="dbb-lobby-team" style="--team-color:${info[1]}"><div class="dbb-lobby-team-top"><div class="dbb-lobby-team-name"><input data-lobby-team-name="${color}" value="${escapeHtml(team.name||('TEAM '+info[0]))}" ${canRename?'readonly':'disabled'} maxlength="24"><button data-lobby-rename="${color}" type="button" ${canRename?'':'disabled'} title="Teamname bearbeiten">✎</button></div></div><div class="dbb-lobby-team-members">${slots}</div></article>`;
      }).join('');
    }else{
      document.getElementById('dbbLobbySingles').innerHTML=LOBBY_SOLO_COLOR_ORDER.slice(0,Math.max(2,Math.min(4,expected||4))).map((color,i)=>{const info=LOBBY_COLORS[color],m=members.find(x=>x.solo_color===color)||bots.find(x=>x.solo_color===color),bot=!!m?.is_bot;return `<article class="dbb-lobby-single ${m?'':'empty'}" style="--solo-color:${info[1]}"><small>${i+1}. SLOT · ${info[0]}</small><strong>${m?escapeHtml(m.display_name):'FREIER PLATZ'}${bot?' · BOT':''}</strong><span>${m?(m.user_id===st.current_user_id?'DEINE FARBE':bot?'TEST BOT':'PLAYER'):'WARTET AUF BEITRITT'}</span></article>`}).join('');
    }

    if(lobbyAssignMemberId&&!members.some(m=>m.member_id===lobbyAssignMemberId&&!m.team_color))lobbyAssignMemberId=null;
    document.getElementById('dbbLobbyPlayers').innerHTML=actors.map(m=>{const bot=!!m.is_bot,label=m.team_color?LOBBY_COLORS[m.team_color]?.[0]||m.team_color:(m.solo_color?LOBBY_COLORS[m.solo_color]?.[0]||m.solo_color:'NOCH OFFEN'),selectable=!bot&&isTeam&&isAdmin&&!m.team_color&&m.user_id!==st.current_user_id,selected=selectable&&lobbyAssignMemberId===m.member_id;return `<div class="dbb-lobby-player${bot?' bot':''}${selectable?' selectable':''}${selected?' selected':''}" ${selectable?`data-lobby-select-player="${m.member_id}"`:''}><div class="dbb-lobby-player-avatar">${lobbyInitials(m.display_name)}</div><div><small>${m.user_id===st.current_user_id?'DU · ':''}${bot?'BOT · TEST · ':''}${isAdmin&&m.user_id===lastResult?.user_id?'ADMIN · ':''}${escapeHtml(label)}</small><strong>${escapeHtml(m.display_name)}</strong></div>${selectable?'<span class="dbb-lobby-player-action">SPIELER ZUWEISEN</span>':''}</div>`}).join('');

    document.getElementById('dbbLobbyGames').innerHTML=(lastResult?.game_names||[]).map((n,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><span>${escapeHtml(n)}</span></div>`).join('');
    const readyBox=document.getElementById('dbbLobbyReadyBox');readyBox.classList.toggle('ready',ready);
    document.getElementById('dbbLobbyReadyTitle').textContent=ready?'STARTKLAR':(!settingsReady?'SETTINGS NOCH OFFEN':'NOCH NICHT STARTKLAR');
    document.getElementById('dbbLobbyReadyCopy').textContent=ready?'Spieler/Bots, Zuordnung und Settings sind vollständig.':(!settingsReady?'Der Admin muss die Turnier Settings vor dem Start bestätigen.':(!readyCount?'Warte auf Spieler oder fülle freie Slots mit Test-Bots.':(!readyAssign?'Alle Spieler und Bots müssen einem Team bzw. einer Farbe zugeordnet sein.':'Alle vorgesehenen Teams müssen mit jeweils 2 Slots vollständig besetzt sein.')));
    const start=document.getElementById('dbbStartTournament');start.hidden=!isAdmin;start.disabled=!ready;document.getElementById('dbbOpenSettings').hidden=!isAdmin;
    const tools=document.getElementById('dbbLobbyTestTools');if(tools)tools.hidden=!isAdmin;const fill=document.getElementById('dbbFillBots'),clear=document.getElementById('dbbClearBots');if(fill){fill.hidden=actors.length>=expected;fill.disabled=actors.length>=expected}if(clear){clear.hidden=!bots.length}
    document.getElementById('dbbLobbyAdminNote').textContent=isAdmin?'Freie Slots können für interne Tests mit Bots gefüllt werden. Beim Start werden Invite-Code, Kader und Zuordnung geschlossen und das Turnier geöffnet.':'Warte auf den Tournament Admin. Nur er kann den Point of no Return auslösen.';
  }

  async function loadTournamentSettings(){
    if(!lastResult?.tournament_id)return;
    const {data,error}=await supabase.rpc('get_tournament_settings',{p_tournament_id:lastResult.tournament_id});
    if(error)throw error;
    tournamentSettings=data||{};
    if(lobbyState)lobbyState.settings_confirmed=!!tournamentSettings.settings_confirmed;
    renderTournamentSettings();
  }
  function renderTournamentSettings(){
    const host=document.getElementById('dbbSettingsList');if(!host||!tournamentSettings)return;
    const configurable=(tournamentSettings.features||[]).filter(f=>['feature.betting','feature.joker','feature.mvp_voting','feature.lvp_voting','feature.roast_news'].includes(f.feature_id)&&f.available!==false);
    host.innerHTML=configurable.map(f=>`<article class="dbb-setting-row"><div><strong>${escapeHtml(f.name||f.feature_id)}</strong>${f.source_feature_pack_id==='pack.jga'?'<small>JGA EXPERIENCE · FREIGESCHALTET</small>':''}</div><button class="dbb-setting-toggle ${f.enabled?'on':''}" type="button" data-setting-feature="${f.feature_id}" aria-label="${escapeHtml(f.name||f.feature_id)} umschalten"></button></article>`).join('')||'<div class="dbb-material-empty">KEINE KONFIGURIERBAREN FUNKTIONEN FREIGESCHALTET.</div>';
    const materials=Array.isArray(tournamentSettings.self_procure_materials)?tournamentSettings.self_procure_materials:[];
    const pbox=document.getElementById('dbbSettingsProcureBox'),plist=document.getElementById('dbbSettingsProcureList');
    if(pbox&&plist){pbox.hidden=!materials.length;plist.innerHTML=materials.map(x=>{const games=Array.isArray(x.source_game_names)?x.source_game_names:[];return `<div class="dbb-procure-item"><strong>${escapeHtml(x.name||x.equipment_id)}</strong><span>${Number(x.quantity_required||1)}×${games.length?' · '+games.map(escapeHtml).join(' / '):''}</span></div>`}).join('');}
    setFeedback(document.getElementById('dbbSettingsFeedback'),tournamentSettings.settings_confirmed?'SETTINGS BESTÄTIGT.':'NOCH NICHT BESTÄTIGT.',tournamentSettings.settings_confirmed?'ok':'');
  }
  async function openTournamentSettings(){
    try{await loadTournamentSettings();showStep('settings')}catch(err){setFeedback(document.getElementById('dbbLobbyFeedback'),err?.message||'SETTINGS KONNTEN NICHT GELADEN WERDEN.','error')}
  }

  async function refreshStandaloneLobby(silent=false){
    try{
      const st=await fetchLobbyState();
      try{const sr=await supabase.rpc('get_tournament_settings',{p_tournament_id:lastResult.tournament_id});if(!sr.error){tournamentSettings=sr.data||{};st.settings_confirmed=!!tournamentSettings.settings_confirmed;st.theme_animations=(tournamentSettings.features||[]).some(f=>f.feature_id==='feature.theme_animations'&&f.enabled);st.game_animations=(tournamentSettings.features||[]).some(f=>f.feature_id==='feature.game_animations'&&f.enabled)}}catch(_){}
      if(st?.status==='LIVE'){showStartedStep(st);return}
      renderStandaloneLobby();
      if(!silent)setFeedback(document.getElementById('dbbLobbyFeedback'),'LOBBY AKTUALISIERT.','ok');
    }catch(err){if(!silent)setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(err?.message),'error')}
  }

  async function openStandaloneLobby(ctx,joinCode=null,historyMode='push'){
    if(!themeCatalog.length)await loadThemeCatalog();
    try{lobbyVisualChoice=localStorage.getItem('skielsen.visual.'+ctx.tournament_id)||'tournament'}catch(_){lobbyVisualChoice='tournament'}
    if(!ctx?.tournament_id)return;
    lastResult={...lastResult,...ctx};
    lobbyJoinCode=joinCode||ctx.join_code||lobbyJoinCode;
    overlay.hidden=false;
    showStep('lobby',historyMode);
    setFeedback(document.getElementById('dbbLobbyFeedback'),'LOBBY WIRD GELADEN …');
    try{
      const st=await fetchLobbyState();
      try{const sr=await supabase.rpc('get_tournament_settings',{p_tournament_id:lastResult.tournament_id});if(!sr.error){tournamentSettings=sr.data||{};st.settings_confirmed=!!tournamentSettings.settings_confirmed;st.theme_animations=(tournamentSettings.features||[]).some(f=>f.feature_id==='feature.theme_animations'&&f.enabled);st.game_animations=(tournamentSettings.features||[]).some(f=>f.feature_id==='feature.game_animations'&&f.enabled)}}catch(_){}
      if(st?.status==='LIVE'){showStartedStep(st);return}
      renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'LOBBY LIVE · DATENBANK VERBUNDEN.','ok');
      if(lobbyPollTimer)clearInterval(lobbyPollTimer);
      lobbyPollTimer=setInterval(()=>{if(!lobbyStep.classList.contains('dbb-hidden'))refreshStandaloneLobby(true)},5000);
    }catch(err){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(err?.message),'error')}
  }

  async function showStartedStep(st,historyMode='replace'){
    if(lobbyPollTimer){clearInterval(lobbyPollTimer);lobbyPollTimer=null}
    const startedName=String(st?.name||st?.tournament_name||'').trim();
    if(lastResult){
      lastResult.status='LIVE';
      if(startedName)lastResult.name=startedName;
      try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_){}
    }
    showStep('started',historyMode);
    try{
      window.SKIELSEN_DB_CONTEXT=lastResult;window.skielsenDb={client:supabase,context:lastResult};
      const {data,error}=await supabase.rpc('get_v15_tournament_runtime',{p_tournament_id:lastResult.tournament_id});
      if(error)throw error;
      const rt=data||{};
      if(!String(lastResult?.name||'').trim()){
        try{
          const {data:nameRows}=await supabase.from('tournaments').select('name').eq('tournament_id',lastResult.tournament_id);
          const nameRow=Array.isArray(nameRows)?nameRows[0]:nameRows;
          if(String(nameRow?.name||'').trim()){
            lastResult.name=String(nameRow.name).trim();
            window.SKIELSEN_DB_CONTEXT=lastResult;
            try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_){}
          }
        }catch(_){}
      }
      rt.tournament_name=String(lastResult?.name||startedName||rt.tournament_name||'').trim();
      rt.__historyMode=historyMode==='none'?'none':'push';
      rt.theme_pack_id=rt.theme_pack_id||lastResult?.theme_pack_id||'theme.skielsen.core';
      if(!themeCatalog.length)await loadThemeCatalog();
      rt.theme_catalog=themeCatalog;
      rt.theme_contract=themeCatalogRow(rt.theme_pack_id)?.theme_contract||null;
      rt.features=Array.isArray(rt.features)?rt.features:[];
      overlay.hidden=true;
      if(typeof window.skielsenV15Activate!=='function')throw new Error('V15_RUNTIME_CLIENT_NOT_READY');
      await window.skielsenV15Activate(rt);
    }catch(err){
      overlay.hidden=false;showStep('started',historyMode==='none'?'none':'replace');
      setFeedback(document.getElementById('dbbLobbyFeedback'),'V15 RUNTIME FEHLER · '+(err?.message||err),'error');
      const card=document.querySelector('#dbbStartedStep .dbb-started-lock');if(card)card.innerHTML='<b>RUNTIME KONNTE NICHT GELADEN WERDEN.</b><br>'+escapeHtml(err?.message||String(err));
    }
  }

  
  try{
    // Kein externer JS-CDN mehr: Android öffnet Downloads als content://.
    // Darum nutzt dieser Prototyp einen kleinen nativen Supabase-Client auf Basis von fetch().
    const memoryStore=new Map();
    let storageFallbackActive=false;
    const safeStorage={
      getItem(key){
        try{
          const v=window.localStorage.getItem(key);
          return v===null?(memoryStore.get(key)??null):v;
        }catch(_){
          storageFallbackActive=true;
          return memoryStore.get(key)??null;
        }
      },
      setItem(key,value){
        memoryStore.set(key,String(value));
        try{window.localStorage.setItem(key,String(value));}
        catch(_){storageFallbackActive=true;}
      },
      removeItem(key){
        memoryStore.delete(key);
        try{window.localStorage.removeItem(key);}
        catch(_){storageFallbackActive=true;}
      }
    };

    function makeError(status,payload,fallback){
      const message=payload?.message||payload?.msg||payload?.error_description||payload?.error||fallback||('HTTP '+status);
      const err=new Error(message);
      err.status=status;
      err.payload=payload;
      return err;
    }

    async function readJsonSafe(res){
      const raw=await res.text();
      if(!raw) return null;
      try{return JSON.parse(raw)}catch(_){return raw}
    }

    function createNativeSupabase(baseUrl,apiKey,storage){
      const SESSION_KEY='skielsen.native.supabase.session';

      function getStoredSession(){
        try{
          const raw=storage.getItem(SESSION_KEY);
          return raw?JSON.parse(raw):null;
        }catch(_){return null}
      }
      function saveSession(s){
        if(s) storage.setItem(SESSION_KEY,JSON.stringify(s));
        else storage.removeItem(SESSION_KEY);
      }
      function authHeaders(token,extra={}){
        return {
          'apikey':apiKey,
          'Authorization':'Bearer '+(token||apiKey),
          ...extra
        };
      }
      async function authRequest(path,options={}){
        try{
          const res=await fetch(baseUrl+'/auth/v1'+path,options);
          const payload=await readJsonSafe(res);
          if(!res.ok) return {data:null,error:makeError(res.status,payload,'Anmeldung fehlgeschlagen.')};
          return {data:payload,error:null};
        }catch(err){
          return {data:null,error:new Error('Netzwerkzugriff fehlgeschlagen: '+(err?.message||err))};
        }
      }

      function sessionStillValid(current){
        if(!current?.access_token) return false;
        if(!current.expires_at) return true;
        // Eine Minute Puffer verhindert, dass ein Token mitten in einer Abfrage abläuft.
        return Number(current.expires_at) > Math.floor(Date.now()/1000)+60;
      }

      async function refreshStoredSession(){
        const current=getStoredSession();
        if(!current?.refresh_token){
          saveSession(null);
          return {session:null,error:new Error('Sitzung abgelaufen. Bitte erneut anmelden.')};
        }

        const {data,error}=await authRequest('/token?grant_type=refresh_token',{
          method:'POST',
          headers:authHeaders(null,{'Content-Type':'application/json'}),
          body:JSON.stringify({refresh_token:current.refresh_token})
        });

        if(error){
          saveSession(null);
          return {session:null,error};
        }

        const refreshed={
          access_token:data.access_token,
          refresh_token:data.refresh_token||current.refresh_token,
          expires_in:data.expires_in,
          expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),
          token_type:data.token_type||'bearer',
          user:data.user||current.user
        };
        saveSession(refreshed);
        return {session:refreshed,error:null};
      }

      async function getValidSession(){
        const current=getStoredSession();
        if(!current) return {session:null,error:null};
        if(sessionStillValid(current)) return {session:current,error:null};
        return refreshStoredSession();
      }

      class QueryBuilder{
        constructor(table){
          this.table=table;this.columns='*';this.filters=[];this.orders=[];this.singleMode=false;
        }
        select(columns='*'){this.columns=columns;return this}
        eq(column,value){this.filters.push([column,'eq.'+String(value)]);return this}
        in(column,values){
          const clean=(values||[]).map(v=>String(v).replace(/"/g,'\\"'));
          this.filters.push([column,'in.('+clean.join(',')+')']);return this
        }
        order(column,{ascending=true}={}){this.orders.push(column+'.'+(ascending?'asc':'desc'));return this}
        maybeSingle(){this.singleMode=true;return this.execute()}
        then(resolve,reject){return this.execute().then(resolve,reject)}
        async execute(){
          const params=new URLSearchParams();
          params.set('select',this.columns);
          this.filters.forEach(([k,v])=>params.append(k,v));
          if(this.orders.length) params.set('order',this.orders.join(','));
          const {session:current,error:sessionError}=await getValidSession();
          if(sessionError) return {data:null,error:sessionError};
          try{
            const res=await fetch(baseUrl+'/rest/v1/'+encodeURIComponent(this.table)+'?'+params.toString(),{
              headers:authHeaders(current?.access_token,{
                'Accept':'application/json'
              })
            });
            const payload=await readJsonSafe(res);
            if(!res.ok) return {data:null,error:makeError(res.status,payload,'Datenbankabfrage fehlgeschlagen.')};
            const data=this.singleMode?(Array.isArray(payload)?(payload[0]??null):payload):payload;
            return {data,error:null};
          }catch(err){
            return {data:null,error:new Error('Netzwerkzugriff fehlgeschlagen: '+(err?.message||err))};
          }
        }
      }

      return {
        auth:{
          async getSession(){
            const {session,error}=await getValidSession();
            return {data:{session},error};
          },
          async refreshSession(){
            const {session,error}=await refreshStoredSession();
            return {data:{session},error};
          },
          async signInWithPassword({email,password}){
            const {data,error}=await authRequest('/token?grant_type=password',{
              method:'POST',
              headers:authHeaders(null,{'Content-Type':'application/json'}),
              body:JSON.stringify({email,password})
            });
            if(error) return {data:{session:null,user:null},error};
            const session={
              access_token:data.access_token,
              refresh_token:data.refresh_token,
              expires_in:data.expires_in,
              expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),
              token_type:data.token_type||'bearer',
              user:data.user
            };
            saveSession(session);
            return {data:{session,user:data.user},error:null};
          },
          async signUp({email,password,options}){
            const body={email,password,data:options?.data||{}};
            const {data,error}=await authRequest('/signup',{
              method:'POST',
              headers:authHeaders(null,{'Content-Type':'application/json'}),
              body:JSON.stringify(body)
            });
            if(error) return {data:{session:null,user:null},error};
            let session=null;
            if(data?.access_token){
              session={
                access_token:data.access_token,
                refresh_token:data.refresh_token,
                expires_in:data.expires_in,
                expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),
                token_type:data.token_type||'bearer',
                user:data.user
              };
              saveSession(session);
            }
            return {data:{session,user:data?.user||data},error:null};
          },
          async signOut(){
            const current=getStoredSession();
            if(current?.access_token){
              try{
                await fetch(baseUrl+'/auth/v1/logout',{
                  method:'POST',
                  headers:authHeaders(current.access_token)
                });
              }catch(_){}
            }
            saveSession(null);
            return {error:null};
          }
        },
        from(table){return new QueryBuilder(table)},
        async rpc(name,args={}){
          const {session:current,error:sessionError}=await getValidSession();
          if(sessionError) return {data:null,error:sessionError};
          try{
            const res=await fetch(baseUrl+'/rest/v1/rpc/'+encodeURIComponent(name),{
              method:'POST',
              headers:authHeaders(current?.access_token,{
                'Content-Type':'application/json',
                'Accept':'application/json'
              }),
              body:JSON.stringify(args)
            });
            const payload=await readJsonSafe(res);
            if(!res.ok) return {data:null,error:makeError(res.status,payload,'Serverfunktion fehlgeschlagen.')};
            return {data:payload,error:null};
          }catch(err){
            return {data:null,error:new Error('Netzwerkzugriff fehlgeschlagen: '+(err?.message||err))};
          }
        }
      };
    }

    supabase=createNativeSupabase(SUPABASE_URL,SUPABASE_KEY,safeStorage);
    window.skielsenDb={client:supabase,context:null};

    const {data:{session:existing},error:sessionError}=await supabase.auth.getSession();
    if(sessionError) throw sessionError;
    session=existing;
    if(existing)await loadThemeCatalog();

    document.getElementById('dbbConnectionState').textContent='VERBUNDEN';
    document.querySelector('.dbb-dbstate i').style.background='#16864b';

    if(existing){
      await enterAccountHome(existing,'replace');
    }else{
      showStep('auth','replace');
    }
  }catch(err){
    document.getElementById('dbbConnectionState').textContent='VERBINDUNGSFEHLER';
    document.querySelector('.dbb-dbstate i').style.background='#d62828';
    const detail=(err?.name?err.name+': ':'')+(err?.message||String(err));
    setFeedback(authFeedback,'STARTFEHLER: '+detail,'error');
    showStep('auth','replace');
  }
  function openExitConfirm(title,text,confirmLabel,action){
    document.getElementById('dbbExitConfirmTitle').textContent=title;
    document.getElementById('dbbExitConfirmText').textContent=text;
    document.getElementById('dbbExitConfirmProceed').textContent=confirmLabel||'ENTWURF VERWERFEN';
    exitConfirmAction=action;
    exitConfirm.classList.add('open');
    exitConfirm.setAttribute('aria-hidden','false');
  }
  function closeExitConfirm(){
    exitConfirm.classList.remove('open');
    exitConfirm.setAttribute('aria-hidden','true');
    exitConfirmAction=null;
  }
  function resetShopSession(){
    shopDraftActive=false;
    postCartLocked=false;
    pendingShopInit=false;
    pendingShopPayload=null;
    materialState=[];
    shopReady=false;
    try{shopFrame.srcdoc=''}catch(_){}
  }
  async function discardActiveDraftIfNeeded(){
    if(!activeDraftTournamentId)return true;
    const id=activeDraftTournamentId;
    const {error}=await supabase.rpc('discard_tournament_draft',{p_tournament_id:id});
    if(error){
      alert('ENTWURF KONNTE NICHT VERWORFEN WERDEN: '+(error.message||'UNBEKANNTER FEHLER'));
      return false;
    }
    if(lastResult?.tournament_id===id){
      lastResult=null;
      try{
        const raw=localStorage.getItem('skielsen.db.lastTournament');
        const stored=raw?JSON.parse(raw):null;
        if(stored?.tournament_id===id)localStorage.removeItem('skielsen.db.lastTournament');
      }catch(_){}
    }
    activeDraftTournamentId=null;
    return true;
  }
  async function abandonCurrentCreation(target){
    const ok=await discardActiveDraftIfNeeded();
    if(!ok)return;
    resetShopSession();
    if(target==='setup'){
      showStep('setup','replace');
      return;
    }
    await enterAccountHome(session,'replace');
  }
  function confirmUnpaidCartExit(target){
    openExitConfirm(
      'TURNIERERSTELLUNG ABBRECHEN?',
      'Wirklich abbrechen? Der noch nicht abgeschlossene Warenkorb verfällt und die aktuelle Turniererstellung wird verworfen.',
      'ENTWURF VERWERFEN',
      ()=>abandonCurrentCreation(target)
    );
  }
  async function requestWorkflowHome(source=currentWorkflowStep){
    if(source==='shop'||(source==='material'&&shopDraftActive)){
      confirmUnpaidCartExit('home');
      return;
    }
    await enterAccountHome(session);
  }
  function requestWorkflowBack(source=currentWorkflowStep){
    switch(source){
      case 'createStart':
      case 'joinAccount':
      case 'groupCreate':
      case 'groupDetail':
        enterAccountHome(session,'replace');break;
      case 'setup':
        if(creationContext.groupId&&activeGroupId)showStep('groupDetail','replace');
        else showStep('createStart','replace');
        break;
      case 'shop':
        confirmUnpaidCartExit('setup');
        break;
      case 'material':
        if(postCartLocked){renderFinalCheckout();showStep('checkout','replace');break;}
        pendingShopPayload={...(pendingShopPayload||{}),extrasVisited:true};
        showStep('shop','replace');
        pendingShopInit=true;
        setTimeout(sendShopInit,0);
        setTimeout(sendShopInit,120);
        break;
      case 'checkout':
        renderMaterialCheck();
        showStep('material','replace');
        break;
      case 'order':
        renderMaterialCheck();
        setFeedback(document.getElementById('dbbMaterialFeedback'),'SHOP BLEIBT ABGESCHLOSSEN. MATERIAL KANN NOCH ANGEPASST WERDEN.','ok');
        showStep('material','replace');
        break;
      case 'settings':
        showStep('lobby','replace');break;
      case 'lobby':
      case 'started':
        enterAccountHome(session,'replace');break;
      default:
        enterAccountHome(session,'replace');
    }
  }
  function resetForNewCreation(){
    activeDraftTournamentId=null;
    lastResult=null;
    mode='TEAM';
    teamCount=4;
    soloPlayerCount=4;
    document.querySelectorAll('#dbbModePicker button').forEach(b=>b.classList.toggle('active',b.dataset.mode==='TEAM'));
    document.getElementById('dbbTeamCountField').hidden=false;
    document.getElementById('dbbSoloCountField').hidden=true;
    document.querySelectorAll('#dbbTeamCountPicker button').forEach(b=>b.classList.toggle('active',Number(b.dataset.teamCount)===4));
    document.querySelectorAll('#dbbSoloCountPicker button').forEach(b=>b.classList.toggle('active',Number(b.dataset.soloCount)===4));
    resetShopSession();
  }

  function setAuthMode(next){
    authMode=next;
    const signup=next==='signup';
    document.getElementById('dbbAuthTabSignIn').classList.toggle('active',!signup);
    document.getElementById('dbbAuthTabSignUp').classList.toggle('active',signup);
    document.getElementById('dbbDisplayNameField').hidden=!signup;
    document.getElementById('dbbSignIn').classList.toggle('dbb-hidden',signup);
    document.getElementById('dbbSignUp').classList.toggle('dbb-hidden',!signup);
    document.getElementById('dbbAuthPanelTitle').textContent=signup?'REGISTRIEREN':'ANMELDEN';
    setFeedback(authFeedback,'');
  }
  document.getElementById('dbbAuthTabSignIn').addEventListener('click',()=>setAuthMode('signin'));
  document.getElementById('dbbAuthTabSignUp').addEventListener('click',()=>setAuthMode('signup'));
  document.getElementById('dbbSignIn').addEventListener('click',signIn);
  document.getElementById('dbbSignUp').addEventListener('click',signUp);
  document.getElementById('dbbEmail').addEventListener('keydown',e=>{if(e.key==='Enter')(authMode==='signup'?signUp():signIn())});
  document.getElementById('dbbPassword').addEventListener('keydown',e=>{if(e.key==='Enter')(authMode==='signup'?signUp():signIn())});

  async function doSignOut(){await supabase.auth.signOut();session=null;showStep('auth','replace');setAuthMode('signin');setFeedback(authFeedback,'ABGEMELDET.','ok')}
  document.getElementById('dbbSignOut').addEventListener('click',doSignOut);
  document.getElementById('dbbHomeSignOut').addEventListener('click',doSignOut);
  globalHome.addEventListener('click',()=>requestWorkflowHome());
  document.getElementById('dbbExitConfirmCancel').addEventListener('click',closeExitConfirm);
  document.getElementById('dbbExitConfirmProceed').addEventListener('click',async()=>{const action=exitConfirmAction;exitConfirm.classList.remove('open');exitConfirm.setAttribute('aria-hidden','true');exitConfirmAction=null;if(action)await action();});
  document.getElementById('dbbHomeCreate').addEventListener('click',()=>showStep('createStart'));
  document.getElementById('dbbHomeJoin').addEventListener('click',()=>{document.getElementById('dbbAccountJoinCode').value='';setFeedback(document.getElementById('dbbAccountJoinFeedback'),'');showStep('joinAccount')});
  document.getElementById('dbbCreateBackHome').addEventListener('click',()=>enterAccountHome(session,'replace'));
  document.getElementById('dbbJoinBackHome').addEventListener('click',()=>enterAccountHome(session,'replace'));
  document.getElementById('dbbSetupBack').addEventListener('click',()=>requestWorkflowBack('setup'));
  document.getElementById('dbbCreateGroupShortcut').addEventListener('click',()=>showStep('groupCreate'));
  document.getElementById('dbbGroupCreateBack').addEventListener('click',()=>enterAccountHome(session,'replace'));
  document.getElementById('dbbGroupDetailBack').addEventListener('click',()=>enterAccountHome(session,'replace'));

  document.querySelectorAll('[data-create-source]').forEach(btn=>btn.addEventListener('click',()=>{
    const type=btn.dataset.createSource;
    if(type==='NEW'){resetForNewCreation();creationContext={type:'NEW'};document.getElementById('dbbTournamentName').value='';enterSetup(session);return}
    if(type==='REMATCH'){
      let parent=null;try{const raw=localStorage.getItem('skielsen.db.lastTournament');parent=raw?JSON.parse(raw):null}catch(_){}
      if(!parent?.tournament_id){document.getElementById('dbbCreateSourceInfo').textContent='FÜR EINE REVANCHE BRAUCHST DU ZUERST EIN FRÜHERES TURNIER. Erstelle zunächst ein normales Turnier.';return}
      const seriesId=parent.series_id||('series_'+parent.tournament_id);
      resetForNewCreation();
      creationContext={type:'REMATCH',parentTournamentId:parent.tournament_id,parentName:parent.name||'LETZTES TURNIER',seriesId,seriesName:parent.series_name||((parent.name||'SKIELSEN')+' · SERIE'),groupId:parent.group_id||null,groupName:parent.group_name||null};
      document.getElementById('dbbTournamentName').value=(parent.name||'SKIELSEN')+' · REVANCHE';enterSetup(session);return
    }
  }));

  document.getElementById('dbbCreateGroupLocal').addEventListener('click',()=>{
    const input=document.getElementById('dbbGroupNameInput'),feedback=document.getElementById('dbbGroupFeedback');
    const name=input.value.trim();if(name.length<3){setFeedback(feedback,'GRUPPENNAME MUSS MINDESTENS 3 ZEICHEN HABEN.','error');return}
    const groups=readLocalGroups();const id='grp_'+Date.now();groups.push({id,name,owner_id:session?.user?.id||null,member_count:1,created_at:new Date().toISOString()});writeLocalGroups(groups);activeGroupId=id;setFeedback(feedback,'GRUPPE IM UI-PROTOTYP ANGELEGT.','ok');openGroupDetail(id);
  });
  function openGroupDetail(id){
    const g=readLocalGroups().find(x=>x.id===id);if(!g)return;
    activeGroupId=id;document.getElementById('dbbGroupDetailTitle').textContent=String(g.name||'GRUPPE').toUpperCase();document.getElementById('dbbGroupMemberCount').textContent=String(g.member_count||1);document.getElementById('dbbGroupTableUser').textContent=accountDisplayName().toUpperCase();showStep('groupDetail');
  }
  document.getElementById('dbbMyGroups').addEventListener('click',e=>{const b=e.target.closest('[data-open-group]');if(b)openGroupDetail(b.dataset.openGroup)});
  document.getElementById('dbbCreateGroupTournament').addEventListener('click',()=>{
    const g=readLocalGroups().find(x=>x.id===activeGroupId);if(!g)return;resetForNewCreation();creationContext={type:'NEW',groupId:g.id,groupName:g.name};document.getElementById('dbbTournamentName').value=g.name+' · TURNIER';enterSetup(session);
  });
  document.getElementById('dbbInviteGroupMembers').addEventListener('click',()=>setFeedback(document.getElementById('dbbGroupDetailFeedback'),'GRUPPEN-INVITES BENÖTIGEN DIE NÄCHSTE SUPABASE-GRUPPENMIGRATION.','error'));

  document.getElementById('dbbAccountJoinContinue').addEventListener('click',async()=>{
    const input=document.getElementById('dbbAccountJoinCode'),feedback=document.getElementById('dbbAccountJoinFeedback');const code=input.value.trim().toUpperCase();input.value=code;
    if(!/^SKL-[A-Z0-9]{8}$/.test(code)){setFeedback(feedback,'CODE NICHT ERKANNT · FORMAT SKL-XXXXXXXX','error');return}
    setFeedback(feedback,'CODE WIRD GEPRÜFT …');
    const {data,error}=await supabase.rpc('join_tournament_by_code',{p_join_code:code});
    if(error){setFeedback(feedback,lobbyErrorMessage(error.message),'error');return}
    lastResult={tournament_id:data.tournament_id,name:data.name,mode:data.mode,status:data.status,expected_active_players:data.expected_active_players,join_code:code,user_id:session?.user?.id||null,joined_via_code:true};
    lobbyJoinCode=code;try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_){}
    setFeedback(feedback,'BEIGETRETEN · LOBBY WIRD GEÖFFNET.','ok');await openStandaloneLobby(lastResult,code);
  });
  document.getElementById('dbbAccountJoinCode').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('dbbAccountJoinContinue').click()});

  document.getElementById('dbbMyTournaments').addEventListener('click',async e=>{
    const del=e.target.closest('[data-delete-tournament]');
    if(del){
      openExitConfirm('TURNIER WIRKLICH LÖSCHEN?',`„${del.dataset.deleteName||'TURNIER'}“ wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`,'TURNIER LÖSCHEN',async()=>{
        const {error}=await supabase.rpc('delete_tournament',{p_tournament_id:del.dataset.deleteTournament});
        if(error){alert(error.message||'TURNIER KONNTE NICHT GELÖSCHT WERDEN.');return}
        try{const raw=localStorage.getItem('skielsen.db.lastTournament');const x=raw?JSON.parse(raw):null;if(x?.tournament_id===del.dataset.deleteTournament)localStorage.removeItem('skielsen.db.lastTournament')}catch(_){}
        closeExitConfirm();await renderMyTournaments();
      });return;
    }
    const b=e.target.closest('[data-open-tournament]');if(!b)return;
    let local=null;try{const raw=localStorage.getItem('skielsen.db.lastTournament');const x=raw?JSON.parse(raw):null;if(x?.tournament_id===b.dataset.openTournament)local=x}catch(_){}
    lastResult={...(local||{}),tournament_id:b.dataset.openTournament,name:b.dataset.tournamentName||local?.name||null,status:b.dataset.status||local?.status||'LOBBY',user_id:session?.user?.id||null};
    if(lastResult.status==='LIVE'){showStartedStep(lastResult);return}
    if(lastResult.status==='CONFIGURING'&&lastResult.game_ids?.length){activeDraftTournamentId=lastResult.tournament_id;pendingShopPayload={gameIds:[...lastResult.game_ids],themeId:lastResult.theme_pack_id||'theme.skielsen.core',featurePackId:lastResult.feature_pack_id||null,features:{},activePlayers:lastResult.expected_active_players||8};materialState=buildMaterialState(pendingShopPayload);renderPostShopOrder();showStep('order');return}
    await openStandaloneLobby(lastResult,lastResult.join_code||null);
  });

  document.getElementById('dbbModePicker').addEventListener('click',e=>{
    const b=e.target.closest('[data-mode]');if(!b)return;mode=b.dataset.mode;
    document.querySelectorAll('#dbbModePicker button').forEach(x=>x.classList.toggle('active',x===b));
    document.getElementById('dbbTeamCountField').hidden=mode!=='TEAM';
    document.getElementById('dbbSoloCountField').hidden=mode!=='SOLO';
  });
  document.getElementById('dbbTeamCountPicker').addEventListener('click',e=>{const b=e.target.closest('[data-team-count]');if(!b)return;teamCount=Number(b.dataset.teamCount);document.querySelectorAll('#dbbTeamCountPicker button').forEach(x=>x.classList.toggle('active',x===b));});
  document.getElementById('dbbSoloCountPicker').addEventListener('click',e=>{const b=e.target.closest('[data-solo-count]');if(!b)return;soloPlayerCount=Number(b.dataset.soloCount);document.querySelectorAll('#dbbSoloCountPicker button').forEach(x=>x.classList.toggle('active',x===b));});
  document.getElementById('dbbOpenShop').addEventListener('click',openShop);
  document.getElementById('dbbMaterialBack').addEventListener('click',()=>requestWorkflowBack('material'));
  document.getElementById('dbbPrintProcure').addEventListener('click',()=>printProcurementList());
  document.getElementById('dbbSettingsPrintProcure').addEventListener('click',()=>printProcurementList((tournamentSettings?.self_procure_materials||[]).map(x=>({name:x.name||x.equipment_id,quantity:x.quantity_required||1,games:Array.isArray(x.source_game_names)?x.source_game_names:[]}))));
  document.getElementById('dbbOrderBack').addEventListener('click',()=>requestWorkflowBack('order'));
  document.getElementById('dbbLobbyBack').addEventListener('click',()=>requestWorkflowBack('lobby'));
  document.getElementById('dbbSettingsBack').addEventListener('click',()=>requestWorkflowBack('settings'));
  document.getElementById('dbbCreateFromMaterial').addEventListener('click',()=>{
    if(!pendingShopPayload?.gameIds?.length&&!activeDraftTournamentId)return;
    openFinalCheckout();
  });
  document.getElementById('dbbCheckoutBack').addEventListener('click',()=>requestWorkflowBack('checkout'));
  document.getElementById('dbbFinalizeCheckout').addEventListener('click',()=>{
    if(activeDraftTournamentId){saveMaterialForExistingDraft();return}
    if(pendingShopPayload?.gameIds?.length) createFromShop(pendingShopPayload);
  });
  document.getElementById('dbbSuggestOrder').addEventListener('click',suggestTournamentOrder);
  document.getElementById('dbbFinalizeOrder').addEventListener('click',finalizePostShopOrder);
  document.getElementById('dbbCopyCode').addEventListener('click',async()=>{const code=document.getElementById('dbbJoinCode').textContent.trim();if(!code.startsWith('SKL-')){setFeedback(document.getElementById('dbbLobbyFeedback'),'DER KLARTEXT-CODE IST AUF DIESEM GERÄT NICHT MEHR VERFÜGBAR.','error');return}try{await navigator.clipboard.writeText(code);setFeedback(document.getElementById('dbbLobbyFeedback'),'JOIN CODE KOPIERT.','ok')}catch(_){setFeedback(document.getElementById('dbbLobbyFeedback'),'KOPIEREN NICHT VERFÜGBAR · CODE MANUELL MARKIEREN.','error')}});
  document.getElementById('dbbLobbyRefresh').addEventListener('click',()=>refreshStandaloneLobby(false));
  document.getElementById('dbbLobbyRefresh2').addEventListener('click',()=>refreshStandaloneLobby(false));
  document.getElementById('dbbFillBots').addEventListener('click',async()=>{
    const btn=document.getElementById('dbbFillBots');btn.disabled=true;btn.textContent='BOTS WERDEN ANGELEGT …';
    const {data,error}=await supabase.rpc('fill_tournament_with_bots',{p_tournament_id:lastResult.tournament_id});
    btn.disabled=false;btn.textContent='FREIE PLÄTZE MIT BOTS FÜLLEN';
    if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
    lobbyState=data;renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'BOTS HABEN DIE FREIEN PLÄTZE GEFÜLLT.','ok');
  });
  document.getElementById('dbbClearBots').addEventListener('click',async()=>{
    const {data,error}=await supabase.rpc('clear_tournament_test_bots',{p_tournament_id:lastResult.tournament_id});
    if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
    lobbyState=data;renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'BOTS ENTFERNT.','ok');
  });
  document.getElementById('dbbOpenSettings').addEventListener('click',openTournamentSettings);
  document.getElementById('dbbSettingsList').addEventListener('click',async e=>{
    const b=e.target.closest('[data-setting-feature]');if(!b||!tournamentSettings?.is_admin)return;
    const f=(tournamentSettings.features||[]).find(x=>x.feature_id===b.dataset.settingFeature);if(!f||f.available===false)return;
    const {data,error}=await supabase.rpc('set_tournament_feature_enabled',{p_tournament_id:lastResult.tournament_id,p_feature_id:f.feature_id,p_enabled:!f.enabled});
    if(error){setFeedback(document.getElementById('dbbSettingsFeedback'),error.message,'error');return}
    tournamentSettings=data;renderTournamentSettings();
  });
  document.getElementById('dbbConfirmSettings').addEventListener('click',async()=>{
    const {data,error}=await supabase.rpc('confirm_tournament_settings',{p_tournament_id:lastResult.tournament_id});
    if(error){setFeedback(document.getElementById('dbbSettingsFeedback'),error.message,'error');return}
    tournamentSettings=data;setFeedback(document.getElementById('dbbSettingsFeedback'),'SETTINGS BESTÄTIGT.','ok');await refreshStandaloneLobby(true);showStep('lobby');
  });
  document.getElementById('dbbLobbyPlayers').addEventListener('click',e=>{const row=e.target.closest('[data-lobby-select-player]');if(!row)return;lobbyAssignMemberId=lobbyAssignMemberId===row.dataset.lobbySelectPlayer?null:row.dataset.lobbySelectPlayer;renderStandaloneLobby();});
  document.getElementById('dbbLobbyAssignClose').addEventListener('click',()=>document.getElementById('dbbLobbyAssignSheet').classList.remove('open'));
  document.getElementById('dbbLobbyTeamChoices').addEventListener('click',async e=>{
    const slotMember=e.target.closest('[data-slot-member]');
    if(slotMember){
      const {data,error}=await supabase.rpc('set_lobby_team',{p_tournament_id:lastResult.tournament_id,p_member_id:slotMember.dataset.slotMember,p_color:slotMember.dataset.slotColor});
      if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
      lobbyState=data;document.getElementById('dbbLobbyAssignSheet').classList.remove('open');renderStandaloneLobby();return;
    }
    const b=e.target.closest('[data-lobby-choice]');if(!b||!lobbyAssignMemberId)return;
    const {data,error}=await supabase.rpc('set_lobby_team',{p_tournament_id:lastResult.tournament_id,p_member_id:lobbyAssignMemberId,p_color:b.dataset.lobbyChoice});
    if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
    lobbyState=data;document.getElementById('dbbLobbyAssignSheet').classList.remove('open');renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'TEAMZUGEORDNUNG GESPEICHERT.','ok')
  });
  document.getElementById('dbbLobbyTeams').addEventListener('click',async e=>{
    const slot=e.target.closest('[data-lobby-slot]');
    if(slot){
      const color=slot.dataset.lobbySlot;const st=lobbyState;if(!st)return;
      let target=null;
      if(st.is_admin&&lobbyAssignMemberId){target=(st.members||[]).find(m=>m.member_id===lobbyAssignMemberId&&!m.team_color);}
      if(!target)target=(st.members||[]).find(m=>m.user_id===st.current_user_id);
      if(!target)return;
      const {data,error}=await supabase.rpc('set_lobby_team',{p_tournament_id:lastResult.tournament_id,p_member_id:target.member_id,p_color:color});
      if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
      lobbyState=data;lobbyAssignMemberId=null;renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'TEAMZUGEORDNUNG GESPEICHERT.','ok');return;
    }
    const b=e.target.closest('[data-lobby-rename]');if(!b)return;
    const input=document.querySelector(`[data-lobby-team-name="${b.dataset.lobbyRename}"]`);if(!input)return;
    if(input.readOnly){input.readOnly=false;input.classList.add('editing');input.focus();input.select();b.textContent='✓';return}
    const name=input.value.trim()||'TEAM '+LOBBY_COLORS[b.dataset.lobbyRename][0];
    const {data,error}=await supabase.rpc('rename_lobby_team',{p_tournament_id:lastResult.tournament_id,p_color:b.dataset.lobbyRename,p_name:name});
    if(error){setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}
    lobbyState=data;renderStandaloneLobby();setFeedback(document.getElementById('dbbLobbyFeedback'),'TEAMNAME GESPEICHERT.','ok');
  });
  document.getElementById('dbbStartTournament').addEventListener('click',()=>document.getElementById('dbbStartConfirm').classList.add('open'));
  document.getElementById('dbbStartCancel').addEventListener('click',()=>document.getElementById('dbbStartConfirm').classList.remove('open'));
  document.getElementById('dbbStartConfirmButton').addEventListener('click',async()=>{const btn=document.getElementById('dbbStartConfirmButton');btn.disabled=true;btn.textContent='STARTET …';const {data,error}=await supabase.rpc('start_tournament',{p_tournament_id:lastResult.tournament_id});btn.disabled=false;btn.textContent='UNWIDERRUFLICH STARTEN';if(error){document.getElementById('dbbStartConfirm').classList.remove('open');setFeedback(document.getElementById('dbbLobbyFeedback'),lobbyErrorMessage(error.message),'error');return}document.getElementById('dbbStartConfirm').classList.remove('open');lastResult={...lastResult,...(data||{}),status:'LIVE'};try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(lastResult))}catch(_){}showStartedStep(data||lastResult)});
  document.getElementById('dbbStartedHome').addEventListener('click',()=>enterAccountHome(session));
  document.getElementById('dbbAttachSeries').addEventListener('click',()=>{const g=readLocalGroups().find(x=>x.id===activeGroupId);let last=null;try{const raw=localStorage.getItem('skielsen.db.lastTournament');last=raw?JSON.parse(raw):null}catch(_){}if(!g||!last?.tournament_id){setFeedback(document.getElementById('dbbGroupDetailFeedback'),'NOCH KEINE TURNIERSERIE AUF DIESEM GERÄT GEFUNDEN.','error');return}const seriesId=last.series_id||('series_'+(last.parent_tournament_id||last.tournament_id));g.series_ids=[...new Set([...(g.series_ids||[]),seriesId])];const groups=readLocalGroups().map(x=>x.id===g.id?g:x);writeLocalGroups(groups);last.series_id=seriesId;last.group_id=g.id;last.group_name=g.name;try{localStorage.setItem('skielsen.db.lastTournament',JSON.stringify(last))}catch(_){}setFeedback(document.getElementById('dbbGroupDetailFeedback'),'SERIE ZUGEORDNET. HISTORISCHE TURNIERDATEN BLEIBEN UNVERÄNDERT UND KÖNNEN SPÄTER AGGREGIERT WERDEN.','ok')});

  window.addEventListener('message',event=>{
    const msg=event.data||{};
    const allowedTypes=new Set(['SKIELSEN_SHOP_READY','SKIELSEN_SHOP_CHECKOUT','SKIELSEN_SHOP_OPEN_LOBBY','SKIELSEN_SHOP_NAV_BACK','SKIELSEN_SHOP_NAV_HOME']);
    if(!allowedTypes.has(msg.type)) return;

    // Bei file:/content:// kann die WindowProxy-Identität des srcdoc-iframes je nach
    // Android-Browser abweichen. Deshalb validieren wir hier den Nachrichtentyp
    // statt uns ausschließlich auf event.source zu verlassen.
    if(msg.type==='SKIELSEN_SHOP_READY'){
      shopReady=true;
      if(pendingShopInit||!shopStep.classList.contains('dbb-hidden')){
        sendShopInit();
        setTimeout(sendShopInit,120);
      }
    }
    if(msg.type==='SKIELSEN_SHOP_CHECKOUT') openMaterialCheck(msg.payload||{});
    if(msg.type==='SKIELSEN_SHOP_OPEN_LOBBY'){
      if(lastResult)openStandaloneLobby(lastResult,lastResult.join_code||null)
    }
    if(msg.type==='SKIELSEN_SHOP_NAV_BACK') requestWorkflowBack('shop');
    if(msg.type==='SKIELSEN_SHOP_NAV_HOME') requestWorkflowHome('shop');
  });
})();
