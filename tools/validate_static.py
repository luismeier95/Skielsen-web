from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs
import json, sys, re
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; INDEX=PUBLIC/'index.html'
class P(HTMLParser):
 def __init__(self): super().__init__(); self.refs=[]; self.inline_scripts=0; self.inline_styles=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script':
   if a.get('src'): self.refs.append(('script',a['src']))
   else: self.inline_scripts+=1
  elif tag=='link' and a.get('href'): self.refs.append(('link',a['href']))
  elif tag in {'img','source','video','audio','iframe'} and a.get('src'): self.refs.append((tag,a['src']))
  if tag=='style': self.inline_styles+=1
def fail(msg): print('ERROR:',msg,file=sys.stderr); raise SystemExit(1)
if not INDEX.exists(): fail('public/index.html fehlt')

# Repository hygiene: current source-of-truth files only.
required_docs=[
 'docs/README.md',
 'docs/GAME_DESIGN_CONTRACT.md',
 'docs/THEME_CONTRACT.md',
 'docs/THEME_TEMPLATE.css',
 'docs/WORTKETTE_DATABASE.md',
 'docs/WORTKETTE_DESIGN_CONTRACT.md',
 'docs/WORTKETTE_GAME_CONTRACT.md',
]
for rel in required_docs:
 if not (ROOT/rel).exists(): fail(f'Aktuelle Projektdokumentation fehlt: {rel}')

required_dev_routes=[
 'public/game-design-contract.html',
 'public/standalone-games.html',
 'public/more-or-less-contract-test/index.html',
 'public/word-chain-test/index.html',
 'public/tic-tac-toe-test/index.html',
]
for rel in required_dev_routes:
 if not (ROOT/rel).exists(): fail(f'Kanonische Test-/Contract-Route fehlt: {rel}')

legacy_exact=[
 'public/wortkette-standalone.html',
 'public/wortkette.html',
 'public/more-or-less-standalone.html',
 'public/more-or-less-contract-test.html',
 'docs/WORTKETTE_HANDOVER.md',
 'docs/WORTKETTE_FULLVERSION_INTEGRATION_PLAN.md',
 'docs/WORTKETTE_CODING_AGENT_HANDOFF_V2.md',
 'docs/WORTKETTE_THEME_AUDIT.md',
 'docs/WORTKETTE_GAME_CONTRACT_V2.md',
 'docs/WORTKETTE_DESIGN_CONTRACT_V2.md',
]
for rel in legacy_exact:
 if (ROOT/rel).exists(): fail(f'Veraltetes Legacy-Artefakt wieder im Repo: {rel}')

legacy_globs=[
 'public/wortkette-v*.html',
 'public/more-or-less-contract-test-v*.html',
 'public/assets/css/more-or-less-contract-test-v*.css',
 'public/assets/js/more-or-less-contract-test-v*.js',
]
for pattern in legacy_globs:
 stale=list(ROOT.glob(pattern))
 if stale: fail('Veraltete Snapshot-Dateien wieder im Repo: '+', '.join(str(p.relative_to(ROOT)) for p in stale))
h=INDEX.read_text(encoding='utf-8')
if 'data:image/' in h: fail('Base64-Bilder in index.html')
p=P(); p.feed(h)
if p.inline_scripts: fail(f'{p.inline_scripts} Inline-Scripts gefunden')
if p.inline_styles: fail(f'{p.inline_styles} Inline-Styles gefunden')
v=json.loads((PUBLIC/'version.json').read_text())['version']
missing=[]
for kind,ref in p.refs:
 if not ref or ref.startswith(('#','data:','mailto:','tel:','javascript:')): continue
 u=urlsplit(ref)
 if u.scheme or u.netloc: continue
 if ref.startswith('/'): missing.append((kind,ref,'absolute path')); continue
 target=(PUBLIC/u.path).resolve()
 if not target.exists(): missing.append((kind,ref,'missing')); continue
 if kind in {'script','link'} and u.path.startswith(('assets/js/','assets/css/')):
  if parse_qs(u.query).get('v')!=[v]: fail(f'Cache-Version fehlt/abweichend: {ref}')
if missing: fail(repr(missing[:20]))
if f'SKIELSEN V{v}' not in h: fail('Versionskonflikt index/title')
history_js=PUBLIC/'assets/js/00-app-history.js'
if not history_js.exists(): fail('00-app-history.js fehlt')
history_text=history_js.read_text(encoding='utf-8')
buzzer_text=(PUBLIC/'assets/js/09-buzzer-time.js').read_text(encoding='utf-8')
buzzer_css=(PUBLIC/'assets/css/buzzer-time.css').read_text(encoding='utf-8')
if 'assets/images/skielsen-logo.png' not in buzzer_text or 'class="bzt-logo"' not in buzzer_text: fail('Buzzer Header nutzt nicht das offizielle SKIELSEN Logo')
if 'bzt-header-row sub' in buzzer_text: fail('Redundante Buzzer Header-Unterzeile noch vorhanden')
if '.bzt-logo{' not in buzzer_css: fail('Buzzer Logo-CSS fehlt')
more_less_js=(PUBLIC/'assets/js/11-more-or-less-game.js')
more_less_css=(PUBLIC/'assets/css/more-or-less-game.css')
if not more_less_js.exists() or not more_less_css.exists(): fail('Mehr-oder-Weniger Vollversion fehlt')
if 'higher_lower_action' not in more_less_js.read_text(encoding='utf-8') or 'get_higher_lower_state' not in more_less_js.read_text(encoding='utf-8'): fail('Mehr-oder-Weniger Server-Sync fehlt')
runtime_text=(PUBLIC/'assets/js/08-inapp-runtime.js').read_text(encoding='utf-8')
main_css_text=(PUBLIC/'assets/css/app.css').read_text(encoding='utf-8')

if 'V15.1.84 · Frozen desktop tournament chrome' not in main_css_text: fail('Frozen Desktop Tournament Chrome fehlt')
if 'body.v15-tournament-active .sk-header{' not in main_css_text or 'position:fixed!important;' not in main_css_text: fail('Top-Navigation ist nicht viewport-fixed')
if 'V15.1.87 · Desktop Admin Command inset + radius' not in main_css_text: fail('Admin Command Desktop Layout V15.1.87 fehlt')
if '--v15-admin-command-gap:5px;' not in main_css_text or '--v15-admin-command-inset:12px;' not in main_css_text: fail('Admin Command Abstand/Inset entspricht nicht 5px/12px')
if 'top:calc(var(--v15-frozen-header-height) + var(--v15-admin-command-gap))!important;' not in main_css_text: fail('Admin Command sitzt nicht 5px unter der fixierten Navigation')
if 'left:var(--v15-admin-command-inset)!important;' not in main_css_text or 'right:var(--v15-admin-command-inset)!important;' not in main_css_text or 'width:auto!important;' not in main_css_text: fail('Admin Command entspricht nicht der HOME Breite mit 12px Rand')
if 'border-radius:14px!important;' not in main_css_text or 'overflow:hidden!important;' not in main_css_text: fail('Admin Command hat keine abgerundeten sichtbaren Ecken')
if 'var(--v15-admin-command-gap)' not in main_css_text or 'var(--v15-frozen-admin-height)' not in main_css_text: fail('Content-Offset für eingefrorene Header/Admin-Leisten fehlt')

