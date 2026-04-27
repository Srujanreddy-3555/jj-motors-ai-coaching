"""
Application configuration via environment variables.
All secrets and URLs should be set in .env (never committed).
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Central config for JJ Motors backend."""

    # App
    app_name: str = "JJ Motors Sales Coaching"
    debug: bool = False
    frontend_origins: str = ""

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/jjmotors"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""  # The number advisors call
    twilio_webhook_base_url: str = "https://your-ngrok-or-domain.com"  # For webhooks

    # OpenAI (Whisper + chat + speech). Customer dialogue uses a fast model; KPI scoring uses a stronger model.
    openai_api_key: str = ""
    openai_customer_model: str = "gpt-4o-mini"
    openai_kpi_model: str = "gpt-4o"

    # ElevenLabs TTS
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id_male: str = ""  # Voice ID for male customer
    elevenlabs_voice_id_female: str = ""  # Voice ID for female customer

    # AWS S3 (recordings)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "jjmotors-recordings"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
