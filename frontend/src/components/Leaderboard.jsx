import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api';
import SupporterBadge from './SupporterBadge';

const PAGE_SIZE = 20;
const YEAR_LABELS = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year' };

function dayLabel(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-IN', opts);
}

function groupLabel(bucket) {
  if (bucket === 0) return 'Latest 4 days';
  if (bucket === 1) return 'Previous 4 days';
  return 'Older check-ins';
}

export default function Leaderboard({ myBranch, mySem }) {
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('desc');
  const [branch, setBranch] = useState('ALL');
  const [year, setYear] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const myYear = mySem ? Math.ceil(mySem / 2) : null;

  useEffect(() => {
    setLoading(true);
    setError('');
    setPage(1);
    // The API groups check-ins into four-day windows, newest first, and ranks
    // people by average attendance inside each window.
    fetchLeaderboard(sort, branch, year === 'ME' ? 'me' : null)
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sort, branch, year]);

  if (loading) return <p className="loading">Loading leaderboard...</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (!users.length) return (
    <div className="empty-state">
      <p>No users on the leaderboard yet.</p>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageUsers = users.slice(start, start + PAGE_SIZE);

  // A four-day window can span two pages, so build the groups from the rows
  // on this page; the header repeats at the top of the next page.
  const groups = [];
  for (const user of pageUsers) {
    const last = groups[groups.length - 1];
    if (!last || last.bucket !== user.bucket) {
      groups.push({
        bucket: user.bucket,
        start: user.window_start,
        end: user.window_end,
        users: [user],
      });
    } else {
      last.users.push(user);
    }
  }

  return (
    <div>
      <div className="leaderboard-controls">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="desc">Highest first</option>
          <option value="asc">Lowest first</option>
        </select>
        <select value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="ALL">All branches</option>
          {myBranch && <option value={myBranch}>{myBranch}</option>}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="ALL">All years</option>
          <option value="ME" disabled={!myYear}>
            {myYear ? `My year (${YEAR_LABELS[myYear] || 'current'})` : 'My year'}
          </option>
        </select>
      </div>

      <h3 className="section-title">Rankings</h3>
      <p className="leaderboard-window">
        Grouped by last check-in, four days per group, newest first
      </p>

      {groups.map((group) => (
        <section key={group.bucket}>
          <div className="leaderboard-bucket">
            <span className="leaderboard-bucket-title">
              {groupLabel(group.bucket)}
            </span>
            <span className="leaderboard-bucket-range">
              {dayLabel(group.start)} – {dayLabel(group.end)}
            </span>
          </div>
          <ul className="leaderboard-list">
            {group.users.map((u) => {
              const ist = new Date(u.timestamp).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              return (
                <li
                  key={`${u.bucket}-${u.rank}`}
                  className={`leaderboard-row${u.is_me ? ' leaderboard-me' : ''}`}
                >
                  <span className="leaderboard-rank">{u.rank}</span>
                  {/* Legacy alias fallback */}
                  <span className="leaderboard-name">
                    <span className="leaderboard-usn" title={u.alias || 'Anonymous'}>
                      {u.alias || 'Anonymous'}
                    </span>
                    {u.is_supporter && <SupporterBadge />}
                  </span>
                  <span className={`attendance-pct ${u.total_avg >= 85 ? 'high' : u.total_avg >= 75 ? 'mid' : 'low'}`}>
                    {u.total_avg}%
                  </span>
                  {u.branch && (
                    <span className="leaderboard-branch">{u.branch}</span>
                  )}
                  <span className="leaderboard-time">{ist}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {totalPages > 1 && (
        <div className="leaderboard-pager">
          <button
            className="pager-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            &larr; Prev
          </button>
          <span className="pager-status">
            {currentPage} / {totalPages}
          </span>
          <button
            className="pager-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
