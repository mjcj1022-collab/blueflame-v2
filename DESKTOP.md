# Blue Flame Studio — Offline Desktop Build

The `desktop/` folder wraps the studio as a native desktop app (the **$450
downloadable version**). It runs fully offline: design, sculpt, quoting,
casting, and every export work with no internet. The hosted-only features —
cloud sync, team accounts, and the AI studio — are simply inactive in the
offline build.

It is completely isolated from the online site: nothing here changes the Vite
build that GitHub Pages or Render deploy.

## How it works

The built app can't be opened straight off disk (browsers block ES-module
scripts over `file://`). So the desktop app starts a tiny local server on
`127.0.0.1` and points a native Electron window at it. `desktop/server.cjs` is
that server (no dependencies); `desktop/main.cjs` is the Electron shell.

## Build an installer

You need Node 18+ installed. Run these from the repo root.

**1. Build the app and stage it into the desktop folder.**

Windows (PowerShell):
```powershell
npm install
npm run build
Remove-Item -Recurse -Force desktop\dist -ErrorAction SilentlyContinue
Copy-Item -Recurse dist desktop\dist
```

macOS / Linux:
```bash
npm install && npm run build
rm -rf desktop/dist && cp -r dist desktop/dist
```

**2. Package the installer.**
```bash
cd desktop
npm install
npm run dist          # installer for the OS you're on
# or target one explicitly:
#   npm run dist:win     → release/Blue Flame Studio Setup <version>.exe  (NSIS)
#   npm run dist:mac     → release/Blue Flame Studio-<version>.dmg
#   npm run dist:linux   → release/Blue Flame Studio-<version>.AppImage
```

The finished installer lands in `desktop/release/`. That single file is what a
customer downloads and runs after buying the offline license.

## Try it without packaging

```bash
# after step 1 above
cd desktop && npm install && npm start
```
This launches the app in a window straight from `desktop/dist`.

## Notes

- **Cross-platform installers:** you can only build a macOS `.dmg` on a Mac.
  Windows `.exe` and Linux `.AppImage` build on their own OS (or via CI). A
  cloud CI runner (GitHub Actions with a matrix of `windows`, `macos`, `ubuntu`)
  is the usual way to produce all three from one push.
- **Code signing:** unsigned installers trigger a "unknown publisher" warning on
  Windows/macOS. For a paid product, sign them — add a certificate to
  electron-builder (`win.certificateFile` / macOS notarization). Optional to
  start, worth it before wide release.
- **Licensing:** once a customer has the files there's no server check, so the
  offline build is honor-system by nature. A per-install license key can raise
  the bar but can't make offline software uncrackable — price and support are
  the real moat.
- **Updates:** to ship a new version, rebuild and re-distribute the installer.
  electron-builder also supports auto-update feeds if you host the artifacts.
