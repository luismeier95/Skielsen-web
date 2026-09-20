# WORTKETTE · PRE-MERGE DESIGN / THEME AUDIT

Stand: **V20** · vor Integration in die SKIELSEN-Vollversion.

## Geprüfte Referenzen

- `docs/THEME_CONTRACT.md`
- `docs/THEME_TEMPLATE.css`
- `public/assets/js/00-theme-contract.js`
- `public/assets/css/app.css`
- `public/assets/css/tournament-theme-runtime.css`
- bestehende In-App-Module Buzzer und Mehr oder Weniger

## Gefundene Inkonsistenzen im Standalone-Build

1. Display-Font war `Arial Black / Impact` statt der Vollversions-Schrift `Archivo Black`.
2. Inter war als Font-Familie referenziert, im Standalone aber nicht geladen.
3. Seiten-Canvas war `#ececec` statt Core-Canvas `#e9e9e9`.
4. Weißer Text auf dem generischen Accent `#7C5CFF` wurde für wichtige UI-Texte verwendet. Das Theme Contract garantiert dafür nicht die notwendige Textkontrast-Paarung.
5. Accent wurde teilweise als Textfarbe auf hellen Flächen verwendet, obwohl Accent im Contract primär eine dekorative/Flächenrolle ist.

## Korrekturen vor dem Fullversion-Merge

- Inter + Archivo Black wie in `app.css` eingebunden.
- `--ui: "Inter", Arial, sans-serif`
- `--display: "Archivo Black", Arial, sans-serif`
- Core-Canvas auf `#e9e9e9` vereinheitlicht.
- Bedeutungsvolle Texte auf Accent-/Surface-Flächen auf kontrastsichere Textfarben umgestellt; Accent bleibt für Borders, Progress und Fokus erhalten.
- Standalone-Version auf V20 angehoben.

## Vertrag für das integrierte Modul

Das Fullversion-Modul darf keine Theme-ID-spezifischen Styles enthalten. Es verwendet ausschließlich semantische Theme-Contract-Rollen:

- `--theme-page / --theme-on-page`
- `--theme-surface / --theme-on-surface`
- `--theme-surface-soft / --theme-on-surface-soft`
- `--theme-header / --theme-on-header`
- `--theme-primary-action / --theme-on-primary-action`
- `--theme-secondary-action / --theme-on-secondary-action`
- `--theme-input-bg / --theme-on-input / --theme-input-border`
- `--theme-success-bg / --theme-on-success`
- `--theme-danger-bg / --theme-on-danger`
- `--theme-disabled-bg / --theme-on-disabled`
- `--theme-border / --theme-border-strong`
- `--theme-muted`
- `--theme-accent` nur dekorativ, außer wenn `--theme-on-accent` als Gegenfarbe genutzt wird.

Typografie wird im Modul ausschließlich aus `var(--ui)` und `var(--display)` übernommen.

Die Fullversion-Integration darf erst nach diesen Korrekturen auf `main` übernommen werden.
