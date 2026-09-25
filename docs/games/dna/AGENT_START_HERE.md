# SKIELSEN DNA — Agent Start Here / Handover

**Status:** Current playtest handover  
**Date:** 2026-09-25  
**Repo:** `luismeier95/Skielsen-web`  
**Standalone:** `/skielsen-web/dna-test/` / repository path `public/dna-test/`  
**Latest implementation baseline at handover:** DNA standalone v2.29.4  
**Latest gameplay patch:** `c4a0d2330a73028f081c64f1a1b97f05102652e1`

## 1. Mandatory first action for every future agent

The contracts are **binding**, not optional background reading.

Before changing DNA, read:

1. `docs/games/dna/GAME_CONTRACT_v1.md`
2. `docs/games/dna/CONTENT_CONTRACT_v1.md`
3. `docs/GAME_DESIGN_CONTRACT.md`
4. `docs/THEME_CONTRACT.md`
5. `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`
6. `docs/END_GAME_MERGE_TEMPLATE.html`
7. `docs/games/dna/STANDALONE_DATA_MAPPING.md`
8. this file

Do not implement from memory or from a screenshot alone when a contract already defines the behavior.

If the user gives a new explicit decision that conflicts with a contract, the new decision wins. Update the relevant contract in the **same change set** as the code change so the next agent never inherits stale documentation.

The user intends DNA to become the design/mechanics baseline for existing and future Skielsen games once DNA is finalized. Do **not** prematurely rewrite all global game contracts until the user approves the final DNA baseline.

## 2. Product concept

DNA is a mobile-first team quiz.

Each term has exactly three hints:

- Hint 1 — very hard — +3
- Hint 2 — hard — +2
- Hint 3 — medium — +1

Wrong binding team answer: -1.  
No answer: 0.

A correct team is SOLVED for the current term and no longer participates in later hints of that term. Every team re-enters on the next term.

Normal per-term flow:

`H1 IDEA → H1 VOTE → evaluate → H2 IDEA → H2 VOTE → evaluate → H3 IDEA → H3 VOTE → evaluate → REVEAL → COUNTDOWN → next term`

Final flow:

`GAME RANKING → optional JOKER RESOLUTION → TOURNAMENT MERGE → CLOSE`

## 3. Team / consensus behavior

Current teams contain two players.

IDEA:
- each player independently enters one private idea or `KEINE IDEE`,
- teammate cannot see it yet,
- opponents never see it.

VOTE:
- team ideas become visible only inside that team,
- normalized duplicates merge into one candidate,
- `KEINE ANTWORT` is always present,
- max three practical cards in current 2-player teams: Idea 1, Idea 2, No Answer,
- players may tap/change votes freely,
- voting itself never submits.

Consensus:
- current 2-player team: 2/2 same option,
- future >2: simple majority,
- tie = no consensus,
- once consensus exists, Submit is enabled on both devices,
- only one teammate needs to press Submit,
- first valid Submit wins,
- duplicate submits are idempotent.

Timeout:
- IDEA max 20 s,
- VOTE max 10 s,
- phases may end early when all required actors complete,
- VOTE timeout without Submit = No Answer / 0.

Standalone bot:
- must use the same server validation as final scoring,
- if the user's candidate is recognized as correct, bot must cooperate with that answer rather than insist on its own decoy or No Answer.

## 4. Current page flow / scroll rules

Setup opens after auth.

Setup choices currently implemented:
- one or multiple categories (multiple = MIX),
- 5 / 10 / 15 terms,
- content pool: CASUAL / AUSGEWOGEN (BALANCED) / EXPERT.

Scroll contract:
- Setup: scroll allowed
- Ready: scroll allowed
- active gameplay: NO SCROLL
- Reveal: NO SCROLL
- Game Ranking: scroll allowed
- Joker Resolution: scroll allowed
- Merge: scroll allowed

A prior bug came from applying the gameplay no-scroll rule globally. Do not reintroduce it.

## 5. Active top chrome

