"""Attendance metrics derived from the per-course summary.

`can_miss*` / `need_to_attend*` are pure functions of `summary`, so they are
never persisted — the schema computes them on read (see schemas.AttendanceResponse).
`total_avg` is the one value that still gets stored, because the leaderboard
orders by it in SQL.
"""

import math


def compute_metrics(summary):
    """Totals + the 75%/85% can-miss / need-to-attend arithmetic."""
    total_classes = sum(int(x["classes"]) for x in summary)
    total_present = sum(int(x["present"]) for x in summary)
    total_avg = (
        round((total_present / total_classes) * 100, 2) if total_classes else 0
    )

    if total_avg >= 85:
        can_miss85 = math.floor((total_present - 0.85 * total_classes) / 0.85)
        need_to_attend85 = 0
    else:
        need_to_attend85 = math.ceil(
            ((0.85 * total_classes) - total_present) / 0.15
        )
        can_miss85 = 0

    if total_avg >= 75:
        can_miss75 = math.floor((total_present - 0.75 * total_classes) / 0.75)
        need_to_attend75 = 0
    else:
        need_to_attend75 = math.ceil(
            ((0.75 * total_classes) - total_present) / 0.25
        )
        can_miss75 = 0

    return {
        "total_avg": total_avg,
        "can_miss85": can_miss85,
        "can_miss75": can_miss75,
        "need_to_attend85": need_to_attend85,
        "need_to_attend75": need_to_attend75,
    }
