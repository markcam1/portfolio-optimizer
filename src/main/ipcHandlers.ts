import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import { getApiUrl } from './pythonManager'
import { getAppDataDir } from './pathUtils'

export function registerIpcHandlers(): void {
  ipcMain.handle('get-api-url', () => getApiUrl())

  ipcMain.handle('get-app-data-path', () => getAppDataDir())

  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Portfolio CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('read-file', (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('get-app-version', () => app.getVersion())
}
