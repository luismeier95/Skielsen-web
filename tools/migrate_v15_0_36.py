from pathlib import Path
import re, base64, hashlib, json, shutil

ROOT = Path.cwd()
SRC = ROOT / 'index.html'
PUBLIC = ROOT / 'public'

if not SRC.exists():
    raise SystemExit('index.html fehlt')
text = SRC.read_text(encoding='utf-8')
if '<title>SKIELSEN V15.0.36</title>' not in text:
    raise SystemExit('Migration erwartet SKIELSEN V15.0.36 nach Patch')

if PUBLIC.exists():
    shutil.rmtree(PUBLIC)
for p in [PUBLIC/'assets/css', PUBLIC/'assets/js', PUBLIC/'assets/images', PUBLIC/'assets/joker', ROOT/'docs', ROOT/'tools']:
    p.mkdir(parents=True, exist_ok=True)

# Embedded binary assets -> stable files.
asset_by_sha = {
    '3734e243d75057c9533688f5735c77cf7fc3c4bba806a69ca953f0af26d19405': 'assets/images/skielsen-logo.png',
    '7870874b63d1dbe0750fbccf14608fa5b779ac61b4656373d24234b3d4fbc7a5': 'assets/joker/skielsen-joker-back.png',
    '95f90bf775e2934995a27959d071b8115305ce92b63b1f598205d884c9bf0645': 'assets/joker/skielsen-joker-front.png',
}
uri_re = re.compile(r'data:image/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)')
for m in list(uri_re.finditer(text)):
    raw = base64.b64decode(m.group(2))
    sha = hashlib.sha256(raw).hexdigest()
    rel = asset_by_sha.get(sha)
    if not rel:
        raise SystemExit(f'Unbekanntes eingebettetes Bild: {sha} ({len(raw)} bytes)')
    target = PUBLIC / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(raw)
    text = text.replace(m.group(0), rel)

# 87 inline style blocks -> one cacheable stylesheet in original cascade order.
style_re = re.compile(r'<style\b([^>]*)>(.*?)</style>', re.I | re.S)
styles = list(style_re.finditer(text))
if not styles:
    raise SystemExit('Keine Inline-Styles gefunden')
css=[]
for i,m in enumerate(styles,1):
    attrs=' '.join(m.group(1).split())
    css.append(f'/* ===== INLINE STYLE {i:02d}' + (f' · {attrs}' if attrs else '') + ' ===== */\n' + m.group(2).strip() + '\n')
(PUBLIC/'assets/css/app.css').write_text('\n'.join(css)+'\n', encoding='utf-8')
first=[True]
def style_replace(m):
    if first[0]:
        first[0]=False
        return '<link rel="stylesheet" href="assets/css/app.css"/>'
    return ''
text=style_re.sub(style_replace,text)

# Inline JS -> ordered assets. Script position/type/id stay unchanged.
script_names = {
    'games-library-js':'01-games-library.js',
    'player-subtabs-final-js':'02-player-profile-tabs.js',
    'games-filter-controller':'03-games-filter.js',
    'mobile-more-navigation-v1-js':'04-mobile-navigation.js',
    'admin-mandatory-hold-to-confirm-behavior-v1':'05-admin-hold-confirm.js',
    'db-bootstrap-v14f-js':'06-db-bootstrap.js',
    'v15-tournament-engine-js':'07-tournament-engine.js',
    'v1507-inapp-runtime':'08-inapp-runtime.js',
}
script_re = re.compile(r'<script\b(?![^>]*\bsrc\s*=)([^>]*)>(.*?)</script>', re.I | re.S)
count=[0]
def script_replace(m):
    count[0]+=1
    attrs=m.group(1).strip(); body=m.group(2)
    idm=re.search(r'\bid\s*=\s*["\']([^"\']+)["\']',attrs,re.I)
    sid=idm.group(1) if idm else f'inline-{count[0]:02d}'
    filename=script_names.get(sid,f'{count[0]:02d}-{re.sub(r"[^a-z0-9]+","-",sid.lower()).strip("-")}.js')
    (PUBLIC/'assets/js'/filename).write_text(body.strip()+'\n',encoding='utf-8')
    return f'<script {attrs} src="assets/js/{filename}"></script>' if attrs else f'<script src="assets/js/{filename}"></script>'
text=script_re.sub(script_replace,text)
if count[0] != 8:
    raise SystemExit(f'8 Inline-Scripts erwartet, gefunden: {count[0]}')

text=text.replace('<!-- Real SKIELSEN PNG embedded directly in this HTML file -->','<!-- SKIELSEN logo served as a static asset -->')
(PUBLIC/'index.html').write_text(text,encoding='utf-8')
(PUBLIC/'.nojekyll').write_text('',encoding='utf-8')
(PUBLIC/'version.json').write_text(json.dumps({'app':'SKIELSEN','version':'15.0.36','layout':'modular-static','entry':'index.html'},indent=2)+'\n',encoding='utf-8')
(PUBLIC/'_headers').write_text('''# Cloudflare Pages response headers\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/index.html\n  Cache-Control: no-cache\n\n/version.json\n  Cache-Control: no-cache\n\n/assets/*\n  Cache-Control: public, max-age=3600, must-revalidate\n''',encoding='utf-8')
(PUBLIC/'_redirects').write_text('''# Reserved for Cloudflare Pages redirects.\n# The current SKIELSEN app uses in-document navigation, so no SPA catch-all is required yet.\n''',encoding='utf-8')

