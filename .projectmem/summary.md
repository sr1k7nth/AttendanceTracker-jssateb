# projectmem - AttendanceTracker-jssateb

_Last updated: 2026-11-16_

## Project purpose
A web app that helps JSSATEB students check their attendance without logging into the college ERP portal every time.

## Recent issues
- [DONE] #legacy_eb5d Legacy issue: fix(admin): uncap the latest list, fix USN overflow, 12-hour IST (fixed)
- [DONE] #legacy_9a17 Legacy issue: fix(supporters): show the full donor name instead of truncating it (fixed)
- [DONE] #legacy_3c19 Legacy issue: fix(admin): compare the panel username case-insensitively (fixed)

## Decisions
- No decisions logged yet.

## Notes
- style(admin): align the latest table on a grid, condense the branch cell
- feat(admin): serial numbers, and a real table that scrolls sideways
- feat(rate-limit): per-USN cooldown, daily cap, and failed-login budget
- docs(arch): architecture export and request sequence diagrams
- New feature: feat: in-app feedback with admin replies, and the zinc+green theme [backend/alembic/versions/1c7a3f9b2d51_weekly_timetables.py]
- New feature: feat: branch beta-check banner + beta_screenshot feedback category [backend/api/routes/feedback.py]
- New feature: feat: hash USNs in admin latest sign-ins panel [backend/api/routes/admin.py]
- New feature: feat(leaderboard): group by 4-day check-in windows and add year filter [backend/api/routes/leaderboard.py]
- Merge: Merge branch 'feat/feedback-and-zinc-theme'
- New feature: feat(leaderboard): limit year filter to all years or own year [backend/api/routes/leaderboard.py]

## Key files
- `backend/.env.example`
- `backend/api/config.py`
- `backend/api/routes/admin.py`
- `backend/api/oauth.py`
- `backend/README.md`
- `backend/alembic/versions/b1d47e2a9c05_drop_derived_attendance_metrics.py`
- `backend/api/metrics.py`
- `backend/api/models.py`
- `backend/api/routes/scrape.py`
- `backend/api/schemas.py`
- `backend/portal_client.py`
- `backend/alembic/versions/e3f6a91c2d84_add_attendance_history.py`
- `backend/api/routes/fetch_attendance.py`
- `frontend/src/api.js`
- `frontend/src/components/AttendanceSummary.jsx`
- `frontend/src/index.css`
- `.gitignore`
- `frontend/src/App.jsx`
- `frontend/src/components/BetaBanner.jsx`
- `frontend/src/components/Changelog.jsx`

## Open questions
- None logged yet.
