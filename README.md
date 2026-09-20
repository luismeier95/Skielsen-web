# SKIELSEN Web

SKIELSEN is a modular tournament web application. The production frontend is a static app under `public/`; game state and tournament authority live in the connected backend.

**Current app version:** `15.1.71`

## Repository layout

```text
.github/
  workflows/                # deployment and maintenance workflows

data/
  wortkette-frequency-audit.json

docs/
  README.md                 # documentation index
  GAME_DESIGN_CONTRACT.md   # global game UI / implementation rules
  THEME_CONTRACT.md         # semantic theme contract
  THEME_TEMPLATE.css        # template for new themes
  WORTKETTE_DATABASE.md     # current Word Chain backend contract
  WORTKETTE_DESIGN_CONTRACT.md
  WORTKETTE_GAME_CONTRACT.md
  CLOUDFLARE.md

public/
  index.html                # canonical production entry point
  version.json              # single version authority
  assets/
    css/
    images/
    joker/
    js/
  game-design-contract.html # visual contract reference
  standalone-games.html     # production-module playtest harness
  more-or-less-contract-test/
  word-chain-test/

tools/
  validate_static.py
  score_word_chain_frequency.py
```

## Production entry point

`public/index.html` is the only application entry point.

The production JavaScript runtime is intentionally split into ordered modules:

```text
00-*  platform primitives (history, identity, themes, version)
01-*  game catalogue
02-*  profile UI
03-*  game filtering
04-*  mobile navigation
05-*  admin interaction helpers
06-*  database bootstrap
07-*  tournament engine
08-*  in-app runtime
09-*  buzzer
10-*  tournament result bridge
11-*  more-or-less
12-*  word-chain
```

Game modules do not own global navigation or tournament chrome. They mount inside the existing application frame.

## Development references

These routes are maintained intentionally:

- `/game-design-contract.html` — visual implementation contract
- `/standalone-games.html` — local playtest harness using production game modules
- `/more-or-less-contract-test/` — current More-or-Less contract test
- `/word-chain-test/` — current Word Chain contract test

Legacy snapshots are not kept in `public/`. Git history is the archive.

## Quality gates

Every push to `main` runs:

1. static structure / reference validation
2. JavaScript syntax validation
3. GitHub Pages build and deployment

The validator also rejects known legacy snapshot patterns so obsolete standalone versions cannot silently return.

## Documentation

Start at [`docs/README.md`](docs/README.md).

## Deployment

GitHub Pages publishes exactly `public/`.

Cloudflare Pages uses the same output directory. See [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md).