admin_command_text=(PUBLIC/'assets/js/13-admin-command.js').read_text(encoding='utf-8')
if 'V15.1.88 · scroll-collapse experiment' not in admin_command_text or 'function collapseAnchor()' not in admin_command_text or 'function syncCollapseState()' not in admin_command_text: fail('Admin Command Scroll-Collapse Runtime fehlt')
if "window.addEventListener('scroll',onWindowScroll,{passive:true})" not in admin_command_text: fail('Admin Command Scroll-Collapse reagiert nicht auf Scrollen')
if "host.classList.toggle('is-scroll-collapsed',anchorTop<=collisionLine)" not in admin_command_text: fail('Admin Command Collapse hat keine Container-Kollision')
if 'V15.1.88 · Admin Command scroll-collapse experiment' not in main_css_text: fail('Admin Command Scroll-Collapse CSS fehlt')
if '#adminCommandBar.is-scroll-collapsed .admin-command-inner' not in main_css_text or 'height:38px!important;' not in main_css_text: fail('Collapsed Admin Command ist nicht einzeilig')
if '#adminCommandBar.is-scroll-collapsed .admin-command-tools' not in main_css_text or 'display:none!important;' not in main_css_text: fail('Collapsed Admin Command blendet Buttons/Tools nicht aus')
if 'function setMobileCollapsed(next)' not in admin_command_text or "mobileCollapsed=true" not in admin_command_text: fail('Mobile Admin Command startet nicht eingeklappt')
if "setMobileCollapsed(!mobileCollapsed)" not in admin_command_text or "host.setAttribute('aria-expanded','false')" not in admin_command_text: fail('Mobile Admin Command Tap-Toggle fehlt')
if "window.addEventListener('scroll',onWindowScroll,{passive:true})" not in admin_command_text or "if(window.innerWidth>800)queueCollapseSync()" not in admin_command_text: fail('Desktop Admin Command Scroll-Collapse wurde beim Mobile Umbau beschädigt')
if 'syncMobileScrollIntent' in admin_command_text or "document.addEventListener('touchmove',onMobileTouchMove" in admin_command_text: fail('Mobile Admin Command darf seinen State nicht mehr durch Scroll/Swipe ändern')
if 'admin-command-toggle-glyph' not in admin_command_text: fail('Mobile Admin Command Toggle-Glyph fehlt')
_admin_toggle_icon=PUBLIC/'assets/icons/admin-command-toggle.svg'
if not _admin_toggle_icon.exists() or '<path' not in _admin_toggle_icon.read_text(encoding='utf-8'): fail('Mobile Admin Command Toggle-SVG fehlt')
if 'V15.1.97 · Mobile Admin Command image toggle' not in main_css_text: fail('Mobile Admin Command Layout V15.1.97 fehlt')
if 'bottom:81px!important;' not in main_css_text or 'left:10px!important;' not in main_css_text or 'right:10px!important;' not in main_css_text: fail('Mobile Admin Command Inset/Dock stimmt nicht')
if 'body.v15-tournament-active #adminCommandBar.is-scroll-collapsed .admin-command-inner' not in main_css_text or 'height:44px!important;' not in main_css_text: fail('Mobile Admin Command Default-Collapse ist nicht einzeilig')
_mobile_admin_css=main_css_text.split('V15.1.97 · Mobile Admin Command image toggle',1)[-1]
if 'mask-image:url("../icons/admin-command-toggle.svg")' not in _mobile_admin_css or 'transform:scaleY(-1);' not in _mobile_admin_css: fail('Mobile Admin Command verwendet das Toggle-SVG nicht gespiegelt für Collapse')
if '#adminCommandBar.is-scroll-collapsed .admin-command-toggle-glyph::before' not in _mobile_admin_css or 'transform:none;' not in _mobile_admin_css: fail('Mobile Admin Command verwendet das Original-SVG nicht für Extend')
if 'body.v15-tournament-active.admin-command-visible.admin-command-collapsed{\n    padding-bottom:270px!important;' not in main_css_text or 'body.v15-tournament-active.admin-command-visible.admin-command-collapsed.profile-page-active{\n    padding-bottom:328px!important;' not in main_css_text: fail('Mobile Admin Command verändert beim Toggle die Dokumenthöhe')
if _mobile_admin_css.count('mask-image:url("../icons/admin-command-toggle.svg")')<1: fail('Mobile Admin Command Toggle-SVG liegt nicht im Mobile Layoutblock')
if 'padding-bottom:135px!important;' in main_css_text or 'padding-bottom:193px!important;' in main_css_text: fail('Alter instabiler Mobile Admin Command Collapse-Offset ist noch vorhanden')
if 'v15InAppLiveStrip' not in runtime_text: fail('In-App Live-Strip fehlt')
if "MORE_LESS_MODULE='more-or-less'" not in runtime_text or 'ensureMoreLessAssets' not in runtime_text or 'ensureNativeLifecycle' not in runtime_text: fail('Mehr-oder-Weniger ist nicht in den In-App Auto-Flow integriert')
if "db.rpc('activate_tournament_game'" not in runtime_text: fail('In-App Auto-Flow repariert Server-LIVE-Status nicht')
if 'finishAndExit:finishInAppSurface' not in runtime_text: fail('In-App Abschluss schließt Fullscreen nicht sauber')
engine_text=(PUBLIC/'assets/js/07-tournament-engine.js').read_text(encoding='utf-8')
bridge_text=(PUBLIC/'assets/js/10-buzzer-tournament-bridge.js').read_text(encoding='utf-8')
if 'beginPostGameFlow' not in engine_text or 'postGameVoteResults' not in engine_text or "g.phase='AWARD_REVEAL'" not in engine_text: fail('Post-Game Voting/Reveal Flow fehlt')
if "client.rpc('activate_tournament_game'" not in engine_text: fail('Serverseitiger MATCH START fehlt')
for rpc in ['get_betting_market_state','open_betting_market','submit_betting_decision','settle_betting_market']:
 if rpc not in engine_text: fail(f'Serverseitiger Betting-Workflow fehlt: {rpc}')
