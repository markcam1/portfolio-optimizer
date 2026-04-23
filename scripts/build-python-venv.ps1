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

Write-Host ""
Write-Host "Done! venv is ready at backend\venv\"
Write-Host "Run 'npm run dev' to start the app in development mode."
