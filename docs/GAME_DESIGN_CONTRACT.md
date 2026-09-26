# SKIELSEN · GLOBAL GAME DESIGN & IMPLEMENTATION CONTRACT

Stand: V1.5  
Geltung: **alle zukünftigen SKIELSEN Games ab der ersten Standalone-Version**

## 1. Hierarchie

1. **Theme Contract** bestimmt Farben, Kontraste und semantische Tokens.
2. **Game Design Contract** bestimmt Canvas, Header, Status, Player-Anzeigen, Action-Bereiche, Result-Komponenten, responsive Verhalten und Daten-Bindings.
3. **Game Module** gestaltet ausschließlich die jeweilige Mechanik.

Kein Game darf Theme- oder Contract-Verantwortung selbst übernehmen.

## 2. Stable Geometry

Innerhalb eines aktiven Play-Flows behalten gemeinsame UI-Bereiche ihre Position und Größe:

- App Header
- Progress
- Status Header
- Player-Anzeigen
- Action-/Input-Bereich

Zustandswechsel dürfen das Seitenraster nicht springen lassen.

Nur der **game-spezifische Mechanik-Bereich** darf seine Inhalte animieren oder morphen.

## 3. Animation Boundary

Animationen sind ausschließlich dort erlaubt, wo sie Teil der Spielmechanik sind.

Nicht animieren:
- Shared Header
- Status
- Player-Cards
- globale Buttons/Actions
- Seitenbreite
- äußere Container-Höhen

Ausnahmen müssen ausdrücklich im Game Contract dokumentiert sein.

## 4. Responsive

- gemeinsamer Desktop-Canvas: maximal 760 px
- Mobile: 100 %
- primärer Breakpoint: 720 px
- Action-Layout darf auf Mobile nicht ohne Mechanik-Grund seine Reihenfolge oder Position ändern
- Keyboard-/Viewport-Sonderfälle müssen explizit als Mechanik-Anforderung dokumentiert sein

## 5. Theme Authority

Keine Theme-Farben im Game hardcoden.

Variable Farben kommen aus:
- Tournament Theme Runtime
- semantischen Theme Tokens
- festen Player-Identitätsfarben Rot / Blau / Grün / Gelb

Jedes Game muss mindestens Surface-, On-Surface-, Border-, Accent-, Primary-, Secondary-, Success-, Warning-, Danger- und Input-Tokens korrekt verwenden.

## 6. Standalone → Database Contract

Eine Standalone gilt erst als integrationsbereit, wenn jede variable Information bereits klassifiziert ist.

Jede Variable braucht:

| Feld | Pflicht |
|---|---|
| UI Element | ja |
| Variable / Source Key | ja |
| Datentyp | ja |
| Datenquelle / RPC / Tabelle | ja |
| Null-/Fallback-Verhalten | ja |
| State/Phase | ja |
| Theme-Abhängigkeit | falls relevant |
| Client- oder Serverautorität | ja |

Beim Merge in die Vollversion darf keine variable Herkunft erst nachträglich erraten werden.

## 7. Variablenklassen

Jede Standalone trennt explizit:

1. **Static Layout** – Maße, Struktur, fixe Copy.
2. **Theme Tokens** – Farben und Kontraste.
3. **Content Variables** – Namen, Labels, Werte, Texte.
4. **State Variables** – Phase, Ready, Active, Out, Complete usw.
5. **Interaction State** – Eingaben, Auswahl, temporäre UI-Zustände.
6. **Database Mapping Layer** – konkrete Quelle der produktiven Werte.

## 8. Player Contract

Variable Player-Informationen dürfen nicht hartcodiert werden.

Mindestens erforderlich, sofern im Game sichtbar:
- participant/member ID
- display name
- identity color / team slot
- game-specific score
- active/finished/out state

Player-Reihenfolge muss während eines Play-Flows stabil bleiben, sofern die Mechanik kein Ranking-Reorder verlangt.

### Symmetry & Alignment