for rpc in ['get_tournament_vote_state','open_tournament_vote_session','submit_tournament_vote']:
 if rpc not in engine_text: fail(f'Serverseitiger MVP/LVP-Workflow fehlt: {rpc}')
if "type==='LVP'||c.participantId!==vp?.id" not in engine_text: fail('LVP-Kandidatenregel erlaubt Teampartner nicht')
if 'submission_count' not in engine_text or 'openMultiJokerDialog(g,reportedCount)' not in engine_text: fail('Joker-Randomizer submission_count-Flow fehlt')
if "client.rpc('reset_tournament_runtime_state'" not in engine_text or 'TURNIER KOMPLETT RESETTEN' not in (PUBLIC/'index.html').read_text(encoding='utf-8'): fail('Admin Full-Tournament-Reset fehlt')
if "sg.status==='ACTIVE'" not in engine_text or "liveMatch.status='LIVE'" not in engine_text: fail('Server ACTIVE wird nicht auf Player-Clients gespiegelt')
if 'Server lifecycle is authoritative' not in engine_text or 'finishJokerPreparation(g);' not in engine_text: fail('Cross-device PREPARING→ACTIVE Sync fehlt')
if "addEventListener('click',revealVoteWinner)" not in engine_text or "addEventListener('click',continueVoteReveal)" not in engine_text: fail('MVP/LVP Reveal Controls fehlen')
if 'completeCanonicalInAppPostgame' not in bridge_text or 'beginCanonicalMergedPostGameFlow' not in engine_text: fail('In-App Games übergeben Ergebnis nicht an Standard Post-Game Flow')
if 'ingestHigherLowerResult' not in bridge_text: fail('Mehr-oder-Weniger Result-Handoff fehlt')

# Optional feature context contract: disabled tournament features must not leak into active pages/popups.
admin_command_text=(PUBLIC/'assets/js/13-admin-command.js').read_text(encoding='utf-8')
if "const bettingEnabled=feature('feature.betting')" not in engine_text: fail('Winner-Popup ist nicht explizit an Betting-Feature gekoppelt')
if "settlement.hidden=!bettingEnabled" not in engine_text or "wallet.hidden=!bettingEnabled" not in engine_text: fail('Winner-Popup blendet Betting Settlement/Wallet bei deaktiviertem Betting nicht aus')
if "if(!feature('feature.betting')||!m)return" not in engine_text: fail('Lokale Betting-Abrechnung läuft ohne Feature-Gate')
if "if(!feature(engine?.runtime,'feature.betting')||!m)return" not in bridge_text: fail('In-App Result-Bridge rechnet Betting ohne Feature-Gate ab')
if "voteFeature=(rt,type)=>String(rt?.mode||'').toUpperCase()==='TEAM'" not in bridge_text: fail('In-App Voting berücksichtigt TEAM-only Contract nicht')
if "function activeVoteTypes()" not in engine_text or "x.hidden=!showAwards" not in engine_text: fail('Player Achievements sind nicht an aktive MVP/LVP Features gekoppelt')
if "if(!voteFeatureEnabled(type)||!pop||!r)" not in engine_text: fail('MVP/LVP Reveal Popup hat kein Feature-Gate')
if "adminWallet.hidden=!feature('feature.betting')" not in engine_text: fail('Admin Coin/Wallet Tool bleibt ohne Betting sichtbar')
if "if(!feature('feature.joker')){if(d)d.hidden=true;return false}" not in engine_text or "if(!feature('feature.joker')){if(overlay)overlay.hidden=true;return false}" not in engine_text: fail('Joker Popups haben kein defensives Feature-Gate')
if "contextualNews()" not in engine_text or "contextualAudit()" not in engine_text: fail('News/Audit filtern keine deaktivierten Feature-Artefakte')
if "Keine Joker- oder Betting-Gates sind offen" in engine_text or "Keine Joker- oder Betting-Gates sind offen" in admin_command_text: fail('Feature-fremde Neutraltexte erwähnen deaktivierte Joker/Betting Features')
if "feature('feature.betting')&&m?.status==='BETTING_OPEN'" not in admin_command_text: fail('Admin Command zeigt Betting-Status ohne Betting-Feature')
if "voteFeatureEnabled(g.vote.type)" not in admin_command_text or "g?.phase==='AWARD_REVEAL'&&voteFeaturesEnabled()" not in admin_command_text: fail('Admin Command zeigt Vote/Reveal ohne aktive Voting-Features')
if "if(action==='joker'){if(!feature('feature.joker'))return false" not in admin_command_text: fail('Admin Command Joker Action ist nicht Feature-gegated')
if 'v15-inapp-fullscreen-open' not in runtime_text: fail('In-App Fullscreen-Klasse fehlt')
if 'body.v15-inapp-fullscreen-open .mobile-nav' not in main_css_text: fail('Fullscreen blendet native App-Navigation nicht aus')
if 'transform:translateZ(0)' not in main_css_text or 'contain:paint' not in main_css_text: fail('In-App Compositor-Schutz fehlt')
if "register('inapp'" not in runtime_text or 'minimizeInApp' not in runtime_text: fail('In-App History/Minimize-Controller fehlt')
if 'v15InAppMinimize' in runtime_text or '.v15-inapp-minimize{' in main_css_text or '.v15-inapp-minimize span{' in main_css_text: fail('Alter sichtbarer In-App-Minimieren-Button ist noch vorhanden')
if 'popstate' not in history_text or 'pushState' not in history_text or 'replaceState' not in history_text: fail('App-History-Controller unvollständig')
if 'assets/js/00-team-identity.js?v='+v not in h: fail('Team Identity Runtime fehlt oder Cache-Version stimmt nicht')
if h.index('assets/js/00-team-identity.js?v='+v) > h.index('assets/js/00-theme-contract.js?v='+v): fail('Team Identity Runtime muss vor Theme Contract geladen werden')
team_identity_js=(PUBLIC/'assets/js/00-team-identity.js').read_text(encoding='utf-8')
for _needle in ["hex:'#1515FF'","hex:'#FF1717'","hex:'#F2B705'","hex:'#00A65A'","hex:'#2979FF'","hex:'#FF1744'","hex:'#00F5D4'","hex:'#FF2ED1'"]:
 if _needle not in team_identity_js: fail('Core/Core2 Team-Palette unvollständig: '+_needle)

