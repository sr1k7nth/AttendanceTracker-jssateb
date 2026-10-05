import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApprove, adminListPending, adminReject, fetchAdminScreenshot } from '../api';

// Hidden review queue — reachable only during a panel-credential session
// (the panel username/password typed on the ordinary login page; App gates
// the menu item and this tab on that session). API calls still need BOTH
// the panel password and the admin JWT — the session just pre-fills them.
export default function AdminPanel({ onLock }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [creds, setCreds] = useState(null); // { user, pass } once unlocked
  const [pending, setPending] = useState([]);
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

  async function act(fn, id, ...args) {
    setBusyId(id);
    setError('');
    try {
      await fn(id, ...args, creds.user, creds.pass);
      await load(creds);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
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

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h2>Pending proofs</h2>
        <button className="btn" onClick={() => load(creds)} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && !pending.length ? (
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
                      if (!window.confirm('Reject this donation proof?')) return;
                      act((id, u, p) => adminReject(id, u, p), row.id);
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
          replaceShots({});
          if (onLock) onLock();
        }}
      >
        Lock panel
      </button>
    </div>
  );
}
