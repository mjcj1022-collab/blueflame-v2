# Commit and push the Blue Flame -> Mandrel rebrand.
# Run from anywhere: powershell -ExecutionPolicy Bypass -File commit-rebrand.ps1

$repo = "C:\Users\Bluef\blueflame-v2"
Set-Location $repo

Write-Host "Status before commit:"
git status --short

git add -A
git commit -m "Rebrand: Blue Flame -> Mandrel

- Rename brand text everywhere: UI, docs, legal pages, emails, AI prompts,
  exported files (STL/OBJ/STEP/DXF/PDF names)
- Server: rename existing tenant in place (blue-flame -> mandrel slug),
  no duplicate/orphaned tenant
- Server: auto-migrate blueflame.db -> mandrel.db on first boot if the
  old file exists, no data loss
- Server: offline-download route checks Mandrel-Offline.zip first, falls
  back to BlueFlame-Offline.zip so existing published builds keep working
- Frontend: one-time localStorage migration copies old blue-flame.* keys
  to mandrel.* so returning visitors keep settings/autosave/gallery/etc.
- render.yaml: service/disk renamed to mandrel-api/mandrel-data (do not
  Sync Blueprint until the Render dashboard service is renamed manually)
- New offline launchers: 'Start Mandrel (Windows).bat' / '(Mac).command'"

git push

Write-Host "`nDone. Remember: rename the Render service in its dashboard before syncing render.yaml there."
