# WORTKETTE · FULLVERSION INTEGRATION PLAN

> **DB STATUS · 2026-09-20:** Migration `20260920191432_prepare_word_chain_v4_integration` ist auf Supabase angewendet und per Rollback-Integrationstest validiert. Difficulty-RPC, Run-Snapshots, V4-State-Shape und Result-Metadaten sind vorhanden. `require_difficulty_selection` bleibt bis zum Frontend-Merge absichtlich `false`, damit die aktuelle Vollversion rückwärtskompatibel bleibt.

Stand: 2026-09-20  
Referenz-Standalone: `/word-chain-test/` · Deploy Run #556  
Produktionsmodul: `public/assets/js/12-word-chain-game.js`  
Produktionsstyles: `public/assets/css/wortkette-game.css`
Design Contract: `docs/WORTKETTE_DESIGN_CONTRACT_V2.md`
Game Contract: `docs/WORTKETTE_GAME_CONTRACT_V2.md`  
Runtime: `public/assets/js/08-inapp-runtime.js`  
Kanonisches Game: `game.wortkette.compound_nouns`  
In-App Module: `word-chain`  
In-App Game Key: `word_chain`

## 1. Zielbild

Die aktuelle Contract-Testversion wird **nicht als neue Parallel-App** eingebaut. Sie ersetzt die UI- und Interaction-Schicht des bereits existierenden nativen Wortkette-Moduls und bleibt vollständig im bestehenden In-App-/Tournament-Workflow.

Unverändert bleiben:
- Tournament Game Lifecycle
- In-App Session Lifecycle
- Ready-Seite
- QA Force-Start über serverseitiges Feature-Flag
- gemeinsame serverseitige Kette für alle Player
- eigener Run, Timer und Score je Player
- serverseitige Guess-Validation
- Tournament-Finalisierung
- Joker-/Ledger-Handoff

Neu werden:
- eigener Difficulty-Setup-State vor dem ersten Player-Run
- EASY / NORMAL / HARDCORE als **sessionweite** Auswahl
- Hangman-Slot-UI statt sichtbarem Textfeld
- Native Mobile Keyboard über unsichtbaren Input-Capture
- mobiles Minimal-HUD
- separater Wort-Timer unter dem Status-Banner
- eigenständige Result-Page
- explizites Standalone→DB Mapping für jede Variable

## 2. Bestehender Fullversion-Workflow

Aktueller Ablauf:

1. Tournament Game wird aktiviert.
2. `08-inapp-runtime.js` erstellt/holt die native In-App-Session.
3. Wortkette-Player werden automatisch zugewiesen.
4. Wortkette bleibt bewusst bei `WAITING_FOR_PLAYERS`.
5. Jeder Player sieht die Ready-/Rule-Set-Seite.
6. Player setzen `READY`.
7. Admin startet explizit die Session.
8. QA-Override darf nur über `public_state.force_start_without_ready` den Ready-Gate umgehen.
9. Session wird `ACTIVE`.
10. Runtime mounted `12-word-chain-game.js`.
11. Das Modul ruft aktuell sofort `start_word_chain_tournament_player()` auf.
12. Der erste Player erzeugt unter Session-Lock die gemeinsame versteckte Kette.
13. Alle weiteren Player erhalten unabhängige Run-/Timer-Zustände mit derselben `chain[]` und denselben `edge_ids[]`.
14. Jede Wortabgabe läuft über `submit_word_chain_tournament()`.
15. Wenn alle Runs fertig sind, finalisiert `private.finalize_word_chain_tournament_result()`.
16. Ergebnis wird in Tournament Results / Placements / Ledger geschrieben.
17. Client übergibt `tournament_result` zusätzlich an `ingestInAppGameResult()`.

Dieser Workflow bleibt die Grundlage.

### Fullversion Frame\n\nThe global fullversion `.sk-header` remains visible while Wortkette is open. The game module renders no second header. Setup, Play and Result are states inside the existing In-App layer below the fullversion header. Mobile and Desktop use different layouts within this same frame.\n\n## 3. Neuer Ziel-Workflow

### Phase A · READY

