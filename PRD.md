# Product Requirements Document (PRD) — OMNISCIENT AI

**Version:** 2.0.0  
**Product Name:** OMNISCIENT AI — Unified Multi-Agent & Multimodal AI Workspace  
**Platform Stack:** FastAPI (Python) + LangGraph + Groq/Gemini LLM + React/TypeScript (Vite + Tailwind CSS) + SQLite  

---

## 1. Executive Summary & Vision

**OMNISCIENT AI** is a modular, multi-agent AI workspace designed to unify everyday knowledge work, software engineering, and structured education into a single, cohesive web platform. Instead of forcing learners, engineers, and researchers to switch between disconnected tools for chat, document Q&A, web research, code debugging, and coursework, OMNISCIENT AI routes user intent through a central **LangGraph Supervisor** and pairs it with dedicated **Code Review** and **EdTech LMS** workspaces.

### Core Value Propositions
1. **Prompt Clarity & Multi-Capability Orchestration:** A 5-Stage Intelligent Prompt Template Engine transforms brief or ambiguous requests into structured `ROLE / TASK / REQUIREMENTS / OUTPUT FORMAT / DIFFICULTY` specifications and dispatches compound workflows (e.g., summarizing a PDF + generating MCQs, or analyzing an uploaded image + researching on the web) in a single turn.
2. **Grounded, Verifiable Outputs:** Document Intelligence (`[CIT-N]`), Multi-Document Comparison (`[CMP-1]`), and DuckDuckGo Web Research (`[WEB-N]`) attach explicit source excerpts and execution traces visible in the Execution Telemetry drawer.
3. **Interactive Engineering & Pedagogical Workspaces:** Standalone IDE-grade static/AI code review with isolated `stdin`-enabled Python execution, alongside a full EdTech Learning Management System (AI Tutor, Study Planner, Flashcards, Course Builder, Quizzes, and Rubric Grading).
4. **Offline-Resilient Fallback:** Every core workflow degrades gracefully to the built-in `omniscient-structured-engine` pedagogical generator and local SVG diagram studio when external API keys are absent or offline.

---

## 2. Target Personas & User Needs

| Persona | Primary Goals | Key Pain Points Solved |
|---------|---------------|------------------------|
| **University Student / Self-Learner** | Understand complex CS/STEM concepts quickly, revise uploaded lecture slides/PDFs, practice with quizzes and flashcards. | Fragmented study tools; generic LLM answers without analogies, pitfall tables, or grounded PDF citations. |
| **Software Engineer / Developer** | Review code for security flaws and logical bugs, estimate Big-O complexity, test snippets with custom `stdin` input. | Manual security/AST checks; needing a fast sandbox that handles `input()` cleanly without external setup. |
| **Educator / Course Creator** | Author structured multi-module courses, generate quizzes/assignments, and grade submissions consistently against rubrics. | Time-consuming curriculum drafting and repetitive rubric-based feedback. |

---

## 3. Scope & Core Product Capabilities

OMNISCIENT AI is organized around **three primary destinations** plus **shared history and workspace configuration**:

### 3.1 Destination 1: General AI Workspace (`general-ai`)
- **FR-1.1 Multi-Turn Conversational Chat:** Persistent conversations stored in SQLite (`conversations`, `messages`) with Markdown, syntax-highlighted code blocks, and KaTeX mathematical rendering.
- **FR-1.2 5-Stage Intelligent Prompt Template Engine:**
  - *Stage 1:* Accept raw user prompt and optional attached file IDs.
  - *Stage 2:* Analyze intent, task, topic, output format, target audience, and required backend capabilities (`vision_model`, `document_rag`, `document_comparison`, `image_generation`, `web_research`, `general_llm`).
  - *Stage 3:* Generate an optimized structured prompt (`ROLE`, `TASK`, `REQUIREMENTS`, `OUTPUT FORMAT`, `DIFFICULTY`) via LLM or deterministic fallback.
  - *Stage 4 & 5:* Execute selected capabilities via the LangGraph `StateGraph` supervisor and synthesize a formatted response with grounded citations.
  - Expose standalone preview optimization via `POST /api/prompt-templates/optimize`.
