"""Client-side error reporting endpoint.

Mobile clients POST here when they catch an unhandled JS error or a
significant UI failure so we can debug without waiting for user reports.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db

router = APIRouter(prefix="/errors", tags=["Error Reporting"])
logger = logging.getLogger("client.errors")


class ErrorReportPayload(BaseModel):
    message: str = Field(..., max_length=1000)
    stack: str | None = Field(None, max_length=8000)
    screen: str | None = Field(None, max_length=200)
    action: str | None = Field(None, max_length=200)
    platform: str | None = Field(None, max_length=50)
    app_version: str | None = Field(None, max_length=30)
    extra: dict | None = None


@router.post("/report", summary="Report a client-side error")
async def report_error(
    payload: ErrorReportPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    ts = datetime.now(timezone.utc).isoformat()
    logger.error(
        "[CLIENT ERROR] %s | screen=%s action=%s platform=%s version=%s ip=%s ts=%s\n%s",
        payload.message,
        payload.screen or "-",
        payload.action or "-",
        payload.platform or "-",
        payload.app_version or "-",
        request.client.host if request.client else "-",
        ts,
        (payload.stack or "")[:2000],
    )
    return {"success": True, "logged_at": ts}
