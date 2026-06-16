from fastapi.responses import JSONResponse


def success_response(message, data=None, status_code=200):
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "message": message, "data": data},
    )


def error_response(message, status_code=400, reason=None, guidance=None, extra=None):
    """Standard error envelope.

    Optional ``reason`` (machine code) + ``guidance`` (user-facing fix) let the
    client react specifically — e.g. the capture-quality gate returns
    ``reason="too_dark"`` so the app shows tailored retake guidance.
    """
    content = {"success": False, "message": message}
    if reason is not None:
        content["reason"] = reason
    if guidance is not None:
        content["guidance"] = guidance
    if extra:
        content.update(extra)
    return JSONResponse(status_code=status_code, content=content)
