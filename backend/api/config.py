from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")  # pyright: ignore
    DATABASE_HOSTNAME: str
    DATABASE_PORT: int
    DATABASE_USERNAME: str
    DATABASE_PASSWORD: str
    DATABASE_NAME: str
    ENCRYPTION_KEY: str
    JWT_SECRET_KEY: str
    OAUTH_ALGORITHM: str
    CORS_ORIGINS: str = "http://localhost:3000"
    # --- scraping slots ---------------------------------------------------
    # How many live Chromium scrapes may run at once (each one is a browser,
    # hundreds of MB of RAM). Three startup paths:
    #
    #   > 0 (e.g. 1)  MANUAL — use this number as-is, no probing at all.
    #                 This is the old behaviour; existing .env files keep it.
    #   = 0           AUTO (default) — at startup the app runs ONE test
    #                 scrape, measures its real RAM cost, reads free memory
    #                 from /proc/meminfo and computes the slot count itself.
    #                 Re-measures on every restart.
    #   auto + failed  FALLBACK — if the probe can't run (no credentials,
    #                 portal down, timeout), log a warning and boot with 1.
    #
    # The app NEVER checks RAM per-request; measurement happens only at boot.
    SCRAPE_CONCURRENCY: int = Field(default=0, ge=0)
    # Test-account credentials used by the startup probe (auto mode only).
    # A raw scrapper() call: it writes no DB rows and touches no daily quota.
    # Leave empty to disable auto mode's probing (falls back to 1).
    SCRAPE_PROBE_USN: str = ""
    SCRAPE_PROBE_PASSWORD: str = ""
    # RAM held back for Postgres + Python + OS before dividing up the rest.
    SCRAPE_SAFETY_MB: int = Field(default=200, ge=0)
    # Ceiling on auto-calculated slots, however big the box is. Deliberately
    # generous so RAM decides in practice: this only ever LOWERS the answer
    # (compute_slots does min(max_slots, ram_slots)), so it never fires unless
    # something is wrong -- a bad measurement, or an absurd future box. Tune it
    # DOWN per box via .env if you ever want fewer browsers than RAM allows.
    SCRAPE_MAX_SLOTS: int = Field(default=32, ge=1)

    # --- donations / supporters ------------------------------------------
    DONATION_GOAL: int = 500
    # Admin panel HTTP Basic credentials. Left empty = admin routes answer
    # 503 "not configured" instead of letting anyone in (safe deploy default).
    ADMIN_PANEL_USERNAME: str = ""
    ADMIN_PANEL_PASSWORD: str = ""
    # Daily scrape quota — premium (supporters) get more.
    # 4/day for now to onboard users; flip to 2 later via .env (one line, no code).
    FREE_REQUESTS_PER_DAY: int = 4
    SUPPORTER_REQUESTS_PER_DAY: int = 6

    @property
    def database_url(self):
        return f"postgresql://{self.DATABASE_USERNAME}:{self.DATABASE_PASSWORD}@{self.DATABASE_HOSTNAME}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"


settings = Settings()  # pyright: ignore
