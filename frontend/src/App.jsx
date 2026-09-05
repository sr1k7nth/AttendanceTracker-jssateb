import { useState, useEffect } from 'react';
import { getToken, fetchAttendance, logout } from './api';
import Login from './components/Login';
import AttendanceSummary from './components/AttendanceSummary';
import Leaderboard from './components/Leaderboard';
import './index.css';

function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [tab, setTab] = useState('attendance');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch attendance on login
  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    setError('');
    fetchAttendance()
      .then(setAttendance)
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
    setTab('attendance');
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Attendance</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loggedIn && (
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
            </nav>
          )}
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {loggedIn && (
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      {!loggedIn ? (
        <Login onLogin={handleLogin} />
      ) : loading ? (
        <p className="loading">Fetching your attendance...</p>
      ) : error ? (
        <p className="error-msg">{error}</p>
      ) : tab === 'attendance' ? (
        <AttendanceSummary data={attendance} />
      ) : (
        <Leaderboard />
      )}
    </div>
  );
}

export default App;
