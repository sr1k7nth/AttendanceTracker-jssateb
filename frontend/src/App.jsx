import { useState, useEffect } from 'react';
import { getToken, fetchAttendance, refreshAttendance, logout } from './api';
import Login from './components/Login';
import AttendanceSummary from './components/AttendanceSummary';
import Leaderboard from './components/Leaderboard';
import Faq from './components/Faq';
import './index.css';

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
  const [sessionPassword, setSessionPassword] = useState(() => sessionStorage.getItem('sessionPassword') || '');

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
    if (!sessionPassword) return;
    setLoading(true);
    setError('');
    refreshAttendance(sessionPassword)
      .then((res) => {
        setAttendance(res.data);
        localStorage.setItem('attendance', JSON.stringify(res.data));
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
            </nav>
            {tab === 'attendance' && (
              <button
                className="btn"
                onClick={handleRefresh}
                disabled={loading || !sessionPassword}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="app-content">
        {tab === 'faq' ? (
          <Faq onBack={handleFaqBack} />
        ) : !loggedIn ? (
          <Login onLogin={handleLogin} onPassword={(pw) => { setSessionPassword(pw); sessionStorage.setItem('sessionPassword', pw); }} />
        ) : loading ? (
          <p className="loading">Fetching your attendance...</p>
        ) : error ? (
          <p className="error-msg">{error}</p>
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