Symmetry is a first-class layout rule for shared game UI. Repeated peer elements such as Player-/Team-Cards, status cells, mode cards and result rows must use equal geometry whenever their semantic role is equal.

Primary content in equal peer elements must be centered **horizontally and vertically** unless the mechanic explicitly requires another alignment. Do not simulate centering through approximate padding; use layout alignment (`align-items`, `justify-content` or `place-items`) so mobile and desktop remain geometrically symmetric.

## 9. Result Contract

Jedes Game beendet mit dem gemeinsamen Result-Pattern.

Game-spezifisch sind nur:
- Spaltennamen
- Werte
- Tiebreak-relevante Daten

Für jede Result-Spalte muss die Datenquelle vor der Integration feststehen.

## 10. Mobile Keyboard / Visual Viewport Contract

Games that require text input must be designed around the **browser-resized visual viewport** while the native keyboard is open.

Required:
- `interactive-widget=resizes-content`
- no double keyboard-offset compensation
- no custom onscreen keyboard unless the mechanic explicitly requires one
- native input capture may be visually hidden, but must remain focusable
- all essential gameplay information must remain visible above the keyboard

For keyboard-heavy games, Mobile may use a **Minimal HUD**:
- game progress / step
- own score or own required KPI
- time
- core mechanic
- feedback

Secondary information such as full rosters, history, extra stats and explanatory action copy must be removed from the keyboard viewport.

## 11. Progress vs Timer Contract

Progress and time are different semantics and must never share one UI channel.

- Shared Progress directly below the Game Header = overall game progress.
- Round/word/turn timer = separate mechanic-specific indicator.
- Timer danger states change semantic color; they must not create unnecessary layout-changing boxes.
- Timer calculations use server-authoritative deadline/time data where available.

## 12. Setup Page Contract

A configuration/setup state is a **separate page/state**, not an overlay positioned on top of the gameplay body.

If a setting affects shared server state or a common random seed/chain:
- select it exactly once at session level
- persist it before gameplay state is created
- non-authorized clients wait instead of selecting their own variant

## 13. Game Mode Page Contract

Die Game Mode Page ist eine gemeinsame Setup-Page und wird nur angezeigt, wenn ein Game mindestens **zwei auswählbare Game Modes** besitzt. Bei genau einem zulässigen Mode wird die Page übersprungen.

### Desktop > 720 px

- gemeinsamer Canvas: maximal 760 px
- alle verfügbaren Game Modes stehen in genau einer Reihe
- Anzahl der Spalten = Anzahl der verfügbaren Game Modes
- Grid-Gaps werden zuerst vom verfügbaren Canvas abgezogen
- der verbleibende Platz wird gleichmäßig auf alle Mode-Cards verteilt
- alle Mode-Cards einer Page haben dieselbe Höhe
- verbindliches Grid: `grid-template-columns: repeat(var(--game-mode-count), minmax(0, 1fr))`
- Standard-Gap: 10 px
- keine gamespezifisch fest codierten 2-, 3- oder 4-Spalten-Layouts

Beispiele:
- 2 Modes → zwei gleich breite Cards minus einen Gap
- 3 Modes → drei gleich breite Cards minus zwei Gaps
- 4 Modes → vier gleich breite Cards minus drei Gaps

### Mobile <= 720 px

- immer genau eine Spalte
- alle Game Modes untereinander
- Reihenfolge entspricht der vom Game gelieferten Mode-Reihenfolge
- Cards nutzen die verfügbare Canvas-Breite
- gleicher vertikaler Abstand zwischen allen Cards
- verbindliches Grid: `grid-template-columns: 1fr`

### Datenbindung

Die Mode-Anzahl wird aus der tatsächlich verfügbaren Mode-Liste abgeleitet und als `--game-mode-count` oder äquivalenter Shared-Component-Parameter an das Grid übergeben. Sie darf nicht im Game-CSS hardcodiert werden.

## 14. Difficulty Selection Page Contract

Die Difficulty Selection Page folgt exakt derselben Layoutlogik wie die Game Mode Page.

