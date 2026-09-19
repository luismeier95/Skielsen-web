# SKIELSEN Theme Contract v1

This document is the binding visual contract for all future SKIELSEN tournament themes.

## Principle

A theme changes **semantic roles**, not individual components.

Do not hardcode component colors such as `background:#111` or `color:#000` in tournament runtime UI. Components must consume the semantic tokens below.

Participant/team identity colors are excluded from the theme system:

- Blue: `#1515ff`
- Red: `#ff1717`
- Yellow: `#f2b705`
- Green: `#00a65a`

Gold/Silver/Bronze and unambiguous result semantics may also remain semantic special colors.

## Accessibility rules

- Normal text: minimum contrast **4.5:1**
- Large/bold display text: minimum contrast **3:1**
- Interactive controls, borders and focus indicators against adjacent background: target **3:1**
- Disabled text is still required to remain readable; the SKIELSEN contract uses **4.5:1** for disabled foreground/background pairs.
- Never derive text color from a generic global text token when the background is a different semantic role.
- Every background role has a matching `ON_*` foreground role.

## Required theme roles

| UI role | CSS token | Default / Skielsen Core | Matching foreground |
|---|---|---:|---|
| Browser / root canvas | `--theme-root-canvas` | `#e9e9e9` | `--theme-on-page` |
| Browser theme color | `--theme-browser-color` | `#e9e9e9` | n/a |
| Page canvas | `--theme-page` | `#e9e9e9` | `--theme-on-page` |
| Primary surface | `--theme-surface` | `#ffffff` | `--theme-on-surface` |
| Soft surface | `--theme-surface-soft` | `#f7f7f7` | `--theme-on-surface-soft` |
| Muted surface | `--theme-surface-muted` | `#eeeeee` | `--theme-on-surface-muted` |
| Header | `--theme-header` | `#050505` | `--theme-on-header` |
| Navigation | `--theme-nav` | `#050505` | `--theme-on-nav` |
| Inverse surface | `--theme-inverse-surface` | `#050505` | `--theme-on-inverse` |
| Accent | `--theme-accent` | `#7c5cff` | `--theme-on-accent` |
| Primary action | `--theme-primary-action` | `#050505` | `--theme-on-primary-action` |
| Secondary action | `--theme-secondary-action` | `#ffffff` | `--theme-on-secondary-action` |
| Disabled | `--theme-disabled-bg` | `#d9d9d9` | `--theme-on-disabled` |
| Input | `--theme-input-bg` | `#ffffff` | `--theme-on-input` |
| Chip / badge | `--theme-chip-bg` | `#eeeeee` | `--theme-on-chip` |
| Success | `--theme-success-bg` | `#16864b` | `--theme-on-success` |
| Danger | `--theme-danger-bg` | `#d62828` | `--theme-on-danger` |
| Warning | `--theme-warning-bg` | `#c79a32` | `--theme-on-warning` |
| Live ribbon | `--theme-ribbon-bg` | `#050505` | `--theme-on-ribbon` |
| Dialog | `--theme-dialog-bg` | `#ffffff` | `--theme-on-dialog` |
| Overlay | `--theme-overlay` | `rgba(0,0,0,.72)` | dialog handles foreground |
| Standard border | `--theme-border` | `#dddddd` | n/a |
| Strong border | `--theme-border-strong` | `#c7c7c7` | n/a |
| Muted text | `--theme-muted` | `#666666` | must remain readable on its intended surface |
| Placeholder | `--theme-placeholder` | `#666666` | intended for input background |

## Component mapping

### Browser and global chrome
Must use:
- `ROOT_CANVAS`
- `BROWSER_THEME_COLOR`
- `PAGE`
- `HEADER / ON_HEADER`
- `NAV / ON_NAV`
- `ACCENT / ON_ACCENT`

Applies to:
- browser root / overscroll
- desktop header
- desktop navigation
- mobile navigation
- mobile more menu
- profile navigation
- focus ring

### Page heroes
Applies to:
- Home Hero
- Player Hero
- Matches Hero
- Match Detail Hero
- Ranking Hero
- Betting Hero
- News Hero
- Games Intro
- Admin Hero
- Game Control Hero
- Join/Lobby Hero

Default mapping:
- background: `SURFACE`
- foreground: `ON_SURFACE`
- accent border: `ACCENT`
- supporting text: `MUTED`

### Section headers
Applies to Home Module, Player Match, Achievement, Match, Ranking, Games, Utility, Match Detail, Betting and Joker headers.

