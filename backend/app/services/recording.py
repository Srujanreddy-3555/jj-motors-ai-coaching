"""
Call recording: fetch from Twilio, upload to S3, return public or signed URL.
"""
import io
import httpx
import boto3
from app.config import get_settings

settings = get_settings()
_s3 = None


def _s3_client():
    global _s3
    if _s3 is None and settings.aws_access_key_id and settings.aws_secret_access_key:
        _s3 = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
    return _s3


async def fetch_recording_bytes(recording_url: str, twilio_auth: tuple[str, str]) -> bytes:
    """Twilio recording URLs require HTTP Basic auth with AccountSid:AuthToken."""
    async with httpx.AsyncClient() as client:
        r = await client.get(recording_url, auth=twilio_auth, timeout=60.0)
        r.raise_for_status()
        return r.content


def upload_to_s3(data: bytes, key: str, content_type: str = "audio/mpeg") -> str:
    """Upload bytes to S3. Returns s3 key (URL can be generated via get_recording_url)."""
    client = _s3_client()
    if not client:
        return ""
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def get_recording_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for playback."""
    client = _s3_client()
    if not client or not s3_key:
        return ""
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=expires_in,
    )
