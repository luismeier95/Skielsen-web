# Wortkette · Datenbank- und Novelty-Engine

## Ziel

Wortkette wird nicht aus festen Templates gespielt. Vor jeder Session erzeugt das Backend eine komplette Kette aus einem gerichteten Netz geprüfter Kompositum-Verbindungen. Der Spieler sieht nie die komplette Kette.

## Kerntabelle

`word_chain_edges`

Jede Zeile ist genau eine gerichtete Verbindung:

`base_word + link_suffix + next_word = compound_word`

Beispiele:

`BAUM + "" + STUMPF = BAUMSTUMPF`

`TASCHE + N + GELD = TASCHENGELD` → Anzeige im Spiel: `TASCHE(N) + GELD`

Wichtige Felder:

- `link_suffix`: kontrolliertes Fugenelement `"" | N | S | EN | E | ER | ES`
- `review_status`: `candidate | seed | verified | rejected`
- `quality_score`: 1–5
- `familiarity_score`: 1–5
- `use_count`: globale Nutzung
- `last_used_at`: globaler Cooldown
- `source_ref`, `review_note`, `reviewed_at`: kontrollierte Prüfung

Das Datenmodell erzwingt `compound_word = base_word || link_suffix || next_word`. Das Grundnomen selbst bleibt unverändert; ein freigegebenes Fugenelement wird sichtbar in Klammern angezeigt. Beispiel: `TASCHE(N)`. Nach der Lösung `GELD` wird weiterhin `GELD` zum nächsten Grundnomen. Beliebige Stammänderungen sind nicht erlaubt.

## Persönliche Historie

`word_chain_player_edge_history`

Speichert pro Spieler und Verbindung:

- `times_seen`
- `last_seen_at`

Damit wird nicht nur global ausgeglichen. Wenn ein Spieler `BAUM → KRONE` bereits häufig gesehen hat, wird genau diese Verbindung für ihn stark abgestraft, während andere BAUM-Abzweigungen fast unverändert bleiben.

`word_chain_player_ngram_history`

Speichert bereits gezeigte 3er- und 4er-Teilfolgen. Dadurch werden nicht nur einzelne Übergänge, sondern auch bekannte Routen vermieden.

## Gewichtung

Eine mögliche Kante erhält ein relatives Auswahlgewicht aus:

`Qualität × Bekanntheit × Review-Faktor × globales Sibling-Balancing × persönliches Sibling-Balancing × globaler Cooldown × persönlicher Cooldown × N-Gram-Novelty × Zukunftsverzweigung`

Wichtigster Effekt:

- eine persönliche Mehrfachnutzung gegenüber einem ungenutzten Geschwister-Übergang wird pro zusätzlichem Auftreten mit Faktor `0.18` multipliziert
- bekannte 3er-Sequenzen werden mit Faktor `0.10` pro Wiederholung multipliziert
- bekannte 4er-Sequenzen werden zusätzlich mit `0.35` gedämpft

Beispiel aus dem Test:

- `BAUM → STUMPF`: relatives Gewicht ca. `1.1704`
- `BAUM → KRONE` nach 5 persönlichen Sichtungen: ca. `0.00001386`

KRONE ist damit nicht absolut verboten, aber extrem unwahrscheinlich, solange frische Alternativen vorhanden sind.

## Kettengenerator

`start_word_chain_solo(player_key, steps)`

Der Generator:

1. baut die komplette Kette vor Spielbeginn
2. verwendet gewichtete Zufallsauswahl
3. vermeidet bereits verwendete Wörter innerhalb derselben Kette
4. bevorzugt Knoten mit mehreren zukünftigen Abzweigungen
5. startet bei einer Sackgasse neu
6. speichert die finale Kette und ihre Edge-IDs in `word_chain_solo_sessions`
7. aktualisiert globale und persönliche Nutzungsstatistiken direkt bei Zuteilung

Die Auswahl findet also nicht live nach jeder richtigen Antwort statt.

## Qualitätskontrolle

`word_chain_edge_review_queue` zeigt Seed- und Candidate-Verbindungen mit Netzwerkinformationen.

`word_chain_node_health` klassifiziert Wörter nach Ausgangsgrad:

- `HEALTHY`: mindestens 4 Ausgänge
- `THIN`: 2–3 Ausgänge
- `LINEAR`: genau 1 Ausgang
- `DEAD_END`: kein Ausgang

