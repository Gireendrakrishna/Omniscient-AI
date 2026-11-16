"""
Simple, Clean SQLite Database Layer (backend/database.py)
Supports Users (Login, Signup, Profile), Conversations, Messages, Prompt Templates,
Memories, Documents, Images, and EdTech LMS tables.
"""

from datetime import datetime, timezone
import hashlib
import json
import sqlite3
import uuid

from config import ROOT_DIR

DB_PATH = ROOT_DIR / "omniscient.db"


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_pwd(password: str) -> str:
    return hashlib.sha256((password or "").encode("utf-8")).hexdigest()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT DEFAULT '',
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            institution TEXT DEFAULT 'Omniscient AI University',
            department TEXT DEFAULT 'Computer Science & AI',
            bio TEXT DEFAULT 'AI & Software Engineering Enthusiast',
            streak INTEGER DEFAULT 7,
            created_at TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            active_agent TEXT DEFAULT 'supervisor',
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_role TEXT NOT NULL,
            agent_name TEXT,
            content TEXT NOT NULL,
            citations_json TEXT DEFAULT '[]',
            trace_json TEXT DEFAULT '[]',
            attachments_json TEXT DEFAULT '[]',
            optimized_prompt TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS prompt_templates (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'u-default',
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            is_custom INTEGER DEFAULT 0,
            use_count INTEGER DEFAULT 0,
            last_used_at TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            key TEXT NOT NULL,
            content TEXT NOT NULL,
            memory_type TEXT DEFAULT 'user_preference',
            is_user_approved INTEGER DEFAULT 1,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            page_count INTEGER DEFAULT 1,
            extracted_text TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            key_concepts_json TEXT DEFAULT '[]',
            chunks_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS generated_images (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            original_prompt TEXT NOT NULL,
            enhanced_prompt TEXT NOT NULL,
            style TEXT NOT NULL,
            provider TEXT NOT NULL,
            image_url TEXT NOT NULL,
            status TEXT DEFAULT 'completed',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            code TEXT NOT NULL,
            description TEXT NOT NULL,
            difficulty TEXT DEFAULT 'intermediate',
            is_published INTEGER DEFAULT 1,
            is_enrolled INTEGER DEFAULT 1,
            modules_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id TEXT PRIMARY KEY,
            course_id TEXT,
            title TEXT NOT NULL,
            difficulty TEXT DEFAULT 'intermediate',
            time_limit_minutes INTEGER DEFAULT 20,
            questions_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY,
            course_id TEXT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            max_score REAL DEFAULT 100.0,
            rubric_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            assignment_id TEXT NOT NULL,
            assignment_title TEXT,
            student_id TEXT NOT NULL,
            content TEXT NOT NULL,
            score REAL,
            ai_evaluation_json TEXT DEFAULT '{}',
            status TEXT DEFAULT 'evaluated',
            submitted_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            front_question TEXT NOT NULL,
            back_answer TEXT NOT NULL,
            difficulty TEXT DEFAULT 'medium',
            mastery_level INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_executions (
            id TEXT PRIMARY KEY,
            agent_slug TEXT NOT NULL,
            task_description TEXT NOT NULL,
            status TEXT DEFAULT 'completed',
            duration_ms INTEGER DEFAULT 25,
            started_at TEXT NOT NULL
        );
        """
    )

    # Ensure new profile columns exist on older omniscient.db files
    existing_cols = {row["name"] for row in cur.execute("PRAGMA table_info(users)").fetchall()}
    migrations = [
        ("password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''"),
        ("institution", "ALTER TABLE users ADD COLUMN institution TEXT DEFAULT 'Omniscient AI University'"),
        ("department", "ALTER TABLE users ADD COLUMN department TEXT DEFAULT 'Computer Science & AI'"),
        ("bio", "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT 'AI & Software Engineering Enthusiast'"),
        ("created_at", "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT ''"),
    ]
    for col_name, sql in migrations:
        if col_name not in existing_cols:
            cur.execute(sql)

    msg_cols = {row["name"] for row in cur.execute("PRAGMA table_info(messages)").fetchall()}
    if "attachments_json" not in msg_cols:
        cur.execute("ALTER TABLE messages ADD COLUMN attachments_json TEXT DEFAULT '[]'")
    if "optimized_prompt" not in msg_cols:
        cur.execute("ALTER TABLE messages ADD COLUMN optimized_prompt TEXT DEFAULT ''")

    # Seed default user if empty
    existing = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing == 0:
        cur.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, role, institution, department, bio, streak, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "u-default",
                "user@omniscient.ai",
                hash_pwd("Omniscient@123"),
                "Alex Rivera",
                "user",
                "Omniscient AI University",
                "Computer Science & AI",
                "AI & Data Science Engineer building multi-agent systems.",
                7,
                now_iso(),
            ),
        )

        # Seed default LMS Course
        modules = [
            {
                "id": "mod-1",
                "title": "Module 1: Multi-Agent AI Architecture",
                "description": "Supervisor routing, specialized agents, and tool execution.",
                "lessons": [
                    {
                        "id": "les-1",
                        "title": "1.1 How the Central Supervisor Coordinates Agents",
                        "duration_minutes": 30,
                        "content_markdown": (
                            "# Central Supervisor Pattern\n\n"
                            "In Omniscient AI, the **Central Supervisor** receives user requests, classifies the intent, "
                            "and routes tasks to specialized feature modules (`general_assistant`, `code_review`, `edtech`, `image_generation`, `document_rag`, `web_research`)."
                        ),
                        "ai_notes_markdown": (
                            "- **Intent Detection**: Matches user goal to the right agent.\n"
                            "- **Modular Architecture**: Each capability lives in its own dedicated folder."
                        ),
                    }
                ],
            }
        ]
        cur.execute(
            """
            INSERT INTO courses (id, title, code, description, difficulty, is_published, is_enrolled, modules_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "course-1",
                "Agentic AI Systems & Full-Stack Engineering",
                "CS-401",
                "Learn multi-agent orchestration, RAG document intelligence, static code security review, and AI tutoring.",
                "intermediate",
                1,
                1,
                json.dumps(modules),
                now_iso(),
            ),
        )

        # Seed default Quiz
        questions = [
            {
                "id": "q-1",
                "question_type": "mcq",
                "prompt": "What is the role of the Supervisor Agent in Omniscient AI?",
                "options_json": [
                    "Classify user intent and route tasks to specialized agents",
                    "Only style CSS buttons",
                    "Delete database tables randomly",
                    "Block all user logins",
                ],
                "correct_answer": "Classify user intent and route tasks to specialized agents",
                "points": 10.0,
                "topic_tag": "Multi-Agent Systems",
            },
            {
                "id": "q-2",
                "question_type": "true_false",
                "prompt": "True or False: RAG (Retrieval-Augmented Generation) grounds AI answers in uploaded document chunks.",
                "options_json": ["True", "False"],
                "correct_answer": "True",
                "points": 10.0,
                "topic_tag": "RAG Pipeline",
            },
        ]
        cur.execute(
            """
            INSERT INTO quizzes (id, course_id, title, difficulty, time_limit_minutes, questions_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("quiz-1", "course-1", "Midterm Quiz: Agentic AI & RAG", "intermediate", 15, json.dumps(questions), now_iso()),
        )

        # Seed default Assignment
        rubric = [
            {"criterion": "Architecture & Modularity", "max_points": 50},
            {"criterion": "Code Quality & Verification", "max_points": 50},
        ]
        cur.execute(
            """
            INSERT INTO assignments (id, course_id, title, description, max_score, rubric_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "assign-1",
                "course-1",
                "Build a Modular Multi-Agent Workflow",
                "Explain how the Supervisor routes requests across Code Review, RAG, and EdTech modules.",
                100.0,
                json.dumps(rubric),
                now_iso(),
            ),
        )

        # Seed default Flashcards
        cards = [
            ("u-default", "Supervisor Agent", "What does the Central Supervisor do?", "Breaks down user requests and routes them to specialized agents."),
            ("u-default", "RAG Pipeline", "Why do we chunk documents in RAG?", "To retrieve only the most relevant sections that fit in context with exact citations."),
            ("u-default", "Code Review Agent", "How does static analysis improve security?", "By scanning AST syntax trees for dangerous calls like eval() or hardcoded keys before execution."),
        ]
        for uid, topic, front, back in cards:
            cur.execute(
                """
                INSERT INTO flashcards (id, user_id, topic, front_question, back_answer, difficulty, mastery_level, created_at)
                VALUES (?, ?, ?, ?, ?, 'medium', 3, ?)
                """,
                (new_id(), uid, topic, front, back, now_iso()),
            )

    conn.commit()
    conn.close()
