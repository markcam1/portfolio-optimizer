import { app, BrowserWindow, dialog } from 'electron'
import path from 'path'
import { ensureDirs, getAppDataDir } from './pathUtils'
import { findFreePort, startPython, stopPython } from './pythonManager'
import { registerIpcHandlers } from './ipcHandlers'

// HMR support in development (electron-vite)
if (!app.isPackaged) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    ensureDirs()
    const port = await findFreePort()
    const appDataPath = getAppDataDir()
    await startPython(port, appDataPath)
    registerIpcHandlers()
    createWindow()
  } catch (err) {
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the backend service:\n\n${err instanceof Error ? err.message : String(err)}`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  stopPython()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => stopPython())