Für den Ausbau der Datenbank sollten zuerst DEAD_END-, LINEAR- und THIN-Knoten erweitert werden. Ziel ist nicht nur eine hohe Zahl von Komposita, sondern ein dicht verzweigtes Netz.


## Node-Status: Dead End, Linear, Thin, Healthy

Die Begriffe beziehen sich ausschließlich auf die Zahl der aktuell nutzbaren **ausgehenden** Verbindungen eines Nomens:

- `DEAD_END`: 0 Ausgänge. Das Wort ist im Spiel nur als **letztes Wort einer Kette** zulässig.
- `LINEAR`: genau 1 Ausgang. Das Wort ist intern spielbar, aber stark vorhersehbar.
- `THIN`: 2–3 Ausgänge. Etwas Variation, aber noch relativ leicht lernbar.
- `HEALTHY`: mindestens 4 Ausgänge. Zielzustand für häufige interne Knoten.

Ein Dead End ist nicht automatisch ein fehlerhaftes Nomen. Seit V11 dürfen kontrollierte Fugenelemente ergänzt werden, solange das Grundnomen unverändert bleibt und der Zusatz sichtbar in Klammern steht. Damit sind z. B. `FLASCHE(N) + POST`, `LAMPE(N) + LICHT`, `ARBEIT(S) + ZEIT` oder `LÖWE(N) + ZAHN` zulässig. Echte Stammänderungen wie `SCHULE → SCHUL-...` bleiben weiterhin ausgeschlossen.

Der Generator erzwingt daher:

- `DEAD_END` niemals mitten in einer Kette
- `DEAD_END` nur als letztes Lösungswort
- interne Knoten müssen mindestens einen weiteren Ausgang besitzen

Zusätzlich existieren nun:

- `word_chain_terminal_nodes`: priorisierte Liste aller natürlichen/noch ungeklärten Endknoten
- `word_chain_expansion_queue`: Arbeitsliste zuerst DEAD_END, danach LINEAR, danach THIN
- `play_role=TERMINAL_ONLY|INTERNAL_OK`
- `expansion_priority`: Priorität nach Netzstatus und Zahl der eingehenden Wege

### Dead-End-Pass 1

Im ersten Ausbau wurden 22 streng unveränderte Übergänge ergänzt, unter anderem:

`BAHN → HOF → BAHNHOF`
`ZAHN → ARZT → ZAHNARZT`
`STAMM → BAUM → STAMMBAUM`
`SCHLOSS → HOF → SCHLOSSHOF`
`LAND → HAUS → LANDHAUS`
`BLATT → GOLD → BLATTGOLD`
`GOLD → RING → GOLDRING`
`RING → FINGER → RINGFINGER`
`FINGER → HUT → FINGERHUT`
`FEUER → WEHR → FEUERWEHR`
`WEHR → TURM → WEHRTURM`
`TURM → UHR → TURMUHR`
`VERTRAG → PARTNER → VERTRAGPARTNER`
`WALL → FAHRT → WALLFAHRT`
`WECHSEL → GELD → WECHSELGELD`
`POLITIK → FELD → POLITIKFELD`
`BALLEN → PRESSE → BALLENPRESSE`
`PRESSE → HAUS → PRESSEHAUS`

Dadurch sank die Zahl der Dead-End-Knoten von 76 auf 62. Die verbleibenden Dead Ends werden nicht automatisch „repariert“; nur sprachlich saubere, unveränderte Komposita werden ergänzt.

## Connector-Regel V11

Die neue Regel erweitert den Graphen kontrolliert, ohne freie Wortveränderungen zuzulassen.

- `TASCHE(N) + GELD = TASCHENGELD`
- `FLASCHE(N) + POST = FLASCHENPOST`
- `ARBEIT(S) + ZEIT = ARBEITSZEIT`
- `ART(EN) + SCHUTZ = ARTENSCHUTZ`
- `GEIST(ES) + BLITZ = GEISTESBLITZ`
- `LÖWE(N) + ZAHN = LÖWENZAHN`
- `ELEFANT(EN) + HERDE = ELEFANTENHERDE`

Der Klammerzusatz ist Edge-spezifisch und wird dem Spieler vorgegeben. Er muss nicht geraten werden. Das folgende Kettenwort bleibt immer das reine Nomen, z. B. nach `TASCHE(N) + GELD` lautet das nächste Ausgangswort `GELD`.

Mit dem ersten Connector-Pass stieg der aktive Graph auf 440 Verbindungen. Die Zahl der DEAD_END-Knoten sank von 62 auf 23. Connector-Kanten werden zunächst als `seed` geführt und können separat geprüft und auf `verified` gesetzt werden.