DNA may bypass the old reserved Skielsen top-banner space and use the full visible gameplay viewport.

Current approved chrome:
- SKIELSEN logo at left, aspect ratio locked, as tall as the banner comfortably allows,
- ~30 px optical gap,
- `DNA`,
- standalone QA only: Theme dropdown directly after the game name,
- right side: state only (`SETUP`, `READY`, `IDEE`, `ABSTIMMUNG`, `REVEAL`, `RANKING`, `MERGE`),
- extra category/score/round metadata in the header is intentionally removed.

Overall game progress and mechanic timer are separate bars.

## 6. Theme QA / theme behavior

The standalone contains a dropdown with all available valid Theme Packs specifically to test the Theme Contract against the same DNA component tree.

It is a QA feature and will probably disappear in the full integrated game.

Theme requirements:
- all surfaces, borders, backgrounds, text and focus states come from Theme Contract tokens,
- selection glow language applies to selectable controls,
- selected category/choice/vote cards receive accent/focus glow,
- Core team identity colors remain the non-negotiable Core colors,
- Core 2 keeps identity slots but maps them to Core 2 equivalents.

The user particularly liked the glow around the Theme selector and extended that visual language to selectable controls.

## 7. Blocking vs non-blocking buttons

Buttons that stop progression until a conscious user action is required get a **pulsing glow**.

Examples:
- Setup `WEITER`
- `ICH BIN BEREIT`
- `SPIEL STARTEN`
- required `TABELLE ANZEIGEN` / continuation buttons

Do not pulse actions that are optional because a timer can advance automatically:
- `AUSWAHL LÖSEN`
- `ANTWORT ABSENDEN`

## 8. Ready screen

Ready is intentionally symmetric.

Rule cards:
- +3 / Hint 1
- +2 / +1 / Hint 2/3
- -1 / wrong answer
- 20s + 10s / IDEA → VOTE

Rule box contents are centered.

Ready team rows use the vertical team-color accent.

## 9. The most important mobile geometry decision

This is the part most likely to regress.

### The Hint Stage is always three equal tracks

The geometric hint stage is divided into exactly 3 equal vertical slots.

- Hint 1 → first third
- Hint 2 → second third
- Hint 3 → third third

Every released hint has its **own rounded container**.

Unreleased slots stay empty/hidden; released hints do not stretch into them.

Therefore:
- H1 only: card occupies 1/3 of hint stage,
- H1+H2: each occupies 1/3, final 1/3 remains empty,
- H1+H2+H3: each occupies 1/3.

This came from the user's annotated visual mockup and was explicitly approved after playtesting.

### IDEA defines the geometry

With the native keyboard open:
- timer remains above the hints,
- the hint stage uses the available space between timer and interaction box,
- interaction box stays immediately above the native keyboard,
- the three hint tracks share the resulting stage equally,
- text size may shrink within bounds so no hint is clipped.

### Atomic layout publication

The mobile playtest exposed a brief visual flicker while container sizes/positions and fitted hint typography were being recalculated. v2.29.4 adds a browser-level paint freeze: the previous fully rendered frame remains visible while the new IDEA/VOTE layout settles, then the new layout is committed in one paint. This is intentionally analogous to VBA `Application.ScreenUpdating = False`.

Do not remove this transaction or move phase timers ahead of it; timers start only after the stable frame is visible.

### VOTE must reuse the exact same hint geometry

The user compared IDEA and VOTE side by side and noticed the VOTE layout had re-measured itself after the keyboard closed.

That is incorrect.

The IDEA/keyboard stage top + height must be frozen and reused for:
- VOTE
- submitted state
- correct/wrong feedback

All space below that frozen hint stage belongs to the interaction/result container.

Latest patch v2.29.0 changed `freezeCurrentHintStage()` so existing keyboard geometry wins over a fresh post-keyboard measurement.

This latest geometry patch still needs explicit user regression testing after the handover.

## 10. Native Android keyboard lessons

A Samsung keyboard accessory ribbon with icons (key/card/location) appeared on the **first Hint 1 focus of the first term**.

