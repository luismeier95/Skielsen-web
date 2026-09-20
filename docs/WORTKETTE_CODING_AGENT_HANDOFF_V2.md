# WORTKETTE · CODING AGENT HANDOFF V2

## Database Status — Already Applied

Do **not** recreate the V4 schema work from scratch.

Already applied in Supabase:

`20260920191432_prepare_word_chain_v4_integration`

Already available:
- `set_word_chain_difficulty(uuid,text)`
- `word_chain_tournament_runs.difficulty`
- `word_chain_tournament_runs.show_word_length`
- `word_chain_tournament_runs.rules_version`
- V4-aware `start_word_chain_tournament_player`
- V4-aware `private.word_chain_tournament_state`
- enriched V4 final result metadata and Participant-level display data

Compatibility switch is intentionally still OFF:

`in_app_game_definitions.config_json.require_difficulty_selection = false`

The frontend integration must activate the V4 setup contract for **new sessions** only when the new Difficulty UI is deployed. Do not rewrite historical V3 runs.

## Mission

Integriere die aktuelle Contract-Testversion von `/word-chain-test/` in die bestehende SKIELSEN-Vollversion.

**Nicht** als neues Parallelgame bauen.  
**Nicht** die Standalone-Local-State-Logik übernehmen.  
UI/UX aus der Contract-Testversion übernehmen, Server-/Tournament-Authority aus der Vollversion behalten.

Referenz:
- Standalone: `public/word-chain-test/index.html`
- Standalone JS: `public/assets/js/word-chain-test.js`
- Standalone CSS: `public/assets/css/word-chain-test.css`
- Production JS: `public/assets/js/12-word-chain-game.js`
- Production CSS: `public/assets/css/wortkette-game.css`
- Runtime: `public/assets/js/08-inapp-runtime.js`
- DB docs: `docs/WORTKETTE_DATABASE.md`
- Integrationsplan: `docs/WORTKETTE_FULLVERSION_INTEGRATION_PLAN.md`
- Game Contract: `docs/WORTKETTE_GAME_CONTRACT_V2.md`
- Design Contract: `docs/WORTKETTE_DESIGN_CONTRACT_V2.md`
- Global Contract: `docs/GAME_DESIGN_CONTRACT.md`

## Fullversion Frame\n\nProduction Wortkette is mounted below the existing global `.sk-header`. **Do not render a second SKIELSEN header, logo bar, duplicate menu or duplicate top navigation inside `12-word-chain-game.js`.**\n\nDesktop and Mobile differ below that frame; Mobile is not a scaled Desktop layout.\n\n## Non-Negotiables

### Canonical IDs
- available game: `game.wortkette.compound_nouns`
- game key: `word_chain`
- module key: `word-chain`

Do not introduce another game catalog alias.

### Existing Tournament Workflow
Preserve:
- auto session creation
- auto assignment
- Ready page
- explicit admin start
- server-only QA force-start flag
- same chain for all players
- independent run/timer per player
- finalizer / placements / ledger / joker handoff

### Difficulty
Difficulty is **session-level and admin-selected** after the In-App Session becomes ACTIVE and before any player run is created.

Tiers:
- EASY = threshold 50 + show word length
- NORMAL = threshold 35 + hide word length
- HARDCORE = threshold 15 + hide word length

Non-admin players wait for admin selection.

### No Run Before Difficulty
Current `get_word_chain_tournament_state()` may auto-create a run. Prevent this until difficulty exists.

Both client and server need a guard.

### Server Authority
Client must never know:
- full hidden chain
- hidden target word
- target length in NORMAL/HARDCORE

Client may know:
- base_word
- revealed_prefix
- target_length only EASY
- deadline_at
- server_now
- time_limit_seconds
- score
- step/total_steps

### Input
No visible textbox.
No custom onscreen keyboard.

Use hidden/focusable native input capture:
- desktop physical keyboard
- iOS/Android native keyboard
- typed letters render into slots
- Backspace edits buffer
- only ENTER submits whole word

Never call submit RPC per keystroke.

### Slot Colors
- first given letter = theme accent
- user-typed letters = theme accent
- server-revealed hint letters after wrong/timeout = danger
- empty = input border

NORMAL/HARDCORE:
- initial state: `B _`
- after first user letter: `B A`
- do not append another underscore

EASY:
- render full target length as empty slots

### Timer
Do not reset timer client-side.

Use:
- `deadline_at`
- `server_now`
- `time_limit_seconds`

Text turns danger at <= 5 seconds.

Mobile timer bar:
- directly below status banner
- 100% → 0%
- accent until >5 sec
- danger at <=5 sec
- separate from overall game progress

### Mobile
When keyboard is open, only keep:
- shared header
- overall game progress
- X/10
- own score
- time
- word timer
- puzzle
- feedback

Hide:
- chain history
- other players
- extra action copy
- secondary stats

Use `interactive-widget=resizes-content`.

### Result
Result is a **separate page**, never embedded into PLAY body.

Shared contract:
- header
- progress 100%
- status only ERGEBNIS
- table
- TURNIER ANSEHEN

