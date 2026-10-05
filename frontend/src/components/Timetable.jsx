/**
 * Weekly timetable grid — mirrors the portal's Student Attendance table.
 *
 * data shape (from GET /fetch_attendance/):
 *   {
 *     headers: ["9:00 - 10:00", ..., "B1", ...],        // 8 period columns
 *     days: [
 *       { day: "Monday", date: "28-09-26",
 *         periods: [{ course, faculty, type, status } | null, ...], },
 *       ... // 6 days
 *     ],
 *   }
 */
export default function Timetable({ data }) {
  if (!data || !data.days || !data.days.length || !data.headers) return null;

  const { headers, days } = data;

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
