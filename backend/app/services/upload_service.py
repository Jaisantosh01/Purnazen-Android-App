import io
import logging
import os
import uuid

from fastapi import HTTPException, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_MIME_MAGIC = {
    b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
    b"\x89PNG": ("image/png", ".png"),
}
_MAX_BYTES = settings.SCAN_MAX_FILE_SIZE_MB * 1024 * 1024


def _check_mime(header: bytes) -> str:
    for magic, (mime, _ext) in _ALLOWED_MIME_MAGIC.items():
        if header[: len(magic)] == magic:
            return mime
    raise HTTPException(
        status_code=415,
        detail="Unsupported file type. Only JPEG and PNG are accepted.",
    )


def _ext_from_magic(header: bytes) -> str:
    for magic, (_mime, ext) in _ALLOWED_MIME_MAGIC.items():
        if header[: len(magic)] == magic:
            return ext
    return ".jpg"


def _configure_cloudinary() -> bool:
    if not settings.CLOUDINARY_CLOUD_NAME:
        return False
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    return True


class UploadService:

    @staticmethod
    async def validate_and_upload(
        file: UploadFile,
        user_id: int,
        folder_suffix: str = "raw",
    ) -> dict:
        """Validate MIME + size then upload.

        When Cloudinary is configured, uploads there.
        Otherwise falls back to local filesystem storage (dev/test mode).

        Returns ``{"url": str, "public_id": str, "bytes": int, "width": None, "height": None}``.
        """
        content = await file.read()

        if len(content) > _MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {settings.SCAN_MAX_FILE_SIZE_MB} MB.",
            )

        _check_mime(content[:8])

        # Dimension check — reject images that are too small for analysis
        from PIL import Image as PILImage
        pil_img = PILImage.open(io.BytesIO(content))
        w, h = pil_img.size
        if w < 400 or h < 400:
            raise HTTPException(
                status_code=422,
                detail=f"Image too small ({w}×{h}). Minimum 400×400 pixels required.",
            )

        if _configure_cloudinary():
            return await UploadService._upload_cloudinary(content, user_id, folder_suffix)
        return UploadService._save_local(content, user_id, folder_suffix)

    @staticmethod
    async def _upload_cloudinary(content: bytes, user_id: int, folder_suffix: str) -> dict:
        import cloudinary.uploader
        folder = f"face_scans/{user_id}/{folder_suffix}"
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(content),
                folder=folder,
                resource_type="image",
            )
        except Exception as exc:
            logger.exception("Cloudinary upload failed: %s", exc)
            raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")

        return {
            "url": result.get("secure_url", ""),
            "public_id": result.get("public_id", ""),
            "bytes": result.get("bytes", len(content)),
            "width": result.get("width"),
            "height": result.get("height"),
        }

    @staticmethod
    def _save_local(content: bytes, user_id: int, folder_suffix: str) -> dict:
        ext = _ext_from_magic(content[:8])
        rel_dir = os.path.join(settings.LOCAL_UPLOADS_DIR, "face_scans", str(user_id), folder_suffix)
        abs_dir = os.path.join(os.getcwd(), rel_dir)
        os.makedirs(abs_dir, exist_ok=True)

        filename = f"{uuid.uuid4().hex}{ext}"
        abs_path = os.path.join(abs_dir, filename)
        with open(abs_path, "wb") as fh:
            fh.write(content)

        rel_path = os.path.join("face_scans", str(user_id), folder_suffix, filename).replace("\\", "/")
        url = f"{settings.LOCAL_UPLOADS_BASE_URL}/{settings.LOCAL_UPLOADS_DIR}/{rel_path}"
        logger.info("Image saved locally: %s", abs_path)

        return {
            "url": url,
            "public_id": rel_path,   # used as key for local delete
            "bytes": len(content),
            "width": None,
            "height": None,
        }

    @staticmethod
    def delete_image(public_id: str) -> None:
        if not public_id:
            return
        if _configure_cloudinary():
            import cloudinary.uploader
            try:
                cloudinary.uploader.destroy(public_id)
            except Exception as exc:
                logger.warning("Cloudinary delete failed for %s: %s", public_id, exc)
        else:
            # Local file delete
            abs_path = os.path.join(
                os.getcwd(),
                settings.LOCAL_UPLOADS_DIR,
                public_id.replace("/", os.sep),
            )
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception as exc:
                logger.warning("Local file delete failed for %s: %s", abs_path, exc)
