import { useEffect, useState } from 'react';
import { fetchProgress } from '../api';
import ProgressBar from './ProgressBar';

// One-time nudge on logged-in opens 1, 3, 6, 9, 12… (cadence + once-per-day
// gate are enforced by App — this component only renders what App shows).
// Amounts are only MENTIONED here, never buttons — buttons would imply
// clicking one starts a payment of that exact amount.
export default function DonationPopup({ onClose, onSupport }) {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    fetchProgress()
      .then(setProgress)
      .catch(() => {}); // progress is a nice-to-have here
  }, []);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-card"
        role="dialog"
        aria-modal="true"
        aria-label="Support JA-Tracker"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className="popup-title">Running this thing isn't free 🙏</h3>
        <p className="popup-body">
          Servers and the portal automation cost me money every month, so I can't
          promise JA-Tracker stays online forever. If you'd like it to stick around,
          you can support the project.
        </p>

        {progress && (
          <ProgressBar
            raised={progress.month_raised}
            goal={progress.goal}
            count={progress.month_count}
          />
        )}

        <p className="popup-hint">
          Please support with ₹20 or more. Most people chip in ₹20, ₹50 or ₹100.
        </p>
        <button className="btn btn-primary popup-support btn-shine" onClick={onSupport}>
          Support the project
        </button>
        <button className="popup-later" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
