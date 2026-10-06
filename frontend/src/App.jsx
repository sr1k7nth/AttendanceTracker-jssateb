import { useState, useEffect, useRef } from 'react';
import { getToken, fetchAttendance, logout } from './api';
import Login from './components/Login';
import Landing from './components/Landing';
import AttendanceSummary from './components/AttendanceSummary';
import Leaderboard from './components/Leaderboard';
import Faq from './components/Faq';
import BetaBanner from './components/BetaBanner';
import Terms from './components/Terms';
import Changelog from './components/Changelog';
import Support from './components/Support';
import Supporters from './components/Supporters';
import DonationPopup from './components/DonationPopup';
import AdminPanel from './components/AdminPanel';
import './index.css';

const FEEDBACK_URL = 'https://forms.gle/RW7jREYrceoacjxY9';
const MENU_ITEMS = ['support', 'faq', 'terms', 'changelog'];
const MENU_LABELS = {
  support: 'Donate',
  faq: 'FAQ',
  terms: 'Terms',
  changelog: 'Changelog',
};

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
  // Returning users (usn in localStorage) skip the landing page
  const [showLogin, setShowLogin] = useState(() => !!localStorage.getItem('usn'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSupportPopup, setShowSupportPopup] = useState(false);
  const menuRef = useRef(null);
  const popupCountedRef = useRef(false);

  // Admin UI only for a panel-credential session — never a normal login.
  const isAdmin = !!sessionStorage.getItem('panel_creds');
  const menuItems = isAdmin ? [...MENU_ITEMS, 'admin'] : MENU_ITEMS;
  const menuLabels = isAdmin ? { ...MENU_LABELS, admin: 'Admin' } : MENU_LABELS;

  useEffect(() => {
    // Clear legacy password storage
    sessionStorage.removeItem('sessionPassword');
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- donation popup -------------------------------------------------------
  function donationPopupBlocked() {
    // Never during a panel session
    if (sessionStorage.getItem('panel_creds')) return true;
    // Never for supporters
    try {
      const att = JSON.parse(localStorage.getItem('attendance') || 'null');
      if (att && att.is_supporter) return true;
    } catch {
      // corrupted cache — treat as non-supporter
    }
    // Unified once-per-day gate — no bypass
    const today = new Date().toLocaleDateString('en-CA');
    return localStorage.getItem('popup_shown_date') === today;
  }

  function openDonationPopup() {
    if (!loggedIn || donationPopupBlocked()) return false;
    setShowSupportPopup(true);
    localStorage.setItem('popup_shown_date', new Date().toLocaleDateString('en-CA'));
    return true;
  }

  // Popup due on opens 1, 3, 6, 9, 12…; other gates live in openDonationPopup().
  useEffect(() => {
    if (!loggedIn) return;
    if (popupCountedRef.current) return; // StrictMode double-mount guard
    popupCountedRef.current = true;
    const n = (parseInt(localStorage.getItem('app_opens') || '0', 10) || 0) + 1;
    localStorage.setItem('app_opens', String(n));
    if (n === 1 || n % 3 === 0) openDonationPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Fetch attendance on login
  useEffect(() => {
    if (!loggedIn) return;
    // Show cached data first, fetch in background
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  function handleLogin() {
    setLoggedIn(true);
    setShowLogin(false);
    // Panel-credential sessions go straight to the review queue
    setTab(sessionStorage.getItem('panel_creds') ? 'admin' : 'attendance');
  }

  function handleLogout() {
    logout();
    setLoggedIn(false);
    setAttendance(null);
    localStorage.removeItem('attendance');
    sessionStorage.removeItem('sessionPassword');
    setTab('attendance');
    setShowLogin(false);
    setShowSupportPopup(false);
  }

  // Password is never stored, so refreshing means logging in again.
  function handleRefresh() {
    handleLogout();
    setShowLogin(true);
  }

  // Retrying only needs our own cache — no password, no scrape.
  function handleRetry() {
    setLoading(true);
    setError('');
    fetchAttendance()
      .then((data) => {
        setAttendance(data);
        localStorage.setItem('attendance', JSON.stringify(data));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div className="app">
      <BetaBanner />
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            {tab !== 'attendance' && (
              <button
                className="nav-back"
                aria-label="Back to summary"
                title="Back"
                onClick={() => {
                  setTab('attendance');
                  window.scrollTo(0, 0);
                }}
              >
                ←
              </button>
            )}
            <h1 className="brand-accent">JA-Tracker</h1>
          </div>
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
                className={tab === 'supporters' ? 'active' : ''}
                onClick={() => setTab('supporters')}
              >
                Supporters
              </button>
            </nav>
            <div className="nav-menu" ref={menuRef}>
              <button
                className={`nav-menu-trigger${MENU_ITEMS.includes(tab) || tab === 'admin' ? ' active' : ''}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
              {menuOpen && (
                <div className="nav-menu-dropdown" role="menu">
                  {menuItems.map((item) => (
                    <button
                      key={item}
                      role="menuitem"
                      className={tab === item ? 'active' : ''}
                      onClick={() => {
                        setTab(item);
                        setMenuOpen(false);
                      }}
                    >
                      {menuLabels[item]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="app-content">
        {tab === 'changelog' ? (
          <Changelog />
        ) : tab === 'terms' ? (
          <Terms />
        ) : tab === 'faq' ? (
          <Faq />
        ) : tab === 'support' ? (
          <Support loggedIn={loggedIn} onLoginRequired={() => setShowLogin(true)} />
        ) : tab === 'supporters' ? (
          <Supporters onDonate={() => setTab('support')} />
        ) : tab === 'admin' && isAdmin ? (
          <AdminPanel
            onLock={() => {
              setTab('attendance');
              window.scrollTo(0, 0);
            }}
          />
        ) : !loggedIn ? (
          showLogin ? (
            <Login
              onLogin={handleLogin}
              onTerms={() => setTab('terms')}
              onBack={() => setShowLogin(false)}
            />
          ) : (
            <Landing onLogin={() => setShowLogin(true)} />
          )
        ) : loading && !attendance ? (
          <p className="loading">Fetching your attendance...</p>
        ) : error ? (
          <div className="error-block">
            <p className="error-msg">{error}</p>
            <p className="error-hint">The server may be waking up from sleep. Wait a minute and try again.</p>
            <button
              className="btn error-retry"
              onClick={handleRetry}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Try again'}
            </button>
            <p className="error-feedback">
              Something wrong? <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Report it</a>
            </p>
          </div>
        ) : tab === 'attendance' ? (
          <AttendanceSummary
            data={attendance}
            onRefresh={handleRefresh}
            loading={loading}
            onDonate={() => setTab('support')}
          />
        ) : (
          <Leaderboard myBranch={attendance?.branch} />
        )}
      </main>

      {showSupportPopup && (
        <DonationPopup
          onClose={() => setShowSupportPopup(false)}
          onSupport={() => {
            setShowSupportPopup(false);
            setTab('support');
            window.scrollTo(0, 0);
          }}
        />
      )}

      <footer className="app-footer">
        <div className="footer-links">
          <button className="faq-link" onClick={() => { setTab('faq'); if (!loggedIn) window.scrollTo(0, 0); }}>
            FAQ
          </button>
          <span className="footer-sep">·</span>
          <button className="faq-link" onClick={() => { setTab('changelog'); if (!loggedIn) window.scrollTo(0, 0); }}>
            Changelog
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
