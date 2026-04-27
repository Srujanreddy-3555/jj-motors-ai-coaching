from sqlalchemy import String, ForeignKey, DateTime, Float, Boolean, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import uuid4

from app.db.base import Base


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    practice_session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("practice_sessions.id"), nullable=True)

    twilio_sid: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recording_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # AI analysis (filled after call ends)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array as string or newline-separated
    weaknesses: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvement_tips: Mapped[str | None] = mapped_column(Text, nullable=True)

    # KPIs
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    clarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    objection_handling: Mapped[float | None] = mapped_column(Float, nullable=True)
    empathy: Mapped[float | None] = mapped_column(Float, nullable=True)
    product_knowledge: Mapped[float | None] = mapped_column(Float, nullable=True)
    closing_attempt: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress, completed, failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="calls")
    practice_session: Mapped["PracticeSession | None"] = relationship(
        "PracticeSession", back_populates="call", foreign_keys="PracticeSession.call_id"
    )
    transcript_lines: Mapped[list["CallTranscriptLine"]] = relationship("CallTranscriptLine", back_populates="call")
    kpi_record: Mapped["CallKPI | None"] = relationship("CallKPI", back_populates="call", uselist=False)


class CallTranscriptLine(Base):
    __tablename__ = "call_transcript_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    call_id: Mapped[str] = mapped_column(String(36), ForeignKey("calls.id"), nullable=False)
    speaker: Mapped[str] = mapped_column(String(20), nullable=False)  # advisor, customer
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="transcript_lines")


class CallKPI(Base):
    """Optional normalized KPI table; we also store on Call for simplicity."""
    __tablename__ = "call_kpis"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    call_id: Mapped[str] = mapped_column(String(36), ForeignKey("calls.id"), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    clarity: Mapped[float] = mapped_column(Float, nullable=False)
    objection_handling: Mapped[float] = mapped_column(Float, nullable=False)
    empathy: Mapped[float] = mapped_column(Float, nullable=False)
    product_knowledge: Mapped[float] = mapped_column(Float, nullable=False)
    closing_attempt: Mapped[bool] = mapped_column(Boolean, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)

    call: Mapped["Call"] = relationship("Call", back_populates="kpi_record")
