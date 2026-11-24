"""
OMNISCIENT AI — Main FastAPI Server (backend/main.py)
Connects all modular capability folders with HTTP Middleware, RESTful API routers,
SQL (PostgreSQL / SQLite) + NoSQL (MongoDB) persistence layers, and LangGraph Supervisor.
"""

from contextlib import asynccontextmanager
import logging
import time
from typing import Any, Dict
import uuid
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from code_review.router import router as code_review_router
from config import get_api_key_settings, get_env
from database import get_db_engine_info, init_db
from document_rag.router import router as document_rag_router
from edtech.router import router as edtech_router
from general_assistant.router import router as general_router
from image_generation.router import router as image_router
from web_research.router import router as research_router

logger = logging.getLogger("omniscient.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="OMNISCIENT AI — Modular Multi-Agent Platform & EdTech LMS",
    version="2.0.0",
    lifespan=lifespan,
)

# 1. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 2. Request Context, Latency & Security Headers Middleware
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled error [%s] %s %s: %s", request_id, request.method, request.url.path, exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error", "request_id": request_id},
        )

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    logger.info("[%s] %s %s -> %s (%.2f ms)", request_id, request.method, request.url.path, response.status_code, duration_ms)
    return response


app.include_router(general_router)
app.include_router(code_review_router)
app.include_router(edtech_router)
app.include_router(image_router)
app.include_router(document_rag_router)
app.include_router(research_router)


@app.get("/api/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    s = get_api_key_settings()
    sql_info = get_db_engine_info()
    mongo_uri = get_env("MONGODB_URI")
    return {
        "status": "healthy",
        "platform": "OMNISCIENT AI",
        "providers": {
            "llm": {
                "provider": s["active_llm_provider"].upper(),
                "model": s["groq_model"] if s["active_llm_provider"] == "groq" else s["gemini_model"],
                "configured": True,
                "instructions": "Groq / Gemini + Built-in Smart Fallback Engine active.",
            },
            "sql_database": sql_info,
            "nosql_mongodb": {
                "engine": "mongodb" if mongo_uri else "mongo-schema-local",
                "driver": "pymongo",
                "configured": True,
            },
            "storage": {
                "provider": "Local Storage (./storage)",
                "configured": True,
                "instructions": "Stores uploaded PDFs, DOCX, PPTX, CSV, and Images.",
            },
        },
    }
