# SKIELSEN Animation Style Template

**Version:** 1.0  
**Status:** Playtest baseline  
**Reference implementation:** DNA Standalone `public/dna-test/`  
**Purpose:** Reusable motion/choreography reference for Skielsen game result, merge, reveal and transition animations.

---

## 1. Core principle

Skielsen animation should communicate **one semantic event at a time**.

The user must always be able to understand:

1. what changed,
2. where it changed,
3. why the next animation starts.

Animation is not decoration. It visualizes game-state transitions.

### Non-negotiable motion rules

- Never make several different semantic events feel simultaneous.
- Prefer staged sequences over parallel motion.
- Existing information must remain visually stable until the next event actually changes it.
- Do not blank, unmount or re-render a table between two states when the table is conceptually the same object.
- Do not use hide/show blinking as a substitute for movement.
- When rows change order, they visibly travel to their new slots.
- When numbers merge, the source value and target value must never collide visually.
- Movement/status contents appear only after the movement they describe is finished.
- Celebration comes last.

---

## 2. Global motion scale

Current DNA baseline:

```js
const MOTION_SCALE = 3.0625;
const motionMs = ms => Math.round(ms * MOTION_SCALE);
```

This is the current slow/readable Skielsen playtest baseline.

It is the result of two successive `×1.75` slowdowns over the earlier motion baseline.

### Important

Do not blindly multiply every CSS animation by this value.

The current system deliberately uses:

- scaled JavaScript sequencing for choreography,
- some fixed CSS micro-animations for local feedback,
- fixed 1-second countdown ticks where semantic timing matters.

---

## 3. General choreography model

Use this state pattern:

```
STABLE
→ INTRODUCE ONE CHANGE
→ LET IT COMPLETE
→ SHORT BREATHING ROOM
→ INTRODUCE NEXT CHANGE
→ REORDER / RESOLVE
→ SECONDARY INFORMATION
→ CELEBRATION
```

Avoid:

```
VALUE CHANGE + ROW SHUFFLE + HEADER CHANGE + MOVEMENT LABEL + CONFETTI
(all at once)
```

---

# RESULT / END-GAME ANIMATION

## 4. Final game ranking appear

The final game ranking appears as a stable table.

Rows use a short local row-appear animation.

Current CSS row appear:

```css
animation: dnaRow .63s ease forwards;
```

Row delays use scaled timing:

```js
--delay: motionMs(160 + i * 130)
```

### Placement-point reveal

After the ranking table is fully visible:

1. Hold the table completely unchanged for **2 seconds**.
2. Reveal placement points from the **bottom row upward**.
3. Each next placement value is delayed by:

```js
motionMs(260)
```

Current effective spacing:

- base hold: 2000 ms
- between placement values: ~796 ms

Placement value local fade/slide:

```css
transition:
  opacity .42s ease,
  transform .42s ease;
```

### Rule

The 2-second hold is intentional.

The viewer should first understand the raw game ranking before tournament placement points are introduced.

---

# RESULT → TOURNAMENT MERGE

## 5. In-place transition

The Result table and Merge table are conceptually the same table.

Therefore:

**Do not replace or re-render the rows.**

Current DNA behavior:

- existing DOM rows are retained,
- result classes are changed to merge classes,
- column labels are updated in place,
- current DNA metric is replaced by tournament-points state inside the same row,
- placement points remain visible.

### Forbidden

- blank table frame,
- row disappearance,
- second row-appear animation,
- second placement-point appear animation,
- rebuilding the table through a fresh `innerHTML` render.

This rule is represented by:

`DNA_MERGE_INPLACE_V1`

---

# POINT MERGE

## 6. Point-addition choreography

Placement bonuses are **not animated in parallel**.

They are processed sequentially from:

```
BOTTOM ROW
→ row above
→ row above
→ TOP ROW
```

This keeps the merge readable.

### Per-row sequence

For each row:

1. Existing tournament score stays fixed.
2. `+X` moves from the right toward the score.
3. `+X` stops **8 px to the right** of the existing score.
4. `+X` fades completely.
5. Only after `+X` is gone:
   - old score disappears,
   - summed score becomes visible,
   - summed score pulses.
6. Short pause.
7. Continue with the row above.

### Collision guard

The moving `+X` must never cross into or overlap the existing score glyphs.

Current target:

```js
targetLeft = oldScore.right + 8px
```

This is represented by:

`DNA_SCORE_COLLISION_GUARD_V1`

### Point-morph motion

Current per-row bonus animation base duration:

```js
motionMs(240)
```

Current effective duration:

~735 ms

Motion keyframe shape:

```
0%   position start, opacity 1
72%  90% of travel, opacity 1
90%  destination, opacity .28
100% destination, opacity 0
```

Easing:

```
cubic-bezier(.2,.8,.2,1)
```

### Pause after each row

```js
motionMs(100)
```

Current effective pause:

~306 ms

So each row receives roughly:

```
735 ms movement
+ 306 ms settle/pulse window
≈ 1.04 s
```

Four rows therefore read as four distinct events rather than one simultaneous merge.

---

## 7. Sum arrival pulse

The final summed number gets one short scale pulse when it replaces the old number.

Current CSS:

```css
@keyframes dnaPointPulse {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}
```

Duration:

```
0.48 s
```

Easing:

```
cubic-bezier(.2,.8,.2,1)
```

### Rule

The pulse is the dominant feedback for:

**“The addition has now happened.”**

It must not compete with a still-visible `+X`.

---

# MOVEMENT / REORDER

