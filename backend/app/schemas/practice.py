from datetime import datetime
from pydantic import BaseModel


class PracticeConfig(BaseModel):
    """Options for practice call (emotion, gender, accent, scenario)."""
    emotion: str  # Happy, Neutral, Angry
    gender: str   # Male, Female
    accent: str   # US English, African English
    scenario: str # Vehicle service inquiry, Price negotiation, etc.


class PracticeSessionCreate(BaseModel):
    emotion: str
    gender: str
    accent: str
    scenario: str


class PracticeSessionResponse(BaseModel):
    id: str
    phone_number: str
    short_code: str  # 6-digit code to enter when calling (not used for outbound)
    emotion: str
    gender: str
    accent: str
    scenario: str
    expires_at: datetime
    status: str | None = None  # "calling" when we are calling the advisor (outbound)

    class Config:
        from_attributes = True
