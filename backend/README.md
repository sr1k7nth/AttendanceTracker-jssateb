# Attendance Tracker — Backend

FastAPI backend that scrapes JSSATEB's college portal for attendance data using Playwright.

## Why This Exists

The JSSATEB college ERP portal has **no public API**. It's an AJAX-heavy application that requires browser automation to extract data. This backend uses Playwright (headless Chromium) to log into the portal, scrape attendance data, and serve it as a clean JSON API.

## Tech Stack

| Component | Tech |
|-----------|------|
| Framework | FastAPI |
| Browser Automation | Playwright + Chromium |
| Database | PostgreSQL 18 (SQLAlchemy + Alembic) |
| Auth | JWT (PyJWT) |
| Container | Docker |
| Hosting | Render (free tier) |

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/scraper/login` | No | None | Scrape portal → cache in DB → return JWT |
| POST | `/scraper/refresh` | JWT | 4/day, 2hr TTL | Re-scrape portal → update cache |
| GET | `/fetch_attendance/` | JWT | None | Return cached attendance from DB |
| GET | `/leaderboard` | JWT | None | Ranked list of opted-in users |
| GET | `/` | No | None | Health check |

## Rate Limiting

Implemented in `/scraper/refresh`:

- **Daily limit:** 4 requests per user per day (resets at midnight UTC)
- **TTL cache:** If data is less than 2 hours old, return cached (no scrape)
- **Admin bypass:** USN `JS240955` skips all limits
- **Login:** Always scrapes fresh, no limits applied

Flow:
```
Refresh request → check daily reset → check TTL (< 2hr → cached) → check rate limit (<= 0 → 429) → scrape + decrement
```

## Project Structure

```
backend/
├── api/
│   ├── main.py              # FastAPI app + CORS + startup table creation
│   ├── models.py            # SQLAlchemy models (Attendance)
│   ├── schemas.py           # Pydantic schemas (request/response)
│   ├── database.py          # DB engine + session
│   ├── config.py            # Pydantic Settings (env vars)
│   ├── oauth.py             # JWT creation + validation
│   └── routes/
│       ├── scrape.py        # /scraper/login + /scraper/refresh
│       ├── fetch_attendance.py  # /fetch_attendance
│       └── leaderboard.py   # /leaderboard
├── alembic/                 # Database migrations
├── alembic.ini
├── scrapper.py              # Playwright scraper logic
├── Dockerfile
├── requirements.txt
└── .env                     # Environment variables (not in git)
```

## Database Schema

### `attendance` table

| Column | Type | Description |
|--------|------|-------------|
| `usn` | VARCHAR (PK) | Student USN |
| `summary` | JSONB | Subject-wise attendance data |
| `absent_periods` | JSONB | Absent period details |
| `total_avg` | FLOAT | Overall attendance percentage |
| `can_miss85` | INT | Classes can miss to stay at 85% |
| `can_miss75` | INT | Classes can miss to stay at 75% |
| `need_to_attend85` | INT | Classes must attend for 85% |
| `need_to_attend75` | INT | Classes must attend for 75% |
| `timestamp` | TIMESTAMP | Last scrape time (UTC) |
| `leaderboard_opt` | BOOL | Opted in to leaderboard |
| `sem` | INT | Current semester |
| `branch` | VARCHAR | Student branch |
| `request_left` | INT | Remaining refreshes today (default 4) |

## Environment Variables

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

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
playwright install chromium

# Set up environment
cp .env.example .env  # fill in your values

# Run dev server
fastapi dev api/main.py
```

## Docker

```bash
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env --network host attendance-backend
```

**Important:** The root `.dockerignore` excludes `backend/.env` from the Docker build. Make sure env vars are set in Render's dashboard, not in the `.env` file.

## Database Migrations

```bash
# Create migration (auto-detects model changes)
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head

# Check current version
alembic current
```

## Scraper Details

The Playwright scraper (`scrapper.py`) handles:

1. **Login** — fills USN + password on ASP.NET form, clicks login button
2. **Error detection** — checks `#divModelValidation_alertmsg` for invalid credentials
3. **Navigation** — clicks attendance link, waits for "Student Attendance" text
4. **Summary extraction** — clicks Summary button, parses `table.fancyTable`
5. **Absent periods** — parses absent period table if present
6. **Branch/semester** — extracts from dropdown selectors

**Known quirks:**
- Portal uses ASP.NET `__doPostBack` AJAX redirects (no full navigation events)
- `networkidle` never resolves due to persistent background AJAX connections
- Uses `time.sleep(3)` + `wait_for_selector` instead of `expect_navigation`
- Playwright's `TimeoutError` is different from Python's built-in `TimeoutError`

## Security

- **Passwords are never stored.** Credentials are used once to scrape the portal, then discarded immediately.
- **JWT tokens** expire after 7 days. Used to identify users and protect cached data.
- **Only attendance data is scraped** — no fees, no personal info, no other portal data.
- **Open source** — full codebase on GitHub, deployed directly from the repo.

## Deployment

- **Platform:** Render (free tier Docker)
- **Base image:** `mcr.microsoft.com/playwright/python:v1.62.0-noble`
- **Auto-deploy:** Push to `main` triggers rebuild
- **Database:** Render PostgreSQL (Singapore region)
- **Monitoring:** UptimeRobot pings every 15 min to prevent spin-down
