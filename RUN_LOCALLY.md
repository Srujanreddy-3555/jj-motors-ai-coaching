# Run JJ Motors Coaching Locally

Quick steps to run the app on your machine and get the UI ready.

## 1. Backend (FastAPI)

### Prerequisites

- **Python 3.11+**
- **PostgreSQL** – create a database, e.g. `jjmotors`
- **Redis** – for practice sessions (optional for UI-only: leave Redis URL; practice session creation may fail without it)

### Setup and run

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env` (copy from `.env.example`). **Minimum for local UI:**

```env
SECRET_KEY=any-random-string-for-local
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/jjmotors
REDIS_URL=redis://localhost:6379/0
```

Create the database if needed:

```text
# PostgreSQL: create database jjmotors;
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: **http://localhost:8000**
- Docs: **http://localhost:8000/docs**
- Health: **http://localhost:8000/health**

---

## 2. Frontend (Next.js)

### Setup and run

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

- App: **http://localhost:3000**

---

## 3. Use the UI

1. Open **http://localhost:3000**
2. **Log in** with your credentials
3. **Start call** – choose emotion, voice, accent, scenario → click **Start call**. The in-browser call starts: the AI greets you and you talk in the browser (no phone or codes).
4. **Call History** – list of your calls
5. **Call Detail** – open a call to see recording, transcript, KPIs, feedback

---

## Optional: Full voice flow (Twilio + AI)

To actually receive calls and run the AI conversation locally:

- Set **Twilio** env vars and point the Twilio number’s voice webhook to a **public URL** (e.g. **ngrok** to your `http://localhost:8000`).
- Set **OpenAI** and **ElevenLabs** keys (and voice IDs) in `.env`.
- Set **AWS S3** (or leave empty; recording upload will skip if not configured).

Then `TWILIO_WEBHOOK_BASE_URL` in `.env` must be that public base URL (e.g. `https://xxxx.ngrok.io`).

---

## Two terminals (summary)

**Terminal 1 – Backend**

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 – Frontend**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000** and use the UI.

**Optional – JJ logos:** To show the J.J.’s Auto Service Center logo on the login and dashboard, copy your two logo PNGs into `frontend/public/images/` as `logo1.png` and `logo2.png`. If the files are missing, the app still works and shows a text fallback on login.
