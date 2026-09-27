# TicTacToe · Vollversion · Rules / Result v3

Die aktuelle `public/tic-tac-toe-test/` ist Design- und Mechanikreferenz.
Die Vollversion bleibt im bestehenden In-App-/Supabase-/Turnierframework.

- Jedes direkte Duell (SOLO, ALTERNATING, SELECTED_PLAYER, beide
  SIMULTANEOUS-Subgames und Decider) nutzt dieselbe 4+-Runden-Engine.
- Starter wechselt nach jeder Runde. Sieg als Starter: 1 Matchpunkt,
  Sieg gegen den Starter: 2 Matchpunkte. TIE: 0.
- Vor Runde 4 endet das Duell nur, wenn der Rückstand mit allen verbleibenden
  regulären Runden mathematisch nicht mehr aufholbar ist.
- Gleichstand nach Runde 4: Overtime in vollständigen Zweierblöcken.
  Zwei Siege desselben Spielers oder ein Sieg plus TIE entscheiden.
  Geteilte Siege oder zwei TIEs erzeugen den nächsten Zweierblock.
  Overtime wird anhand der Rundensieger ausgewertet, nicht der gewichteten Punkte.
- SIMULTANEOUS: zwei gewonnene Duelle entscheiden; bei 1:1 wählen beide Teams
  wie bisher den Decider-Spieler. Der Decider ist ebenfalls ein vollständiges Duell.
- NORMAL: Dreierreihe gewinnt, volles Board ohne Sieger ist TIE.
  DISAPPEAR: beim vierten eigenen Stein verschwindet der älteste vor der
  Gewinnprüfung. Höchstens drei eigene Steine bleiben aktiv.
- Timer AUS / 3 / 5 / 7 Sekunden, als gemeinsame Session-Konfiguration gespeichert.
  Der erste gesetzte Zug jeder Runde ist unbefristet. Danach gilt pro Zug eine
  Serverdeadline. Timeout setzt einen schwachen legalen Zug, niemals Matchverlust.
  Auswahl wie Standalone: eigener Sofortsieg 1000; gegnerischer Sofortsieg nach
  Antwort -500; zusätzlich Mitte 30, Ecke 15, Rand 5. Zufall unter niedrigsten Werten.
- State-Reads und Moves verarbeiten abgelaufene Deadlines unter Session-Lock.
  Ohne verbundenen Client erfolgt die Verarbeitung beim nächsten Request.
  Überfällige Zeit wird nicht als Serie unsichtbarer Autozüge nachgeholt.
- Clientaktionen referenzieren Runde und Zugnummer; veraltete Aktionen werden
  abgelehnt. Serverzeit plus monotone Clientzeit zeichnet lediglich die Timerleiste.
- START / WIN / TIE / OVERTIME: jeweils 2 Sekunden, persistierte Zeitstempel.
  Kein Countdown. Eine Overtime-Ankündigung folgt vor dem jeweiligen Starteroverlay.
- Gameplay: drei gleich breite Headerfelder, darunter Runde, Matchpunkte, Board.
  Runde und Score gleich groß; Abstände gleich. Namen in Teamfarbe, Boardrahmen
  dauerhaft in Zugfarbe, Gewinnlinie ohne Schatten, Overlay mit Theme-Kontrastbox.
  Sichtbare Texte mindestens 12 px. Mobile und Desktop nutzen das vorhandene
  In-App-Viewport; keine Übernahme des Standalone-Chromes.
- READY: vorhandene Team-/Spielerliste über Regeln, bestehender serverseitiger
  Scope bleibt unverändert.
- Result v3 speichert vollständige Duellergebnisse mit Runden und Matchpunkten.
  Turnierplatzierungen, Joker, Merge, Ledger und Close behalten ihre bestehenden
  Verträge; Matchpunkte sind keine Turnierpunkte.

## Deployment

### Quick Games (in Vorbereitung, noch nicht freigeschaltet)

- SOLO hat zwei Einzelplätze; TEAM hat zwei Teams mit jeweils zwei Plätzen.
- Der Host wählt SOLO/TEAM in der offenen Lobby. Belegte Plätze werden bei
  einem Formatwechsel niemals entfernt oder stillschweigend verschoben.
- Platz 1/2 bilden im TEAM-Modus Rot, Platz 3/4 Blau. Im SOLO-Modus ist
  Platz 1 Rot und Platz 2 Blau.
- Der Lobby-Start sperrt die Aufstellung und erzeugt stabile virtuelle
  Spieler-/Teilnehmer-IDs. Freie Plätze werden nach explizitem Bot-Füllen zu Bots.
- Quick-Sessions nutzen die existierenden v3-Duellfunktionen. Sie erzeugen
  keine Turniere, Turnierpunkte, Joker oder Merge. Abschluss: gemeinsames
  Ergebnis und Rückkehr zu Quick Games.
- Implementierungsstand und nächste Schritte:
  `docs/games/tic-tac-toe/QUICK_GAMES_IMPLEMENTATION.md`.

### Vollversion

Migration: `supabase/migrations/20260926213328_tic_tac_toe_rules_v3.sql`.
Sie verweigert die Ausführung bei aktiven TicTacToe-Sessions. Backend zuerst,
danach Frontend veröffentlichen. Alte Clients müssen neu laden.
Rollback der bisherigen RPC-Definitionen:
`supabase/rollback/tic_tac_toe_rules_v3.sql`; nur ohne aktive v3-Sessions verwenden.
