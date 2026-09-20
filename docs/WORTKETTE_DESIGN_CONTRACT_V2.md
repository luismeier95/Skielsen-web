# WORTKETTE · DESIGN CONTRACT V2

Visual Reference: `/word-chain-test/` · Run #556  
Applies to: Standalone reference + Production integration

## 1. Page Architecture

Wortkette consists of separate pages/states:

### READY
Owned by shared In-App Runtime.

### DIFFICULTY SETUP
Own page. Never rendered over the PLAY body.

### PLAY
Own page with shared game chrome and game-specific mechanic.

### RESULT
Own page. Never rendered inside the PLAY mechanic.

## 2. Shared Canvas

Desktop:
- maximum width: 760 px
- centered

Mobile:
- width: 100 %
- visual viewport must respect native keyboard resize

Primary breakpoint:
- 720 px

## 3. Fullversion Frame / Global Header

The production game does **not** render its own header.

The existing fullversion `.sk-header` is the canonical frame above Wortkette and contains the global SKIELSEN navigation/menu. It remains visible while Wortkette is open.

Wortkette starts below:
- global fullversion header
- global four-color strip

Standalone-only mock headers are reference chrome and must never be copied into Production.

Desktop and Mobile both use this same fullversion frame; the game layout below it is responsive and differs by breakpoint.

## 4. Overall Game Progress

Directly below Shared Header.

Height:
- 4 px

Meaning:
- overall game progress only
- `step / total_steps`

Never use this bar for the word countdown.

## 5. Difficulty Setup Page

Own page.

Content:
- WORT / KETTE display title
- Mode card
- EASY
- NORMAL
- HARDCORE
- primary start action

Difficulty button colors come from Theme tokens.

Session-level selection:
- Admin actionable
- other players see waiting state in production

No PLAY status, player cards or puzzle behind this page.

## 6. PLAY · Desktop Geometry

Recommended contract geometry based on the reference:

| Area | Height | Position |
|---|---:|---|
| Shared Header | 72 px | fixed geometry |
| Game Progress | 4 px | fixed geometry |
| Status | 72 px | fixed geometry |
| Player/Context row | 48 px | fixed geometry |
| Mechanic Body | 460 px | fixed outer geometry |
| Action/help | 64 px | fixed geometry |

Only the Mechanic Body may contain game-specific animation/morph behavior.

## 7. PLAY · Mobile Geometry

Mobile is keyboard-first.

Visible while playing:
- Existing Fullversion Header: outside the game module
- Overall Progress: 4 px
- Status: 52 px
- Word Timer: 4 px directly under Status
- Mechanic Body: flexible remaining visual viewport
- Feedback: inside Mechanic Body

Hidden:
- Player cards
- other-player scoreboards
- chain history
- action/help footer
- secondary stats
- test/debug chrome

The mechanic body uses remaining height:
`minmax(0, 1fr)`

Do not reserve desktop container heights on Mobile.

## 8. Mobile Status Banner

Exactly three values:
1. `X / 10`
2. own Score
3. Time

Labels may be omitted on Mobile.

No other game information belongs in this row.

## 9. Word Timer

Mobile only unless explicitly required elsewhere.

Placement:
- directly below Status
- no extra vertical layout consumption beyond its own 4 px

Height:
- 4 px

Background track:
- Theme Surface Muted

Fill:
- > 5 seconds: Theme Accent
- <= 5 seconds: Theme Danger

Text timer:
- normal Theme text
- <= 5 seconds: Danger text only
- no Danger background box
- no padding change
- no geometry change

## 10. Puzzle Mechanic Zones

Vertical order:
1. Ausgangswort label
2. Ausgangswort
3. Plus
4. Gesuchtes Nomen label
5. Slots
6. Feedback

Zones must never overlap.

Long main words:
- one line
- dynamically shrink to available width
- no wrapping into adjacent zone

## 11. Input Slots

No visible text field.

### Initial
- visible character
- Theme Accent underline

### User Typed
- visible character
- Theme Accent underline

### Hint Revealed
- visible character
- Theme Danger underline

### Empty
- no character
- Theme Input Border underline

NORMAL/HARDCORE:
- before typing: initial + one neutral next slot, e.g. `H _`
- after first typed character: no new neutral slot, e.g. `H O`

EASY:
- complete target length visible as empty slots

Slot width may scale down to fit long words.

## 12. Native Keyboard Capture

The actual HTML input:
- visually invisible
- 1 px or equivalent no-layout footprint
- focusable
- font size >=16 px to avoid iOS zoom
- native IME compatible
- no pointer-visible component

Mobile:
- focus from Start user gesture
- tap mechanic can restore focus

The visible typed word is always the slot layer, never the capture input.

## 13. Feedback

Feedback stays in the mechanic body.

Allowed semantic states:
- Success
- Warning
- Danger

No layout jump when feedback changes.

No global header/status/button animation.

## 14. Live Result Table

The Result Page is also the live waiting surface after a player finishes.

Rows:
- every assigned player remains visible
- finished rows are sorted above unfinished rows
- finished rows show live rank, time and score
- unfinished rows show empty POSITION and `–` for ZEIT/SCORE
- player identity accent remains visible for all rows
- `X / Y FERTIG` updates without replacing the table with a waiting message

No row height or column geometry changes when a player changes from pending to completed.

## 15. Result Page

Own page.

Order:
1. Existing Fullversion Header / Runtime Frame
2. Progress = 100 %
3. Result Status
4. Result Table
5. Primary Action

### Result Status
Desktop:
- 72 px

Mobile:
- 60 px

Content:
- `ERGEBNIS` only

### Result Table Columns
1. POSITION
2. NAME
3. ZEIT
4. SCORE

Name cell:
- Participant Identity accent bar
- display name

Desktop example grid:
- 82 px / flexible / 92 px / 64 px

Mobile example grid:
- 62 px / flexible / 72 px / 54 px

Result table is theme-surface based.

## 16. Identity vs Theme

Theme controls:
- backgrounds
- text colors
- borders
- actions
- semantic feedback
- accent

Participant Identity controls only:
- RED
- BLUE
- GREEN
- YELLOW accent next to Name / Player identity

Do not recolor Player Identity per Theme.

## 17. Animation Boundary

Allowed:
- mechanic-specific slot/hint feedback
- game-specific central transitions

Forbidden:
- Shared Header movement
- Status movement
- Player/context row movement
- Action footer movement
- Result table jumping/reordering before final data
- page-width/height animations

## 18. Responsive Acceptance

Must test:
- 760 px desktop
- 720 px breakpoint
- 390 px mobile
- small keyboard-open visual viewport around 390×430 px
- iOS native keyboard
- Android Chrome native keyboard

Pass criteria:
- no overlap
- no clipped essential information
- no custom keyboard
- native input still functional
- status + word timer remain visible
- slots remain centered and readable
- Result table remains readable without horizontal page overflow
