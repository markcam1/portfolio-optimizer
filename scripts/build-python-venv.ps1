# Creates the backend Python venv and installs all dependencies.
# Run this once before `npm run dev` or `npm run pack`.
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\backend"
$RiskfolioDir = Join-Path $ScriptDir "..\Riskfolio-Lib"

Set-Location $BackendDir

Write-Host "==> Creating Python venv in backend\venv\ ..."
python -m venv venv

Write-Host "==> Upgrading pip ..."
.\venv\Scripts\pip install --upgrade pip wheel

Write-Host "==> Installing requirements ..."
.\venv\Scripts\pip install -r requirements.txt

# Install local Riskfolio-Lib if the clone exists
if (Test-Path $RiskfolioDir) {
    Write-Host "==> Installing local Riskfolio-Lib ..."
    .\venv\Scripts\pip install -e $RiskfolioDir
}

Write-Host "==> Installing PyInstaller ..."
.\venv\Scripts\pip install pyinstaller

Write-Host "==> Building standalone backend executable ..."
.\venv\Scripts\pyinstaller `
  --name backend `
  --onedir `
  --noconfirm `
  --distpath dist `
  --workpath build `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops `
  --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.loops.asyncio `
  --hidden-import uvicorn.protocols `
  --hidden-import uvicorn.protocols.http `
  --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.http.h11_impl `
  --hidden-import uvicorn.protocols.websockets `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.lifespan `
  --hidden-import uvicorn.lifespan.on `
  --hidden-import anyio._backends._asyncio `
  --hidden-import matplotlib.backends.backend_agg `
  --collect-all cvxpy `
  server.py

Write-Host ""
Write-Host "Done!"
Write-Host "  venv:       backend\venv\        (for 'npm run dev')"
Write-Host "  executable: backend\dist\backend\ (bundled in 'npm run pack')"
