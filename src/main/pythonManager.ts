import { app } from 'electron'
import { spawn, ChildProcess, SpawnOptions } from 'child_process'
import net from 'net'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { getLogsDir } from './pathUtils'

let pythonProcess: ChildProcess | null = null
let assignedPort = 0

/** Bind to port 0 to let the OS pick a free port, then release and return it. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Could not determine port'))
        return
      }
      const port = addr.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function getPythonBinary(): string {
  if (app.isPackaged) {
    // PyInstaller one-dir bundle; executable lives alongside its _internal/ deps
    const base = process.resourcesPath
    return process.platform === 'win32'
      ? path.join(base, 'backend', 'backend.exe')
      : path.join(base, 'backend', 'backend')
  }
  // Development: __dirname is out/main/, so two levels up reaches project root
  const projectRoot = path.join(__dirname, '..', '..')
  return process.platform === 'win32'
    ? path.join(projectRoot, 'backend', 'venv', 'Scripts', 'python.exe')
    : path.join(projectRoot, 'backend', 'venv', 'bin', 'python')
}

function getBackendDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(__dirname, '..', '..', 'backend')
}

function pollHealth(port: number, maxWaitMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed > maxWaitMs) {
        clearInterval(interval)
        reject(new Error(`Python backend did not start within ${maxWaitMs / 1000}s`))
        return
      }
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval)
          resolve()
        }
      })
      req.on('error', () => {/* still starting */})
      req.setTimeout(400, () => req.destroy())
    }, 500)
  })
}

export async function startPython(port: number, appDataPath: string): Promise<void> {
  assignedPort = port
  const python = getPythonBinary()
  const backendDir = getBackendDir()

  if (!fs.existsSync(python)) {
    throw new Error(
      `Python binary not found at: ${python}\n` +
      `Run scripts/build-python-venv.sh (or .ps1 on Windows) to create the venv.`
    )
  }

  const logFile = path.join(getLogsDir(), `backend-${new Date().toISOString().slice(0, 10)}.log`)
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP_DATA_PATH: appDataPath,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1'
  }

  // Packaged: PyInstaller binary reads port from argv[1].
  // Dev: invoke uvicorn via the venv python.
  const args = app.isPackaged
    ? [String(port)]
    : ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port), '--no-access-log']

  // In packaged mode uvicorn needs to find `main.py` in backend/
  const cwd = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : backendDir

  pythonProcess = spawn(python, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })

  pythonProcess.stdout?.on('data', (d: Buffer) => {
    const line = d.toString()
    logStream.write(line)
    if (!app.isPackaged) process.stdout.write(`[backend] ${line}`)
  })
  pythonProcess.stderr?.on('data', (d: Buffer) => {
    const line = d.toString()
    logStream.write(line)
    if (!app.isPackaged) process.stderr.write(`[backend] ${line}`)
  })

  pythonProcess.on('exit', (code, signal) => {
    logStream.write(`[pythonManager] Process exited: code=${code} signal=${signal}\n`)
    logStream.end()
    pythonProcess = null
  })

  await pollHealth(port)
}

export function stopPython(): void {
  if (!pythonProcess) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'])
  } else {
    pythonProcess.kill('SIGTERM')
  }
  pythonProcess = null
}

export function getApiUrl(): string {
  return `http://127.0.0.1:${assignedPort}`
}
