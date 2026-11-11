const versions = [
  {
    version: 'v2.6.1',
    date: 'Nov 9, 2026',
    title: 'Feedback, replies & polish',
    changes: [
      'In-app feedback page with four types — Feedback, Error (screenshot required), Feature request, Data removal (dashboard screenshot required) — capped at 3 per day',
      'Admin replies now arrive as a banner on your Summary page, so you see the answer without checking the feedback inbox',
      'Error screens now have a one-tap "Report it" that opens feedback preset to Error',
      'Two-day attendance history graph — logins plot your overall percent over time, with a new draw-on animation',
      'Navbar cleanup — Donate is now a green CTA, GitHub links green everywhere, footer keeps just the secondary links',
      'Fresh design: zinc monochrome + single green accent, hatched section dividers, Manrope/Bricolage Type, green Update/Fetch/Calculate buttons and a green Donate plate',
      'Smarter buttons everywhere — primary actions are grey and turn inverted (white/dark) only on hover, with readable text in both states',
      'Google auth now skips the landing page and goes straight to the app',
      'Bug fix: refreshing the page no longer drops you on the login screen',
    ],
  },
  {
    version: 'v2.6',
    date: 'Nov 9, 2026',
    title: 'Weekly History & Smarter Calculators',
    changes: [
      'Weekly attendance history — ‹ › arrows flip through past weeks; logins keep accumulating automatically',
      '"What if I miss X classes?" calculator — overall and inside every subject dropdown',
      'Smarter stats — "Can miss at 85%" and "Need to attend at 75%" only appear when meaningful',
      'Donation review flow — Approved/Rejected tabs in the admin panel with reasons; donors see a banner when their donation is reviewed',
      'Leaderboard refreshed — latest 3-day window, 20 per page',
    ],
  },
  {
    version: 'v2.5',
    date: 'Oct 17, 2026',
    title: 'Targets & Trends',
    changes: [
      'Attendance over time — a graph plotting your overall percent at every login',
      'Per-subject calculator — any subject row opens a custom target-% calculator',
      'Supporters wall shows full names — long ones wrap instead of cutting off',
    ],
  },
  {
    version: 'v2.4',
    date: 'Oct 6, 2026',
    title: 'Refresh Becomes Update',
    changes: [
      'The Refresh button is now Update — no more separate refresh route; logging in is the only way to re-read the portal',
      'The password is dropped the moment it is sent — never stored anywhere',
      'FAQ, Terms and Support copy updated to match',
    ],
  },
  {
    version: 'v2.3',
    date: 'Oct 5, 2026',
    title: 'Plain-HTTP Scraper',
    changes: [
      'Scrapes run over plain HTTP instead of a headless browser — logins take ~1s instead of 3–4s',
      'No more refresh limits — refresh as often as you like, at any hour',
    ],
  },
  {
    version: 'v2.2',
    date: 'Sep 30, 2026',
    title: 'Supporters & Donations',
    changes: [
      'Donate page — UPI QR + copy button, proof upload, live progress bar toward the ₹500 goal',
      'Supporters wall — month-wise cards of everyone who chipped in',
      'Supporter perks — extra daily refreshes and a ★ badge on the leaderboard',
      'One-a-day donation nudge popup for regulars',
    ],
  },
  {
    version: 'v2.1',
    date: 'Sep 22, 2026',
    title: 'Landing Page & Polish',
    changes: [
      'Landing page with tagline and Login button',
      'Nav menu (☰) — FAQ, Terms, Changelog tucked away',
      'Leaderboard pagination — 10 per page with Prev/Next',
      'Stats restructured — Overall on top, Can miss / Need to attend in one row',
    ],
  },
  {
    version: 'v2.0',
    date: 'Sep 9-10, 2026',
    title: 'Infrastructure Upgrade',
    changes: [
      'Backend moved from Render to AWS EC2 — faster, no cold starts',
      'Auto-deploy via GitHub Actions on push to main',
      'Zero-downtime database migration',
    ],
  },
  {
    version: 'v1.2',
    date: 'Sep 8-9, 2026',
    title: 'Leaderboard Identity',
    changes: [
      'Alias support for the leaderboard',
      'Current user highlighted; "Portal ID" label (was "USN")',
    ],
  },
  {
    version: 'v1.1',
    date: 'Sep 6-7, 2026',
    title: 'Polish & UX',
    changes: [
      'FAQ and Terms pages',
      'Attendance cached in localStorage for instant return visits',
      'Custom favicon (green checkmark)',
    ],
  },
  {
    version: 'v1.0',
    date: 'Sep 5-6, 2026',
    title: 'Initial Release',
    changes: [
      'Login with college portal credentials',
      'Subject-wise breakdown with percentages',
      'Overall stats (85% / 75% thresholds) + custom calculator',
      'Leaderboard with branch filtering',
      'Dark / light theme toggle',
    ],
  },
];

export default function Changelog() {
  return (
    <div className="changelog-page">
      <h2>Changelog</h2>
      <div className="changelog-list">
        {versions.map((v) => (
          <div key={v.version} className="changelog-entry">
            <div className="changelog-header">
              <span className="changelog-version">{v.version}</span>
              <span className="changelog-date">{v.date}</span>
            </div>
            <h3 className="changelog-title">{v.title}</h3>
            <ul className="changelog-changes">
              {v.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
