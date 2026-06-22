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


def list_blob_directories(prefix: str = "") -> list[str]:
    """List virtual directories (prefixes) in the blob container.

    Uses a trailing ``/`` as the delimiter so only virtual directories at the
    given prefix level are returned.

    Returns a sorted list of directory paths (e.g. ``["videos/", "face_scans/"]``).
    """
    client = get_blob_service_client()
    if not client:
        return []
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    result = container.list_blobs(name_starts_with=prefix, delimiter="/")
    dirs = []
    for page in result.by_page():
        dirs.extend(page.prefixes or [])
    return sorted(dirs)


def list_blob_subdirectories(parent_path: str) -> list[str]:
    """List virtual subdirectories directly under *parent_path*.

    ``parent_path`` should already end with ``/`` (e.g. ``"videos/"``).
    Returns paths like ``["videos/yoga/", "videos/meditation/"]``.
    """
    return list_blob_directories(prefix=parent_path)


def create_blob_directory(path: str) -> bool:
    """Create a virtual directory in the blob container.

    Azure Blob Storage uses zero-length blobs with a trailing ``/`` to
    simulate directories. If the directory already exists this is a no-op.

    Returns ``True`` on success, ``False`` if Azure is not configured.
    """
    client = get_blob_service_client()
    if not client:
        return False
    path = path if path.endswith("/") else path + "/"
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    container.upload_blob(name=path, data=b"", overwrite=True)
    return True


def upload_blob_file(file_data: bytes, blob_path: str, content_type: str = "video/mp4") -> str:
    """Upload raw bytes to Azure Blob Storage.

    Args:
        file_data: The raw bytes of the file.
        blob_path: The destination path in the container (e.g. ``videos/yoga/class.mp4``).
        content_type: MIME type of the file.

    Returns:
        The ``blob_path`` on success, empty string on failure.
    """
    client = get_blob_service_client()
    if not client:
        return ""
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    container.upload_blob(
        name=blob_path,
        data=file_data,
        content_settings=ContentSettings(content_type=content_type),
        overwrite=True,
    )
    return blob_path
