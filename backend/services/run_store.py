import json
import logging
from pathlib import Path

from models.responses import OptimizationResult, RunSummary
from utils.paths import get_runs_dir

logger = logging.getLogger(__name__)


def save_run(result: OptimizationResult) -> None:
    path = get_runs_dir() / f"{result.run_id}.json"
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("Saved run %s → %s", result.run_id, path)


def load_run(run_id: str) -> OptimizationResult | None:
    path = get_runs_dir() / f"{run_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return OptimizationResult(**data)
    except Exception as exc:
        logger.error("Failed to load run %s: %s", run_id, exc)
        return None


def list_runs() -> list[RunSummary]:
    runs_dir = get_runs_dir()
    summaries: list[RunSummary] = []
    for path in sorted(runs_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            summaries.append(RunSummary(
                run_id=data["run_id"],
                timestamp=data["timestamp"],
                tickers=data["tickers"],
                ticker_count=len(data["tickers"]),
                obj=data["config"]["obj"],
                rm=data["config"]["rm"]
            ))
        except Exception as exc:
            logger.warning("Skipping malformed run file %s: %s", path.name, exc)
    return summaries
