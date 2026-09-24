# SKIELSEN DNA — Game Contract v1

**Status:** Approved  
**Version:** 1.0  
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

The complete active gameplay UI must fit on a normal smartphone screen without vertical scrolling.

The active screen consists of four fixed zones:

1. Game header
2. Timer bar
3. Hint area
4. Interaction area

No separate in-game banner is used.

The timer is primarily represented by a horizontal progress bar. Phase 1 (IDEA) has a maximum duration of 20 seconds; Phase 2 (VOTE) has a maximum duration of 10 seconds.

Previous hints stay visible in compressed form. Only the current hint receives the dominant visual treatment.

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

The reveal also shows each participant/team's **net score for that term**.

Example:

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

Minimum normalization:

- case-insensitive comparison,
- trim leading/trailing spaces,
- collapse repeated spaces,
- explicit accepted aliases.

No generic fuzzy matching is used in v1.

Accents, abbreviations, alternative spellings, translations, and naming variants are handled by explicit aliases in the content catalog.

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
3. Standard End Game Merge Animation
4. Merge into Tournament Ranking
5. Close Game

DNA returns a final score per participant/team.

Ranking direction:

`HIGHER_IS_BETTER`

## 23. Non-negotiables

- Mobile gameplay without scrolling.
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
