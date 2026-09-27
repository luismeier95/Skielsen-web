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
- Migration ist noch nicht live angewendet; der Arbeitsbranch ist noch kein
  spielbarer Quick-Games-Release.
- Globale Contracts, TicTacToe-v3-Contract und bestehender Quick-Games-Einstieg gelesen.
- Quick Games unterstützt aktuell DNA (8 Plätze) und Minority (4 Einzelplätze).
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
- Keine Live-DB-Änderung, kein UI-/Device-Test in diesem Backend-Block.
  PGlite prüft PostgreSQL-Funktionen mit isolierten Tabellen; echte parallele
  Netzwerkclients und Live-Schema-Kompatibilität sind noch in Block 4 zu prüfen.
- Nächster Schritt (Block 3): Quick-Games-Katalog und Lobby anbinden,
  Produktionsmodul mit RPC-Adapter verwenden, Quick-Ergebnis separat darstellen.
  Verfügbare RPCs (jeweils `p_lobby_id`):
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
- Testbefehl: `PGLITE_MODULE=<PGlite-Pfad> node --test tools/test_quick_tic_tac_toe.mjs`.
- Migrationshistorie im Repository ist unvollständig. Kein pauschales
  `migration repair` und kein unkontrolliertes `db push`. Geprüfte Migrationen
  gezielt anwenden und die tatsächlich registrierte Remote-Version dokumentieren.
