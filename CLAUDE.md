# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Install Node dependencies (once)
npm install

# Build the Python venv + PyInstaller bundle (once, or after changing requirements.txt)
bash scripts/build-python-venv.sh      # Linux/macOS
.\scripts\build-python-venv.ps1        # Windows
# Produces: backend/venv/ (used by npm run dev)
#           backend/dist/backend/ (bundled by npm run pack)

# Start the full app (Electron + Vite + Python backend)
npm run dev

# TypeScript build only (no Electron window — fast way to catch type errors)
npx electron-vite build

# Type-check without emitting
npm run typecheck
```

### Backend only (useful when iterating on Python logic)

```bash
# Start FastAPI manually on port 7842 (Linux/macOS)
APP_DATA_PATH=./dev-data backend/venv/bin/python -m uvicorn main:app \
  --host 127.0.0.1 --port 7842 --reload
# cwd must be backend/ — uvicorn resolves `main:app` relative to cwd
```

```powershell
# Start FastAPI manually on port 7842 (Windows)
$env:APP_DATA_PATH="./dev-data"; backend\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 7842 --reload
```

```bash
# Quick import / smoke test (Linux/macOS)
backend/venv/bin/python -c "import riskfolio; print(riskfolio.__version__)"
# Windows
backend\venv\Scripts\python -c "import riskfolio; print(riskfolio.__version__)"
```

### Packaging

```bash
npm run pack    # electron-vite build → electron-builder → dist-electron/
                # Windows: NSIS installer (.exe)
                # Linux:   AppImage
```

`npm run pack` bundles `backend/dist/backend/` (the PyInstaller one-dir output) into the app's resources as `backend/`. The venv is **not** bundled — it is only used during `npm run dev`. Always run the build script before `npm run pack` if either the PyInstaller bundle is missing or `requirements.txt` has changed:
- **Linux/macOS:** `bash scripts/build-python-venv.sh`
- **Windows:** `.\scripts\build-python-venv.ps1`

Both scripts create the venv **and** run PyInstaller to produce `backend/dist/backend/`.

To test the Linux build without reinstalling:
```bash
# Run the unpacked build (faster, no extraction step)
dist-electron/linux-unpacked/portfolio-optimizer

# Or run the AppImage directly
"dist-electron/Portfolio Optimizer-0.1.1.AppImage"
```

To test the Windows build without reinstalling:
```powershell
# Run the unpacked build directly
"dist-electron\win-unpacked\Portfolio Optimizer.exe"
```

Press **F12** in the running packaged app to open DevTools.

## Architecture

### Process model

The app has three processes running simultaneously:

1. **Electron main** (`src/main/`) — Node.js. Spawns the Python process, manages the window lifecycle, and registers IPC handlers. `pythonManager.ts` finds a free port with a `net.Server` bind-to-0 trick, launches uvicorn, and polls `/health` every 500 ms until the server is ready (30 s timeout).

2. **Python backend** (`backend/`) — FastAPI + Uvicorn on a random localhost port. All heavy computation (Riskfolio-Lib, yfinance) lives here. It is never exposed beyond `127.0.0.1`.

3. **Renderer** (`src/renderer/`) — React 18, runs inside the Electron window. Talks to the Python backend over HTTP via Axios. The port is discovered at runtime: `window.electron.getApiUrl()` calls `ipcRenderer.invoke('get-api-url')`, which the main process answers with `http://127.0.0.1:{port}`. Uses **`HashRouter`** (not `BrowserRouter`) — the packaged app loads via `file://` where `BrowserRouter` cannot match routes.

### Frontend ↔ Backend contract

All API types are mirrored in `src/renderer/src/types/api.ts`. The Python side uses Pydantic models in `backend/models/`. Keep them in sync manually — there is no codegen.

