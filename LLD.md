# Low-Level Design (LLD) — OMNISCIENT AI

**Version:** 2.0.0  
**Scope:** Module structure, database schemas, REST API contracts, core algorithms, and frontend component design.

---

## 1. Repository & Module Map

```text
omniscient/
├── .env / .env.example              # Runtime API keys & active LLM provider config
├── start.ps1 / start.bat            # Backend (:8000) + Frontend (:5173) launcher scripts
├── omniscient.db                    # SQLite database (auto-initialized on startup)
├── storage/                         # Uploaded user documents & images ({doc_id}_{filename})
├── backend/
│   ├── main.py                      # FastAPI app, CORS, router mounting, /api/health
│   ├── config.py                    # .env I/O, Groq tool-calling loop, model fallback, structured engine
│   ├── database.py                  # SQLite schema DDL, migrations, default seed data
│   ├── requirements.txt             # Python package dependencies
│   ├── general_assistant/
│   │   ├── prompt_engine.py         # 39 built-in templates, template CRUD, 5-stage prompt optimizer
│   │   ├── agent.py                 # LangGraph StateGraph Supervisor & 7 OMNISCIENT_AGENT_TOOLS
│   │   └── router.py                # Auth, chat, conversations, memories, keys, prompt templates APIs
│   ├── code_review/
│   │   ├── agent.py                 # Language detection, AST/regex/AI review, python -I stdin sandbox
│   │   └── router.py                # /api/code-review, /api/code-execution
│   ├── edtech/
│   │   ├── agent.py                 # Tutor, quiz, flashcards, study plan, course blueprint, rubric eval
│   │   └── router.py                # LMS REST APIs (/api/courses, /api/quizzes, /api/submissions, etc.)
│   ├── document_rag/
│   │   ├── agent.py                 # Multi-format extraction, 600-char chunking, RAG, doc comparison
│   │   └── router.py                # /api/files*, /api/documents*, /api/rag/query
│   ├── image_generation/
│   │   ├── agent.py                 # SVG diagram synthesis & Pillow vision analysis
│   │   └── router.py                # /api/images/generate, /api/images, /api/images/analyze
│   ├── web_research/
│   │   ├── agent.py                 # DuckDuckGo (ddgs) search + cited report synthesis
│   │   └── router.py                # /api/research
│   └── tests/
│       └── test_omniscient.py       # End-to-end automated verification suite
└── frontend/src/
    ├── App.tsx                      # Root shell, sidebar, nav router, telemetry drawer
    ├── api.ts                       # apiRequest() wrapper & localStorage token helpers
    ├── general_ai/                  # GeneralAiView.tsx, PromptLibraryModal.tsx
    ├── code_review/                 # CodeReviewView.tsx
    ├── edtech/                      # EdTechView.tsx
    ├── history/                     # HistoryView.tsx
    ├── settings/                    # SettingsView.tsx, AuthModal.tsx
    └── shared/                      # MarkdownRenderer.tsx
```

---

## 2. Database Schema (`backend/database.py`)

`init_db()` creates 13 tables in `omniscient.db` and runs additive `ALTER TABLE` migrations on `users` and `messages` for backward compatibility.

