import asyncio
import base64
import json
import random
import string
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.config import get_settings
from app.services.redis_client import get_redis
from app.core.security import decode_token
from app.db.session import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.practice_session import PracticeSession
from app.models.call import Call
from app.schemas.practice import PracticeSessionCreate, PracticeSessionResponse

settings = get_settings()
router = APIRouter()
logger = logging.getLogger(__name__)

# Allowed options (match frontend)
EMOTIONS = ["Happy", "Neutral", "Angry"]
GENDERS = ["Male", "Female"]
ACCENTS = [
    "American English",
    "British English",
    "African English",
    "Australian English",
]
SCENARIOS = [
    "Vehicle service inquiry",
    "Repair estimate / quote",
    "Oil change & maintenance",
    "Parts availability & pricing",
    "Complaint or follow-up",
    "Price negotiation",
    "Warranty inquiry",
    "Pickup scheduling",
]


def _generate_short_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _advisor_speech_meaningful(text: str) -> bool:
    """Filter Whisper hallucinations / silence / noise so the AI customer does not churn replies."""
    t = (text or "").strip().lower()
    if len(t) < 5:
        return False
    noise = {
        "you",
        "thank you",
        "thanks",
        "uh",
        "um",
        "hmm",
        "mm",
        "yeah",
        "yep",
        "yup",
        "okay",
        "ok",
        "hi",
        "hello",
        "bye",
        "mhm",
        "uh-huh",
        "uh huh",
        ".",
        "…",
        "...",
    }
    stripped = t.rstrip(".!?… ")
    if t in noise or stripped in noise:
        return False
    return True


def _validate_options(emotion: str, gender: str, accent: str, scenario: str) -> None:
    if emotion not in EMOTIONS:
        raise HTTPException(400, detail=f"Invalid emotion. Choose from: {EMOTIONS}")
    if gender not in GENDERS:
        raise HTTPException(400, detail=f"Invalid gender. Choose from: {GENDERS}")
    if accent not in ACCENTS:
        raise HTTPException(400, detail=f"Invalid accent. Choose from: {ACCENTS}")
    if scenario not in SCENARIOS:
        raise HTTPException(400, detail=f"Invalid scenario. Choose from: {SCENARIOS}")


