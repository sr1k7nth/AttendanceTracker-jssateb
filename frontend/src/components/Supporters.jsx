import { useEffect, useState } from 'react';
import { fetchSupporters } from '../api';

// Group by month (IST, matching the rest of the app) while keeping the
// backend's newest-first order.
function buildGroups(supporters) {
  const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const fmtLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  });
  const groups = [];
  const byKey = new Map();
  for (const s of supporters) {
    const d = new Date(s.created_at);
    const key = fmtKey.format(d).slice(0, 7); // YYYY-MM
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: fmtLabel.format(d), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(s);
  }
  return groups;
}

export default function Supporters({ onDonate }) {
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSupporters()
      .then(setSupporters)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const groups = buildGroups(supporters);

  return (
    <div className="supporters-page">
      <h2>Supporters</h2>
      <p className="supporters-intro">
        People who chipped in to keep JA-Tracker running 🙏
      </p>

      {loading ? (
        <p className="loading">Loading supporters...</p>
      ) : error ? (
        <p className="error-msg">{error}</p>
      ) : !supporters.length ? (
        <div className="empty-state">
          <p>No supporters yet. Be the first.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            <h3 className="section-title">{group.label}</h3>
            <ul className="supporters-list">
              {group.items.map((s, i) => (
                <li key={`${group.key}-${i}`} className="supporter-card">
                  <div className="supporter-card-head">
                    <span className="supporter-avatar" aria-hidden="true">
                      {s.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="supporter-name">{s.name}</span>
                  </div>
                  {s.message && (
                    <span className="supporter-msg">{s.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="supporters-donate">
        <button className="btn btn-primary btn-shine" onClick={onDonate}>
          Donate
        </button>
      </div>
    </div>
  );
}
