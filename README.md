# Attendance Tracker

A web app that helps JSSATEB students check their attendance without logging into the college ERP portal every time.

## Why This Was Built

The JSSATEB college ERP portal is an AJAX-heavy application with **no public API**. Students have to:

1. Log in to the portal
2. Navigate through multiple pages
3. Wait for AJAX calls to load
4. Find the attendance section

This is painful on mobile, slow on bad networks, and impossible to integrate with other tools.

**This app solves that** by using Playwright (headless browser automation) to scrape attendance data from the portal and serve it as a clean, fast JSON API. Students open the app, see their attendance. Done.

## How It Works

```
Student opens app → enters USN + password → backend scrapes portal → caches result in DB → returns JSON
```

On subsequent visits (within 7 days), the cached data is served instantly — no re-scraping needed.

## Why No Password Storage

The college portal contains **sensitive data** beyond attendance — fee details, personal information, exam registration. Storing portal passwords (even encrypted) creates a liability.

**This app never stores passwords.** Credentials are used once to scrape attendance data, then immediately discarded from memory. If any security incident occurs, it's on the user's side (weak password, shared credentials) — not ours.

## Features

- **Fast attendance check** — cached data loads in milliseconds
- **Rate limiting** — respects the college portal, doesn't spam it
- **JWT authentication** — secure, no session cookies
- **Leaderboard** — opt-in feature to compare attendance with classmates
- **Mobile-friendly** — works on any device with a browser
- **No install needed** — PWA support planned

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Backend | FastAPI + Playwright | Async, fast, browser automation |
| Database | PostgreSQL + SQLAlchemy | Reliable, JSON support |
| Auth | JWT (PyJWT) | Stateless, no server sessions |
| Container | Docker | Playwright needs Chromium binaries |
| Hosting | Railway (backend) | Free tier, Docker support |
| Frontend | React (planned) | PWA, mobile-first |

## Project Structure

```
Attendance-Tracker/
├── backend/                 # FastAPI backend
│   ├── api/                 # Routes, models, schemas
│   ├── alembic/             # Database migrations
│   ├── scrapper.py          # Playwright scraper
│   ├── Dockerfile
│   └── requirements.txt
├── attendance tracker valut/ # Design notes & docs
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scraper/login` | No | Scrape + cache + JWT |
| POST | `/scraper/refresh` | JWT | Re-scrape with password |
| GET | `/fetch_attendance` | JWT | Cached attendance |
| GET | `/leaderboard` | JWT | Ranked opted-in users |

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
fastapi dev api/main.py
```

### Docker

```bash
cd backend
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env --network host attendance-backend
```

## Security Model

1. **No password storage** — credentials are used once and discarded
2. **JWT-based auth** — 7-day tokens, no server-side sessions
3. **Only attendance data is scraped** — no fees, no personal info
4. **User bears responsibility** — for password security on their side

## Known Limitations

- Scraping depends on the college portal's HTML structure — if they change it, the scraper breaks
- Attendance data is only as fresh as the last scrape
- The college portal's availability affects the app's functionality
- Rate limiting is per-user, not global

## License

This is a personal project for JSSATEB students. Not affiliated with the college.
