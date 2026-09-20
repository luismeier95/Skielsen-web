# WORTKETTE · GAME CONTRACT

Status: **current production contract**

## 1. Identity

- Catalog ID: `game.wortkette.compound_nouns`
- In-App game key: `word_chain`
- Module key: `word-chain`
- Steps: 10
- all assigned players receive the same hidden chain
- each player has independent progress, score and timer
- gameplay is server-authoritative

## 2. Fullversion frame

Wortkette mounts inside the existing SKIELSEN application frame.

The global `.sk-header` and navigation are owned by the full application and remain visible. The game module must not render a second SKIELSEN header, logo bar or duplicate menu.

## 3. Workflow

1. shared READY page from the In-App runtime
2. Tournament Admin starts the session
3. Admin selects the session-wide difficulty
4. server creates the common hidden chain
5. each player completes an independent run
6. finished players enter the live result page immediately
7. final tournament result is produced when all players finish

## 4. Difficulty

Difficulty is selected exactly once per In-App Session before any Word Chain run exists.

| Tier | Occurrence threshold | Target length |
|---|---:|---|
| EASY | 50 | visible |
| NORMAL | 35 | hidden |
| HARDCORE | 15 | hidden |

Non-admin clients wait for the admin selection.

## 5. Input

Allowed input sources:

- physical desktop keyboard
- native iOS / Android keyboard

There is no custom on-screen keyboard and no visible text field.

Client behavior:

- letters append to the local buffer
- Backspace removes letters
- Enter submits the complete guess
- no right/wrong judgement occurs before Enter

## 6. Slot provenance

- first provided letter → Theme Accent
- user-entered letters → Theme Accent
- server-revealed hints after wrong answer / timeout → Theme Danger
- empty slot → Theme Input Border

NORMAL / HARDCORE:

```text
initial: B _
typed A: B A
```

No new trailing underscore appears after the first user character.

EASY renders the complete target length using empty slots.

## 7. Duplicate-initial rule

If exactly one initial is already visible:

- visible `G` + user enters `GELD` → the reflex duplicate G is ignored
- a true double initial (for example `LL...`) preserves the second letter

The rule is enforced server-side as well as in the client UX.

## 8. Guess outcomes

### Correct
- accepted
- advance to next word
- start the next word timer
- no penalty

### Valid but wrong
- score −1
- reveal exactly one additional hint letter
- current word remains active
- current timer does not reset

### Invalid / validation unavailable
- no penalty
- no hint
- no progress
- timer does not reset

### Timeout
- score −1
- reveal the next hint
- same word receives a new time window

### Hint completes the word
- automatic advance
- no additional Enter required

## 9. Timer

The overall game progress and the current-word timer are different UI channels.

### Overall progress
- 4 px bar
- reflects `step / total_steps`

### Current-word timer
- server-authoritative from `deadline_at`, `server_now` and `time_limit_seconds`
- text becomes Danger at ≤ 5 seconds
- no Danger bounding box
- mobile also shows a 4 px countdown bar directly below the status row
- bar uses Theme Accent above 5 seconds and Theme Danger at ≤ 5 seconds

## 10. Mobile keyboard contract

The production viewport uses:

`interactive-widget=resizes-content`

When the native keyboard is open, Mobile keeps only:

- global fullversion header
- overall game progress
- `X / 10`
- own score
- time
- current-word timer
- puzzle
- feedback

Hidden on Mobile:

- chain history
- other player cards
- secondary statistics
- extra action copy

## 11. Live result contract

As soon as a player finishes, RESULT opens immediately.

The live table always lists every assigned player:

- completed players first
- completed players receive live ranks 1, 2, 3, …
- unfinished players remain listed below them
- unfinished POSITION is blank
- unfinished ZEIT = `–`
- unfinished SCORE = `–`
- header meta shows `X / Y FERTIG`

Live ranking uses:

1. score descending (fewest minus points)
2. elapsed time ascending

The table refreshes from server `live_standings`.

## 12. Final result

The final page is a separate game state inside the existing In-App frame.

Columns:

1. POSITION
2. identity accent + NAME
3. ZEIT
4. SCORE

Time format:

`MM:SS:CC` (minutes, seconds, hundredths)

Final ranking:

1. score descending
2. duration ascending
3. server random draw

`TURNIER ANSEHEN →` appears only after server finalization.

Result rows are Participant-level, matching Tournament Placements.

## 13. Theme contract

No game-specific theme palette may be hardcoded.

Use semantic tokens for:

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

Participant identity colors remain the fixed semantic RED / BLUE / GREEN / YELLOW identities.

## 14. Client/server boundary

The production client must never receive:

- hidden target word
- full future chain
- future edges
- target length in NORMAL / HARDCORE

EASY may receive only `target_length`, never the target word itself.

Client-only state is never persisted:

- input buffer
- accepted/reveal buffer
- keyboard focus
- slot DOM classes
- timer bar width
- responsive state
- animation state

## 15. Workflow compatibility

The game must retain:

- READY flow
- explicit Admin start
- server-controlled QA force-start flag
- shared-chain lock
- per-player run
- result recovery
- full reset
- Tournament Result ingest
- Joker handoff
- placement points
- ledger sync

## 16. Acceptance

A build is compliant only when:

- database and UI rules agree
- no hidden information leaks
- desktop and mobile layouts are tested
- native mobile keyboard works
- no layout jumps occur outside the mechanic
- supported themes pass
- a full multiplayer run finalizes correctly
- the exact deployed artifact is visually verified
