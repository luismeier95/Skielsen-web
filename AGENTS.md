# SKIELSEN – Codex Agent Instructions

These instructions govern all Codex work in this repository.

## 1. Source precedence and conflicts

Apply sources in this order:

1. The current explicit user instruction has highest priority.
2. An explicit game-specific rule or exception takes precedence over a more general global rule within that game.
3. Global contracts apply wherever no game-specific override exists.
4. AGENT_START_HERE and handover files provide context, known bugs, rejected approaches and current work status; they do not silently override binding contracts.
5. Inspect current code to understand behavior, but do not treat it as the product specification.

If binding sources conflict and neither a clear specific exception nor a newer user decision resolves the conflict, report it to the user. Do not choose product behavior unilaterally; leave the disputed change pending while doing independent authorized work.

## 2. Read the relevant sources before editing

Before changing game, UI, theme, workflow, ranking, scoring, betting, MVP/LVP, joker, admin, mobile or desktop behavior, read the global contracts and relevant game documents, templates and handovers. Inspect the implementation before making assumptions. Do not implement from memory or screenshots alone.

Global sources:

- `docs/GAME_DESIGN_CONTRACT.md`
- `docs/THEME_CONTRACT.md`
- `docs/END_GAME_MERGE_TEMPLATE.html`
- `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`

Wortkette:

- `docs/WORTKETTE_GAME_CONTRACT.md`
- `docs/WORTKETTE_DESIGN_CONTRACT.md`
- `docs/WORTKETTE_DATABASE.md`

DNA — consult these before every DNA change:

- `docs/games/dna/GAME_CONTRACT_v1.md`
- `docs/games/dna/CONTENT_CONTRACT_v1.md`
- `docs/games/dna/AGENT_START_HERE.md`
- `docs/games/dna/STANDALONE_DATA_MAPPING.md`

Not every game has its own contract, and game documents are not all under `docs/games/`. When one is absent, examine global contracts, existing templates, relevant documentation and implementation. Do not invent missing contracts or assume undocumented product decisions.

## 3. Preserve product decisions and documentation

Do not silently redesign flows or change mechanics, tournament logic, scoring, ranking, joker, betting, MVP/LVP, admin, themes, mobile/desktop differences or datasets. Such changes require an explicit user request or a confirmed bug that makes the change necessary. DNA content has the stricter rule in section 8.

When an authorized change alters specified product behavior, update every affected contract in the same change and remove obsolete contradictory rules. A bugfix restoring specified behavior does not require rewriting an already correct contract. If the user restricts documentation edits, respect that scope and report any resulting documentation mismatch.

Stale README versions and incomplete documentation indexes are not proof of the current product state. Report inconsistencies; do not clean up unrelated documentation unless requested. Keep documentation current without introducing historical snapshots or superseded handovers as authoritative sources.

## 4. Standalone versus production

Standalone test pages are QA/development surfaces and may include debug controls, fixtures and test functions. Do not automatically transfer their rules, mock data, headers or controls into integrated production.

The DNA header sequence below applies to the standalone QA banner until an explicit production decision says otherwise:
`SKIELSEN LOGO → 30 px → DNA → 30 px → VERSION → 30 px → THEME DROPDOWN`

DNA is a candidate design reference, not an automatically global design system. Transferring DNA design rules to other games requires an explicit user decision. Production game modules use the established application frame and do not take ownership of global navigation or tournament chrome without authorization.

## 5. Themes, shared patterns and animation

`docs/THEME_CONTRACT.md` is binding. README files and older guidance cannot override it. Use existing theme variables and backend/data structures; do not create themes by blindly copying old CSS blocks when the current system requires data definitions. Preserve contrast and documented identity-color exceptions across supported themes.

Before adding a solution, search for maintained shared components and patterns for headers, containers, ready/difficulty pages, ranking, merge, admin controls, minimize/maximize behavior, participant accents and responsive layout. Avoid duplicate implementations and hardcoded theme colors where tokens exist.

The End Game Merge is an explicitly intended animation and an exception to general restrictions on purely decorative animation. Use the canonical merge and animation templates. Game-specific restrictions on animation or geometry take precedence within that game; unresolved conflicts follow section 1.

## 6. Build, validation, deployment and versions

Skielsen is primarily a static application:

- Production entry: `public/index.html`.
- Deployment content: `public/`.
- No general npm build is required for production.
- GitHub Pages workflow: `.github/workflows/pages.yml`.
- Central static check: `python tools/validate_static.py`.
- Cloudflare configuration: `wrangler.jsonc` and `docs/CLOUDFLARE.md`; it also targets `public/`.

