# SKIELSEN · GLOBAL GAME DESIGN & IMPLEMENTATION CONTRACT

Stand: V1.3  
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

## 13. Result Page Contract

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

## 14. Hidden Information Contract

Standalone mock data must explicitly mark which information is allowed to reach the production client.

A production client must not receive hidden solution information only because the Standalone needs it locally.

Examples:
- hidden target word: server only
- future chain/answers: server only
- target length: only when the game mode explicitly allows it
- input buffer / animation state: client only, never persisted

## 15. Standalone Implementation Gate

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

## 16. Referenz-Testseiten

- Game Design Contract: `/game-design-contract.html`
- Mehr oder Weniger: `/more-or-less-contract-test/`
- Wortkette: `/word-chain-test/`

Diese Testseiten sind Design-/Implementierungsreferenzen und keine Ersatzquelle für serverautoritatives Gameplay.
