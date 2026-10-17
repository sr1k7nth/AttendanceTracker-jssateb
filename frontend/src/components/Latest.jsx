import { useCallback, useEffect, useState } from 'react';
import { adminListLatest } from '../api';
import SupporterBadge from './SupporterBadge';

// The admin's view over the attendance table: who re-scraped the portal
// lately, newest first. Reachable only from the admin-gated menu (App shows
// it when sessionStorage.panel_creds exists); the API itself still demands
// BOTH the admin JWT and the panel password in X-Admin-Auth.

// Read once per mount — the same session AdminPanel pre-unlocks from.
// A missing session renders as a derived message below, never as state set
// from the effect (the fetch only starts when credentials exist).
function readCreds() {
  try {
    const c = JSON.parse(sessionStorage.getItem('panel_creds'));
    return c && c.user && c.pass ? c : null;
  } catch {
    return null;
  }
}

function fmtIST(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function pctClass(avg) {
  if (avg == null) return '';
  return avg >= 85 ? 'high' : avg >= 75 ? 'mid' : 'low';
}

export default function Latest() {
  const [creds] = useState(readCreds);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!creds);
  const [error, setError] = useState('');

  // First setState happens only inside .then callbacks, so mounting never
  // triggers a synchronous render cascade.
  const load = useCallback(() => {
    if (!creds) return Promise.resolve();
    return adminListLatest(creds.user, creds.pass)
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [creds]);

  useEffect(() => {
    load();
  }, [load]);

  function refresh() {
    // Event-triggered: sync state updates are fine here
    setLoading(true);
    setError('');
    load();
  }

  if (!creds) {
    return (
      <div className="admin-page">
        <div className="admin-head">
          <h2>Latest sign-ins</h2>
        </div>
        <p className="form-error">
          Panel session missing — log in again with the panel credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h2>Latest sign-ins</h2>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <p className="latest-note">
        Every sign-in, newest first — times in IST.
      </p>
      {error && <p className="form-error">{error}</p>}
      {loading && !rows.length ? (
        <p className="loading">Loading...</p>
      ) : !rows.length ? (
        <div className="empty-state">
          <p>No sign-ins recorded yet.</p>
        </div>
      ) : (
        <div className="latest-scroll">
          <table className="latest-table">
            <thead>
              <tr>
                <th className="latest-no">#</th>
                <th className="latest-usn">USN</th>
                <th className="latest-alias">Alias</th>
                <th className="latest-branch">Branch</th>
                <th className="latest-pct">Avg</th>
                <th className="latest-time">Sign-in (IST)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.usn}>
                  <td className="latest-no">{i + 1}</td>
                  <td className="latest-usn">{r.usn}</td>
                  <td className="latest-alias">
                    {r.alias || '—'}
                    {r.is_supporter && <SupporterBadge />}
                  </td>
                  <td className="latest-branch">
                    {[r.branch, r.sem].filter(Boolean).join(' - ') || '—'}
                  </td>
                  <td className={`latest-pct ${pctClass(r.total_avg)}`}>
                    {r.total_avg != null ? `${r.total_avg}%` : '—'}
                  </td>
                  <td className="latest-time">{fmtIST(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