The Pages workflow separately runs `node --check` on JavaScript under `public/assets/js/`. Static validation is not a complete JavaScript syntax check. Separately syntax-check changed files outside that coverage, especially standalone files such as `public/dna-test/app.js`, using `node --check <file>`. Validate changed inline scripts when relevant. Keep local asset references compatible with the hosting base path and validator.

`public/version.json` is the integrated application's central version source. Production asset cache versions must remain consistent with it. Standalone games may have separate QA versions; do not confuse them with the global app version.

A successful local check is not a successful deployment. Claim deployment success only after the corresponding workflow has actually completed successfully. Push/deploy only when requested by the user or explicitly established by the applicable workflow for the concrete task. A general historical handover is not blanket authorization to publish every change. Do not knowingly push broken or untested changes.

## 7. Desktop and mobile verification

For relevant UI changes, test desktop and mobile behavior, including:

- Narrow mobile viewports and touch interaction.
- First input focus on Android and native keyboard opening/closing.
- `visualViewport` changes and responsive container heights.
- Scroll behavior per game phase.
- Sticky/fixed controls and safe areas.
- Text wrapping, clipping and container overflow.
- The affected system's actual breakpoints and behavior on both sides.

Do not assume all components use the same breakpoint: game contracts commonly use 720 px, while Admin Command uses 800 px. Follow the relevant component rules. A desktop fix does not establish mobile correctness, and viewport emulation does not establish native keyboard correctness. Report unavailable device tests and remaining uncertainty.

## 8. DNA-specific safeguards

IDEA remains the canonical container design reference within the current DNA design. Other DNA page-level surfaces inherit it unless explicitly exempted; preserve documented semantic and nested-control exceptions.

DNA content, quiz questions and datasets may change only on explicit user request. A bugfix alone does not authorize content edits.

The v2.29.4 full-screen ScreenUpdating/Atomic-Freeze approach was rejected. Never hide, freeze or snapshot the complete game surface to solve layout flicker. Use lightweight local fixes such as earlier measurement, caching, precomputation or local stabilization.

Preserve IDEA keyboard-established hint geometry and typography through VOTE/feedback. Do not rebuild geometry after keyboard closure in ways that cause visible jumps. Do not reintroduce native autofocus without testing the first-focus Android regression.

DNA no-scroll is phase-specific: active gameplay, Reveal and countdown must fit the visible viewport; Setup, Ready, Ranking, Joker Resolution and Merge may scroll. Do not impose no-scroll globally or transfer it to other games.

Preserve End-Game/Merge tables through stable in-place updates as required by the templates. Do not remove and recreate continuing rows, blank the table or substitute blinking for physical row movement.

## 9. Rejected solutions and focused changes

Before larger fixes, search contracts, AGENT_START_HERE files, handovers, validator comments/checks and relevant documentation for rejected approaches. Do not reintroduce one merely because it seems technically convenient; an explicit user decision is required to revisit it. Respect validator restrictions on obsolete standalone snapshots and legacy artifacts.

Prefer the smallest robust change. Avoid unrelated formatting, renames, component changes, broad refactors, mass rewrites and unrequested framework migrations. Preserve unrelated local work. Maintain clear file ownership, consistent naming, reusable components, minimal dead code and no unexplained temporary hacks.

## 10. Standard workflow

### UNDERSTAND

- Inspect `git status` and understand existing local changes.
- Read relevant contracts, templates and handovers.
- Inspect affected code and understand existing behavior.
- Check known rejected approaches.

### PLAN

- Plan the minimum robust change and identify affected files.
- Check risks, dependencies and contract conflicts.
- Resolve product ambiguity through section 1 before changing disputed behavior.

### IMPLEMENT

- Make focused changes without unrelated edits or overwriting local work.
- Update affected product documentation when specified product behavior changes, subject to explicit user scope.

### VERIFY

- Inspect the resulting diff for intended scope and unrelated regressions.
- Check syntax/runtime errors and run applicable existing validators.
- Test the affected flow locally where possible, including desktop/mobile as relevant.
- Distinguish standalone from production and local validation from deployment.
- For documentation-only changes, verify wording, references and diff; application/device tests are unnecessary unless application behavior is affected.

### DELIVER

- Identify changed files, explain changes and name checks performed.
- Report failures, untested areas and remaining risks without false success claims.
- Only then commit/push if authorized; verify any resulting deployment before claiming it succeeded.

## 11. Responsibilities

The user owns product direction, game design, visual approval, UX decisions and final acceptance. Codex owns implementation, repository analysis, code quality, verification, relevant documentation and identification of technical conflicts and risks. When product intent is clear, implement it rather than redesigning it.