Keine Änderung am bestehenden Ready-Flow.

- gleiche Kette für alle Player
- falsches gültiges Wort = −1 + Hinweis
- Timeout = −1 + Hinweis
- niedrigster Minus-Score / höchster Score gewinnt; Dauer ist Tie-Break
- Admin startet die Session

### Phase B · DIFFICULTY SETUP

Nach `ACTIVE`, aber **vor dem Erzeugen eines Player-Runs**, erscheint die neue Setup-Page.

Die Auswahl ist sessionweit und darf nur einmal durch den Admin erfolgen.

| Tier | occurrence_threshold | show_word_length |
|---|---:|---|
| EASY | 50 | true |
| NORMAL | 35 | false |
| HARDCORE | 15 | false |

Warum sessionweit:
- alle Player lösen dieselbe Kette
- Threshold bestimmt den Kettenpool
- eine individuelle Difficulty pro Player würde den Same-Chain-Vertrag brechen

Nicht-Admins sehen währenddessen:
`ADMIN WÄHLT DEN SCHWIERIGKEITSGRAD`

Erst nach erfolgreicher Difficulty-Auswahl dürfen Clients `start_word_chain_tournament_player()` oder `get_word_chain_tournament_state()` aufrufen.

### Phase C · PLAY

Server erzeugt die gemeinsame Kette exakt einmal.

Jeder Player besitzt weiterhin:
- eigenen `word_chain_tournament_runs` Datensatz
- eigenen `word_chain_solo_sessions` Fortschritt
- eigenen Score
- eigenen Timer
- eigene Fehlversuche
- eigenen Abschlusszeitpunkt

Die Lösungskette bleibt serverseitig geheim.

### Phase D · PLAYER FINISHED

Sobald der eigene Run beendet ist:
- Mobile Keyboard schließen
- PLAY-Page verlassen
- eigene Result-Page öffnen
- wenn noch nicht alle fertig sind: Result-Page bleibt im Waiting-State
- finale Positionen erst anzeigen, wenn Tournament Result finalisiert ist

### Phase E · TOURNAMENT RESULT

Finale Tabelle:

`POSITION | [IDENTITY ACCENT] NAME | ZEIT | SCORE`

Danach:
`TURNIER ANSEHEN →`

## 4. Frontend-Integration

### 4.1 `12-word-chain-game.js`

Das Produktionsmodul soll die Standalone-Struktur übernehmen, nicht den Standalone-State.

Benötigte States:
- `DIFFICULTY`
- `PLAY`
- `RESULT_WAITING`
- `RESULT_FINAL`

Die bestehende READY-Page bleibt Eigentum von `08-inapp-runtime.js`.

### Difficulty

Analog zu Mehr oder Weniger:
- `pendingTier='NORMAL'`
- Admin erkennt sich über bestehenden Runtime/Admin-Kontext
- `set_word_chain_difficulty(session_id,tier)`
- danach Session neu pollen
- erst bei vorhandenem `public_state.word_chain_difficulty` State-RPC laden

### PLAY

Aktuelle sichtbare Textbox wird entfernt.

Desktop:
- Shared Header
- Game Progress
- Status
- optional sekundäre Player-/Ketteninformation gemäß Contract
- Wortmechanik
- kein eigenes Theme-Chrome

Mobile:
- nur Shared Header
- Game Progress
- Status: `X/10 | eigener Score | Zeit`
- direkt darunter Wort-Timer-Bar
- Wortmechanik
- keine Kettenhistorie
- keine anderen Player-Cards
- keine zusätzliche Action-Leiste

### Native Mobile Input

Kein selbst gerendertes Keyboard.

Ein unsichtbarer, aber fokussierbarer Input öffnet iOS-/Android-Systemkeyboard.

Client hält nur:
- `inputBuffer`
- `acceptedBuffer` für kurze Reveal-Darstellung

Diese Werte werden **nicht** persistiert.

Enter ist die einzige manuelle Submit-Aktion.

### Slot-Provenienz

