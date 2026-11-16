"""
OMNISCIENT AI — Main FastAPI Server (backend/main.py)
Connects all modular capability folders:
1. general_assistant/ (Unified General AI Chat, Supervisor, Prompt Engine, Auth, Memory)
2. code_review/       (Static Code Review, Big-O Profiler, Stdin Sandbox Execution)
3. edtech/            (Explain Lesson/Tutor, Quizzes, Flashcards, Study Plan, LMS)
4. image_generation/  (Image Studio, Diagram Synthesis, Image Vision/OCR)
5. document_rag/      (PDF/DOCX/PPTX/XLSX/CSV/TXT Extraction, Comparison, RAG Search)
6. web_research/      (Web Research & Cited Reports)
"""

from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from code_review.router import router as code_review_router
from config import get_api_key_settings
from database import init_db
from document_rag.router import router as document_rag_router
from edtech.router import router as edtech_router
from general_assistant.router import router as general_router
from image_generation.router import router as image_router
from web_research.router import router as research_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="OMNISCIENT AI — Modular Multi-Agent Platform & EdTech LMS",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(general_router)
app.include_router(code_review_router)
app.include_router(edtech_router)
app.include_router(image_router)
app.include_router(document_rag_router)
app.include_router(research_router)


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    s = get_api_key_settings()
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
            "image_generation": {
                "provider": "Omniscient SVG & Cloud Image Studio",
                "configured": True,
                "instructions": "Generates architectural diagrams & illustrations.",
            },
            "web_search": {
                "provider": "Omniscient Research Engine",
                "configured": True,
                "instructions": "Synthesizes cited research reports.",
            },
            "storage": {
                "provider": "Local Storage (./storage)",
                "configured": True,
                "instructions": "Stores uploaded PDFs, DOCX, PPTX, CSV, and Images.",
            },
        },
    }
