from fastapi import FastAPI
from .routes import fetch_attendance, scrape, leaderboard

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(fetch_attendance.router)
app.include_router(scrape.router)
app.include_router(leaderboard.router)


@app.get("/")
def root():
    return "Server up and running"
