# WORTKETTE · DATABASE CONTRACT

Status: **current production backend contract**

## 1. Canonical identifiers

- Catalog ID: `game.wortkette.compound_nouns`
- In-App game key: `word_chain`
- Module key: `word-chain`

## 2. Server-authoritative lifecycle

1. an In-App Session becomes ACTIVE
2. Tournament Admin selects the session-wide difficulty
3. the first player run creates the common hidden chain under the session lock
4. every additional player run reuses exactly that chain
5. each player owns independent progress, score and timer state
6. guesses are validated server-side
7. live standings are derived from run state
8. finalization writes Tournament Results, Placements, Joker effects and ledger points

## 3. Difficulty snapshot

| Tier | occurrence_threshold | show_word_length |
|---|---:|---|
| EASY | 50 | true |
| NORMAL | 35 | false |
| HARDCORE | 15 | false |

Session state stores:

- `word_chain_difficulty`
- `occurrence_threshold`
- `show_word_length`
- `time_limit_seconds`
- `difficulty_selected_by`
- `difficulty_selected_at`
- `word_chain_rules_version`

Each `word_chain_tournament_runs` row snapshots:

- `difficulty`
- `show_word_length`
- `rules_version`
- `occurrence_threshold`
- `time_limit_seconds`

A difficulty cannot be changed after the first run exists.

## 4. Core tables

### `word_chain_edges`
Canonical graph of allowed compound-noun transitions.

Important concepts:
- base noun
- optional connector / linking suffix
- next noun
- compound word
- occurrence / familiarity metadata
- override flags used by the frequency gate

### `word_chain_solo_sessions`
Per-player chain state:

- hidden chain
- edge IDs
- current position
- score
- wrong counters
- start/completion timestamps

Despite the historic table name, Tournament runs use it as the per-player progression store.

### `word_chain_tournament_runs`
Tournament-facing immutable rule snapshot plus runtime timing/result metadata.

Includes:
- In-App Session
- Tournament Member
- Participant
- linked Word Chain session
- difficulty/rules snapshot
- current word deadline
- completion time
- final score
- final wrong count
- duration

### History / novelty
- `word_chain_player_edge_history`
- `word_chain_player_ngram_history`

These records reduce repeated chains and support novelty weighting.

### Tournament integration
- `in_app_game_sessions`
- `in_app_game_session_players`
- `in_app_game_definitions`
- `tournament_game_participants`
- `tournament_game_results`
- `game_placements`
- `participants`
- `tournament_members`
- `teams`

## 5. Public RPC contract

### `set_word_chain_difficulty(p_session_id, p_tier)`
Admin-only setup RPC.

Guards:
- authenticated user
- Tournament Admin
- Word Chain session
- ACTIVE session
- valid tier
- no existing Word Chain run

### `start_word_chain_tournament_player(p_in_app_session_id)`
Creates or returns the caller's run.

Responsibilities:
- enforce difficulty gate
- create the shared chain only once
- snapshot rules
- initialize the per-player timer

### `get_word_chain_tournament_state(p_in_app_session_id)`
Returns the caller-visible state.

### `submit_word_chain_tournament(p_in_app_session_id, p_guess, p_timeout)`
Authoritative whole-word submit endpoint.

No per-keystroke validation is authoritative.

### `get_word_chain_game_result(p_tournament_game_id)`
Returns the finalized Tournament result and placements when available.

## 6. Client state contract

Production state may expose:

- `step`
- `total_steps`
- `base_word`
- `revealed_prefix`
- `initial_revealed_count`
- `hint_revealed_count`
- `score`
- `wrong_count`
- `current_wrong_count`
- `time_limit_seconds`
- `deadline_at`
- `server_now`
- `ignore_repeated_initial`
- `finished_players`
- `total_players`
- `live_standings`
- difficulty/rules metadata

Only EASY may expose:
- `target_length`

NORMAL and HARDCORE must not return `target_length`.

The hidden target word and future chain are never client-visible during active play.

## 7. Guess semantics

### Correct
- progress advances
- new word deadline is created

### Valid but wrong
- score −1
- one hint letter revealed
- current deadline remains unchanged

### Invalid / validation unavailable
- no score change
- no hint
- no deadline reset

### Timeout
- score −1
- one hint letter revealed
- same word receives a new deadline

### Final hint completes target
- automatic progression

## 8. Live standings

`private.word_chain_live_standings(session_id)` returns all assigned players.

Completed players:
- `rank`
- `score`
- `elapsed_ms`

Unfinished players:
- `rank = null`
- `score = null`

Ordering:
1. completed players
2. score descending
3. elapsed time ascending
4. unfinished players by stable seat order

The client renders unfinished time/score as `–`.

## 9. Final result

Final Participant-level standings contain:

- `participant_id`
- `participant_type`
- `display_name`
- `identity_color`
- `placement`
- `duration_ms`
- `score`
- minus/wrong metadata

Ranking:

1. score descending
2. duration ascending
3. server random draw

Finalization also writes:
- `tournament_game_results`
- `game_placements`
- scoring ledger
- Joker reveal/effects
- In-App Session result

## 10. Client-only values

Never persist:

- input buffer
- accepted/reveal buffer
- keyboard focus
- rendered slot classes
- timer bar width
- responsive layout state
- animation state

## 11. Security

- hidden solution data remains server-side
- the difficulty setter is not executable by `anon`
- authenticated calls still pass Tournament Admin checks where required
- result/placement authority remains server-side

## 12. Frequency audit

The frequency audit is maintained by:

- `tools/score_word_chain_frequency.py`
- `.github/workflows/wortkette-frequency.yml`
- `data/wortkette-frequency-audit.json`

The audit supports catalog quality; it is not client gameplay state.
