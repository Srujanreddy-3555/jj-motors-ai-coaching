"""
Speech-to-Text via OpenAI Whisper API.
Accepts audio bytes (e.g. from Twilio: 8kHz mulaw) or file path.
Whisper supports various formats; we convert mulaw to wav if needed.
"""
import io
import struct
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


def _mulaw_to_linear(mulaw_bytes: bytes) -> bytes:
    """Convert 8kHz mulaw to 16-bit linear PCM (16kHz not required for Whisper)."""
    MULAW_MAX = 0x1FFF
    mulaw_exp_table = [
        -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
        -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
        -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
        -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
        -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
        -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
        -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
        -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
        -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
        -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
        -876, -844, -812, -780, -748, -716, -684, -652,
        -620, -588, -556, -524, -492, -460, -428, -396,
        -372, -356, -340, -324, -308, -292, -276, -260,
        -244, -228, -212, -196, -180, -164, -148, -132,
        -120, -112, -104, -96, -88, -80, -72, -64,
        -56, -48, -40, -32, -24, -16, -8, 0,
        32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
        23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
        15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
        11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
        7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
        5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
        3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
        2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
        1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
        1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
        876, 844, 812, 780, 748, 716, 684, 652,
        620, 588, 556, 524, 492, 460, 428, 396,
        372, 356, 340, 324, 308, 292, 276, 260,
        244, 228, 212, 196, 180, 164, 148, 132,
        120, 112, 104, 96, 88, 80, 72, 64,
        56, 48, 40, 32, 24, 16, 8, 0,
    ]
    linear = []
    for b in mulaw_bytes:
        linear.append(mulaw_exp_table[b])
    buf = io.BytesIO()
    for s in linear:
        buf.write(struct.pack("<h", s))
    return buf.getvalue()


def _make_wav_header(pcm_bytes: bytes, sample_rate: int = 8000) -> bytes:
    """Prepend WAV header to raw 16-bit mono PCM."""
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm_bytes)
    return buf.getvalue()


async def transcribe_audio(audio_bytes: bytes, is_mulaw_8k: bool = True) -> str:
    """
    Transcribe audio using Whisper.
    If is_mulaw_8k True, convert mulaw to wav first.
    """
    if not client:
        return "[Transcription unavailable - no API key]"
    if is_mulaw_8k and audio_bytes:
        linear = _mulaw_to_linear(audio_bytes)
        wav_bytes = _make_wav_header(linear, 8000)
    else:
        wav_bytes = audio_bytes
    file = io.BytesIO(wav_bytes)
    file.name = "audio.wav"
    resp = await client.audio.transcriptions.create(model="whisper-1", file=file)
    return (resp.text or "").strip()


async def transcribe_file(file_path: str) -> str:
    """Transcribe a file (e.g. downloaded recording)."""
    if not client:
        return ""
    with open(file_path, "rb") as f:
        resp = await client.audio.transcriptions.create(model="whisper-1", file=f)
    return (resp.text or "").strip()


async def transcribe_bytes(
    audio_bytes: bytes,
    filename: str = "audio.mp3",
    language: str | None = "en",
) -> str:
    """Transcribe raw bytes (e.g. webm from browser). No mulaw conversion."""
    if not client or not audio_bytes:
        return ""
    file = io.BytesIO(audio_bytes)
    file.name = filename
    kwargs: dict = {"model": "whisper-1", "file": file}
    if language:
        kwargs["language"] = language
    kwargs["prompt"] = "Auto service center phone call."
    resp = await client.audio.transcriptions.create(**kwargs)
    return (resp.text or "").strip()
