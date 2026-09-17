# Cloudflare Pages – SKIELSEN

Die Repo-Struktur ist für einen späteren Wechsel von GitHub Pages zu Cloudflare Pages vorbereitet.

## Git-Integration

- Repository: `luismeier95/Skielsen-web`
- Production branch: `main`
- Framework preset: **None / Static HTML**
- Build command: **leer**
- Build output directory: **`public`**

`wrangler.jsonc` zeigt ebenfalls auf `./public`. Cloudflare empfiehlt für neue Wrangler-Projekte JSONC; sobald ein Pages-Projekt im Dashboard existiert, sollte die produktive Wrangler-Konfiguration mit den Dashboard-Einstellungen abgeglichen werden.

## Header und Redirects

`public/_headers` setzt nur konservative Header und Cache-Regeln. Eine strikte Content-Security-Policy kommt erst später, weil SKIELSEN aktuell noch Inline-Style-Attribute und dynamisch erzeugtes HTML verwendet.

`public/_redirects` ist vorbereitet, aber bewusst ohne Catch-all: die App navigiert aktuell innerhalb eines Dokuments und benötigt noch kein History-API-Fallback.

## Spätere Server-Funktionen

Cloudflare Pages Functions können später unter `/functions` ergänzt werden. Privilegierte Secrets gehören dann in Cloudflare-Bindings/Secrets und niemals in `public/` oder clientseitiges JavaScript. Supabase Service-Role-Keys dürfen nicht in statischen Assets liegen.