## Frequency Gate V13

Alle aktiven Komposita werden zusätzlich mit einem kombinierten Vorkommensscore bewertet. Der Score kombiniert DeReWo/DeReKo und wordfreq.

- `< 35`: standardmäßig deaktiviert
- `>= 35`: regulär aktiv
- `frequency_override_keep=true`: bewusster Familiarity-Override für klare Alltagswörter, die vom Korpus unterschätzt werden

Nach Umstellung des Thresholds auf 35 bei 445 bewerteten Verbindungen:

- 65 Verbindungen liegen unter dem Threshold
- 7 davon bleiben durch bewussten Familiarity-Override aktiv
- 380 Verbindungen sind aktuell aktiv

Die ersten Overrides sind: `BILDBUCH`, `OBJEKTIVDECKEL`, `STIFTHALTER`, `LANDUNGSPUNKT`, `WEITENREKORD`, `ZAUNTOR`, `SESSELBEIN`.

Der Generator berücksichtigt weiterhin ausschließlich `is_active=true`, daher wirken Frequency-Cuts direkt auf neue Sessions. Bestehende bereits erzeugte Sessions werden nicht nachträglich verändert.


## Threshold-Slider V14

Der Frequency-Score deaktiviert keine Wörter mehr dauerhaft. Alle 445 nicht abgelehnten Verbindungen bleiben in `word_chain_edges` erhalten und `is_active=true`.

Der Threshold wird pro neuer Solo-Session an `start_word_chain_solo(player_key, steps, occurrence_threshold)` übergeben. Die Standalone-Version bietet dafür einen Slider von 0 bis 50:

- 0: kompletter Pool
- 15: 429 Verbindungen
- 25: 417 Verbindungen
- 35: 380 Verbindungen
- 45: 289 Verbindungen
- 50: strenger Testbereich; 10-Schritt-Ketten wurden erfolgreich erzeugt

`frequency_override_keep=true` bleibt unabhängig vom Slider zugelassen. Die RPC `get_word_chain_threshold_stats(threshold)` liefert die jeweils verfügbare Edge-Zahl live für die Testoberfläche.

Ein Frequency-Audit aktualisiert nur Scores und Statusfelder; er löscht oder deaktiviert keine Kanten mehr.


## Input UX V15

Zwei Komfortregeln sind jetzt serverseitig abgesichert und im Standalone-Client umgesetzt:

1. Wenn ein Fehlversuch oder Timeout den letzten noch fehlenden Buchstaben automatisch aufdeckt, wird das aktuelle Wort sofort als abgeschlossen behandelt. Die Session rückt direkt zum nächsten Kettenwort weiter; ein zusätzliches ENTER ist nicht nötig. Der Fehlversuch kostet weiterhin −1 Punkt.
2. Wenn nur der erste Buchstabe vorgegeben ist und der Spieler diesen Buchstaben reflexartig erneut eingibt, wird die wiederholte Eingabe ignoriert, sofern das echte Lösungswort nicht mit demselben Doppelbuchstaben beginnt. Die Prüfung erfolgt anhand der serverseitig gesperrten Lösung; echte Doppelanfänge bleiben dadurch unverändert spielbar.

Die Submit-RPC normalisiert die doppelte Initiale zusätzlich serverseitig, damit auch schnelle Eingaben oder ältere Clients nicht fälschlich als falsch gewertet werden.


## Guess Validation V16

Manuelle Fehlversuche werden jetzt gegen das deutsche Wiktionary validiert.

- korrektes Zielwort: Wort abgeschlossen, nächste Runde startet mit neuem Timer
- existierendes, aber falsches Wort: −1 Punkt + nächster Buchstabe; **der laufende Timer bleibt unverändert**
- nicht existierendes/zufälliges Wort: Versuch wird nicht gewertet; kein Punktabzug, kein Hinweis und **kein Timer-Reset**
- Timeout: −1 Punkt + nächster Buchstabe; danach startet für dasselbe Wort ein neues Zeitfenster
- vervollständigt ein Hinweis das gesamte Wort, wird automatisch zum nächsten Wort gewechselt

Die Prüfung läuft serverseitig über die MediaWiki-API des deutschen Wiktionary und wird in `word_chain_lexicon_cache` zwischengespeichert. Fällt die externe Wortprüfung aus, wird die Eingabe vorsichtshalber nicht als Fehlversuch gewertet.

