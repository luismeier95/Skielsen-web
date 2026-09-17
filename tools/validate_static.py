from pathlib import Path
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
