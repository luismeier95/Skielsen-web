from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs
import json, sys
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
