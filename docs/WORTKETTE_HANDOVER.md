# WORTKETTE · HANDOVER

Stand: **V20 · Vollversion App V15.1.51**  
Repo: `luismeier95/Skielsen-web`  
Branch: `main`  
Supabase: `rlppuqjolkrwumrrjajq`  
Stabile öffentliche Route: `https://luismeier95.github.io/Skielsen-web/wortkette/`  
Pre-Merge-Validierung: `265fede687cc9e5dad00de3f0cf87aed66bdb22a`

## 1. Produktziel

Wortkette ist ein Single-Player-Spiel innerhalb von SKIELSEN. Vor jeder Runde wird serverseitig eine komplette Wortkette aus einem gerichteten Graphen deutscher Komposita erzeugt und anschließend für diese Session festgeschrieben.

Der Client kennt nie die komplette Lösungskette im Voraus.

Beispiel:

`NOTE(N) + ?`

Gesuchte Lösung könnte `BANK` sein, daraus entsteht `NOTENBANK`. Das nächste Ausgangswort ist danach `BANK`.

## 2. Kernregeln

- Eine Session besteht aktuell aus 10 Übergängen.
- Das Ausgangswort ist sichtbar.
- Vom gesuchten nächsten Nomen ist zunächst nur der erste Buchstabe sichtbar.
- Die Wortlänge bleibt verborgen.
- Kontrollierte Fugenelemente werden direkt am Ausgangswort in Klammern angezeigt.
- Zulässige Fugenelemente sind aktuell: `N`, `S`, `EN`, `E`, `ER`, `ES`.
- Das eigentliche Kettenwort bleibt immer das reine Nomen.
- Beispiel: `TASCHE(N) + GELD = TASCHENGELD`; danach ist `GELD` das nächste Ausgangswort.
- Stammänderungen wie `SCHULE -> SCHUL-` sind nicht automatisch erlaubt.

## 3. Eingabe- und Timerlogik

### Richtige Eingabe
- Exaktes gesuchtes Nomen eingegeben.
- Wort wird abgeschlossen.
- Nächster Kettenschritt startet.
- Timer wird für das neue Wort neu gestartet.

### Existierendes, aber falsches Wort
- Wird serverseitig über deutsches Wiktionary geprüft.
- Kostet `-1 Punkt`.
- Deckt genau einen weiteren Buchstaben des Zielworts auf.
- **Der laufende Timer wird nicht zurückgesetzt.**

### Nicht existentes / zufälliges Wort
- Versuch wird vollständig ignoriert.
- Kein Punktabzug.
- Kein zusätzlicher Buchstabe.
- Kein Fortschritt.
- **Kein Timer-Reset.**

### Timeout
- Kostet `-1 Punkt`.
- Deckt einen weiteren Buchstaben auf.
- Danach beginnt für dasselbe Wort ein neues Zeitfenster.

### Automatische Vervollständigung
Wenn ein automatischer Tipp den letzten fehlenden Buchstaben aufdeckt:
- Wort gilt sofort als abgeschlossen.
- Kein zusätzliches ENTER nötig.
- Kette geht automatisch weiter.

### Reflexiv doppelt eingegebener erster Buchstabe
Der erste Buchstabe des Zielworts ist bereits sichtbar. Gibt der Spieler ihn reflexartig noch einmal ein:
- wird dieser zusätzliche Buchstabe ignoriert,
- **außer** das echte Zielwort beginnt tatsächlich mit genau diesem Doppelbuchstaben.

Diese Regel ist client- und serverseitig abgesichert.

## 4. Wortexistenzprüfung

Backend-Funktion:

`word_chain_word_exists(text)`

Aktuell wird über die MediaWiki-API des deutschen Wiktionary geprüft, ob eine Seite für das Wort existiert.

Cache:

`word_chain_lexicon_cache`

- positive und negative Ergebnisse werden gespeichert
- Cache-Zeitraum aktuell 180 Tage
- fällt die externe Prüfung aus, wird ein falscher manueller Versuch vorsichtshalber **nicht** gewertet

