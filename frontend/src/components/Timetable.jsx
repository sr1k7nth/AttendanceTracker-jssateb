import { useEffect, useState } from 'react';

/**
 * Weekly timetable grid — mirrors the portal's Student Attendance table.
 *
 * props:
 *   weeks: [{ week_start: "2026-11-09", timetable: { headers, days } }, …]
 *          newest first — every stored week, browsable with ‹ › arrows.
 *   data:  fallback single week ({headers, days}) for caches saved before
 *          the weeks feature existed.
 */
function fmtWeekLabel(iso) {
  if (!iso) return 'This week';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export default function Timetable({ weeks, data }) {
  const list =
    weeks && weeks.length
      ? weeks
      : data && data.days && data.headers
        ? [{ week_start: null, timetable: data }]
        : [];

  const [idx, setIdx] = useState(0);

  // A fresh fetch replaces the weeks array — snap back to the newest week.
  useEffect(() => {
    setIdx(0);
  }, [list.length, list[0] && list[0].week_start]);

  if (!list.length) return null;

  const current = list[Math.min(idx, list.length - 1)];
  const { headers, days } = current.timetable || {};
  if (!days || !days.length || !headers) return null;
  const isLatest = idx === 0;

  // Empty slot / upcoming (no status yet) / Present / Absent
  function cellClass(p) {
    if (!p) return 'tt-empty';
    const s = (p.status || '').toLowerCase();
    if (s.includes('absent')) return 'tt-absent';
    if (s.includes('present')) return 'tt-present';
    return 'tt-upcoming';
  }

  return (
    <div>
      <h3 className="section-title">Weekly Attendance</h3>

      {list.length > 1 && (
        <div className="tt-week-nav">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(i + 1, list.length - 1))}
            disabled={idx >= list.length - 1}
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="tt-week-label">{fmtWeekLabel(current.week_start)}</span>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={isLatest}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      )}

      <div className="tt-scroll">
        <table className="tt-table">
          <thead>
            <tr>
              <th className="tt-head tt-head-day">Day</th>
              {headers.map((h) => (
                <th key={h} className="tt-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={`${d.day}-${d.date}`}>
                <td className="tt-day">
                  <div className="tt-day-name">{d.day}</div>
                  <div className="tt-day-date">{d.date}</div>
                </td>
                {d.periods.map((p, i) => (
                  <td key={i} className={`tt-cell ${cellClass(p)}`}>
                    {p && (
                      <>
                        <span className="tt-course" title={`${p.course} — ${p.faculty}`}>
                          {p.course}
                        </span>
                        <span className="tt-faculty">{p.faculty}</span>
                        <span className="tt-type">{p.type}</span>
                        {p.status && <span className="tt-status">{p.status}</span>}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
