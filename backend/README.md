# Attendance Tracker — Backend

FastAPI backend that scrapes JSSATEB's college portal for attendance data over plain HTTP.

## Why This Exists

The JSSATEB college ERP portal has **no public API**. It's an ASP.NET WebForms application whose login and pages are driven by ordinary form submissions — so this backend replays those same requests with `httpx` instead of driving a browser, parses the HTML, and serves it as a clean JSON API.

## Tech Stack

| Component | Tech |
|-----------|------|
| Framework | FastAPI |
| HTTP client | httpx + BeautifulSoup/lxml |
| Crypto | `cryptography` (RSA for the portal's login form) |
| Database | PostgreSQL 18 (SQLAlchemy + Alembic) |
| Auth | JWT (PyJWT) |
| Container | Docker |
| Hosting | Ubuntu server (systemd unit `fastapi`) |

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/scraper/login` | No | None | Scrape portal → cache in DB → return JWT |
| POST | `/scraper/refresh` | JWT | None | Re-scrape portal → update cache |
| GET | `/fetch_attendance/` | JWT | None | Return cached attendance (incl. timetable) from DB |
| GET | `/leaderboard` | JWT | None | Ranked list of opted-in users |
| GET | `/supporters` | No | None | Approved supporters wall (name + message) |
| GET | `/supporters/progress` | No | None | Donation progress (month + lifetime totals) |
| POST | `/donations` | JWT | 5 MB max | Submit name, amount, message, screenshot → pending review |
| GET | `/` | No | None | Health check |

## Rate Limiting

**There are none.** No daily quota, no 2-hour TTL, no 429:

```
Refresh request → scrape portal → update cache → return
```

Both `/scraper/login` and `/scraper/refresh` perform a real scrape every time.

## How a scrape works

Each scrape is four HTTP requests — no browser, **~9 MB and ~1-2s** — parsed by
the shared functions in `portal_client.py`:

| # | Request | What it gets |
|---|---------|--------------|
| 1 | `GET /RApps/Home/login.aspx` | `__VIEWSTATE` + the RSA public key |
| 2 | `GET /RApps/Home/HSData.aspx` | the `SUCCESS<cKey>` pre-check reply |
| 3 | `POST /RApps/Home/login.aspx` | the real login (USN and password RSA'd) |
| 4 | `GET /apps/TimeTable/StudentAttendance.aspx` + `POST …/StudentAttendanceSummary.aspx` | the timetable and the summary |

There is no concurrency cap: requests that arrive together simply run together,
and every request that reaches the scraper really does hit the portal.

Run it yourself:

```bash
venv/bin/python portal_client.py --selftest        # parse the saved sample.html
venv/bin/python portal_client.py <usn> <password>  # live scrape (or PORTAL_USN/PORTAL_PASSWORD)
venv/bin/python timing_probe.py                    # duration over N runs
```

## Project Structure

```
backend/
├── api/
│   ├── main.py              # FastAPI app + CORS + startup (table creation)
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
├── portal_client.py          # Portal scraper (plain HTTP) + all HTML parsers
├── timing_probe.py           # One-off scrape duration report
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
| `request_left` | INT | Legacy — leftover from the old daily quota; nothing reads or writes it |
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
| `DONATION_GOAL` | Monthly donation goal in ₹ (default `500`) |
| `DONATIONS_UPLOAD_DIR` | Payment screenshot storage (default `backend/uploads/donations`) |

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

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

The scraper (`portal_client.py`) handles:

1. **Login** — replays the portal's own three-step login: fetch the form, call the `HSData.aspx` CHECKCOLLEGE pre-check, then POST the form
2. **Error detection** — the pre-check answers `FAILED<message>` for bad credentials → `LoginError` → 401
3. **Navigation** — a plain GET of the attendance page
4. **Summary extraction** — POSTs the `ENTRYFOR` token embedded in the Summary button, parses `table.fancyTable`
5. **Absent periods** — derived from the parsed timetable (one parser, one source of truth)
6. **Weekly timetable** — parses the week's period grid with per-period status
7. **Branch/semester** — extracts from the `cboStudentSessionDetail` dropdown

**Known quirks:**
- The USN goes **plaintext** to `HSData.aspx` but **RSA'd** to the login POST — `submitForm_CG` reads `#txtUserID` at line 108, *before* `submitForm` encrypts it at line 210
- The password is RSA'd exactly once, in the pre-check: `cboCKey` is absent, so the form does not re-encrypt
- `txtHCKey` must carry the `SUCCESS` payload into the login POST or the portal rejects it
- The attendance path resolves to `/apps/...` at the site **root** — the home cards call `../../apps/...` from `/RApps/Home/`, which is two levels up. `/RApps/apps/...` returns `GenericErrorPage.aspx`
- Both RSA calls are PKCS#1 v1.5 + base64, matching JSEncrypt's `encrypt()`

## Security

- **Passwords are not persisted.** The backend uses passwords for each scrape without saving them. Request models mask passwords, validation responses omit submitted values, and scraper failures return generic errors without logging their details.
- **Leaderboard privacy:** responses contain only alias, attendance percentage, branch, timestamp, rank, and an `is_me` flag. Portal IDs and detailed attendance records are excluded.
- **Payment proofs:** screenshots are stored outside any statically served directory; the public supporters wall only ever sees approved names and messages.
- **Scraper diagnostics:** `httpx` logs request URLs at `INFO`, and the portal pre-check carries the USN and the RSA'd password in its query string — `api/main.py` sets the `httpx` logger to `WARNING` so credentials never reach `journalctl`.
- **JWT tokens** expire after 7 days. Used to identify users and protect cached data.
- **Only attendance data is scraped** — no fees, no personal info, no other portal data.
- **Open source** — full codebase on GitHub.

## Deployment

- **Platform:** Ubuntu server — PostgreSQL on localhost, app run by systemd (unit `fastapi`; logs via `journalctl -u fastapi`)
- **Env file:** `backend/.env` (never committed; see `.env.example`)
- **Deploy steps:** `git pull` → `alembic upgrade head` → `sudo systemctl restart fastapi`
- **Screenshots:** keep `backend/uploads/donations/` on persistent storage — these are payment proofs