Wichtig: Die aktuelle Prüfung bestätigt Seitenexistenz, nicht streng die Wortart `Nomen`. Das ist ein möglicher späterer Härtungspunkt.

## 5. Datenmodell

### `word_chain_edges`

Zentrale gerichtete Graph-Kante:

`base_word + link_suffix + next_word = compound_word`

Wichtige Felder:

- `edge_id`
- `base_word`
- `link_suffix`
- `next_word`
- `compound_word`
- `review_status`: `candidate | seed | verified | rejected`
- `quality_score`: 1–5
- `familiarity_score`: 1–5
- `use_count`
- `last_used_at`
- `occurrence_score`
- `corpus_zipf`
- `frequency_source`
- `frequency_decision`
- `frequency_override_keep`
- `frequency_override_note`

Aktuell sind **445 nicht abgelehnte Verbindungen** im Pool erhalten.

Wichtig: Der Frequency-Threshold löscht oder deaktiviert diese Verbindungen nicht mehr dauerhaft.

## 6. Frequency-Threshold

Auf der Startseite gibt es einen Slider von 0 bis 50.

Der Wert wird **pro Session** an den Generator übergeben:

`start_word_chain_solo(player_key, steps, occurrence_threshold)`

Beispiele aus dem aktuellen Pool:

- Threshold 0 -> 445 Verbindungen
- Threshold 15 -> 429
- Threshold 25 -> 417
- Threshold 35 -> 380
- Threshold 45 -> 289
- Threshold 50 wurde mit 10-Schritt-Ketten erfolgreich getestet

`frequency_override_keep=true` übersteuert den Threshold bewusst für bekannte Alltagswörter, die vom Korpus unterschätzt werden.

Erste Overrides:

- BILDBUCH
- OBJEKTIVDECKEL
- STIFTHALTER
- LANDUNGSPUNKT
- WEITENREKORD
- ZAUNTOR
- SESSELBEIN

## 7. Frequency-Audit

Audit-Datei:

`data/wortkette-frequency-audit.json`

Script:

`tools/score_word_chain_frequency.py`

Workflow:

`.github/workflows/wortkette-frequency.yml`

Verwendete Signale:

- DeReWo / DeReKo
- wordfreq 3.1.1

Der Audit aktualisiert Scores, löscht aber keine Graph-Kanten.

## 8. Generator / Novelty

Persönlicher Player-Key wird im Browser persistent gespeichert.

Generator berücksichtigt u. a.:

- globales `use_count`
- persönliche Edge-Historie
- persönliche 3er- und 4er-N-Gram-Historie
- Cooldowns
- Quality / Familiarity
- Review-Status
- zukünftige Verzweigung
- Vermeidung bereits verwendeter Wörter innerhalb derselben Kette

Tabellen:

`word_chain_player_edge_history`

`word_chain_player_ngram_history`

`word_chain_solo_sessions`

Session speichert komplette `chain[]` und `edge_ids[]` serverseitig.

## 9. Node-Health

View:

`word_chain_node_health`

Klassifikation:

- `DEAD_END` = 0 Ausgänge
- `LINEAR` = 1 Ausgang
- `THIN` = 2–3 Ausgänge
- `HEALTHY` = mindestens 4 Ausgänge

Weitere Views:

- `word_chain_terminal_nodes`
- `word_chain_expansion_queue`
- `word_chain_edge_review_queue`

Dead Ends dürfen nur am Ende einer Kette stehen. Interne Nodes müssen eine Fortsetzung besitzen.

## 10. Wichtige RPCs

- `start_word_chain_solo(text, integer, numeric)`
- `start_word_chain_solo(text, integer)` — Compatibility Wrapper, Threshold 35
- `start_word_chain_solo()` — Legacy Wrapper
- `submit_word_chain_solo(uuid, text)`
- `get_word_chain_threshold_stats(numeric)`
- `get_word_chain_input_rules(uuid)`
- `get_word_chain_frequency_targets()`

