"""
Document Intelligence & RAG Agent (backend/document_rag/agent.py)
- Extracts text and metadata from PDF (PyMuPDF), DOCX, PPTX, XLSX, CSV, TXT, and Images.
- Splits documents into chunks for Retrieval-Augmented Generation (RAG).
- Answers questions using retrieved chunks and provides source citations ([CIT-1], etc.).
- Compares any two uploaded documents.
"""

from collections import Counter
from pathlib import Path
import re
from typing import Any, Dict, List

import pymupdf as fitz
from docx import Document as DocxDocument
from pptx import Presentation
import openpyxl
import pandas as pd
from PIL import Image

from config import ask_llm

STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "your", "are", "was",
    "were", "have", "has", "had", "not", "but", "what", "all", "can", "when",
    "there", "use", "each", "which", "how", "their", "will", "other", "about",
}


def extract_document(file_path: str, filename: str) -> Dict[str, Any]:
    path = Path(file_path)
    ext = path.suffix.lower().lstrip(".")
    text = ""
    page_count = 1

    if ext == "pdf":
        doc = fitz.open(str(path))
        page_count = len(doc)
        pages = [f"[Page {i + 1}]\n{page.get_text('text')}" for i, page in enumerate(doc)]
        doc.close()
        text = "\n\n".join(pages)
    elif ext == "docx":
        doc = DocxDocument(str(path))
        paras = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n\n".join(paras)
        page_count = max(1, len(paras) // 15 + 1)
    elif ext == "pptx":
        prs = Presentation(str(path))
        page_count = max(1, len(prs.slides))
        slides = []
        for idx, slide in enumerate(prs.slides, start=1):
            lines = [f"[Slide {idx}]"]
            for shape in slide.shapes:
                if shape.has_text_frame:
                    lines.append(shape.text_frame.text)
            slides.append("\n".join(lines))
        text = "\n\n".join(slides)
    elif ext == "xlsx":
        wb = openpyxl.load_workbook(str(path), data_only=True)
        page_count = len(wb.sheetnames)
        sheets = []
        for name in wb.sheetnames:
            ws = wb[name]
            rows = [" | ".join(str(c) if c is not None else "" for c in r) for r in list(ws.iter_rows(values_only=True))[:40]]
            sheets.append(f"[Sheet {name}]\n" + "\n".join(rows))
        wb.close()
        text = "\n\n".join(sheets)
    elif ext == "csv":
        df = pd.read_csv(str(path))
        text = f"CSV Columns: {', '.join(map(str, df.columns))}\nRows: {len(df)}\n\n{df.head(30).to_string()}"
    elif ext in ("png", "jpg", "jpeg", "webp"):
        img = Image.open(str(path))
        w, h = img.size
        fmt = img.format or ext.upper()
        img.close()
        text = f"[Image Document: {filename} | Resolution: {w}x{h}px | Format: {fmt}]"
    else:
        text = path.read_text(encoding="utf-8", errors="replace")

    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    concepts = [w for w, _ in Counter(w for w in words if w not in STOPWORDS).most_common(8)]

    chunks = []
    raw_paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    buf = ""
    for idx, p in enumerate(raw_paras):
        if len(buf) + len(p) <= 600:
            buf = f"{buf}\n{p}".strip() if buf else p
        else:
            if buf:
                chunks.append({"chunk_index": len(chunks), "page_number": 1, "content": buf})
            buf = p[:600]
    if buf:
        chunks.append({"chunk_index": len(chunks), "page_number": 1, "content": buf})

    lead = " ".join(text.split()[:45]) or "Uploaded file processed."
    summary = f"Summary of {filename}: {lead}... Key concepts: {', '.join(concepts[:5]) or 'general'}."

    return {
        "doc_type": "image" if ext in ("png", "jpg", "jpeg", "webp") else ext,
        "page_count": page_count,
        "extracted_text": text,
        "summary": summary,
        "key_concepts": concepts,
        "chunks": chunks,
    }


def query_rag(documents: List[Dict[str, Any]], query: str, top_k: int = 4) -> Dict[str, Any]:
    if not documents:
        return {
            "answer": "No documents uploaded yet. Upload a PDF, DOCX, PPTX, CSV, or TXT file first to search with RAG.",
            "citations": [],
            "grounded": False,
        }

    q_tokens = set(re.findall(r"\b[a-z0-9]{3,}\b", query.lower()))
    scored = []
    for doc in documents:
        for ch in doc.get("chunks", []):
            c_tokens = set(re.findall(r"\b[a-z0-9]{3,}\b", ch["content"].lower()))
            overlap = len(q_tokens.intersection(c_tokens)) / max(1, len(q_tokens)) if q_tokens else 0.1
            score = round(0.25 + 0.75 * overlap, 3)
            scored.append({
                "document_id": doc["id"],
                "document_title": doc["title"],
                "page_number": ch.get("page_number", 1),
                "chunk_index": ch.get("chunk_index", 0),
                "content": ch["content"],
                "score": score,
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:top_k]

    citations = [
        {
            "citation_id": f"CIT-{i + 1}",
            "document_id": item["document_id"],
            "document_title": item["document_title"],
            "page_number": item["page_number"],
            "chunk_index": item["chunk_index"],
            "score": item["score"],
            "excerpt": item["content"][:260],
        }
        for i, item in enumerate(top)
    ]

    context_str = "\n\n".join(
        f"[CIT-{i + 1} | {c['document_title']}]\n{c['excerpt']}" for i, c in enumerate(citations)
    )
    llm_res = ask_llm(
        prompt=f"Answer the question using these retrieved document passages and cite [CIT-1], etc.:\n\n{context_str}\n\nQuestion: {query}",
        system_prompt="You are the Omniscient AI RAG Agent. Always cite [CIT-1] sources.",
    )
    answer = llm_res["content"]
    if "Omniscient AI Response" in answer:
        lines = [f"### Grounded RAG Answer (`{len(citations)}` Verified Source Chunks)\n"]
        for c in citations:
            lines.append(f"- **[{c['citation_id']}] `{c['document_title']}` (Score: `{c['score']}`)**:\n  > {c['excerpt']}")
        answer = "\n".join(lines)

    return {"answer": answer, "citations": citations, "grounded": True}


def compare_two_documents(doc_a: Dict[str, Any], doc_b: Dict[str, Any]) -> Dict[str, Any]:
    ca = set(doc_a.get("key_concepts", []))
    cb = set(doc_b.get("key_concepts", []))
    shared = sorted(ca.intersection(cb))
    only_a = sorted(ca - cb)
    only_b = sorted(cb - ca)
    text_a = (doc_a.get("extracted_text") or "")[:1500]
    text_b = (doc_b.get("extracted_text") or "")[:1500]

    report = (
        f"## 📊 Multi-Document / Spreadsheet Comparison Report\n\n"
        f"| Attribute | `{doc_a['title']}` | `{doc_b['title']}` |\n"
        f"|-----------|--------------------|--------------------|\n"
        f"| **Pages / Sheets** | {doc_a.get('page_count', 1)} | {doc_b.get('page_count', 1)} |\n"
        f"| **Key Concepts** | {', '.join(list(ca)[:5]) or 'General'} | {', '.join(list(cb)[:5]) or 'General'} |\n"
        f"| **Unique Focus** | {', '.join(only_a[:5]) or 'None'} | {', '.join(only_b[:5]) or 'None'} |\n\n"
        f"- **Shared Themes ({len(shared)})**: {', '.join(shared) or 'Distinct topics'}\n"
    )
    if text_a or text_b:
        llm_cmp = ask_llm(
            prompt=(
                f"Compare these two uploaded files (`{doc_a['title']}` vs `{doc_b['title']}`) and highlight "
                f"structural similarities, data differences, and key takeaways in a structured Markdown table:\n\n"
                f"--- FILE A ({doc_a['title']}) ---\n{text_a}\n\n"
                f"--- FILE B ({doc_b['title']}) ---\n{text_b}"
            ),
            system_prompt="You are the Omniscient AI Document & Data Comparison Analyst.",
        )
        if llm_cmp.get("provider") == "groq":
            report = llm_cmp["content"]

    return {"report_markdown": report, "shared_concepts": shared}
