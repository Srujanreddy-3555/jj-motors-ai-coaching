"""
Transcription with speaker labels. Uses Whisper for raw transcript;
optionally uses LLM to split into advisor/customer lines if we have a single transcript.
"""
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.services.stt import transcribe_bytes

settings = get_settings()
_openai: AsyncOpenAI | None = None


def _openai_client() -> AsyncOpenAI | None:
    global _openai
    if _openai is None and settings.openai_api_key:
        _openai = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai


async def transcribe_with_speakers(audio_bytes: bytes) -> list[dict]:
    """
    Transcribe audio and return list of {"speaker": "advisor"|"customer", "text": "..."}.
    For a single mono recording we get one transcript and then ask GPT to split into two speakers.
    """
    # If we had true diarization we'd get segments per speaker. Here we use Whisper then label.
    text = await transcribe_bytes(audio_bytes, filename="audio.mp3", language=None)
    if not text:
        return []
    # Try to get timestamped segments from Whisper for better splitting
    client = _openai_client()
    if not client:
        return [{"speaker": "advisor", "text": text}]
    # Ask GPT to split transcript into advisor/customer lines (alternating)
    prompt = """The following is a transcript of a phone call between a sales advisor and a customer at a car dealership.
Split it into alternating lines and label each line as either "advisor" or "customer".
Return a JSON array of objects: [{"speaker": "advisor", "text": "..."}, ...]
Keep the text exactly as spoken; only assign the speaker. If in doubt, alternate starting with advisor."""
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": f"{prompt}\n\nTranscript:\n{text}"},
            ],
            max_tokens=2000,
            temperature=0,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if "```" in raw:
            import re
            m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
            raw = m.group(1).strip() if m else raw
        arr = json.loads(raw)
        out = []
        for o in arr:
            sp = (o.get("speaker") or "advisor").lower()
            if "customer" in sp:
                sp = "customer"
            else:
                sp = "advisor"
            out.append({"speaker": sp, "text": str(o.get("text", ""))})
        return out
    except Exception:
        return [{"speaker": "advisor", "text": text}]


def format_transcript_for_kpi(lines: list[dict]) -> str:
    """Format transcript lines for KPI analysis prompt."""
    return "\n".join(f'{row["speaker"]}: {row["text"]}' for row in lines)
