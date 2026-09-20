# WORTKETTE · DESIGN CONTRACT

Status: **current production design contract**

Visual development reference: `/word-chain-test/`

## 1. Page architecture

Wortkette has separate states inside the existing In-App frame:

1. READY — owned by the shared In-App runtime
2. DIFFICULTY SETUP
3. PLAY
4. RESULT

Setup and Result are pages/states, never overlays on the active puzzle.

## 2. Fullversion frame

The game does not render its own application header.

The existing fullversion `.sk-header` and global four-color strip remain above the game. Standalone-only mock headers must never be copied into Production.

Desktop and Mobile share this frame but use different game layouts below it.

## 3. Canvas

Desktop game content:
- maximum width: 760 px
- centered

Mobile:
- width: 100 %
- layout follows the browser-resized visual viewport

Primary breakpoint:
- 720 px

## 4. Overall game progress

- directly below the fullversion frame
- height: 4 px
- meaning: `step / total_steps`
- never reused as the current-word timer

## 5. Difficulty setup

Content:

- WORT / KETTE title
- mode card
- EASY
- NORMAL
- HARDCORE
- primary start action

Admin is actionable; non-admin clients show a waiting state.

No PLAY content is rendered behind the Setup page.

## 6. PLAY · Desktop

The desktop layout may show:

- overall progress
- 72 px status row
- chain/context row
- 460 px mechanic body
- game-specific help/action area when required

Only the mechanic body may contain game-specific visual transitions.

## 7. PLAY · Mobile

Mobile is keyboard-first and intentionally not a scaled desktop layout.

Visible:

- existing fullversion header (outside the game module)
- 4 px overall progress
- 52 px status row
- 4 px current-word timer
- flexible mechanic body
- feedback

Status row contains exactly:

1. `X / 10`
2. own Score
3. Time

Hidden:

- player cards
- other-player scores
- chain history
- secondary statistics
- action/help footer
- test/debug chrome

## 8. Puzzle order

1. AUSGANGSWORT label
2. Ausgangswort
3. Plus
4. GESUCHTES NOMEN label
5. slots
6. feedback

Long base words remain on one line and shrink to fit available width.

Zones must never overlap.

## 9. Input slots

No visible text input.

| Slot source | Visual accent |
|---|---|
| initial letter | Theme Accent |
| user-entered letter | Theme Accent |
| server hint | Theme Danger |
| empty | Theme Input Border |

NORMAL/HARDCORE initially show one neutral next slot:

`H _`

After the user starts typing, no additional neutral slot is appended:

`H O`

EASY may render all empty target-length slots.

## 10. Native input capture

The real HTML input is:

- focusable
- visually invisible
- no meaningful layout footprint
- at least 16 px font size to avoid iOS auto-zoom
- compatible with native IME/system keyboard

The visible word is always rendered by the slot layer.

## 11. Current-word timer

Mobile placement:
- directly below the status row
- 4 px height

Track:
- Theme Surface Muted

Fill:
- > 5 seconds → Theme Accent
- ≤ 5 seconds → Theme Danger

Timer text:
- normal text above 5 seconds
- Danger text at ≤ 5 seconds
- no background box
- no padding/geometry change

## 12. Feedback

Feedback remains inside the mechanic body.

Allowed semantic states:

- Success
- Warning
- Danger

Feedback changes must not alter the outer page geometry.

## 13. Live result table

The Result page is also the live waiting surface after the local player finishes.

Every assigned player remains visible.

Completed rows:
- sorted above unfinished rows
- display live rank
- display time
- display score

Unfinished rows:
- POSITION blank
- ZEIT `–`
- SCORE `–`

The row height and column geometry must not change when a row switches from pending to complete.

## 14. Final result page

Order:

1. existing fullversion frame
2. progress = 100 %
3. ERGEBNIS status
4. result table
5. primary action

Result table:

```text
POSITION | NAME | ZEIT | SCORE
```

Desktop grid:
- POSITION: 86 px
- NAME: flexible
- ZEIT: 130 px
- SCORE: 90 px
- column gap: 12 px

Mobile grid:
- POSITION: 52 px
- NAME: flexible
- ZEIT: 86 px
- SCORE: 58 px
- column gap: 8 px

All header and row cells are vertically centered.

Time format:
- `MM:SS:CC`

Name cell:
- Participant Identity accent bar
- display name

## 15. Identity vs theme

Theme controls surfaces, typography contrast, borders, actions and semantic feedback.

Participant Identity controls only the RED / BLUE / GREEN / YELLOW identity accent.

Themes never recolor identity semantics.

## 16. Animation boundary

Allowed:
- mechanic-specific slot/hint feedback
- central game transitions

Forbidden:
- global header movement
- status movement
- result table geometry animation
- page width/height animation
- unrelated navigation animation

## 17. Responsive acceptance

Required checks:

- 760 px desktop
- 720 px breakpoint
- 390 px mobile
- approximately 390 × 430 px keyboard-open visual viewport
- iOS native keyboard
- Android Chrome native keyboard

Pass criteria:

- no overlap
- no clipped essential mechanic information
- native input remains functional
- status and timer remain visible
- result table has no horizontal page overflow
