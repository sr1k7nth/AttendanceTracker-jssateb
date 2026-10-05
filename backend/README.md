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
| Hosting | Ubuntu server (systemd unit `fastapi`) |

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/scraper/login` | No | None | Scrape portal → cache in DB → return JWT |
| POST | `/scraper/refresh` | JWT | 4/day, 2hr TTL | Re-scrape portal → update cache |
| GET | `/fetch_attendance/` | JWT | None | Return cached attendance (incl. timetable) from DB |
| GET | `/leaderboard` | JWT | None | Ranked list of opted-in users |
| GET | `/supporters` | No | None | Approved supporters wall (name + message) |
| GET | `/supporters/progress` | No | None | Donation progress (month + lifetime totals) |
| POST | `/donations` | JWT | 5 MB max | Submit name, amount, message, screenshot → pending review |
| GET | `/` | No | None | Health check |

## Rate Limiting

Implemented in `/scraper/refresh`:

- **Daily limit:** 4 requests per user per day (resets at midnight UTC)
- **Supporters:** 6 requests per day once a donation is approved
- **TTL cache:** If data is less than 2 hours old, return cached (no scrape)
- **Login:** Always scrapes fresh, no limits applied

Flow:
```
Refresh request → check daily reset → check TTL (< 2hr → cached) → check rate limit (<= 0 → 429) → scrape + decrement
```

Quotas come from `.env` (`FREE_REQUESTS_PER_DAY`, `SUPPORTER_REQUESTS_PER_DAY`), so flipping 4 → 2 later is a one-line change.

## Scrape Queue Auto-Calibration

Each scrape launches a Chromium process, and concurrent ones would exhaust the
box's RAM. The semaphore limiting them (`SCRAPE_SLOTS` in `api/routes/scrape.py`)
is sized **once at startup, before any request is served** — never per-request.

| `SCRAPE_CONCURRENCY` | Behaviour |
|---|---|
| `> 0` (e.g. `1`) | **Manual** — your number is used as-is, no probing. Existing `.env` files keep working unchanged. |
| `0` (default) | **Auto** — run one test scrape with `SCRAPE_PROBE_USN`/`_PASSWORD`, measure its real RAM cost, read `MemAvailable` from `/proc/meminfo`, and compute `slots = (available − SCRAPE_SAFETY_MB) ÷ cost`, clamped to `[1, SCRAPE_MAX_SLOTS]`. Re-measures on every restart. |
| `0` + anything fails | **Fallback** — no credentials, portal down, bad password, timeout: log a warning and boot with `1`. Calibration failure never blocks startup. |

Details:

- The probe calls `scrapper()` directly — it creates **no DB rows** and consumes
  **none of the daily quota**, so the test account is unaffected.
- `BoundedSemaphore` can't be resized, so `scrape.py` builds a placeholder at
  import and `api/main.py` swaps in the real one during the startup hook. Safe
  because uvicorn isn't accepting requests yet.
- The count bounds **browsers, not users**: cached or quota-expired requests
  never acquire the semaphore.
- Per-process: with `--workers N`, the real ceiling is `N ×` this value.
- Check what it decided: `journalctl -u fastapi | grep "scrape slots"`.

To see the per-scrape cost yourself: `venv/bin/python ram_probe.py` (needs
`backend/.portal_creds`). That number is exactly what auto mode divides by.

## Project Structure

```
backend/
├── api/
│   ├── main.py              # FastAPI app + CORS + startup (tables + slot calibration)
│   ├── models.py            # SQLAlchemy models (Attendance, Donation)
│   ├── schemas.py           # Pydantic schemas (request/response)
│   ├── database.py          # DB engine + session
│   ├── config.py            # Pydantic Settings (env vars)
│   ├── oauth.py             # JWT creation + validation
│   └── routes/
│       ├── scrape.py        # /scraper/login + /scraper/refresh
│       ├── fetch_attendance.py  # /fetch_attendance
│       ├── leaderboard.py   # /leaderboard
│       └── donations.py     # /supporters + /supporters/progress + /donations
├── alembic/                 # Database migrations
├── alembic.ini
├── scrapper.py              # Playwright scraper logic
├── memory_probe.py          # RAM measuring used to size the scrape queue
├── ram_probe.py             # Manual one-off report built on memory_probe
├── .env                     # Environment variables (not in git)
├── .env.example             # Template for the above
├── Dockerfile
└── requirements.txt
```

## Database Schema

### `attendance` table

| Column | Type | Description |
|--------|------|-------------|
| `usn` | VARCHAR (PK) | Student USN |
| `alias` | VARCHAR(30) | Leaderboard name; nullable for older accounts |
| `summary` | JSONB | Subject-wise attendance data |
| `absent_periods` | JSONB | Absent period details |
| `timetable` | JSONB | Weekly period grid (day × period, present/absent/upcoming) |
| `total_avg` | FLOAT | Overall attendance percentage |
| `can_miss85` | INT | Classes can miss to stay at 85% |
| `can_miss75` | INT | Classes can miss to stay at 75% |
| `need_to_attend85` | INT | Classes must attend for 85% |
| `need_to_attend75` | INT | Classes must attend for 75% |
| `timestamp` | TIMESTAMP | Last scrape time (UTC) |
| `leaderboard_opt` | BOOL | Opted in to leaderboard |
| `sem` | INT | Current semester |
| `branch` | VARCHAR | Student branch |
| `request_left` | INT | Remaining refreshes today (default = `FREE_REQUESTS_PER_DAY`, i.e. 4) |
| `is_supporter` | BOOL | Supporter flag — set when a donation is approved (default false) |

### `donations` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Donation id |
| `usn` | VARCHAR (FK → `attendance.usn`) | Donor; cascades on account delete |
| `name` | VARCHAR(30) | Donor name — required even when anonymous |
| `message` | VARCHAR(200) | Public message shown on the supporters wall; nullable |
| `admin_note` | VARCHAR(200) | Private note from the donor — never published; nullable |
| `amount` | INT | Amount in ₹ (1–10000) |
| `anonymous` | BOOL | Display as "Anonymous" on the wall (default false) |
| `screenshot_file` | VARCHAR | Server-generated filename of the payment proof |
| `status` | VARCHAR(16) | `pending` → `approved` / `rejected` (default `pending`) |
| `created_at` | TIMESTAMPTZ | Submission time (default `now()`) |
| `reviewed_at` | TIMESTAMPTZ | Review time; nullable |

Payment screenshots are stored under `backend/uploads/donations/` (override with
`DONATIONS_UPLOAD_DIR`) — outside any statically served path, so a leak would
require an authenticated route plus a DB row.

## Environment Variables

See `.env.example` for a copyable template.

| Variable | Description |
|----------|-------------|
| `DATABASE_HOSTNAME` | PostgreSQL host |
| `DATABASE_PORT` | PostgreSQL port (5432) |
| `DATABASE_USERNAME` | PostgreSQL username |
| `DATABASE_PASSWORD` | PostgreSQL password |
| `DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Secret key for JWT signing (`openssl rand -hex 32`) |
| `OAUTH_ALGORITHM` | JWT algorithm (HS256) |
| `ENCRYPTION_KEY` | Reserved, currently unused — any non-empty value |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SCRAPE_CONCURRENCY` | Live browser scrapes allowed at once. **`0` (default) = auto**: at startup the app runs one test scrape, measures its RAM cost and computes the slot count from free memory (re-runs every restart). **`> 0` = manual**: use that number as-is, no probing. If auto-calibration fails it falls back to `1`. |
| `SCRAPE_PROBE_USN` | Test account USN for auto-calibration (no DB writes, no quota). Unset = auto mode falls back to `1` |
| `SCRAPE_PROBE_PASSWORD` | Test account password for auto-calibration |
| `SCRAPE_SAFETY_MB` | RAM held back for Postgres + Python + OS before dividing up the rest (default `200`) |
| `SCRAPE_MAX_SLOTS` | Upper bound on auto-calculated slots, however big the box (default `4`) |
| `FREE_REQUESTS_PER_DAY` | Daily refreshes per regular user (default `4`) |
| `SUPPORTER_REQUESTS_PER_DAY` | Daily refreshes per supporter (default `6`) |
| `DONATION_GOAL` | Monthly donation goal in ₹ (default `500`) |
| `DONATIONS_UPLOAD_DIR` | Payment screenshot storage (default `backend/uploads/donations`) |

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

**Important:** The root `.dockerignore` excludes `backend/.env` from the Docker build — pass the env vars with `--env-file` (or your orchestrator's secret store), never by baking the file into the image.

## Database Migrations

Schema changes ship as Alembic migrations. Run them **from `backend/`** —
`alembic/env.py` reads the same `.env` as the app (its working directory).
Startup table creation only creates *missing tables*; it never adds columns to
existing ones, so `alembic upgrade head` is required after every pull that
touches the schema.

Notable recent revisions:

- `c9f4b1a7d253` — `donations` table, `attendance.is_supporter`, restores the `attendance` primary key
- `fb7ba62ec104` — `attendance.timetable` (weekly grid)
- `34f42079fe9b` — `donations.admin_note` (private message field)

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
6. **Weekly timetable** — parses the week's period grid with per-period status
7. **Branch/semester** — extracts from dropdown selectors

**Known quirks:**
- Portal uses ASP.NET `__doPostBack` AJAX redirects (no full navigation events)
- `networkidle` never resolves due to persistent background AJAX connections
- Uses `time.sleep(3)` + `wait_for_selector` instead of `expect_navigation`
- Playwright's `TimeoutError` is different from Python's built-in `TimeoutError`

## Security

- **Passwords are not persisted.** The backend uses passwords for each scrape without saving them. Request models mask passwords, validation responses omit submitted values, and scraper failures return generic errors without logging their details.
- **Leaderboard privacy:** responses contain only alias, attendance percentage, branch, timestamp, rank, and an `is_me` flag. Portal IDs and detailed attendance records are excluded.
- **Payment proofs:** screenshots are stored outside any statically served directory; the public supporters wall only ever sees approved names and messages.
- **Scraper diagnostics:** automatic screenshots are disabled. Keep Playwright debug logging, request-body logging, and tracing disabled in deployment because they can capture credentials.
- **JWT tokens** expire after 7 days. Used to identify users and protect cached data.
- **Only attendance data is scraped** — no fees, no personal info, no other portal data.
- **Open source** — full codebase on GitHub.

## Deployment

- **Platform:** Ubuntu server — PostgreSQL on localhost, app run by systemd (unit `fastapi`; logs via `journalctl -u fastapi`)
- **Env file:** `backend/.env` (never committed; see `.env.example`)
- **Deploy steps:** `git pull` → `alembic upgrade head` → `sudo systemctl restart fastapi`
- **Screenshots:** keep `backend/uploads/donations/` on persistent storage — these are payment proofs