- **FR-1.3 Prompt Template Library (`PromptLibraryModal`):**
  - Provide 39+ built-in templates across **6 core categories** (`EDUCATION`, `PROGRAMMING`, `DOCUMENTS`, `RESEARCH`, `WRITING`, `IMAGE AND CREATIVE`) plus `CUSTOM`.
  - Support keyword search, category filtering, usage counting (`use_count`, `last_used_at`), recently-used tracking (top 6), and full CRUD for user-created custom templates.
- **FR-1.4 Document Intelligence, RAG & Multi-File Comparison (`document_rag`):**
  - Upload and extract text/metadata from `PDF` (PyMuPDF), `DOCX` (python-docx), `PPTX` (python-pptx), `XLSX` (openpyxl), `CSV` (pandas), `TXT`, and images (`PNG`, `JPG`, `JPEG`, `WEBP`).
  - Chunk extracted text into ~600-character segments, extract top key concepts, and retrieve top-`k` chunks scored by token overlap with `[CIT-N]` citations.
  - Support side-by-side comparison of two uploaded documents or spreadsheets (`[CMP-1]`).
- **FR-1.5 Image Vision & Diagram Generation (`image_generation`):**
  - Analyze uploaded images using Pillow (resolution, format, color mode, grayscale luminance/contrast) combined with LLM structural explanation.
  - Generate educational/architectural visual diagrams (800×450 metallic-gold-on-black SVG synthesis with cloud Imagen provider support when `IMAGE_GENERATION_API_KEY` is configured).
- **FR-1.6 Live Web Research (`web_research`):**
  - Query live web sources via DuckDuckGo (`ddgs`) with automatic fallback to curated Wikipedia, GeeksforGeeks, and arXiv search links when offline, producing `[WEB-N]` citations and structured comparison tables.
- **FR-1.7 User-Approved Persistent Memory:**
  - Allow users to create, approve/toggle, and delete persistent memory entries (`memories` table) injected into the General AI system prompt only when `is_user_approved = 1`.
- **FR-1.8 Execution Telemetry & Export:**
  - Collapsible right-hand telemetry drawer displaying current intent, step-by-step `workflow_trace`, grounded `citations`, and `recentExecutions`.
  - One-click export of the active conversation to `.md` file.

### 3.2 Destination 2: Code Review & IDE Sandbox (`code-review`)
- **FR-2.1 Language Detection & Multi-Language Review:** Auto-detect `python`, `java`, `cpp`, `c`, `javascript`, or `typescript` (or accept explicit language selection).
- **FR-2.2 Static AST & Pattern Security Scanner:**
  - Python AST inspection for `eval()`/`exec()`, mutable default arguments (`[]`, `{}`, `set()`), bare `except:` clauses, and syntax errors.
  - Cross-language regex scanning for hardcoded credentials (`api_key`, `secret`, `password`, `token`), SQL injection string concatenation, and C/C++ `gets`/`strcpy` buffer overflow risks.
- **FR-2.3 AI Deep Review, Complexity Profiling & Remediation:**
  - Estimate Big-O time and space complexity (`time_complexity`, `space_complexity` with explanations).
  - Merge static findings with Groq LLM-detected logical/edge-case issues and return ready-to-run `corrected_code`.
- **FR-2.4 Isolated Python Sandbox with `stdin` Support:**
  - Enforce an AST pre-execution security guard blocking forbidden modules (`os`, `subprocess`, `socket`, `shutil`, `ctypes`, `urllib`, `http`, `ftplib`) and builtins (`eval`, `exec`, `compile`, `__import__`, `open`).
  - Execute code inside a temporary directory using `python -I` (isolated mode) with a 5-second timeout, capped stdout/stderr (8,000 chars), interactive `stdin` piping for `input()`, and helpful `EOFError` hints.

