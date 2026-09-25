# SKIELSEN DNA — Game Contract v1

**Status:** Approved · consolidated playtest state  
**Version:** 1.4  
**Date:** 2026-09-25  
**Game key:** `dna`  
**Platform:** Mobile-first, individual devices  
**Authority:** Server-authoritative

## 0. Mandatory implementation protocol

This contract is **binding** for DNA.

Every agent or developer changing DNA must consult, before implementation:

1. `docs/games/dna/GAME_CONTRACT_v1.md`
2. `docs/games/dna/CONTENT_CONTRACT_v1.md`
3. `docs/GAME_DESIGN_CONTRACT.md`
4. `docs/THEME_CONTRACT.md`
5. `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`
6. `docs/END_GAME_MERGE_TEMPLATE.html`
7. `docs/games/dna/STANDALONE_DATA_MAPPING.md`
8. `docs/games/dna/AGENT_START_HERE.md`

Rules:

- Do not implement a DNA change from memory alone.
- Do not silently override a contract because the current DOM/CSS happens to behave differently.
- If a new explicit user decision conflicts with a contract, the new decision wins, but the affected contract must be updated in the same change set so documentation and implementation do not drift.
- The DNA standalone is the current visual/playtest reference implementation; the contracts remain the semantic source of truth.
- Global contracts are not to be rewritten merely because DNA is being tested. DNA is the candidate reference for future games, and global contract changes happen only after deliberate approval.

## 1. Game principle

DNA is a mobile team quiz. Each term has exactly three hints that become progressively easier.

Scoring per hint:

| Hint | Difficulty | Correct | Wrong |
|---|---|---:|---:|
| 1 | VERY HARD | +3 | -1 |
| 2 | HARD | +2 | -1 |
| 3 | MEDIUM | +1 | -1 |

After Hint 3, the answer is revealed publicly.

A team that answers correctly is finished for the current term. All teams re-enter for the next term.

## 2. Mobile layout contract

DNA is mobile-first.

### Page scroll scope

The **No Scroll Rule applies only to active gameplay and Reveal**.

These states/pages may scroll normally:

- Setup / category selection,
- Ready,
- Game Ranking,
- Joker Resolution,
- Tournament Merge.

Active gameplay and Reveal must fit in the currently visible smartphone viewport without vertical scrolling.

### Active game viewport

DNA may bypass the normal Skielsen top-banner / tournament-chrome reserve and use the full visible viewport available to the game.

The active screen uses these zones:

1. compact game header,
2. overall progress directly below the header,
3. separate mechanic timer bar,
4. hint area,
5. interaction area.

No duplicate status card is used inside gameplay.

The header is the single status source.

### Header information hierarchy

On active gameplay and Reveal:

- left: SKIELSEN logo, then approximately 30 px optical gap, then `DNA`,
- standalone QA only: Theme selector directly after the game name,
- right: **current game state only** such as `IDEE`, `ABSTIMMUNG`, `REVEAL`,
- no secondary category / score / round metadata in the active header.

The SKIELSEN logo keeps its aspect ratio and is enlarged to use the available banner height without distortion.

The standalone Theme selector is a QA control and is expected to disappear from the integrated full-version chrome.

### Timer

Progress and time are separate channels.

- overall game progress: directly below the header,
- phase timer: separate horizontal countdown bar,
- IDEA: maximum **20 seconds**,
- VOTE: maximum **10 seconds**,
- timer width must continuously decrease to zero,
- warning/danger colors may change near the deadline but must not replace the countdown movement.

### Hint area

The hint stage is a persistent geometric region between the mechanic timer and the interaction region.

Rules:

