# Attendance Tracker — Backend

FastAPI backend that scrapes JSSATEB's college portal for attendance data using Playwright.

## Why This Exists

The JSSATEB college ERP portal has **no public API**. It's an AJAX-heavy application that requires browser automation to extract data. This backend uses Playwright (headless Chromium) to log into the portal, scrape attendance data, and serve it as a clean JSON API.

## Tech Stack

| Component | Tech |
|-----------|------|
| Framework | FastAPI |
| Browser Automation | Playwright + Chromium |
| Database | PostgreSQL (SQLAlchemy + Alembic) |
| Auth | JWT (PyJWT) |
| Scraping | BeautifulSoup4 + lxml |
| Container | Docker |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scraper/login` | No | Scrape portal → cache in DB → return JWT |
| POST | `/scraper/refresh` | JWT | Re-scrape portal → update cache |
| GET | `/fetch_attendance` | JWT | Return cached attendance from DB |
| GET | `/leaderboard` | JWT | Ranked list of opted-in users |
| GET | `/` | No | Health check |

## Project Structure

```
backend/
├── api/
│   ├── main.py              # FastAPI app + CORS
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # DB connection
│   ├── config.py            # Environment settings
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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_HOSTNAME` | PostgreSQL host |
| `DATABASE_PORT` | PostgreSQL port |
| `DATABASE_USERNAME` | PostgreSQL username |
| `DATABASE_PASSWORD` | PostgreSQL password |
| `DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Secret key for JWT signing |
| `OAUTH_ALGORITHM` | JWT algorithm (HS256) |
| `ENCRYPTION_KEY` | Fernet encryption key |

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
playwright install chromium

# Run dev server
fastapi dev api/main.py
```

## Docker

```bash
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env --network host attendance-backend
```

## Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head
```

## Security

- **Passwords are never stored.** Credentials are used once to scrape the portal, then discarded immediately.
- **JWT tokens** expire after 7 days. Used to identify users and protect cached data.
- The college portal has sensitive data (fees, personal info). This backend only scrapes attendance — nothing else.
