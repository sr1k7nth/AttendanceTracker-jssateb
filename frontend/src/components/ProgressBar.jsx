// Monthly donation progress — used in the popup and the Support page.
export default function ProgressBar({ raised, goal, count }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span className="progress-raised">₹{raised} raised this month</span>
        <span className="progress-goal">goal ₹{goal}</span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Monthly support goal"
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-sub">
        {pct}% of goal · {count} {count === 1 ? 'supporter' : 'supporters'} this month
      </p>
    </div>
  );
}
