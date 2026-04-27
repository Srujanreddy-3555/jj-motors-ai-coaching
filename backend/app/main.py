"""
JJ Motors AI Sales Coaching - FastAPI application entry point.
"""
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import auth, users, practice, calls, webhooks

settings = get_settings()


def _cors_origins() -> list[str]:
    # Local dev defaults
    origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]
    # Production URLs can be passed as comma-separated list in FRONTEND_ORIGINS
    extra = [o.strip() for o in (settings.frontend_origins or "").split(",") if o.strip()]
    for origin in extra:
        if origin not in origins:
            origins.append(origin)
    return origins

app = FastAPI(
    title=settings.app_name,
    description="AI-powered phone-based sales coaching for JJ Motors",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(practice.router, prefix="/api/practice", tags=["Practice"])
app.include_router(calls.router, prefix="/api/calls", tags=["Calls"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])


@app.on_event("startup")
async def startup():
    import logging
    from app.models import User, PracticeSession, Call, CallTranscriptLine, CallKPI  # noqa: F401 - register with Base.metadata
    from app.db.session import init_db
    try:
        await init_db()
    except Exception as e:
        logging.warning("Database init failed (tables may already exist or DB not ready): %s", e)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
