import { useState, useEffect } from 'react';
import Timetable from './Timetable';
import { fetchHistory, fetchMyDonations, fetchMyFeedback } from '../api';

function pctColor(pct) {
  const n = parseFloat(pct);
  if (n >= 85) return 'high';
  if (n >= 75) return 'mid';
  return 'low';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });
}

/* How many classes you can still miss (or must still attend) to hold `t`%,
   given the classes held so far. Shared by the global calculator and the
   per-subject one, so both always agree. */
function computeTarget(classes, present, t) {
  if (isNaN(t) || t < 0 || t > 100 || classes === 0) return null;
  const ratio = t / 100;
  if (ratio === 0) return { canMiss: classes - present };
  if (present / classes >= ratio) return { canMiss: Math.floor((present - ratio * classes) / ratio) };
  return { needAttend: Math.ceil((ratio * classes - present) / (1 - ratio)) };
}

/* Hand-rolled SVG line chart — no chart library, so nothing new to install.
   Y adapts to the data (always including the 75/85 lines when in reach) so a
   2% drift is visible instead of being flattened against a fixed 0–100 axis.
   The line is a Catmull-Rom spline (smooth, no overshoot beyond data), with a
   gradient area fill, a draw-in animation, and invisible fat hit targets so
   the <title> tooltips are easy to hit on touch. */
