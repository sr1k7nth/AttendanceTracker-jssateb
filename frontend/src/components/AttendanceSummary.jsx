function pctColor(pct) {
  const n = parseFloat(pct);
  if (n >= 85) return 'high';
  if (n >= 75) return 'mid';
  return 'low';
}

export default function AttendanceSummary({ data }) {
  if (!data) return null;

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
          <div className="stat-label">Must attend</div>
          <div className="stat-value red">{data.need_to_attend85}</div>
        </div>
      </div>

      {/* Subject-wise Attendance */}
      {data.summary && data.summary.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 className="section-title">Subject-wise Attendance</h3>
          <ul className="attendance-list">
            {data.summary.map((s) => (
              <li key={s.code} className="attendance-row">
                <span className="attendance-name" title={s.name}>
                  {s.code} — {s.name}
                </span>
                <span className="attendance-dots" />
                <span className={`attendance-pct ${pctColor(s.percentage)}`}>
                  {s.percentage}
                </span>
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