- erster Startbuchstabe: Theme Accent
- User-Typing: Theme Accent
- durch Fehler/Timeout aufgedeckte Buchstaben: Danger
- leerer Initialslot: neutral
- NORMAL/HARDCORE: vor erster Eingabe genau ein neutraler Next-Slot
- nach erster User-Eingabe kein automatisch neuer Next-Slot
- EASY: komplette Wortlänge als neutrale Slots sichtbar

### Doppelinitiale

Client und Server behalten die bestehende Regel:
- sichtbares `G` + User tippt `GELD` → zweites reflexives G ignorieren
- echtes `LL...` → zweites L nicht entfernen

### Timer

Es gibt zwei verschiedene Balken mit unterschiedlicher Semantik:

1. Shared Game Progress direkt unter Shared Header  
   `step / total_steps`

2. Mobile Wort-Timer direkt unter Status-Banner  
   `deadline_at / time_limit_seconds / server_now`

Wort-Timer:
- > 5 s: `--theme-accent`
- <= 5 s: `--theme-danger-bg`
- Textzeit wird ebenfalls rot
- keine rote Bounding Box

Der Timer wird nie allein vom Client neu gestartet. Deadline bleibt serverautoritativ.

## 5. Backend-Änderungen

### 5.1 Neue RPC: `set_word_chain_difficulty`

Empfohlene Signatur:

`set_word_chain_difficulty(p_session_id uuid, p_tier text) returns jsonb`

Muster: `set_higher_lower_tier`.

Validierung:
- authenticated
- Tournament Admin
- Session gehört zu `word_chain`
- Session = `ACTIVE`
- Tier ∈ EASY, NORMAL, HARDCORE
- es existiert noch kein Wortketten-Run für diese Session

Mapping:
- EASY → threshold 50, show_word_length true
- NORMAL → threshold 35, show_word_length false
- HARDCORE → threshold 15, show_word_length false

In `in_app_game_sessions.public_state_json` schreiben:
- `word_chain_difficulty`
- `occurrence_threshold`
- `show_word_length`
- `difficulty_selected_by`
- `difficulty_selected_at`
- `word_chain_rules_version`

Die RPC darf keine bereits gestartete Kette umkonfigurieren.

### 5.2 `start_word_chain_tournament_player`

Aktuell liest die RPC Threshold/Timer aus `in_app_game_definitions.config_json`.

Neu:
- Session `public_state_json` zusätzlich laden
- Difficulty-Auswahl muss vorhanden sein
- Threshold aus Session Public State
- Show-Word-Length aus Session Public State
- Timer weiterhin serverseitig
- Steps weiterhin serverseitig
- erster Run erzeugt gemeinsame Kette
- weitere Runs clonen exakt diese Kette

Kein Fallback auf eine stillschweigend andere Difficulty, sobald die neue Rules-Version aktiv ist.

### 5.3 `get_word_chain_tournament_state`

Aktuell startet diese RPC bei fehlendem Run automatisch einen Run.

Neue Regel:
- solange Difficulty nicht gewählt: **keinen Run erzeugen**
- entweder definierter `DIFFICULTY_NOT_SELECTED` State oder Client ruft die State-RPC bis dahin nicht auf
- bevorzugt: Client gate + serverseitige Guard als zweite Schutzschicht

Zusätzliche State-Felder:
- `difficulty`
- `show_word_length`
- `target_length` **nur bei EASY**
- `rules_version`

Bereits vorhanden und weiterverwenden:
- `step`
- `total_steps`
- `base_word`
- `revealed_prefix`
- `score`
- `wrong_count`
- `current_wrong_count`
- `occurrence_threshold`
- `time_limit_seconds`
- `deadline_at`
- `server_now`
- `ignore_repeated_initial`
- `finished_players`
- `total_players`
- `live_standings`

NORMAL/HARDCORE dürfen `target_length` nicht erhalten.

### 5.4 `submit_word_chain_tournament`

Bestehende serverseitige Regeln bleiben authoritative:

- korrekt → nächster Schritt + neuer Timer
- gültiges falsches Wort → −1 + Hinweis, **Timer läuft weiter**
- ungültiges/nicht prüfbares Wort → nicht gewertet, kein Hinweis, kein Timer-Reset
- Timeout → −1 + Hinweis + neues Zeitfenster
- letzter Hinweis vervollständigt Wort → Auto-Advance
- doppelte Initiale serverseitig normalisieren

