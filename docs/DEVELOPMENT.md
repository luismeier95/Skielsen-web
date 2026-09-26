# Lokale Entwicklung und Verifikation

Voraussetzungen: Python 3.9+ und Node.js auf `PATH` (geprueft mit Python 3.9.0
und Node 24.21.0). Keine npm-/pip-Installation fuer Start oder Verify erforderlich.
Alle folgenden Befehle im Repository-Hauptverzeichnis ausfuehren.

## Start

```sh
python tools/dev.py
```

Der Server liefert ausschliesslich `public/` auf `127.0.0.1:8000` aus.
Mit `Ctrl+C` stoppen; bei belegtem Port: `python tools/dev.py --port 8001`.
Die Skripte bestimmen den Repository-Pfad aus ihrem eigenen Speicherort.

Fuer einen Zugriff vom Smartphone im gleichen WLAN den Server auf allen lokalen
Netzwerkadressen starten:

```sh
python tools/dev.py --host 0.0.0.0
```

Auf dem Smartphone dann die LAN-IP des Entwicklungsrechners verwenden, zum
Beispiel `http://<PC-IP>:8000/dna-test/`. Die konkrete IPv4-Adresse zeigt Windows
mit `ipconfig`. Beide Geraete muessen im selben Netzwerk sein; bei einer
Windows-Firewall-Rueckfrage nur den Zugriff fuer private Netzwerke erlauben.
`0.0.0.0` ist eine Bind-Adresse und wird nicht als Browser-URL verwendet.

| Oberflaeche | Lokale URL |
| --- | --- |
| Integrierte App (`public/index.html`) | http://127.0.0.1:8000/ |
| Quick Games | http://127.0.0.1:8000/quick-games/ |
| DNA | http://127.0.0.1:8000/dna-test/ |
| Produktionsmodul-Testoberflaeche | http://127.0.0.1:8000/standalone-games.html |
| Mehr oder Weniger | http://127.0.0.1:8000/more-or-less-contract-test/ |
| Wortkette | http://127.0.0.1:8000/word-chain-test/ |
| Tic-Tac-Toe | http://127.0.0.1:8000/tic-tac-toe-test/ |
| Reaction | http://127.0.0.1:8000/reaction-test/ |
| Ranking Ceremony | http://127.0.0.1:8000/ranking-ceremony-test/ |
| Design A | http://127.0.0.1:8000/TEST_DESIGN_A/ |
| Globaler Design-Contract | http://127.0.0.1:8000/game-design-contract.html |

Kein `/public/` voranstellen und HTML nicht ueber `file://` oeffnen.
Verzeichnis-URLs mit abschliessendem `/` laden die jeweilige `index.html`;
relative Assets behalten so ihre korrekte Basis. Neue statische Seiten unter
`public/` sind automatisch erreichbar. Es gibt keinen SPA-Fallback.

Dies ist ein lokaler Frontend-Server, kein lokales Backend und kein Offline-Modus.
Die vorhandenen Backend-Verbindungen, Authentifizierung und externen Assets
bleiben aktiv; Login und Spielablaeufe koennen Netzwerkzugriff benoetigen.
Der Server setzt `Cache-Control: no-store`. Falls ein zuvor registrierter Service
Worker alte Inhalte liefert, fuer diesen lokalen Origin in Browser-DevTools
den Service Worker abmelden und den Cache leeren. Hosting-spezifische
`_headers`/`_redirects`, HTTPS und der GitHub-Pages-Unterpfad werden nicht emuliert.

## Standard-Verify

```sh
python tools/verify.py
```

Fuehrt den vorhandenen statischen Validator aus, danach `node --check` fuer
**alle** `.js`, `.mjs` und `.cjs` unter `public/`, einschliesslich
`public/dna-test/app.js`, anderer Standalones und `public/sw.js`.
Prueft ausserdem ausfuehrbare Inline-Scripts in HTML unter `public/` und `docs/`
(einschliesslich Merge-Template); JSON-Datenbloecke werden uebersprungen.
Inline-Fehler zeigen vor der Node-Meldung die HTML-Datei und Script-Startzeile;
Node-Zeilennummern beziehen sich auf den extrahierten Script-Inhalt.
Module werden als Module geprueft. JavaScript wird nicht ausgefuehrt.
Exit-Code 0 bedeutet erfolgreich, ein anderer Wert bedeutet Fehler.
Keine Dateien werden generiert und kein Backend wird angesprochen.

Einzelne Pruefungen:

```sh
python tools/validate_static.py
python tools/verify.py --syntax-only
node --check public/dna-test/app.js
node --test tools/test_dna_sync.mjs
```

## Vorhandene Pruefungen und Grenzen

- `tools/validate_static.py`: Struktur, Referenzen, Versionen, Contract-Marker,
  Theme-Pruefungen und bekannte Legacy-Verbote. Kein vollstaendiger Browser-Test.
- `.github/workflows/pages.yml`: statische Validierung und Syntaxpruefung nur
  unter `public/assets/js/`, danach Deployment von `public/`. Unveraendert;
  der lokale Verify-Befehl deckt mehr JavaScript ab.
- `tools/score_word_chain_frequency.py` und der zugehoerige Workflow sind ein
  separater Daten-Audit: benoetigen `wordfreq`, Netzwerk und schreiben
  `data/wortkette-frequency-audit.json`. Nicht Teil des normalen Verify-Laufs.
- Die vorhandenen Testseiten dienen manueller QA. `tools/test_dna_sync.mjs`
  testet zusaetzlich die DNA-Multiplayer-Zustandsmaschine und den Client-Transport
  mit Node ohne neue Dependencies. Es ersetzt weder Datenbank-Integrationstests
  noch den Playtest mit zwei Endgeraeten.
- Syntaxpruefungen pruefen weder Browser-APIs, Imports und dynamisch geladenen
  Code noch Authentifizierung, Backend-Verhalten oder visuelle Korrektheit.

## Codex vor einem Commit

1. `AGENTS.md` und relevante Contracts lesen; `git status --short` pruefen.
2. `python tools/verify.py` ausfuehren; Fehler untersuchen, nicht umgehen.
3. Betroffene integrierte/Standalone-Seite lokal pruefen: Browser-Konsole,
   fehlende Assets, relevanter Flow sowie Desktop/Mobile gemaess AGENTS.md.
   Native Tastaturtests benoetigen reale Geraete; fehlende Tests benennen.
4. `git diff --check`, `git diff` und unversionierte Dateien separat pruefen.
5. Dateien, Tests und Restrisiken nennen. Commit/Push nur bei Beauftragung;
   lokales Verify ist kein Nachweis fuer ein erfolgreiches Deployment.
