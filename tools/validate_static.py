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
if "engine.beginPostGameFlow(g,m,placements[0])" not in bridge_text: fail('In-App Games übergeben Ergebnis nicht an Standard Post-Game Flow')
if 'ingestHigherLowerResult' not in bridge_text: fail('Mehr-oder-Weniger Result-Handoff fehlt')
if 'v15-inapp-fullscreen-open' not in runtime_text: fail('In-App Fullscreen-Klasse fehlt')
if 'body.v15-inapp-fullscreen-open .mobile-nav' not in main_css_text: fail('Fullscreen blendet native App-Navigation nicht aus')
if 'transform:translateZ(0)' not in main_css_text or 'contain:paint' not in main_css_text: fail('In-App Compositor-Schutz fehlt')
if "register('inapp'" not in runtime_text or 'minimizeInApp' not in runtime_text: fail('In-App History/Minimize-Controller fehlt')
if 'v15InAppMinimize' in runtime_text or '.v15-inapp-minimize{' in main_css_text or '.v15-inapp-minimize span{' in main_css_text: fail('Alter sichtbarer In-App-Minimieren-Button ist noch vorhanden')
if 'popstate' not in history_text or 'pushState' not in history_text or 'replaceState' not in history_text: fail('App-History-Controller unvollständig')
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

if '--theme-accent' not in (PUBLIC/'assets/css/more-or-less-game.css').read_text(encoding='utf-8'): fail('More-or-Less erbt Tournament Theme nicht')

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
