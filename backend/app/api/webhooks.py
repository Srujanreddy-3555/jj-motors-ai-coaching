"""
Twilio voice webhooks: incoming call -> gather digits -> connect stream.
Recording status callback for when call ends.
"""
import json
import base64
import uuid
from fastapi import APIRouter, Request, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.redis_client import get_redis
from app.db.session import AsyncSessionLocal
from app.models.practice_session import PracticeSession
from app.models.call import Call
from app.services.twilio_voice import twiml_gather_for_code, twiml_connect_stream

settings = get_settings()
router = APIRouter()


@router.get("/voice/outbound")
async def voice_outbound_answered(
    request: Request,
    session_id: str = Query(..., alias="session_id"),
    CallSid: str = Query(None),
):
    """
    When an outbound call to the advisor is answered: create Call and connect
    directly to AI stream (no digit entry). Twilio requests this URL when the
    advisor answers.
    """
    if not session_id:
        twiml = """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session missing. Goodbye.</Say><Hangup /></Response>"""
        return Response(content=twiml, media_type="application/xml")
    # Twilio may send CallSid as query param when requesting the URL
    call_sid = CallSid or (request.query_params.get("CallSid"))
    async with AsyncSessionLocal() as db:
        ps = await db.execute(select(PracticeSession).where(PracticeSession.id == session_id))
        practice_session = ps.scalar_one_or_none()
        if not practice_session:
            twiml = """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session not found. Goodbye.</Say><Hangup /></Response>"""
            return Response(content=twiml, media_type="application/xml")
        call = Call(
            user_id=practice_session.user_id,
            practice_session_id=practice_session.id,
            twilio_sid=call_sid or "",
            status="in_progress",
        )
        db.add(call)
        await db.flush()
        await db.commit()
        call_id = call.id
    try:
        redis = get_redis()
        if call_sid:
            await redis.setex(f"call_sid_to_call_id:{call_sid}", 3600, call_id)
        await redis.setex(f"stream_session:{session_id}", 3600, json.dumps({"call_id": call_id, "call_sid": call_sid or ""}))
        await redis.close()
    except Exception:
        pass
    base = settings.twilio_webhook_base_url.rstrip("/")
    rec_callback = f"{base}/api/webhooks/recording/ready"
    twiml = twiml_connect_stream(settings.twilio_webhook_base_url, session_id, recording_callback=rec_callback)
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/incoming")
async def voice_incoming(request: Request):
    """When someone calls our Twilio number: ask for 6-digit session code."""
    twiml = twiml_gather_for_code(settings.twilio_webhook_base_url)
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/gather")
async def voice_gather(
    request: Request,
    CallSid: str = Form(None),
    Digits: str = Form(None),
):
    """After user enters digits: look up session, create Call, connect to stream."""
    if not Digits or len(Digits) != 6:
        twiml = """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid code. Goodbye.</Say><Hangup /></Response>"""
        return Response(content=twiml, media_type="application/xml")
    try:
        redis = get_redis()
        session_id = await redis.get(f"practice_short_code:{Digits}")
        await redis.close()
    except Exception:
        session_id = None
    if not session_id:
        session_id = None
    else:
        session_id = session_id.decode() if isinstance(session_id, bytes) else session_id
    if not session_id:
        twiml = """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session not found or expired. Goodbye.</Say><Hangup /></Response>"""
        return Response(content=twiml, media_type="application/xml")
    async with AsyncSessionLocal() as db:
        ps = await db.execute(select(PracticeSession).where(PracticeSession.id == session_id))
        practice_session = ps.scalar_one_or_none()
        if not practice_session:
            twiml = """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session not found. Goodbye.</Say><Hangup /></Response>"""
            return Response(content=twiml, media_type="application/xml")
        call = Call(
            user_id=practice_session.user_id,
            practice_session_id=practice_session.id,
            twilio_sid=CallSid,
            status="in_progress",
        )
        db.add(call)
        await db.flush()
        await db.commit()
        call_id = call.id
    try:
        redis = get_redis()
        await redis.setex(f"call_sid_to_call_id:{CallSid}", 3600, call_id)
        await redis.setex(f"stream_session:{session_id}", 3600, json.dumps({"call_id": call_id, "call_sid": CallSid}))
        await redis.close()
    except Exception:
        pass
    base = settings.twilio_webhook_base_url.rstrip("/")
    rec_callback = f"{base}/api/webhooks/recording/ready"
    twiml = twiml_connect_stream(settings.twilio_webhook_base_url, session_id, recording_callback=rec_callback)
    return Response(content=twiml, media_type="application/xml")


