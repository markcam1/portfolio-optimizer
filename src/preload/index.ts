import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  getApiUrl: (): Promise<string> =>
    ipcRenderer.invoke('get-api-url'),

  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('open-file-dialog'),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('read-file', filePath),

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-app-version'),

  platform: process.platform
})

// Type augmentation — used by the renderer
export {}
