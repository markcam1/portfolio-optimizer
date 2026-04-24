# Portfolio Optimizer

A desktop app for modern portfolio optimization — built for students, brokers, and advisers who want institutional-grade results without writing Python.

Upload a portfolio, pick a risk model, and get optimal weights in seconds.

---

## Features

- **24 risk measures** — from classic Standard Deviation (Markowitz) to CVaR, Max Drawdown, Ulcer Index, and more. Each with a plain-English tooltip.
- **4 optimization objectives** — Maximize Sharpe Ratio, Minimize Risk, Maximize Return, Maximize Utility.
- **Yahoo Finance data** — enter tickers, pick a date range, and the app fetches price history automatically.
- **CSV upload** — import your asset list from any brokerage export.
- **Results dashboard** — optimal weights (pie chart + table), Sharpe ratio, expected return, portfolio risk, and per-asset risk contribution.
- **Run history** — every optimization is saved locally as JSON and accessible from the dashboard.
- **PDF export** — download a full report (metrics, allocation pie chart, weights table, risk contribution chart) directly from the Results page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 31 |
| Frontend | React 18 + Vite + Tailwind CSS |
| State | Zustand + React Query |
| Charts | Recharts |
| Backend | FastAPI + Uvicorn (local subprocess) |
| Optimization | Riskfolio-Lib 7.x |
| Market data | yfinance (Yahoo Finance) |
| Packaging | electron-builder (NSIS for Windows) |

The frontend and backend communicate over HTTP on a dynamically assigned localhost port — no external services, no cloud, fully offline.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Python** 3.10+ — [python.org](https://www.python.org)
- **npm** (comes with Node.js)

### 1. Install Node dependencies

```bash
npm install
```

### 2. Build the Python environment

**Linux / macOS:**
```bash
bash scripts/build-python-venv.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\build-python-venv.ps1
```

This creates `backend/venv/` with FastAPI, Riskfolio-Lib, yfinance, and all other dependencies. You only need to do this once (or after updating `backend/requirements.txt`).

### 3. Run in development mode

```bash
npm run dev
```

Electron opens the app window. The Python backend starts automatically on a random local port. DevTools open in a detached window.

---

## CSV Format

Upload a file with one ticker per line. A header row is optional.

**Minimal format:**
```
AAPL
MSFT
GOOGL
JPM
META
```

**With optional header:**
```
ticker
AAPL
MSFT
GOOGL
```

**Multi-column (from brokerage exports):** any CSV that contains a column named `ticker` (case-insensitive) works — extra columns are ignored.

---

## Optimization Parameters

| Parameter | What it controls |
|---|---|
| **Risk measure (rm)** | What kind of risk the optimizer minimizes or balances |
| **Objective (obj)** | What the optimizer tries to achieve |
| **Risk-free rate (rf)** | Annual rate used in Sharpe ratio (e.g. `0.045` for 4.5%) |
| **Risk aversion (λ)** | Only for Utility objective — higher = more conservative |
| **Alpha (α)** | Tail probability for CVaR/EVaR/CDaR and similar measures |
| **method_mu** | How expected returns are estimated |
| **method_cov** | How the covariance matrix is estimated |
| **Date range** | Historical window used for all calculations |

### Starter risk measures

| Code | Name | Good for |
|---|---|---|
| `MV` | Standard Deviation | General use, most studied |
| `MSV` | Semi Std Deviation | Penalizes only downside volatility |
| `CVaR` | Cond. Value at Risk | Tail risk — average of worst scenarios |
| `MDD` | Max Drawdown | Minimizing peak-to-trough losses |
| `CDaR` | Cond. Drawdown at Risk | Smoother version of Max Drawdown |

19 additional advanced measures are available via the "Show advanced" toggle.

---

## Project Structure

```
portfolio-optimizer/
├── src/
│   ├── main/          # Electron main process (spawns Python, manages lifecycle)
│   ├── preload/       # Context bridge (exposes safe IPC API to renderer)
│   └── renderer/src/  # React app
│       ├── pages/     # Home, Upload, Configure, Results
│       ├── components/ # UI primitives, layout, charts
│       ├── store/     # Zustand stores (optimization state, UI state)
│       ├── api/       # HTTP client wrappers for each endpoint
│       └── utils/     # CSV parser, formatters, constants (RM labels/tooltips)
├── backend/
│   ├── main.py        # FastAPI app
│   ├── routers/       # /api/optimize, /api/validate-tickers, /api/runs, /api/export/pdf
│   ├── services/      # optimizer.py (Riskfolio), data_fetcher.py (yfinance), run_store.py
│   ├── models/        # Pydantic request/response schemas
│   └── utils/         # Path resolution, logging
└── scripts/
    ├── build-python-venv.sh   # Linux/macOS venv setup
    └── build-python-venv.ps1  # Windows venv setup
```

---

## Building for Distribution

### Windows installer (NSIS)

#### Before you build — replace the placeholder icon

`resources/icons/icon.ico` currently contains a 32×32 solid-color placeholder so that `electron-builder` does not fail. Replace it with your real icon before shipping:

1. Create a proper `.ico` file at 256×256 (also include 128, 64, 48, 32, 16 px sizes for best results). Tools: [GIMP](https://www.gimp.org), [IcoFX](https://icofx.ro), or any online ICO converter.
2. Overwrite `resources/icons/icon.ico` with the new file.
3. If you also target **macOS**, add `resources/icons/icon.icns`; for **Linux**, add `resources/icons/icon.png` (512×512 recommended).

#### Build the installer

```powershell
npm run pack
```

Output: `dist-electron\Portfolio Optimizer Setup x.x.x.exe`

The installer bundles the full Python venv — end users do **not** need Python installed.

> **Note:** The Python venv must be built on the same OS as the target platform, since some packages (numpy, cvxpy) include platform-specific compiled extensions.

---

## Data & Privacy

All data stays on your machine:

- Price data is fetched from Yahoo Finance at run time and is not stored.
- Optimization results are saved as JSON files in your OS app-data folder:
  - **Windows:** `%APPDATA%\Portfolio Optimizer\runs\`
  - **macOS:** `~/Library/Application Support/Portfolio Optimizer/runs/`
  - **Linux:** `~/.config/Portfolio Optimizer/runs/`
- Log files are written to the `logs/` subfolder in the same location.

---

## Roadmap

- [x] Phase 1 — Core optimization (MV, CVaR, MDD + 21 more), results dashboard, run history
- [x] Phase 2 — PDF report download (reportlab + matplotlib; pie chart, bar chart, tables)
- [ ] Phase 3 — Efficient frontier chart, multiple solver support
- [ ] Phase 4 — Black-Litterman views, factor model support
- [ ] Phase 5 — Multi-source data (Alpha Vantage, Quandl, manual CSV price upload)

---

## Acknowledgements

Optimization engine powered by [Riskfolio-Lib](https://github.com/dcajasn/Riskfolio-Lib) by Dany Cajas.
Market data via [yfinance](https://github.com/ranaroussi/yfinance).
