#!/usr/bin/env node
/**
 * Zero-dependency local web server for the offline Mandrel build. Double
 * clicking a static index.html doesn't work in modern browsers — they block
 * the app's module scripts when loaded from a file:// address — so this
 * spins up a plain HTTP server on localhost and opens it in the default
 * browser instead. Nothing here talks to the internet; it only serves the
 * files in the sibling "app" folder (the output of `npm run build:offline`).
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

const APP_DIR = path.join(__dirname, 'app')
const START_PORT = 8888

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
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
}

if (!fs.existsSync(APP_DIR)) {
  console.error('\nCould not find the "app" folder next to serve.cjs.')
  console.error('Run `npm run build:offline` first, or re-download the package.\n')
  process.exit(1)
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  const resolved = path.normalize(path.join(base, decoded))
  if (!resolved.startsWith(base)) return null   // block ../ escapes
  return resolved
}

function send(res, status, body, headers) {
  res.writeHead(status, headers)
  res.end(body)
}

const server = http.createServer((req, res) => {
  let filePath = safeJoin(APP_DIR, req.url === '/' ? '/index.html' : req.url)
  if (!filePath) { send(res, 400, 'Bad request'); return }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback: unknown paths get index.html so a refresh never 404s.
      filePath = path.join(APP_DIR, 'index.html')
    }
    const ext = path.extname(filePath).toLowerCase()
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { send(res, 500, 'Server error reading file'); return }
      send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    })
  })
})

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd, () => { /* if this fails, the console message below still has the URL */ })
}

let port = START_PORT
let attemptsLeft = 20

function tryListen() {
  server.listen(port, '127.0.0.1')
}

server.on('listening', () => {
  const url = `http://localhost:${port}/`
  console.log('\nMandrel is running at ' + url)
  console.log('Leave this window open while you work. Close it to stop the studio.\n')
  openBrowser(url)
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE' && attemptsLeft > 0) { attemptsLeft--; port++; tryListen() }
  else { console.error('Could not start the local server:', err.message); process.exit(1) }
})

tryListen()
