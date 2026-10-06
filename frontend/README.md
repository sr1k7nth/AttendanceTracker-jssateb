# Attendance Tracker — Frontend

React + Vite frontend for the JSSATEB Attendance Tracker.

## Features

- Dark/light theme toggle (persisted in localStorage)
- Landing page with tagline and Login button (returning users skip to the form)
- Login form with USN, password, alias, leaderboard opt-in, terms acceptance
- Loading spinner with a "second or two" wait note while the scraper replays
  the portal's login and attendance requests over HTTP
- Nav menu (☰) — FAQ, Terms and Changelog tucked out of the navbar
- Weekly timetable grid (present / absent / upcoming per period)
- Subject-wise attendance table (#, Code, Subject, Classes, Present, %)
- Stats grid (Overall %, Can miss 85%/75%, Must attend 85%/75%) and an
  Update button (re-scrape via a fresh login, no daily quota)
- Custom attendance calculator (enter any target %)
- Leaderboard with branch filter and IST timestamps
- Supporters wall — month-wise cards, Anonymous donors included
- Donate page — UPI QR + form (name, amount, public message, private note,
  screenshot upload)
- Donation popup — nudge on app opens 1, 3, 6, 9, 12… (max once a day; never
  shown to supporters) with the monthly ₹500 progress bar
- Supporter ★ badge (gold) beside names on the leaderboard
- Back navigation on every page except the Summary tab
- Changelog page
- Admin panel — donation review queue (pending proofs, approve / reject,
  screenshot preview) behind a separate panel credential
- Beta banner with feedback link (Google Form)
- Terms & Conditions page
- FAQ page
- localStorage caching (instant load on return visits)
- Update button — re-scrapes by sending you back to the login form
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
│   ├── App.jsx              # Main app: tabs, theme, auth flow, caching, popup cadence
│   ├── api.js               # API layer (fetch wrapper)
│   ├── config.js            # App constants
│   ├── index.css            # All styles (dark/light theme)
│   ├── App.css              # Spare styles — not imported; index.css is the stylesheet
│   ├── main.jsx             # Entry point
│   ├── assets/              # Images and SVGs
│   └── components/
│       ├── Landing.jsx      # Landing page (tagline + Login)
│       ├── Login.jsx        # Login form + terms checkbox + spinner
│       ├── AttendanceSummary.jsx  # Stats, calculator, timetable, subject table
│       ├── Timetable.jsx    # Weekly period grid
│       ├── Leaderboard.jsx  # Ranked list with branch filter + timestamps
│       ├── Supporters.jsx   # Supporters wall (month-wise cards)
│       ├── Support.jsx      # Donate page (UPI QR + upload form)
│       ├── DonationPopup.jsx # Support nudge popup
│       ├── ProgressBar.jsx  # Monthly goal bar
│       ├── Changelog.jsx    # Version history
│       ├── Faq.jsx          # FAQ page
│       ├── Terms.jsx        # Terms & Conditions page
│       ├── AdminPanel.jsx   # Donation review (approve / reject)
│       └── BetaBanner.jsx   # Beta notice with feedback link
├── public/
│   ├── upi-qr.jpg           # UPI QR shown on the Donate page
│   ├── icons.svg
│   └── favicon.svg          # Green checkmark on dark bg
├── index.html
├── vite.config.js           # Dev proxy to API backend
└── package.json
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend public URL; empty = same-origin. Read at **build time**, so set it wherever the build runs (e.g. Vercel dashboard) |

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies API calls
(`/scraper/*`, `/fetch_attendance/*`, `/leaderboard/*`, `/supporters/*`,
`/donations/*`) to the backend on `http://127.0.0.1:8000`.

## Build

```bash
npm run build
```

Output goes to `dist/` (including `public/` assets such as `upi-qr.jpg`).
Vercel auto-deploys from the `frontend/` directory on push to `main`.

## API Integration

All API calls go through `src/api.js`:

| Function | Endpoint | Method |
|----------|----------|--------|
| `login(usn, password, leaderboardOpt, alias)` | `/scraper/login` | POST |
| `fetchAttendance()` | `/fetch_attendance/` | GET |
| `fetchLeaderboard(sort, branch)` | `/leaderboard` | GET |
| `fetchSupporters()` | `/supporters` | GET |
| `fetchProgress()` | `/supporters/progress` | GET |
| `submitDonation(formData)` | `/donations` | POST |
| `adminListPending(user, pass)` | `/admin/donations/pending` | GET |
| `adminApprove(id, amount, user, pass)` | `/admin/donations/{id}/approve` | POST |
| `adminReject(id, user, pass)` | `/admin/donations/{id}/reject` | POST |
| `fetchAdminScreenshot(id, user, pass)` | `/admin/donations/{id}/screenshot` | GET (blob) |
| `getToken()` | — | reads localStorage |
| `getTokenPayload()` | — | decodes the JWT without verifying it |
| `logout()` | — | clears localStorage |

Admin calls send **two** credentials: the normal `Authorization: Bearer` JWT
plus `X-Admin-Auth` (base64 panel `user:pass`), because the `Authorization`
header can only carry one scheme.

## State Management

- **`loggedIn`** — derived from JWT in localStorage
- **`attendance`** — initialized from localStorage cache, updated from API
- **Password** — never stored anywhere; sent once per login and dropped. Updating attendance means logging in again. A legacy `sessionPassword` key is cleared on startup.
- **`panel_creds`** — sessionStorage only, set solely by an admin-panel login. That's why the admin tab never appears for a normal visit or in another tab.
- **`theme`** — localStorage (`dark` / `light`)
- **`termsAccepted`** — localStorage (persists across sessions)
- **`leaderboardOpt`** — localStorage (persists across sessions)
- **Popup cadence** — `app_opens` (open counter) and `popup_shown_date`
  (once-per-day gate) in localStorage; supporters never see the popup

## Deployment

- **Platform:** Vercel
- **Root directory:** `frontend`
- **Env var:** `VITE_API_URL` = the backend's public URL (e.g. `https://jatracker-api.foo.ng`)
- **Custom domain:** `jatracker.foo.ng` via foo-ng
- **Auto-deploy:** Push to `main` triggers rebuild