# Tic Tac Toe standalone regression contract.
_ttt_test_js=ROOT/'public/tic-tac-toe-test/app.js'
_ttt_test_css=ROOT/'public/tic-tac-toe-test/style.css'
if not _ttt_test_js.exists() or not _ttt_test_css.exists(): fail('Tic Tac Toe Standalone fehlt')
_ttt_test_js_text=_ttt_test_js.read_text(encoding='utf-8')
_ttt_test_css_text=_ttt_test_css.read_text(encoding='utf-8')
for _mode in ['NORMAL','DISAPPEAR']:
 if _mode not in _ttt_test_js_text: fail('Tic Tac Toe Standalone Schwierigkeit fehlt: '+_mode)
if 'game.active[actor].shift()' not in _ttt_test_js_text: fail('Tic Tac Toe Disappear-Regel fehlt')
if 'game.winning=winningCells(game.board)' not in _ttt_test_js_text: fail('Tic Tac Toe Siegprüfung fehlt')
if '<input' in _ttt_test_js_text.lower(): fail('Tic Tac Toe Standalone darf keine Tastatur-Eingabe verwenden')
if 'TIC_TAC_TOE_STANDALONE_MOBILE_CONTRACT' not in _ttt_test_css_text: fail('Tic Tac Toe Mobile Contract fehlt')

# Tic Tac Toe production integration regression contract.
_ttt_prod_js=PUBLIC/'assets/js/13-tic-tac-toe-game.js'
_ttt_prod_css=PUBLIC/'assets/css/tic-tac-toe-game.css'
if not _ttt_prod_js.exists() or not _ttt_prod_css.exists(): fail('Tic Tac Toe Vollversion fehlt')
_ttt_prod_text=_ttt_prod_js.read_text(encoding='utf-8')
for _rpc in ['get_tic_tac_toe_state','set_tic_tac_toe_team_mode','select_tic_tac_toe_player','set_tic_tac_toe_variant','start_tic_tac_toe_match','submit_tic_tac_toe_move']:
 if _rpc not in _ttt_prod_text: fail('Tic Tac Toe Production RPC fehlt: '+_rpc)
for _mode in ['ALTERNATING','SELECTED_PLAYER','SIMULTANEOUS']:
 if _mode not in _ttt_prod_text: fail('Tic Tac Toe Teammodus fehlt: '+_mode)
_ttt_prod_css_text=_ttt_prod_css.read_text(encoding='utf-8')
if '--game-mode-count:${options.length}' not in _ttt_prod_text: fail('Game Mode Page übergibt die dynamische Mode-Anzahl nicht')
if 'repeat(var(--game-mode-count,2),minmax(0,1fr))' not in _ttt_prod_css_text: fail('Game Mode Desktop-Grid ist nicht dynamisch')
if '.tttp-choice-grid,.tttp-mode-grid,.tttp-difficulty-grid{grid-template-columns:1fr}' not in _ttt_prod_css_text: fail('Game Mode/Difficulty Mobile-Grid ist nicht einspaltig')
_gdc_doc=(ROOT/'docs/GAME_DESIGN_CONTRACT.md').read_text(encoding='utf-8')
for _needle in ['Game Mode Page Contract','mindestens **zwei auswählbare Game Modes**','repeat(var(--game-mode-count), minmax(0, 1fr))','Mobile <= 720 px']:
 if _needle not in _gdc_doc: fail('Verbindlicher Game Mode Page Contract fehlt: '+_needle)
if "data-ttt-countdown" not in _ttt_prod_text or "DECIDER_PLAYING" not in _ttt_prod_text: fail('Tic Tac Toe 5-Sekunden-Decider UI fehlt')
if "TIC_TAC_TOE_MODULE='tic-tac-toe'" not in runtime_text or 'ensureTicTacToeAssets' not in runtime_text or 'renderTicTacToeSession' not in runtime_text: fail('Tic Tac Toe ist nicht in die In-App Runtime integriert')
if 'create_tic_tac_toe_match_session' not in runtime_text or 'get_tic_tac_toe_result' not in runtime_text: fail('Tic Tac Toe Match-Lifecycle fehlt in der Runtime')
if 'ingestTicTacToeResult' not in bridge_text or "result?.game_key==='tic_tac_toe'" not in bridge_text: fail('Tic Tac Toe Result-Handoff fehlt')
if 'concludeCurrentMatch' not in engine_text.split('window.skielsenV15=',1)[-1]: fail('Canonical Match Conclusion ist nicht für native Spiele exportiert')
if "actors.filter(a=>a.isBot&&a.soloColor&&!byColor.has(a.soloColor))" not in engine_text or "isBotParticipant:true" not in engine_text: fail('SOLO Test-Bots werden nicht als Turnier-Participants materialisiert')
if 'localTicTacToeBotMatch' not in engine_text or 'startTestTicTacToe' not in engine_text: fail('Tic Tac Toe Test-Bot Routing fehlt in der Tournament Engine')
if 'startTestTicTacToe' not in runtime_text or 'currentMatchHasSoloTestBot' not in runtime_text or 'localTestTicTacToeActive' not in runtime_text: fail('Tic Tac Toe Test-Bot Lifecycle fehlt in der In-App Runtime')
if 'mountTestBot' not in _ttt_prod_text or 'localChooseBotMove' not in _ttt_prod_text or 'submitLocalResult' not in _ttt_prod_text or 'showLocalPostgame' not in _ttt_prod_text: fail('Tic Tac Toe lokaler Test-Bot fehlt')
mobile_nav_text=(PUBLIC/'assets/js/04-mobile-navigation.js').read_text(encoding='utf-8')
mobile_nav_css=(PUBLIC/'assets/css/app.css').read_text(encoding='utf-8')
if "document.body.classList.add('mobile-more-open')" not in mobile_nav_text or "document.body.classList.remove('mobile-more-open')" not in mobile_nav_text: fail('Mobile MORE Drawer setzt keinen Overlay-State')
if "'--mobile-more-bottom','76px'" not in mobile_nav_text or 'syncDock' not in mobile_nav_text: fail('Mobile MORE Drawer ist nicht deterministisch oberhalb der Primary Nav verankert')
if 'body.mobile-more-open #adminCommandBar' not in mobile_nav_css or 'body.mobile-more-open .mobile-profile-nav' not in mobile_nav_css: fail('Mobile MORE Drawer blendet konkurrierende Bottom-Docks nicht aus')
if mobile_nav_css.count('bottom:var(--mobile-more-bottom,76px)')<2: fail('Mobile MORE Drawer und Backdrop liegen nicht oberhalb der Primary Nav')
if 'z-index:4090' not in mobile_nav_css or 'z-index:4100' not in mobile_nav_css: fail('Mobile MORE Drawer Overlay-Layer ist nicht eindeutig')
if "closest('[data-page]')" not in mobile_nav_text or 'requestAnimationFrame(closeMore)' not in mobile_nav_text: fail('Mobile MORE Drawer schließt nach Page-Auswahl nicht automatisch')

