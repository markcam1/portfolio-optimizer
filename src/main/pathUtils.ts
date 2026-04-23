import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export function getAppDataDir(): string {
  return app.getPath('userData')
}

export function getRunsDir(): string {
  return path.join(getAppDataDir(), 'runs')
}

export function getLogsDir(): string {
  return path.join(getAppDataDir(), 'logs')
}

export function ensureDirs(): void {
  for (const dir of [getRunsDir(), getLogsDir()]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
