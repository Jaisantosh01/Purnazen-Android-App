import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import (
    BlobPrefix,
    BlobServiceClient,
    BlobSasPermissions,
    ContentSettings,
    generate_blob_sas,
)

from app.core.config import settings

logger = logging.getLogger(__name__)


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


def generate_sas_url(
    blob_name: str,
    expiry_minutes: int | None = None,
    container: str | None = None,
) -> str:
    """Generate a read-only SAS URL for a blob.

    Falls back to returning blob_name unchanged when credentials are missing
    (dev/local mode) or when blob_name is already a full URL.

    Args:
        blob_name: The blob path within the container (e.g. ``face_scans/1/raw/abc.jpg``).
        expiry_minutes: Override the default expiry. Defaults to
            ``settings.AZURE_SAS_EXPIRY_MINUTES``.
        container: Override the container. Defaults to the video container —
            face scans pass the uploads container (see generate_scan_sas_url).
    """
    container_name = container or settings.AZURE_BLOB_CONTAINER_NAME
    if not all([
        settings.AZURE_STORAGE_ACCOUNT_NAME,
        settings.AZURE_STORAGE_ACCOUNT_KEY,
        container_name,
    ]):
        return blob_name

    # Already a full URL — nothing to do (e.g. external/legacy blob_name)
    if blob_name.startswith("http"):
        return blob_name

    minutes = expiry_minutes if expiry_minutes is not None else settings.AZURE_SAS_EXPIRY_MINUTES
    sas_token = generate_blob_sas(
        account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
        container_name=container_name,
        blob_name=blob_name,
        account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=minutes),
    )
    # URL-encode the blob path so names with spaces/unicode (e.g.
    # "Ankle_Pain/Ankle Pain.mp4") produce a valid, fetchable URL. The "/"
    # path separators are preserved (safe="/"); the SAS signature is computed
    # over the decoded blob name, so encoding only the URL path is correct.
    encoded_blob = quote(blob_name, safe="/")
    return (
        f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
        f"/{container_name}/{encoded_blob}?{sas_token}"
    )


def generate_scan_sas_url(blob_name: str, expiry_minutes: int | None = None) -> str:
    """SAS URL for a face-scan image, which lives in the uploads container
    (``settings.AZURE_SCANS_CONTAINER_NAME``) rather than the video container.
    """
    return generate_sas_url(
        blob_name,
        expiry_minutes=expiry_minutes,
        container=settings.AZURE_SCANS_CONTAINER_NAME,
    )


def generate_release_sas_url(blob_name: str, expiry_minutes: int | None = None) -> str:
    """Generate a short-lived read-only SAS URL for an APK in the PRIVATE
    releases container (``settings.AZURE_RELEASES_CONTAINER_NAME``).

    The container is never public; this is the only way the in-app updater can
    reach an APK, and the token expires within minutes. Returns ``blob_name``
    unchanged when Azure isn't configured (local/dev).
    """
    if not all([
        settings.AZURE_STORAGE_ACCOUNT_NAME,
        settings.AZURE_STORAGE_ACCOUNT_KEY,
        settings.AZURE_RELEASES_CONTAINER_NAME,
    ]):
        return blob_name

    if blob_name.startswith("http"):
        return blob_name

    minutes = (
        expiry_minutes
        if expiry_minutes is not None
        else settings.AZURE_RELEASE_SAS_EXPIRY_MINUTES
    )
    sas_token = generate_blob_sas(
        account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
        container_name=settings.AZURE_RELEASES_CONTAINER_NAME,
        blob_name=blob_name,
        account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=minutes),
    )
    encoded_blob = quote(blob_name, safe="/")
    return (
        f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
        f"/{settings.AZURE_RELEASES_CONTAINER_NAME}/{encoded_blob}?{sas_token}"
    )


def generate_video_sas_url(blob_name: str) -> str:
    """Generate a SAS URL with extended expiry for video streaming.

    Videos need longer-lived tokens so the player can seek and buffer
    without the token expiring mid-stream.
    Uses ``settings.AZURE_VIDEO_SAS_EXPIRY_MINUTES`` (default 4 hours).
    """
    return generate_sas_url(blob_name, expiry_minutes=settings.AZURE_VIDEO_SAS_EXPIRY_MINUTES)


def list_blob_children(prefix: str = "") -> tuple[list[str], list[dict]]:
    """List the virtual directories and files directly under *prefix*.

    Uses ``walk_blobs`` with a ``/`` delimiter so only the immediate children
    of the given prefix are returned (``list_blobs`` has no delimiter support).
    Zero-length ``.../`` marker blobs that simulate directories are excluded
    from the file list.

    Returns ``(directories, files)`` where directories are full paths like
    ``["videos/yoga/"]`` and files are dicts with ``name``, ``size`` and
    ``lastModified``.
    """
    client = get_blob_service_client()
    if not client:
        return [], []
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    dirs: list[str] = []
    files: list[dict] = []
    for item in container.walk_blobs(name_starts_with=prefix, delimiter="/"):
        if isinstance(item, BlobPrefix):
            dirs.append(item.name)
        elif item.name != prefix and not item.name.endswith("/"):
            files.append({
                "name": item.name,
                "size": item.size or 0,
                "lastModified": item.last_modified.isoformat() if item.last_modified else None,
                "videoUrl": generate_video_sas_url(item.name),
            })
    return sorted(dirs), sorted(files, key=lambda f: f["name"])