if 'assets/js/00-theme-contract.js?v='+v not in h: fail('Theme Contract Runtime fehlt oder Cache-Version stimmt nicht')
if h.index('assets/js/00-theme-contract.js?v='+v) > h.index('assets/js/00-app-history.js?v='+v): fail('Theme Contract Runtime muss vor App-History geladen werden')
theme_contract_js=(PUBLIC/'assets/js/00-theme-contract.js').read_text(encoding='utf-8')
main_css_text=(PUBLIC/'assets/css/app.css').read_text(encoding='utf-8')
for _needle in ['--core-blue:#1515FF','--core-red:#FF1717','--core-yellow:#F2B705','--core-green:#00A65A','--core-blue:#2979FF','--core-red:#FF1744','--core-yellow:#00F5D4','--core-green:#FF2ED1']:
 if _needle not in main_css_text: fail('Core/Core2 CSS-Palette fehlt: '+_needle)

for _key in [
 'root_canvas','browser_color','page','on_page','surface','on_surface','surface_soft','on_surface_soft',
 'surface_muted','on_surface_muted','border','border_strong','muted','faint','placeholder','header','on_header',
 'nav','on_nav','nav_muted','inverse_surface','on_inverse','accent','on_accent','accent_2','primary_action',
 'on_primary_action','secondary_action','on_secondary_action','secondary_border','success_bg','on_success',
 'danger_bg','on_danger','warning_bg','on_warning','disabled_bg','on_disabled','disabled_border','input_bg',
 'on_input','input_border','chip_bg','on_chip','ribbon_bg','on_ribbon','ribbon_border','dialog_bg','on_dialog',
 'overlay','shadow','shadow_soft','focus','less_action','on_less_action','more_action','on_more_action'
]:
 if _key+':' not in theme_contract_js: fail(f'Theme Contract v2 Token fehlt: {_key}')
if 'THEME_CONTRACT_CONTRAST_FAILED' not in theme_contract_js: fail('Theme Contract v2 Browser-Kontrastprüfung fehlt')
if 'list_theme_pack_contracts' not in (PUBLIC/'assets/js/06-db-bootstrap.js').read_text(encoding='utf-8'): fail('Workflow lädt Theme-Katalog nicht dynamisch')
if 'list_theme_pack_contracts' not in engine_text: fail('Tournament Engine lädt Theme-Katalog nicht dynamisch')
if 'get_theme_pack_contract' not in engine_text: fail('Tournament Engine lädt Theme Contract nicht dynamisch')

word_chain_js=PUBLIC/'assets/js/12-word-chain-game.js'
word_chain_css=PUBLIC/'assets/css/wortkette-game.css'
if not word_chain_js.exists() or not word_chain_css.exists(): fail('Wortkette Vollversion fehlt')
_wc_js=word_chain_js.read_text(encoding='utf-8')
_wc_css=word_chain_css.read_text(encoding='utf-8')

# Locked Wortkette regression contract: these working interactions/layout rules
# must not change as a side effect of unrelated app updates.
if 'enterkeyhint="go"' not in _wc_js: fail('Wortkette Mobile-Keyboard Contract verletzt: Enter muss GO bleiben')
if "if(input)input.disabled=true" in _wc_js: fail('Wortkette Mobile-Keyboard Contract verletzt: Input darf beim Submit nicht disabled werden')
if 'setTimeout(focusInput,40)' in _wc_js: fail('Wortkette Mobile-Keyboard Contract verletzt: kein künstliches Refocus nach Submit')
for _feedback in ["feedback('RICHTIG","feedback('FALSCH","feedback('ZEIT ABGELAUFEN","feedback('WORT VOLLSTÄNDIG AUFGEDECKT"]:
 if _feedback in _wc_js: fail('Wortkette Feedback Contract verletzt: Gameplay-Ribbon wieder eingeführt')
if 'WORD_CHAIN_MOBILE_LAYOUT_CONTRACT' not in _wc_css: fail('Wortkette Mobile-Layout Contract fehlt')
if 'grid-template-rows:minmax(54px,.8fr) 36px minmax(96px,1.15fr);' not in _wc_css: fail('Wortkette Mobile-Layout Contract verletzt: Plus/Nomen-Trennung geändert')
if 'row-gap:10px;' not in _wc_css: fail('Wortkette Mobile-Layout Contract verletzt: Abstand Plus/Nomen fehlt')
if '.wc-feedback:empty{display:none}' not in _wc_css: fail('Wortkette Feedback darf leeres Layout nicht verändern')
for _rpc in ['start_word_chain_tournament_player','get_word_chain_tournament_state','submit_word_chain_tournament']:
 if _rpc not in _wc_js: fail('Wortkette Server-Sync fehlt: '+_rpc)
for _needle in ["WORD_CHAIN_MODULE='word-chain'","ensureWordChainAssets","renderWordChainSession","get_word_chain_game_result"]:
 if _needle not in runtime_text: fail('Wortkette In-App Runtime unvollständig: '+_needle)
if 'ingestWordChainResult' not in bridge_text or "result?.game_key==='word_chain'" not in bridge_text: fail('Wortkette Result-Handoff fehlt')
if "game.wortkette.compound_nouns" not in runtime_text: fail('Wortkette nutzt nicht die kanonische Catalog-ID')
for _needle in ['wordChainReadyRulesHtml','force_start_without_ready','DIE WENIGSTEN MINUSPUNKTE GEWINNEN']:
 if _needle not in runtime_text: fail('Wortkette Ready/QA Contract fehlt: '+_needle)
if "expectedModule!==WORD_CHAIN_MODULE" not in runtime_text: fail('Wortkette Ready-Seite wird durch Auto-Start übersprungen')
if "alreadyActive" not in engine_text or "START FEHLGESCHLAGEN" not in engine_text: fail('Matchstart Race-Recovery fehlt')
if 'RESET_NOT_ZERO' not in engine_text or 'runtime_rows_remaining' not in engine_text: fail('Admin Reset hat keinen Zero-State Guard')
if "runtime.games||[]" not in engine_text or "game.status='PLANNED'" not in engine_text: fail('Admin Reset synchronisiert den lokalen Runtime-Snapshot nicht')
if "Number(r.score||0)" not in bridge_text: fail('Wortkette Result-Handoff nutzt nicht die Minuspunkt-Wertung')
for _needle in ['var(--ui)','var(--display)','var(--theme-surface)','var(--theme-on-surface)','var(--theme-primary-action)','var(--theme-on-primary-action)','var(--theme-input-bg)','var(--theme-on-input)','var(--theme-success-bg)','var(--theme-on-success)','var(--theme-danger-bg)','var(--theme-on-danger)']:
 if _needle not in _wc_css: fail('Wortkette Design/Theme Contract fehlt: '+_needle)
