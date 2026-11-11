import { useState, useEffect, useRef, Fragment } from 'react';
import { getToken, fetchAttendance, fetchBetaStatus, logout } from './api';
import Login from './components/Login';
import Landing from './components/Landing';
import AttendanceSummary from './components/AttendanceSummary';
import Leaderboard from './components/Leaderboard';
import Faq from './components/Faq';
import Terms from './components/Terms';
import Changelog from './components/Changelog';
import Support from './components/Support';
import Supporters from './components/Supporters';
import DonationPopup from './components/DonationPopup';
import AdminPanel from './components/AdminPanel';
import Feedback from './components/Feedback';
import Latest from './components/Latest';
import './index.css';

const REPO_URL = 'https://github.com/sr1k7nth/AttendanceTracker-jssateb';
const MENU_ITEMS = ['faq', 'terms', 'changelog', 'feedback', 'github'];
const MENU_LABELS = {
  faq: 'FAQ',
  terms: 'Terms',
  changelog: 'Changelog',
  feedback: 'Feedback',
  github: 'GitHub',
};
// Footer mirrors the secondary pages (the main tabs — Summary, Leaderboard,
// Supporters, Donate — all live in the navbar now).
const FOOTER_NAV = [
  ['faq', 'FAQ'],
  ['terms', 'Terms'],
  ['changelog', 'Changelog'],
];

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
  // Returning users (usn in localStorage) skip the landing page — but a
  // live token means a valid session, so a refresh must reopen the summary,
  // not the login form.
  const [showLogin, setShowLogin] = useState(
    () => !!localStorage.getItem('usn') && !getToken()
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSupportPopup, setShowSupportPopup] = useState(false);
  // Opening the feedback page from the error block presets the Error type
  const [feedbackPreset, setFeedbackPreset] = useState(null);
  const menuRef = useRef(null);
  const popupCountedRef = useRef(false);
  // Beta check: branch screenshot request — dismissed per branch so it
  // doesn't nag across sessions (the "What's new" banner is the only
  // non-dismissible one).
  const [betaStatus, setBetaStatus] = useState(null);
  const [betaDismissed, setBetaDismissed] = useState(false);

  // Admin UI only for a panel-credential session — never a normal login.
  const isAdmin = !!sessionStorage.getItem('panel_creds');
  const menuItems = isAdmin ? [...MENU_ITEMS, 'admin', 'latest'] : MENU_ITEMS;
  const menuLabels = isAdmin
    ? { ...MENU_LABELS, admin: 'Admin', latest: 'Latest' }
    : MENU_LABELS;

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

  // Popup due on opens 1, 4, 8, 12… (every 4th scrape/login); other gates
  // live in openDonationPopup().
  useEffect(() => {
    if (!loggedIn) return;
    if (popupCountedRef.current) return; // StrictMode double-mount guard
    popupCountedRef.current = true;
    const n = (parseInt(localStorage.getItem('app_opens') || '0', 10) || 0) + 1;
    localStorage.setItem('app_opens', String(n));
    if (n === 1 || n % 4 === 0) openDonationPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Fetch attendance on login
  useEffect(() => {
    if (!loggedIn) return;
    // Beta-check banner state: branch + how many beta screenshots that
    // branch is in. The banner shows while count < target and isn't dismissed.
    fetchBetaStatus()
      .then((s) => {
        setBetaStatus(s);
        setBetaDismissed(
          s.branch
            ? localStorage.getItem(`beta_banner_dismissed_${s.branch}`) === '1'
            : false
        );
      })
      .catch(() => setBetaStatus(null)); // never block the page
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
    const reauth = loggedIn; // login form was opened over a live session
    setLoggedIn(true);
    setShowLogin(false);
    // Panel-credential sessions go straight to the review queue
    setTab(sessionStorage.getItem('panel_creds') ? 'admin' : 'attendance');
    if (reauth) {
      // The login either scraped fresh data (cooldown expired) or served the
      // cached rows via token (cooldown active) — pull whatever is newest.
      fetchAttendance()
        .then((data) => {
          setAttendance(data);
          localStorage.setItem('attendance', JSON.stringify(data));
        })
        .catch(() => {}); // silently keep the cached view
    }
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

  // Password is never stored, so refreshing means logging in again — but the
  // session stays alive: inside the scrape cooldown the login route answers
  // 429 and api.js falls back to the token to re-serve the last scrape.
  function handleRefresh() {
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

  // Footer links sit at the bottom of the page, so always come back to the top
  function goToTab(t) {
    setTab(t);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
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
              <button
                className={`nav-donate${tab === 'support' ? ' active' : ''}`}
                onClick={() => setTab('support')}
              >
                Donate
              </button>
            </nav>
            <div className="nav-menu" ref={menuRef}>
              <button
                className={`nav-menu-trigger${menuItems.includes(tab) ? ' active' : ''}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
              {menuOpen && (
                <div className="nav-menu-dropdown" role="menu">
                  {menuItems.map((item) =>
                    item === 'github' ? (
                      <a
                        key={item}
                        role="menuitem"
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-menu-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        {menuLabels[item]}
                      </a>
                    ) : (
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
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="app-content">
        {/* Permanent announcement — mentions the changelog + feedback route.
            Renders on every page so it reads as a site notice, not a quiz.
            Only after login (landing/login/terms/faq visitors don't see it). */}
        {loggedIn && (
          <div className="site-notice" role="note">
            <span className="site-notice-text">
              <strong>What&apos;s new:</strong> I shipped the in-app feedback page with
              admin replies, a fresh zinc + green design, and smarter calculators.{' '}
              <button type="button" className="link" onClick={() => goToTab('changelog')}>
                See the changelog
              </button>
              . Hit any snag? The{' '}
              <button type="button" className="link" onClick={() => goToTab('feedback')}>
                Feedback page
              </button>{' '}
              takes errors with screenshots, and feature requests too.
            </span>
          </div>
        )}
        {loggedIn && betaStatus && !betaDismissed && betaStatus.screenshots < betaStatus.target && (
          <div className="site-notice beta-notice" role="note">
            <span className="site-notice-text">
              <strong>Help me check if it&apos;s working fine:</strong> I can&apos;t peek
              into every branch from here, so help me check how this site is working
              for your branch. Open{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setFeedbackPreset('beta_screenshot');
                  setTab('feedback');
                  window.scrollTo(0, 0);
                }}
              >
                Beta screenshot feedback
              </button>{' '}
              and drop a screenshot of how the site looks for your branch — your USN
              is already attached.
            </span>
            <button
              type="button"
              className="donation-notice-close"
              aria-label="Dismiss"
              onClick={() => {
                localStorage.setItem(`beta_banner_dismissed_${betaStatus.branch}`, '1');
                setBetaDismissed(true);
              }}
            >
              ✕
            </button>
          </div>
        )}
        {tab === 'changelog' ? (
          <Changelog />
        ) : tab === 'terms' ? (
          <Terms />
        ) : tab === 'faq' ? (
          <Faq />
        ) : tab === 'feedback' ? (
          <Feedback
            loggedIn={loggedIn}
            onLoginRequired={() => setShowLogin(true)}
            initialCategory={feedbackPreset}
          />
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
        ) : tab === 'latest' && isAdmin ? (
          <Latest />
        ) : showLogin ? (
          <Login
            onLogin={handleLogin}
            onTerms={() => setTab('terms')}
            onBack={() => setShowLogin(false)}
          />
        ) : !loggedIn ? (
          <Landing onLogin={() => setShowLogin(true)} />
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
              Something wrong?{' '}
              <button
                className="faq-link"
                onClick={() => {
                  setFeedbackPreset('error');
                  setTab('feedback');
                  window.scrollTo(0, 0);
                }}
              >
                Report it
              </button>
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
          {FOOTER_NAV.map(([t, label], i) => (
            <Fragment key={t}>
              {i > 0 && <span className="footer-sep">·</span>}
              <button className="faq-link" onClick={() => goToTab(t)}>
                {label}
              </button>
            </Fragment>
          ))}
          <span className="footer-sep">·</span>
          <button
            className="faq-link"
            onClick={() => {
              setFeedbackPreset(null);
              goToTab('feedback');
            }}
          >
            Feedback
          </button>
          <span className="footer-sep">·</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-github"
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