Damit kann der Spieler den Countdown nicht mehr durch Enter-Spam oder Zufallszeichen künstlich zurücksetzen.


## Veröffentlichungsroute

Ab V16 wird die jeweils aktuellste Wortkette-Version immer unter der stabilen Route `/wortkette/` veröffentlicht. Es werden für neue Builds keine versionsabhängigen öffentlichen URLs mehr benötigt.

Die sichtbare Versionsangabe steht ausschließlich als kurzer String im Game-Header, z. B. `V16`. Zusätze wie `SOLO PLAYTEST ·` oder Versionsnummern im sichtbaren Seitentitel entfallen.


## Mobile Play Layout V17

Der aktive Play-Screen hat auf Smartphones einen eigenen kompakten Layoutmodus.

- Game-Header und Statusleiste werden im Spiel niedriger dargestellt.
- `DEINE KETTE` ist auf Mobile ein Akkordeon und standardmäßig eingeklappt.
- Beim Öffnen der Bildschirmtastatur wird die Kette automatisch geschlossen.
- `visualViewport` überwacht die tatsächlich sichtbare Bildschirmhöhe und die Tastaturhöhe.
- Während der Tastatur geöffnet ist, wird der Antwortbereich als kompakter Dock direkt oberhalb der Tastatur positioniert.
- Ausgangswort und Plus bleiben im sichtbaren Restbereich; sekundäre Statistiken werden bei geöffneter Tastatur ausgeblendet.
- Desktop-Layout und Setup-Screen bleiben unverändert.

Die stabile Veröffentlichungsroute bleibt `/wortkette/`; die sichtbare Versionskennung steht nur im Game-Header als `V17`.


## Mobile Keyboard Fix V18

Der V17-Anzeigefehler auf Android Chrome entstand durch eine doppelte Tastatur-Kompensation: Der Browser verkleinerte bereits den sichtbaren Viewport, während der Antwort-Dock zusätzlich um die berechnete Tastaturhöhe nach oben versetzt wurde. Dadurch konnte der Eingabebereich vollständig aus dem sichtbaren Bereich rutschen und die Puzzle-Card blieb als große leere Fläche stehen.

V18 verwendet deshalb `interactive-widget=resizes-content` im Viewport-Meta-Tag. Bei geöffneter Tastatur wird der Antwort-Dock schlicht mit `bottom:0` an den vom Browser bereits verkleinerten Content-Viewport gebunden. Die künstliche `--wk-keyboard-offset`-Verschiebung und die große Mindesthöhe der Puzzle-Card wurden entfernt.


## Mobile Answer Dock V19

Der dicke lilafarbene Trenner zwischen Ausgangswort und Eingabebereich wurde im Mobile-Keyboard-Modus entfernt. Der Antwort-Dock bleibt weiß und wird nur noch über Abstand und einen dezenten Schatten vom restlichen Puzzle-Bereich getrennt.


## 20. V15.1.52 · Expliziter „START ERZWINGEN“-Button

Im Admin-Control der In-App-Session besitzt Wortkette jetzt einen separaten Button `START ERZWINGEN`.
Er wird nur angezeigt, wenn die aktuelle Session das serverseitige Flag `public_state.force_start_without_ready` trägt und das geladene Modul `word-chain` ist. Damit bleibt der Sonderfall auf das QA-Turnier „Wortkette“ begrenzt; im Fullversion-JavaScript wird weder eine Tournament-ID noch ein Tournament-Name hartcodiert.

Der normale Button `SESSION STARTEN` bleibt unverändert an den Status `READY` gebunden. `START ERZWINGEN` erscheint nur im Status `WAITING_FOR_PLAYERS` und wird erst aktiv, wenn mindestens die für das Spiel erforderliche Zahl an Playern zugewiesen ist.


## 21. V15.1.53 · Force-Start direkt auf der Wortkette-Ready-Seite

Der QA-Override ist jetzt direkt auf dem vorgeschalteten Wortkette-Ready-Screen bedienbar. Für Admins erscheint neben `ICH BIN BEREIT` ein eigener Button `START ERZWINGEN`, solange die Session noch `WAITING_FOR_PLAYERS` ist.

Der Button wird ausschließlich gerendert, wenn gleichzeitig:
- der eingeloggte Nutzer Admin ist,
- das Session-Modul `word-chain` ist,
- und der Server `public_state.force_start_without_ready = true` liefert.

