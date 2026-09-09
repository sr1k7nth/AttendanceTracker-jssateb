import { useState, useEffect } from 'react';
import { getToken, fetchAttendance, refreshAttendance, logout } from './api';
import Login from './components/Login';
import AttendanceSummary from './components/AttendanceSummary';
import Leaderboard from './components/Leaderboard';
import Faq from './components/Faq';
import BetaBanner from './components/BetaBanner';
import Terms from './components/Terms';
import './index.css';

const FEEDBACK_URL = 'https://forms.gle/RW7jREYrceoacjxY9';

function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [tab, setTab] = useState('attendance');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [attendance, setAttendance] = useState(() => {
    try {
      const cached = localStorage.getItem('attendance');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');

  useEffect(() => {
    // Clear legacy password storage
    sessionStorage.removeItem('sessionPassword');
  }, []);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch attendance on login
  useEffect(() => {
    if (!loggedIn) return;
    // If we already have cached data, show it immediately and fetch in background
    if (attendance) {
      fetchAttendance()
        .then((data) => {
          setAttendance(data);
          localStorage.setItem('attendance', JSON.stringify(data));
        })
        .catch(() => {}); // silently fail, cached data is fine
      return;
    }
    setLoading(true);
    setError('');
    fetchAttendance()
      .then((data) => {
        setAttendance(data);
        localStorage.setItem('attendance', JSON.stringify(data));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loggedIn]);

  function handleLogin() {
    setLoggedIn(true);
    setTab('attendance');
  }

  function handleLogout() {
    logout();
    setLoggedIn(false);
    setAttendance(null);
    localStorage.removeItem('attendance');
    setSessionPassword('');
    sessionStorage.removeItem('sessionPassword');
    setTab('attendance');
  }

  function handleRefresh() {
    if (!sessionPassword) {
      // No password in session — redirect to login
      handleLogout();
      return;
    }
    setLoading(true);
    setError('');
    refreshAttendance(sessionPassword)
      .then((res) => {
        setAttendance(res);
        localStorage.setItem('attendance', JSON.stringify(res));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  function handleFaqBack() {
    if (loggedIn) {
      setTab('attendance');
    } else {
      setTab('attendance');
      window.scrollTo(0, 0);
    }
  }

  return (
    <div className="app">
      <BetaBanner />
      <header className="header">
        <div className="header-top">
          <h1>Attendance</h1>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            {loggedIn && (
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            )}
          </div>
        </div>
        {loggedIn && (
          <div className="header-bottom">
            <nav className="header-nav">
              <button
                className={tab === 'attendance' ? 'active' : ''}
                onClick={() => setTab('attendance')}
              >
                Summary
              </button>
              <button
                className={tab === 'leaderboard' ? 'active' : ''}
                onClick={() => setTab('leaderboard')}
              >
                Leaderboard
              </button>
              <button
                className={tab === 'faq' ? 'active' : ''}
                onClick={() => setTab('faq')}
              >
                FAQ
              </button>
              <button
                className={tab === 'terms' ? 'active' : ''}
                onClick={() => setTab('terms')}
              >
                Terms
              </button>
            </nav>
            {tab === 'attendance' && (
              <button
                className="btn"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="app-content">
        {tab === 'terms' ? (
          <Terms onBack={() => { setTab(loggedIn ? 'attendance' : 'attendance'); window.scrollTo(0, 0); }} />
        ) : tab === 'faq' ? (
          <Faq onBack={handleFaqBack} />
        ) : !loggedIn ? (
          <Login onLogin={handleLogin} onPassword={setSessionPassword} onTerms={() => setTab('terms')} />
        ) : loading ? (
          <p className="loading">Fetching your attendance...</p>
        ) : error ? (
          <div className="error-block">
            <p className="error-msg">{error}</p>
            <p className="error-hint">The server may be waking up from sleep. Wait a minute and try again.</p>
            <p className="error-feedback">
              Something wrong? <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Report it</a>
            </p>
          </div>
        ) : tab === 'attendance' ? (
          <AttendanceSummary data={attendance} />
        ) : (
          <Leaderboard myBranch={attendance?.branch} />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-links">
          <button className="faq-link" onClick={() => { setTab('faq'); if (!loggedIn) window.scrollTo(0, 0); }}>
            FAQ
          </button>
          <span className="footer-sep">·</span>
          <a
            href="https://github.com/sr1k7nth/AttendanceTracker-jssateb"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <p className="footer-credit">
          made by{' '}
          <a href="https://sr1k7nth.is-a.dev/" target="_blank" rel="noopener noreferrer">
            sr1k7nth
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