@router.websocket("/stream")
async def stream_websocket(
    websocket: WebSocket,
    session_id: str = Query(...),
):
    """
    Twilio Media Stream: receives base64 mulaw audio, sends back AI response audio.
    We buffer inbound, run STT -> LLM -> TTS, then send outbound as base64 mulaw.
    """
    await websocket.accept()
    # Load session config from Redis
    config = None
    call_id = None
    try:
        redis = get_redis()
        raw = await redis.get(f"practice_session:{session_id}")
        if raw:
            config = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
        info = await redis.get(f"stream_session:{session_id}")
        if info:
            data = json.loads(info.decode() if isinstance(info, bytes) else info)
            call_id = data.get("call_id")
        await redis.close()
    except Exception:
        pass
    if not config:
        await websocket.close()
        return
    emotion = config.get("emotion", "Neutral")
    gender = config.get("gender", "Male")
    accent = config.get("accent", "US English")
    scenario = config.get("scenario", "Vehicle service inquiry")
    conversation = []
    inbound_buffer = bytearray()
    try:
        from app.services.llm import get_customer_response
        from app.services.stt import transcribe_audio
        from app.services.tts import text_to_speech
        # Send initial greeting from AI
        # Twilio flow: we may not have the advisor name here yet, so keep it empty.
        greeting = await get_customer_response(emotion, gender, accent, scenario, "", [])
        conversation.append({"role": "assistant", "content": greeting})
        tts_bytes = await text_to_speech(greeting, gender)
        if tts_bytes:
            try:
                from pydub import AudioSegment
                import io
                seg = AudioSegment.from_mp3(io.BytesIO(tts_bytes))
                seg = seg.set_frame_rate(8000).set_channels(1)
                pcm = seg.raw_data
                mulaw_bytes = _linear_to_mulaw(pcm)
                b64 = base64.b64encode(mulaw_bytes).decode()
                msg = json.dumps({"event": "media", "media": {"payload": b64}})
                await websocket.send_text(msg)
            except Exception:
                pass
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            event = msg.get("event")
            if event == "connected":
                continue
            if event == "start":
                continue
            if event == "stop":
                break
            if event == "media":
                media = msg.get("media", {})
                payload = media.get("payload")
                if payload:
                    inbound_buffer.extend(base64.b64decode(payload))
            # When we have enough audio (e.g. ~3 sec = 24000 bytes at 8k mulaw), process
            if len(inbound_buffer) >= 24000:
                chunk = bytes(inbound_buffer[:24000])
                inbound_buffer = inbound_buffer[24000:]
                text = await transcribe_audio(chunk, is_mulaw_8k=True)
                if text:
                    conversation.append({"role": "user", "content": text})
                    reply = await get_customer_response(emotion, gender, accent, scenario, "", conversation)
                    conversation.append({"role": "assistant", "content": reply})
                    tts_bytes = await text_to_speech(reply, gender)
                    if tts_bytes:
                        try:
                            from pydub import AudioSegment
                            import io
                            seg = AudioSegment.from_mp3(io.BytesIO(tts_bytes))
                            seg = seg.set_frame_rate(8000).set_channels(1)
                            pcm = seg.raw_data
                            mulaw_bytes = _linear_to_mulaw(pcm)
                            b64 = base64.b64encode(mulaw_bytes).decode()
                            await websocket.send_text(json.dumps({"event": "media", "media": {"payload": b64}}))
                        except Exception:
                            pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    await websocket.close()


def _linear_to_mulaw(pcm_16bit: bytes) -> bytes:
    """Convert 16-bit linear PCM to 8-bit mulaw."""
    MULAW_BIAS = 0x84
    out = []
    for i in range(0, len(pcm_16bit), 2):
        if i + 1 >= len(pcm_16bit):
            break
        sample = int.from_bytes(pcm_16bit[i : i + 2], "little", signed=True)
        sign = (sample >> 8) & 0x80
        if sign:
            sample = -sample
        sample += MULAW_BIAS
        if sample <= 0:
            sample = 0x01
        exponent = 7
        for exp in range(7, -1, -1):
            if sample > (0xFF << exp):
                exponent = exp
                break
        mantissa = (sample >> (exponent + 3)) & 0x0F
        mulaw_byte = ~(sign | (exponent << 4) | mantissa) & 0xFF
        out.append(mulaw_byte)
    return bytes(out)


@router.post("/voice/status")
async def voice_status(
    request: Request,
    CallSid: str = Form(None),
    CallStatus: str = Form(None),
):
    """Twilio status callback: when call ends (completed, failed, etc.). Trigger post-call processing."""
    if CallStatus not in ("completed", "failed", "busy", "no-answer") or not CallSid:
        return PlainTextResponse("OK")
    # Mark call completed and trigger async job to fetch recording, transcribe, run KPI
    try:
        redis = get_redis()
        call_id = await redis.get(f"call_sid_to_call_id:{CallSid}")
        await redis.close()
        if call_id:
            call_id = call_id.decode() if isinstance(call_id, bytes) else call_id
            from app.services.call_lifecycle import on_call_completed
            await on_call_completed(call_id, CallSid)
    except Exception:
        pass
    return PlainTextResponse("OK")


@router.post("/recording/ready")
async def recording_ready(
    request: Request,
    CallSid: str = Form(None),
    RecordingUrl: str = Form(None),
    RecordingSid: str = Form(None),
):
    """Twilio recording status callback when recording is ready. Alternative to status callback."""
    if not RecordingUrl or not CallSid:
        return PlainTextResponse("OK")
    try:
        redis = get_redis()
        call_id = await redis.get(f"call_sid_to_call_id:{CallSid}")
        await redis.close()
        if call_id:
            call_id = call_id.decode() if isinstance(call_id, bytes) else call_id
            from app.services.call_lifecycle import on_recording_ready
            await on_recording_ready(call_id, RecordingUrl)
    except Exception:
        pass
    return PlainTextResponse("OK")
