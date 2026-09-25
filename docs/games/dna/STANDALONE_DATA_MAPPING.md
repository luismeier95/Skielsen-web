# SKIELSEN DNA — Standalone Data Mapping

**Status:** Approved for standalone playtest  
**Date:** 2026-09-24  
**Game key:** `dna`  
**Route:** `/dna-test/`

This document maps the DNA standalone UI to the production data model. It exists to prevent mock/test state from becoming an accidental production source of truth.

| UI / state | Standalone source | Production source | Authority | Fallback |
|---|---|---|---|---|
| Category list | Client list matching active catalog | `public.dna_categories` | Catalog / server | None |
| Selected categories | Setup state | `public.dna_session_categories` | Session server | Countries only in standalone if empty |
| Term count | Setup state (5/10/15) | `public.dna_sessions.term_count` | Session server | 5 |
| Content mix | Setup state | term selection policy using `familiarity_tier` / `term_difficulty` | Server | BALANCED |
| Selected terms | Encrypted Edge Function state | `private.dna_session_terms` | Server | None |
| Current term | Edge Function response | `public.dna_sessions.current_term_no` | Server | None |
| Current hint number | Edge Function response | `public.dna_sessions.current_hint_no` | Server | None |
| Current hint text | Edge Function response, current hint only | `private.dna_hints` via authorized game API | Server | None |
| Future hints | Never sent to browser | `private.dna_hints` | Server only | None |
| Canonical answer | Returned only in REVEAL state | `private.dna_terms.canonical_answer` | Server only until reveal | None |
| Accepted aliases | Never sent to browser | `private.dna_answer_aliases` | Server only | None |
| Player idea | Local standalone simulation for RED team | `private.dna_player_ideas` | Production server | No idea |
| Team vote | Local standalone simulation for RED team | `private.dna_player_votes` | Production server | No answer |
| Team submit | Edge Function action | `private.dna_team_submissions` | Server | No answer at deadline |
| Correctness | Edge Function database validation | canonical answer + aliases | Server | Never client-evaluated |
| Wrong-answer penalty | Edge Function state | `public.dna_sessions.wrong_penalty` | Server | -1 |
| Hint points | Edge Function response | `private.dna_hints.points_value` / session rules | Server | +3 / +2 / +1 |
| Phase timer | IDEA 20 s / VOTE 10 s standalone visual timer | `phase_started_at` / `phase_deadline_at` | Production server | Contract defaults: IDEA 20 s, VOTE 10 s |
| Scroll scope | Client page state | shared game surface state | Client layout contract | No-scroll only for GAME / REVEAL |
| Setup / Ready scroll indicator | Current page controls + document scroll extent / visual viewport | Standalone UI only | Client layout | Hidden when page fits or bottom is reached; absent from other pages |
| Header category | current content category | session/current term category | Server content + client layout | Large, centered in active header |
| Reveal team order | current term net scores + identity slot order | authoritative term score aggregate | Server score / client display sort | score desc, tie Blue → Red → Yellow → Green |
| Team row accent | team identity slot / theme mapping | tournament participant identity | Theme/identity contract | vertical accent; no center axis |
| Early phase completion | Standalone simulated participant readiness | authoritative completion of required actors | Production server | Deadline |
| Opponent correct solve | Edge Function returns team + points only | `public.dna_public_solves` | Server | Hidden until event |
| Opponent wrong attempt | Never returned | private submission state | Server only | Hidden |
| Reveal term score | Edge Function response | authoritative per-term score aggregate | Server | 0 |
| Final DNA score | Edge Function response | authoritative game result | Server | 0 |
| Placement points | Standalone project rule 5 / 4 / 2 / 0 | tournament scoring profile | Tournament engine | None |
| Existing tournament score | Standalone fixture only | tournament ranking / result tables | Tournament engine | Never use fixture in production |
| End-game merge | Standalone animation fixture | canonical Skielsen merge workflow | Tournament engine | None |

## Standalone-only simulation

The standalone intentionally simulates the second RED team member and the three opposing teams so the full IDEA → VOTE → SUBMIT → REVEAL → RANKING → MERGE flow can be tested from one browser.

These fixtures are **not production sources**:

- teammate suggestion selection,
- teammate vote timing,
- opponent answer timing,
- opponent probability model,
- existing tournament scores shown before merge,
- player display names used in the standalone.

The production integration must replace these fixtures with real tournament members, participant membership and realtime/server state.

## Security boundary

The browser must never receive before reveal:

- canonical answer,
- accepted aliases,
- future hints,
- opponent private ideas,
- opponent votes,
- opponent wrong answers.

The standalone Edge Function stores selected term IDs and score state in an encrypted opaque token. The client receives only the currently released hint and public solve events.

## Contract references

- `docs/GAME_DESIGN_CONTRACT.md`
- `docs/THEME_CONTRACT.md`
- `docs/games/dna/GAME_CONTRACT_v1.md`
- `docs/games/dna/CONTENT_CONTRACT_v1.md`