Interne Admin-/Audit-Funktion:

- `apply_word_chain_frequency_audit(jsonb, numeric)`

## 11. Frontend-Dateien

Aktuelle Hauptdateien:

- `public/wortkette/index.html`
- `public/wortkette-standalone.html`
- `public/assets/js/wortkette-standalone.js`
- `public/assets/css/wortkette-standalone.css`

Die öffentliche Hauptversion wird **immer unter `/wortkette/`** veröffentlicht.

Keine neuen öffentlichen `wortkette-vXX.html`-URLs mehr als primärer Einstieg.

Die sichtbare Versionsangabe steht ausschließlich als kurzer String im Game-Header, aktuell:

`V19`

## 12. Mobile Layout

Ab V17 eigener Mobile-Play-Modus.

Aktueller Stand V19:

- kompakter Game-Header
- kompakte Schritt / Punkte / Zeit-Zeile
- `DEINE KETTE` auf Mobile als Akkordeon
- bei Tastatur automatisch eingeklappt
- Keyboard-Erkennung über `visualViewport`
- Viewport-Meta enthält `interactive-widget=resizes-content`
- Antwortbereich dockt bei geöffneter Tastatur mit `bottom:0` direkt über der IME
- sekundäre Stats werden bei Tastatur ausgeblendet
- Ausgangswort bleibt sichtbar
- der dicke lila horizontale Trenner über dem mobilen Antwort-Dock wurde in V19 entfernt

V18 hat den Android-Chrome-Fehler aus V17 korrigiert, bei dem der Eingabebereich durch doppelte Tastatur-Kompensation aus dem Viewport geschoben wurde.

## 13. Deployment

Workflow:

`.github/workflows/pages.yml`

Name:

`SKIELSEN deploy`

Ablauf:

1. Checkout
2. `python3 tools/validate_static.py`
3. `node --check` auf alle JS-Dateien
4. GitHub Pages Build
5. Deployment aus `public/`

Vor GitHub-Writes immer aktuellen `main` SHA prüfen und Commit darauf aufbauen.

## 14. Relevante Versionshistorie

- V10: personalisierte Novelty-Engine
- V11: kontrollierte Fugenelemente
- V12/V13: Frequency Gate
- V14: Threshold-Slider, Pool bleibt vollständig erhalten
- V15: automatische Tipp-Vervollständigung + doppelte Initiale abfangen
- V16: echte falsche Wörter zählen, Zufallswörter nicht; Timer-Manipulation verhindert
- V17: erstes keyboard-aware Mobile-Layout
- V18: Android-Chrome Keyboard-Fix
- V19: lila Trenner im mobilen Antwort-Dock entfernt

## 15. Aktueller Testfokus / mögliche nächste Schritte

1. V19 auf Android Chrome und iOS Safari mit 10/15/20-Sekunden-Timer testen.
2. Prüfen, ob der mobile Antwort-Dock bei sehr kleinen Displays und Landscape stabil bleibt.
3. Frequency-Threshold in mehreren echten Runden vergleichen; besonders 25, 35 und 45.
4. Review-Zone sprachlich härten und `seed`-Edges systematisch auf `verified` setzen.
5. Wiktionary-Prüfung optional auf echte Nomen/Wortart statt bloßer Seitenexistenz erweitern.
6. LINEAR- und THIN-Nodes weiter verzweigen, aber nur mit sauberen und geläufigen Komposita.

## 16. Nicht verwechseln

- `occurrence_score` bestimmt die Auswahl über den Session-Threshold, nicht die physische Existenz der Kante.
- `frequency_override_keep` bedeutet bewusst zugelassen trotz niedrigem Score.
- `review_status='rejected'` ist dagegen wirklich ausgeschlossen.
- `is_active` soll für nicht abgelehnte Pool-Kanten grundsätzlich aktiv bleiben; der Threshold filtert zur Laufzeit.
- Das Wiktionary wird zur Validierung manueller Fehlversuche genutzt, nicht zur automatischen Erzeugung des Wortgraphen.