## 8. Breathing room before reorder

After all four point merges complete:

1. wait:

```js
motionMs(180)
```

≈ 551 ms

2. show the header:

```
BEWEGUNG
```

3. wait:

```js
motionMs(220)
```

≈ 674 ms

4. only then begin row reorder.

### Rule

The `BEWEGUNG` column header introduces the next concept.

Its cell contents must still be empty at this stage.

---

## 9. True row swap

The row reorder must look like rows **trading physical positions**.

### Current implementation principle

During the visible swap:

- DOM order stays unchanged,
- each row receives a vertical transform toward its target slot,
- rows visibly travel through the table,
- only after all rows reach their destinations is DOM order updated.

This avoids a teleport/re-render feeling.

Current marker:

`DNA_TRUE_SWAP_V2`

### Current swap duration

Base:

```js
motionMs(580)
```

Current effective duration:

~1776 ms

Easing:

```
cubic-bezier(.2,.72,.18,1)
```

### Technical rule

A stable row may suppress its normal appear animation, but **must not suppress transform while it is swapping**.

Current CSS pattern:

```css
.dna-merge-row.is-stable {
  opacity: 1 !important;
  animation: none !important;
}

.dna-merge-row.is-stable:not(.is-swapping) {
  transform: none !important;
}
```

This prevents the stable-state rule from overriding the active swap transform.

---

## 10. Movement-cell reveal

The movement cells remain empty during the entire shuffle.

Only after the swap completes are values populated:

- `↑ N`
- `↓ N`
- `—`

Delay after swap:

```js
motionMs(120)
```

≈ 368 ms

Movement text uses a local fade/slide transition:

```css
transition:
  opacity .39s ease,
  transform .39s ease;
```

### Rule

Never show a movement value before the movement itself is finished.

---

# CELEBRATION

## 11. Winner confetti

Confetti is the final event.

It starts only after movement values are visible.

Delay:

```js
motionMs(420)
```

≈ 1286 ms

Color:

**team color of the new first-place participant/team**

The celebration must never obscure understanding of the score calculation or row reorder.

---

# BETWEEN-TERM REVEAL

## 12. Reveal table

Between terms, team scores are shown as a one-column vertical list.

Ordering:

1. term score descending,
2. tie order:
   - Blue identity slot
   - Red identity slot
   - Yellow identity slot
   - Green identity slot

Team name and term score use the same visual type size.

Team name is solid black / normal surface text, not muted grey.

Each row uses only the vertical team-color accent for team color identity.

### Reveal row animation

Local appear duration:

```
0.63 s
```

Delay uses scaled values:

```js
motionMs(90 + i * 80)
```

The reveal should feel calm and readable, not like a scoreboard rapidly populating.

---

# NEXT TERM COUNTDOWN

## 13. Category countdown

After the reveal table and before the next term:

```
CATEGORY
3
2
1
→ IDEA
```

Example:

```
LÄNDER
3
2
1
```

### Timing

Countdown semantic timing is fixed:

- `3` at 0 s
- `2` at 1 s
- `1` at 2 s
- next IDEA screen at 3 s

Do **not** apply the global motion scale to these one-second countdown ticks.

### Layout

- category above number,
- horizontally centered,
- category large and bold,
- countdown number substantially larger,
- full active viewport may be used,
- no scrolling.

The countdown is omitted after the final term.

---

# MOTION DESIGN RULES

## 14. What to preserve

For future games, preserve these characteristics:

### A. Persistence

Objects that conceptually continue into the next state should remain the same visible object.

Prefer:

```
same row → changed state
```

over:

```
old row disappears → new row appears
```

### B. Sequential semantics

One animation should answer one question.

Examples:

- “What placement points did we earn?”
- “How do those points change the total?”
- “Who changed position?”
- “Who is now first?”

Do not answer all four at once.

### C. Collision-free number motion

Moving values never overlap target digits.

Source value should fully fade before target replacement becomes dominant.

### D. Physical reordering

When rank order changes, rows travel between slots.

Never imply movement only through disappearance and reappearance.

### E. Breathing room

Use short pauses between semantic stages.

The pause is part of the animation system, not dead time.

### F. Celebration last

Confetti or other celebration only begins after all informational animation has completed.

---

# IMPLEMENTATION REFERENCE

## 15. Current source

Reference JS:

`public/dna-test/app.js`

Reference CSS:

`public/dna-test/style.css`

Important implementation markers:

- `DNA_RESULT_HOLD_2S_V1`
- `DNA_MERGE_INPLACE_V1`
- `DNA_MOTION_SCALE_30625_V1`
- `DNA_POINT_ARRIVAL_PULSE_V1`
- `DNA_POINT_ARRIVAL_CLEAN_V2`
- `DNA_SCORE_COLLISION_GUARD_V1`
- `DNA_MERGE_CHOREOGRAPHY_V3`
- `DNA_TRUE_SWAP_V2`
- `DNA_SWAP_TRANSFORM_UNBLOCK_V1`
- `DNA_MERGE_STABLE_ROWS_V1`
- `DNA_REVEAL_VERTICAL_V2`
- `DNA_REVEAL_EQUAL_TYPE_V1`
- `DNA_REVEAL_TEAM_TEXT_BLACK_V1`

---

## 16. Template status

This file freezes the **current visual animation baseline** after DNA mobile playtesting.

Future changes to DNA animation should not silently change this template.

If a new motion pattern proves better in playtesting:

1. test it in the game,
2. approve it visually,
3. then version this template deliberately.