| Table | Primary Key | Key Columns & Types | Purpose |
|-------|-------------|---------------------|---------|
| `users` | `id TEXT` | `email TEXT UNIQUE`, `password_hash TEXT`, `full_name TEXT`, `role TEXT`, `institution TEXT`, `department TEXT`, `bio TEXT`, `streak INTEGER`, `created_at TEXT` | User accounts & profile metadata |
| `conversations` | `id TEXT` | `user_id TEXT`, `title TEXT`, `active_agent TEXT`, `updated_at TEXT` | Chat session metadata |
| `messages` | `id TEXT` | `conversation_id TEXT`, `sender_role TEXT`, `agent_name TEXT`, `content TEXT`, `citations_json TEXT`, `trace_json TEXT`, `attachments_json TEXT`, `optimized_prompt TEXT`, `created_at TEXT` | Turn-by-turn messages, citations, traces, attachments |
| `prompt_templates` | `id TEXT` | `user_id TEXT`, `category TEXT`, `title TEXT`, `description TEXT`, `prompt_text TEXT`, `is_custom INTEGER`, `use_count INTEGER`, `last_used_at TEXT`, `created_at TEXT` | Built-in & custom prompt templates |
| `memories` | `id TEXT` | `user_id TEXT`, `key TEXT`, `content TEXT`, `memory_type TEXT`, `is_user_approved INTEGER`, `updated_at TEXT` | Persistent user preferences/facts |
| `documents` | `id TEXT` | `user_id TEXT`, `title TEXT`, `doc_type TEXT`, `file_path TEXT`, `file_size INTEGER`, `page_count INTEGER`, `extracted_text TEXT`, `summary TEXT`, `key_concepts_json TEXT`, `chunks_json TEXT`, `created_at TEXT` | Uploaded files, extracted text, concepts & chunks |
| `generated_images` | `id TEXT` | `user_id TEXT`, `original_prompt TEXT`, `enhanced_prompt TEXT`, `style TEXT`, `provider TEXT`, `image_url TEXT`, `status TEXT`, `created_at TEXT` | Generated SVG/cloud images (`data:image/svg+xml;base64,...`) |
| `courses` | `id TEXT` | `title TEXT`, `code TEXT`, `description TEXT`, `difficulty TEXT`, `is_published INTEGER`, `is_enrolled INTEGER`, `modules_json TEXT`, `created_at TEXT` | LMS courses & nested module/lesson JSON |
| `quizzes` | `id TEXT` | `course_id TEXT`, `title TEXT`, `difficulty TEXT`, `time_limit_minutes INTEGER`, `questions_json TEXT`, `created_at TEXT` | LMS quizzes & question banks |
| `assignments` | `id TEXT` | `course_id TEXT`, `title TEXT`, `description TEXT`, `max_score REAL`, `rubric_json TEXT`, `created_at TEXT` | Course assignments & rubrics |
| `submissions` | `id TEXT` | `assignment_id TEXT`, `assignment_title TEXT`, `student_id TEXT`, `content TEXT`, `score REAL`, `ai_evaluation_json TEXT`, `status TEXT`, `submitted_at TEXT` | Student assignment submissions & AI evaluations |
| `flashcards` | `id TEXT` | `user_id TEXT`, `topic TEXT`, `front_question TEXT`, `back_answer TEXT`, `difficulty TEXT`, `mastery_level INTEGER`, `created_at TEXT` | Study flashcards |
| `agent_executions` | `id TEXT` | `agent_slug TEXT`, `task_description TEXT`, `status TEXT`, `duration_ms INTEGER`, `started_at TEXT` | Telemetry log of agent execution steps |

### Default Seed Data (`init_db()` when `users` count == 0)
- **User:** `u-default` (`user@omniscient.ai`, `Alex Rivera`, SHA-256 hashed password).
- **Course:** `course-1` (`CS-401` — *Agentic AI Systems & Full-Stack Engineering*).
- **Quiz:** `quiz-1` (2 questions on Supervisor Agent & RAG).
- **Assignment:** `assign-1` (100 pts, 2-criterion rubric).
- **Flashcards:** 3 cards covering Supervisor Agent, RAG Pipeline, and Code Review Agent.

---

## 3. REST API Contract

### 3.1 System & Auth (`main.py`, `general_assistant/router.py`)
| Method | Endpoint | Request Body / Params | Response Summary |
|--------|----------|-----------------------|------------------|
| `GET` | `/api/health` | — | Platform status, active LLM provider & model, storage info |
| `POST` | `/api/auth/signup` | `SignupRequest(full_name, email, password, institution?, department?, bio?)` | `access_token` (`omni-token-{uid}`), `token_type`, `user` |
| `POST` | `/api/auth/login` | `LoginRequest(email, password?)` | `access_token`, `token_type`, `user` |
| `GET` | `/api/auth/me` | `Authorization` header | `{ user }` |
| `PUT` | `/api/auth/profile` | `ProfileUpdateRequest(full_name?, institution?, department?, bio?, new_password?)` | `{ user }` |

