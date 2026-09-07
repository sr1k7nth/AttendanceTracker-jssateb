# Attendance Tracker

A web app that helps JSSATEB students check their attendance without logging into the college ERP portal every time.

**Live:** [jatracker.foo.ng](https://jatracker.foo.ng) · **Backend:** [attendance-backend-8gyf.onrender.com](https://attendance-backend-8gyf.onrender.com)

## Why This Was Built

The JSSATEB college ERP portal is an AJAX-heavy application with **no public API**. Students have to:

1. Log in to the portal
2. Navigate through multiple pages
3. Wait for AJAX calls to load
4. Find the attendance section

This is painful on mobile, slow on bad networks, and impossible to integrate with other tools.

**This app solves that** by using Playwright (headless browser automation) to scrape attendance data from the portal and serve it as a clean, fast JSON API. Students open the app, see their attendance. Done.

## Features

- **Fast attendance check** — cached data loads instantly from localStorage
- **Subject-wise table** — code, name, classes, present, percentage for each subject
- **Stats grid** — overall %, can miss at 85%/75%, must attend at 85%/75%
- **Custom calculator** — enter any target % to see how many classes you can miss
- **Absent periods** — shows which classes you missed and when
- **Rate limiting** — 4 refreshes/day per user, 2-hour TTL cache, daily reset
- **Admin bypass** — unlimited refreshes for the admin
- **Leaderboard** — opt-in feature to compare attendance with classmates
- **Beta banner** — always-visible feedback link for bugs and feature requests
- **Terms & Conditions** — full ToC page with login checkbox
- **Dark/light theme** — persisted in localStorage
- **Mobile-friendly** — responsive design, works on any device

## Tech Stack

| Layer | Tech | Hosting |
|-------|------|---------|
| Backend | FastAPI + Playwright + SQLAlchemy | Render (Docker) |
| Database | PostgreSQL 18 | Render (managed) |
| Frontend | React + Vite | Vercel |
| Auth | JWT (PyJWT, 7-day tokens) | — |
| Migrations | Alembic | — |
| Monitoring | UptimeRobot (15 min pings) | — |
| Domain | Custom via foo-ng | `jatracker.foo.ng` |

## How It Works

```
Student opens app → enters USN + password → backend scrapes portal → caches in PostgreSQL → returns JSON
```

- First visit: scrapes portal (~20-25s), caches result, returns JWT
- Subsequent visits: cached data served instantly from localStorage
- Refresh: re-scrapes portal (subject to rate limiting)
- Login: always scrapes fresh, no limits

## Project Structure

```
Attendance-Tracker/
├── backend/                    # FastAPI backend
│   ├── api/
│   │   ├── main.py             # FastAPI app + CORS + startup
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── database.py         # DB connection
│   │   ├── config.py           # Environment settings
│   │   ├── oauth.py            # JWT creation + validation
│   │   └── routes/
│   │       ├── scrape.py       # /scraper/login + /scraper/refresh
│   │       ├── fetch_attendance.py  # /fetch_attendance
│   │       └── leaderboard.py  # /leaderboard
│   ├── alembic/                # Database migrations
│   ├── scrapper.py             # Playwright scraper logic
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Main app with tabs, theme, auth flow
│   │   ├── api.js              # API layer
│   │   ├── components/
│   │   │   ├── Login.jsx       # Login form + terms checkbox
│   │   │   ├── AttendanceSummary.jsx  # Stats, calculator, subject table
│   │   │   ├── Leaderboard.jsx # Ranked list with branch filter
│   │   │   ├── Faq.jsx         # FAQ page
│   │   │   ├── Terms.jsx       # Terms & Conditions page
│   │   │   └── BetaBanner.jsx  # Beta notice with feedback link
│   │   └── index.css           # Full styles (dark/light theme)
│   └── vite.config.js          # Dev proxy to backend
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/scraper/login` | No | None | Scrape portal → cache → return JWT |
| POST | `/scraper/refresh` | JWT | 4/day, 2hr TTL | Re-scrape with password |
| GET | `/fetch_attendance/` | JWT | None | Cached attendance from DB |
| GET | `/leaderboard` | JWT | None | Ranked opted-in users |
| GET | `/` | No | None | Health check |

## Security Model

1. **No password storage** — credentials are used once and discarded immediately
2. **JWT-based auth** — 7-day tokens, no server-side sessions
3. **Only attendance data is scraped** — no fees, no personal info
4. **Open source** — full codebase on GitHub, deployed directly from the repo
5. **Terms & Conditions** — users must accept before using the service

## Rate Limiting

- **Normal users:** 4 refreshes per day, 2-hour cache TTL, daily reset at midnight UTC
- **Admin (JS240955):** unlimited refreshes, no TTL cache, no rate limit
- **Login:** always scrapes fresh, no limits

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # fill in your values
fastapi dev api/main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies API calls to the Render backend automatically.

### Docker

```bash
cd backend
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env --network host attendance-backend
```

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_HOSTNAME` | PostgreSQL host |
| `DATABASE_PORT` | PostgreSQL port (5432) |
| `DATABASE_USERNAME` | PostgreSQL username |
| `DATABASE_PASSWORD` | PostgreSQL password |
| `DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Secret key for JWT signing |
| `OAUTH_ALGORITHM` | JWT algorithm (HS256) |
| `ENCRYPTION_KEY` | Fernet encryption key |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (empty for same-origin, full URL for proxy) |

## Known Limitations

- Scraping depends on the college portal's HTML structure — if they change it, the scraper breaks
- Attendance data is only as fresh as the last scrape
- The college portal's availability affects the app's functionality
- Free tier hosting spins down after inactivity (~50s cold start)
- Render free tier PostgreSQL expires after 90 days

## License

This is a personal project for JSSATEB students. Not affiliated with the college.
