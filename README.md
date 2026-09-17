# SKIELSEN Web

Aktueller Stand: **V15.0.36**

SKIELSEN ist als modulare statische Web-App organisiert. Die produktiv ausgelieferte Website liegt vollständig unter `public/`; GitHub Pages und später Cloudflare Pages verwenden denselben Deploy-Ordner.

## Struktur

```text
public/
  index.html                 # kanonischer App-Einstieg
  version.json
  _headers                   # Cloudflare Pages Header-Regeln
  _redirects                 # für spätere Routing-Regeln vorbereitet
  assets/
    css/app.css
    js/                      # Runtime in stabiler Lade-Reihenfolge
    images/
    joker/
tools/validate_static.py     # CI-Prüfung für Pfade/Inline-Blobs/Version
.github/workflows/pages.yml  # GitHub-Pages-Deployment aus public/
wrangler.jsonc               # Cloudflare-Pages-Ausgabe = public/
```

## Entwicklungsregel

`public/index.html` ist ab jetzt die **kanonische index.html**. Große CSS-, JavaScript- und Bilddaten werden nicht mehr Base64-kodiert in die HTML eingebettet, sondern als eigene Assets committed. Dadurch bleiben Git-Diffs, Commits, Caching und spätere Cloudflare-Deployments beherrschbar.

Vor jedem GitHub-Pages-Deploy werden die statischen Pfade, die Version und die JavaScript-Syntax automatisch geprüft.

Cloudflare-Hinweise: [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md).
