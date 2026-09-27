# TicTacToe Quick Games – Arbeitsplan und Wiederaufnahme

## Ziel und Grenzen

TicTacToe v3 aus der Vollversion über den bestehenden Quick-Games-Katalog
spielen: Lobbycode, Menschen und Bots, Setup, READY, Duell und Ergebnis.
Die SQL-Duellfunktionen bleiben die einzige Engine für NORMAL/DISAPPEAR,
4+ Runden, Overtime, Timer und Timeout-Züge.
Quick Games erzeugt gemäß Global Contract keine Turniere, Turnierpunkte,
Joker-, MVP-/LVP-Schritte oder Merge.

## Sicherung

- Arbeitsbranch: `codex/quick-games-tic-tac-toe`.
- Jeder abgeschlossene und geprüfte Block erhält einen Commit und Push.
- Unvollständige Zwischenstände werden nicht nach main übernommen.
- Vor einer Unterbrechung diesen Status mit abgeschlossenen Arbeiten,
  Testergebnissen und konkreten nächsten Schritten aktualisieren und committen.
- Ausschließlich aufgabenbezogene Dateien stagen; `supabase/.temp/` ist lokale
  CLI-Konfiguration und gehört nicht in den Commit.
- Erst nach vollständigen Tests Backend bereitstellen und main veröffentlichen.

## Blöcke

1. **Lobby und Session**
   - TicTacToe als erlaubtes Quick Game ergänzen.
   - SOLO: zwei Plätze; TEAM: zwei Teams mit jeweils zwei Plätzen.
   - Authentifizierung, Lobby-Mitgliedschaft und Host-Rechte prüfen.
   - Persistierte Quick-Session mit bestehenden SQL-Duellfunktionen verbinden.
   - Gleichzeitige Requests, unveränderliche Aufstellung nach Start und Refresh testen.
2. **Bots und Ergebnis**
   - Bots serverseitig READY setzen und reguläre Züge ausführen lassen.
   - ALTERNATING, SELECTED_PLAYER und SIMULTANEOUS einschließlich Decider bedienen.
   - Dieselbe Engine für Bot- und Menschenzüge, mit serialisierten Aktionen.
   - Ergebnis dauerhaft speichern; Quick-Game-Ranking ohne Turnierübergabe.
3. **Frontend**
   - Katalog, passende Lobbyplätze und Spielstart verbinden.
   - Vorhandenes TicTacToe-Produktionsmodul mit Quick-Session anbinden.
   - Setup, READY, Timer, Overlays und Rückkehr zu Quick Games.
   - Mobile/Desktop, Teamfarben und Theme-Tokens prüfen.
4. **Abnahme und Veröffentlichung**
   - Auth-/Rechteprüfungen, SOLO und alle Team-Modi, Bots, beide Varianten,
     alle Timer, Refresh und parallele Clients testen.
   - DNA und Minority als bestehende Quick Games auf Regressionen prüfen.
   - Verify, Syntax, Diff und Cache-Version prüfen.
   - Supabase-Migration anwenden, Datenbank prüfen, main pushen und
     erfolgreichen Pages-Workflow bestätigen.
   - Physische Mehrgeräte-Tests ausdrücklich von Browseremulation unterscheiden.

## Aktueller Stand

- Block 1 implementiert: Migration `20260927085749_quick_tic_tac_toe_sessions.sql`.
- SOLO-/TEAM-Lobby, formatabhängige Platzgrenzen, Host-/Mitgliedschaftsrechte,
  atomarer Start und unveränderliche virtuelle Spieler-/Teilnehmer-IDs.
- Private Quick-Session ohne Turniertabellen; Duelladapter ruft die vorhandene
  `private.tic_tac_toe_new_board`-Funktion auf.
- Vier lokale PostgreSQL-Tests bestanden: SOLO, TEAM/Bots/alle Timer,
  bestehende DNA-/Minority-Lobbys und Zugriffsrechte.
- Block 1 war zunächst nur auf dem Arbeitsbranch; Live-Migrationsstand siehe
  Abschlussprüfung weiter unten.
- Globale Contracts, TicTacToe-v3-Contract und bestehender Quick-Games-Einstieg gelesen.
- Bestehende Quick Games: DNA (8 Plätze) und Minority (4 Einzelplätze).
- TicTacToe v3 ist bereits live; seine Session-RPCs sind noch turniergebunden.
- Block 2 implementiert: Migration `20260927090429_quick_tic_tac_toe_play.sql`.
  Host-Konfiguration, eigene Team-Spielerwahl, READY für alle Menschen,
  Start, serverseitige Bots/Timeouts, serialisierte Moves und persistiertes
  Ergebnis. Alle Modi inklusive SIMULTANEOUS 1:1 mit vollständigem v3-Decider.
