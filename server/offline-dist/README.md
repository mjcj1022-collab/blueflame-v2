# Offline build — publish steps

This folder holds the actual `.zip` that `/api/offline-download` serves to
customers who bought the $450 offline plan. It's a real file committed to
the repo (not a build artifact), because Render's server needs something to
read off disk when a customer clicks download.

## To publish a new build (do this once now, then again after any real
## update to the app)

1. On GitHub, run the **"Build Offline Package"** action (Actions tab →
   select it → Run workflow).
2. Once it finishes, download the `Mandrel-Offline` artifact — it's a zip
   containing `Mandrel-Offline.zip`.
3. Unzip that outer wrapper once; you'll have the real `Mandrel-Offline.zip`
   inside.
4. Put that file right here, named exactly `Mandrel-Offline.zip`, replacing
   whatever's already in this folder.
5. `git add server/offline-dist/Mandrel-Offline.zip && git commit -m "Publish offline build" && git push origin main`

That's it — Render redeploys automatically and the download route picks up
the new file immediately (no code change needed).

## Until step 4 is done at least once

`/api/offline-download` returns a 503 with a friendly error instead of a
file, so nothing crashes — customers just won't be able to download yet.