Damit bleibt die Sonderlogik weiterhin auf das serverseitig markierte QA-Turnier „Wortkette“ begrenzt. Andere Turniere erhalten weder den Button noch eine clientseitige Ready-Umgehung.


## V4 Integration Preparation · 2026-09-20

Supabase-Migration:

`20260920191432_prepare_word_chain_v4_integration`

Die Datenbank ist für den neuen Difficulty-/Hangman-/Result-Flow vorbereitet, **ohne die aktuelle V3-Vollversion vorzeitig zu brechen**.

### Neue Run-Snapshots

`word_chain_tournament_runs` besitzt zusätzlich:

- `difficulty text not null default 'NORMAL'`
- `show_word_length boolean not null default false`
- `rules_version integer not null default 3`

Bestehende Runs wurden bewusst als `NORMAL / false / V3` markiert. Neue V4-Runs speichern die tatsächlich gewählte Difficulty unveränderlich pro Run.

### Difficulty RPC

Neu:

`set_word_chain_difficulty(p_session_id uuid, p_tier text)`

Nur Tournament Admin, nur ACTIVE Wortkette-Session, nur vor dem ersten Wortketten-Run.

Mapping:

- EASY → Threshold 50, `show_word_length=true`
- NORMAL → Threshold 35, `show_word_length=false`
- HARDCORE → Threshold 15, `show_word_length=false`

Session Public State erhält:

- `difficulty_required`
- `word_chain_difficulty`
- `occurrence_threshold`
- `show_word_length`
- `time_limit_seconds`
- `difficulty_selected_by`
- `difficulty_selected_at`
- `word_chain_rules_version=4`

Die gleiche Tier-Auswahl ist idempotent. Ein Wechsel auf ein anderes Tier nach bereits gespeicherter Auswahl wird abgewiesen. Sobald ein Run existiert, wird jede neue Difficulty-Auswahl abgewiesen.

### V3/V4 Compatibility Gate

`in_app_game_definitions.config_json` enthält jetzt die V4-Tiers und `difficulty_selection_supported=true`.

Bis zum Frontend-Merge bleibt:

`require_difficulty_selection=false`

Dadurch starten bestehende Clients weiterhin im bisherigen NORMAL-/V3-Fallback. Beim UI-Merge muss die Runtime für neue Wortkette-Sessions `difficulty_required=true` setzen bzw. der globale Schalter gemeinsam mit dem Frontend aktiviert werden.

### Start / State

`start_word_chain_tournament_player()`:

- erzeugt bei V4 keine Kette, solange Difficulty fehlt
- liefert stattdessen `setup_phase='DIFFICULTY'`
- übernimmt die sessionweite Difficulty in den Run-Snapshot
- generiert weiterhin genau eine gemeinsame Kette je In-App-Session

`private.word_chain_tournament_state()` liefert zusätzlich:

- `difficulty`
- `show_word_length`
- `rules_version`
- `initial_revealed_count`
- `hint_revealed_count`

Nur EASY erhält zusätzlich:

- `target_length`

NORMAL/HARDCORE erhalten keinen `target_length` Key.

### Final Result

Der Finalizer persistiert jetzt zusätzlich:

- Rules Version
- Difficulty
- Threshold
- Wortlängen-Freigabe
- Time Limit

`standings[]` enthält direkt:

- `participant_id`
- `participant_type`
- `display_name`
- `identity_color`
- `placement`
- `duration_ms`
- `score`

Damit kann die neue Result-Page ohne clientseitige Datenbank-Joins gerendert werden.

Ranking bleibt serverautoritativ:

1. Score absteigend / wenigste Minuspunkte
2. Dauer aufsteigend
3. serverseitiger Loswert

### Verifikation

Direkt in PostgreSQL mit Rollback-Tests geprüft:

- V4 Setup-Gate erzeugt vor Difficulty keinen Run.
- EASY → Threshold 50, Rules V4, `target_length` vorhanden.
- HARDCORE → Threshold 15, Rules V4, kein `target_length`.
- Legacy Run bleibt NORMAL / Rules V3.
- Finalizer liefert Participant-Level Name + Identity Color + Zeit + Score.
- Tournament Placement / Result / Joker-/Ledger-Handoff durchläuft den Test.
- Alle temporären Testdaten wurden zurückgerollt bzw. explizit entfernt.

Security:

- `anon` darf `set_word_chain_difficulty` nicht ausführen.
- `authenticated` darf die RPC aufrufen; die Funktion erzwingt intern Tournament-Admin-Rechte.
