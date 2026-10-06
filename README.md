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
- **Subject-wise table** — code, name, classes, present, percentage for each subject
- **Stats grid** — overall %, can miss at 85%/75%, must attend at 85%/75%
- **Custom calculator** — enter any target % to see how many classes you can miss
- **Absent periods** — shows which classes you missed and when
- **Unlimited refreshes** — no daily quota, no waiting between refreshes
- **Leaderboard** — opt-in, shows alias (not USN), attendance %, branch, rank
- **Supporters wall** — month-wise cards of everyone who backed the project
- **Donate page** — UPI QR + proof-of-payment upload form
- **Donation progress** — monthly ₹500 goal bar with lifetime totals
- **Support nudge** — popup on app opens 1, 3, 6, 9, 12… (at most once a day, never for supporters)
- **Changelog** — what shipped and when
- **Admin panel** — donation review queue (approve / reject proofs) behind a separate panel credential
- **Nav menu** — FAQ, Terms and Changelog tucked behind a ☰ button
- **Beta banner** — always-visible feedback link for bugs and feature requests
- **Terms & Conditions** — full ToC page with login checkbox
- **Dark/light theme** — persisted in localStorage
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
│   │       ├── scrape.py       # /scraper/login
│   │       ├── fetch_attendance.py  # /fetch_attendance
│   │       ├── leaderboard.py  # /leaderboard
│   │       ├── donations.py    # /supporters + /supporters/progress + /donations
│   │       └── admin.py        # /admin/donations/* (review queue)
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
| POST | `/scraper/login` | No | None | Scrape portal → cache → return JWT |
| GET | `/fetch_attendance/` | JWT | None | Cached attendance (incl. timetable) from DB |
| GET | `/leaderboard` | JWT | None | Ranked opted-in users |
| GET | `/supporters` | No | None | Approved supporters wall (name + message) |
| GET | `/supporters/progress` | No | None | Donation progress (month + lifetime totals) |
| POST | `/donations` | JWT | 5 MB max | Submit proof of payment → pending review |
| GET | `/admin/donations/pending` | JWT + panel cred | None | Donation proofs awaiting review |
| GET | `/admin/donations/{id}/screenshot` | JWT + panel cred | — | Original payment screenshot |
| POST | `/admin/donations/{id}/approve` | JWT + panel cred | None | Approve → supporter perks apply |
| POST | `/admin/donations/{id}/reject` | JWT + panel cred | None | Reject the proof |
| GET | `/` | No | None | Health check |

## Security Model

1. **No persistent password storage** — the password is sent once per login and dropped; it is never kept in browser storage or on the server. Updating attendance means logging in again.
2. **JWT-based auth** — 7-day tokens, no server-side sessions
3. **Leaderboard privacy** — leaderboard shows alias, attendance %, branch, rank. Portal IDs and detailed records are never shared.
4. **Only attendance data is scraped** — no fees, no personal info
5. **Payment proofs stay private** — donation screenshots live outside the web root and are never served statically. On the public wall only the approved name/message appears; the optional private note is never published.
6. **Open source** — full codebase on GitHub
7. **Terms & Conditions** — users must accept before using the service

## Rate Limiting

**There are none.** No daily quota, no 2-hour TTL, no 429 — every login
performs a real scrape and returns fresh data.

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
