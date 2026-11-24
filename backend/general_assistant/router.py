import json
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from config import ask_llm, get_api_key_settings, save_api_keys_to_env
from database import get_conn, hash_pwd, new_id, now_iso
from general_assistant.agent import run_supervisor
from general_assistant.prompt_engine import (
    create_custom_template,
    delete_custom_template,
    list_prompt_templates,
    optimize_and_analyze_prompt,
    record_template_usage,
    update_custom_template,
)
from mongo_store import note_store

router = APIRouter()


class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    institution: Optional[str] = "Omniscient AI University"
    department: Optional[str] = "Computer Science & AI"
    bio: Optional[str] = "AI & Software Engineering Enthusiast"


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = ""


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    new_password: Optional[str] = None


class ChatRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None
    agent: Optional[str] = "supervisor"
    attached_file_ids: Optional[List[str]] = None


class PromptTemplateCreateRequest(BaseModel):
    title: str
    category: str = "CUSTOM"
    description: str = ""
    prompt_text: str


class PromptTemplateUpdateRequest(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    prompt_text: Optional[str] = None


class PromptOptimizeRequest(BaseModel):
    prompt: str
    attached_file_ids: Optional[List[str]] = None


class MemoryCreateRequest(BaseModel):
    key: str
    content: str
    memory_type: str = "user_preference"
    is_user_approved: bool = True


class MemoryUpdateRequest(BaseModel):
    is_user_approved: Optional[bool] = None
    content: Optional[str] = None


class NoteCreateRequest(BaseModel):
    title: str
    content: str
    category: str = "research"
    tags: List[str] = []
    pinned: bool = False


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None


class ApiKeyUpdateRequest(BaseModel):
    ACTIVE_LLM_PROVIDER: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: Optional[str] = None
    IMAGE_GENERATION_API_KEY: Optional[str] = None
    WEB_SEARCH_API_KEY: Optional[str] = None


def _format_user(row: Any) -> Dict[str, Any]:
    d = dict(row)
    clean_name = (
        (d.get("full_name") or "User")
        .replace(" (Student)", "")
        .replace(" (Professor)", "")
        .replace(" (Teacher)", "")
        .replace(" (Admin)", "")
    )
    return {
        "id": d["id"],
        "email": d["email"],
        "full_name": clean_name,
        "institution": d.get("institution") or "Omniscient AI University",
        "department": d.get("department") or "Computer Science & AI",
        "bio": d.get("bio") or "AI & Software Engineering Enthusiast",
        "streak": d.get("streak", 7),
        "created_at": d.get("created_at") or "",
        "profile": {
            "learning_streak": d.get("streak", 7),
            "institution": d.get("institution") or "Omniscient AI University",
            "department": d.get("department") or "Computer Science & AI",
            "bio": d.get("bio") or "",
        },
    }


def _resolve_user_from_header(authorization: Optional[str]) -> Dict[str, Any]:
    conn = get_conn()
    user_id = "u-default"
    if isinstance(authorization, str) and "omni-token-" in authorization:
        user_id = authorization.split("omni-token-", 1)[1].strip()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM users ORDER BY rowid ASC LIMIT 1").fetchone()
    conn.close()
    if not row:
        return {
            "id": "u-default",
            "email": "user@omniscient.ai",
            "full_name": "Alex Rivera",
            "institution": "Omniscient AI University",
            "department": "Computer Science & AI",
            "bio": "AI & Software Engineering Enthusiast",
            "streak": 7,
            "profile": {"learning_streak": 7},
        }
    return _format_user(row)


# ==============================================================================
# AUTHENTICATION & USER PROFILE (/api/auth/*)
# ==============================================================================

@router.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
async def api_signup(payload: SignupRequest) -> Dict[str, Any]:
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not payload.full_name.strip():
        raise HTTPException(status_code=400, detail="Please enter your full name.")
    if len(payload.password or "") < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    conn = get_conn()
    existing = conn.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email_clean,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")

    uid = f"u-{new_id()[:8]}"
    conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, institution, department, bio, streak, created_at)
        VALUES (?, ?, ?, ?, 'user', ?, ?, ?, 1, ?)
        """,
        (
            uid,
            email_clean,
            hash_pwd(payload.password),
            payload.full_name.strip(),
            (payload.institution or "Omniscient AI University").strip(),
            (payload.department or "Computer Science & AI").strip(),
            (payload.bio or "AI & Software Engineering Enthusiast").strip(),
            now_iso(),
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    user_obj = _format_user(row)
    return {
        "access_token": f"omni-token-{user_obj['id']}",
        "token_type": "bearer",
        "user": user_obj,
    }


@router.post("/api/auth/login")
async def api_login(payload: LoginRequest) -> Dict[str, Any]:
    email_clean = payload.email.strip().lower()
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email_clean,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="No account found with that email. Please Sign Up first.")

    stored_hash = row["password_hash"] if "password_hash" in row.keys() else ""
    if stored_hash and payload.password:
        if hash_pwd(payload.password) != stored_hash:
            raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    user_obj = _format_user(row)
    return {
        "access_token": f"omni-token-{user_obj['id']}",
        "token_type": "bearer",
        "user": user_obj,
    }


@router.get("/api/auth/me")
async def api_me(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    return {"user": _resolve_user_from_header(authorization)}


@router.put("/api/auth/profile")
async def api_update_profile(
    payload: ProfileUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    current = _resolve_user_from_header(authorization)
    uid = current["id"]

    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    full_name = payload.full_name.strip() if payload.full_name else row["full_name"]
    institution = payload.institution.strip() if payload.institution is not None else (row["institution"] or "")
    department = payload.department.strip() if payload.department is not None else (row["department"] or "")
    bio = payload.bio.strip() if payload.bio is not None else (row["bio"] or "")
    pwd_hash = hash_pwd(payload.new_password) if (payload.new_password and len(payload.new_password) >= 4) else (row["password_hash"] or "")

    conn.execute(
        """
        UPDATE users
        SET full_name = ?, institution = ?, department = ?, bio = ?, password_hash = ?
        WHERE id = ?
        """,
        (full_name, institution, department, bio, pwd_hash, uid),
    )
    conn.commit()
    updated_row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    return {"user": _format_user(updated_row)}


# ==============================================================================
# AGENTS, CHAT & CONVERSATION HISTORY (WITH DELETE & CLEAR ALL)
# ==============================================================================

@router.get("/api/agents")
async def api_list_agents() -> Dict[str, Any]:
    return {
        "agents": [
            {"id": "1", "slug": "general-assistant", "name": "General Purpose Assistant", "category": "chat"},
            {"id": "2", "slug": "code-review", "name": "Code Review & Sandbox", "category": "engineering"},
            {"id": "3", "slug": "edtech-agent", "name": "EdTech Tutor & Quiz Agent", "category": "education"},
            {"id": "4", "slug": "image-generation", "name": "Image Studio & Vision", "category": "multimodal"},
            {"id": "5", "slug": "document-rag", "name": "Document Intelligence & RAG", "category": "knowledge"},
            {"id": "6", "slug": "web-research", "name": "Web Research Agent", "category": "research"},
        ]
    }


@router.post("/api/chat")
async def api_chat(
    payload: ChatRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    current_user = _resolve_user_from_header(authorization)
    uid = current_user["id"]

    conn = get_conn()
    conv_id = payload.conversation_id
    if conv_id:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            conv_id = None

    if not conv_id:
        conv_id = new_id()
        title = payload.prompt.strip().splitlines()[0][:55] or "Omniscient Session"
        conn.execute(
            "INSERT INTO conversations (id, user_id, title, active_agent, updated_at) VALUES (?, ?, ?, ?, ?)",
            (conv_id, uid, title, payload.agent or "supervisor", now_iso()),
        )
        conn.commit()

    hist_rows = conn.execute(
        "SELECT sender_role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 10",
        (conv_id,),
    ).fetchall()
    history = [{"role": r["sender_role"], "content": r["content"]} for r in hist_rows]

    mem_rows = conn.execute("SELECT key, content FROM memories WHERE is_user_approved = 1").fetchall()
    approved_memories = [f"{r['key']}: {r['content']}" for r in mem_rows]

    user_msg_id = new_id()
    attached_ids = payload.attached_file_ids or []
    user_attachments = []
    for fid in attached_ids:
        doc_row = conn.execute("SELECT id, title, doc_type, file_size FROM documents WHERE id = ?", (fid,)).fetchone()
        if doc_row:
            user_attachments.append({
                "id": doc_row["id"],
                "title": doc_row["title"],
                "doc_type": doc_row["doc_type"],
                "file_size": doc_row["file_size"],
            })

    conn.execute(
        "INSERT INTO messages (id, conversation_id, sender_role, agent_name, content, attachments_json, created_at) VALUES (?, ?, 'user', 'user', ?, ?, ?)",
        (user_msg_id, conv_id, payload.prompt, json.dumps(user_attachments), now_iso()),
    )
    conn.commit()

    sup_res = run_supervisor(
        payload.prompt,
        history=history,
        approved_memories=approved_memories,
        attached_file_ids=attached_ids,
    )
    agent_slug = sup_res["workflow_trace"][-1]["agent_slug"] if sup_res.get("workflow_trace") else "general-ai"
    asst_msg_id = new_id()

    conn.execute(
        """
        INSERT INTO messages (id, conversation_id, sender_role, agent_name, content, citations_json, trace_json, attachments_json, optimized_prompt, created_at)
        VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            asst_msg_id,
            conv_id,
            agent_slug,
            sup_res["response"],
            json.dumps(sup_res["citations"]),
            json.dumps(sup_res["workflow_trace"]),
            json.dumps(sup_res.get("generated_images", [])),
            sup_res.get("optimized_prompt", ""),
            now_iso(),
        ),
    )
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now_iso(), conv_id))
    conn.commit()
    conn.close()

    return {
        "conversation_id": conv_id,
        "message_id": asst_msg_id,
        **sup_res,
    }


