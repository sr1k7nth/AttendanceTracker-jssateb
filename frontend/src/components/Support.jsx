import { useEffect, useRef, useState } from 'react';
import { fetchProgress, submitDonation } from '../api';
import { UPI_ID } from '../config';
import ProgressBar from './ProgressBar';

function loadImageEl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

// Shrink to ~1200px longest edge and re-encode as JPEG (q≈0.82) on-device —
// keeps uploads small (server also caps at 5 MB) and saves mobile data.
async function compressImage(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Attach an image file (screenshot of the payment).');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageEl(url);
    const MAX = 1200;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) throw new Error('Could not process that image.');
    return new File([blob], 'screenshot.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Support({ loggedIn, onLoginRequired }) {
  const [progress, setProgress] = useState(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('alias') || '');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProgress()
      .then(setProgress)
      .catch(() => {});
  }, []);

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
    } catch {
      // fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = UPI_ID;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setResult('');
    const trimmed = name.trim();
    const amt = parseInt(amount, 10);
    if (!trimmed) {
      setFormError('Enter your name.');
      return;
    }
    if (!amt) {
      setFormError('Enter the amount you paid.');
      return;
    }
    if (!file) {
      setFormError('Attach a screenshot of the payment.');
      return;
    }
    setSubmitting(true);
    try {
      const jpg = await compressImage(file);
      const fd = new FormData();
      // Name is always required (admin needs to know who paid); the
      // `anonymous` flag only masks it on the public wall.
      fd.append('name', trimmed);
      fd.append('amount', String(amt));
      fd.append('message', message.trim());
      fd.append('admin_note', adminNote.trim());
      fd.append('anonymous', String(anonymous));
      fd.append('screenshot', jpg);
      const res = await submitDonation(fd);
      setResult(res.message || 'Submitted! Thanks.');
      setMessage('');
      setAdminNote('');
      setAmount('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchProgress().then(setProgress).catch(() => {});
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="support-page">
      <h2>Donate</h2>
      <p className="support-intro">
        Running this thing isn't free 🙏 Servers and the portal automation cost money
        every month. If JA-Tracker helped you out, consider chipping in, it keeps the
        lights on.
      </p>

      <h3 className="section-title">How your support helps</h3>
      <ul className="perk-list">
        <li>Covers the monthly server and hosting bills that keep JA-Tracker online.</li>
        <li>
          Pays for the portal automation infrastructure that powers every refresh.
          Each refresh burns RAM on the server to scrape the attendance data.
        </li>
        <li>Keeps the app free and ad-free for everyone, with no data ever sold.</li>
        <li>Funds small extras so the project can keep improving.</li>
      </ul>

      <h3 className="section-title">Supporter perks</h3>
      <ul className="perk-list">
        <li>
          <strong>★ badge</strong> on the Leaderboard, so everyone knows you back the
          project.
        </li>
        <li>
          <strong>Your name on the Supporters wall</strong> (or Anonymous, your
          choice), month-wise with everyone else.
        </li>
        <li>
          <strong>Our gratitude</strong> and a say in what gets built next.
        </li>
      </ul>

      {progress && (
        <ProgressBar
          raised={progress.month_raised}
          goal={progress.goal}
          count={progress.month_count}
        />
      )}

      <h3 className="section-title">Pay via UPI</h3>
      <div className="upi-card">
        <img src="/upi-qr.jpg" alt="UPI QR code (scan to pay)" className="upi-qr" />
        <div className="upi-details">
          <span className="upi-label">UPI ID</span>
          <div className="upi-id-row">
            <code className="upi-id">{UPI_ID}</code>
            <button
              type="button"
              className={`copy-btn${copied ? ' copied' : ''}`}
              onClick={copyUpi}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="upi-hint">Scan with any UPI app, or pay to this ID directly.</p>
        </div>
      </div>

      <h3 className="section-title">Send your proof</h3>
      {!loggedIn ? (
        <div className="login-nudge">
          <p>
            The proof form is tied to your account so your supporter perks can
            activate on it.
          </p>
          <button type="button" className="btn btn-primary" onClick={onLoginRequired}>
            Log in to continue
          </button>
        </div>
      ) : (
        <form className="donate-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="donate-name">
              Name <span className="optional">(required)</span>
            </label>
            <input
              id="donate-name"
              type="text"
              maxLength={30}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="form-hint">
              Your name is only shown if you tick "Show me as Anonymous" below;
              the admin always sees it to verify your payment.
            </p>
          </div>
          <div className="form-group">
            <label htmlFor="donate-amount">Amount paid (₹)</label>
            <input
              id="donate-amount"
              type="number"
              min={1}
              max={10000}
              placeholder="20"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="donate-message">
              Message <span className="optional">(optional)</span>
            </label>
            <input
              id="donate-message"
              type="text"
              maxLength={200}
              placeholder="Say something nice"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="form-hint">Shown on the Supporters wall.</p>
          </div>
          <div className="form-group">
            <label htmlFor="donate-note">
              Message to admin <span className="optional">(optional)</span>
            </label>
            <input
              id="donate-note"
              type="text"
              maxLength={200}
              placeholder="Anything only the admin should know"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <p className="form-hint">
              Kept private. Never shown on the Supporters wall.
            </p>
          </div>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="donate-anon"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <label htmlFor="donate-anon">Show me as Anonymous</label>
          </div>
          <div className="form-group">
            <label htmlFor="donate-shot">Payment screenshot</label>
            <input
              id="donate-shot"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <p className="form-hint">
            The screenshot is resized on your device before upload (server caps at
            5 MB, PNG/JPEG only).
          </p>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Sending...' : 'Submit proof'}
          </button>
          {formError && <p className="form-error">{formError}</p>}
          {result && <p className="form-note success">{result}</p>}
        </form>
      )}
    </div>
  );
}
