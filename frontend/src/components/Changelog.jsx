const versions = [
  {
    version: 'v2.0',
    date: 'Sep 10, 2026',
    title: 'Infrastructure Upgrade',
    changes: [
      'Backend migrated from Render to AWS EC2 (faster response, no cold start spin-down)',
      'Auto-deploy via GitHub Actions on push to main',
      'Database migrated with zero data loss',
    ],
  },
  {
    version: 'v1.2',
    date: 'Sep 10, 2026',
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
    date: 'Sep 10, 2026',
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
    date: 'Sep 10, 2026',
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

export default function Changelog({ onBack, loggedIn }) {
  return (
    <div className="changelog-page">
      <button className="back-btn" onClick={onBack}>
        &larr; Back
      </button>
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