@router.get("/api/conversations", status_code=status.HTTP_200_OK)
async def api_list_conversations() -> Dict[str, Any]:
    conn = get_conn()
    # SQL JOIN aggregating message count and author metadata per conversation
    rows = conn.execute(
        """
        SELECT c.id,
               c.title,
               c.active_agent,
               c.updated_at,
               u.full_name AS author_name,
               COUNT(m.id) AS message_count
        FROM conversations c
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id, c.title, c.active_agent, c.updated_at, u.full_name
        ORDER BY c.updated_at DESC
        """
    ).fetchall()
    conn.close()
    convs = [
        {
            "id": r["id"],
            "title": r["title"],
            "active_agent": r["active_agent"],
            "author_name": r["author_name"] or "Omniscient User",
            "message_count": r["message_count"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]
    return {"conversations": convs}


@router.get("/api/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def api_get_conversation(conversation_id: str) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute(
        """
        SELECT c.*, u.full_name AS author_name, COUNT(m.id) AS message_count
        FROM conversations c
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.id = ?
        GROUP BY c.id, u.full_name
        """,
        (conversation_id,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"conversation": dict(row)}


@router.get("/api/conversations/{conversation_id}/messages")
async def api_get_messages(conversation_id: str) -> Dict[str, Any]:
    conn = get_conn()
    conv = conn.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    conn.close()
    return {
        "conversation": dict(conv),
        "messages": [
            {
                "id": r["id"],
                "sender_role": r["sender_role"],
                "agent_name": r["agent_name"],
                "content": r["content"],
                "citations": json.loads(r["citations_json"] or "[]"),
                "workflow_trace": json.loads(r["trace_json"] or "[]"),
                "attachments": json.loads(r["attachments_json"] or "[]") if "attachments_json" in r.keys() else [],
                "optimized_prompt": r["optimized_prompt"] if "optimized_prompt" in r.keys() else "",
                "created_at": r["created_at"],
            }
            for r in rows
        ],
    }


@router.delete("/api/conversations/{conversation_id}")
async def api_delete_conversation(conversation_id: str) -> Dict[str, Any]:
    conn = get_conn()
    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()
    return {"deleted": True, "conversation_id": conversation_id}


@router.delete("/api/conversations")
async def api_clear_all_conversations() -> Dict[str, Any]:
    conn = get_conn()
    conn.execute("DELETE FROM messages")
    conn.execute("DELETE FROM conversations")
    conn.commit()
    conn.close()
    return {"cleared": True}


@router.get("/api/agents/executions")
async def api_list_executions() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM agent_executions ORDER BY started_at DESC LIMIT 20").fetchall()
    conn.close()
    return {"executions": [dict(r) for r in rows]}


@router.get("/api/memory")
async def api_list_memories() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM memories ORDER BY updated_at DESC").fetchall()
    conn.close()
    return {
        "memories": [
            {
                "id": r["id"],
                "key": r["key"],
                "content": r["content"],
                "memory_type": r["memory_type"],
                "is_user_approved": bool(r["is_user_approved"]),
            }
            for r in rows
        ]
    }


@router.post("/api/memory", status_code=status.HTTP_201_CREATED)
async def api_create_memory(payload: MemoryCreateRequest) -> Dict[str, Any]:
    mid = new_id()
    conn = get_conn()
    conn.execute(
        "INSERT INTO memories (id, user_id, key, content, memory_type, is_user_approved, updated_at) VALUES (?, 'u-default', ?, ?, ?, ?, ?)",
        (mid, payload.key, payload.content, payload.memory_type, 1 if payload.is_user_approved else 0, now_iso()),
    )
    conn.commit()
    conn.close()
    return {"memory": {"id": mid, "key": payload.key, "content": payload.content, "is_user_approved": payload.is_user_approved}}


@router.patch("/api/memory/{memory_id}", status_code=status.HTTP_200_OK)
async def api_update_memory(memory_id: str, payload: MemoryUpdateRequest) -> Dict[str, Any]:
    conn = get_conn()
    existing = conn.execute("SELECT id FROM memories WHERE id = ?", (memory_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory item not found")
    if payload.is_user_approved is not None:
        conn.execute(
            "UPDATE memories SET is_user_approved = ?, updated_at = ? WHERE id = ?",
            (1 if payload.is_user_approved else 0, now_iso(), memory_id),
        )
    conn.commit()
    conn.close()
    return {"updated": True}


@router.delete("/api/memory/{memory_id}", status_code=status.HTTP_200_OK)
async def api_delete_memory(memory_id: str) -> Dict[str, Any]:
    conn = get_conn()
    existing = conn.execute("SELECT id FROM memories WHERE id = ?", (memory_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory item not found")
    conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    conn.commit()
    conn.close()
    return {"deleted": True}


@router.get("/api/settings/api-keys")
async def api_get_keys() -> Dict[str, Any]:
    s = get_api_key_settings()
    return {
        "settings": s,
        "providers": {
            "llm": {
                "provider": s["active_llm_provider"].upper(),
                "model": s["groq_model"] if s["active_llm_provider"] == "groq" else s["gemini_model"],
                "configured": True,
                "instructions": "Active (with automatic Built-In Smart Engine fallback if key is offline/invalid).",
            }
        },
    }


@router.post("/api/settings/api-keys")
async def api_save_keys(payload: ApiKeyUpdateRequest) -> Dict[str, Any]:
    s = save_api_keys_to_env(payload.model_dump(exclude_none=True))
    return {
        "updated": True,
        "settings": s,
        "providers": {
            "llm": {
                "provider": s["active_llm_provider"].upper(),
                "model": s["groq_model"] if s["active_llm_provider"] == "groq" else s["gemini_model"],
                "configured": True,
            }
        },
    }


@router.post("/api/settings/api-keys/test")
async def api_test_keys() -> Dict[str, Any]:
    start_ts = time.perf_counter()
    res = ask_llm("Confirm Omniscient AI is online in one short sentence.")
    ms = int((time.perf_counter() - start_ts) * 1000)
    return {
        "success": True,
        "latency_ms": ms,
        "provider": res["provider"],
        "model": res["model"],
        "reply": res["content"],
    }


# ==============================================================================
# PROMPT TEMPLATE LIBRARY & LLM PROMPT OPTIMIZATION ENGINE (/api/prompt-templates)
# ==============================================================================

@router.get("/api/prompt-templates")
async def api_get_prompt_templates(search: str = "", category: str = "") -> Dict[str, Any]:
    return list_prompt_templates(search=search, category=category)


@router.post("/api/prompt-templates", status_code=status.HTTP_201_CREATED)
async def api_create_prompt_template(
    payload: PromptTemplateCreateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _resolve_user_from_header(authorization)
    tpl = create_custom_template(
        title=payload.title,
        category=payload.category,
        description=payload.description,
        prompt_text=payload.prompt_text,
        user_id=user["id"],
    )
    return {"template": tpl}


@router.put("/api/prompt-templates/{template_id}")
async def api_update_prompt_template(
    template_id: str,
    payload: PromptTemplateUpdateRequest,
) -> Dict[str, Any]:
    try:
        tpl = update_custom_template(
            template_id=template_id,
            title=payload.title,
            category=payload.category,
            description=payload.description,
            prompt_text=payload.prompt_text,
        )
        return {"template": tpl}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/api/prompt-templates/{template_id}")
async def api_delete_prompt_template(template_id: str) -> Dict[str, Any]:
    delete_custom_template(template_id)
    return {"deleted": True, "template_id": template_id}


@router.post("/api/prompt-templates/{template_id}/use")
async def api_use_prompt_template(template_id: str) -> Dict[str, Any]:
    record_template_usage(template_id)
    return {"recorded": True}


@router.post("/api/prompt-templates/optimize", status_code=status.HTTP_200_OK)
async def api_optimize_prompt(payload: PromptOptimizeRequest) -> Dict[str, Any]:
    attached_files = []
    if payload.attached_file_ids:
        conn = get_conn()
        for fid in payload.attached_file_ids:
            row = conn.execute("SELECT id, title, doc_type FROM documents WHERE id = ?", (fid,)).fetchone()
            if row:
                attached_files.append(dict(row))
        conn.close()
    return optimize_and_analyze_prompt(payload.prompt, attached_files=attached_files)


# ==============================================================================
# WORKSPACE RESEARCH NOTES — MONGODB SCHEMA & CRUD (/api/notes)
# ==============================================================================

@router.get("/api/notes", status_code=status.HTTP_200_OK)
async def api_list_notes(category: str = "", tag: str = "") -> Dict[str, Any]:
    return note_store.list_notes(category=category, tag=tag)


@router.post("/api/notes", status_code=status.HTTP_201_CREATED)
async def api_create_note(
    payload: NoteCreateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title and content are required.")
    user = _resolve_user_from_header(authorization)
    return note_store.create_note(
        title=payload.title,
        content=payload.content,
        category=payload.category,
        tags=payload.tags,
        pinned=payload.pinned,
        user_id=user["id"],
    )


@router.get("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def api_get_note(note_id: str) -> Dict[str, Any]:
    note = note_store.get_note(note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return {"note": note}


@router.put("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def api_update_note(note_id: str, payload: NoteUpdateRequest) -> Dict[str, Any]:
    updated = note_store.update_note(
        note_id=note_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        tags=payload.tags,
        pinned=payload.pinned,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return {"note": updated}


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_200_OK)
async def api_delete_note(note_id: str) -> Dict[str, Any]:
    if not note_store.delete_note(note_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return {"deleted": True, "note_id": note_id}
