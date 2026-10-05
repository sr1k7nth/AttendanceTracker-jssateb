from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .config import settings
from .routes import fetch_attendance, scrape, leaderboard, donations, admin
import threading
import logging

# Surface app logs (e.g. the scrape-queue wait times) in dev output and
# `journalctl -u fastapi` on the server.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("startup.slots")

app = FastAPI()


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Never echo request values
    return JSONResponse(status_code=422, content={"detail": "Invalid request data."})


# Upper bound on how long startup may wait for the RAM probe. A healthy probe
# finishes in ~4s, so this is ~15x headroom; its real job is to stop a hung
# portal from holding boot hostage.
PROBE_TIMEOUT_SECONDS = 60.0


def _probe_in_thread(usn: str, password: str):
    """Run the RAM probe on a fresh thread, with a hard time limit.

    Calling ``measure_scrape_peak_rss`` inline does NOT work here, and the
    reason is worth writing down:

    1. Playwright's *Sync* API refuses to start on a thread that already has
       a running event loop — it needs to own the loop — and it raises
       "It looks like you are using Playwright Sync API inside the asyncio
       loop". FastAPI runs this startup hook on uvicorn's event-loop thread.
       A brand-new thread has no running loop, so Playwright creates its own
       and everything proceeds normally.
    2. The ``join`` gives startup a bounded worst case instead of an
       unbounded one: a portal that hangs gets us 1 safe slot, not a boot
       that never completes.

    Returns the measurement; re-raises whatever the probe raised, so the
    caller's existing fallback logic stays unchanged.
    """
    from memory_probe import measure_scrape_peak_rss

    box = {}

    def _target():
        try:
            box["measurement"] = measure_scrape_peak_rss(usn, password)
        except BaseException as exc:  # noqa: BLE001 - forwarded to the caller
            box["error"] = exc

    thread = threading.Thread(target=_target, name="ram-probe", daemon=True)
    thread.start()
    thread.join(timeout=PROBE_TIMEOUT_SECONDS)
    if thread.is_alive():
        # Abandoned, not cancelled: it's a daemon thread, so it dies at
        # interpreter exit and cannot keep the process alive. Its summary
        # table may still show up in the log *after* our fallback line.
        raise TimeoutError(
            f"probe did not finish within {PROBE_TIMEOUT_SECONDS:g}s"
        )
    if "error" in box:
        raise box["error"]
    return box["measurement"]


def _calibrate_scrape_slots():
    """Decide how many scrapes may run at once, before any request is served.

    Runs once per restart (not per request). The semaphore is a module global
    on `routes.scrape`, so reassigning it here is visible to every route — and
    safe, because uvicorn hasn't started serving yet, so no thread can still be
    holding the placeholder we're about to discard.

    Never raises: a site that can't be scraped right now is still a site that
    should boot.
    """
    # Manual mode: the operator already did the maths in .env. No probing.
    if settings.SCRAPE_CONCURRENCY > 0:
        scrape.SCRAPE_SLOTS = threading.BoundedSemaphore(settings.SCRAPE_CONCURRENCY)
        print(
            f"[slots] SCRAPE_CONCURRENCY={settings.SCRAPE_CONCURRENCY} -> manual mode: "
            f"using it as-is, no probe",
            flush=True,
        )
        logger.info(
            "scrape slots: manual mode, SCRAPE_CONCURRENCY=%d",
            settings.SCRAPE_CONCURRENCY,
        )
        return

    # Auto mode needs a test account to measure with.
    if not settings.SCRAPE_PROBE_USN or not settings.SCRAPE_PROBE_PASSWORD:
        print(
            "[slots] SCRAPE_CONCURRENCY=0 -> auto mode, but no "
            "SCRAPE_PROBE_USN/SCRAPE_PROBE_PASSWORD: keeping 1",
            flush=True,
        )
        logger.warning(
            "scrape slots: auto mode but no SCRAPE_PROBE_USN/"
            "SCRAPE_PROBE_PASSWORD — keeping the safe default of 1"
        )
        # Assign rather than rely on the import-time placeholder already being 1:
        # the message promises 1, so make it true whatever came before.
        scrape.SCRAPE_SLOTS = threading.BoundedSemaphore(1)
        return

    print("[slots] SCRAPE_CONCURRENCY=0 -> auto mode", flush=True)
    try:
        from memory_probe import compute_slots, mem_available_mb

        available_mb = mem_available_mb()
        measurement = _probe_in_thread(
            settings.SCRAPE_PROBE_USN, settings.SCRAPE_PROBE_PASSWORD
        )
        if measurement.status != "success":
            # "portal down" / "error" — the browser ran but told us nothing
            # useful, so its footprint isn't trustworthy. Fall back.
            raise RuntimeError(f"probe scrape returned {measurement.status!r}")
        usable_mb = available_mb - settings.SCRAPE_SAFETY_MB
        slots = compute_slots(
            available_mb,
            measurement.cost_mb,
            settings.SCRAPE_SAFETY_MB,
            settings.SCRAPE_MAX_SLOTS,
        )
    except Exception as exc:
        print(
            f"[slots] calibration failed ({type(exc).__name__}: {exc}) -> keeping 1",
            flush=True,
        )
        logger.warning(
            "scrape slots: calibration failed (%s: %s) — keeping the safe "
            "default of 1",
            type(exc).__name__,
            exc,
        )
        scrape.SCRAPE_SLOTS = threading.BoundedSemaphore(1)
        return

    capped = " (capped at SCRAPE_MAX_SLOTS=%d)" % settings.SCRAPE_MAX_SLOTS if slots == settings.SCRAPE_MAX_SLOTS else ""
    print(
        f"[slots] auto-calibration: {available_mb:.0f} MB free - "
        f"{settings.SCRAPE_SAFETY_MB} MB safety = {usable_mb:.0f} MB / "
        f"{measurement.cost_mb:.0f} MB per scrape = {slots} slots{capped}",
        flush=True,
    )
    print(f"[slots] SCRAPE_SLOTS set to {slots} concurrent browser slots", flush=True)
    scrape.SCRAPE_SLOTS = threading.BoundedSemaphore(slots)
    logger.info(
        "scrape slots: calibrated -> available %.0fMB, one scrape %.0fMB "
        "(peak %.0fMB, baseline %.0fMB), safety %dMB => slots=%d",
        available_mb,
        measurement.cost_mb,
        measurement.peak_mb,
        measurement.baseline_mb,
        settings.SCRAPE_SAFETY_MB,
        slots,
    )


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)
    # After the schema is ready: size the scrape queue before uvicorn accepts
    # its first request (blocking here is intentional — see the docstring).
    _calibrate_scrape_slots()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(fetch_attendance.router)
app.include_router(scrape.router)
app.include_router(leaderboard.router)
app.include_router(donations.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return "Server up and running"