Columns:
`POSITION | [IDENTITY COLOR] NAME | ZEIT | SCORE`

Use participant-level rows for final placement.

## Database Work

### Add RPC
`set_word_chain_difficulty(p_session_id uuid,p_tier text)`

Follow the authorization/locking pattern of `set_higher_lower_tier`.

Write to `in_app_game_sessions.public_state_json`:
- word_chain_difficulty
- occurrence_threshold
- show_word_length
- difficulty_selected_by
- difficulty_selected_at
- word_chain_rules_version

Reject:
- invalid tier
- non-admin
- wrong game
- non-ACTIVE session
- any attempt after a word-chain run already exists

### Extend `word_chain_tournament_runs`
Recommended columns:
- difficulty text
- show_word_length boolean
- rules_version integer

Existing threshold/time fields remain.

### Change `start_word_chain_tournament_player`
Read selected session rules, not only definition defaults.

Do not generate a chain without selected difficulty.

### Change `private.word_chain_tournament_state`
Add:
- difficulty
- show_word_length
- target_length only when EASY
- rules_version

Do not expose target itself.

### Result
Extend final result with:
- difficulty
- occurrence_threshold
- show_word_length
- time_limit_seconds
- rules_version

Result rows need:
- participant_id
- participant_type
- display_name
- identity_color
- placement
- duration_ms
- score

SOLO name from tournament member.  
TEAM name from `teams.name`.

## Ranking Cleanup

There is current metadata drift.

Actual finalizer currently ranks:
1. score desc
2. duration asc
3. random draw

Canonicalize all metadata/docs to:
`FEWEST_MINUS_POINTS → DURATION → RANDOM_DRAW`

Update stale `FASTEST_FIRST` snapshots/rules for Wortkette.

Do not change the working finalizer ordering unless product rules are explicitly changed.

## Existing RPCs to Keep

- `start_word_chain_tournament_player(uuid)`
- `get_word_chain_tournament_state(uuid)`
- `submit_word_chain_tournament(uuid,text,boolean)`
- `get_word_chain_game_result(uuid)`
- `set_in_app_game_ready(uuid,boolean)`
- `start_in_app_game_session(uuid)`
- `get_my_active_in_app_game(uuid)`

## Existing Tables to Keep

Core:
- in_app_game_sessions
- in_app_game_session_players
- in_app_game_definitions
- word_chain_edges
- word_chain_solo_sessions
- word_chain_tournament_runs
- word_chain_lexicon_cache
- tournament_game_participants
- tournament_game_results
- game_placements
- participants
- tournament_members
- teams

Novelty/history:
- word_chain_player_edge_history
- word_chain_player_ngram_history

## Important Existing Rules Not To Regress

- same hidden chain for all players
- one session lock prevents double chain generation
- valid wrong guess keeps current deadline
- invalid guess does not punish or reset timer
- timeout creates new deadline
- automatic completion after final hint
- reflex duplicate first letter
- Fugenelement display
- Wiktionary validation/cache
- reset deletes stale tournament runtime
- word-chain Ready page does not auto-start
- force start is feature-flagged server-side only

## File Work

### Production JS
Refactor `12-word-chain-game.js` into:
- difficultyMarkup/bindDifficulty/setDifficulty
- playMarkup
- resultMarkup
- render state router
- native input capture helpers
- slot renderer
- timer renderer

Keep mount/updateSession/unmount public API.

### Production CSS
Port only contract-relevant visual rules from `word-chain-test.css`.

Do not import test/debug chrome:
- testbar
- statebar
- data map
- layout map
- contract table

### Runtime
Only change `08-inapp-runtime.js` where necessary:
- asset cache bust
- ensure session public_state refresh reaches module
- do not break Ready/admin lifecycle

## Testing

### DB
- EASY/NORMAL/HARDCORE selection persists
- cannot change tier after run creation
- same chain across 2/3/4 players
- target length never returned NORMAL/HARDCORE
- correct result finalization

### Desktop
- no layout jumps
- slots visible
- Enter-only judgement
- timer semantics correct

### Mobile
Test at least:
- iPhone-class viewport
- Android Chrome
- keyboard open
- 390×430 visible viewport simulation

Verify:
- native keyboard opens
- no custom keyboard
- all essential UI remains visible
- no overlap
- B _ → B A behavior
- timer bar changes at 5s

### Themes
Check:
- Core
- Core 2
- JGA Nights
- Winter Clash
- Sunset Showdown
- Pink Chaos

### Tournament
Check:
- solo participants
- team participants
- Result page
- game_placements
- tournament_game_results
- ledger
- Joker
- reset
- Ready
- QA force start

## Definition of Done

Do not report complete based only on source code or green Actions.

Before completion:
1. GitHub workflow green.
2. Exact Pages artifact downloaded.
3. Production module syntax checked.
4. Deployed UI rendered.
5. Mobile keyboard viewport rendered.
6. Database return shapes verified.
7. Full run completed through result.
8. Result/placement data verified in DB.
