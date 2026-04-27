from sqlalchemy import String, ForeignKey, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from uuid import uuid4

from app.db.base import Base


class PracticeSession(Base):
    """
    One-time practice configuration. Advisor selects options, gets a unique
    phone number (we use one Twilio number + session ID in state).
    """
    __tablename__ = "practice_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    emotion: Mapped[str] = mapped_column(String(50), nullable=False)  # Happy, Neutral, Angry
    gender: Mapped[str] = mapped_column(String(20), nullable=False)   # Male, Female
    accent: Mapped[str] = mapped_column(String(50), nullable=False)  # US English, African English
    scenario: Mapped[str] = mapped_column(String(100), nullable=False)  # New vehicle, Price negotiation, etc.
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)  # Number to display (same Twilio number)
    short_code: Mapped[str] = mapped_column(String(6), unique=True, nullable=False)  # 6-digit code caller enters
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    call_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calls.id"), nullable=True)  # Set when call completes

    user: Mapped["User"] = relationship("User", back_populates="practice_sessions")
    call: Mapped["Call | None"] = relationship("Call", back_populates="practice_session", foreign_keys=[call_id])
