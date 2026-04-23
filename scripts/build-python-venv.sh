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

echo ""
echo "Done! venv is ready at backend/venv/"
echo "Run 'npm run dev' to start the app in development mode."
