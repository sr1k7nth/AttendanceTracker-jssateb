import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../api';

export default function Leaderboard() {
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

  return (
    <div>
      <div className="leaderboard-controls">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="desc">Highest first</option>
          <option value="asc">Lowest first</option>
        </select>
        <select value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="ALL">All branches</option>
          <option value="CSE">CSE</option>
          <option value="ISE">ISE</option>
          <option value="AIML">AIML</option>
          <option value="ECE">ECE</option>
          <option value="EEE">EEE</option>
          <option value="ME">ME</option>
          <option value="CV">CV</option>
          <option value="CH">CH</option>
        </select>
      </div>

      <h3 className="section-title">Rankings</h3>
      <ul className="leaderboard-list">
        {users.map((u, i) => (
          <li key={u.usn} className="leaderboard-row">
            <span className="leaderboard-rank">{i + 1}</span>
            <span className="leaderboard-usn">{u.usn}</span>
            <span className={`attendance-pct ${u.total_avg >= 85 ? 'high' : u.total_avg >= 75 ? 'mid' : 'low'}`}>
              {u.total_avg}%
            </span>
            {u.branch && (
              <span className="leaderboard-branch">{u.branch}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
