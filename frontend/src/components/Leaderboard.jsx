import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api';

const PAGE_SIZE = 10;

export default function Leaderboard({ myBranch }) {
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('desc');
  const [branch, setBranch] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    setPage(1);
    fetchLeaderboard(sort, branch)
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sort, branch]);

  if (loading) return <p className="loading">Loading leaderboard...</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (!users.length) return (
    <div className="empty-state">
      <p>No users on the leaderboard yet.</p>
    </div>
  );

  // Pin current user
  const myIndex = users.findIndex((u) => u.is_me);
  const sorted = myIndex > 0
    ? [users[myIndex], ...users.filter((u) => !u.is_me)]
    : users;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageUsers = sorted.slice(start, start + PAGE_SIZE);

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
      </div>

      <h3 className="section-title">Rankings</h3>
      <ul className="leaderboard-list">
        {pageUsers.map((u, i) => {
          const ist = new Date(u.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          const isPinned = u.is_me && start + i === 0;
          return (
            <li key={u.rank} className={`leaderboard-row${isPinned ? ' leaderboard-me' : ''}`}>
              <span className="leaderboard-rank">{u.rank}</span>
              {/* Legacy alias fallback */}
              <span className="leaderboard-usn" title={u.alias || 'Anonymous'}>
                {u.alias || 'Anonymous'}
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
