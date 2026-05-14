import json
import logging
import sys
from pathlib import Path
from typing import AsyncGenerator

import httpx

from models.responses import OptimizationResult

logger = logging.getLogger(__name__)


def _load_ollama_config() -> dict:
    # PyInstaller bundles data files to sys._MEIPASS; dev mode finds it next to main.py
    if hasattr(sys, '_MEIPASS'):
        config_path = Path(sys._MEIPASS) / 'config.json'
    else:
        config_path = Path(__file__).resolve().parent.parent / 'config.json'
    try:
        return json.loads(config_path.read_text(encoding='utf-8')).get('ollama', {})
    except Exception as exc:
        logger.warning("Could not read config.json, using defaults: %s", exc)
        return {}


_cfg = _load_ollama_config()
OLLAMA_BASE_URL: str = _cfg.get('base_url', 'http://127.0.0.1:11434')
OLLAMA_MODEL: str = _cfg.get('model', 'llama3.2')


class OllamaUnavailableError(Exception):
    pass


class OllamaModelNotFoundError(Exception):
    pass


def build_prompt(result: OptimizationResult) -> str:
    cfg = result.config
    rf_pct = float(cfg.get("rf", 0)) * 100
    alpha = cfg.get("alpha", 0.05)
    method_mu = cfg.get("method_mu", "")
    method_cov = cfg.get("method_cov", "")

    m = result.metrics
    ret_pct = m.expected_return * 100
    risk_pct = m.portfolio_risk * 100

    weights_rows = "\n".join(
        f"  {w.ticker:<8} {w.weight * 100:>6.2f}%"
        for w in sorted(result.weights, key=lambda w: w.weight, reverse=True)
    )
    risk_rows = "\n".join(
        f"  {r.ticker:<8} {r.contribution * 100:>6.2f}%"
        for r in sorted(result.risk_contributions, key=lambda r: r.contribution, reverse=True)
    )

    return f"""You are a portfolio analysis assistant. Analyze these optimization results concisely and practically.

Portfolio: {", ".join(result.tickers)} ({len(result.tickers)} assets)
Optimization: {m.obj_used} objective · {m.rm_used} risk measure
Period: {result.start_date} to {result.end_date} ({result.n_observations} trading days)
Risk-free rate: {rf_pct:.2f}%   Alpha: {alpha}   Return estimator: {method_mu}   Covariance: {method_cov}

Performance Metrics:
  Expected Annual Return : {ret_pct:.2f}%
  Portfolio Risk (Ann. SD): {risk_pct:.2f}%
  Sharpe Ratio            : {m.sharpe_ratio:.4f}

Asset Weights:
{weights_rows}

Risk Contributions:
{risk_rows}

Provide a brief analysis (4–6 sentences) covering:
1. Overall portfolio quality given the Sharpe ratio and risk level
2. Concentration or diversification observations
3. Any notable risk/return characteristics
4. Key caveats about the optimization approach or data limitations

Use plain English. Avoid jargon where possible."""


async def stream_analysis(result: OptimizationResult) -> AsyncGenerator[str, None]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": build_prompt(result)}],
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
            ) as response:
                if response.status_code == 404:
                    raise OllamaModelNotFoundError(OLLAMA_MODEL)
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        if text:
                            yield text
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        logger.warning("Skipping malformed NDJSON line: %s", line[:120])
    except httpx.ConnectError as exc:
        raise OllamaUnavailableError() from exc
