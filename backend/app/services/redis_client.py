"""
Shared Redis async client for Upstash (TLS) or local Redis.
"""
import ssl
import redis.asyncio as aioredis
from app.config import get_settings

settings = get_settings()


def get_redis() -> aioredis.Redis:
    url = settings.redis_url
    kwargs: dict = {
        "decode_responses": False,
    }
    if url.startswith("rediss://"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl"] = ssl_ctx
    return aioredis.from_url(url, **kwargs)