function smoothPath(pts) {
  if (pts.length < 3) {
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    // 1/6 factor keeps the curve inside the data (no false dips/peaks)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function HistoryChart({ points }) {
  const W = 600, H = 220, PAD_L = 32, PAD_R = 12, PAD_T = 14, PAD_B = 26;
  const vals = points.map((p) => p.total_avg);
  let lo = Math.min(Math.min(...vals), 75) - 3;
  let hi = Math.max(Math.max(...vals), 85) + 3;
  lo = Math.max(0, Math.min(lo, 90));
  hi = Math.min(100, Math.max(hi, 10));
  if (hi - lo < 10) {
    lo = Math.max(0, lo - 5);
    hi = Math.min(100, hi + 5);
  }

  const t0 = Date.parse(points[0].recorded_at);
  const t1 = Date.parse(points[points.length - 1].recorded_at);
  const span = Math.max(t1 - t0, 1);
  const x = (t) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (v) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const baseY = H - PAD_B;

  const pts = points.map((p) => [x(Date.parse(p.recorded_at)), y(p.total_avg)]);
  const path = smoothPath(pts);
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${baseY} L${pts[0][0].toFixed(1)},${baseY} Z`;
  const guides = [75, 85].filter((g) => g > lo && g < hi);

  return (
    <svg
      className="history-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Overall attendance percentage over time"
    >
      <defs>
        <linearGradient id="history-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {guides.map((g) => (
        <g key={g}>
          <line
            className={`history-guide ${g === 85 ? 'g85' : 'g75'}`}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(g)}
            y2={y(g)}
          />
          <text className="history-axis" x={PAD_L - 6} y={y(g) + 3} textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      <path className="history-area" d={area} />
      <path className="history-line" d={path} pathLength="1" />
      {points.map((p, i) => {
        const cx = pts[i][0];
        const cy = pts[i][1];
        const last = i === points.length - 1;
        return (
          <g key={i}>
            {/* fat invisible hit target — the tooltip lives here */}
            <circle className="history-hit" cx={cx} cy={cy} r={12}>
              <title>{`${fmtDate(p.recorded_at)} — ${p.total_avg}%`}</title>
            </circle>
            <circle
              className={`history-dot ${pctColor(String(p.total_avg))}${last ? ' last' : ''}`}
              cx={cx}
              cy={cy}
              r={last ? 1.5 : 1.1}
            />
          </g>
        );
      })}
      <text className="history-axis" x={PAD_L} y={H - 8} textAnchor="start">
        {fmtDate(points[0].recorded_at)}
      </text>
      <text className="history-axis" x={W - PAD_R} y={H - 8} textAnchor="end">
        {fmtDate(points[points.length - 1].recorded_at)}
      </text>
    </svg>
  );
}

export default function AttendanceSummary({ data, onRefresh, loading, onDonate }) {
  const [target, setTarget] = useState('');
  const [calculated, setCalculated] = useState(null);
  const [missCount, setMissCount] = useState('');
  const [missResult, setMissResult] = useState(null);
  const [openSubj, setOpenSubj] = useState(null); // subject code with its calculator open
  const [subjTarget, setSubjTarget] = useState(''); // carried across subjects
  const [subjResult, setSubjResult] = useState(null);
  const [subjMiss, setSubjMiss] = useState('');
  const [subjMissResult, setSubjMissResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState('');
  const [notice, setNotice] = useState(null);
  const [replyNotice, setReplyNotice] = useState(null);

  // Latest reviewed donation (approved/rejected) → summary-page notice.
  // Pending rows wait silently; dismissal is remembered per donation id.
  useEffect(() => {
    fetchMyDonations()
      .then((rows) => {
        const latest = rows.find(
          (r) => r.status === 'rejected' || r.status === 'approved'
        );
        if (
          latest &&
          localStorage.getItem(`donation_notice_seen_${latest.id}`) !== latest.status
        ) {
          setNotice(latest);
        }
      })
      .catch(() => {}); // notice is best-effort
  }, []);

  // Latest admin reply to one of this user's feedback submissions → banner.
  // The seen-key includes replied_at, so an edited reply shows up again.
  useEffect(() => {
    fetchMyFeedback()
      .then((rows) => {
        const latest = rows.find((r) => r.reply);
        if (!latest) return;
        const key = `feedback_reply_seen_${latest.id}_${latest.replied_at}`;
        if (localStorage.getItem(key) !== 'seen') setReplyNotice(latest);
      })
      .catch(() => {}); // notice is best-effort
  }, []);

  if (!data) return null;

  const totalClasses = data.summary?.reduce((s, x) => s + parseInt(x.classes || '0'), 0) || 0;
  const totalPresent = data.summary?.reduce((s, x) => s + parseInt(x.present || '0'), 0) || 0;

  function handleCalculate() {
    setCalculated(computeTarget(totalClasses, totalPresent, parseFloat(target)));
  }

  // "What if I miss X classes?" — those X count as held-but-absent:
  // new % = present / (classes + X).
  function handleMissCalculate() {
    const miss = parseInt(missCount, 10);
    if (isNaN(miss) || miss < 0 || totalClasses === 0) {
      setMissResult(null);
      return;
    }
    const pct = ((totalPresent / (totalClasses + miss)) * 100).toFixed(2);
    const band =
      parseFloat(pct) >= 85 ? 'high' : parseFloat(pct) >= 75 ? 'mid' : 'low';
    setMissResult({ pct, band });
  }

  // One subject calculator at a time. Switching subjects clears its result but
  // keeps the last target entered — the same goal is usually checked everywhere.
  function toggleSubject(code) {
    setOpenSubj(openSubj === code ? null : code);
    setSubjResult(null);
    setSubjMissResult(null);
  }

  function handleSubjCalculate(s) {
    setSubjResult(
      computeTarget(
        parseInt(s.classes || '0'),
        parseInt(s.present || '0'),
        parseFloat(subjTarget)
      )
    );
  }

  // Subject-level "what if I miss X" — same held-but-absent math, per subject.
  function handleSubjMissCalculate(s) {
    const miss = parseInt(subjMiss, 10);
    const held = parseInt(s.classes || '0');
    if (isNaN(miss) || miss < 0 || held === 0) {
      setSubjMissResult(null);
      return;
    }
    const present = parseInt(s.present || '0');
    const pct = ((present / (held + miss)) * 100).toFixed(2);
    const band =
      parseFloat(pct) >= 85 ? 'high' : parseFloat(pct) >= 75 ? 'mid' : 'low';
    setSubjMissResult({ pct, band });
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      // Refetch on every open — an Update (re-login) adds a new point.
      setHistoryErr('');
      setHistoryLoading(true);
      fetchHistory()
        .then(setHistory)
        .catch((e) => setHistoryErr(e.message))
        .finally(() => setHistoryLoading(false));
    }
  }

  return (
    <div>
      {/* Admin reply to a feedback submission — same loop as donation notices */}
      {replyNotice && (
        <div className="donation-notice feedback-reply">
          <div>
            <strong>Admin replied to your feedback</strong>
            {replyNotice.message && (
              <p className="reply-quoted">You: &ldquo;{replyNotice.message}&rdquo;</p>
            )}
            <p>{replyNotice.reply}</p>
          </div>
          <button
            type="button"
            className="donation-notice-close"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(
                `feedback_reply_seen_${replyNotice.id}_${replyNotice.replied_at}`,
                'seen'
              );
              setReplyNotice(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Donation review notice — top of the page, first thing seen */}
      {notice && (
        <div className={`donation-notice ${notice.status}`}>
          <div>
            <strong>
              {notice.status === 'rejected'
                ? `Your ₹${notice.amount} donation was rejected.`
                : `Your ₹${notice.amount} donation was approved — thanks! 🎉`}
            </strong>
            {notice.status === 'rejected' && notice.reject_reason && (
              <p>Reason: {notice.reject_reason}</p>
            )}
          </div>
          <button
            type="button"
            className="donation-notice-close"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(`donation_notice_seen_${notice.id}`, notice.status);
              setNotice(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stats">
        <div className="stat-card stat-overall">
          <div className="stat-label">Overall</div>
          <div className={`stat-value ${pctColor(data.total_avg + '%')}`}>
            {data.total_avg}%
          </div>
          <button
            className="stat-refresh"
            onClick={onRefresh}
            disabled={loading}
            title="The portal password is never stored, so updating means logging in again"
          >
            {loading ? 'Updating...' : 'Update'}
          </button>
        </div>
        <div className="stat-card stat-row">
          <div className="stat-label">Can miss</div>
          <div className="stat-row-values">
            {/* can-miss @85 is structurally 0 while below 85% — only show what's live */}
            {data.total_avg >= 85 && (
              <>
                <span className="stat-value green">{data.can_miss85}</span>
                <span className="stat-sub">at 85%</span>
              </>
            )}
            <span className="stat-value yellow">{data.can_miss75}</span>
            <span className="stat-sub">at 75%</span>
          </div>
        </div>
        <div className="stat-card stat-row">
          <div className="stat-label">Need to attend</div>
          <div className="stat-row-values">
            <span className="stat-value red">{data.need_to_attend85}</span>
            <span className="stat-sub">at 85%</span>
            {/* need-to-attend @75 is structurally 0 once above 75% */}
            {data.total_avg < 75 && (
              <>
                <span className="stat-value red">{data.need_to_attend75}</span>
                <span className="stat-sub">at 75%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Attendance progression — collapsible graph (one point per login) */}
      <div className="history-block">
        <button
          type="button"
          className="history-toggle"
          onClick={toggleHistory}
          aria-expanded={showHistory}
        >
          <span>Attendance over time</span>
          <span className={`history-chevron${showHistory ? ' open' : ''}`}>▾</span>
        </button>
        {showHistory && (
          <div className="history-panel">
            {historyLoading && <p className="history-note">Loading…</p>}
            {historyErr && <p className="history-note history-error">{historyErr}</p>}
            {!historyLoading && !historyErr && (
              history.length > 1 ? (
                <HistoryChart points={history} />
              ) : (
                <p className="history-note">
                  {history.length === 1
                    ? 'One check-in recorded so far — the graph starts from your next login.'
                    : 'No history yet. A point is recorded every time you log in.'}
                </p>
              )
            )}
            {history.length > 1 && (
              <p className="history-footnote">
                One point per login, timestamped when the portal was re-scraped. Hover a dot for the exact date.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Custom Target Calculator — stat-card style, matches Can miss / Need to attend */}
      <div className="stats">
        <div className="stat-card stat-row" style={{ flexWrap: 'wrap' }}>
          <div className="stat-label">Enter Target %</div>
          <div className="stat-row-values">
            <input
              type="number"
              className="calc-input"
              placeholder="e.g. 80"
              min="1"
              max="100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCalculate()}
            />
            <span className="stat-sub">%</span>
            <button className="btn btn-primary calc-btn" onClick={handleCalculate}>
              Calculate
            </button>
          </div>
        </div>
        {calculated && (
          <p className="calc-result">
            {calculated.canMiss !== undefined
              ? <>You can miss <strong>{calculated.canMiss}</strong> more classes.</>
              : <>You need to attend <strong>{calculated.needAttend}</strong> more classes.</>
            }
          </p>
        )}

        {/* Miss calculator — "what if I skip X classes?" */}
        <div className="stat-card stat-row" style={{ flexWrap: 'wrap' }}>
          <div className="stat-label">What if I miss</div>
          <div className="stat-row-values">
            <input
              type="number"
              className="calc-input"
              placeholder="e.g. 5"
              min="0"
              value={missCount}
              onChange={(e) => setMissCount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMissCalculate()}
            />
            <span className="stat-sub">classes</span>
            <button className="btn btn-primary calc-btn" onClick={handleMissCalculate}>
              Calculate
            </button>
          </div>
        </div>
        {missResult && (
          <p className="calc-result">
            Your attendance drops to{' '}
            <strong className={`stat-value-inline ${missResult.band}`}>{missResult.pct}%</strong>.
          </p>
        )}
      </div>

      {/* Weekly Attendance (moved above Subject-wise) */}
      <div style={{ marginTop: '2rem' }}>
        <Timetable weeks={data.weeks} data={data.timetable} />
      </div>

      {/* Subject-wise Attendance */}
      {data.summary && data.summary.length > 0 && (
        <div style={{ marginBottom: '2rem', marginTop: '2rem' }}>
          <h3 className="section-title">Subject-wise Attendance</h3>

          {/* Table header */}
          <div className="subj-table-header">
            <span className="subj-col-no">#</span>
            <span className="subj-col-code">Code</span>
            <span className="subj-col-name">Subject</span>
            <span className="subj-col-nums">
              <span className="subj-num-item"><span className="subj-num-label">Cls</span></span>
              <span className="subj-num-item"><span className="subj-num-label">Pre</span></span>
            </span>
            <span className="subj-col-pct">%</span>
          </div>

          <ul className="attendance-list">
            {data.summary.map((s, i) => {
              const open = openSubj === s.code;
              const held = parseInt(s.classes || '0');
              return (
                <li
                  key={s.code}
                  className="attendance-row"
                  onClick={() => toggleSubject(s.code)}
                >
                  <span className="subj-col-no">{s.no || i + 1}</span>
                  <span className="subj-col-code mono">{s.code}</span>
                  <span className="subj-col-name" title={s.name}>{s.name}</span>
                  <span className="subj-col-nums">
                    <span className="subj-num-item">{s.classes}</span>
                    <span className="subj-num-item">{s.present}</span>
                  </span>
                  <span className={`subj-col-pct ${pctColor(s.percentage)}`}>{s.percentage}</span>
                  {/* No onClick here on purpose: the click bubbles to the row.
                      Keyboard users still get a real button to focus. */}
                  <button
                    type="button"
                    className={`subj-toggle${open ? ' open' : ''}`}
                    aria-expanded={open}
                    aria-label={`Custom target calculator for ${s.name}`}
                    title="Custom target calculator"
                  >
                    ▾
                  </button>

                  {open && (
                    // Clicks inside the panel (the input, Calculate) must not
                    // bubble up to the row and close it again.
                    <div className="subj-expand" onClick={(e) => e.stopPropagation()}>
                      {held === 0 ? (
                        <p className="subj-expand-note">No classes held yet for this subject.</p>
                      ) : (
                        <>
                          <div className="subj-expand-controls">
                            <input
                              type="number"
                              className="calc-input"
                              placeholder="e.g. 80"
                              min="1"
                              max="100"
                              value={subjTarget}
                              onChange={(e) => {
                                setSubjTarget(e.target.value);
                                setSubjResult(null);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleSubjCalculate(s)}
                              aria-label={`Target percentage for ${s.name}`}
                            />
                            <span className="stat-sub">%</span>
                            <button
                              type="button"
                              className="btn btn-primary calc-btn"
                              onClick={() => handleSubjCalculate(s)}
                            >
                              Calculate
                            </button>
                          </div>
                          {subjResult && (
                            <p className="calc-result">
                              {subjResult.canMiss !== undefined
                                ? <>You can miss <strong>{subjResult.canMiss}</strong> more {subjResult.canMiss === 1 ? 'class' : 'classes'}.</>
                                : <>You need to attend <strong>{subjResult.needAttend}</strong> more {subjResult.needAttend === 1 ? 'class' : 'classes'}.</>
                              }
                            </p>
                          )}

                          {/* Miss calculator — same as the global one, scoped to this subject */}
                          <div className="subj-expand-controls">
                            <input
                              type="number"
                              className="calc-input"
                              placeholder="e.g. 3"
                              min="0"
                              value={subjMiss}
                              onChange={(e) => {
                                setSubjMiss(e.target.value);
                                setSubjMissResult(null);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleSubjMissCalculate(s)}
                              aria-label={`Classes to miss in ${s.name}`}
                            />
                            <span className="stat-sub">classes</span>
                            <button
                              type="button"
                              className="btn btn-primary calc-btn"
                              onClick={() => handleSubjMissCalculate(s)}
                            >
                              Calculate
                            </button>
                          </div>
                          {subjMissResult && (
                            <p className="calc-result">
                              Drops to{' '}
                              <strong className={`stat-value-inline ${subjMissResult.band}`}>{subjMissResult.pct}%</strong>.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bottom donate CTA */}
      <div className="summary-donate">
        <button className="btn btn-primary btn-shine" onClick={onDonate}>
          Support the project
        </button>
      </div>

      {/* Branch & Sem */}
      {(data.branch || data.sem) && (
        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
          {data.branch && `Branch: ${data.branch}`}
          {data.branch && data.sem && ' · '}
          {data.sem && `Semester: ${data.sem}`}
        </p>
      )}
    </div>
  );
}