### 3.2 General AI, History, Memory & Settings (`general_assistant/router.py`)
| Method | Endpoint | Request Body / Params | Response Summary |
|--------|----------|-----------------------|------------------|
| `GET` | `/api/agents` | — | List of 6 agent metadata descriptors |
| `POST` | `/api/chat` | `ChatRequest(prompt, conversation_id?, agent?, attached_file_ids?)` | `conversation_id`, `message_id`, `run_id`, `intent`, `prompt_analysis`, `optimized_prompt`, `capabilities_used`, `workflow_trace`, `citations`, `generated_images`, `response` |
| `GET` | `/api/conversations` | — | List of conversations with `message_count` |
| `GET` | `/api/conversations/{id}/messages` | Path `conversation_id` | `{ conversation, messages[] }` |
| `DELETE` | `/api/conversations/{id}` | Path `conversation_id` | `{ deleted: true, conversation_id }` |
| `DELETE` | `/api/conversations` | — | `{ cleared: true }` |
| `GET` | `/api/agents/executions` | — | Latest 20 rows from `agent_executions` |
| `GET` | `/api/memory` | — | `{ memories[] }` |
| `POST` | `/api/memory` | `MemoryCreateRequest(key, content, memory_type, is_user_approved)` | `{ memory }` |
| `PATCH` | `/api/memory/{id}` | `MemoryUpdateRequest(is_user_approved?, content?)` | `{ updated: true }` |
| `DELETE` | `/api/memory/{id}` | Path `memory_id` | `{ deleted: true }` |
| `GET` | `/api/settings/api-keys` | — | Masked keys + active provider/model |
| `POST` | `/api/settings/api-keys` | `ApiKeyUpdateRequest(...)` | Updates root `.env` & `os.environ`, returns masked settings |
| `POST` | `/api/settings/api-keys/test` | — | Latency ms, active provider/model, test reply |
| `GET` | `/api/prompt-templates` | Query `search`, `category` | `templates[]`, `recently_used[]`, `categories[]` |
| `POST` | `/api/prompt-templates` | `PromptTemplateCreateRequest(title, category, description, prompt_text)` | `{ template }` |
| `PUT` | `/api/prompt-templates/{id}` | `PromptTemplateUpdateRequest(...)` | `{ template }` |
| `DELETE` | `/api/prompt-templates/{id}` | Path `template_id` | `{ deleted: true, template_id }` |
| `POST` | `/api/prompt-templates/{id}/use` | Path `template_id` | Increments `use_count`, updates `last_used_at` |
| `POST` | `/api/prompt-templates/optimize` | `PromptOptimizeRequest(prompt, attached_file_ids?)` | Stage 2 & 3 prompt analysis JSON |

### 3.3 Code Review, Document RAG, Image Studio, Web Research & EdTech
| Method | Endpoint | Request Body | Response Summary |
|--------|----------|--------------|------------------|
| `POST` | `/api/code-review` | `CodeReviewRequest(code, language?)` | `language`, `summary`, `issues_count`, `issues[]`, `time_complexity`, `space_complexity`, `corrected_code` |
| `POST` | `/api/code-execution` | `CodeExecRequest(code, language, stdin)` | `success`, `stdout`, `stderr`, `exit_code`, `execution_time_ms`, `sandbox_mode` |
| `POST` | `/api/files/upload` | `UploadFile` (`multipart/form-data`) | `file`, `document`, `rag_index` |
| `GET` | `/api/files` | — | Uploaded file list |
| `GET` | `/api/documents` | — | Extracted document summaries, key concepts, chunk counts |
| `POST` | `/api/rag/query` | `RagQueryRequest(query, top_k=4)` | `answer`, `citations[]`, `grounded` |
| `POST` | `/api/documents/compare` | `DocCompareRequest(document_id_a, document_id_b)` | `{ comparison: { report_markdown, shared_concepts } }` |
| `POST` | `/api/images/generate` | `ImageGenRequest(prompt, style)` | `success`, `output`, `image` |
| `GET` | `/api/images` | — | Latest 30 generated images |
| `POST` | `/api/images/analyze` | `ImageAnalyzeRequest(file_id, prompt)` | `success`, `output`, `image_metadata` |
| `POST` | `/api/research` | `ResearchRequest(query)` | `success`, `output`, `citations[]`, `sources[]` |
| `GET` / `POST` / `PATCH` | `/api/courses*`, `/api/enrollments` | `CourseGenRequest`, `CourseUpdateRequest`, `EnrollRequest` | Course listing, enrollment, AI blueprint generation, publish update |
| `GET` / `POST` | `/api/quizzes*` | `QuizGenRequest`, `QuizAttemptRequest` | Quiz list, AI generation, attempt scoring & weak-topic flagging |
| `GET` / `POST` | `/api/assignments`, `/api/submissions` | `SubmissionRequest(assignment_id, content)` | Assignment list, submission storage & AI rubric scoring |
| `GET` / `POST` | `/api/flashcards*` | `FlashcardGenRequest(topic, count, difficulty, save)` | Flashcards list & AI card generation |
| `POST` | `/api/analytics/tutor`, `/api/analytics/study-plan` | `TutorRequest`, `StudyPlanRequest` | 5-section lesson markdown; N-day study schedule |
| `GET` | `/api/edtech/metrics` | — | Enrolled count, average grade, streak, flashcards count |

