from datetime import datetime
from pydantic import BaseModel


class TranscriptLineResponse(BaseModel):
    speaker: str
    text: str
    sequence: int

    class Config:
        from_attributes = True


class KPIResponse(BaseModel):
    confidence: float
    clarity: float
    objection_handling: float
    empathy: float
    product_knowledge: float
    closing_attempt: bool
    overall_score: float


class CallResponse(BaseModel):
    id: str
    status: str
    duration_seconds: int | None
    overall_score: float | None
    created_at: datetime

    class Config:
        from_attributes = True


class CallDetailResponse(BaseModel):
    id: str
    status: str
    duration_seconds: int | None
    recording_url: str | None
    summary: str | None
    strengths: str | None
    weaknesses: str | None
    improvement_tips: str | None
    confidence: float | None
    clarity: float | None
    objection_handling: float | None
    empathy: float | None
    product_knowledge: float | None
    closing_attempt: bool | None
    overall_score: float | None
    transcript: list[TranscriptLineResponse]
    created_at: datetime
    completed_at: datetime | None

    class Config:
        from_attributes = True