The layout was flexible enough to survive it, but the ribbon was undesirable.

Fix that worked in playtest:
- remove native HTML `autofocus`,
- use one controlled JS focus path,
- `autocomplete="off"`,
- `autocorrect="off"`,
- `spellcheck="false"`,
- use `visualViewport` and settle measurements after focus.

The ribbon disappeared after this change.

Do not reintroduce native autofocus without testing the first focus of a fresh session/PWA.

The input requests uppercase-oriented keyboard entry through `autocapitalize="characters"`. This is presentation only; validation must never depend on case.

## 11. IDEA screen

The user likes the current compact screen.

**Container canon:** IDEA is now the source of truth for DNA page-level container styling. VOTE, submitted/feedback, Reveal, Ranking and Merge must not introduce alternate page-level surface styles. Released hint cards keep the exact IDEA border/background/radius and the same inner padding when the keyboard closes.

Key requirements:
- current released hint(s) above,
- input + `IDEE SPEICHERN` side by side,
- `KEINE IDEE` below,
- all remain above keyboard,
- hint text never clips,
- small copy such as `GEHEIM · NUR DU` is its own line/region and must not collide with primary text.

## 12. VOTE screen

The hint area remains in **exactly the same location and height** as IDEA.

The lower region becomes the Team Answer container.

Current practical maximum: 3 options.

Cards should be comfortably large; user explicitly asked to use the available space rather than tiny legacy cards.

v2.29.0 refinement after side-by-side playtest:
- keep the larger VOTE containers,
- reduce the VOTE typography from the oversized v2.27 values,
- keep the hint text at the same keyboard/IDEA scale after the keyboard closes,
- no visible type jump between IDEA and VOTE.

Vote card selection uses glow.

Consensus state text remains near the actions at the bottom.

## 13. Evaluation feedback

After a submitted answer:
- hint stage stays exactly where it was,
- the complete lower region becomes a large feedback surface,
- correct and wrong feedback should visually fill that lower area,
- the old large red/green feedback treatment was explicitly preferred.

Opponent solve banner:
- may show `TEAM <COLOR> HAT GELÖST · +X`,
- never reveals the opponent answer.

## 14. Reveal screen

Reveal is no-scroll.

Top answer card:
- label `DIE LÖSUNG`,
- canonical answer large,
- long/two-line answers must not overlap,
- regression test with `Vereinigte Arabische Emirate`.

Below:
- teams appear as one vertical list, not a 2×2 grid,
- order = term score descending,
- tie display order = Blue → Red → Yellow → Green identity slots,
- Core 2 uses the equivalent mapped identity colors,
- team name and score use the same strong visual type scale,
- team name uses normal high-contrast foreground text, not muted gray,
- each row has a vertical team-color accent.

## 15. Between-term countdown

After Reveal, before next IDEA:

`RUNDE X/Y`
then category
then:
`3`
`2`
`1`

The round number is above the category.

Category is large and centered.

Countdown number is centered horizontally and vertically in the active viewport.

One-second ticks are literal; do not apply the global slow-motion scale.

No countdown after final term.

## 16. Answer evaluation — hard-learned rules

Validation is server authoritative.

It must tolerate obvious representation differences:
- case / Caps Lock,
- Unicode / diacritics,
- punctuation,
- separators,
- whitespace,
- omitted spaces in compact comparisons.

Examples observed in playtest that must be handled:
- `USB` must equal `USB`,
- `SPAGHETTI CARBONARA` must equal `Spaghetti Carbonara`,
- `TRUMAN SHOW` and `TRUMANSHOW` should resolve to `The Truman Show` when unambiguous,
- `Micheal Jackson` should count for `Michael Jackson`,
- `Breath of the Wild` / `Zelda Breath of the Wild` should count for `The Legend of Zelda: Breath of the Wild`,
- `Red Dead Redemption` may count for `Red Dead Redemption 2` when the intended title is unambiguous in context.

