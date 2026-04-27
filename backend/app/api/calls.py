from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.call import Call
from app.schemas.call import CallResponse, CallDetailResponse, TranscriptLineResponse

router = APIRouter()


@router.get("", response_model=list[CallResponse])
async def list_calls(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    result = await db.execute(
        select(Call).where(Call.user_id == user.id).order_by(Call.created_at.desc()).limit(limit)
    )
    calls = result.scalars().all()
    return list(calls)


@router.get("/analytics")
async def get_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate analytics for the logged-in advisor."""
    base = select(Call).where(Call.user_id == user.id, Call.status == "completed")

    # Total calls + average stats
    agg = await db.execute(
        select(
            func.count(Call.id).label("total_calls"),
            func.avg(Call.overall_score).label("avg_score"),
            func.avg(Call.confidence).label("avg_confidence"),
            func.avg(Call.clarity).label("avg_clarity"),
            func.avg(Call.objection_handling).label("avg_objection_handling"),
            func.avg(Call.empathy).label("avg_empathy"),
            func.avg(Call.product_knowledge).label("avg_product_knowledge"),
            func.avg(Call.duration_seconds).label("avg_duration"),
        ).where(Call.user_id == user.id, Call.status == "completed")
    )
    row = agg.one()
    total_calls = row.total_calls or 0
    avg_score = round(row.avg_score or 0, 1)
    avg_duration = round(row.avg_duration or 0)

    def _r(v: float | None) -> float:
        return round(v or 0, 1)

    kpi_averages = {
        "confidence": _r(row.avg_confidence),
        "clarity": _r(row.avg_clarity),
        "objection_handling": _r(row.avg_objection_handling),
        "empathy": _r(row.avg_empathy),
        "product_knowledge": _r(row.avg_product_knowledge),
    }

    # Per-call score history (last 30 calls, oldest first)
    history_q = await db.execute(
        base.order_by(Call.created_at.desc()).limit(30)
    )
    history_calls = list(history_q.scalars().all())
    history_calls.reverse()
    score_history = [
        {
            "id": c.id,
            "date": c.created_at.isoformat() if c.created_at else None,
            "overall_score": round(c.overall_score, 1) if c.overall_score is not None else None,
            "confidence": round(c.confidence, 1) if c.confidence is not None else None,
            "clarity": round(c.clarity, 1) if c.clarity is not None else None,
            "objection_handling": round(c.objection_handling, 1) if c.objection_handling is not None else None,
            "empathy": round(c.empathy, 1) if c.empathy is not None else None,
            "product_knowledge": round(c.product_knowledge, 1) if c.product_knowledge is not None else None,
        }
        for c in history_calls
        if c.overall_score is not None
    ]

    # Closing attempt rate
    scored_calls = [c for c in history_calls if c.closing_attempt is not None]
    closing_rate = (
        round(sum(1 for c in scored_calls if c.closing_attempt) / len(scored_calls) * 100)
        if scored_calls
        else 0
    )

    return {
        "total_calls": total_calls,
        "avg_score": avg_score,
        "avg_duration_seconds": avg_duration,
        "kpi_averages": kpi_averages,
        "closing_rate": closing_rate,
        "score_history": score_history,
    }


@router.get("/coaching")
async def get_coaching(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI coaching tips derived from the advisor's recent call performance."""
    result = await db.execute(
        select(Call)
        .where(Call.user_id == user.id, Call.status == "completed", Call.overall_score.isnot(None))
        .order_by(Call.created_at.desc())
        .limit(10)
    )
    recent = list(result.scalars().all())
    if not recent:
        return {"has_data": False, "tips": [], "focus_areas": [], "strongest": [], "weakest": [], "recent_scores": []}

    kpi_keys = ["confidence", "clarity", "objection_handling", "empathy", "product_knowledge"]
    kpi_sums: dict[str, list[float]] = {k: [] for k in kpi_keys}
    closing_count = 0
    for c in recent:
        for k in kpi_keys:
            v = getattr(c, k, None)
            if v is not None:
                kpi_sums[k].append(float(v))
        if c.closing_attempt:
            closing_count += 1

    kpi_avgs = {k: round(sum(vs) / len(vs), 1) if vs else 0 for k, vs in kpi_sums.items()}
    sorted_kpis = sorted(kpi_avgs.items(), key=lambda x: x[1])
    weakest = [{"kpi": k, "avg": v} for k, v in sorted_kpis[:2]]
    strongest = [{"kpi": k, "avg": v} for k, v in sorted_kpis[-2:]]

    label_map = {
        "confidence": "Confidence",
        "clarity": "Clarity",
        "objection_handling": "Objection Handling",
        "empathy": "Empathy",
        "product_knowledge": "Product Knowledge",
    }
    tip_map = {
        "confidence": "Practice opening with a strong, clear greeting. Avoid filler words like 'um' or 'uh'. State your name and intent upfront.",
        "clarity": "Explain pricing and timelines in simple terms. Avoid jargon. Summarize next steps at the end of each topic.",
        "objection_handling": "When the customer pushes back on price, acknowledge their concern first ('I totally understand'), then explain the value before offering alternatives.",
        "empathy": "Mirror the customer's emotion: if they're frustrated, say 'I can see why that's annoying.' Use their name. Ask how the issue is affecting them.",
        "product_knowledge": "Review common services and their typical price ranges before calls. If you don't know an answer, say 'Let me check on that for you' instead of guessing.",
    }

    tips = []
    for item in weakest:
        k = item["kpi"]
        tips.append({
            "kpi": label_map.get(k, k),
            "score": item["avg"],
            "tip": tip_map.get(k, "Keep practicing this area."),
        })

    if closing_count < len(recent) // 2:
        tips.append({
            "kpi": "Closing Attempt",
            "score": round(closing_count / len(recent) * 10, 1),
            "tip": "Try ending each call with a clear next step: 'Can I get you scheduled for Thursday morning?' Don't let the customer hang up without a commitment ask.",
        })

    focus_areas = [label_map.get(w["kpi"], w["kpi"]) for w in weakest]

    recent_scores = [
        {"id": c.id, "date": c.created_at.isoformat() if c.created_at else None, "score": round(c.overall_score, 1) if c.overall_score else None}
        for c in recent
    ]

    return {
        "has_data": True,
        "tips": tips,
        "focus_areas": focus_areas,
        "strongest": [{"kpi": label_map.get(s["kpi"], s["kpi"]), "avg": s["avg"]} for s in strongest],
        "weakest": [{"kpi": label_map.get(w["kpi"], w["kpi"]), "avg": w["avg"]} for w in weakest],
        "recent_scores": recent_scores,
    }


@router.get("/{call_id}", response_model=CallDetailResponse)
async def get_call(
    call_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Call).where(Call.id == call_id, Call.user_id == user.id).options(selectinload(Call.transcript_lines))
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(404, detail="Call not found")
    transcript = [TranscriptLineResponse(speaker=line.speaker, text=line.text, sequence=line.sequence) for line in sorted(call.transcript_lines, key=lambda x: x.sequence)]
    return CallDetailResponse(
        id=call.id,
        status=call.status,
        duration_seconds=call.duration_seconds,
        recording_url=call.recording_url,
        summary=call.summary,
        strengths=call.strengths,
        weaknesses=call.weaknesses,
        improvement_tips=call.improvement_tips,
        confidence=call.confidence,
        clarity=call.clarity,
        objection_handling=call.objection_handling,
        empathy=call.empathy,
        product_knowledge=call.product_knowledge,
        closing_attempt=call.closing_attempt,
        overall_score=call.overall_score,
        transcript=transcript,
        created_at=call.created_at,
        completed_at=call.completed_at,
    )
