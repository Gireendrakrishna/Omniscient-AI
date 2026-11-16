# OMNISCIENT AI
### Unified Multi-Agent & Multimodal AI Workspace

OMNISCIENT AI is a modular AI platform coordinated by a central **LangGraph Supervisor** across three primary destinations:

1. **General AI** — Unified conversational workspace combining Multi-Turn Chat, Document Intelligence (`PDF`, `DOCX`, `PPTX`, `XLSX`, `CSV`, `TXT`), Image Vision (`PNG`, `JPG`, `JPEG`, `WEBP`), Image Generation, Live Web Research (`ddgs`), RAG with `[CIT-N]` citations, a **5-Stage Prompt Template Engine**, and a **Prompt Template Library**.
2. **Code Review** — Standalone IDE Code Studio with line numbers, `stdin` / `input()` support, AST security & bug scanning, Big-O complexity profiler, corrected code generation, and isolated sandbox execution.
3. **EdTech LMS** — Standalone educational workspace featuring AI Lesson Tutor, Study Planner, Interactive Flashcards, AI Course Creator, AI Quiz Generator, and AI Rubric Grading.

---

## 1. Project Structure

```
omniscient/
├── .env                          # Single environment file holding all API keys
├── start.bat / start.ps1         # One-click backend + frontend launchers
├── backend/
│   ├── main.py                   # FastAPI application entrypoint
│   ├── config.py                 # .env settings & Groq tool-calling engine
│   ├── database.py               # SQLite database initialization (omniscient.db)
│   ├── general_assistant/        # Unified Supervisor, Prompt Engine, Auth & Chat API
│   ├── code_review/              # Static AST Code Review & Stdin Sandbox
│   ├── edtech/                   # AI Tutor, Quizzes, Flashcards, Courses
│   ├── document_rag/             # Document extraction, comparison & RAG citations
│   ├── image_generation/         # SVG/Cloud diagram generation & Vision analysis
│   ├── web_research/             # DuckDuckGo live web search & citations
│   └── tests/                    # Automated test suite
└── frontend/src/
    ├── App.tsx                   # Main shell, sidebar & view router
    ├── api.ts                    # REST API helper
    ├── general_ai/               # General AI Chat & Prompt Library UI
    ├── code_review/              # Code Review & Sandbox IDE UI
    ├── edtech/                   # EdTech LMS UI
    ├── history/                  # Conversation History UI
    ├── settings/                 # Login/Signup, Profile, API Keys & Memory UI
    └── shared/                   # Shared Markdown & LaTeX renderer
```

---

## 2. Quick Start

### Step 1: Configure `.env`
Copy `.env.example` to `.env` and add your Groq or Gemini API key (or configure keys directly inside **Settings** in the UI).

### Step 2: Launch Backend & Frontend
Run `.\start.ps1` (or double-click `start.bat`), or start manually:
```powershell
.\.venv\Scripts\uvicorn.exe main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
npm run dev --prefix frontend
```
- **Web UI**: `http://localhost:5173`
- **API Docs**: `http://127.0.0.1:8000/docs`

### Step 3: Run Automated Tests
```powershell
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m pytest backend/tests/test_omniscient.py -v -p no:langsmith -p no:anyio -p no:asyncio
```
