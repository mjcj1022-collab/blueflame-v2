# Cleanup after the Blue Flame -> Mandrel rebrand.
# Run from anywhere: powershell -ExecutionPolicy Bypass -File cleanup-rebrand.ps1

$repo = "C:\Users\Bluef\blueflame-v2"

# 1. Remove the stale pre-rename offline launchers (superseded by the
#    "Start Mandrel (...)" versions already sitting alongside them).
$stale = @(
  Join-Path $repo "offline\Start Blue Flame (Windows).bat",
  Join-Path $repo "offline\Start Blue Flame (Mac).command"
)
foreach ($f in $stale) {
  if (Test-Path $f) {
    Remove-Item $f -Force
    Write-Host "Removed: $f"
  } else {
    Write-Host "Already gone: $f"
  }
}

# 2. Sanity check: scan the repo for anything the rename might have missed.
#    Expected hits are only the intentional migration/legacy-fallback
#    comments in server/src/{db,seed,mail,index}.ts, server/.env.example,
#    render.yaml, src/main.tsx, src/lib/brandMigration.ts, and server/README.md.
Write-Host "`nScanning for leftover 'Blue Flame' references..."
Get-ChildItem $repo -Recurse -File `
  -Exclude "node_modules","dist",".git" |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\dist\\|\\.git\\" } |
  Select-String -Pattern "blue.?flame" -CaseSensitive:$false |
  Where-Object { $_.Line -notmatch "blueflame-v2" } |
  ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }

Write-Host "`nDone. Review any lines printed above -- they should only be the expected migration/legacy notes."
