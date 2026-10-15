import { useState } from 'react';
import Timetable from './Timetable';
import { fetchHistory } from '../api';

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
   2% drift is visible instead of being flattened against a fixed 0–100 axis. */
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

  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(Date.parse(p.recorded_at)).toFixed(1)},${y(p.total_avg).toFixed(1)}`)
    .join(' ');
  const guides = [75, 85].filter((g) => g > lo && g < hi);

  return (
    <svg
      className="history-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Overall attendance percentage over time"
    >
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
      <line className="history-axis-line" x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} />
      <path className="history-line" d={path} />
      {points.map((p, i) => (
        <circle
          key={i}
          className={`history-dot ${pctColor(String(p.total_avg))}`}
          cx={x(Date.parse(p.recorded_at))}
          cy={y(p.total_avg)}
          r={3}
        >
          <title>{`${fmtDate(p.recorded_at)} — ${p.total_avg}%`}</title>
        </circle>
      ))}
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
  const [openSubj, setOpenSubj] = useState(null); // subject code with its calculator open
  const [subjTarget, setSubjTarget] = useState(''); // carried across subjects
  const [subjResult, setSubjResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState('');

  if (!data) return null;

  const totalClasses = data.summary?.reduce((s, x) => s + parseInt(x.classes || '0'), 0) || 0;
  const totalPresent = data.summary?.reduce((s, x) => s + parseInt(x.present || '0'), 0) || 0;

  function handleCalculate() {
    setCalculated(computeTarget(totalClasses, totalPresent, parseFloat(target)));
  }

  // One subject calculator at a time. Switching subjects clears its result but
  // keeps the last target entered — the same goal is usually checked everywhere.
  function toggleSubject(code) {
    setOpenSubj(openSubj === code ? null : code);
    setSubjResult(null);
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
            <span className="stat-value green">{data.can_miss85}</span>
            <span className="stat-sub">at 85%</span>
            <span className="stat-value yellow">{data.can_miss75}</span>
            <span className="stat-sub">at 75%</span>
          </div>
        </div>
        <div className="stat-card stat-row">
          <div className="stat-label">Need to attend</div>
          <div className="stat-row-values">
            <span className="stat-value red">{data.need_to_attend85}</span>
            <span className="stat-sub">at 85%</span>
            <span className="stat-value red">{data.need_to_attend75}</span>
            <span className="stat-sub">at 75%</span>
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
      </div>

      {/* Weekly Attendance (moved above Subject-wise) */}
      <div style={{ marginTop: '2rem' }}>
        <Timetable data={data.timetable} />
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
