import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLogin }) {
  const [usn, setUsn] = useState(() => localStorage.getItem('usn') || '');
  const [password, setPassword] = useState('');
  const [leaderboardOpt, setLeaderboardOpt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!usn || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(usn, password, leaderboardOpt);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Fetch Attendance</h2>
      <p>Enter your college portal credentials. Password is used once and not stored.</p>

      <div className="form-group">
        <label htmlFor="usn">USN</label>
        <input
          id="usn"
          type="text"
          placeholder="JS240000"
          value={usn}
          onChange={(e) => setUsn(e.target.value.toUpperCase())}
          autoComplete="username"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="College portal password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="leaderboard"
          checked={leaderboardOpt}
          onChange={(e) => setLeaderboardOpt(e.target.checked)}
        />
        <label htmlFor="leaderboard">Show me on the leaderboard</label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Fetching...' : 'Fetch'}
      </button>

      {error && <p className="error-msg">{error}</p>}
    </form>
  );
}