---

## 4. Core Module Design & Algorithms

### 4.1 Groq Tool-Calling Engine (`backend/config.py`)
- `run_groq_agent_loop(conversation, system_prompt, tools, tool_dispatch, max_turns=5)`:
  1. Checks `len(GROQ_API_KEY) > 8`; creates `Groq(api_key=..., timeout=8.0, max_retries=0)`.
  2. Loops up to `max_turns` calling `_call_groq_with_fallback()` across `[preferred_model, "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"]`.
  3. On HTTP `401` / `invalid_api_key`, breaks early to avoid wasted retries.
  4. When `message.tool_calls` is present, deserializes `tc.function.arguments`, invokes `tool_dispatch[fn_name](**fn_args)`, appends `role: "tool"` messages, and records `executed_tools`.
  5. On missing/invalid key or exception, falls back to `build_rich_structured_response(last_user_prompt)` (`provider="omniscient-structured-engine"`).

### 4.2 5-Stage Prompt Engine & LangGraph Supervisor (`general_assistant/`)
- **`optimize_and_analyze_prompt(raw_prompt, attached_files)`:**
  - Capability detection rules:
    - `vision_model`: attached file has `doc_type` in `("image", "png", "jpg", "jpeg", "webp")` OR prompt mentions `"screenshot"`, `"explain this image"`, `"analyze this image"`, `"ocr"`, `"diagram in this image"`.
    - `document_comparison`: `len(attached_files) >= 2` (non-image) OR `"compare"` with file context.
    - `document_rag`: non-image file attached OR prompt mentions `"pdf"`, `"docx"`, `"pptx"`, `"xlsx"`, `"csv"`, `"spreadsheet"`, `"uploaded"`, `"document"`.
    - `image_generation`: `"generate an image"`, `"create an image"`, `"draw a diagram"`, `"generate a diagram"`, `"create an illustration"`.
    - `web_research`: `"research"`, `"latest developments"`, `"search the web"`, `"compare sources"`, `"fact check"`, `"current information"`.
    - `general_llm`: default or when summarization/explanation/MCQ/code/translation keywords appear.
  - Invokes `ask_llm` for JSON extraction (`intent`, `task`, `topic`, `output_format`, `target_audience`, `optimized_prompt`) with deterministic template synthesis fallback.
- **`UNIFIED_SUPERVISOR_GRAPH` (`StateGraph(UnifiedGraphState)`):**
  - Nodes: `optimize_prompt` -> `execute_capabilities` -> `END`.
  - `_node_execute_capabilities` runs matched capabilities sequentially (`vision_model`, `document_comparison`, `document_rag`, `image_generation`, `web_research`, `general_llm`), appends trace steps to `agent_executions`, and joins `direct_outputs` with `"\n\n---\n\n"`.

### 4.3 Code Review & Sandbox (`backend/code_review/agent.py`)
- **`review_code(code, language_hint)`:**
  1. `detect_language` inspects syntax signatures (`public class`, `#include <iostream>`, `#include <stdio.h>`, `interface`, `const/let`, defaulting to `python`).
  2. Python `ast.parse(code)` walks `ast.Call` (`eval`/`exec`), `ast.FunctionDef` (mutable `List`/`Dict`/`Set` defaults), `ast.ExceptHandler` (bare `except:`), and `SyntaxError`.
  3. Line-by-line regex scan detects hardcoded secrets, SQL string-concatenation injection, and C/C++ `gets`/`strcpy`.
  4. Loop nesting heuristic estimates fallback Big-O complexity; `ask_llm` enriches issues, complexity, and `corrected_code` when Groq is online.
- **`execute_code_in_sandbox(code, language, stdin_data)`:**
  1. Rejects non-Python languages cleanly.
  2. Walks Python AST to block `FORBIDDEN_MODULES` (`subprocess`, `socket`, `shutil`, `ctypes`, `urllib`, `http`, `ftplib`) + `os`, and `FORBIDDEN_BUILTINS` (`eval`, `exec`, `compile`, `__import__`, `open`), returning exit code `126` (`ast-security-guard`).
  3. Appends trailing `\n` to non-empty `stdin_data` and invokes `subprocess.run([sys.executable, "-I", str(script_path)], cwd=tmp_dir, env=safe_env, input=formatted_stdin, capture_output=True, text=True, timeout=5)`.
  4. Truncates `stdout`/`stderr` at 8,000 characters and appends an IDE hint if `EOFError: EOF when reading a line` occurs.

