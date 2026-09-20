# WORTKETTE · GAME CONTRACT V2

Status: Integration Contract  
Visual reference: `/word-chain-test/` Run #556

## 1. Game Identity

- canonical game id: `game.wortkette.compound_nouns`
- in-app game key: `word_chain`
- module key: `word-chain`
- steps: 10
- same hidden chain for all assigned players
- independent player progress
- server-authoritative gameplay

## 2. Difficulty Contract

Difficulty is selected exactly once per In-App Session by the Tournament Admin.

| Tier | Threshold | Word Length |
|---|---:|---|
| EASY | 50 | visible |
| NORMAL | 35 | hidden |
| HARDCORE | 15 | hidden |

The selection must happen before any player run / chain generation.

## 3. Page Contract

Wortkette has distinct pages/states:

1. Shared READY page — owned by In-App Runtime
2. Difficulty Setup page
3. PLAY page
4. RESULT page

Setup and Result are never overlays on the PLAY body.

## 4. PLAY Layout

### Desktop
May show:
- Shared Header
- overall Game Progress
- status banner
- secondary player/chain context
- puzzle
- action help

### Mobile
Only:
- Shared Header
- overall Game Progress
- X / 10
- own Score
- Time
- word countdown bar
- puzzle
- feedback

Hidden on Mobile:
- chain history
- other Player cards
- secondary stats
- extra action instructions

## 5. Puzzle Contract

Visual order:
1. Ausgangswort
2. Plus
3. Gesuchtes Nomen
4. Hangman/Input slots
5. feedback

No visible text input.

Text must never overlap adjacent zones.

Long base words shrink to fit one line.

## 6. Input Contract

Input source:
- physical desktop keyboard
- native mobile system keyboard

No custom onscreen keyboard.

Client buffer is visual only.

Keys:
- letters → append
- Backspace → remove
- Enter → submit complete guess

No correct/wrong judgement before Enter.

## 7. Slot Contract

### Provenance
- initial first letter → Theme Accent
- user input → Theme Accent
- hint revealed by wrong/timeout → Theme Danger
- empty slot → Input Border

### NORMAL / HARDCORE
Start:
`H _`

After first typed letter:
`H O`

No automatic next underscore after the first user letter.

### EASY
Render all target-length slots.

The backend may expose target length only for EASY.

## 8. Duplicate Initial Rule

If exactly one initial is revealed:
- `G` visible + user types `GELD` → repeated G ignored
- true double initial, e.g. `LL...` → second L preserved

Enforce client and server side.

## 9. Guess Result Contract

### Correct
- accepted
- word advances
- timer resets for next word
- no penalty

### Valid but Wrong
- −1 score
- exactly one next letter revealed
- current timer does not reset

### Invalid / Validation Unavailable
- no penalty
- no hint
- no progress
- no timer reset

### Timeout
- −1 score
- next hint
- new time window for same word

### Hint Completes Word
- automatic advance
- no extra Enter

## 10. Timer Contract

Text time:
- integer countdown
- Danger text at <= 5 seconds
- no Danger box/background

Mobile word-timer:
- directly below status banner
- 4 px
- Theme Accent while > 5 seconds
- Theme Danger at <= 5 seconds
- width = remaining / limit

Overall game progress:
- separate 4 px shared progress below Header
- width = current step / total steps

Do not reuse one bar for both meanings.

## 11. Mobile Keyboard Contract

Viewport:
`interactive-widget=resizes-content`

The game must fit the browser-resized visual viewport while keyboard is open.

No double keyboard offset compensation.

Hidden input capture:
- focusable
- visually invisible
- no layout footprint
- maintains native IME/system keyboard support

## 12. Result Contract

RESULT is a separate page.

Shared structure:
- Header
- overall Progress 100%
- Status: ERGEBNIS only
- Result Table
- TURNIER ANSEHEN →

Columns:
1. POSITION
2. [Identity Accent] NAME
3. ZEIT
4. SCORE

Result row is Participant-level.

Ranking:
1. score descending / fewest minus points
2. duration ascending
3. server random draw

## 13. Theme Contract

No hardcoded theme palette in the production game.

Use semantic tokens:
- Page / Surface
- On-Surface
- Border
- Accent
- Primary Action
- Success
- Warning
- Danger
- Input
- Disabled

Player/Participant identity colors stay independent:
- RED
- BLUE
- GREEN
- YELLOW

## 14. Database Variable Map

| UI / Rule | Source |
|---|---|
| difficulty | in_app_game_sessions.public_state_json |
| threshold | session public state + run snapshot |
| show word length | session public state + run snapshot |
| X/10 | tournament state step / total_steps |
| own score | tournament state score |
| time | deadline_at + server_now |
| timer bar | deadline_at + time_limit_seconds + server_now |
| base word | tournament state base_word |
| initial/hints | revealed_prefix + current_wrong_count |
| target length | server state, EASY only |
| guess | client buffer → submit RPC on Enter |
| result position | finalized standings |
| result name | participant/member/team lookup |
| identity accent | participants.identity_color |
| result time | duration_ms |
| result score | final score |

## 15. Client-Only State

Never persist:
- inputBuffer
- acceptedBuffer
- keyboard focus
- slot DOM
- timer width
- responsive mode
- animation classes

## 16. Security / Information Boundary

NORMAL/HARDCORE client must not receive:
- hidden target
- full chain
- target length
- future edges

EASY may receive only target length, never the target itself.

## 17. Workflow Compatibility

Must retain:
- Ready page
- explicit Admin start
- server feature-flag Force Start
- common chain lock
- per-player run
- heartbeat
- result recovery
- reset
- Tournament Result ingest
- Joker
- placement points
- ledger sync

## 18. Acceptance

A build is contract-compliant only when:
- DB rules and UI agree
- no layout jump
- mobile keyboard works
- theme checks pass
- no hidden information leak
- full multiplayer run finalizes
- exact deployed artifact is visually tested
