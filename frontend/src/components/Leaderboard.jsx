import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api';

export default function Leaderboard({ myBranch, myUsn }) {
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('desc');
  const [branch, setBranch] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
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

  // Pin current user to top
  const myIndex = users.findIndex((u) => u.usn === myUsn);
  const sorted = myIndex > 0
    ? [users[myIndex], ...users.filter((u) => u.usn !== myUsn)]
    : users;

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
        {sorted.map((u, i) => {
          const ist = new Date(u.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          const isMe = u.usn === myUsn;
          const isPinned = isMe && i === 0;
          const rank = isPinned ? myIndex + 1 : (i <= myIndex ? i : i + 1);
          return (
            <li key={u.usn} className={`leaderboard-row${isPinned ? ' leaderboard-me' : ''}`}>
              <span className="leaderboard-rank">{rank}</span>
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
    </div>
  );
}
