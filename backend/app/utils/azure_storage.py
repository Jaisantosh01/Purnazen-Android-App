from datetime import datetime, timedelta, timezone

from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
    ContentSettings,
    generate_blob_sas,
)

from app.core.config import settings


def get_blob_service_client() -> BlobServiceClient | None:
    if not settings.AZURE_STORAGE_ACCOUNT_NAME or not settings.AZURE_STORAGE_ACCOUNT_KEY:
        return None
    connection_string = (
        f"DefaultEndpointsProtocol=https;"
        f"AccountName={settings.AZURE_STORAGE_ACCOUNT_NAME};"
        f"AccountKey={settings.AZURE_STORAGE_ACCOUNT_KEY};"
        f"EndpointSuffix=core.windows.net"
    )
    return BlobServiceClient.from_connection_string(connection_string)


def generate_sas_url(blob_name: str, expiry_minutes: int | None = None) -> str:
    """Generate a read-only SAS URL for a blob.

    Falls back to returning blob_name unchanged when credentials are missing
    (dev/local mode) or when blob_name is already a full URL.

    Args:
        blob_name: The blob path within the container (e.g. ``face_scans/1/raw/abc.jpg``).
        expiry_minutes: Override the default expiry. Defaults to
            ``settings.AZURE_SAS_EXPIRY_MINUTES``.
    """
    if not all([
        settings.AZURE_STORAGE_ACCOUNT_NAME,
        settings.AZURE_STORAGE_ACCOUNT_KEY,
        settings.AZURE_BLOB_CONTAINER_NAME,
    ]):
        return blob_name

    # Already a full URL — nothing to do (e.g. external/legacy blob_name)
    if blob_name.startswith("http"):
        return blob_name

    minutes = expiry_minutes if expiry_minutes is not None else settings.AZURE_SAS_EXPIRY_MINUTES
    sas_token = generate_blob_sas(
        account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
        container_name=settings.AZURE_BLOB_CONTAINER_NAME,
        blob_name=blob_name,
        account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=minutes),
    )
    return (
        f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
        f"/{settings.AZURE_BLOB_CONTAINER_NAME}/{blob_name}?{sas_token}"
    )


def generate_video_sas_url(blob_name: str) -> str:
    """Generate a SAS URL with extended expiry for video streaming.

    Videos need longer-lived tokens so the player can seek and buffer
    without the token expiring mid-stream.
    Uses ``settings.AZURE_VIDEO_SAS_EXPIRY_MINUTES`` (default 4 hours).
    """
    return generate_sas_url(blob_name, expiry_minutes=settings.AZURE_VIDEO_SAS_EXPIRY_MINUTES)
