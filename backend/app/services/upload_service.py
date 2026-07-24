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


def _mime_from_magic(header: bytes) -> str:
    for magic, (mime, _ext) in _ALLOWED_MIME_MAGIC.items():
        if header[: len(magic)] == magic:
            return mime
    return "image/jpeg"


def _get_azure_client():
    """Return a BlobServiceClient if Azure credentials are configured, else None."""
    if not all([
        settings.AZURE_STORAGE_ACCOUNT_NAME,
        settings.AZURE_STORAGE_ACCOUNT_KEY,
        settings.AZURE_SCANS_CONTAINER_NAME,
    ]):
        return None
    from azure.storage.blob import BlobServiceClient
    connection_string = (
        f"DefaultEndpointsProtocol=https;"
        f"AccountName={settings.AZURE_STORAGE_ACCOUNT_NAME};"
        f"AccountKey={settings.AZURE_STORAGE_ACCOUNT_KEY};"
        f"EndpointSuffix=core.windows.net"
    )
    return BlobServiceClient.from_connection_string(connection_string)


class UploadService:

    @staticmethod
    async def validate_and_upload(
        file: UploadFile,
        user_id: int,
        folder_suffix: str = "raw",
    ) -> dict:
        content = await file.read()
        return await UploadService.validate_and_upload_bytes(content, user_id, folder_suffix)

    @staticmethod
    async def validate_and_upload_bytes(
        content: bytes,
        user_id: int,
        folder_suffix: str = "raw",
    ) -> dict:
        """Validate MIME + size + dimensions then store bytes.

        Uploads to Azure Blob Storage when credentials are configured,
        otherwise falls back to local filesystem (dev/test).

        Returns ``{"url": str, "public_id": str, "bytes": int, "width": int|None, "height": int|None}``.
        """
        if len(content) > _MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {settings.SCAN_MAX_FILE_SIZE_MB} MB.",
            )

        _check_mime(content[:8])

        from PIL import Image as PILImage
        pil_img = PILImage.open(io.BytesIO(content))
        w, h = pil_img.size
        if w < 400 or h < 400:
            raise HTTPException(
                status_code=422,
                detail=f"Image too small ({w}×{h}). Minimum 400×400 pixels required.",
            )

        client = _get_azure_client()
        if client:
            return await UploadService._upload_azure(client, content, user_id, folder_suffix)
        return UploadService._save_local(content, user_id, folder_suffix)

    @staticmethod
    async def _upload_azure(client, content: bytes, user_id: int, folder_suffix: str) -> dict:
        from azure.storage.blob import ContentSettings
        from app.utils.azure_storage import generate_scan_sas_url

        ext = _ext_from_magic(content[:8])
        mime = _mime_from_magic(content[:8])
        blob_name = f"face_scans/{user_id}/{folder_suffix}/{uuid.uuid4().hex}{ext}"

        try:
            blob_client = client.get_blob_client(
                container=settings.AZURE_SCANS_CONTAINER_NAME,
                blob=blob_name,
            )
            blob_client.upload_blob(
                content,
                overwrite=True,
                content_settings=ContentSettings(content_type=mime),
            )
        except Exception as exc:
            # Names the container: the usual cause of a hard failure here is the
            # uploads container not existing on the storage account yet.
            logger.exception(
                "Azure upload failed (container=%s, blob=%s): %s",
                settings.AZURE_SCANS_CONTAINER_NAME, blob_name, exc,
            )
            raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")

        return {
            "url": generate_scan_sas_url(blob_name),
            "public_id": blob_name,
            "bytes": len(content),
            "width": None,
            "height": None,
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
            "public_id": rel_path,
            "bytes": len(content),
            "width": None,
            "height": None,
        }

    @staticmethod
    def store_processed(content: bytes, user_id: int, folder_suffix: str = "processed") -> dict:
        """Synchronously store an already-generated image (e.g. the enhanced preview).

        Called from the background pipeline (sync context). Skips MIME/dimension
        validation — we generated these bytes.
        Returns ``{"url": str, "public_id": str}``.
        """
        client = _get_azure_client()
        if client:
            from azure.storage.blob import ContentSettings
            from app.utils.azure_storage import generate_scan_sas_url

            ext = _ext_from_magic(content[:8])
            mime = _mime_from_magic(content[:8])
            blob_name = f"face_scans/{user_id}/{folder_suffix}/{uuid.uuid4().hex}{ext}"
            blob_client = client.get_blob_client(
                container=settings.AZURE_SCANS_CONTAINER_NAME,
                blob=blob_name,
            )
            blob_client.upload_blob(
                content,
                overwrite=True,
                content_settings=ContentSettings(content_type=mime),
            )
            return {"url": generate_scan_sas_url(blob_name), "public_id": blob_name}

        saved = UploadService._save_local(content, user_id, folder_suffix)
        return {"url": saved["url"], "public_id": saved["public_id"]}

    @staticmethod
    def delete_image(public_id: str) -> None:
        if not public_id:
            return
        client = _get_azure_client()
        if client:
            try:
                blob_client = client.get_blob_client(
                    container=settings.AZURE_SCANS_CONTAINER_NAME,
                    blob=public_id,
                )
                blob_client.delete_blob()
            except Exception as exc:
                logger.warning("Azure delete failed for %s: %s", public_id, exc)
        else:
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
