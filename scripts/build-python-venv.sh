#!/usr/bin/env bash
# Creates the backend Python venv and installs all dependencies.
# Run this once before `npm run dev` or `npm run pack`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
RISKFOLIO_DIR="$SCRIPT_DIR/../Riskfolio-Lib"

cd "$BACKEND_DIR"

echo "==> Creating Python venv in backend/venv/ ..."
python3 -m venv venv

echo "==> Upgrading pip ..."
venv/bin/pip install --upgrade pip wheel

echo "==> Installing requirements ..."
venv/bin/pip install -r requirements.txt

# Install local Riskfolio-Lib if the clone exists
if [ -d "$RISKFOLIO_DIR" ]; then
  echo "==> Installing local Riskfolio-Lib ..."
  venv/bin/pip install -e "$RISKFOLIO_DIR"
fi

echo "==> Installing PyInstaller ..."
venv/bin/pip install pyinstaller

echo "==> Building standalone backend executable ..."
venv/bin/pyinstaller \
  --name backend \
  --onedir \
  --noconfirm \
  --distpath dist \
  --workpath build \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.loops.asyncio \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.http.h11_impl \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import anyio._backends._asyncio \
  --hidden-import matplotlib.backends.backend_agg \
  --collect-all cvxpy \
  server.py

echo ""
echo "Done!"
echo "  venv:       backend/venv/     (for 'npm run dev')"
echo "  executable: backend/dist/backend/backend  (bundled in 'npm run pack')"
