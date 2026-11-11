# Attendance Tracker

A web app that helps JSSATEB students check their attendance without logging into the college ERP portal every time.

**Live:** [jatracker.foo.ng](https://jatracker.foo.ng)

## Why This Was Built

The JSSATEB college ERP portal is an AJAX-heavy application with **no public API**. Students have to:

1. Log in to the portal
2. Navigate through multiple pages
3. Wait for AJAX calls to load
4. Find the attendance section

This is painful on mobile, slow on bad networks, and impossible to integrate with other tools.

**This app solves that** by replaying the portal's own login and page requests over plain HTTP and serving the result as a clean, fast JSON API. Students open the app, see their attendance. Done.

## Features

- **Landing page** — tagline and Login button; returning users skip straight to the form
- **Fast attendance check** — cached data loads instantly from localStorage
- **Weekly timetable** — the week's period grid (present / absent / upcoming), straight from the portal
- **Weekly history** — past weeks are stored and browsable with ‹ › arrows; the first scrape backfills the previous four weeks, then each new week's first scrape captures the finished one
- **Subject-wise table** — code, name, classes, present, percentage for each subject
- **Stats grid** — overall %, dynamic "can miss" and "need to attend" values (only the live thresholds are shown — structurally-zero values are hidden)
- **Attendance over time** — collapsible line chart with one point per login, gradient area fill, 75/85 guide lines
- **Custom calculator** — enter any target % to see how many classes you can miss
- **Miss calculator** — "what if I miss X classes?" shows the resulting %, globally and per subject
- **Absent periods** — shows which classes you missed and when
- **Leaderboard** — opt-in, alias only (never USN), shows the most recent 3-day window sorted highest/lowest, 20 per page
- **Supporters wall** — month-wise cards of everyone who backed the project
- **Donate page** — UPI QR + proof-of-payment upload (client-side resize, 5 MB cap)
- **Donation review notices** — donors see a banner when their proof is approved or rejected (with the reason)
- **In-app feedback** — five types (Feedback / Error / Feature request / Data removal / Beta screenshot) with screenshot uploads where they matter; Error and Data removal require one, Data removal auto-stamps your last scrape time as identity proof; capped at 3 submissions per user per day; the admin reviews and replies in the panel — replies show up as a banner on your summary page
- **Branch beta-check banner** — post-login, dismissible amber banner asking users to test the site and submit a beta screenshot (USN + branch attached), because the admin has no credentials for other branches; it auto-retires for a branch after 3 beta screenshots, and dismissal remembers per branch
- **Donation progress** — monthly ₹500 goal bar with lifetime totals
- **Support nudge** — popup on app opens 1, 3, 6, 9, 12… (at most once a day, never for supporters)
- **Changelog** — what shipped and when
- **Admin panel** — pending queue + approved/rejected history tabs behind a separate panel credential; screenshots are auto-deleted once a donation is reviewed
- **Nav menu** — FAQ, Terms, Changelog and GitHub tucked behind a ☰ button; Donate as a green navbar entry
- **Dark/light theme** — zinc monochrome + green brand accent, persisted in localStorage
- **Mobile-friendly** — responsive design, works on any device

## Tech Stack

| Layer | Tech | Hosting |
|-------|------|---------|
| Backend | FastAPI + httpx + SQLAlchemy | Ubuntu server (systemd) |
| Database | PostgreSQL 18 | AWS |
| Frontend | React + Vite | Vercel |
| Auth | JWT (PyJWT, 7-day tokens) | — |
| Migrations | Alembic | — |
| Domain | Custom via [foo-ng](https://github.com/Pokymon/foo.ng) | `jatracker.foo.ng` |

## How It Works

```
Student opens app → enters Portal ID + password + alias → backend scrapes portal → caches in PostgreSQL → returns JSON
```

- First visit: scrapes portal (~1-2s), caches result, returns JWT
- Subsequent visits: cached data served instantly from localStorage
- Updating data: log in again — every login re-scrapes fresh, no limits

## Project Structure

```
Attendance-Tracker/
├── backend/                    # FastAPI backend
│   ├── api/
│   │   ├── main.py             # FastAPI app + CORS + startup
│   │   ├── models.py           # SQLAlchemy models (attendance, donations)
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── database.py         # DB connection
│   │   ├── config.py           # Environment settings
│   │   ├── oauth.py            # JWT creation + validation
│   │   └── routes/
│   │       ├── scrape.py       # /scraper/login (cooldown, daily cap, admin bypass)
│   │       ├── fetch_attendance.py  # /fetch_attendance + /fetch_attendance/history
│   │       ├── leaderboard.py  # /leaderboard
│   │       ├── donations.py    # /supporters + /supporters/progress + /donations + /donations/mine
│   │       └── admin.py        # /admin/donations/* (review queue + history) + /admin/latest
│   ├── alembic/                # Database migrations
│   ├── portal_client.py        # Portal scraper (plain HTTP) + parsers
│   ├── .env.example            # Template for environment settings
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Main app with tabs, theme, auth flow
│   │   ├── api.js              # API layer
│   │   ├── config.js           # App constants
│   │   ├── components/
│   │   │   ├── Landing.jsx     # Landing page (tagline + Login)
│   │   │   ├── Login.jsx       # Login form + alias + terms checkbox
│   │   │   ├── AttendanceSummary.jsx  # Stats, calculator, timetable, subject table
│   │   │   ├── Timetable.jsx   # Weekly period grid
│   │   │   ├── Leaderboard.jsx # Ranked list with branch filter
│   │   │   ├── Supporters.jsx  # Supporters wall (month-wise cards)
│   │   │   ├── Support.jsx     # Donate page (UPI QR + upload form)
│   │   │   ├── DonationPopup.jsx # Support nudge popup
│   │   │   ├── ProgressBar.jsx # Monthly goal bar
│   │   │   ├── Changelog.jsx   # Version history
│   │   │   ├── Faq.jsx         # FAQ page
│   │   │   ├── Terms.jsx       # Terms & Conditions page
│   │   │   ├── AdminPanel.jsx  # Donation review (approve / reject)
│   │   │   └── BetaBanner.jsx  # Beta notice with feedback link
│   │   └── index.css           # Full styles (dark/light theme)
│   ├── public/
│   │   ├── upi-qr.jpg          # UPI QR shown on the Donate page
│   │   └── favicon.svg
│   └── vite.config.js          # Dev proxy to backend
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/scraper/login` | No | Cooldown + daily cap (bypassed for `ADMIN_USN`) | Scrape portal → cache → return JWT |
| GET | `/fetch_attendance/` | JWT | None | Cached attendance + `weeks[]` (stored weekly grids, newest first) |
| GET | `/fetch_attendance/history` | JWT | None | Attendance % checkpoints (one per login) |
| GET | `/leaderboard` | JWT | None | Ranked opted-in users (same semester) |
| GET | `/supporters` | No | None | Approved supporters wall (name + message) |
| GET | `/supporters/progress` | No | None | Donation progress (month + lifetime totals) |
| POST | `/donations` | JWT | 5 MB max | Submit proof of payment → pending review |
| POST | `/feedback` | JWT | 3 per user/day | Feedback, Error (screenshot required), Feature request, Data removal (dashboard screenshot required), Beta screenshot (branch + screenshot required) |
| GET | `/feedback/mine` | JWT | None | Your submissions incl. admin replies |
| GET | `/feedback/beta-status` | JWT | None | Your branch's beta-screenshot count (drives the banner) |
| GET | `/feedback/branches` | JWT | None | Distinct known branches |
| GET | `/donations/mine` | JWT | None | The donor's own submissions (status + reject reason) |
| GET | `/admin/donations/pending` | JWT + panel cred | None | Donation proofs awaiting review |
| GET | `/admin/donations/reviewed?status=` | JWT + panel cred | None | Approved/rejected history (metadata only) |
| GET | `/admin/donations/{id}/screenshot` | JWT + panel cred | — | Payment screenshot (404 after review) |
| POST | `/admin/donations/{id}/approve` | JWT + panel cred | None | Approve → supporter perks apply → screenshot deleted |
| POST | `/admin/donations/{id}/reject` | JWT + panel cred | None | Reject with reason → donor sees it → screenshot deleted |
| GET | `/admin/latest` | JWT + panel cred | None | Latest sign-ins table |
| GET | `/admin/feedback` | JWT + panel cred | None | Feedback submissions inbox |
| GET | `/admin/feedback/{id}/screenshot` | JWT + panel cred | — | Attached feedback screenshot |
| GET | `/` | No | None | Health check |

## Security Model

1. **No persistent password storage** — the password is sent once per login and dropped; it is never kept in browser storage or on the server. Updating attendance means logging in again.
2. **JWT-based auth** — 7-day tokens, no server-side sessions
3. **Leaderboard privacy** — leaderboard shows alias, attendance %, branch, rank. Portal IDs and detailed records are never shared.
4. **Only attendance data is scraped** — no fees, no personal info
5. **Payment proofs stay private — and don't linger** — donation screenshots live outside the web root, are never served statically, and are **deleted the moment a donation is reviewed** (approved or rejected). Only the review row remains, as an audit record. On the public wall only the approved name/message appears; the optional private note is never published.
6. **Open source** — full codebase on GitHub
7. **Terms & Conditions** — users must accept before using the service

## Rate Limiting

Every login performs a real scrape, throttled three ways (all sliding windows):

| Guard | Default | Response |
|-------|---------|----------|
| Cooldown between scrapes of the same USN | 5 min | 429 `recently_scraped` + `Retry-After` (frontend serves cached data) |
| Scrapes per USN per sliding day | 20 | 429 with the window's reset time |
| Failed logins per USN per window | 5 / 15 min | 429 (cleared on the next successful login) |

The `ADMIN_USN` account bypasses the cooldown and daily cap (never the failure budget — wrong passwords still count).

## Scraping

Each scrape replays the portal's own login and page requests in four HTTP
calls — no browser, ~9 MB and ~1-2s per scrape — then caches the parsed result
in PostgreSQL. Requests that arrive together simply run together — there is no
cache to short-circuit them, so every request really does hit the portal.

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your values
fastapi dev api/main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies API calls to `http://127.0.0.1:8000` automatically.

### Docker

```bash
cd backend
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env --network host attendance-backend
```

## Deployment

- **Frontend:** Vercel builds the `frontend/` directory on push to `main`.
  Set `VITE_API_URL` in the Vercel dashboard to the backend's public URL.
- **Backend:** on the server —

  ```bash
  git pull
  cd backend && alembic upgrade head
  sudo systemctl restart fastapi
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
| `JWT_SECRET_KEY` | Secret key for JWT signing (`openssl rand -hex 32`) |
| `OAUTH_ALGORITHM` | JWT algorithm (HS256) |
| `ENCRYPTION_KEY` | Reserved, currently unused — any non-empty value |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `DONATION_GOAL` | Monthly donation goal in ₹ (default `500`) |
| `DONATIONS_UPLOAD_DIR` | Payment screenshot storage (default `backend/uploads/donations`) |
| `FEEDBACK_UPLOAD_DIR` | Feedback screenshot storage (default `backend/uploads/feedback`) |
| `SCRAPE_COOLDOWN_MINUTES` | Minutes between two scrapes of the same USN (default `5`) |
| `DAILY_SCRAPE_LIMIT` | Scrapes allowed per USN per sliding day (default `20`) |
| `DAILY_SCRAPE_WINDOW_HOURS` | Sliding window for the daily scrape cap (default `24`) |
| `FAILURE_LIMIT` | Failed logins allowed per USN per window (default `5`) |
| `FAILURE_WINDOW_MINUTES` | Sliding window for the failure budget (default `15`) |
| `ADMIN_PANEL_USERNAME` | Admin panel username (login-form gate; empty = admin routes 503) |
| `ADMIN_PANEL_PASSWORD` | Admin panel password |
| `ADMIN_USN` | Portal USN the admin token carries; bypasses cooldown + daily cap |

See `backend/.env.example` for a ready-to-copy template.

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend public URL (empty = same-origin; set at build time) |

## Known Limitations

- Scraping depends on the college portal's HTML structure — if they change it, the scraper breaks
- Attendance data is only as fresh as the last scrape
- The college portal's availability affects the app's functionality

## License

This is a personal project for JSSATEB students. Not affiliated with the college.

## Terms & Conditions

See [TERMS.md](TERMS.md) for the full terms and conditions.