for _forbidden in ['Arial Black','Impact,','data-theme-pack="theme.']:
 if _forbidden in _wc_css: fail('Wortkette Theme-/Typografie-Hardcoding gefunden: '+_forbidden)

if 'assets/js/00-app-history.js?v='+v not in h: fail('App-History-Controller fehlt oder Cache-Version stimmt nicht')
version_js=(PUBLIC/'assets/js/00-version.js').read_text(encoding='utf-8')
if f"const VERSION='{v}';" not in version_js: fail('00-version.js stimmt nicht mit version.json überein')
if 'V15.0.35' in h: fail('Veraltete sichtbare V15.0.35-Version in index.html')
shop=(PUBLIC/'assets/js/06-db-bootstrap.js').read_text(encoding='utf-8')
if 'V15.0.19 · TOURNAMENT BUILDER' in shop: fail('Veraltete Shop-Version')
shop_css=PUBLIC/'assets/css/shop.css'
print_css=PUBLIC/'assets/css/procurement-print.css'
if not shop_css.exists(): fail('assets/css/shop.css fehlt')
if not print_css.exists(): fail('assets/css/procurement-print.css fehlt')
if not shop_css.read_text(encoding='utf-8').strip(): fail('shop.css ist leer')
if not print_css.read_text(encoding='utf-8').strip(): fail('procurement-print.css ist leer')
main_css=(PUBLIC/'assets/css/app.css').read_text(encoding='utf-8')
if '/* ===== INLINE STYLE 82 ===== */' in main_css or '/* ===== INLINE STYLE 83 ===== */' in main_css: fail('Eingebettetes Shop-/Print-CSS liegt noch in app.css')
if '.shop-layout{' in main_css: fail('Shop-CSS darf nicht im Hauptdokument liegen')
if 'padding:32px;color:#111' in main_css: fail('Print-CSS darf nicht global im Hauptdokument liegen')
if 'assets/css/shop.css?v=__SKIELSEN_VERSION__' not in shop: fail('Shop-Dokument bindet shop.css nicht ein')
if 'assets/css/procurement-print.css?v=${APP_VERSION}' not in shop: fail('Besorgungsliste bindet Print-CSS nicht ein')
if f"window.SKIELSEN_VERSION||'{v}'" not in shop: fail('06-db-bootstrap.js Versions-Fallback stimmt nicht')
for name in ['07-tournament-engine.js','08-inapp-runtime.js','10-buzzer-tournament-bridge.js']:
 s=(PUBLIC/'assets/js'/name).read_text(encoding='utf-8')
 if 'window.SKIELSEN_VERSION' not in s: fail(f'{name} nutzt nicht die zentrale Version')
print(f'OK: SKIELSEN V{v} · {len(p.refs)} Referenzen geprüft · Version zentralisiert')

if 'profile-page-active' not in (PUBLIC/'assets/css/app.css').read_text(encoding='utf-8'): fail('Player-Subnav ist nicht auf Player-Page begrenzt')
if "m.status==='BETTING_OPEN'&&!gateComplete(m)" not in engine_text: fail('Server-Betting-Gate wird in Match UI nicht verwendet')

if "g.phase='ACTIVE';" not in engine_text or "window.skielsenInApp?.start?.(runtime)" not in engine_text or "window.skielsenInApp?.poll?.()" not in engine_text: fail('In-App Matchstart synchronisiert lokalen Game-Lifecycle nicht')

if "#v1536MatchControlStart" not in engine_text or "handleMatchDetailControlAction" not in engine_text: fail('Delegierter Match-Start-Handler fehlt')

if "e.stopImmediatePropagation();void handleMatchDetailControlAction(matchStart)" not in engine_text: fail('Match-Start wird nicht im Capture-Listener abgefangen')

if "window.skielsenInApp?.start?.(runtime)" not in engine_text: fail('In-App Runtime wird beim Turnierstart nicht explizit initialisiert')

if "serverPhaseForGame" not in engine_text or "phase:serverPhaseForGame" not in engine_text: fail('Server-Game-Status wird nicht in lokalen Lifecycle übernommen')

if "const serverActive=String(g.status||'').toUpperCase()==='ACTIVE'" not in (PUBLIC/'assets/js/08-inapp-runtime.js').read_text(encoding='utf-8'): fail('Native In-App Lifecycle hängt noch am lokalen Matchstatus')

required_pages=['homePage','profilePage','matchesPage','matchDetailPage','rankingPage','betsPage','newsPage','mvpVotePage','jokerPage','adminPage','gameControlPage','gamesPage']

for _pid in required_pages:
 if f'id="{_pid}"' not in (PUBLIC/'index.html').read_text(encoding='utf-8'): fail(f'Turnierseite fehlt: {_pid}')

if 'FULL TEST ALPHA' in engine_text or 'TESTREGEL:' in engine_text: fail('Sichtbare Test-/Alpha-Texte im Turnierflow gefunden')

if "recoverCompletedNativeGame" not in (PUBLIC/'assets/js/08-inapp-runtime.js').read_text(encoding='utf-8'): fail('Multi-Device In-App Result Recovery fehlt')

if "deriveCurrentGameIndexFromRuntime" not in engine_text: fail('Current Game wird nicht aus Serverstatus abgeleitet')

if "Promise.race([" not in engine_text or "SERVER_TIMEOUT" not in engine_text: fail('Joker Submit hat keinen Timeout-Schutz')

if "The submit RPC is the authoritative confirmation" not in engine_text: fail('Joker Submit blockiert noch auf Board-Refresh')

if "forceOpenActiveInApp" not in (PUBLIC/'assets/js/08-inapp-runtime.js').read_text(encoding='utf-8'): fail('In-App Force-Open-Recovery fehlt')

if "playerSessionMisses<3" not in (PUBLIC/'assets/js/08-inapp-runtime.js').read_text(encoding='utf-8'): fail('In-App Poll löscht Session bei Einzel-Miss zu aggressiv')

if "set_higher_lower_tier" not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8'): fail('More-or-Less Difficulty-Setter fehlt')

if "EASY" not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8') or "HARDCORE" not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8'): fail('More-or-Less Difficulty-Auswahl fehlt')

if "molCategoryRouletteLabel" not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8'): fail('More-or-Less Category-Roulette fehlt')