Typo/fuzzy baseline:
- approximately 90% normalized similarity,
- one edit/transposition accepted for normalized strings >=5 chars,
- longer strings may tolerate two small edits while similarity remains high.

Known alternate language/original titles should be explicit aliases:
- e.g. `Back to the Future` for `Zurück in die Zukunft`.

Profession aliases:
- unambiguous domain/institution/trade terms count:
  - Polizei → Polizist
  - Feuerwehr → Feuerwehrmann
  - Mechatronik → Mechatroniker
  - Journalismus → Journalist
  - Psychologie → Psychologe
  - Tischlerei → Tischler
- broad ambiguous fields are not automatically accepted.

Whenever aliases are added, rerun answer-leak QA against all hints.

## 17. Backend / database baseline

Supabase project:
`rlppuqjolkrwumrrjajq`

DNA attaches to existing generic game/session architecture.

Public DNA tables:
- `public.dna_categories`
- `public.dna_sessions`
- `public.dna_session_categories`
- `public.dna_public_solves`
- `public.dna_reveals`

Private/protected:
- `private.dna_terms`
- `private.dna_hints`
- `private.dna_answer_aliases`
- `private.dna_session_terms`
- `private.dna_player_ideas`
- `private.dna_player_votes`
- `private.dna_team_submissions`

Content seed helper:
`private.seed_dna_content(jsonb)` (service-role restricted).

Critical secrecy rule:
clients must not receive canonical answer, aliases, future hints or unreleased content before Reveal.

## 18. Content pool baseline

Current development pool:
- 390 ACTIVE terms
- 1,170 hints
- 248 aliases
- 30 ACTIVE terms in each of 13 categories
- exactly three hints per term

Categories:
- Länder
- Städte
- Tiere
- Filme
- Automarken
- Unternehmen
- Fußballvereine
- Essen & Gerichte
- Technologie
- Berufe
- Videospiele
- Historische Personen
- Musik

Prior QA reached:
- no malformed 3-hint structures,
- no canonical answer leaks,
- no alias leaks after corrections,
- no hints above the 22-word target in the seeded development set,
- review/source metadata complete.

The pool is suitable for development/playtesting. Before production publication, unusual claims should receive stronger editorial/source verification.

## 19. Content contract essentials

Hints are:
- H1 VERY_HARD
- H2 HARD
- H3 MEDIUM

Progression must be:
`broad → narrower → clear`

Difficulty comes from information amount, not misleading wording.

A single early hint may be ambiguous; all three together may not remain materially ambiguous.

Mobile wording target: roughly 8–22 words, concise German.

Do not leak canonical answers or accepted aliases in hints.

Familiarity metadata:
- MAINSTREAM
- KNOWN
- NICHE

Term difficulty metadata:
- EASY
- NORMAL
- HARD

## 20. End Game / Merge — use templates, do not improvise

The canonical sources are:
- `docs/END_GAME_MERGE_TEMPLATE.html`
- `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`

Current placement points:
1st +5
2nd +4
3rd +2
4th +0

Game Ranking:
- vertical team accents,
- no old center axis line,
- no `PTS` suffix,
- result table remains unchanged for 2 seconds,
- placement +points then appear bottom → top,
- button: `WEITER ZUR TURNIERTABELLE`.

Merge:
- table persists as the same visible object,
- do not blank/re-render,
- third header becomes `PUNKTE`,
- former placement column initially has no heading,
- existing points visible,
- +X remains on right,
- +X morphs right → left into existing points,
- avoid numeric collision,
- +X fades,
- summed score appears and pulses,
- only then `BEWEGUNG` heading,
- row reorder is physical slot swapping, never blink/teleport,
- DOM order changes after visual arrival,
- movement values are calculated only after final DOM order,
- movement cells remain empty until reorder finished,
- then ↑N / ↓N / —,
- confetti last, in new leader team color,
- confetti is a longer rain with waves over time, not merely more particles in one burst.

Movement bug lesson:
never infer movement only from a points sort before the DOM reorder. Capture before positions from the actual DOM, perform the swap, then derive after positions from the resulting DOM.

