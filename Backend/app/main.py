from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    accounts,
    auth,
    categories,
    goals,
    imports,
    planned,
    recurring,
    settings as settings_router,
    stats,
    tags,
    transactions,
)

app = FastAPI(title="Pocketman API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(recurring.router)
app.include_router(stats.router)
app.include_router(tags.router)
app.include_router(goals.router)
app.include_router(imports.router)
app.include_router(planned.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
