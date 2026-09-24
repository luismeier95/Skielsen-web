# SKIELSEN DNA — Game Contract v1

**Status:** Approved · consolidated playtest state  
**Version:** 1.1  
**Date:** 2026-09-24  
**Game key:** `dna`  
**Platform:** Mobile-first, individual devices  
**Authority:** Server-authoritative

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

- left: SKIELSEN identity / DNA,
- center: **current category**, visibly larger and horizontally centered,
- right: phase and compact secondary progress/score information.

The category must remain visually dominant enough to be recognized at a glance.

### Timer

Progress and time are separate channels.

- overall game progress: directly below the header,
- phase timer: separate horizontal countdown bar,
- IDEA: maximum **20 seconds**,
- VOTE: maximum **10 seconds**,
- timer width must continuously decrease to zero,
- warning/danger colors may change near the deadline but must not replace the countdown movement.

### Hint area

The hint container uses content-driven height within the available viewport.

Rules:

- the complete current hint must remain visible,
- text must never be clipped at the bottom,
- typography may scale within defined mobile bounds before clipping is allowed,
- previous hints remain visible in compressed form outside keyboard-minimal mode,
- only the current hint receives dominant visual treatment.

### Keyboard state

When the native mobile keyboard opens:

- the layout is based on the resized visual viewport,
- the interaction controls are docked above the actual keyboard inset,
- the input,
- `IDEE SPEICHERN`,
- and `KEINE IDEE`

must remain visible and usable.

Secondary history may be hidden in keyboard mode.

### Interaction copy

Primary state text and its explanatory small copy are separate block rows.

Small explanatory copy must never be placed inline after the main state text.

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

Previous hints remain visible in compressed form.

## 13. Reveal

After Hint 3, the canonical answer becomes visible to all players.

Reveal is part of the active no-scroll game surface.

### Reveal header

The current category is shown **large and centered in the game banner/header**.

`REVEAL` remains a secondary phase label.

### Answer

The canonical answer is the primary reveal element.

### Per-term team ranking

The reveal shows every team's **net score for the current term** in one vertical list.

Reveal row appear animations and merge morph/reorder animations run at approximately **175% of the previous timing** to improve readability.

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

## 14. New term

At the start of every new term:

- all teams re-enter,
- `SOLVED` is reset,
- all per-term vote/idea states reset,
- the next term begins at Hint 1,
- cumulative game scores remain.

## 15. Ready page

Before gameplay, the standard Skielsen Ready Page is shown.

Minimum rule summary:

`3 Hinweise · +3 / +2 / +1 · Falsch -1`

Players confirm with:

`ICH BIN BEREIT`

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
- ignore punctuation/separator differences.

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
- Active header shows the current category large and centered.
- Current hint text must never clip.
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