### 4.4 Document RAG & Comparison (`backend/document_rag/agent.py`)
- **`extract_document(file_path, filename)`:** Dispatches by extension (`pdf`, `docx`, `pptx`, `xlsx`, `csv`, `png/jpg/jpeg/webp`, text fallback), chunks paragraphs up to 600 chars, extracts top-8 frequent tokens (`>= 4` alpha chars excluding `STOPWORDS`), and builds a lead-45-word summary.
- **`query_rag(documents, query, top_k=4)`:** Computes `score = round(0.25 + 0.75 * (|q_tokens ∩ c_tokens| / max(1, |q_tokens|)), 3)` across all chunks, sorts descending, generates `[CIT-1..N]` objects with 260-char excerpts, and synthesizes a cited answer via `ask_llm`.
- **`compare_two_documents(doc_a, doc_b)`:** Computes set intersections/differences over `key_concepts` and refines with `ask_llm` when Groq is active.

### 4.5 Image Studio & Web Research
- **`image_generation/agent.py`:** `generate_image` renders an 800×450 base64-encoded SVG architectural diagram (`#050505` background, `#D4AF37` gold accents) with HTML-escaped prompt text; `analyze_image_file` extracts Pillow dimensions, format, color mode, grayscale mean luminance & contrast stddev, and queries `ask_llm`.
- **`web_research/agent.py`:** `search_resources` queries `DDGS(timeout=5).text(query, max_results=5)` and falls back to Wikipedia/GeeksforGeeks/arXiv search links on exception; `run_web_research` creates `[WEB-1..N]` citations and compiles a Markdown research table.

---

## 5. Error Handling & Fallback Matrix

| Failure Mode | Handling Strategy |
|--------------|-------------------|
| Missing/Invalid `GROQ_API_KEY` or HTTP `401` | Immediate fallback to `omniscient-structured-engine` 5-section pedagogical response; never crashes `/api/chat` or `/api/edtech/*`. |
| Rate limit / model error on primary Groq model | Sequential fallback across `FALLBACK_MODELS` (`gpt-oss-120b` → `llama-3.3-70b-versatile` → `gpt-oss-20b` → `llama-3.1-8b-instant`). |
| DuckDuckGo network error / timeout (>5s) | `search_resources` catches exception and returns structured Wikipedia, GeeksforGeeks, and arXiv query links. |
| Sandbox infinite loop or blocking `input()` | `subprocess.TimeoutExpired` at 5s returns `exit_code=124` with diagnostic message; `EOFError` appends `stdin` UI hint. |
| Restricted import/builtin in sandbox code | AST security guard blocks before subprocess spawn (`exit_code=126`, `sandbox_mode="ast-security-guard"`). |
| Missing `IMAGE_GENERATION_API_KEY` | `generate_image` synthesizes crisp local SVG data URI (`provider="omniscient-svg-studio"`). |

---

## 6. Verification & Automated Testing (`backend/tests/test_omniscient.py`)

Run from repository root:
```powershell
$env:PYTHONPATH = "backend"
.\.venv\Scripts\python.exe -m pytest backend/tests/test_omniscient.py -v -p no:langsmith -p no:anyio -p no:asyncio
```

`test_omniscient_platform()` verifies 10 end-to-end flows with automatic cleanup of temporary files and DB rows:
1. 5-Stage Prompt Optimization & Supervisor execution.
2. PyMuPDF PDF creation, ingestion, and `[CIT-N]` RAG citations.
3. Pillow WebP image creation and `vision_model` analysis.
4. `image_generation` SVG synthesis.
5. `web_research` execution and `[WEB-N]` citations.
6. Two-CSV `document_comparison` workflow.
7. Built-in (`>= 39`) & custom Prompt Template CRUD + usage recording.
8. Static AST + regex `review_code` and `stdin` `input()` sandbox execution (`14` → `42`).
9. EdTech LMS (`explain_lesson`, `generate_quiz`, `generate_flashcards`, `generate_study_plan`, `generate_course_blueprint`, `evaluate_submission`).
10. Approved memory CRUD and `api_chat` conversation creation + single/bulk deletion.