- the stage is divided into **three equal vertical tracks**,
- Hint 1 always owns track 1, Hint 2 track 2, Hint 3 track 3,
- every released hint has its **own rounded container**,
- unreleased tracks remain intentionally empty/hidden rather than letting released hints grow into them,
- with one released hint, its card occupies one third of the stage,
- with two released hints, each occupies one third and the third track remains empty,
- with three released hints, all three occupy exactly one third,
- all released hints retain the same visual hierarchy; previous hints are not collapsed into pills,
- the complete hint text must remain visible,
- text must never be clipped at the bottom,
- typography may scale within defined mobile bounds before clipping is allowed,
- glyph descenders and final line boxes must retain a visible safety inset from the rounded container border; a technically non-overflowing line that visually touches the border is still considered a layout failure.

### Phase geometry lock

The hint stage position and height established in IDEA while the native keyboard is open are authoritative for the remainder of that hint.

When IDEA transitions to VOTE or to evaluation feedback:

- the hint stage must remain at the **exact same top position**,
- the hint stage must retain the **exact same height**,
- the three 1/3 tracks must retain the same height,
- the app must not re-measure the stage from the larger post-keyboard viewport and make the hints jump,
- IDEA also establishes the fitted hint typography (font size and line-height) for each released hint; VOTE and feedback must reuse that scale exactly or shrink it further for safety, never enlarge it after the keyboard closes,
- keyboard and pinned phases must use the same hint-card inner padding so a phase transition cannot change the available text box,
- all space below the frozen hint stage becomes the VOTE / submitted / RICHTIG-FALSCH interaction region.

This geometry lock is a visual non-negotiable because IDEA and VOTE are intended to feel like one continuous screen rather than two different layouts.

### Keyboard state

When the native mobile keyboard opens:

- the layout is based on the resized `visualViewport` / actually visible viewport,
- the interaction controls are docked above the real keyboard edge,
- the input, `IDEE SPEICHERN`, and `KEINE IDEE` remain visible and usable,
- the hint stage flexes to the remaining viewport and then becomes the frozen geometry for VOTE/evaluation,
- input uses uppercase-oriented native entry (`autocapitalize="characters"`) as a presentation aid only; answer validation stays case-insensitive,
- native HTML `autofocus` is not used.

A Samsung/Android keyboard accessory ribbon (for example key/card/location icons) appeared specifically on the first input focus of the first term. Removing native autofocus and using the controlled JS focus path eliminated it in playtest. Do not reintroduce native autofocus without regression testing the first Hint 1 focus.

### Interaction copy

Primary state text and its explanatory small copy are separate block rows.

Small explanatory copy must never be placed inline after the main state text.

### Canonical container style

The **IDEA screen is the visual source of truth for DNA containers**.

All page-level DNA surfaces must reuse the IDEA container treatment:
- 1px Theme Contract border,
- outer DNA radius,
- Theme Contract surface background,
- normal on-surface text,
- no page-specific decorative shadow.

This applies to the gameplay interaction surface, released hint cards, Reveal answer surface, Reveal team result cards, Game Ranking outer card and Tournament Merge outer card.

For released hint cards, IDEA is authoritative for both outer styling **and inner padding**. VOTE, submitted state and evaluation feedback must reuse the same hint-card padding after the keyboard closes; a phase change must not visibly restyle the container.

Intentional exceptions are semantic or nested controls rather than page-level containers: selectable VOTE options, buttons/inputs, participant rows, and the green/red feedback fill may keep their specific interaction/semantic treatment while still using Theme Contract tokens.

## 3. Team model

DNA is a team game. Every player uses an individual device.

Current Skielsen team configuration is two players per team.

During Phase 1, player ideas are private and cannot be seen by teammates or opponents.

During Phase 2, ideas become visible only within the player's own team.

Opponent teams must never receive another team's ideas, votes, wrong answers, or submitted answer text before the public reveal.

### Future teams with more than two players

For teams with more than two players, consensus means **simple majority**.

Examples:

- 3 players: 2 matching votes are sufficient.
- 4 players: 3 matching votes are sufficient.
- A tie is not consensus.
- Without a majority, Submit remains disabled.