Die Page wird nur angezeigt, wenn ein Game mindestens **zwei auswählbare Schwierigkeitsgrade** besitzt. Bei genau einem zulässigen Schwierigkeitsgrad wird die Page übersprungen.

### Desktop > 720 px

- gemeinsamer Canvas: maximal 760 px
- alle verfügbaren Difficulties stehen in genau einer Reihe
- Anzahl der Spalten = Anzahl der verfügbaren Difficulties
- Grid-Gaps werden zuerst vom verfügbaren Canvas abgezogen
- der verbleibende Platz wird gleichmäßig auf alle Difficulty-Cards verteilt
- alle Difficulty-Cards einer Page haben dieselbe Höhe
- verbindliches Grid: `grid-template-columns: repeat(var(--difficulty-count), minmax(0, 1fr))`
- Standard-Gap: 10 px
- keine gamespezifisch fest codierten 2-, 3- oder 4-Spalten-Layouts

### Mobile <= 720 px

- immer genau eine Spalte
- alle Difficulties untereinander
- Reihenfolge entspricht der vom Game gelieferten Difficulty-Reihenfolge
- Cards nutzen die verfügbare Canvas-Breite
- gleicher vertikaler Abstand zwischen allen Cards
- verbindliches Grid: `grid-template-columns: 1fr`

### Datenbindung

Die Difficulty-Anzahl wird aus der tatsächlich verfügbaren Difficulty-Liste abgeleitet und als `--difficulty-count` oder äquivalenter Shared-Component-Parameter an das Grid übergeben. Sie darf nicht im Game-CSS hardcodiert werden.

## 15. Result Page Contract

Result is a separate page/state, never an inline replacement inside the active gameplay mechanic.

Shared order:
1. Shared Header
2. Progress = complete
3. Status = ERGEBNIS only
4. Result Table
5. Primary exit/continue action

Default result column order:
1. POSITION
2. [Identity Accent] NAME
3. game-specific metrics, e.g. ZEIT
4. game-specific SCORE/value

Final result rows must use the same entity level as Tournament Placements. Do not mix Player-level rows with Participant-/Team-level placements.

## 16. Hidden Information Contract

Standalone mock data must explicitly mark which information is allowed to reach the production client.

A production client must not receive hidden solution information only because the Standalone needs it locally.

Examples:
- hidden target word: server only
- future chain/answers: server only
- target length: only when the game mode explicitly allows it
- input buffer / animation state: client only, never persisted

## 17. Standalone Implementation Gate

Vor Merge müssen geprüft sein:

### Layout
- feste gemeinsame Container
- keine unerwünschten Layout-Sprünge
- Mobile/Desktop geprüft
- Animationen nur in erlaubter Zone

### Theme
- alle unterstützten Themes geprüft
- keine Hardcoded Theme-Farben
- Kontraste über semantische Tokens

### Daten
- jede Variable mit Source Key dokumentiert
- Datentyp dokumentiert
- Fallback dokumentiert
- Server-/Client-Autorität dokumentiert
- Result-Mapping vollständig

### Workflow
- Standalone visuell geprüft
- Produktionsmodul auf dieselben Contract-Regeln gemappt
- GitHub Validation/Deploy erfolgreich

## 18. Referenz-Testseiten

- Game Design Contract: `/game-design-contract.html`
- Mehr oder Weniger: `/more-or-less-contract-test/`
- Wortkette: `/word-chain-test/`

Diese Testseiten sind Design-/Implementierungsreferenzen und keine Ersatzquelle für serverautoritatives Gameplay.


## Feature gating

Optional tournament systems are hard workflow gates, not cosmetic switches.

- Betting UI, market creation, decisions, settlement and match gates exist only while `feature.betting` is enabled.
- Joker UI, inventory, submission, resolution, reveal and Joker-specific preparation exist only while `feature.joker` is enabled.
- MVP voting exists only in TEAM mode and while `feature.mvp_voting` is enabled.
- LVP voting exists only in TEAM mode and while `feature.lvp_voting` is enabled.
- In SOLO mode MVP/LVP settings are unavailable and server-side vote RPCs reject attempts to open or submit those votes.
- Disabled features must not leave placeholder workflow steps such as a Joker round or Betting gate in Match Control.

