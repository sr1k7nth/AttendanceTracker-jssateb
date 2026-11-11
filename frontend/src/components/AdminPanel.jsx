import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApprove,
  adminListFeedback,
  adminListPending,
  adminListReviewed,
  adminReject,
  adminReplyFeedback,
  fetchAdminFeedbackScreenshot,
  fetchAdminScreenshot,
} from '../api';

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['feedback', 'Feedback'],
];

// Hidden review queue — reachable only during a panel-credential session
// (the panel username/password typed on the ordinary login page; App gates
// the menu item and this tab on that session). API calls still need BOTH
// the panel password and the admin JWT — the session just pre-fills them.
export default function AdminPanel({ onLock }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [creds, setCreds] = useState(null); // { user, pass } once unlocked
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [reviewed, setReviewed] = useState({ approved: null, rejected: null });
  const [feedbackRows, setFeedbackRows] = useState(null);
  const [amounts, setAmounts] = useState({}); // id -> editable amount string
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const shotsRef = useRef({}); // id -> objectURL

  function replaceShots(next) {
    Object.values(shotsRef.current).forEach((u) => URL.revokeObjectURL(u));
    shotsRef.current = next;
  }

  const load = useCallback(async (c) => {
    setLoading(true);
    setError('');
    try {
      const rows = await adminListPending(c.user, c.pass);
      setPending(rows);
      setAmounts(Object.fromEntries(rows.map((r) => [r.id, String(r.amount)])));
      const urls = {};
      await Promise.all(
        rows.map(async (r) => {
          try {
            urls[r.id] = URL.createObjectURL(
              await fetchAdminScreenshot(r.id, c.user, c.pass)
            );
          } catch {
            // thumbnail optional — the full-size link will surface errors
          }
        })
      );
      replaceShots(urls);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviewed = useCallback(async (c, status, force = false) => {
    setReviewed((r) => ({ ...r, [status]: force ? null : r[status] ?? null }));
    setLoading(true);
    setError('');
    try {
      const rows = await adminListReviewed(status, c.user, c.pass);
      setReviewed((r) => ({ ...r, [status]: rows }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async (c, force = false) => {
    setFeedbackRows((r) => (force ? null : r ?? null));
    setLoading(true);
    setError('');
    try {
      const rows = await adminListFeedback(c.user, c.pass);
      setFeedbackRows(rows);
      // thumbnails for submissions that carry a screenshot
      const urls = {};
      await Promise.all(
        rows
          .filter((r) => r.screenshot_url)
          .map(async (r) => {
            try {
              urls[r.id] = URL.createObjectURL(
                await fetchAdminFeedbackScreenshot(r.id, c.user, c.pass)
              );
            } catch {
              // preview optional
            }
          })
      );
      replaceShots(urls);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pre-unlock from the panel session created at the login page; the form
  // below stays as a fallback if no session was carried over.
  useEffect(() => {
    const raw = sessionStorage.getItem('panel_creds');
    if (raw) {
      try {
        const c = JSON.parse(raw);
        load(c).then((ok) => {
          if (ok) setCreds(c);
        });
      } catch {
        // corrupted session — fall back to the unlock form
      }
    }
    return () => replaceShots({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function handleUnlock(e) {
    e.preventDefault();
    const c = { user: user.trim(), pass };
    if (!c.user || !c.pass) return;
    const ok = await load(c);
    if (ok) setCreds(c);
  }

  function switchTab(next) {
    setTab(next);
    if (next === 'feedback') {
      if (creds && feedbackRows === null) loadFeedback(creds);
    } else if (next !== 'pending' && creds && reviewed[next] === null) {
      loadReviewed(creds, next);
    }
  }

  async function act(fn, id, ...args) {
    setBusyId(id);
    setError('');
    try {
      await fn(id, ...args, creds.user, creds.pass);
      await load(creds);
      // the reviewed lists just changed — drop their caches
      setReviewed({ approved: null, rejected: null });
      if (tab === 'feedback') loadFeedback(creds, true);
      else if (tab !== 'pending') loadReviewed(creds, tab, true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function rejectWithReason(row) {
    const reason = window.prompt(
      'Reason for rejection (shown to the donor on their summary page):',
      ''
    );
    if (reason === null) return; // cancelled
    act((id, r, u, p) => adminReject(id, u, p, r), row.id, reason.trim());
  }

  if (!creds) {
    return (
      <div className="admin-page">
        <h2>Admin</h2>
        <form className="admin-unlock" onSubmit={handleUnlock}>
          <p className="form-hint">
            Panel credentials, on top of being logged in as the admin account.
          </p>
          <div className="form-group">
            <label htmlFor="panel-user">Panel user</label>
            <input
              id="panel-user"
              type="text"
              autoComplete="off"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="panel-pass">Panel password</label>
            <input
              id="panel-pass"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Checking...' : 'Unlock'}
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    );
  }

  const rows = tab === 'pending' ? pending : reviewed[tab] || [];

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h2>{tab === 'feedback' ? 'Feedback' : 'Donations'}</h2>
        <button
          className="btn"
          onClick={() =>
            tab === 'pending'
              ? load(creds)
              : tab === 'feedback'
                ? loadFeedback(creds, true)
                : loadReviewed(creds, tab, true)
          }
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-tabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => switchTab(key)}
          >
            {label}
            {key === 'pending' && pending.length > 0 && (
              <span className="admin-tab-count">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === 'feedback' ? (
        loading && !feedbackRows?.length ? (
          <p className="loading">Loading...</p>
        ) : !feedbackRows?.length ? (
          <div className="empty-state">
            <p>No feedback yet.</p>
          </div>
        ) : (
          <ul className="admin-list">
            {feedbackRows.map((row) => (
              <li key={row.id} className="admin-item">
                {shotsRef.current[row.id] && (
                  <div className="admin-shot">
                    <img
                      src={shotsRef.current[row.id]}
                      alt="Feedback attachment"
                      className="admin-thumb"
                    />
                    <a
                      href={shotsRef.current[row.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-fullview"
                    >
                      Full size
                    </a>
                  </div>
                )}
                <div className="admin-info">
                  <div className="admin-meta">
                    <span className={`feedback-cat feedback-cat-${row.category}`}>
                      {row.category === 'data_removal'
                        ? 'Data removal'
                        : row.category === 'feature'
                          ? 'Feature request'
                          : row.category.charAt(0).toUpperCase() + row.category.slice(1)}
                    </span>
                    <span>{row.usn}</span>
                    <span>
                      {new Date(row.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {row.message && <p className="admin-msg">{row.message}</p>}
                  {row.reply && (
                    <p className="admin-note admin-reply-given">
                      Replied: {row.reply}
                    </p>
                  )}
                  {row.last_scraped_at && (
                    <p className="admin-note">
                      Last scrape (proof):{' '}
                      {new Date(row.last_scraped_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}{' '}
                      IST
                    </p>
                  )}
                  <div className="admin-actions">
                    <button
                      className="admin-approve"
                      disabled={busyId === row.id}
                      onClick={() => {
                        const reply = window.prompt(
                          row.reply
                            ? 'Edit your reply (empty clears it):'
                            : 'Reply to this submission (shown to the user on their summary page):',
                          row.reply || ''
                        );
                        if (reply === null) return; // cancelled
                        act(
                          (id, r, u, p) => adminReplyFeedback(id, r, u, p),
                          row.id,
                          reply.trim()
                        );
                      }}
                    >
                      {busyId === row.id ? '...' : row.reply ? 'Edit reply' : 'Reply'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : tab !== 'pending' ? (
        loading && !rows.length ? (
          <p className="loading">Loading...</p>
        ) : !rows.length ? (
          <div className="empty-state">
            <p>Nothing {tab} yet.</p>
          </div>
        ) : (
          <ul className="admin-list">
            {rows.map((row) => (
              <li key={row.id} className="admin-item">
                <div className="admin-info">
                  <div className="admin-meta">
                    <strong>
                      {row.name}
                      {row.anonymous ? ' (anon)' : ''}
                    </strong>
                    <span>{row.usn}</span>
                    <span className="admin-amt-static">₹{row.amount}</span>
                    <span>
                      reviewed{' '}
                      {new Date(
                        row.reviewed_at || row.created_at
                      ).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {row.reject_reason && (
                    <p className="admin-note">Reason: {row.reject_reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : loading && !pending.length ? (
        <p className="loading">Loading...</p>
      ) : !pending.length ? (
        <div className="empty-state">
          <p>All caught up! No pending proofs.</p>
        </div>
      ) : (
        <ul className="admin-list">
          {pending.map((row) => (
            <li key={row.id} className="admin-item">
              <div className="admin-shot">
                {shotsRef.current[row.id] ? (
                  <img src={shotsRef.current[row.id]} alt="Payment proof" className="admin-thumb" />
                ) : (
                  <span className="admin-noimg">no preview</span>
                )}
                {shotsRef.current[row.id] && (
                  <a
                    href={shotsRef.current[row.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-fullview"
                  >
                    Full size
                  </a>
                )}
              </div>
              <div className="admin-info">
                <div className="admin-meta">
                  <strong>
                    {row.name}
                    {row.anonymous ? ' (anon)' : ''}
                  </strong>
                  <span>{row.usn}</span>
                  <span>
                    {new Date(row.created_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                {row.message && <p className="admin-msg">&ldquo;{row.message}&rdquo;</p>}
                {row.admin_note && (
                  <p className="admin-note">Note to admin: {row.admin_note}</p>
                )}
                <div className="admin-actions">
                  <label className="admin-amt-label">
                    ₹
                    <input
                      className="admin-amt"
                      type="number"
                      min={1}
                      max={10000}
                      value={amounts[row.id] ?? row.amount}
                      onChange={(e) =>
                        setAmounts((m) => ({ ...m, [row.id]: e.target.value }))
                      }
                    />
                  </label>
                  <button
                    className="admin-approve"
                    disabled={busyId === row.id}
                    onClick={() => {
                      const v = parseInt(amounts[row.id], 10);
                      if (!v || v < 1 || v > 10000) {
                        setError('Amount must be ₹1–₹10000.');
                        return;
                      }
                      act(
                        (id, correction, u, p) =>
                          adminApprove(id, correction, u, p),
                        row.id,
                        v === row.amount ? null : v
                      );
                    }}
                  >
                    {busyId === row.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className="admin-reject"
                    disabled={busyId === row.id}
                    onClick={() => {
                      rejectWithReason(row);
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        className="faq-back"
        onClick={() => {
          // End the panel session entirely — the menu entry disappears too
          sessionStorage.removeItem('panel_creds');
          setCreds(null);
          setPass('');
          setPending([]);
          setReviewed({ approved: null, rejected: null });
          setTab('pending');
          replaceShots({});
          if (onLock) onLock();
        }}
      >
        Lock panel
      </button>
    </div>
  );
}