For the current two-player team model, both players must select the same option.

## 4. Term structure

Each term contains exactly:

- one canonical answer,
- three hints,
- optional accepted aliases.

Hint sequence:

`VERY_HARD → HARD → MEDIUM`

Points:

`3 → 2 → 1`

## 5. Hint lifecycle

Every hint consists of exactly two gameplay phases:

`IDEA → VOTE`

Phase 1 (IDEA) has a maximum duration of 20 seconds. Phase 2 (VOTE) has a maximum duration of 10 seconds.

A phase ends early when all required actors have explicitly completed it.

The server is authoritative for phase deadlines and transitions.

## 6. Phase 1 — IDEA

Maximum duration: **20 seconds**.

Each active player may submit one private idea on their own device.

A player may alternatively choose:

`KEINE IDEE`

During this phase:

- only the player's own idea is visible,
- teammates do not see the idea yet,
- opponents receive no information about the idea,
- the player may edit the idea until they complete Phase 1.

A player is complete when they either:

- confirm an idea, or
- choose `KEINE IDEE`.

When all required active players are complete, Phase 1 ends immediately.

If the timer reaches zero, every player who has not completed the phase is treated as `KEINE IDEE`.

The game then automatically enters Phase 2.

## 7. Phase 2 — VOTE

Maximum duration: **10 seconds**.

All submitted Phase 1 ideas from the current team become visible to that team.

Identical or normalized-identical ideas are merged into one answer card.

Example:

`KASACHSTAN — Spieler A · Spieler B`

The option `KEINE ANTWORT` is always available.

Each player has one active vote and can change their vote freely until the team submits.

Tapping answer cards never submits an answer automatically.

## 8. Consensus and Submit

Submit is intentionally separate from voting.

For the current two-player model, consensus exists only when both players have selected the same option.

Once consensus exists:

- the `ANTWORT ABSENDEN` button becomes enabled on every device in that team,
- any one team member may press Submit,
- only one successful Submit is required for the entire team.

Consensus alone must never automatically submit the answer.

This protects against accidental or nervous/fidget tapping, especially for first-time players.

No Hold-to-Confirm is required. The separate Submit action is the confirmation mechanism.

After the first successful Submit:

- the team answer becomes final,
- all team devices immediately enter the submitted state,
- further Submit requests are idempotently ignored,
- votes can no longer be changed.

## 9. Phase 2 completion

A team is complete for Phase 2 when it has submitted either:

- an answer, or
- `KEINE ANTWORT`.

When all active teams are complete, the phase ends immediately.

If the 10-second timer expires without a valid team Submit, the team is treated as:

`KEINE ANTWORT`

Result: **0 points**, no penalty.

## 10. Evaluation

Evaluation is server-side.

### Correct

The team receives the current hint value:

- Hint 1: +3
- Hint 2: +2
- Hint 3: +1

The team receives state:

`SOLVED`

and no longer participates in later hints for that term.

### Wrong

The team receives:

`-1`

The team cannot submit another answer during the same hint.

It becomes active again for the next hint.

### No answer

The team receives:

`0`

and becomes active again for the next hint.

## 11. Visibility after evaluation

### Correct answer

The solving team sees its own submitted answer and:

`RICHTIG · +X`

Other teams only see:

`TEAM <COLOR> HAT GELÖST · +X`

They do **not** see:

- the submitted answer,
- the canonical solution,
- the team's prior ideas,
- the team's votes.

### Wrong answer

Only the submitting team sees:

`FALSCH · -1`

Opponents receive no information that a wrong answer occurred and never receive the wrong answer text.

## 12. Progression through hints

Only teams that have not solved the term remain active.

After Hint 1:

`IDEA 1 → VOTE 1 → EVALUATE → IDEA 2`

After Hint 2:

`IDEA 2 → VOTE 2 → EVALUATE → IDEA 3`