def list_all_blobs_with_sas(prefix: str = "") -> list[dict]:
    """Recursively list ALL blobs under the given prefix, with SAS URLs.

    Uses ``walk_blobs`` with a ``/`` delimiter to descend into subdirectories
    (same method ``list_blob_children`` uses for a single level). Returns a
    flat list of dicts with ``name``, ``size``, ``lastModified`` and
    ``videoUrl``, sorted by name.
    """
    client = get_blob_service_client()
    if not client:
        return []
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    blobs: list[dict] = []

    def _recurse(path: str) -> None:
        for item in container.walk_blobs(name_starts_with=path, delimiter="/"):
            if isinstance(item, BlobPrefix):
                _recurse(item.name)
            elif item.name != path and not item.name.endswith("/"):
                blobs.append({
                    "name": item.name,
                    "size": item.size or 0,
                    "lastModified": item.last_modified.isoformat() if item.last_modified else None,
                    "videoUrl": generate_video_sas_url(item.name),
                })

    _recurse(prefix)
    return sorted(blobs, key=lambda f: f["name"])


def list_blob_directories(prefix: str = "") -> list[str]:
    """List virtual directories (prefixes) in the blob container.

    Returns a sorted list of directory paths (e.g. ``["videos/", "yoga/"]``).
    """
    dirs, _ = list_blob_children(prefix)
    return dirs


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


def preserve_empty_directory(dir_path: str) -> None:
    """Re-create a folder's directory marker if moving/deleting its last file
    left it empty.

    Azure has no real folders — a "folder" only exists while some blob carries
    its prefix. Move or delete the last video out of ``Knee_Pain/`` and the
    folder silently vanishes from every listing. Dropping a zero-length ``.../``
    marker back keeps the (now empty) folder visible so admins can refill it.
    Root ("") needs no marker and is skipped.
    """
    if not dir_path:
        return
    dirs, files = list_blob_children(dir_path)
    if not dirs and not files:
        create_blob_directory(dir_path)


def blob_exists(blob_path: str) -> bool:
    """Check if a blob exists in the container."""
    import logging
    logger = logging.getLogger(__name__)
    client = get_blob_service_client()
    if not client:
        logger.warning("blob_exists: Azure Storage not configured")
        return False
    try:
        container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
        blob_client = container.get_blob_client(blob_path)
        blob_client.get_blob_properties()
        logger.info("blob_exists: found blob at '%s'", blob_path)
        return True
    except Exception as exc:
        logger.info("blob_exists: blob '%s' not found (%s)", blob_path, exc)
        return False


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


def delete_blob(blob_path: str) -> bool:
    """Delete a blob from the video container.

    Returns ``True`` when the blob was deleted (or was already gone), ``False``
    only when Azure isn't configured. A missing blob is treated as success so
    callers can keep the DB and storage in sync without special-casing it.
    """
    client = get_blob_service_client()
    if not client:
        logger.warning("delete_blob: Azure Storage not configured")
        return False
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    try:
        container.get_blob_client(blob_path).delete_blob()
        logger.info("delete_blob: deleted '%s'", blob_path)
    except ResourceNotFoundError:
        logger.info("delete_blob: '%s' already absent", blob_path)
    return True


def move_blob(src_path: str, dst_path: str, overwrite: bool = False) -> str | None:
    """Move a blob within the video container via a server-side copy + delete.

    The copy is issued with ``start_copy_from_url`` using a short-lived read SAS
    on the source, so the file bytes never round-trip through this process
    (important for large videos). The source is deleted only after the copy
    reports success.

    Returns the destination path on success, ``None`` when Azure isn't
    configured. Raises ``FileExistsError`` when ``dst_path`` already exists and
    ``overwrite`` is False, and ``RuntimeError`` if the copy doesn't complete.
    """
    if src_path == dst_path:
        return dst_path
    client = get_blob_service_client()
    if not client:
        logger.warning("move_blob: Azure Storage not configured")
        return None
    container = client.get_container_client(settings.AZURE_BLOB_CONTAINER_NAME)
    dst_client = container.get_blob_client(dst_path)

    if not overwrite:
        try:
            dst_client.get_blob_properties()
            raise FileExistsError(dst_path)
        except ResourceNotFoundError:
            pass

    src_url = generate_sas_url(src_path)
    dst_client.start_copy_from_url(src_url)

    status = "pending"
    for _ in range(120):  # up to ~60s for the copy to settle
        props = dst_client.get_blob_properties()
        status = (props.copy.status or "").lower()
        if status != "pending":
            break
        time.sleep(0.5)

    if status != "success":
        logger.error("move_blob: copy '%s' -> '%s' ended in status '%s'", src_path, dst_path, status)
        raise RuntimeError(f"Copy did not complete (status: {status or 'unknown'})")

    container.get_blob_client(src_path).delete_blob()
    logger.info("move_blob: moved '%s' -> '%s'", src_path, dst_path)
    return dst_path
