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