Keine Bewertung einzelner Tastendrücke.

## 6. Datenbank-Persistenz

### 6.1 Session-Level · verpflichtend

`in_app_game_sessions.public_state_json`

| Key | Typ | Beispiel |
|---|---|---|
| word_chain_difficulty | text | NORMAL |
| occurrence_threshold | numeric | 35 |
| show_word_length | boolean | false |
| difficulty_selected_by | uuid/text | user id |
| difficulty_selected_at | timestamptz/text | timestamp |
| word_chain_rules_version | integer | 4 |
| time_limit_seconds | integer | 15 |

### 6.2 Run-Level · empfohlen als echte Spalten

`word_chain_tournament_runs` besitzt bereits:
- occurrence_threshold
- time_limit_seconds
- started_at
- word_started_at
- word_deadline_at
- completed_at
- final_score
- final_wrong_count
- duration_ms

Empfohlene Ergänzungen:
- `difficulty text not null default 'NORMAL'`
- `show_word_length boolean not null default false`
- `rules_version integer not null default 4`

Warum: ein späteres Replay/Audit darf nicht vom aktuellen Session JSON abhängen.

### 6.3 Solo Session · bestehend

`word_chain_solo_sessions` bleibt zuständig für:
- chain[]
- edge_ids[]
- position
- score
- wrong_count
- current_wrong_count
- started_at
- completed_at

### 6.4 Final Result

`in_app_game_sessions.result_json` soll zusätzlich persistieren:
- difficulty
- occurrence_threshold
- show_word_length
- time_limit_seconds
- rules_version
- ranking
- tie_break
- standings[]
- player_results[]

`tournament_game_results.result_payload` soll dieselben Rule-Metadaten enthalten.

Bestehend und weiterverwenden:
- primary_value = minus_points
- secondary_value = duration_ms
- game_placements
- scoring ledger
- Joker reveal

### 6.5 Nicht persistieren

Nicht in DB schreiben:
- inputBuffer
- acceptedBuffer
- sichtbare Slot-Klassen
- Timer-Bar-Breite
- Keyboard-Fokus
- responsive Layout-State
- Animation-State
- verstecktes Zielwort im Client
- target_length für NORMAL/HARDCORE

## 7. Ranking · vor Merge bereinigen

Aktueller tatsächlicher Finalizer:

1. Score absteigend
2. Dauer aufsteigend
3. serverseitiger Loswert

Das entspricht:
- wenigste Minuspunkte zuerst
- bei Gleichstand schnellere Zeit
- danach Los

Dieser Vertrag passt zur aktuellen Contract-Test-Result-Tabelle.

Aktuell widersprüchlich:
- `in_app_game_definitions.config_json.ranking = FEWEST_MINUS_POINTS`
- Finalizer = Score → Dauer → Los
- mehrere `tournament_games.game_rules_snapshot` enthalten noch `FASTEST_FIRST`
- alter Handover-Text enthält noch einen FASTEST-FIRST/SIMULTANEOUS-RACE-Verweis

Vor Merge muss **ein** kanonischer Vertrag gelten:

`FEWEST_MINUS_POINTS → DURATION → RANDOM_DRAW`

Alle Rule-Snapshots, Docs und Result-Payloads müssen darauf vereinheitlicht werden.

## 8. Result-Page

Result darf nicht im PLAY-Body eingebettet bleiben.

Verbindliche eigene Page:

- Shared Header
- Shared Progress = 100 %
- Status = nur `ERGEBNIS`
- Result Table
- Primary Action `TURNIER ANSEHEN →`

Spalten:
1. POSITION
2. [Identity Accent] NAME
3. ZEIT
4. SCORE

### Solo vs Team

Die finale Tabelle muss Participant-Level anzeigen, weil Placements Participant-Level sind.

SOLO:
- Name = `tournament_members.display_name_snapshot`
- Farbe = `participants.identity_color`