## 21. Motion baseline

Current approved baseline:
`MOTION_SCALE = 3.0625`

This came from two separate requests to make the appear/morph choreography 1.75× slower.

The desired feeling is sequential and readable:
- not everything at once,
- semantic pauses between stages,
- no flashing,
- no disappearing table,
- no teleport reorder.

The animation style template is binding for future work.

## 22. Team identity / colors

Core:
- Blue #1515FF
- Red #FF1717
- Yellow #F2B705
- Green #00A65A

Core 2 identity mapping:
- Blue → #2979FF
- Red → #FF1744
- Yellow slot → #00F5D4
- Green slot → #FF2ED1

Tie display order still follows identity slots:
Blue → Red → Yellow → Green.

### Hint typography lock refinement

Side-by-side testing showed that matching outer geometry alone was insufficient: the same Hint 1 could still appear larger in VOTE than in IDEA, and even the IDEA version could visually crowd the bottom border (for example the descender in "Raumfahrtgeschichte").

Approved fix:
- capture the fitted IDEA font size + line-height per released hint while the native keyboard is open,
- reuse that exact type scale after the keyboard closes,
- VOTE/feedback may shrink further if required but must never grow,
- keyboard and pinned phases use the same inner hint-card padding,
- fitting includes an additional bottom safety reserve so descenders never visually touch the rounded border.

This is now part of the binding geometry contract, not a cosmetic preference.

## 23. Latest implementation state / regression checklist

Latest standalone baseline:
- `public/dna-test/app.js`
- `public/dna-test/style.css`
- `public/dna-test/index.html`
- standalone version v2.29.0
- latest gameplay commit at handover: `c4a0d2330a73028f081c64f1a1b97f05102652e1`

The latest patch specifically addressed:
1. VOTE hint geometry reuses keyboard/IDEA geometry,
2. VOTE keeps the large containers but uses the exact fitted IDEA hint type scale,
3. pinned hint typography never grows when the keyboard closes,
4. hint fitting reserves extra visual bottom space so descenders cannot touch the container border.

This patch should be playtested side-by-side against IDEA before further layout changes.

Regression tests to run before any refactor:
1. Fresh Android session: first Hint 1 focus has no key/card/location accessory ribbon.
2. H1 IDEA vs H1 VOTE side-by-side: hint stage top and height identical.
3. H2/H3: each hint remains in its own equal 1/3 slot.
4. Long hint text does not clip with keyboard open.
5. VOTE candidate cards/typography fit and remain readable.
6. Long Reveal answer (e.g. Vereinigte Arabische Emirate) has no line overlap.
7. Exact uppercase answers still validate.
8. Compact title spacing (`TRUMANSHOW`) validates.
9. English/original title aliases validate.
10. Endgame table never disappears before/after shuffle.
11. Movement arrows are derived from actual post-reorder DOM positions.
12. Confetti begins only after movement values and uses winner team color.
13. Setup/Ready remain scrollable; gameplay/Reveal remain no-scroll.
14. Test all available Themes via standalone dropdown against Theme Contract.

## 24. Development workflow expectations

The user expects direct implementation in the repository rather than pasted code snippets when asking to “umsetzen”.

After GitHub changes:
- push to `main` when explicitly implementing the tested standalone,
- check the GitHub Actions deploy run,
- do not assume success because the commit exists,
- repeated deploy failures have occurred during this project, so verify workflow status when relevant.

Do not rewrite or delete content/questions unless the user explicitly asks; many visual/gameplay tasks are meant to leave the content pool untouched.

## 25. What DNA is becoming

The user currently considers DNA the best Skielsen visual game design so far.

The intent is:
1. finish DNA down to small interaction details,
2. freeze the final DNA design/mechanics patterns,
3. then update shared game contracts so existing and future games can reuse the strongest parts.

Therefore preserve approved DNA behavior carefully and treat visual regressions as contract regressions, not cosmetic differences.