@router.post("/session", response_model=PracticeSessionResponse)
async def create_practice_session(
    body: PracticeSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_options(body.emotion, body.gender, body.accent, body.scenario)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    short_code = _generate_short_code()
    session = PracticeSession(
        user_id=user.id,
        emotion=body.emotion,
        gender=body.gender,
        accent=body.accent,
        scenario=body.scenario,
        phone_number=settings.twilio_phone_number,
        short_code=short_code,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    # Store session config in Redis for webhook (key: session_id -> config JSON)
    try:
        redis = get_redis()
        config = {
            "emotion": body.emotion,
            "gender": body.gender,
            "accent": body.accent,
            "scenario": body.scenario,
        }
        await redis.setex(
            f"practice_session:{session.id}",
            timedelta(minutes=35),
            json.dumps(config),
        )
        await redis.setex(
            f"practice_short_code:{short_code}",
            timedelta(minutes=35),
            session.id,
        )
        await redis.close()
    except Exception:
        pass  # Non-fatal; webhook can fall back to DB
    await db.refresh(session)
    return session


@router.get("/options")
async def get_practice_options():
    return {
        "emotions": EMOTIONS,
        "genders": GENDERS,
        "accents": ACCENTS,
        "scenarios": SCENARIOS,
    }


@router.websocket("/browser-stream")
async def browser_stream(
    websocket: WebSocket,
    session_id: str = Query(...),
    token: str = Query(None),
):
    """
    In-browser voice: advisor talks in the browser, AI responds. No phone.
    Query: session_id, token (Bearer JWT). Messages: { "audio": base64_wav } -> { "audio": base64_mp3 }.
    """
    await websocket.accept()
    if not token:
        await websocket.close(code=4001)
        return
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4001)
        return
    user_id = payload["sub"]
    practice_session: PracticeSession | None = None
    advisor_first_name = "Advisor"
    async with AsyncSessionLocal() as db:
        ps = await db.execute(select(PracticeSession).where(PracticeSession.id == session_id))
        practice_session = ps.scalar_one_or_none()
        if not practice_session or practice_session.user_id != user_id:
            await websocket.close(code=4003)
            return
        # Fetch advisor name to personalize the AI customer's opening line.
        try:
            u = await db.execute(select(User).where(User.id == user_id))
            advisor = u.scalar_one_or_none()
            if advisor and advisor.full_name:
                advisor_first_name = (advisor.full_name.split(" ")[0] or advisor.full_name).strip()
        except Exception:
            pass
        call = Call(
            user_id=user_id,
            practice_session_id=practice_session.id,
            twilio_sid=f"browser-{session_id}",
            status="in_progress",
        )
        db.add(call)
        await db.flush()
        await db.commit()
        call_id = call.id
    if not practice_session:
        await websocket.close(code=4004)
        return
    emotion = practice_session.emotion
    gender = practice_session.gender
    accent = practice_session.accent
    scenario = practice_session.scenario

    async def _redis_register_stream() -> None:
        """Register browser stream in Redis (runs in parallel with first LLM call)."""
        try:
            r = get_redis()
            await r.setex(
                f"stream_session:{session_id}",
                3600,
                json.dumps({"call_id": call_id, "call_sid": f"browser-{session_id}"}),
            )
            await r.close()
        except Exception:
            pass

    conversation: list[dict] = []  # trimmed window for LLM context
    full_transcript: list[dict] = []  # untouched for KPI scoring
    turn_lock = asyncio.Lock()
    try:
        from app.services.llm import get_customer_response
        from app.services.stt import transcribe_bytes
        from app.services.tts import text_to_speech

        _, greeting = await asyncio.gather(
            _redis_register_stream(),
            get_customer_response(emotion, gender, accent, scenario, advisor_first_name, []),
        )
        conversation.append({"role": "assistant", "content": greeting})
        full_transcript.append({"role": "assistant", "content": greeting})
        logger.info(
            "Browser stream GPT greeting len=%s chars preview=%s",
            len(greeting),
            (greeting[:100] + "…") if len(greeting) > 100 else greeting,
        )
        tts_bytes = await text_to_speech(greeting, gender)
        logger.info("Browser stream TTS greeting audio bytes=%s session=%s", len(tts_bytes), session_id)
        if tts_bytes:
            b64 = base64.b64encode(tts_bytes).decode()
            await websocket.send_text(json.dumps({"type": "audio", "data": b64}))
        else:
            logger.warning("TTS returned empty audio bytes for session %s", session_id)
            try:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "TTS failed (check ElevenLabs voice/plan and OPENAI_API_KEY for speech fallback in backend logs).",
                        }
                    )
                )
            except Exception:
                pass
            await websocket.close()
            return
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            if msg.get("type") == "audio" and msg.get("data"):
                async with turn_lock:
                    audio_b64 = msg["data"]
                    audio_bytes = base64.b64decode(audio_b64)
                    if len(audio_bytes) < 600:
                        continue
                    text = await transcribe_bytes(audio_bytes, "audio.webm")
                    if not text or not text.strip():
                        continue
                    if not _advisor_speech_meaningful(text):
                        logger.info("Browser stream ignored low-signal STT: %r", text[:120])
                        continue
                    conversation.append({"role": "user", "content": text[:120]})
                    reply = await get_customer_response(emotion, gender, accent, scenario, advisor_first_name, conversation)
                    conversation.append({"role": "assistant", "content": reply[:120]})
                    full_transcript.append({"role": "user", "content": text})
                    full_transcript.append({"role": "assistant", "content": reply})
                    if len(conversation) > 12:
                        conversation[:] = conversation[:2] + conversation[-8:]
                    tts_bytes = await text_to_speech(reply, gender)
                    if tts_bytes:
                        b64 = base64.b64encode(tts_bytes).decode()
                        await websocket.send_text(json.dumps({"type": "audio", "data": b64}))
                    else:
                        logger.warning("TTS returned empty audio bytes for session %s", session_id)
            if msg.get("type") == "end":
                break
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as e:
        logger.exception("Browser stream failed for session %s: %s", session_id, e)
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": "AI stream failed"}))
        except Exception:
            pass
    finally:
        try:
            from app.services.call_lifecycle import finalize_browser_practice_call

            await finalize_browser_practice_call(call_id, full_transcript)
        except Exception:
            logger.exception("Browser call finalize failed for call_id=%s", call_id)
        try:
            await websocket.close()
        except Exception:
            pass