After Hint 3:

`IDEA 3 → VOTE 3 → EVALUATE → REVEAL`

All released hints remain visible in their own persistent 1/3 hint containers.

## 13. Reveal

After Hint 3, the canonical answer becomes visible to all players.

Reveal is part of the active no-scroll game surface.

### Reveal header

The active header keeps the same compact chrome used during gameplay.

- right side shows `REVEAL`,
- no extra category/score metadata is added to the header.

The category is used on the between-term countdown screen instead.

### Answer

The canonical answer is the primary reveal element.

### Per-term team ranking

The reveal shows every team's **net score for the current term** in one vertical list.

Reveal / merge motion follows the locked animation template in `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`. The current global motion baseline is `MOTION_SCALE = 3.0625` (two approved 1.75× slow-down passes from the earlier baseline).

Cards are ordered by term score descending.

For equal term scores, the fixed visual tie order is:

1. Blue identity slot
2. Red identity slot
3. Yellow identity slot
4. Green identity slot

For Skielsen Core this corresponds to:

`Blau → Rot → Gelb → Grün`

For Skielsen Core 2 the same identity slots are used with their mapped colors:

`#2979FF → #FF1744 → #00F5D4 → #FF2ED1`

This tie order is a **Reveal display ordering rule**, not a replacement for any separate tournament/game-ranking tiebreak logic.

Each team row/card uses its vertical participant/team color accent.

Reveal team score typography is intentionally larger than the prior standalone version so the between-term score table remains readable at a glance.

Example net score:

- H1 wrong: -1
- H2 wrong: -1
- H3 correct: +1
- term result: **-1**

The reveal must not require admin interaction to continue normal gameplay.

After the reveal, the next term starts automatically.

### Between-term countdown

After the reveal score list and before the next term, DNA shows a dedicated no-scroll countdown screen.

Information order:

1. `RUNDE X / Y`
2. current/next category
3. countdown number

The category is large and centered. The countdown number is centered horizontally and vertically in the active viewport.

Sequence:

`3 → 2 → 1 → next IDEA`

The semantic ticks remain exactly one second each and are **not** multiplied by the global motion scale.

The countdown is omitted after the final term.

## 14. New term

At the start of every new term:

- all teams re-enter,
- `SOLVED` is reset,
- all per-term vote/idea states reset,
- the next term begins at Hint 1,
- cumulative game scores remain.

## 15. Ready page

Before gameplay, the standard Skielsen Ready Page is shown and may scroll normally.

The four rule boxes are visually symmetric and their contents are centered.

Minimum rule summary:

- `+3` — Hint 1 / very hard
- `+2 / +1` — Hint 2 / 3
- `-1` — wrong team answer
- `20s + 10s` — IDEA → VOTE

Players confirm with:

`ICH BIN BEREIT`

### Blocking-action glow

Buttons that intentionally block game progression until a human decision is made use the pulsing accent glow language.

Examples:

- `WEITER` from Setup,
- `ICH BIN BEREIT`,
- `SPIEL STARTEN`,
- `TABELLE ANZEIGEN` / equivalent required continuation actions.

Controls that are **not mandatory** because the timer can advance the game automatically do not receive the blocking pulse.

Examples:

- `AUSWAHL LÖSEN`,
- `ANTWORT ABSENDEN`.

Selectable options (category cards, choice cards, vote cards, Theme QA selector) use the non-pulsing selection/focus glow when selected or focused.

## 16. State model

### Session phase

`READY`  
`IDEA`  
`VOTE`  
`EVALUATE`  
`REVEAL`  
`COMPLETE`

### Team/participant state per term

`ACTIVE`  
`WAITING_FOR_TEAM`  
`SUBMITTED`  
`WRONG`  
`NO_ANSWER`  
`SOLVED`

### Player state — IDEA

`THINKING → IDEA_SUBMITTED`

or:

`THINKING → SKIPPED`

