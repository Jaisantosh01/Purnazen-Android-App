from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder


def success_response(message, data=None, status_code=200):
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(
            {
                "success": True,
                "message": message,
                "data": data,
            }
        ),
    )


def error_response(message, status_code=400, reason=None, guidance=None, extra=None):
    """Standard error envelope.

    ``reason``/``guidance`` carry a machine code + user-facing fix (used by the
    scan quality gate); ``extra`` merges additional top-level keys into the body.
    """
    body = {"success": False, "message": message}
    if reason is not None:
        body["reason"] = reason
    if guidance is not None:
        body["guidance"] = guidance
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))