Key endpoints:
- `POST /api/validate-tickers` — calls yfinance to check each ticker before the user proceeds
- `POST /api/optimize` — fetches returns, runs Riskfolio, persists run JSON, returns full `OptimizationResult`
- `GET /api/runs` / `GET /api/runs/{id}` — reads saved JSON files from `{userData}/runs/`
- `POST /api/export/pdf` — generates and streams a PDF report; returns `application/pdf` with a `Content-Disposition: attachment` header

### State management split

- **Zustand** (`src/renderer/src/store/`) — session state that spans pages: uploaded tickers, validation results, the current config, and the latest optimization result. `optimizationStore` is the primary flow state.
- **React Query** (`useQuery`/`useMutation`) — server state: the runs list, individual run loads, the optimize mutation. The optimize mutation (`hooks/useOptimize.ts`) sets Zustand state on success and invalidates the `['runs']` query so the dashboard refreshes automatically.

### Optimization flow

`Upload → Configure → Results` is a linear wizard backed by Zustand. The full data flow:

```
CSV file → csvParser.ts → POST /api/validate-tickers
    → TickerList shows green/red chips → validTickers stored in Zustand

Configure form → POST /api/optimize
    → backend: yfinance download → pct_change().dropna() → rp.Portfolio
    → port.assets_stats(method_mu, method_cov)
    → port.optimization(model="Classic", rm, obj, rf, l, hist=True)
    → if w is None → 422 infeasible_portfolio (modal, not toast)
    → compute metrics (annualized, 252 days) → save JSON → return result

Results page reads from Zustand store (no re-fetch needed)
```

### Python backend internals

- `backend/server.py` — PyInstaller entry point. Reads port from `sys.argv[1]` and starts uvicorn with the app object directly. Used only in packaged builds; dev mode still invokes uvicorn via `python -m uvicorn`.
- `backend/main.py` — FastAPI app with CORS `allow_origins=["*"]` (safe: 127.0.0.1 only).
- `backend/services/optimizer.py` — the only file that touches Riskfolio. `port.mu` shape is `(1, n_assets)` in Riskfolio 7.x — always use `.values.flatten()`. Risk contributions use the MV analytical formula regardless of selected `rm` (pragmatic Phase 1 decision). The user-supplied `rf` is an annual rate; it is divided by 252 before passing to `port.optimization()` because Riskfolio expects `rf` in the same frequency as the return series (daily). The annualized `rf` is kept for the Sharpe display metric.
- `backend/utils/paths.py` — reads `APP_DATA_PATH` env var (set by Electron) for the userData directory. Falls back to `../dev-data/` when running the backend standalone in development.
- `backend/services/run_store.py` — simple JSON file per run; each file is a full `OptimizationResult` serialized with `model_dump_json()`.
- `backend/services/pdf_generator.py` — builds the PDF report with `reportlab` (tables, layout) and `matplotlib` (pie + bar charts rendered to PNG and embedded). All table `colWidths` are derived from `_PAGE_W = 7.0 in` and `_CHART_W = 3.9 in` constants — inner tables used inside side-by-side layouts must sum to `_SIDE_W = _PAGE_W - _CHART_W`, not the full page width.

### UI constants

`src/renderer/src/utils/constants.ts` is the single source of truth for:
- All 24 risk measure labels, descriptions, and `starter` / `advanced` categories
- `ALPHA_RM_SET` — which `rm` values expose the alpha parameter in the Configure form
- Chart color palette (20 colors, cycles for large portfolios)

### Key dependency notes

- **Riskfolio-Lib** is installed from PyPI (7.0.1). The local clone at `../Riskfolio-Lib/` requires Python 3.11+ for its latest scipy dependency — use the venv's installed version.
- `electron-vite` compiles `src/main/` and `src/preload/` with `externalizeDepsPlugin()` so Electron built-ins (`electron`, `node:*`) are not bundled. The renderer is a normal Vite/React build.
- `postcss.config.js` uses `export default` (ESM) — keep `"type": "module"` in `package.json`.
- **CSP** (`src/renderer/index.html`) — `style-src` must include `https://fonts.googleapis.com` for the Google Fonts `<link>` to load; it is not enough to add it only to `connect-src`.
