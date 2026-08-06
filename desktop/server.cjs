'use strict'
/**
 * Tiny static file server for the offline desktop build. Electron can't load a
 * Vite bundle straight off disk (file:// blocks ES-module scripts), so we serve
 * the built app over 127.0.0.1 on a random port and point the window at it.
 * No dependencies — just Node's http/fs. Path-traversal guarded; unknown paths
 * fall back to index.html so client routing still works.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

/** Build a static server rooted at `root`. Returns the http.Server (not yet listening). */
function createStaticServer(root) {
  const ROOT = path.resolve(root)
  return http.createServer((req, res) => {
    let urlPath
    try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]) } catch { urlPath = '/' }
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html'
    const file = path.join(ROOT, urlPath)
    // Refuse anything that escapes the served root.
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Forbidden'); return }
    fs.readFile(file, (err, data) => {
      if (err) {
        // Unknown path → hand back index.html so client-side routing works.
        fs.readFile(path.join(ROOT, 'index.html'), (e2, idx) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(idx)
        })
        return
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    })
  })
}

/** Start the server on a free localhost port; resolves with the chosen port. */
function listen(root) {
  return new Promise((resolve, reject) => {
    const server = createStaticServer(root)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

module.exports = { createStaticServer, listen, MIME }