### Player state — VOTE

`UNDECIDED → VOTED → TEAM_SUBMITTED`

Votes remain changeable until the team Submit succeeds.

## 17. Automatic phase transitions

A phase ends on either:

`ALL_REQUIRED_ACTORS_COMPLETE`

or:

`DEADLINE_REACHED`

Clients must not independently advance the authoritative game state.

A team that already has `SOLVED` must never block later phase transitions for the current term.

## 18. Race conditions and idempotency

Multiple teammates may press Submit nearly simultaneously.

Server rule:

**First valid Submit wins.**

Subsequent requests for the same:

`session + term + hint + participant`

must be handled idempotently and must never produce duplicate points or duplicate submissions.

## 19. Answer validation

Answer validation is server-side.

Validation order:

1. canonical answer / explicit accepted alias,
2. normalized exact comparison,
3. typo-tolerant fuzzy comparison,
4. substantial title/name-fragment comparison for long multi-word answers.

Normalization includes:

- case-insensitive comparison,
- Unicode normalization,
- removal of diacritics for comparison,
- trim leading/trailing spaces,
- collapse repeated spaces,
- ignore punctuation/separator differences,
- a compact comparison form that removes spaces/separators entirely,
- for titles, optional omission of a leading article when the remaining title is still unambiguous.

Examples that must not fail only because of presentation differences:

- `USB` ↔ `usb`
- `SPAGHETTI CARBONARA` ↔ `Spaghetti Carbonara`
- `TRUMAN SHOW` / `TRUMANSHOW` → `The Truman Show` when the title match is otherwise unambiguous.

### Typo tolerance

A near-identical answer is accepted when normalized similarity is approximately **90% or higher**.

Additionally, a single edit/transposition is accepted for normalized answers of at least five characters. For longer answers, up to two small edit errors may be accepted when the remaining similarity is still high.

This prevents obvious intended answers from failing only because of a minor typo.

This explicitly covers obvious misspellings / transpositions such as:

- `Micheal Jackson` → `Michael Jackson`

### Long title / name fragments

For long multi-word titles or names, a substantial contained fragment may be accepted when it is clearly specific enough to identify the intended answer.

Examples:

- `Breath of the Wild` → `The Legend of Zelda: Breath of the Wild`
- `Zelda Breath of the Wild` → `The Legend of Zelda: Breath of the Wild`
- `Red Dead Redemption` → `Red Dead Redemption 2`

Very short or generic fragments must still be rejected.

Example:

- `Legend of Zelda` alone is not automatically sufficient for `The Legend of Zelda: Breath of the Wild`.

Explicit aliases remain the preferred content-level mechanism for known variants. Fuzzy validation is a fallback and must not expose the canonical answer or aliases to the client.

### Teammate bot behavior

The standalone teammate bot uses the **same server-side answer validation** as final scoring.

If the user's selected answer is recognized as correct by the server, the bot must vote for that answer and must not switch to `KEINE ANTWORT` merely because of spelling variation or a tolerated typo.

## 20. Content secrecy

Before reveal, clients must never receive:

- canonical answer,
- accepted aliases,
- future hints,
- unreleased term content.

Solutions may not merely be hidden in frontend code or UI state.

Private player ideas, team votes, and submitted answer text must remain server-protected and team-scoped.

## 21. Categories

The same DNA engine supports multiple content packs, including:

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

Category content must not require category-specific game-engine logic.

## 22. End game

After the final term:

1. Game Ranking
2. Joker Resolve if Joker is ON
3. Tournament Merge
4. Close Game

DNA returns a final score per participant/team.

Ranking direction:

`HIGHER_IS_BETTER`

### Game Ranking

The final DNA ranking uses these columns:

1. POSITION
2. TEAM
3. DNA
4. unlabeled placement-points column

The placement-points values are shown as:

- `+5`
- `+4`
- `+2`
- `+0`

