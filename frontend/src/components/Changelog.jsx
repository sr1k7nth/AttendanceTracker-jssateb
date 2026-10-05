const versions = [
  {
    version: 'v2.3',
    date: 'Oct 5, 2026',
    title: 'Plain-HTTP Scraper',
    changes: [
      'New scraper: the portal’s login and attendance pages are now fetched directly over plain HTTP instead of driving a headless browser — logins and refreshes take about a second instead of three or four',
      'No more refresh limits: the daily quota and the 2-hour cache wait are gone, so you can refresh as often as you like, at any hour',
      'The old supporter perk of 6 extra refreshes a day is retired — everyone is unlimited now; the ★ badge and the Supporters wall still mark who backs the project',
      'Server runs on a fraction of the memory it used to, since no browser is launched per scrape',
    ],
  },
  {
    version: 'v2.2',
    date: 'Sep 30, 2026',
    title: 'Supporters & Donations',
    changes: [
      'Donate page: pay by UPI (QR code + copy button) with a live progress bar toward the ₹500 monthly goal',
      'Donation form: name, amount, payment screenshot, an optional message shown on the Supporters wall, and an optional private note only the admin sees',
      'Supporters wall: month-wise card grid of everyone who chipped in (Anonymous donors included)',
      'Supporter perks: 6 attendance refreshes a day (standard is 4), plus a ★ badge beside your name on the leaderboard',
      'One-a-day donation nudge popup for regulars, never shown to supporters or first-time visitors',
      'Back button in the navbar on every page except Summary, with Supporters listed beside Leaderboard',
      'Leaderboard sorted by latest check-in, then percentage',
      'Monochrome dark/light theme with a slate-blue accent',
      'Weekly timetable with a sticky day column, shown above Subject-wise attendance',
      'Terms updated with the donation and supporter-perk clauses',
    ],
  },
  {
    version: 'v2.1',
    date: 'Sep 22, 2026',
    title: 'Landing Page & Polish',
    changes: [
      'Landing page with tagline and Login button (returning users skip straight to the form)',
      'Nav menu button (☰) — FAQ, Terms, Changelog tucked out of the navbar',
      'Leaderboard pagination — 10 users per page with Prev/Next',
      'JATracker branding — new navbar title, pastel blue accent on landing',
      'Stats restructured — Overall on top, Can miss / Need to attend each in one row',
      'Custom target section scaled up for easier tapping',
      'Darker theme background (#131310) with matching surfaces',
    ],
  },
  {
    version: 'v2.0',
    date: 'Sep 9-10, 2026',
    title: 'Infrastructure Upgrade',
    changes: [
      'Backend migrated from Render to AWS EC2 (faster response, no cold start spin-down)',
      'Auto-deploy via GitHub Actions on push to main',
      'Database migrated with zero data loss',
    ],
  },
  {
    version: 'v1.2',
    date: 'Sep 8-9, 2026',
    title: 'Leaderboard Identity',
    changes: [
      'Alias support for leaderboard (optional, required when opted in)',
      'Current user highlighted in leaderboard',
      'Server-side ranking',
      '"Portal ID" label (was "USN")',
      'Community contribution: security patches and alias feature (PR #1 by ManojK2K06)',
    ],
  },
  {
    version: 'v1.1',
    date: 'Sep 6-7, 2026',
    title: 'Polish & UX',
    changes: [
      'FAQ page with common questions',
      'Terms & Conditions page with login consent checkbox',
      'Beta feedback banner (Google Form)',
      'Attendance data cached in localStorage for instant return visits',
      'Refresh button with rate limit display (4/day)',
      'Custom favicon (green checkmark)',
    ],
  },
  {
    version: 'v1.0',
    date: 'Sep 5-6, 2026',
    title: 'Initial Release',
    changes: [
      'Login with college portal credentials',
      'Subject-wise attendance breakdown with percentages',
      'Overall attendance stats (85% / 75% thresholds)',
      'Custom attendance calculator',
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
