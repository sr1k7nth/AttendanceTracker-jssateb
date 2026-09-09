import { useState } from 'react';

function pctColor(pct) {
  const n = parseFloat(pct);
  if (n >= 85) return 'high';
  if (n >= 75) return 'mid';
  return 'low';
}

export default function AttendanceSummary({ data }) {
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
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Overall</div>
          <div className={`stat-value ${pctColor(data.total_avg + '%')}`}>
            {data.total_avg}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Can miss (85%)</div>
          <div className="stat-value green">{data.can_miss85}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Can miss (75%)</div>
          <div className="stat-value yellow">{data.can_miss75}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Must attend (85%)</div>
          <div className="stat-value red">{data.need_to_attend85}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Must attend (75%)</div>
          <div className="stat-value red">{data.need_to_attend75}</div>
        </div>
      </div>

      {/* Request limit */}
      {data.request_left !== undefined && (
        <p className="request-left">
          {data.request_left > 4 ? 'Unlimited' : `${data.request_left} / 4`} refreshes left today
        </p>
      )}

      {/* Custom Target Calculator */}
      <div className="custom-calc">
        <h3 className="section-title">Custom Target</h3>
        <div className="calc-row">
          <span className="calc-label">Target %</span>
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
          <button className="btn calc-btn" onClick={handleCalculate}>
            Calculate
          </button>
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

      {/* Subject-wise Attendance */}
      {data.summary && data.summary.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
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

      {/* Absent Periods */}
      {data.absent_periods && data.absent_periods.length > 0 && (
        <div>
          <h3 className="section-title">Absent Periods</h3>
          <ul className="absent-list">
            {data.absent_periods.map((a, i) => (
              <li key={i} className="absent-row">
                <span className="absent-day">{a.day}</span>
                <span className="absent-course" title={a.course}>
                  {a.course}
                </span>
                <span className="absent-status">{a.attendance}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
