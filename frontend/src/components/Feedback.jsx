import { useEffect, useRef, useState } from 'react';
import { fetchBranches, submitFeedback } from '../api';
import { assertUnderLimit, compressImage } from '../utils/image';

const TYPES = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'error', label: 'Error' },
  { key: 'feature', label: 'Feature request' },
  { key: 'data_removal', label: 'Data removal' },
  { key: 'beta_screenshot', label: 'Beta screenshot' },
];

const NEEDS_SCREENSHOT = ['error', 'data_removal', 'beta_screenshot'];

export default function Feedback({ loggedIn, onLoginRequired, initialCategory }) {
  const [category, setCategory] = useState(
    TYPES.some((t) => t.key === initialCategory) ? initialCategory : 'feedback'
  );
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState('');
  const fileInputRef = useRef(null);

  // last scrape time comes from the cached attendance payload — the server
  // re-stamps it from the DB anyway; this just shows the user what's attached
  let lastScrape = null;
  try {
    const att = JSON.parse(localStorage.getItem('attendance') || 'null');
    if (att?.timestamp) lastScrape = att.timestamp;
  } catch {
    // corrupted cache — no proof line
  }

  const wantsScreenshot = NEEDS_SCREENSHOT.includes(category);

  // beta_screenshot branch picker: server-validated list of known branches
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    if (category !== 'beta_screenshot' || branches.length) return;
    fetchBranches()
      .then((r) => setBranches(r.branches || []))
      .catch(() => setBranches([]));
  }, [category, branches.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setResult('');

    // beta: the branch is the message — validated server-side too
    const finalMessage = category === 'beta_screenshot' ? branch : message;

    if (category !== 'data_removal' && !finalMessage.trim()) {
      setFormError(
        category === 'beta_screenshot'
          ? 'Pick your branch.'
          : 'Write a short message.'
      );
      return;
    }
    if (wantsScreenshot && !file) {
      setFormError(
        category === 'error'
          ? 'Attach a screenshot of the error.'
          : category === 'beta_screenshot'
            ? 'Attach a screenshot of how the site looks for you.'
            : 'Attach a screenshot of your dashboard as proof.'
      );
      return;
    }
    setSubmitting(true);
    try {
      let jpg = null;
      if (file) {
        jpg = await compressImage(file);
        assertUnderLimit(jpg, 'Screenshot');
      }
      const fd = new FormData();
      fd.append('category', category);
      fd.append('message', finalMessage.trim());
      if (jpg) fd.append('screenshot', jpg);
      const res = await submitFeedback(fd);
      setResult(res.message || 'Thanks! Your submission is in.');
      setMessage('');
      setBranch('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      // 429 surfaces the wait, mirroring the login cooldown message
      const secs = Number(err.retryAfter);
      if (err.status === 429) {
        const wait =
          Number.isFinite(secs) && secs > 0
            ? secs < 90
              ? `about ${secs} seconds`
              : `about ${Math.ceil(secs / 60)} minutes`
            : 'a few hours';
        setFormError(`Daily feedback limit reached (3 per day) — try again in ${wait}.`);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="feedback-page">
        <h2>Feedback</h2>
        <div className="login-nudge">
          <p>
            Feedback is tied to your account so the admin can follow up — and so
            data removal requests can actually find your data.
          </p>
          <button type="button" className="btn btn-primary" onClick={onLoginRequired}>
            Log in to continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <h2>Feedback</h2>
      <p className="support-intro">
        Something off, something missing, or something you'd like gone? Pick a
        type and tell the admin.
      </p>

      <form className="donate-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <div className="feedback-types" role="radiogroup" aria-label="Feedback type">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={category === t.key}
                className={`feedback-type${category === t.key ? ' active' : ''}`}
                onClick={() => {
                  setCategory(t.key);
                  setFormError('');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="feedback-message">
            {category === 'beta_screenshot' ? 'Branch' : 'Message'}{' '}
            <span className="optional">
              ({category === 'data_removal' ? 'optional' : 'required'})
            </span>
          </label>
          {category === 'beta_screenshot' ? (
            <>
              <select
                id="feedback-message"
                className="feedback-select"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="">-- pick your branch --</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Your USN is attached automatically. Attach a screenshot of how
                the site looks for your branch — the admin checks it himself
                because he has no credentials for your branch.
              </p>
            </>
          ) : (
            <textarea
              id="feedback-message"
              className="feedback-message"
              maxLength={1000}
              rows={4}
              placeholder={
                category === 'error'
                  ? 'What happened, and which page were you on?'
                  : category === 'feature'
                    ? 'What would you like the app to do?'
                    : category === 'data_removal'
                      ? 'Anything the admin should know (optional)'
                      : 'What did you like, or what could be better?'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          )}
        </div>

        {category === 'data_removal' && (
          <div className="feedback-proof">
            <strong>Proof of identity</strong>
            <p>
              Attach a screenshot of this dashboard. It must show the same data
              tied to your account
              {lastScrape
                ? ` — last scrape: ${new Date(lastScrape).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })} IST`
                : ''}
              . The scrape time is recorded with your request automatically.
            </p>
          </div>
        )}

        {wantsScreenshot && (
          <div className="form-group">
            <label htmlFor="feedback-shot">
              {category === 'error'
                ? 'Error screenshot'
                : category === 'beta_screenshot'
                  ? 'Branch screenshot'
                  : 'Dashboard screenshot'}{' '}
              <span className="optional">(required)</span>
            </label>
            <input
              id="feedback-shot"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="form-hint">
              Resized on your device before upload (server caps at 5 MB, PNG/JPEG only).
            </p>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending...' : 'Submit'}
        </button>
        {formError && <p className="form-error">{formError}</p>}
        {result && <p className="form-note success">{result}</p>}
      </form>
    </div>
  );
}
