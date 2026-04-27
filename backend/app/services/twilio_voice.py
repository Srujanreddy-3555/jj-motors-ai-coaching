"""
Twilio TwiML helpers for voice: answer, gather digits, connect stream, record.
"""
from urllib.parse import quote


def twiml_gather_for_code(webhook_base: str, timeout: int = 5, num_digits: int = 6) -> str:
    """TwiML: say instruction and gather DTMF digits (session code)."""
    action = f"{webhook_base.rstrip('/')}/api/webhooks/voice/gather"
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Welcome to J J Motors sales practice. Please enter your 6 digit session code.</Say>
    <Gather action="{action}" method="POST" numDigits="{num_digits}" timeout="{timeout}" />
    <Say voice="alice">We didn't receive your code. Goodbye.</Say>
    <Hangup />
</Response>"""


def twiml_connect_stream(webhook_base: str, session_id: str, recording_callback: str | None = None) -> str:
    """TwiML: optionally start recording, then connect call to Media Stream (WebSocket)."""
    stream_url = f"{webhook_base.rstrip('/')}/api/webhooks/stream?session_id={quote(session_id)}"
    if stream_url.startswith("https://"):
        stream_url = "wss://" + stream_url[6:]
    elif stream_url.startswith("http://"):
        stream_url = "ws://" + stream_url[5:]
    recording_block = ""
    if recording_callback:
        recording_block = f"""    <Start>
        <Recording recordingStatusCallback="{recording_callback}" recordingStatusCallbackEvent="completed" />
    </Start>
"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
{recording_block}    <Say voice="alice">Connecting your practice call. Please wait.</Say>
    <Connect>
        <Stream url="{stream_url}" />
    </Connect>
    <Say voice="alice">The call has ended. Goodbye.</Say>
    <Hangup />
</Response>"""


def twiml_record_call(status_callback_url: str) -> str:
    """TwiML to record the call (use inside a flow that already has Connect)."""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Record action="{status_callback_url}" maxLength="3600" playBeep="false" />
</Response>"""


def twiml_reject() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Reject reason="busy" />
</Response>"""