validator=r'''from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
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
missing=[]
for kind,ref in p.refs:
 if not ref or ref.startswith(('#','data:','mailto:','tel:','javascript:')): continue
 u=urlsplit(ref)
 if u.scheme or u.netloc: continue
 if ref.startswith('/'): missing.append((kind,ref,'absolute path')); continue
 target=(PUBLIC/u.path).resolve()
 if not target.exists(): missing.append((kind,ref,'missing'))
if missing: fail(repr(missing[:20]))
v=json.loads((PUBLIC/'version.json').read_text())['version']
if f'SKIELSEN V{v}' not in h: fail('Versionskonflikt')
print(f'OK: SKIELSEN V{v} · {len(p.refs)} Referenzen geprüft')
'''
(ROOT/'tools/validate_static.py').write_text(validator,encoding='utf-8')

(ROOT/'.github/workflows/pages.yml').write_text('''name: SKIELSEN deploy\n\non:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n\npermissions:\n  contents: read\n  pages: write\n  id-token: write\n\nconcurrency:\n  group: pages\n  cancel-in-progress: true\n\njobs:\n  deploy:\n    environment:\n      name: github-pages\n      url: ${{ steps.deployment.outputs.page_url }}\n    runs-on: ubuntu-latest\n    steps:\n      - name: Repository laden\n        uses: actions/checkout@v6\n      - name: Static build prüfen\n        run: python3 tools/validate_static.py\n      - name: JavaScript Syntax prüfen\n        shell: bash\n        run: |\n          set -euo pipefail\n          while IFS= read -r -d '' file; do\n            node --check "$file"\n          done < <(find public/assets/js -type f -name '*.js' -print0)\n      - name: GitHub Pages vorbereiten\n        uses: actions/configure-pages@v5\n      - name: Public-Verzeichnis hochladen\n        uses: actions/upload-pages-artifact@v4\n        with:\n          path: './public'\n      - name: Website veröffentlichen\n        id: deployment\n        uses: actions/deploy-pages@v4\n''',encoding='utf-8')

(ROOT/'wrangler.jsonc').write_text('''{\n  "name": "skielsen-web",\n  "pages_build_output_dir": "./public",\n  "compatibility_date": "2026-09-17"\n}\n''',encoding='utf-8')
(ROOT/'.gitignore').write_text('''node_modules/\n.wrangler/\n.dev.vars\n.env\n.env.*\n!.env.example\n.DS_Store\nThumbs.db\n''',encoding='utf-8')
(ROOT/'README.md').write_text('''# SKIELSEN Web\n\nAktueller Stand: **V15.0.36**\n\nSKIELSEN ist als modulare statische Web-App organisiert. Die produktiv ausgelieferte Website liegt vollständig unter `public/`; GitHub Pages und später Cloudflare Pages verwenden denselben Deploy-Ordner.\n\n## Struktur\n\n```text\npublic/\n  index.html                 # kanonischer App-Einstieg\n  version.json\n  _headers                   # Cloudflare Pages Header-Regeln\n  _redirects                 # für spätere Routing-Regeln vorbereitet\n  assets/\n    css/app.css\n    js/                      # Runtime in stabiler Lade-Reihenfolge\n    images/\n    joker/\ntools/validate_static.py     # CI-Prüfung für Pfade/Inline-Blobs/Version\n.github/workflows/pages.yml  # GitHub-Pages-Deployment aus public/\nwrangler.jsonc               # Cloudflare-Pages-Ausgabe = public/\n```\n\n## Entwicklungsregel\n\n`public/index.html` ist ab jetzt die **kanonische index.html**. Große CSS-, JavaScript- und Bilddaten werden nicht mehr Base64-kodiert in die HTML eingebettet, sondern als eigene Assets committed. Dadurch bleiben Git-Diffs, Commits, Caching und spätere Cloudflare-Deployments beherrschbar.\n\nVor jedem GitHub-Pages-Deploy werden die statischen Pfade, die Version und die JavaScript-Syntax automatisch geprüft.\n\nCloudflare-Hinweise: [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md).\n''',encoding='utf-8')
(ROOT/'docs/CLOUDFLARE.md').write_text('''# Cloudflare Pages – SKIELSEN\n\nDie Repo-Struktur ist für einen späteren Wechsel von GitHub Pages zu Cloudflare Pages vorbereitet.\n\n## Git-Integration\n\n- Repository: `luismeier95/Skielsen-web`\n- Production branch: `main`\n- Framework preset: **None / Static HTML**\n- Build command: **leer**\n- Build output directory: **`public`**\n\n`wrangler.jsonc` zeigt ebenfalls auf `./public`. Cloudflare empfiehlt für neue Wrangler-Projekte JSONC; sobald ein Pages-Projekt im Dashboard existiert, sollte die produktive Wrangler-Konfiguration mit den Dashboard-Einstellungen abgeglichen werden.\n\n## Header und Redirects\n\n`public/_headers` setzt nur konservative Header und Cache-Regeln. Eine strikte Content-Security-Policy kommt erst später, weil SKIELSEN aktuell noch Inline-Style-Attribute und dynamisch erzeugtes HTML verwendet.\n\n`public/_redirects` ist vorbereitet, aber bewusst ohne Catch-all: die App navigiert aktuell innerhalb eines Dokuments und benötigt noch kein History-API-Fallback.\n\n## Spätere Server-Funktionen\n\nCloudflare Pages Functions können später unter `/functions` ergänzt werden. Privilegierte Secrets gehören dann in Cloudflare-Bindings/Secrets und niemals in `public/` oder clientseitiges JavaScript. Supabase Service-Role-Keys dürfen nicht in statischen Assets liegen.\n''',encoding='utf-8')

print('Migration erzeugt public/ und Deployment-Konfiguration.')