## 17. Fullversion-Integration V20 / App V15.1.47

Vor dem Merge wurde ein eigener Theme-/Design-Audit in `docs/WORTKETTE_THEME_AUDIT.md` durchgeführt.

Die Vollversion nutzt:
- `public/assets/js/12-word-chain-game.js`
- `public/assets/css/wortkette-game.css`
- In-App module key `word-chain`
- game key `word_chain`
- catalog id `game.word_chain`

Das integrierte Modul verwendet ausschließlich `var(--ui)` / `var(--display)` für Typografie und semantische Theme Contract v2 Tokens für Flächen, Texte, Buttons, Inputs und Statusfarben. Es enthält keine Theme-Pack-spezifischen Selektoren.

Tournament-Player erhalten jeweils eine eigene 10-Schritt-Kette. In Teamturnieren werden die Player-Scores je Participant addiert. Ranking: Score absteigend, danach Dauer, danach serverseitiger Loswert.

Der Fullversion-Timer ist serverautoritativ: ein abgelaufener Timer kann weder durch Enter-Spam noch durch verspätete Eingaben zurückgesetzt/umgangen werden.


## 18. V15.1.48 · gemeinsamer Tournament-Chain + Abschlussfix

Fehlerursache des nicht abschließbaren zehnten Wortes war eine falsche Game-ID-Prüfung im Tournament-Finalizer. Der bestehende Katalogeintrag verwendet `game.wortkette.compound_nouns`; die erste Fullversion-Integration prüfte irrtümlich nur auf den neu angelegten Alias `game.word_chain`. Dadurch lief die Wortkette bis Schritt 10, scheiterte aber exakt beim Finalisieren.

Korrigiert:
- kanonische Catalog-ID ist wieder ausschließlich `game.wortkette.compound_nouns`
- der versehentlich doppelt angelegte Katalogeintrag `game.word_chain` wurde entfernt
- die In-App-Definition `word_chain` zeigt auf den kanonischen Katalogeintrag
- alle Player derselben In-App-Session erhalten dieselbe serverseitig generierte Wortkette
- jeder Player besitzt weiterhin eigenen Fortschritt, Timer und Fehlversuche
- die gemeinsame Kette wird genau einmal pro Session erzeugt; weitere Player erhalten unabhängige Session-Kopien derselben `chain` und `edge_ids`
- der Start wird über einen Lock auf der In-App-Session serialisiert, damit auch nahezu gleichzeitiges Öffnen auf mehreren Geräten nicht zwei verschiedene Ketten erzeugt
- Tournament-Ranking folgt wieder dem bestehenden Katalogvertrag: `SIMULTANEOUS_RACE`, Solo nach eigener Zeit, Team nach dem schnellsten Player
- Fullversion-Result-Handoff übergibt deshalb die Dauer statt des internen Fehler-Scores als Match-Metrik.

Bereits gestartete Wortketten-Sessions behalten ihre beim Start erzeugten Ketten. Der gemeinsame-Chain-Vertrag greift bei neu erzeugten Runs/Sessions.


## 19. V15.1.49 · Ready Rules, echter Zero-Reset, QA-Startoverride

Wortkette wertet ab diesem Stand wieder ausdrücklich nach Minuspunkten:
- falsches existierendes Wort: −1 + ein weiterer Hinweis
- Timeout: −1 + ein weiterer Hinweis
- alle Player derselben Session lösen dieselbe versteckte Kette
- die wenigsten Minuspunkte gewinnen
- Gleichstand wird serverseitig über die Dauer und erst danach per Los aufgelöst.

Die Ready-Seite zeigt dieses Rule Set vor dem Button `ICH BIN BEREIT`.

Der Admin-Reset wurde serverseitig erweitert. Zusätzlich zu den bisherigen Runtime-Daten werden nun auch `tournament_game_participants` sowie die zur gelöschten In-App-Session gehörenden `word_chain_solo_sessions` entfernt. Der RPC prüft anschließend, dass keine relevanten Runtime-Zeilen übrig sind. Der Client akzeptiert den Reset nur noch bei `runtime_rows_remaining = 0` und speichert danach den frischen Default-State sofort.