### 3.3 Destination 3: EdTech LMS (`edtech-lms`)
- **FR-3.1 AI Lesson Tutor:** Generate 5-section structured explanations (`Core Intuition`, `Real-World Analogy`, `In-Depth Breakdown`, `Common Misconceptions & Pitfalls`, `Key Takeaways Checklist`) at `beginner`, `intermediate`, or `advanced` difficulty.
- **FR-3.2 Personalized Study Planner:** Generate day-by-day study schedules (`1–14` days, configurable daily minutes) split across study (40%), worked examples/coding (40%), and active recall (20%).
- **FR-3.3 Flashcards:** Generate and persist topic flashcards (`front_question`, `back_answer`, `difficulty`, `mastery_level`).
- **FR-3.4 Courses & AI Curriculum Creator:** List courses, enroll (`POST /api/enrollments`), generate multi-module course blueprints via AI (`POST /api/courses/ai-generate`), and update/publish drafts (`PATCH /api/courses/{course_id}`).
- **FR-3.5 Quizzes, Automated Grading & Assignment Rubrics:**
  - Generate MCQ / True-False quizzes (`1–30` questions) and persist to `quizzes`.
  - Grade quiz attempts (`POST /api/quizzes/{quiz_id}/attempt`) returning score, percentage, letter grade (`A–F`), and `weak_topics_flagged`.
  - List assignments, submit student work, and compute AI rubric scores and feedback (`POST /api/submissions`).

### 3.4 Platform Services: Auth, History & Settings
- **FR-4.1 Authentication & Profile:** Email/password signup and login with SHA-256 password hashing and bearer token (`omni-token-{user_id}`), plus profile editing (name, institution, department, bio, password).
- **FR-4.2 Conversation History Management (`history`):** Browse past conversations, resume any session in General AI, delete individual chats, or clear all history.
- **FR-4.3 Runtime Settings & Key Management (`settings`):** View masked API keys, switch active LLM provider/model (`groq` / `gemini`), save updates directly to the root `.env` file, and test live LLM latency (`POST /api/settings/api-keys/test`).

---

## 4. Non-Functional Requirements

| Category | Requirement | Implementation Target |
|----------|-------------|-----------------------|
| **Reliability & Resilience** | Platform remains functional without external API keys or internet access. | Automatic Groq model fallback chain (`openai/gpt-oss-120b` → `llama-3.3-70b-versatile` → `openai/gpt-oss-20b` → `llama-3.1-8b-instant`) + `omniscient-structured-engine` + SVG image synthesis + fallback search links. |
| **Security & Sandboxing** | Untrusted code and documents must not compromise host or prompt integrity. | Python `-I` isolated subprocess, 5s execution timeout, AST import/builtin blocklist, prompt injection warning in supervisor system prompt, masked API keys in responses. |
| **Modularity** | Capabilities must be independently maintainable and testable. | Domain-isolated `backend/<module>/{agent.py, router.py}` and `frontend/src/<module>/` structure. |
| **Persistence** | User data, chats, templates, documents, and LMS state persist across restarts. | Local SQLite (`omniscient.db`) with schema auto-initialization & column migrations + `./storage/` file store. |
| **Testability** | End-to-end verification of all core modules. | Automated `pytest` suite (`backend/tests/test_omniscient.py`) covering prompt optimization, RAG, vision, image gen, web research, CSV comparison, templates, code review/sandbox, EdTech LMS, and memory/chat persistence. |

---

## 5. Success Metrics & Acceptance Criteria

- **Validation & Test Coverage:** All 10 functional areas in `backend/tests/test_omniscient.py` pass without error.
- **Zero-Config Startup:** Application boots cleanly via `start.ps1` / `start.bat` with automatic DB initialization (`init_db()`) and seeded default user (`user@omniscient.ai`), course (`CS-401`), quiz, assignment, flashcards, and 39+ prompt templates.
- **Interactive Code Sandbox Accuracy:** Programs calling `input()` succeed when `stdin` is supplied and fail cleanly with diagnostic hints when `stdin` is exhausted or restricted imports are attempted.
- **Grounded Citations:** Document RAG queries and web research queries always return structured citation objects (`CIT-N` / `WEB-N` / `CMP-1`) surfaced both inline and in the telemetry panel.