Default mapping:
- background: `SURFACE`
- foreground: `ON_SURFACE`
- border: `BORDER_STRONG`
- meta: `MUTED`

### Cards and panels
Primary:
- `SURFACE / ON_SURFACE`

Secondary:
- `SURFACE_SOFT / ON_SURFACE_SOFT`

Muted:
- `SURFACE_MUTED / ON_SURFACE_MUTED`

Includes Home cards, Match cards, Player panels, Skills, KPI, Achievements, Ranking, Betting, Wallet, Games, Match Detail, Admin, Join/Lobby, Joker, MVP/LVP.

### Buttons

#### Primary
Examples:
- Match starten
- Spiel vorbereiten
- Ergebnis bestätigen
- Bet platzieren
- Join Tournament
- Lobby starten
- MVP/LVP weiter
- Joker Reveal weiter

Use:
- `PRIMARY_ACTION / ON_PRIMARY_ACTION`

#### Secondary
Examples:
- Zurück
- Cancel
- Skip Bet
- Inactive filters
- Joker secondary actions

Use:
- `SECONDARY_ACTION / ON_SECONDARY_ACTION / SECONDARY_BORDER`

#### Accent / selected
Examples:
- selected filters
- active category
- selected visual option

Use:
- `ACCENT / ON_ACCENT`

#### Danger
Destructive actions must use:
- `DANGER_BG / ON_DANGER`

#### Disabled
Always use:
- `DISABLED_BG / ON_DISABLED / DISABLED_BORDER`

Do not implement disabled state only by reducing opacity.

### Inputs
Text input, number, search, select, textarea, stake, join code, player selector and admin theme selector use:
- `INPUT_BG / ON_INPUT / INPUT_BORDER`
- placeholder: `PLACEHOLDER`
- focus: `ACCENT`

### Chips / badges
Use:
- `CHIP_BG / ON_CHIP`
- border: `BORDER`

### Status roles
- Success: `SUCCESS_BG / ON_SUCCESS`
- Danger / Live / Error: `DANGER_BG / ON_DANGER`
- Warning / Waiting: `WARNING_BG / ON_WARNING`

### Ribbons / persistent live chrome
Includes:
- In-App Live Ribbon
- Flow Toast
- Betting tip ribbon
- resume ribbon

Use:
- `RIBBON_BG / ON_RIBBON / RIBBON_BORDER`

### Dialogs and overlays
Dialog card:
- `DIALOG_BG / ON_DIALOG`

Backdrop:
- `OVERLAY`

Buttons inside dialogs still follow primary/secondary action roles.

### In-App games
The generic In-App frame inherits the same theme contract.

Buzzer:
- all chrome uses tournament theme
- participant stop button may use the participant/team identity color

More or Less:
- canvas, header, setup, difficulty, roulette, cards, reveal and results use tournament roles
- Less/More action semantics may be styled distinctly, but their foreground/background pairs must pass contrast

## Forbidden patterns

Do not add runtime tournament UI such as:

```css
.component { background:#111; color:#000; }
.component { color:black; }
.component { background:white; }
```

unless it is a documented immutable semantic color.

Do not use:
- a generic `--theme-text` as the only foreground for every surface
- opacity-only disabled styling
- theme-specific page overrides such as `#matchDetailPage[data-theme=...]`
- page-specific palette definitions

## Adding a new theme

1. Add the theme to `public.theme_packs`.
2. Add one token block in `tournament-theme-runtime.css`.
3. Define **every required token**.
4. Ensure every required foreground/background pair passes 4.5:1.
5. Do not add component selectors for the new theme.
6. Test through Admin Tools → Theme Test.
7. Verify browser chrome, desktop, mobile, dialogs and both native In-App games.
8. Run the static validator.

## Required contrast pairs checked by build

- ON_PAGE / PAGE
- ON_SURFACE / SURFACE
- ON_SURFACE_SOFT / SURFACE_SOFT
- ON_SURFACE_MUTED / SURFACE_MUTED
- ON_HEADER / HEADER
- ON_NAV / NAV
- ON_INVERSE / INVERSE_SURFACE
- ON_ACCENT / ACCENT
- ON_PRIMARY_ACTION / PRIMARY_ACTION
- ON_SECONDARY_ACTION / SECONDARY_ACTION
- ON_DISABLED / DISABLED_BG
- ON_INPUT / INPUT_BG
- ON_CHIP / CHIP_BG
- ON_SUCCESS / SUCCESS_BG
- ON_DANGER / DANGER_BG
- ON_WARNING / WARNING_BG
- ON_RIBBON / RIBBON_BG
- ON_DIALOG / DIALOG_BG
