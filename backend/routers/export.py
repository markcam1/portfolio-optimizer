import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class ExportPdfRequest(BaseModel):
    run_id: str


@router.post("/export/pdf")
def export_pdf(req: ExportPdfRequest):
    """Phase 2 stub — PDF generation not yet implemented."""
    logger.info("PDF export requested for run %s (not yet implemented)", req.run_id)
    return JSONResponse(
        status_code=501,
        content={
            "error": "not_implemented",
            "message": "PDF export is coming in the next release."
        }
    )
