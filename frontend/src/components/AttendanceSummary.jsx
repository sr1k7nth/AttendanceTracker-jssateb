import { useState } from 'react';
import Timetable from './Timetable';

function pctColor(pct) {
  const n = parseFloat(pct);
  if (n >= 85) return 'high';
  if (n >= 75) return 'mid';
  return 'low';
}

export default function AttendanceSummary({ data, onRefresh, loading, onDonate }) {
  const [target, setTarget] = useState('');
  const [calculated, setCalculated] = useState(null);

  if (!data) return null;

  const totalClasses = data.summary?.reduce((s, x) => s + parseInt(x.classes || '0'), 0) || 0;
  const totalPresent = data.summary?.reduce((s, x) => s + parseInt(x.present || '0'), 0) || 0;

  function handleCalculate() {
    const t = parseFloat(target);
    if (isNaN(t) || t < 0 || t > 100 || totalClasses === 0) {
      setCalculated(null);
      return;
    }
    const ratio = t / 100;
    if (ratio === 0) {
      setCalculated({ canMiss: totalClasses - totalPresent });
    } else if (totalPresent / totalClasses >= ratio) {
      setCalculated({ canMiss: Math.floor((totalPresent - ratio * totalClasses) / ratio) });
    } else {
      setCalculated({ needAttend: Math.ceil((ratio * totalClasses - totalPresent) / (1 - ratio)) });
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
          >
            {loading ? 'Refreshing...' : 'Refresh'}
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
            {data.summary.map((s, i) => (
              <li key={s.code} className="attendance-row">
                <span className="subj-col-no">{s.no || i + 1}</span>
                <span className="subj-col-code mono">{s.code}</span>
                <span className="subj-col-name" title={s.name}>{s.name}</span>
                <span className="subj-col-nums">
                  <span className="subj-num-item">{s.classes}</span>
                  <span className="subj-num-item">{s.present}</span>
                </span>
                <span className={`subj-col-pct ${pctColor(s.percentage)}`}>{s.percentage}</span>
              </li>
            ))}
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