The literal suffix `PTS` is not shown.

The primary action is:

`WEITER ZUR TURNIERTABELLE`

Before any placement points appear, the final DNA result table remains completely unchanged for **2 seconds**.

Placement points then appear sequentially from the bottom row upward.

### Tournament Merge sequence

The Merge is one staged animation and follows this exact order:

1. The result table transitions to the tournament-points view without changing the visible team rows abruptly.
2. The third column heading becomes `PUNKTE`.
3. The right-most column initially has **no heading**.
4. Existing tournament points are visible in the `PUNKTE` column.
5. The placement plus-points from the previous result view remain visible in the right-most column.
6. The plus-points morph visually from right to left into the existing tournament-points value.
7. The summed tournament-points result replaces the old points value. At the moment the placement bonus reaches the points column, the new summed value performs a short **arrival pulse** (brief scale-up and return) while the `+X` fades out so the two values do not visually overlap.
8. Only now does the right-most column heading `BEWEGUNG` appear.
9. The table reorders to the new tournament placement. The reorder animation must visually **swap/move rows into their new slots**; it must not look like a blink, hide/show, or abrupt re-render.
10. **Only after the reorder animation has fully completed** are the movement-cell contents populated and revealed:
   - `↑ N` for a gain,
   - `↓ N` for a loss,
   - `—` for unchanged position.
11. After the movement contents are visible, confetti is shown in the team color of the new first-place team.

Movement-cell contents must remain empty before step 10. They may not be pre-rendered invisibly as final user-visible content.

The close action remains disabled until the full sequence, including movement reveal and confetti trigger, has completed.

### Ranking / Merge visual identity

Game Ranking and Merge use team rows with a **vertical team-color accent**.

The old semantic center/axis line is not used.

Existing tournament points remain visually distinct from newly earned placement points until the morph step.

## 23. Non-negotiables

- Active gameplay and Reveal without scrolling.
- Setup, Ready, Ranking, Joker Resolution and Merge remain normally scrollable.
- DNA may use the full visible viewport and does not reserve unused space for the normal Skielsen top banner.
- Active header shows only the compact game state on the right; category/score/round metadata are not duplicated there.
- Current hint text must never clip.
- The hint stage is three equal vertical tracks; every released hint has its own container.
- IDEA establishes the hint-stage geometry; VOTE/evaluation reuse it exactly without post-keyboard reflow.
- Vote cards are intentionally large (maximum three options: Idea 1, Idea 2, No Answer), but their typography stays close to the IDEA-screen scale; closing the keyboard must not cause a visible hint-text or vote-text size jump.
- Correct/wrong feedback uses the full lower interaction region while the hint stage remains fixed.
- Native HTML autofocus must remain off unless the first-Hint Android accessory-ribbon regression is retested.
- Blocking progression buttons pulse; timer-optional actions do not.
- Keyboard mode must keep input, `IDEE SPEICHERN` and `KEINE IDEE` visible above the native keyboard.
- Small explanatory state copy always occupies its own line.
- Reveal team list is vertical and sorted by term score descending; ties use Blue → Red → Yellow → Green identity order.
- Result/Merge team rows use vertical team-color accents and no center axis line.
- Individual device per player.
- Two phases per hint.
- Phase 1 (IDEA): 20 seconds maximum.
- Phase 2 (VOTE): 10 seconds maximum.
- Early phase advance when all required actors are complete.
- Phase 1 ideas are private.
- Team ideas are revealed only in Phase 2.
- Voting never auto-submits.
- Consensus/majority is required before Submit.
- Any one teammate may Submit after consensus exists.
- Correct: +3 / +2 / +1.
- Wrong: -1.
- No answer: 0.
- Correct answer remains hidden from opponents until reveal.
- Correct team is finished for the current term.
- Every team re-enters for the next term.
- Server is authoritative.
- Future hints and solutions are never preloaded into readable client state.
