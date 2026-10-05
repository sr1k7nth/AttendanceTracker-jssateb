"""RAM measurement helpers for sizing SCRAPE_SLOTS.

Two callers:

- ``api/main.py`` runs :func:`measure_scrape_peak_rss` once at startup to
  calibrate how many Chromium scrapes this box can afford.
- ``ram_probe.py`` is the manual version of the same measurement, for when you
  want to see the number yourself.

Chromium is launched as a grandchild of the calling process
(python -> playwright driver -> chromium), so we walk /proc and sum VmRSS
across all descendants every 100ms. Linux only — same constraint the probe
scripts always had.

Cost model: the figure that matters is the *incremental* cost of one scrape —
peak full-tree RSS minus the Python baseline that was already resident —
because MemAvailable already excludes the running app.
"""
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from scrapper import scrapper


def mem_available_mb() -> float:
    """Free-ish RAM right now, in MB, as the kernel reports it.

    MemAvailable (not MemFree) also counts reclaimable page cache, so it is
    the honest answer to "how much can I allocate before swapping".
    """
    for line in Path("/proc/meminfo").read_text().splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) / 1024  # kB -> MB
    raise RuntimeError("MemAvailable not present in /proc/meminfo")


def _status(pid: int):
    """(ppid, VmRSS in kB) for one pid, or (None, 0) if it vanished."""
    try:
        lines = Path(f"/proc/{pid}/status").read_text().splitlines()
    except OSError:
        return None, 0
    ppid, rss = None, 0
    for line in lines:
        if line.startswith("PPid:"):
            ppid = int(line.split()[1])
        elif line.startswith("VmRSS:"):
            rss = int(line.split()[1])  # kB
    return ppid, rss


def _descendants(root_pid: int):
    """{pid: (ppid, rss_kb)} plus {ppid: [child pids]} for the whole system."""
    procs = {}
    for p in Path("/proc").iterdir():
        if p.name.isdigit():
            ppid, rss = _status(int(p.name))
            if ppid is not None:
                procs[int(p.name)] = (ppid, rss)
    children = {}
    for pid, (ppid, _rss) in procs.items():
        children.setdefault(ppid, []).append(pid)
    return procs, children


def tree_rss(root_pid: int) -> int:
    """Sum RSS (kB) of root_pid and all of its descendants."""
    procs, children = _descendants(root_pid)
    total, stack = 0, [root_pid]
    while stack:
        pid = stack.pop()
        total += procs.get(pid, (0, 0))[1]
        stack.extend(children.get(pid, []))
    return total


def top_descendants(root_pid: int, n: int = 5):
    """The n biggest processes in the tree, as (name, MB), biggest first."""
    procs, children = _descendants(root_pid)
    out, stack = [], [root_pid]
    while stack:
        pid = stack.pop()
        if pid in procs:
            try:
                name = Path(f"/proc/{pid}/comm").read_text().strip()
            except OSError:
                name = "?"
            out.append((name, procs[pid][1] / 1024))
        stack.extend(children.get(pid, []))
    return sorted(out, key=lambda x: -x[1])[:n]


@dataclass
class ScrapeMeasurement:
    """Everything one probe scrape told us about its memory footprint."""

    status: str
    elapsed_s: float
    baseline_mb: float  # python tree before the browser existed
    peak_mb: float  # python + playwright + chromium, at the fattest moment
    peak_at_s: float  # when that peak happened
    top: list = field(default_factory=list)  # [(process name, MB)] at peak

    @property
    def cost_mb(self) -> float:
        """Incremental MB that ONE extra scrape costs this process."""
        return self.peak_mb - self.baseline_mb


def measure_scrape_peak_rss(usn: str, password: str) -> ScrapeMeasurement:
    """Run exactly one scrape while sampling the process tree's RSS.

    Raises whatever ``scrapper`` raises (``LoginError`` for bad credentials,
    Playwright errors if the browser can't start) — callers decide whether a
    failed probe is fatal. For the startup calibration it must NOT be: a site
    that can't be scraped right now is still a site that should boot.
    """
    pid = os.getpid()
    baseline_kb = tree_rss(pid)
    peak = {"kb": 0, "t": 0.0, "top": []}
    stop = threading.Event()
    t0 = time.perf_counter()

    # Live progress: print only on ~50MB jumps so the log shows Chromium
    # filling up without one line per 100ms tick. The counter starts AT the
    # baseline rather than forcing the first sample to print, because that
    # first sample is taken before Chromium exists — printing it would label
    # the Python process itself as "Chromium RSS".
    PRINT_EVERY_KB = 50 * 1024
    last_printed_kb = baseline_kb

    def sampler():
        nonlocal last_printed_kb
        while not stop.is_set():
            kb = tree_rss(pid)
            if kb > peak["kb"]:
                peak.update(
                    kb=kb,
                    t=time.perf_counter() - t0,
                    top=top_descendants(pid),
                )
                if kb - last_printed_kb >= PRINT_EVERY_KB:
                    last_printed_kb = kb
                    print(
                        f"[probe] Chromium RSS {kb / 1024:6.0f} MB"
                        f"  (t={peak['t']:.1f}s)",
                        flush=True,
                    )
            stop.wait(0.1)

    print(
        f"[probe] launching one Chromium to measure its RAM cost "
        f"(python baseline {baseline_kb / 1024:.0f} MB)...",
        flush=True,
    )
    thread = threading.Thread(target=sampler, daemon=True)
    thread.start()
    try:
        data = scrapper(usn, password)
    finally:
        stop.set()
        thread.join(timeout=2)

    measurement = ScrapeMeasurement(
        status=data.get("status", "unknown"),
        elapsed_s=time.perf_counter() - t0,
        baseline_mb=baseline_kb / 1024,
        peak_mb=peak["kb"] / 1024,
        peak_at_s=peak["t"],
        top=peak["top"],
    )

    # One table for both callers: the startup calibration and ram_probe.py.
    print("[probe] ---", flush=True)
    print(f"[probe] status            : {measurement.status}", flush=True)
    print(f"[probe] duration          : {measurement.elapsed_s:.2f}s", flush=True)
    print(f"[probe] baseline (python) : {measurement.baseline_mb:.0f} MB", flush=True)
    print(
        f"[probe] PEAK (full tree)  : {measurement.peak_mb:.0f} MB"
        f"  at t={measurement.peak_at_s:.1f}s",
        flush=True,
    )
    print(
        f"[probe] scrape cost       : {measurement.cost_mb:.0f} MB above baseline",
        flush=True,
    )
    if measurement.top:
        print("[probe] top consumers at peak:", flush=True)
        for name, size in measurement.top:
            print(f"[probe]   {name:<18} {size:6.0f} MB", flush=True)
    print("[probe] ---", flush=True)

    return measurement


def compute_slots(
    available_mb: float, peak_mb: float, safety_mb: int, max_slots: int
) -> int:
    """How many concurrent scrapes fit: free RAM minus safety, divided by one.

    Clamped to [1, max_slots] — a box that looks full still gets one slot
    (the app needs to serve *something*), and a huge box never opens an
    absurd number of browsers at once.
    """
    if peak_mb <= 0:
        # A non-positive per-scrape cost means the measurement is garbage;
        # raise so the caller falls back to the safe default instead of
        # dividing by zero or, worse, dividing a real number by ~0.
        raise ValueError(f"implausible per-scrape cost: {peak_mb} MB")
    usable = available_mb - safety_mb
    slots = int(usable // peak_mb)
    return max(1, min(max_slots, slots))