## Canonical In-App Game Lifecycle

Every In-App game follows one ordered lifecycle. Optional setup steps are skipped only when the game does not require them:

1. **MODE_SELECTION** — Admin chooses the play type (for example ALTERNATING / SIMULTANEOUS) only for games that require a play-mode choice.
2. **DIFFICULTY_SELECTION** — Admin chooses the difficulty only for games that expose difficulty.
3. **READY** — mandatory final pre-game gate. Show all assigned players, a short game description/rule summary, and explicit player readiness. No gameplay starts before this gate, except a game-specific QA force-start override.
4. **GAME** — the actual playable state.
5. **RANKING** — after the server finalizes the game result, keep the game surface open and show the End Game Ranking using the game-specific result metric.
6. **JOKER_RESOLUTION** — conditional. If `feature.joker` is enabled and a pending result-affecting Joker exists for this game, resolve/reveal it here. Example: DOUBLE_POINTS changes the placement points before the tournament merge. If no post-game Joker is pending, skip this state.
7. **MERGE** — play the canonical End Game Merge animation. Merge the game placement points (including any resolved Joker effect) into the existing tournament points, then animate the updated tournament order and semantic movement indicators.
8. **CLOSE** — only after MERGE is complete may the user explicitly close the finished game. Only then may later tournament flow (MVP/LVP, awards, next game routing, etc.) take over.

### Lifecycle invariants

- Setup pages are real states/pages, never overlays over gameplay.
- Setup order is fixed: mode before difficulty, difficulty before ready.
- READY is always the last gate before GAME, even when MODE_SELECTION and/or DIFFICULTY_SELECTION are skipped.
- A game must never jump directly from GAME or RANKING to tournament post-game UI.
- RANKING is the unmodified End Game Ranking. Tournament points are not merged into the visible tournament standings before the Joker gate has completed or been skipped.
- Result-affecting Joker resolution belongs between RANKING and MERGE. DOUBLE_POINTS therefore changes the points consumed by MERGE, not the already-finished game metric/placement.
- A Joker whose mechanic must affect gameplay setup itself (for example an opponent-selection mechanic) may require an earlier preparation action; that exception must not remove READY as the final gate before GAME.
- MERGE is mandatory after RANKING, even when Joker is disabled; with no Joker it uses the normal placement points directly.
- CLOSE stays unavailable until MERGE has reached its final state.
- RANKING / JOKER_RESOLUTION / MERGE must survive a missing or already-finished active-session poll until CLOSE.
- Every transient state must have a recovery path. A client may re-poll incomplete resolution/merge state, and a lost transition must not create a permanent dead end.
- `docs/END_GAME_MERGE_TEMPLATE.html` is the canonical visual/animation reference for MERGE.
- `window.skielsenInApp.flowContract` is the runtime source for the canonical stage order.

## Quick Games

Quick Games is a separate authenticated flow outside a tournament. It must not create tournament points, trigger Joker/MVP/LVP steps or enter the Tournament Merge lifecycle.

- The account landing page links to the Quick Games catalogue.
- A host selects one integration-ready game and receives a `QG-` lobby code.
- Other authenticated users join that lobby from their own devices.
- The host explicitly fills all remaining seats with bots before starting, unless every human seat is occupied.
- Starting the lobby locks the roster and sends every joined client to the selected game.
- If the selected game has a content setup, the host configures it after the roster is locked; joined clients wait for that shared setup and receive the same configuration.
- A Quick Game ends on its shared game ranking and returns to Quick Games; it never continues into Tournament Merge.
- Lobby membership, start authority and submitted results are server-authoritative and protected by RLS/security-definer RPCs.
- Game-specific contracts define how human seats and bots map onto that game's participant model.
