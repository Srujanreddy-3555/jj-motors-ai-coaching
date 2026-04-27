"""
Text-to-Speech — OpenAI tts-1 primary (fastest for short lines), ElevenLabs fallback.
Returns audio bytes (mp3).
"""
import inspect
import logging
import httpx
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_openai_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI | None:
    global _openai_client
    if _openai_client is None and settings.openai_api_key:
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


async def _openai_tts(text: str, gender: str) -> bytes:
    """OpenAI tts-1 — very fast for short text, good expressiveness."""
    client = _get_openai_client()
    if not client:
        return b""
    try:
        voice = "nova" if gender and gender.lower() == "female" else "onyx"
        resp = await client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text[:4096],
            response_format="mp3",
            speed=1.05,
        )
        data: bytes | None = None
        read_fn = getattr(resp, "read", None)
        if callable(read_fn):
            data = await read_fn() if inspect.iscoroutinefunction(read_fn) else read_fn()
        if not isinstance(data, bytes) or not data:
            raw = getattr(resp, "content", None)
            data = raw if isinstance(raw, bytes) else None
        if isinstance(data, bytes) and data:
            return data
    except Exception as e:
        logger.warning("OpenAI TTS failed: %s", e)
    return b""


def _voice_ids_to_try(gender: str) -> list[str]:
    male = (settings.elevenlabs_voice_id_male or "").strip()
    female = (settings.elevenlabs_voice_id_female or "").strip()
    order = [female, male] if gender and gender.lower() == "female" else [male, female]
    seen: set[str] = set()
    return [vid for vid in order if vid and vid not in seen and not seen.add(vid)]  # type: ignore[func-returns-value]


async def _elevenlabs_tts(text: str, gender: str) -> bytes:
    """ElevenLabs fallback — richer voices but higher latency."""
    if not settings.elevenlabs_api_key:
        return b""
    voice_ids = _voice_ids_to_try(gender)
    if not voice_ids:
        return b""
    for voice_id in voice_ids:
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            headers = {"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"}
            payload = {
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {"stability": 0.42, "similarity_boost": 0.68, "style": 0.15, "use_speaker_boost": True},
            }
            async with httpx.AsyncClient() as http:
                r = await http.post(url, json=payload, headers=headers, timeout=15.0)
                if r.status_code == 200 and r.content:
                    return r.content
                logger.error("ElevenLabs TTS %s (voice %s…): %s", r.status_code, voice_id[:8], (r.text or "")[:120])
        except Exception as e:
            logger.error("ElevenLabs exception (voice %s…): %s", voice_id[:8], e)
    return b""


async def text_to_speech(text: str, gender: str = "Male") -> bytes:
    text = (text or "").strip()[:160]
    if not text:
        logger.warning("TTS skipped: empty text")
        return b""
    # OpenAI tts-1 first — much lower latency for short conversational lines
    audio = await _openai_tts(text, gender)
    if audio:
        return audio
    # ElevenLabs fallback
    audio = await _elevenlabs_tts(text, gender)
    if audio:
        logger.info("TTS used ElevenLabs fallback")
        return audio
    logger.warning("All TTS providers failed")
    return b""
