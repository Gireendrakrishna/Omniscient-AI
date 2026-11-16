# OMNISCIENT AI — Semester Project Viva & Mentor Guide

This guide explains the clean, modular architecture of **Omniscient AI** so you can clearly present and defend every module during your semester viva.

---

## 1. Clean Modular Project Structure

Omniscient AI is organized around **three primary user destinations** (`General AI`, `Code Review`, `EdTech LMS`), backed by a unified LangGraph Supervisor in Python and cleanly separated UI modules in React:

```
omniscient/
├── .env                                   # Single file containing all API keys
├── .env.example                           # Clean template of supported API keys
├── start.bat / start.ps1                  # One-click backend + frontend launchers
├── backend/
│   ├── main.py                            # FastAPI entrypoint mounting all capability routers
│   ├── config.py                          # Reads .env & runs Groq tool-calling loop + fallback
│   ├── database.py                        # SQLite database (users, chats, templates, LMS)
│   ├── general_assistant/                 # 1. Unified General AI & Supervisor Graph
│   │   ├── prompt_engine.py               # 5-Stage LLM Prompt Optimizer & Prompt Library
│   │   ├── agent.py                       # LangGraph StateGraph Supervisor coordinating 6 capabilities
│   │   └── router.py                      # Auth, Profile, Unified Chat, Prompt Templates, Memory
│   ├── code_review/                       # 2. Standalone IDE Code Studio & Sandbox
│   │   ├── agent.py                       # AST security/bug scanner, Big-O profiler, stdin sandbox
│   │   └── router.py
│   ├── edtech/                            # 3. Standalone EdTech LMS
│   │   ├── agent.py                       # AI Tutor, Quiz generator, Flashcards, Study Plan, LMS
│   │   └── router.py
│   ├── document_rag/                      # Document extraction, comparison & [CIT-N] RAG
│   ├── image_generation/                  # SVG/Cloud diagram generation & Vision analysis
│   ├── web_research/                      # DuckDuckGo live web search & citations
│   └── tests/test_omniscient.py           # Automated verification suite
│
└── frontend/src/
    ├── App.tsx                            # Clean root layout, sidebar navigation & telemetry drawer
    ├── api.ts                             # REST API helper
    ├── general_ai/
    │   ├── GeneralAiView.tsx              # Unified General AI chat, multi-file upload & optimizer
    │   └── PromptLibraryModal.tsx         # 6-category Prompt Template Library & custom templates
    ├── code_review/CodeReviewView.tsx     # Standalone IDE Code Review & Sandbox with stdin console
    ├── edtech/EdTechView.tsx              # Standalone EdTech LMS (Tutor, Courses, Quizzes)
    ├── history/HistoryView.tsx            # Conversation history manager
    ├── settings/
    │   ├── SettingsView.tsx               # Profile, Runtime API Key Config & Approved Memory
    │   └── AuthModal.tsx                  # Login / Signup modal
    └── shared/MarkdownRenderer.tsx        # Markdown, KaTeX math & syntax code renderer
```

---

## 2. How the Unified General AI Pipeline Works (Viva Explanation)

1. **5-Stage Intelligent Prompt Template Engine (`backend/general_assistant/prompt_engine.py`)**:
   - **Stage 1 (Intent Detection)**: Identifies whether the user wants Explanation, Document Summarization, Document Comparison, Spreadsheet Analysis, Image Analysis, Image Generation, Web Research, Brainstorming, Translation, or Study help.
   - **Stage 2 (Context Extraction)**: Inspects attached files (`PDF`, `DOCX`, `PPTX`, `XLSX`, `CSV`, `TXT`, `PNG`, `JPG`, `WEBP`), conversation history, and approved persistent user memories.
   - **Stage 3 (Capability Selection)**: Selects the exact combination of backend engines (`vision_model`, `document_comparison`, `document_rag`, `image_generation`, `web_research`, `general_llm`) so compound requests execute in one turn.
   - **Stage 4 (Prompt Construction)**: Expands brief or vague user prompts into an explicit, structured LLM task specification.
   - **Stage 5 (Output Formatting)**: Enforces clean markdown headings, tables, code blocks, and `[CIT-N]` source citations.
2. **LangGraph Supervisor (`backend/general_assistant/agent.py`)**:
   - Compiled as a `StateGraph(UnifiedGraphState)` with two nodes: `optimize_prompt -> execute_capabilities`.
   - Coordinates multi-file RAG, multi-document comparison, vision analysis, live web search, and image generation inside a single conversation turn.
3. **Standalone Code Review (`backend/code_review/`)**:
   - Combines static Python `ast` analysis, regex vulnerability detection, Big-O complexity estimation, AI code remediation, and an isolated subprocess sandbox supporting interactive `input()` via `stdin_data`.
4. **Standalone EdTech LMS (`backend/edtech/`)**:
   - Educational workspace combining **AI Tutor & Study Tools** (Explain Lesson, Study Planner, Flashcards), **Courses & Curriculum** (AI Course Creator, Study Modules), and **Quizzes & Assignments** (AI Quiz Generator, Interactive Quiz Grading, AI Rubric Evaluation).