- 13 Quick-PostgreSQL-Tests bestanden, darunter ein komplettes SOLO-Duell
  über legale RPC-Züge, alle Timer, Refresh, doppelte/veraltete Aktionen,
  Bot-Taktung, Teamwahl, Decider und tatsächlicher `authenticated`-Rollenzugriff.
  Routing-Tests für Team-Ergebnisse verwenden gezielte Engine-Fixtures.
  Zusätzlich 22 bestehende v3- und 40 DNA-Tests bestanden;
  `python tools/verify.py`: 33 JS-Dateien, 6 Inline-Skripte, keine Fehler.
- In Block 2 erfolgte keine Live-DB-Änderung und kein UI-/Device-Test.
  PGlite prüft PostgreSQL-Funktionen mit isolierten Tabellen; echte parallele
  Netzwerkclients und Live-Schema-Kompatibilität sind noch in Block 4 zu prüfen.
- Frontend-Anbindung aus Block 3 nutzt folgende RPCs (jeweils `p_lobby_id`):
  - `configure_quick_tic_tac_toe(p_team_mode,p_variant,p_turn_seconds)`;
    optionale Parameter erlauben schrittweise Konfiguration.
  - `select_quick_tic_tac_toe_player(p_member_id,p_selection='MATCH'/'DECIDER')`.
  - `ready_quick_tic_tac_toe(p_ready)`, `start_quick_tic_tac_toe()`.
  - `get_quick_tic_tac_toe_state()` liefert Produktionsfelder plus `quick_game`.
  - `submit_quick_tic_tac_toe_move(p_cell_index,p_duel,p_expected_round,
    p_expected_move,p_client_action_id)`; Duellschlüssel main/1/2/decider.
    `move_accepted=false` enthält trotzdem den aktuellen verbindlichen State.
  - Ergebnis direkt aus `result.standings` und `result.duel_results` nutzen;
    keine Client-Score-Submission und kein Turnier-Start-/Postgame-Aufruf.
- Block 3 implementiert: `/quick-games/` enthält TicTacToe mit SOLO-/TEAM-
  Formatwahl, Sitzplätzen, gemeinsamer Lobby und dem bestehenden Produktions-
  TicTacToe-Modul. Der Quick-Adapter mappt Setup, READY, Spielerwahl, Moves,
  Parallelboards und Decider auf die Quick-RPCs. Das Quick-Ergebnis zeigt
  Ranking und Matchpunkte getrennt und beendet ohne Joker/Merge zurück zum
  Katalog.
- Frontend-Syntax, `python tools/verify.py` und die bestehenden TicTacToe-
  Browser-Regressionen bestanden: 6 Viewports sowie Overlays, Timer-Remount
  und Ranking/Joker/Merge/Close der Vollversion. Live-Schema-Prüfung siehe unten;
  zwei physische Geräte wurden nicht getestet.
- Abschlussprüfung 27.09.2026: echter Quick-HTML-Einstieg mit Produktionsmodul
  und PostgreSQL-RPCs in PGlite für SOLO, ALTERNATING, SELECTED_PLAYER und
  SIMULTANEOUS bestanden (Katalog, Format, Setup, READY, Zug, Refresh,
  Quick-Ergebnis, Rückkehr, Hosting unter `/Skielsen-web/`). Test:
  `PGLITE_MODULE=<Pfad> PLAYWRIGHT_MODULE=<Pfad> node tools/test_quick_tic_tac_toe_ui.mjs`.
- Theme-Tokens auf dem Quick-Host aktiviert; gültige UUIDs auch unter HTTP/LAN.
  Fehler beim ersten State-Read werden sichtbar ausgegeben.
- 75 SQL-/DNA-Regressionen bestanden. Aktueller Verify: 42 JS-Dateien und
  8 Inline-Skripte, keine Fehler. Cache-/App-Version: `15.1.144`.
- Beide Migrationen gezielt live angewendet, Remote-Versionen:
  `20260927152731` = `quick_tic_tac_toe_sessions`,
  `20260927152743` = `quick_tic_tac_toe_play`.
  Smoke-Test aller vier Modi auf dem echten Schema erfolgreich; die komplette
  Testtransaktion wurde zurückgerollt, keine Testspiele blieben gespeichert.
- Security-Advisors geprüft. Erwartete Hinweise: private Tabelle mit RLS ohne
  Policies (direkter Zugriff absichtlich entzogen), authentifizierte
  SECURITY-DEFINER-RPCs (Host-/Mitgliedschaftsprüfungen getestet).
  Vorhandene andere Projektwarnungen wurden nicht verändert.
- Noch offen: physischer Zwei-Geräte-Playtest. Automatisierte Browser-/SQL-
  Tests ersetzen keinen Smartphone-/WLAN-Test. Veröffentlichung und Pages-
  Workflow werden nach dem Abschlusscommit separat geprüft.
- Testbefehl: `PGLITE_MODULE=<PGlite-Pfad> node --test tools/test_quick_tic_tac_toe.mjs`.
- Migrationshistorie im Repository ist unvollständig. Kein pauschales
  `migration repair` und kein unkontrolliertes `db push`. Geprüfte Migrationen
  gezielt anwenden und die tatsächlich registrierte Remote-Version dokumentieren.