theme_css=(PUBLIC/'assets/css/tournament-theme-runtime.css').read_text(encoding='utf-8')

if 'assets/css/tournament-theme-runtime.css?v='+v not in h: fail('Tournament Theme Authority wird nicht geladen')

if h.index('assets/css/tournament-theme-runtime.css?v='+v) < h.index('assets/css/app.css?v='+v): fail('Tournament Theme Authority muss nach app.css geladen werden')

for _theme in ['theme.skielsen.core','theme.jga.night','theme.christmas.winter_clash','theme.summer.sunset_showdown','theme.girly.pink_chaos']:
 if _theme not in theme_css: fail(f'Theme fehlt in Theme Authority: {_theme}')


if 'var(--inapp-page)' not in (PUBLIC/'assets/css/buzzer-time.css').read_text(encoding='utf-8') or 'var(--theme-button)' not in (PUBLIC/'assets/css/buzzer-time.css').read_text(encoding='utf-8'): fail('Buzzer erbt Tournament Theme nicht')
if 'var(--bzt-team-on' not in (PUBLIC/'assets/css/buzzer-time.css').read_text(encoding='utf-8'): fail('Buzzer Participant-Farbe hat keine semantische Textfarbe')


if '--theme-accent' not in (PUBLIC/'assets/css/more-or-less-game.css').read_text(encoding='utf-8'): fail('More-or-Less erbt Tournament Theme nicht')
if '--theme-less-action' not in (PUBLIC/'assets/css/more-or-less-game.css').read_text(encoding='utf-8') or '--theme-more-action' not in (PUBLIC/'assets/css/more-or-less-game.css').read_text(encoding='utf-8'): fail('More-or-Less Funktionsrollen fehlen')


# Shared Difficulty Selection page contract.
_gdc_doc=(ROOT/'docs/GAME_DESIGN_CONTRACT.md').read_text(encoding='utf-8')
for _needle in ['Difficulty Selection Page Contract','mindestens **zwei auswählbare Schwierigkeitsgrade**','repeat(var(--difficulty-count), minmax(0, 1fr))','Mobile <= 720 px']:
 if _needle not in _gdc_doc: fail('Verbindlicher Difficulty Selection Contract fehlt: '+_needle)
for _js_name in ['11-more-or-less-game.js','12-word-chain-game.js','13-tic-tac-toe-game.js','15-reaction-game.js']:
 _txt=(PUBLIC/'assets/js'/ _js_name).read_text(encoding='utf-8')
 if '--difficulty-count:${options.length}' not in _txt: fail('Dynamische Difficulty-Anzahl fehlt: '+_js_name)
_diff_css={
 'more-or-less-game.css':'.mol-difficulty-picker{grid-template-columns:1fr}',
 'wortkette-game.css':'.wc-difficulty{grid-template-columns:1fr',
 'tic-tac-toe-game.css':'.tttp-choice-grid,.tttp-mode-grid,.tttp-difficulty-grid{grid-template-columns:1fr}',
 'reaction-game.css':'.rxp-choice{grid-template-columns:1fr}'
}
for _css_name,_mobile in _diff_css.items():
 _txt=(PUBLIC/'assets/css'/ _css_name).read_text(encoding='utf-8')
 if 'repeat(var(--difficulty-count,2),minmax(0,1fr))' not in _txt: fail('Dynamisches Difficulty Desktop-Grid fehlt: '+_css_name)
 if _mobile not in _txt: fail('Einspaltiges Difficulty Mobile-Grid fehlt: '+_css_name)

reaction_js=PUBLIC/'assets/js/15-reaction-game.js'
reaction_css=PUBLIC/'assets/css/reaction-game.css'
if not reaction_js.exists() or not reaction_css.exists(): fail('Reaction Vollversion fehlt')
_rx_js=reaction_js.read_text(encoding='utf-8')
_rx_css=reaction_css.read_text(encoding='utf-8')
for _rpc in ['get_reaction_state','set_reaction_difficulty','begin_reaction_attempt','submit_reaction_attempt','resolve_reaction_postgame_joker','merge_reaction_postgame_points','close_reaction_postgame']:
 if _rpc not in _rx_js: fail('Reaction Server-Sync fehlt: '+_rpc)
for _needle in ["REACTION_MODULE='reaction'","ensureReactionAssets","renderReactionSession","get_reaction_game_result","reaction_rules_version:expectedModule===REACTION_MODULE?3:null"]:
 if _needle not in runtime_text: fail('Reaction In-App Runtime unvollständig: '+_needle)
if "result?.game_key==='reaction'" not in bridge_text or 'ingestReactionResult' not in bridge_text: fail('Reaction Result-Handoff fehlt')
if 'completeReactionPostgame' not in bridge_text or 'beginCanonicalMergedPostGameFlow' not in engine_text: fail('Reaction Canonical Postgame-Handoff fehlt')
for _needle in ['--theme-surface','--theme-on-surface','--theme-success-bg','--theme-on-success','--theme-danger-bg','--theme-on-danger']:
 if _needle not in _rx_css: fail('Reaction Theme Contract fehlt: '+_needle)

if "document.body.dataset.themePack=theme" not in engine_text: fail('Runtime setzt ausgewähltes Tournament Theme nicht')

if 'data-mol-minimize' not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8'): fail('More-or-Less Minimieren-Button fehlt')

if "window.skielsenInApp?.minimize?.()" not in (PUBLIC/'assets/js/11-more-or-less-game.js').read_text(encoding='utf-8'): fail('More-or-Less Minimieren nutzt nicht den gemeinsamen In-App-Flow')

if '.mol-minimize{' not in (PUBLIC/'assets/css/more-or-less-game.css').read_text(encoding='utf-8'): fail('More-or-Less Minimieren-Styles fehlen')

if 'document.documentElement.dataset.themePack=theme' not in engine_text: fail('Tournament Theme wird nicht auf html root gespiegelt')

if '<meta name="theme-color" content="#e9e9e9"/>' not in h: fail('Browser theme-color entspricht nicht dem Core Canvas')

if 'html[data-theme-pack="theme.skielsen.core"]{background:#e9e9e9!important}' not in theme_css: fail('Core Browser-Canvas ist nicht Shop-like #e9e9e9')

if 'id="adminThemeSelect"' not in h: fail('Admin Theme Dropdown fehlt')

if "set_tournament_theme_pack" not in engine_text: fail('Admin Theme Dropdown ist nicht serverseitig verdrahtet')

if 'data-theme-preview="theme.girly.pink_chaos"' in h: fail('Match Detail hat noch einen erzwungenen Theme-Preview-Override')

