# Attendance Tracker — Frontend

React + Vite frontend for the JSSATEB Attendance Tracker.

## Features

- Dark/light theme toggle (persisted in localStorage)
- Login form with USN, password, alias, leaderboard opt-in, terms acceptance
- Loading spinner with "20-25 seconds" wait note during scraping
- Subject-wise attendance table (#, Code, Subject, Classes, Present, %)
- Stats grid (Overall %, Can miss 85%/75%, Must attend 85%/75%)
- Custom attendance calculator (enter any target %)
- Leaderboard with branch filter and IST timestamps
- Beta banner with feedback link (Google Form)
- Terms & Conditions page
- FAQ page
- localStorage caching (instant load on return visits)
- Hybrid refresh (session password or redirect to login)
- Sticky footer

## Tech Stack

| Component | Tech |
|-----------|------|
| Framework | React 19 |
| Build | Vite |
| Styling | Vanilla CSS (CSS custom properties) |
| Hosting | Vercel |
| Domain | `jatracker.foo.ng` |

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx              # Main app: tabs, theme, auth flow, caching
│   ├── api.js               # API layer (fetch wrapper)
│   ├── index.css            # All styles (dark/light theme)
│   ├── main.jsx             # Entry point
│   └── components/
│       ├── Login.jsx        # Login form + terms checkbox + spinner
│       ├── AttendanceSummary.jsx  # Stats, calculator, subject table
│       ├── Leaderboard.jsx  # Ranked list with branch filter + timestamps
│       ├── Faq.jsx          # FAQ page
│       ├── Terms.jsx        # Terms & Conditions page
│       └── BetaBanner.jsx   # Beta notice with feedback link
├── public/
│   └── favicon.svg          # Green checkmark on dark bg
├── index.html
├── vite.config.js           # Dev proxy to Render backend
└── package.json
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (empty for same-origin, full URL for dev proxy) |

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies API calls (`/scraper/*`, `/fetch_attendance/*`, `/leaderboard/*`) to `https://attendance-backend-8gyf.onrender.com`.

## Build

```bash
npm run build
```

Output goes to `dist/`. Vercel auto-deploys from the `frontend/` directory on push to `main`.

## API Integration

All API calls go through `src/api.js`:

| Function | Endpoint | Method |
|----------|----------|--------|
| `login(usn, password, leaderboardOpt, alias)` | `/scraper/login` | POST |
| `refreshAttendance(password)` | `/scraper/refresh` | POST |
| `fetchAttendance()` | `/fetch_attendance/` | GET |
| `fetchLeaderboard(sort, branch)` | `/leaderboard` | GET |
| `getToken()` | — | reads localStorage |
| `logout()` | — | clears localStorage |

## State Management

- **`loggedIn`** — derived from JWT in localStorage
- **`attendance`** — initialized from localStorage cache, updated from API
- **`sessionPassword`** — page memory only; cleared on reload, tab close, or logout. Legacy sessionStorage passwords are removed on app startup. After a reload, refreshing attendance redirects to login.
- **`theme`** — localStorage (`dark` / `light`)
- **`termsAccepted`** — localStorage (persists across sessions)
- **`leaderboardOpt`** — localStorage (persists across sessions)

## Deployment

- **Platform:** Vercel
- **Root directory:** `frontend`
- **Env var:** `VITE_API_URL=https://attendance-backend-8gyf.onrender.com`
- **Custom domain:** `jatracker.foo.ng` via foo-ng
- **Auto-deploy:** Push to `main` triggers rebuild
