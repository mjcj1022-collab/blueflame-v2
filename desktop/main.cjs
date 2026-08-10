'use strict'
/**
 * Mandrel Studio — offline desktop app (the $450 downloadable version).
 * Serves the bundled studio over a local port and opens it in a native window.
 * Runs fully offline: the studio's design, sculpt, quoting and export tools are
 * all client-side. Cloud sync, team accounts and the AI studio need the hosted
 * version and are simply inactive here.
 */
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { listen } = require('./server.cjs')

const DIST = path.join(__dirname, 'dist')   // the built app is copied here at package time
let httpServer = null

async function createWindow() {
  const { server, port } = await listen(DIST)
  httpServer = server

  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#131619',
    title: 'Mandrel Studio',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  // Open external links (docs, mailto) in the system browser, not the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { void shell.openExternal(url); return { action: 'deny' } }
    return { action: 'allow' }
  })
  await win.loadURL(`http://127.0.0.1:${port}/`)
}

app.whenReady().then(createWindow).catch(err => {
  console.error('Failed to start Mandrel Studio:', err)
  app.quit()
})

app.on('window-all-closed', () => {
  if (httpServer) { try { httpServer.close() } catch { /* already closed */ } }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
