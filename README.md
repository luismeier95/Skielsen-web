# SKIELSEN v14j – GitHub Pages Testbuild

Dieser Ordner ist direkt für GitHub Pages vorbereitet.

## Deployment

1. Lege die Dateien `index.html` und `.nojekyll` in das Root-Verzeichnis deines GitHub-Repositories.
2. Öffne in GitHub:
   **Settings → Pages**
3. Unter **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
4. Speichern.
5. Nach kurzer Zeit erscheint dort die öffentliche HTTPS-URL, typischerweise:
   `https://<dein-github-name>.github.io/<repo-name>/`

## Supabase Auth

Für normales E-Mail/Passwort-Login funktioniert die Seite direkt über HTTPS.

Falls E-Mail-Bestätigung, Passwort-Reset oder Magic Links genutzt werden, trage die GitHub-Pages-URL zusätzlich in Supabase ein:

**Supabase → Authentication → URL Configuration**

- Site URL: deine GitHub-Pages-URL
- Redirect URLs: dieselbe URL, ggf. zusätzlich mit `/**`

## Sicherheit

Im Browser darf nur der öffentliche Supabase Publishable/Anon Key verwendet werden.
Ein `service_role`-Key gehört niemals in `index.html`.

Der Schutz der Daten erfolgt weiterhin über Supabase Auth und RLS.

## Test

Nach dem Öffnen sollte oben rechts **VERBUNDEN** stehen.
Danach:
1. anmelden,
2. Probeturnier erstellen,
3. Spiele auswählen,
4. Extras prüfen,
5. Checkout simulieren,
6. Spielreihenfolge festlegen,
7. Lobby öffnen.