TEAM:
- Name = `teams.name`
- Farbe = `participants.identity_color`
- Score / Dauer = aggregierter Participant-Wert aus `standings[]`

Nicht Player-Level-Zeilen mit Participant-Level-Placement mischen.

Empfehlung: Finalizer bzw. Result-RPC liefert direkt:
- participant_id
- participant_type
- display_name
- identity_color
- placement
- duration_ms
- score

Damit braucht der Client kein eigenes Join-Wissen.

## 9. Theme Contract

Keine neuen festen UI-Farben.

Verwenden:
- Surface / On-Surface
- Border
- Accent
- Primary Action
- Success
- Warning
- Danger
- Input Tokens
- Player Identity Colors

Slot-Regel:
- Initial = theme accent
- User Input = theme accent
- Hint Reveal = theme danger
- Empty = input border

Result-Akzent = Player/Participant Identity Color, nicht Theme Accent.

## 10. Mobile Contract

Mit geöffneter nativer Tastatur muss der gesamte spielrelevante Bereich im verbleibenden Visual Viewport liegen.

Sichtbar:
- Shared Header
- Game Progress
- X/10
- eigener Score
- Zeit
- Wort-Timer-Bar
- Ausgangswort
- Plus
- gesuchtes Wort / Slots
- Feedback

Nicht sichtbar:
- Kettenhistorie
- andere Player-Cards
- sekundäre Statistiken
- Action-Erklärung
- Contract/Test-Chrome

Viewport:
- `interactive-widget=resizes-content`
- keine doppelte Keyboard-Kompensation
- native Tastatur, keine eigene Onscreen-Tastatur

## 11. Dateien der Vollversion

### Ändern
- `public/assets/js/12-word-chain-game.js`
- `public/assets/css/wortkette-game.css`
- `public/assets/js/08-inapp-runtime.js` nur für Asset-Versioning / Public-State-Handoff falls nötig
- DB Migration für Difficulty + State/Result Contract
- `docs/WORTKETTE_HANDOVER.md`
- `docs/WORTKETTE_DATABASE.md`

### Nicht kopieren
Die Dateien aus `word-chain-test` dürfen nicht 1:1 in Production importiert werden. Sie sind Referenz für DOM, CSS-Verhalten und Mapping; Production behält RPC- und Runtime-Anbindung.

## 12. Implementierungsreihenfolge

1. Ranking-Vertrag festziehen.
2. DB Migration: Difficulty RPC + Run-Metadaten + State-Felder.
3. Backend Guards: keine Run-Erzeugung vor Difficulty.
4. Final Result um Name/Farbe/Rules-Metadaten erweitern.
5. Production JS auf Setup/Play/Result-State umbauen.
6. Production CSS an Standalone Contract angleichen.
7. Mobile Native Input testen.
8. Shared Chain mit 2–4 parallelen Geräten testen.
9. Team-Participant Result testen.
10. Reset / Ready / Force-Start Regression testen.
11. Result Ingest + Joker + Ledger Regression testen.
12. GitHub Pages Deploy-Artifact rendern und erst danach mergen.

## 13. Acceptance Gate

Kein Merge, bevor alle Punkte grün sind:

- Admin wählt Difficulty genau einmal.
- alle Player bekommen dieselbe Kette.
- EASY zeigt Länge.
- NORMAL/HARDCORE leaken keine Länge.
- vor ENTER keine Bewertung.
- gültig falsch = −1 + Hint ohne Timer-Reset.
- ungültig = keine Wertung.
- Timeout = −1 + Hint + neues Zeitfenster.
- Doppelinitiale korrekt.
- Mobile mit nativer Tastatur bedienbar.
- Mobile Minimal-HUD passt in kleinen Keyboard-Viewport.
- Wort-Timer-Bar lila, ab 5 s rot.
- Result ist eigene Page.
- Result-Spalten korrekt.
- Team und Solo korrekt.
- Theme-Check über alle Theme Packs.
- Reset setzt Runs vollständig zurück.
- Ready-Flow bleibt sichtbar.
- QA Force-Start bleibt serverseitig begrenzt.
- Tournament Result, Joker, Ledger und Rankings werden korrekt finalisiert.