Für das QA-Turnier `Wortkette` mit Tournament-ID `0f885906-f288-42b6-98e6-08adb518da10` ist ausschließlich in der Datenbank das Feature `feature.qa_force_start_without_ready` aktiviert. Dadurch kann der Admin dort eine zugewiesene Wortkette-Session starten, obwohl noch nicht alle Player Ready gedrückt haben. Es gibt **keine hartcodierte Tournament-ID im Fullversion-JavaScript**; der Client reagiert nur auf das serverseitige Session-Flag `public_state.force_start_without_ready`. In allen anderen Turnieren bleibt das normale Ready-Gate unverändert.


## 20. V15.1.50 · Reset-UI-Synchronisierung

Nach dem serverseitigen Zero-Reset blieb im bereits geöffneten Browser der alte Bootstrap-Snapshot in `runtime.games` erhalten. Der Backend-Status war korrekt `PLANNED`, aber `defaultState(runtime)` konnte aus dem veralteten In-Memory-Status wieder `ACTIVE` oder `COMPLETED` rekonstruieren. Dadurch zeigte die Match-Detail-Seite oben `GEPLANT`, während GAME CONTROL fälschlich `MATCH ABGESCHLOSSEN` anzeigte und den Startbutton ausblendete.

Der Reset normalisiert jetzt vor dem Neuaufbau des lokalen States auch `runtime` selbst:
- Tournament `LIVE`
- `play_started_at = null`
- `completed_at = null`
- alle Games `PLANNED`
- Game-Start-/Abschlusszeiten leer
- Joker-Locks und akzeptierte Joker zurück auf Ausgangszustand

Zusätzlich setzt die Match-Detail-Ansicht bei einem geplanten Scheduled-Match den lokalen `matchIndex` auf den tatsächlich geöffneten aktuellen Match. Damit kann ein geplanter aktueller Match nicht mehr allein durch einen veralteten Match-Kontext als abgeschlossen gerendert werden.


## 21. V15.1.51 · Ready-Seite wieder sichtbar + falsches Startfehler-Popup beseitigt

Zwei Ursachen wurden getrennt korrigiert:

1. `private.ensure_native_in_app_session()` hat native Sessions bisher nach der automatischen Player-Zuweisung sofort auf READY gesetzt und direkt gestartet. Dadurch wurde bei Wortkette die vorgesehene `ICH BIN BEREIT`-/Rule-Set-Seite übersprungen. Wortkette stoppt jetzt nach Session-Erzeugung und Player-Zuweisung bewusst bei `WAITING_FOR_PLAYERS`. Die Player sehen damit zuerst das Rule Set und können Ready drücken. Der tatsächliche Session-Start bleibt eine explizite Admin-Aktion. Der nur im QA-Turnier gesetzte Feature-Override erlaubt diese Admin-Aktion weiterhin auch bei 0/2 oder 1/2 Readys.

2. Der kurze `START FEHLGESCHLAGEN`-Hinweis entstand durch einen doppelten Aktivierungsaufruf: der erste Call hatte Game und Session bereits erfolgreich aktiviert, ein unmittelbar folgender Native-Lifecycle-Call versuchte dieselbe bereits aktive Session erneut zu starten. `ensure_native_in_app_session()` ist jetzt für bereits aktive Sessions idempotent und kehrt sofort zurück. Zusätzlich prüft `startMatch()` bei einem Aktivierungsfehler, ob der Serverstatus bereits `ACTIVE` ist; in diesem Fall wird kein falsches Fehler-Popup mehr gezeigt.

Für Wortkette wurde außerdem der Client-Auto-Start bei `READY` deaktiviert. Auch wenn alle Player Ready sind, startet erst der Admin. Buzzer und Mehr oder Weniger behalten ihr bisheriges Auto-Start-Verhalten.
