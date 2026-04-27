"""
LLM service: fast model for in-call customer roleplay; stronger model for strict KPI analysis.
"""
import json
import logging
import re
from openai import AsyncOpenAI
from app.config import get_settings
from app.services.ai_prompts import (
    get_ai_customer_followup_prompt,
    get_ai_customer_opening_prompt,
    get_ai_customer_prompt,
    get_greeting_instruction,
    KPI_ANALYSIS_SYSTEM_PROMPT,
)

settings = get_settings()
logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


async def get_customer_response(
    emotion: str,
    gender: str,
    accent: str,
    scenario: str,
    advisor_name: str,
    conversation_history: list[dict],
) -> str:
    if not client:
        logger.error("OpenAI client not initialized — check OPENAI_API_KEY")
        return "Hello, I'm calling about my car."
    is_opening = len(conversation_history) == 0
    if is_opening:
        # Compact system prompt only for turn 0 — much fewer input tokens → faster first reply + TTS.
        system = get_ai_customer_opening_prompt(emotion, gender, accent, scenario, advisor_name=advisor_name)
        greeting_hint = get_greeting_instruction(scenario)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Opening line: {greeting_hint}"},
        ]
    else:
        system = get_ai_customer_followup_prompt(emotion, gender, accent, scenario)
        messages = [{"role": "system", "content": system}]
        hist = conversation_history
        anchor = hist[:2]
        recent = hist[-6:]
        if len(hist) > 8:
            for m in anchor:
                messages.append({"role": m["role"], "content": m["content"][:100]})
            for m in recent:
                messages.append({"role": m["role"], "content": m["content"][:120]})
        else:
            for m in hist:
                messages.append({"role": m["role"], "content": m["content"][:120]})

    model = settings.openai_customer_model or "gpt-4o-mini"
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=48 if is_opening else 36,
            temperature=0.72 if is_opening else 0.65,
        )
        text = (resp.choices[0].message.content or "").strip()
        logger.info("AI customer (%s %s): %s", model, scenario, text[:80])
        return text[:150]
    except Exception as e:
        logger.error("OpenAI API error: %s", e)
        return "Sorry, I'm having trouble hearing you. Can you repeat that?"


async def analyze_call_kpis(transcript_text: str) -> dict:
    if not client:
        return _default_kpis()
    user_content = f"Transcript:\n{transcript_text}"
    if len(transcript_text.strip()) < 180:
        user_content += (
            "\n\n[Evaluator note: Transcript is very short. Cap each dimension at 6 and "
            "overall_score at 55 unless there is clear evidence of stronger advisor performance.]"
        )
    kpi_model = settings.openai_kpi_model or "gpt-4o"
    try:
        resp = await client.chat.completions.create(
            model=kpi_model,
            messages=[
                {"role": "system", "content": KPI_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1200,
            temperature=0.12,
        )
        raw = (resp.choices[0].message.content or "").strip()
        json_str = raw
        if "```json" in raw:
            m = re.search(r"```json\s*([\s\S]*?)\s*```", raw)
            json_str = m.group(1).strip() if m else raw
        elif "```" in raw:
            m = re.search(r"```\s*([\s\S]*?)\s*```", raw)
            json_str = m.group(1).strip() if m else raw
        data = json.loads(json_str)
    except json.JSONDecodeError:
        logger.error("KPI analysis returned invalid JSON")
        return _default_kpis()
    except Exception as e:
        logger.error("KPI analysis error: %s", e)
        return _default_kpis()

    return {
        "summary": _get_str(data, "summary"),
        "strengths": _get_list_str(data, "strengths"),
        "weaknesses": _get_list_str(data, "weaknesses"),
        "improvement_tips": _get_list_str(data, "improvement_tips"),
        "confidence": _clamp_dim(data.get("confidence"), 4.5),
        "clarity": _clamp_dim(data.get("clarity"), 4.5),
        "objection_handling": _clamp_dim(data.get("objection_handling"), 4.5),
        "empathy": _clamp_dim(data.get("empathy"), 4.5),
        "product_knowledge": _clamp_dim(data.get("product_knowledge"), 4.5),
        "closing_attempt": _get_bool(data, "closing_attempt", False),
        "overall_score": _clamp_overall(data.get("overall_score"), 45.0),
    }


def _get_str(d: dict, key: str) -> str:
    v = d.get(key)
    return str(v) if v is not None else ""


def _get_list_str(d: dict, key: str) -> list[str]:
    v = d.get(key)
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str):
        return [v]
    return []


def _clamp_dim(v, default: float = 5.0) -> float:
    try:
        x = float(v)
        return max(0.0, min(10.0, x))
    except (TypeError, ValueError):
        return default


def _clamp_overall(v, default: float = 50.0) -> float:
    try:
        x = float(v)
        return max(0.0, min(100.0, x))
    except (TypeError, ValueError):
        return default


def _get_bool(d: dict, key: str, default: bool) -> bool:
    v = d.get(key)
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("true", "yes", "1")
    return bool(v)


def _default_kpis() -> dict:
    return {
        "summary": "Automatic scoring failed. Review the transcript manually.",
        "strengths": [],
        "weaknesses": ["Scoring service did not return usable results"],
        "improvement_tips": ["Retry after the call or contact support if this persists"],
        "confidence": 4.0,
        "clarity": 4.0,
        "objection_handling": 4.0,
        "empathy": 4.0,
        "product_knowledge": 4.0,
        "closing_attempt": False,
        "overall_score": 40.0,
    }
