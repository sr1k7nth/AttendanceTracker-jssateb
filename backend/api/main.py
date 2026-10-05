from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .config import settings
from .routes import fetch_attendance, scrape, leaderboard, donations, admin
import logging

# Surface app logs (e.g. scrape durations) in dev output and
# `journalctl -u fastapi` on the server.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# httpx logs every request URL at INFO, and the portal pre-check carries the
# USN and the RSA'd password in its query string. Keep credentials out of
# journalctl.
logging.getLogger("httpx").setLevel(logging.WARNING)

app = FastAPI()


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Never echo request values
    return JSONResponse(status_code=422, content={"detail": "Invalid request data."})


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)

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
