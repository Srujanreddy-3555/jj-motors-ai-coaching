"""
Post-call lifecycle: when call ends or recording is ready, fetch recording,
transcribe with speaker labels, run KPI analysis, save to DB.
"""
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.call import Call, CallTranscriptLine
from app.services.recording import fetch_recording_bytes, upload_to_s3, get_recording_url
from app.services.transcription import transcribe_with_speakers, format_transcript_for_kpi
from app.services.llm import analyze_call_kpis

settings = get_settings()


def _conversation_to_kpi_text(messages: list[dict]) -> str:
    parts: list[str] = []
    for m in messages:
        role = m.get("role")
        text = (m.get("content") or "").strip()
        if not text:
            continue
        label = "CUSTOMER" if role == "assistant" else "ADVISOR"
        parts.append(f"{label}: {text}")
    return "\n".join(parts)


async def finalize_browser_practice_call(call_id: str, messages: list[dict]) -> None:
    """
    Persist transcript + KPI analysis for in-browser practice (no Twilio recording).
    Safe to call on disconnect; skips if call already completed.
    """
    transcript_text = _conversation_to_kpi_text(messages)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Call).where(Call.id == call_id))
        call = result.scalar_one_or_none()
        if not call or call.status == "completed":
            return

    kpis: dict = {}
    if transcript_text.strip():
        kpis = await analyze_call_kpis(transcript_text)

    ended = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Call).where(Call.id == call_id))
        call = result.scalar_one_or_none()
        if not call or call.status == "completed":
            return

        if kpis:
            call.summary = kpis.get("summary")
            call.strengths = "\n".join(kpis.get("strengths", []))
            call.weaknesses = "\n".join(kpis.get("weaknesses", []))
            call.improvement_tips = "\n".join(kpis.get("improvement_tips", []))
            call.confidence = kpis.get("confidence")
            call.clarity = kpis.get("clarity")
            call.objection_handling = kpis.get("objection_handling")
            call.empathy = kpis.get("empathy")
            call.product_knowledge = kpis.get("product_knowledge")
            call.closing_attempt = kpis.get("closing_attempt")
            call.overall_score = kpis.get("overall_score")

        call.status = "completed"
        call.completed_at = ended
        if call.created_at:
            call.duration_seconds = int((ended - call.created_at).total_seconds())

        seq = 0
        for m in messages:
            role = m.get("role")
            text = (m.get("content") or "").strip()
            if not text:
                continue
            seq += 1
            speaker = "customer" if role == "assistant" else "advisor"
            db.add(
                CallTranscriptLine(
                    call_id=call_id,
                    speaker=speaker,
                    text=text,
                    sequence=seq,
                )
            )
        await db.commit()


async def on_call_completed(call_id: str, call_sid: str) -> None:
    """Mark call completed. Optionally fetch recording from Twilio if we have it."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Call).where(Call.id == call_id))
        call = result.scalar_one_or_none()
        if not call:
            return
        call.status = "completed"
        call.completed_at = datetime.utcnow()
        await db.commit()
    # Try to get recording URL from Twilio (if we started recording via API)
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        recordings = client.recordings.list(call_sid=call_sid, limit=1)
        if recordings:
            rec = recordings[0]
            # Twilio recording URL needs .json for API
            rec_uri = rec.uri.replace(".json", "")
            recording_url = f"https://api.twilio.com{rec_uri}"
            await on_recording_ready(call_id, recording_url + ".mp3")
    except Exception:
        pass


async def on_recording_ready(call_id: str, recording_url: str) -> None:
    """Fetch recording, transcribe, run KPI, save transcript and scores."""
    auth = (settings.twilio_account_sid, settings.twilio_auth_token)
    try:
        audio_bytes = await fetch_recording_bytes(recording_url, auth)
    except Exception:
        return
    if not audio_bytes:
        return
    # Upload to S3
    s3_key = f"recordings/{call_id}.mp3"
    upload_to_s3(audio_bytes, s3_key)
    # Transcribe with speaker labels
    lines = await transcribe_with_speakers(audio_bytes)
    transcript_text = format_transcript_for_kpi(lines)
    # KPI analysis
    kpis = await analyze_call_kpis(transcript_text)
    # Persist
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Call).where(Call.id == call_id))
        call = result.scalar_one_or_none()
        if not call:
            return
        call.recording_url = get_recording_url(s3_key)
        call.recording_s3_key = s3_key
        call.summary = kpis.get("summary")
        call.strengths = "\n".join(kpis.get("strengths", []))
        call.weaknesses = "\n".join(kpis.get("weaknesses", []))
        call.improvement_tips = "\n".join(kpis.get("improvement_tips", []))
        call.confidence = kpis.get("confidence")
        call.clarity = kpis.get("clarity")
        call.objection_handling = kpis.get("objection_handling")
        call.empathy = kpis.get("empathy")
        call.product_knowledge = kpis.get("product_knowledge")
        call.closing_attempt = kpis.get("closing_attempt")
        call.overall_score = kpis.get("overall_score")
        call.status = "completed"
        if not call.completed_at:
            call.completed_at = datetime.utcnow()
        # Transcript lines
        for seq, line in enumerate(lines, 1):
            tl = CallTranscriptLine(
                call_id=call_id,
                speaker=line.get("speaker", "advisor"),
                text=line.get("text", ""),
                sequence=seq,
            )
            db.add(tl)
        await db.commit()
