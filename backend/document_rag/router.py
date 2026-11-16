import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from config import STORAGE_DIR
from database import get_conn, new_id, now_iso
from document_rag.agent import compare_two_documents, extract_document, query_rag

router = APIRouter()


class RagQueryRequest(BaseModel):
    query: str
    top_k: int = 4


class DocCompareRequest(BaseModel):
    document_id_a: str
    document_id_b: str


@router.post("/api/files/upload")
async def api_upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    doc_id = new_id()
    safe_name = Path(file.filename or "document.txt").name
    dest = STORAGE_DIR / f"{doc_id}_{safe_name}"
    dest.write_bytes(raw_bytes)

    extracted = extract_document(str(dest), safe_name)
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO documents (id, user_id, title, doc_type, file_path, file_size, page_count, extracted_text, summary, key_concepts_json, chunks_json, created_at)
        VALUES (?, 'u-default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            doc_id,
            safe_name,
            extracted["doc_type"],
            str(dest),
            len(raw_bytes),
            extracted["page_count"],
            extracted["extracted_text"],
            extracted["summary"],
            json.dumps(extracted["key_concepts"]),
            json.dumps(extracted["chunks"]),
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()

    mime = file.content_type or ("image/png" if extracted["doc_type"] == "image" else "application/octet-stream")
    return {
        "file": {
            "id": doc_id,
            "original_filename": safe_name,
            "mime_type": mime,
            "file_size_bytes": len(raw_bytes),
        },
        "document": {
            "id": doc_id,
            "title": safe_name,
            "doc_type": extracted["doc_type"],
            "page_count": extracted["page_count"],
            "summary": extracted["summary"],
            "key_concepts": extracted["key_concepts"],
            "chunks_count": len(extracted["chunks"]),
        },
        "rag_index": {"chunks_created": len(extracted["chunks"])},
    }


@router.get("/api/files")
async def api_list_files() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    conn.close()
    files = []
    for r in rows:
        is_img = r["doc_type"] == "image" or r["title"].lower().endswith((".png", ".jpg", ".jpeg"))
        files.append({
            "id": r["id"],
            "original_filename": r["title"],
            "mime_type": "image/png" if is_img else "application/pdf",
            "file_size_bytes": r["file_size"],
            "document_id": r["id"],
        })
    return {"files": files}


@router.get("/api/documents")
async def api_list_documents() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    conn.close()
    docs = []
    for r in rows:
        chunks = json.loads(r["chunks_json"] or "[]")
        docs.append({
            "id": r["id"],
            "title": r["title"],
            "doc_type": r["doc_type"],
            "page_count": r["page_count"],
            "summary": r["summary"],
            "key_concepts": json.loads(r["key_concepts_json"] or "[]"),
            "chunks_count": len(chunks),
        })
    return {"documents": docs}


@router.post("/api/rag/query")
async def api_rag_query(payload: RagQueryRequest) -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    conn.close()
    docs = [
        {
            "id": r["id"],
            "title": r["title"],
            "chunks": json.loads(r["chunks_json"] or "[]"),
        }
        for r in rows
    ]
    return query_rag(docs, payload.query, payload.top_k)


@router.post("/api/documents/compare")
async def api_compare_documents(payload: DocCompareRequest) -> Dict[str, Any]:
    conn = get_conn()
    ra = conn.execute("SELECT * FROM documents WHERE id = ?", (payload.document_id_a,)).fetchone()
    rb = conn.execute("SELECT * FROM documents WHERE id = ?", (payload.document_id_b,)).fetchone()
    conn.close()
    if not ra or not rb:
        raise HTTPException(status_code=404, detail="Select two valid uploaded documents to compare.")
    da = {"title": ra["title"], "page_count": ra["page_count"], "key_concepts": json.loads(ra["key_concepts_json"] or "[]")}
    db = {"title": rb["title"], "page_count": rb["page_count"], "key_concepts": json.loads(rb["key_concepts_json"] or "[]")}
    return {"comparison": compare_two_documents(da, db)}
