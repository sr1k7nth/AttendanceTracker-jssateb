import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLogin, onPassword, onTerms }) {
  const [usn, setUsn] = useState(() => localStorage.getItem('usn') || '');
  const [password, setPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [leaderboardOpt, setLeaderboardOpt] = useState(() => {
    const stored = localStorage.getItem('leaderboard_opt');
    return stored !== null ? JSON.parse(stored) : false;
  });
  const [termsAccepted, setTermsAccepted] = useState(() => {
    const stored = localStorage.getItem('terms_accepted');
    return stored !== null ? JSON.parse(stored) : false;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!usn || !password) return;
    if (!alias.trim()) {
      setError('Enter an alias for the leaderboard.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(usn, password, leaderboardOpt, alias.trim());
      onPassword(password);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Fetch Attendance</h2>
        <p>Enter your college portal credentials. Password is used once and not stored.</p>

        <div className="form-group">
          <label htmlFor="usn">Portal ID</label>
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
          <div className="password-field">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              placeholder="College portal password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="show-pw-btn"
              onClick={() => setShowPw((s) => !s)}
              tabIndex={-1}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="alias">Alias</label>
          <input
            id="alias"
            type="text"
            placeholder="Your leaderboard name"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            autoComplete="nickname"
            maxLength={30}
            required
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

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked);
              localStorage.setItem('terms_accepted', JSON.stringify(e.target.checked));
            }}
          />
          <label htmlFor="terms">
            I agree to the{' '}
            <button type="button" className="terms-link" onClick={onTerms}>
              Terms &amp; Conditions
            </button>
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading || !termsAccepted}>
          {loading ? 'Fetching...' : 'Fetch'}
        </button>

        {loading && (
          <div className="login-loading">
            <div className="spinner" />
            <p>Scraping your attendance data. This may take 20–25 seconds.</p>
          </div>
        )}

        {error && (
          <div className="error-block">
            <p className="error-msg">{error}</p>
            <p className="error-hint">Login failed? The server may be waking up from sleep. Wait a minute and try again.</p>
            <p className="error-feedback">
              Persistent issue? <a href="https://forms.gle/RW7jREYrceoacjxY9" target="_blank" rel="noopener noreferrer">Report it</a>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
