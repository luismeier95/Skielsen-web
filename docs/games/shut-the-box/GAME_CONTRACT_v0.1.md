# SHUT THE BOX — GAME CONTRACT v0.1

**Status:** Product specification before first visual prototype  
**Development model:** App-first  
**Primary target:** Smartphone landscape  
**Game type:** Dice / tactics / sabotage

## 1. Core concept

Shut the Box uses:
- 2 standard six-sided dice
- one board containing the numbers 1–12
- every number starts open
- a roll produces a target sum
- one or more currently open numbers whose values add up exactly to the roll may be flipped/closed

Example for roll 7: `7`, `1+6`, `2+5`, `3+4`, `1+2+4`, if all involved numbers are still open.

## 2. Board score

A board ends when the current dice result has no valid remaining combination.

Board score = sum of all numbers still open.

Lower is better.

If all numbers 1–12 are closed:
**SHUT THE BOX = 0 Restpunkte**

## 3. Modes

### Normal
The team playing the board:
- rolls its own dice
- selects its own numbers
- confirms its own move

### Sabotage
The team playing the board:
- rolls its own dice

Another team:
- decides which valid combination is closed

Core principle:
**You roll. Your opponent decides what happens to your board.**

## 4. Normal match structure

Normal always consists of **3 rounds**, regardless of the number of teams.

All teams play their own board **simultaneously**.

When one team finishes, it enters the intermediate/waiting screen and waits until all other teams have also completed the round.

Only when all teams are finished does the next round begin.

After Round 3, Restpunkte from all three boards are added. Lowest total wins.

## 5. Hidden cumulative score

During the match, the cumulative total remains hidden.

After a board, a team may see:
- completed round
- Restpunkte for that board
- own completion/wait state

The accumulated match total is revealed only at the final result/reveal.

## 6. Intermediate / waiting screen

Use the established **DNA intermediate/waiting-screen pattern** as the design reference.

Show at minimum:
- completed round
- Restpunkte of the completed board
- own completion state
- whether other teams/matches are still active
- waiting target where applicable

Examples:
- `RUNDE 2 ABGESCHLOSSEN`
- `RESTPUNKTE 14`
- `WARTET AUF DIE ANDEREN TEAMS`
- Sabotage: `WARTET AUF BLAU VS GRÜN`

The cumulative total remains hidden.

## 7. Sabotage — 2 teams

With two teams: **3 rounds**

Both teams play simultaneously.

Each team has its own board:
- A rolls for A, B selects for A
- B rolls for B, A selects for B

Both directions run in parallel.

## 8. Sabotage — 4 teams

With four teams: **3 rounds**

Each round contains two simultaneous 1v1 matches.

Example Round 1:
- GELB ↔ ROT
- BLAU ↔ GRÜN

Inside each 1v1:
- both teams play their own board simultaneously
- each team sabotages the other team's board

If one 1v1 finishes first, both teams enter waiting state while the other match continues.

Pairings rotate so every team plays against and sabotages every other team exactly once.

Canonical rotation:

| Round | Match 1 | Match 2 |
|---|---|---|
| 1 | A vs B | C vs D |
| 2 | A vs C | B vs D |
| 3 | A vs D | B vs C |

## 9. Sabotage — 3 teams

Three-team Sabotage is a special format.

There is **1 regular round**.

All three boards run simultaneously.

Sabotage uses a closed circle:
- A sabotages B
- B sabotages C
- C sabotages A

Each team:
- rolls on its own board
- is sabotaged by one opponent
- sabotages one different opponent

After this round, results are evaluated.

From this point onward, **Sudden Death applies to tied positions**.

There is no four-round three-team Sabotage format.

## 10. Solo Normal

Solo Normal uses **3 rounds**.

The player controls the board normally. The three Restpunkte values are added for the final score.

## 11. Solo Sabotage

Solo Sabotage uses **3 rounds**.

The human player:
- rolls
- owns the board

The bot:
- has no own board
- does not roll
- only chooses which valid combination is closed

For v1, the bot uses a **simple deterministic sabotage heuristic**. Advanced strategy is deferred.

The bot logic must remain replaceable.

## 12. Number selection

After a roll, the responsible decision-maker may select valid open numbers.

The interface always displays **X / Y**:
- Y = current dice total
- X = sum of currently selected numbers

Example:
- roll 7 → `0/7`
- select 6 → `6/7`
- select 1 → `7/7`

The count updates immediately on selection/deselection.

## 13. Board visibility

The complete 1–12 number row must remain clearly visible during number selection.

Decision UI must not cover the board.

In Sabotage, the affected board clearly states who controls the decision, e.g.:
**TEAM ROT ENTSCHEIDET**

## 14. Confirm action

A valid selection is **not** auto-committed merely because X = Y.

When X = Y, **BESTÄTIGEN** becomes available.

BESTÄTIGEN is a mandatory action and uses the established Skielsen **Glow Pulse mandatory-button treatment**.

Selected numbers are only flipped after confirmation.

### Single valid combination exception

If exactly one valid combination exists, the game resolves it automatically.

## 15. Action state machine

Rolling and number selection are mutually exclusive.

Before roll:
- selection disabled
- dice enabled for authorized player

After roll:
- another roll disabled
- decision phase active

After confirmation:
- selected numbers close
- next roll becomes available

The current action must always be clear in the UI.

## 16. Dice interaction

