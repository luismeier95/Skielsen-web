# SKIELSEN Theme Contract v2

## Grundregel

**Skielsen Core ist die unveränderte visuelle Referenz.** Neue Theme-Packs ändern keine Komponenten-Selektoren und bringen keine eigenen Page-Fixes mit. Ein Theme ist ausschließlich ein vollständiger semantischer Contract im Backend.

Die Quelle für ein Theme ist `public.theme_packs.manifest_json.theme_contract`. Der Browser lädt aktive Theme-Packs über `list_theme_pack_contracts()` bzw. `get_theme_pack_contract()` und überträgt die Rollen auf stabile CSS Custom Properties.

## Contract

Jedes aktive Theme muss `theme_contract.version >= 2` und alle Pflicht-Tokens enthalten. Der Backend-Constraint `theme_packs_theme_contract_v2_check` verhindert unvollständige Packs.

Pflichtrollen:

- Chrome: `root_canvas`, `browser_color`, `page`, `on_page`, `header`, `on_header`, `nav`, `on_nav`, `nav_muted`
- Surfaces: `surface`, `on_surface`, `surface_soft`, `on_surface_soft`, `surface_muted`, `on_surface_muted`, `inverse_surface`, `on_inverse`
- Text/Borders: `muted`, `faint`, `placeholder`, `border`, `border_strong`
- Accent: `accent`, `on_accent`, `accent_2`
- Actions: `primary_action`, `on_primary_action`, `secondary_action`, `on_secondary_action`, `secondary_border`
- Status: `success_bg`, `on_success`, `danger_bg`, `on_danger`, `warning_bg`, `on_warning`
- Disabled: `disabled_bg`, `on_disabled`, `disabled_border`
- Forms: `input_bg`, `on_input`, `input_border`
- Chips: `chip_bg`, `on_chip`
- Persistent chrome: `ribbon_bg`, `on_ribbon`, `ribbon_border`
- Dialogs: `dialog_bg`, `on_dialog`, `overlay`, `shadow`, `shadow_soft`
- Focus: `focus`
- Game-functional: `less_action`, `on_less_action`, `more_action`, `on_more_action`

## Kontrast

Alle normalen Foreground/Background-Paare müssen mindestens **4.5:1** erreichen. Das wird sowohl im Backend als auch im Browser geprüft. Nicht-Core-Themes müssen zusätzlich die funktionalen More/Less-Paare erfüllen.

Skielsen Core ist als bestehende visuelle Referenz eingefroren. Seine bisherige Darstellung wird nicht durch Contract-v2-Migrationsregeln umgestaltet.

## Semantische Konstanten

Participant Identity bleibt unabhängig vom Theme:

- Blau `#1515ff`
- Rot `#ff1717`
- Gelb `#f2b705`
- Grün `#00a65a`

Gold/Silber/Bronze bleiben ebenfalls semantische Sonderfarben. Ein Theme darf diese Identitäten nicht durch Dekorfarben ersetzen.

## Welche Bereiche konsumieren den Contract?

Der Contract ist die gemeinsame Quelle für:

- Browser Canvas und `theme-color`
- Tournament Header, Navigation, Mobile Navigation und Profile Subnav
- Home, Player, Matches, Match Detail, Ranking, Betting, News, Games, Admin und Game Control
- Buttons, Inputs, Filter, Chips, Status, Ribbons, Toasts und Dialoge
- Joker sowie MVP/LVP
- Join/Lobby und die Pre-Tournament-Workflows nach Auswahl eines Themes
- generisches In-App-Chrome
- Buzzer Zeit Stoppen
- Mehr oder Weniger
- Tournament Shop Vorschau und dynamischen Theme-Katalog

## Neues Theme hinzufügen

1. Einen Datensatz in `public.theme_packs` mit vollständigem `manifest_json.theme_contract` anlegen.
2. Alle 57 Pflicht-Tokens befüllen und kontrastfähige Hex-Farbpaare verwenden.
3. Theme aktivieren (`is_active=true`).
4. Fertig: Shop, Admin Theme Test, Lobby und Tournament Runtime beziehen es automatisch aus dem Backend.

**Nicht mehr erforderlich:** neue Theme-ID in `index.html`, `06-db-bootstrap.js`, Admin-Dropdown oder `tournament-theme-runtime.css` eintragen.

Theme-spezifische CSS-Selektoren sind nur noch für optionale dekorative Legacy-/Spezialeffekte zulässig. Sie dürfen niemals für Lesbarkeit, Buttons, Forms, Dialoge oder Seiten-Grundflächen notwendig sein.

## Implementierung

- `public/assets/js/00-theme-contract.js`: Contract-Validierung und Runtime-Injektion
- `public/assets/css/tournament-theme-runtime.css`: stabile Rollen → Komponenten
- `public/assets/js/06-db-bootstrap.js`: Backend-Katalog für Shop, Workflow und Lobby
- `public/assets/js/07-tournament-engine.js`: Backend-Katalog für Live-Turnier und Admin Theme Test
- `public/assets/css/buzzer-time.css`: Buzzer-Rollen
- `public/assets/css/more-or-less-game.css`: funktionale More/Less-Rollen
- `tools/validate_static.py`: statische Contract-Integritätsprüfung
