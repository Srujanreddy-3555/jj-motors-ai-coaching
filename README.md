# JJ Motors AI Sales Coaching Platform

Production-ready MVP for AI-powered **phone-based** sales practice.

**→ [Run locally & get the UI ready](RUN_LOCALLY.md)** – backend + frontend in a few steps. Advisors call an AI phone number to practice sales conversations. The system records the call, transcribes with speaker labels, analyzes performance, and displays KPIs and feedback in a dashboard.

## Architecture Overview

- **Frontend**: Next.js (React), Tailwind CSS, JJ Motors theme (black, yellow, white)
- **Backend**: Python, FastAPI, async-first
- **Voice**: Twilio Programmable Voice (phone calls, recording, Media Streams for real-time AI)
- **AI**: GPT-4o (customer behavior + KPI analysis), Whisper (STT), ElevenLabs (TTS)
- **Storage**: PostgreSQL (users, calls, scores), AWS S3 (recordings), Redis (sessions)

## User Flow

1. Advisor logs into web dashboard  
2. Selects: customer emotion, accent, scenario  
3. System returns a practice phone number and 6-digit session code  
4. Advisor calls the number and enters the code  
5. AI answers and conducts a realistic sales conversation (streaming)  
6. Call is recorded (Twilio)  
7. After call: audio transcribed with speaker separation, AI generates summary, KPIs, feedback  
8. Advisor reviews everything in the dashboard (Call History, Call Detail)

## Project Structure

```
JJ'S Bot/
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── api/             # Auth, users, practice, calls, webhooks
│   │   ├── core/            # Security (JWT, password)
│   │   ├── db/              # SQLAlchemy async, session
│   │   ├── models/          # User, PracticeSession, Call, Transcript, KPI
│   │   ├── schemas/         # Pydantic request/response
│   │   └── services/        # AI prompts, STT, TTS, LLM, recording, transcription, TwiML
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # Next.js app
│   ├── app/                 # Pages: login, signup, home (practice), calls, calls/[id]
│   ├── components/         # Layout, StartPractice
│   ├── lib/                # api client, auth store
│   └── package.json
└── README.md
```

## Backend Setup

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- Twilio account (phone number, Voice webhook URL must be public)
- OpenAI API key
- ElevenLabs API key and voice IDs
- AWS account (S3 bucket for recordings)

### Steps

1. **Create virtualenv and install dependencies**

   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```

2. **Configure environment**

   ```bash
   copy .env.example .env
   # Edit .env with your keys and URLs
   ```

3. **Create database and run migrations (or create tables)**

   ```bash
   # Create DB: createdb jjmotors (or via pgAdmin)
   # Tables are created on first run via init_db if you add it to startup, or:
   python -c "
   import asyncio
   from app.db.session import init_db
   asyncio.run(init_db())
   "
   ```

4. **Run the server**

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Twilio configuration**

   - In Twilio Console: set your number’s **Voice webhook** to:  
     `https://YOUR_PUBLIC_URL/api/webhooks/voice/incoming`  
     (Method: POST)
   - Ensure `TWILIO_WEBHOOK_BASE_URL` in `.env` is that same public base (e.g. ngrok URL) so TwiML points to your server and WebSocket (wss) works.

## Frontend Setup

1. **Install and run**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. **Environment**

   Create `frontend/.env.local`:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   For production, set `NEXT_PUBLIC_API_URL` to your backend URL.

## Key Endpoints

| Purpose              | Method | Path |
|----------------------|--------|------|
| Signup               | POST   | /api/auth/signup |
| Login                | POST   | /api/auth/login |
| Me                   | GET    | /api/auth/me |
| Practice options     | GET    | /api/practice/options |
| Create practice      | POST   | /api/practice/session |
| List calls           | GET    | /api/calls |
| Call detail          | GET    | /api/calls/{id} |
| Twilio incoming      | POST   | /api/webhooks/voice/incoming |
| Twilio gather        | POST   | /api/webhooks/voice/gather |
| Twilio recording     | POST   | /api/webhooks/recording/ready |
| Twilio status        | POST   | /api/webhooks/voice/status |
| Media Stream (WS)    | WS     | /api/webhooks/stream?session_id=... |

## AI Customer Behavior

- Never says it is an AI  
- Behaves like a real customer; reacts emotionally to advisor tone  
- Can interrupt; asks realistic questions; pushes back on price when “Angry”  
- Short, natural replies; emotional state and accent/scenario driven by practice config  

## KPIs Produced After Each Call

- Confidence, Clarity, Objection handling, Empathy, Product knowledge (0–10)  
- Closing attempt (Yes/No)  
- Overall score (0–100)  
- Summary, strengths, weaknesses, improvement tips  

## Demo Notes for JJ Motors Executives

- Use **one Twilio number**; advisors get a **6-digit session code** when they start a practice. They call the number and enter the code to join the AI conversation.
- Ensure the backend is reachable from the internet (e.g. ngrok) so Twilio can hit the voice and recording webhooks and the Media Stream WebSocket.
- Frontend runs on port 3000; backend on 8000. Set CORS and `NEXT_PUBLIC_API_URL` accordingly.
- For real-time TTS in the stream, the backend uses **pydub** to convert ElevenLabs mp3 to 8kHz mulaw; install **ffmpeg** on the server for pydub to decode mp3.

## License

Proprietary – JJ Motors.