Rolling is triggered by **tap directly on the dice**.

Dice require a genuine roll/tumble animation, not merely rapid face changes.

Final faces must exactly match the generated result.

## 17. Team Ready selection

On the Ready screen, all players of each team are listed.

Only **one player per team** may become READY.

The selected Ready player becomes the active Shut the Box player for that team for the complete match.

Once every participating team has exactly one Ready player:
**the game starts automatically**

No additional normal Admin Start action is required.

## 18. Team interaction permissions

Only the selected active player may perform gameplay actions for that team.

Other team members may observe.

Normal:
- active player rolls
- selects
- confirms

Sabotage:
- active player rolls for own team
- selects and confirms on opponent board when the team has sabotage authority

Permission mapping remains stable for the match:
`teamId → activePlayerId`

## 19. Multi-device synchronization

Shut the Box is a synchronized multi-device game.

All relevant devices receive the current state needed for their match context.

Only the player currently authorized for an action may interact.

Normal can have several independent boards running simultaneously.

Sabotage can have several independent 1v1 contexts running simultaneously.

Devices do not need to display one single global active board if their match context differs.

## 20. Smartphone orientation

Shut the Box gameplay is **LANDSCAPE ONLY on smartphones**.

Portrait must not compress the game.

Instead portrait displays a blocking rotate-device screen, for example:

**HANDY DREHEN**  
Dieses Spiel ist für die horizontale Ausrichtung optimiert.

The active game remains mounted.

Changing orientation must:
- not reload the page
- not restart the game
- not reset the board
- not lose selections
- not change match state

Returning to landscape immediately restores the current game view.

This is Shut-the-Box-specific and must not automatically transfer to other games.

## 21. Responsive target

Gameplay is **mobile-landscape-first**.

Current first-layout direction:

Upper region:
- one continuous 1–12 number row

Lower region:
- information/status area on the left
- dice/action area on the right

Exact proportions are not yet fixed.

## 22. Board visual language

Board:
- 2D
- one continuous horizontal sequence
- numbers 1–12

Exact visual treatment is not fixed.

Four visual variants will be designed and compared before selecting the canonical board style.

Mechanics and layout must not depend on one decorative variant.

## 23. End-game result

After the final regular round, accumulated Restpunkte are revealed.

Use the established **DNA End Game Merge pattern** as reference, adapted semantically for Shut the Box.

Relevant game-score label:
**RESTPUNKTE**

Lower accumulated Restpunkte rank higher.

The existing global tournament-point merge remains governed by Skielsen End Game Merge rules.

## 24. Tie-break — Normal

If two or more parties have identical final Restpunkte in Normal:
- every tied party plays one additional Normal board
- only tied parties participate
- if another tie remains, repeat until resolved

## 25. Tie-break — Sabotage

For standard two-team/four-team Sabotage ties, tied parties enter a **Showdown**.

The intended standard Showdown consists of **2 Sabotage rounds** between the relevant parties.

For the special three-team Sabotage format:
- the one regular circular round is followed by **Sudden Death for tied positions**

If two parties remain tied:
- direct 1v1 mutual Sabotage

If three parties remain tied:
- another circular Sabotage board may be played

Continue only as necessary to resolve the relevant tied position.

## 26. Sound and haptics

Sound and vibration are planned but deferred.

Potential feedback:
- dice roll
- dice landing
- number selected
- number flipped
- invalid selection
- confirmation
- board finished
- Shut the Box
- result/reveal

The first layout/mechanics must not depend on audio or haptics.

## 27. App-first rule

Shut the Box is developed directly inside the integrated Skielsen application.

From the beginning it uses the real:
- tournament context
- player/team data
- theme system
- authorization model
- navigation/frame
- Ready flow
- ranking
- End Game Merge

A standalone version is **not** the canonical implementation.

Temporary technical test surfaces may be used where useful, but product behavior must be implemented and validated in the integrated app.

## 28. Current flow

### Normal
`MODE → READY PLAYER SELECTION → GAME ROUND 1 → WAIT → ROUND 2 → WAIT → ROUND 3 → RESULT/REVEAL → TIEBREAK IF REQUIRED → END GAME MERGE`

### Sabotage — 2 teams
`MODE → READY → 1v1 ROUND 1 → WAIT → ROUND 2 → WAIT → ROUND 3 → RESULT → SHOWDOWN IF REQUIRED → MERGE`

### Sabotage — 4 teams
`MODE → READY → TWO PARALLEL 1v1 MATCHES → WAIT → ROTATE PAIRINGS → ROUND 2 → ROUND 3 → RESULT → SHOWDOWN IF REQUIRED → MERGE`

### Sabotage — 3 teams
`MODE → READY → A→B→C→A CIRCULAR SABOTAGE → RESULT → SUDDEN DEATH FOR TIED POSITIONS → MERGE`

### Solo Sabotage
`MODE → READY → HUMAN ROLLS / BOT DECIDES → 3 ROUNDS → RESULT → MERGE/FINISH`

## 29. Intentionally open before implementation

Still open for visual/UX exploration:
- which of four 2D board variants is selected
- exact number-tile size and form
- exact landscape screen split
- dice-field design
- X/Y presentation
- TEAM X ENTSCHEIDET presentation
- locked-action presentation
- dice animation style
- portrait rotate-screen design
- visual adaptation of DNA waiting/result screens