if 'TEMPORARY QA SNIPPET: Match Detail = Pink Chaos' in theme_css: fail('Alter Match Detail QA-Theme-Override ist noch aktiv')


# Theme Contract V1: required tokens + WCAG AA contrast checks.
_THEME_IDS=['theme.skielsen.core','theme.jga.night','theme.christmas.winter_clash','theme.summer.sunset_showdown','theme.girly.pink_chaos']
_THEME_REQUIRED=[
 '--theme-root-canvas','--theme-browser-color','--theme-page','--theme-on-page',
 '--theme-surface','--theme-on-surface','--theme-surface-soft','--theme-on-surface-soft',
 '--theme-surface-muted','--theme-on-surface-muted','--theme-header','--theme-on-header',
 '--theme-nav','--theme-on-nav','--theme-inverse-surface','--theme-on-inverse',
 '--theme-accent','--theme-on-accent','--theme-primary-action','--theme-on-primary-action',
 '--theme-secondary-action','--theme-on-secondary-action','--theme-secondary-border',
 '--theme-success-bg','--theme-on-success','--theme-danger-bg','--theme-on-danger',
 '--theme-warning-bg','--theme-on-warning','--theme-disabled-bg','--theme-on-disabled',
 '--theme-disabled-border','--theme-input-bg','--theme-on-input','--theme-input-border',
 '--theme-chip-bg','--theme-on-chip','--theme-ribbon-bg','--theme-on-ribbon',
 '--theme-ribbon-border','--theme-dialog-bg','--theme-on-dialog','--theme-muted',
 '--theme-placeholder','--theme-border','--theme-border-strong'
]
_THEME_PAIRS=[
 ('--theme-on-page','--theme-page'),
 ('--theme-on-surface','--theme-surface'),
 ('--theme-on-surface-soft','--theme-surface-soft'),
 ('--theme-on-surface-muted','--theme-surface-muted'),
 ('--theme-on-header','--theme-header'),
 ('--theme-on-nav','--theme-nav'),
 ('--theme-on-inverse','--theme-inverse-surface'),
 ('--theme-on-accent','--theme-accent'),
 ('--theme-on-primary-action','--theme-primary-action'),
 ('--theme-on-secondary-action','--theme-secondary-action'),
 ('--theme-on-disabled','--theme-disabled-bg'),
 ('--theme-on-input','--theme-input-bg'),
 ('--theme-on-chip','--theme-chip-bg'),
 ('--theme-on-success','--theme-success-bg'),
 ('--theme-on-danger','--theme-danger-bg'),
 ('--theme-on-warning','--theme-warning-bg'),
 ('--theme-on-ribbon','--theme-ribbon-bg'),
 ('--theme-on-dialog','--theme-dialog-bg'),
 ('--theme-placeholder','--theme-input-bg')
]
def _hex_rgb(value):
 v=value.strip().lower()
 if re.fullmatch(r'#[0-9a-f]{3}',v):
  v='#'+''.join(ch*2 for ch in v[1:])
 if not re.fullmatch(r'#[0-9a-f]{6}',v): return None
 return tuple(int(v[i:i+2],16)/255 for i in (1,3,5))
def _rel_luminance(value):
 rgb=_hex_rgb(value)
 if rgb is None: return None
 def lin(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
 r,g,b=(lin(c) for c in rgb)
 return .2126*r+.7152*g+.0722*b
def _contrast(fg,bg):
 a,b=_rel_luminance(fg),_rel_luminance(bg)
 if a is None or b is None: return None
 return (max(a,b)+.05)/(min(a,b)+.05)
def _theme_vars(theme_id):
 # Collect all declarations across repeated blocks for this theme.
 pattern=re.compile(r'body\.v15-tournament-active\[data-theme-pack="'+re.escape(theme_id)+r'"\]\s*\{([^}]*)\}',re.S)
 vals={}
 for block in pattern.findall(theme_css):
  for name,value in re.findall(r'(--theme-[a-z0-9-]+)\s*:\s*([^;]+)',block,re.I):
   vals[name.strip()]=value.strip()
 return vals
for _theme_id in _THEME_IDS:
 _vars=_theme_vars(_theme_id)
 _missing=[x for x in _THEME_REQUIRED if x not in _vars]
 if _missing: fail(f'Theme Contract Tokens fehlen in {_theme_id}: {_missing}')
 for _fg,_bg in _THEME_PAIRS:
  _ratio=_contrast(_vars[_fg],_vars[_bg])
  if _ratio is None: fail(f'Theme Contract Kontrast kann nicht statisch geprüft werden: {_theme_id} {_fg}/{_bg} = {_vars[_fg]} / {_vars[_bg]}')
  if _ratio<4.5: fail(f'Theme Contract Kontrast < 4.5:1: {_theme_id} {_fg}/{_bg} = {_ratio:.2f}:1')
if 'docs/THEME_CONTRACT.md' not in [str(p.relative_to(ROOT)).replace('\\','/') for p in ROOT.rglob('THEME_CONTRACT.md')]:
 fail('Theme Contract Dokumentation fehlt')
if "getPropertyValue('--theme-browser-color')" not in engine_text:
 fail('Browser Chrome wird nicht aus dem Theme Contract gelesen')

if not (ROOT/'docs/THEME_CONTRACT.md').exists(): fail('Theme Contract Dokumentation fehlt')

if not (ROOT/'docs/THEME_TEMPLATE.css').exists(): fail('Theme Template fehlt')

if 'THEME CONTRACT V1 · REQUIRED SEMANTIC PAIRS' not in theme_css: fail('Theme Contract CSS Tokens fehlen')

if 'THEME CONTRACT V1 · COMPONENT APPLICATION' not in theme_css: fail('Theme Contract Component Mapping fehlt')
if 'THEME CONTRACT V2 · DYNAMIC BACKEND CONTRACT' not in theme_css: fail('Theme Contract v2 dynamisches Component Mapping fehlt')
if 'Theme Contract v2 · non-Core legacy coverage' not in theme_css: fail('Nicht-Core Legacy-Abdeckung des Theme Contract fehlt')
for _needle in [
 '.games-intro p',
 '.admin-mandatory-hold',
 '#v15InAppLayer',
 '#jokerPage',
 '.mobile-more-grid a'
]:
 if _needle not in theme_css: fail('Theme Contract Legacy-Abdeckung fehlt: '+_needle)
if ':not([data-theme-pack="theme.skielsen.core2"])' not in theme_css: fail('Core 2 ist nicht von Nicht-Core Theme-Reparaturen ausgenommen')

if 'skielsen-theme-context' not in theme_css: fail('Theme Contract v2 Workflow/Lobby Mapping fehlt')

