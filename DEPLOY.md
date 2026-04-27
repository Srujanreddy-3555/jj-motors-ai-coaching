# Deployment Checklist (Render + Vercel)

Use this as a quick production checklist before demo.

## 1) Backend (Render)

- Service type: Python Web Service
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Set environment variables:

- `SECRET_KEY` (strong random value)
- `DATABASE_URL` (Postgres async URL, `postgresql+asyncpg://...`)
- `REDIS_URL`
- `OPENAI_API_KEY`
- `OPENAI_CUSTOMER_MODEL` (optional, default `gpt-4o-mini`)
- `OPENAI_KPI_MODEL` (optional, default `gpt-4o`)
- `ELEVENLABS_API_KEY` (optional fallback)
- `ELEVENLABS_VOICE_ID_MALE` (optional)
- `ELEVENLABS_VOICE_ID_FEMALE` (optional)
- `FRONTEND_ORIGINS` (comma-separated frontend URLs)

Health check URL:

- `https://<backend-domain>/health`

## 2) Frontend (Vercel)

- Framework: Next.js
- Root directory: `frontend`

Set environment variable:

- `NEXT_PUBLIC_API_URL=https://<backend-domain>`

## 3) CORS / Connectivity Validation

- Confirm backend has `FRONTEND_ORIGINS` including your Vercel URL.
- Open browser devtools on frontend and verify:
  - `POST /api/auth/login` succeeds (no CORS preflight failure).
  - WebSocket connects to `/api/practice/browser-stream`.

## 4) Functional Smoke Test

- Login works.
- Start call works.
- AI speaks first after ringing.
- Mid-call response latency remains stable.
- Call ends and appears in Call History.
- Analytics / Coaching / Scoring pages load data.

## 5) Demo Reliability Notes

- Free backend tiers may sleep; warm `/health` 1-2 minutes before recording.
- Keep one test user account ready.
- Keep API quota/credits available for OpenAI/ElevenLabs.
