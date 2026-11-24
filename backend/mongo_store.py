"""
NoSQL MongoDB Schema Modeling & CRUD Persistence Layer (backend/mongo_store.py)
- Defines explicit MongoDB `$jsonSchema` validation rules and Pydantic document models
  (with embedded metadata subdocuments and tag arrays) for Workspace Research Notes.
- Uses `pymongo.MongoClient` with `collMod` schema validation and compound indexes when
  `MONGODB_URI` is configured in `.env`, falling back transparently to a local
  schema-enforced JSON collection (`storage/mongo_notes.json`) for zero-setup demos.
"""

import json
import os
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from pymongo import ASCENDING, DESCENDING, MongoClient

from config import STORAGE_DIR, get_env
from database import new_id, now_iso

MONGO_FALLBACK_FILE = STORAGE_DIR / "mongo_notes.json"

# Explicit MongoDB $jsonSchema validator specification
RESEARCH_NOTE_COLLECTION_SCHEMA: Dict[str, Any] = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "user_id", "title", "content", "category", "tags", "metadata", "created_at", "updated_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "user_id": {"bsonType": "string"},
            "title": {"bsonType": "string", "minLength": 1, "maxLength": 200},
            "content": {"bsonType": "string", "minLength": 1},
            "category": {"enum": ["general", "code", "edtech", "research"]},
            "tags": {"bsonType": "array", "items": {"bsonType": "string"}},
            "metadata": {
                "bsonType": "object",
                "required": ["word_count", "pinned"],
                "properties": {
                    "word_count": {"bsonType": "int", "minimum": 0},
                    "pinned": {"bsonType": "bool"},
                    "source_conversation_id": {"bsonType": ["string", "null"]},
                },
            },
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"},
        },
    }
}


class NoteMetadataSchema(BaseModel):
    word_count: int = Field(ge=0, default=0)
    pinned: bool = False
    source_conversation_id: Optional[str] = None


class ResearchNoteSchema(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str = "u-default"
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    category: str = "research"
    tags: List[str] = Field(default_factory=list)
    metadata: NoteMetadataSchema = Field(default_factory=NoteMetadataSchema)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"general", "code", "edtech", "research"}
        val = (v or "research").strip().lower()
        return val if val in allowed else "research"


class MongoNoteStore:
    """Repository encapsulating MongoDB schema initialization and CRUD operations."""

    def __init__(self) -> None:
        self._client: Optional[MongoClient] = None

    def _get_collection(self):
        uri = get_env("MONGODB_URI") or os.environ.get("MONGODB_URI", "").strip()
        if not uri:
            return None
        try:
            if self._client is None:
                self._client = MongoClient(uri, serverSelectionTimeoutMS=2000)
            db_name = get_env("MONGODB_DB_NAME", "omniscient_ai")
            db = self._client[db_name]
            existing = db.list_collection_names()
            if "research_notes" not in existing:
                db.create_collection("research_notes", validator=RESEARCH_NOTE_COLLECTION_SCHEMA)
            else:
                db.command({"collMod": "research_notes", "validator": RESEARCH_NOTE_COLLECTION_SCHEMA})
            col = db["research_notes"]
            col.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
            col.create_index([("tags", ASCENDING)])
            return col
        except Exception:
            return None

    def _read_local(self) -> List[Dict[str, Any]]:
        if not MONGO_FALLBACK_FILE.exists():
            return []
        try:
            return json.loads(MONGO_FALLBACK_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _write_local(self, docs: List[Dict[str, Any]]) -> None:
        MONGO_FALLBACK_FILE.write_text(json.dumps(docs, indent=2), encoding="utf-8")

    # CREATE
    def create_note(
        self,
        title: str,
        content: str,
        category: str = "research",
        tags: Optional[List[str]] = None,
        pinned: bool = False,
        user_id: str = "u-default",
    ) -> Dict[str, Any]:
        clean_tags = [t.strip() for t in (tags or []) if t.strip()]
        doc_model = ResearchNoteSchema(
            user_id=user_id,
            title=title.strip(),
            content=content.strip(),
            category=category,
            tags=clean_tags,
            metadata=NoteMetadataSchema(
                word_count=len(content.split()),
                pinned=pinned,
            ),
        )
        mongo_doc = {"_id": doc_model.id, **doc_model.model_dump(exclude={"id"})}

        col = self._get_collection()
        if col is not None:
            col.insert_one(mongo_doc)
            return {"storage": "mongodb", "note": doc_model.model_dump()}

        docs = self._read_local()
        docs.insert(0, doc_model.model_dump())
        self._write_local(docs)
        return {"storage": "mongo-schema-local", "note": doc_model.model_dump()}

    # READ (list + single)
    def list_notes(self, category: str = "", tag: str = "") -> Dict[str, Any]:
        col = self._get_collection()
        query: Dict[str, Any] = {}
        if category:
            query["category"] = category.lower()
        if tag:
            query["tags"] = tag

        if col is not None:
            cursor = col.find(query).sort([("metadata.pinned", DESCENDING), ("updated_at", DESCENDING)])
            items = [{**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"])} for d in cursor]
            return {"storage": "mongodb", "schema": RESEARCH_NOTE_COLLECTION_SCHEMA, "notes": items}

        docs = self._read_local()
        if category:
            docs = [d for d in docs if d.get("category") == category.lower()]
        if tag:
            docs = [d for d in docs if tag in d.get("tags", [])]
        docs.sort(key=lambda d: (d.get("metadata", {}).get("pinned", False), d.get("updated_at", "")), reverse=True)
        return {"storage": "mongo-schema-local", "schema": RESEARCH_NOTE_COLLECTION_SCHEMA, "notes": docs}

    def get_note(self, note_id: str) -> Optional[Dict[str, Any]]:
        col = self._get_collection()
        if col is not None:
            d = col.find_one({"_id": note_id})
            if not d:
                return None
            return {**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"])}

        for d in self._read_local():
            if d.get("id") == note_id:
                return d
        return None

    # UPDATE
    def update_note(
        self,
        note_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        pinned: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        existing = self.get_note(note_id)
        if not existing:
            return None

        updated = ResearchNoteSchema(
            id=note_id,
            user_id=existing.get("user_id", "u-default"),
            title=title.strip() if title is not None else existing["title"],
            content=content.strip() if content is not None else existing["content"],
            category=category if category is not None else existing["category"],
            tags=[t.strip() for t in tags if t.strip()] if tags is not None else existing.get("tags", []),
            metadata=NoteMetadataSchema(
                word_count=len((content if content is not None else existing["content"]).split()),
                pinned=pinned if pinned is not None else existing.get("metadata", {}).get("pinned", False),
                source_conversation_id=existing.get("metadata", {}).get("source_conversation_id"),
            ),
            created_at=existing.get("created_at", now_iso()),
            updated_at=now_iso(),
        )
        payload = updated.model_dump()

        col = self._get_collection()
        if col is not None:
            col.update_one({"_id": note_id}, {"$set": {k: v for k, v in payload.items() if k != "id"}})
            return payload

        docs = [payload if d.get("id") == note_id else d for d in self._read_local()]
        self._write_local(docs)
        return payload

    # DELETE
    def delete_note(self, note_id: str) -> bool:
        col = self._get_collection()
        if col is not None:
            res = col.delete_one({"_id": note_id})
            return res.deleted_count > 0

        docs = self._read_local()
        remaining = [d for d in docs if d.get("id") != note_id]
        if len(remaining) == len(docs):
            return False
        self._write_local(remaining)
        return True


note_store = MongoNoteStore()
