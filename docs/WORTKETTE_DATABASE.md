# Wortkette · Datenbank- und Novelty-Engine

## Ziel

Wortkette wird nicht aus festen Templates gespielt. Vor jeder Session erzeugt das Backend eine komplette Kette aus einem gerichteten Netz geprüfter Kompositum-Verbindungen. Der Spieler sieht nie die komplette Kette.

## Kerntabelle

`word_chain_edges`

Jede Zeile ist genau eine gerichtete Verbindung:

`base_word + next_word = compound_word`

Beispiel:

`BAUM + STUMPF = BAUMSTUMPF`

Wichtige Felder:

- `review_status`: `candidate | seed | verified | rejected`
- `quality_score`: 1–5
- `familiarity_score`: 1–5
- `use_count`: globale Nutzung
- `last_used_at`: globaler Cooldown
- `source_ref`, `review_note`, `reviewed_at`: kontrollierte Prüfung

Das Datenmodell erzwingt `compound_word = base_word || next_word`. Fugenelemente oder Beugungen sind damit ausgeschlossen.

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
