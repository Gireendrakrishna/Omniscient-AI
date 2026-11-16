"""
Automated End-to-End Verification Suite for OMNISCIENT AI
"""

import json
import os
from PIL import Image
import pymupdf as fitz

from code_review.agent import execute_code_in_sandbox, review_code
from config import STORAGE_DIR
from database import get_conn, init_db, new_id, now_iso
from document_rag.agent import extract_document
from edtech.agent import (
    evaluate_submission,
    explain_lesson,
    generate_course_blueprint,
    generate_flashcards,
    generate_quiz,
    generate_study_plan,
)
from general_assistant.agent import run_supervisor
from general_assistant.prompt_engine import (
    create_custom_template,
    delete_custom_template,
    list_prompt_templates,
    optimize_and_analyze_prompt,
    record_template_usage,
    update_custom_template,
)
from general_assistant.router import (
    ChatRequest,
    MemoryCreateRequest,
    api_chat,
    api_clear_all_conversations,
    api_create_memory,
    api_delete_conversation,
    api_list_memories,
)


def _run_coro(coro):
    try:
        while True:
            coro.send(None)
    except StopIteration as stop:
        return stop.value


def _create_temp_doc(filename: str, raw_bytes: bytes, cleanup_paths: list, cleanup_ids: list) -> str:
    doc_id = new_id()
    dest = STORAGE_DIR / f"{doc_id}_{filename}"
    dest.write_bytes(raw_bytes)
    cleanup_paths.append(dest)
    cleanup_ids.append(doc_id)

    extracted = extract_document(str(dest), filename)
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO documents (id, user_id, title, doc_type, file_path, file_size, page_count, extracted_text, summary, key_concepts_json, chunks_json, created_at)
        VALUES (?, 'u-default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            doc_id,
            filename,
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
    return doc_id


def test_omniscient_platform():
    init_db()
    cleanup_paths = []
    cleanup_ids = []

    try:
        # 1. Conversational Prompt + 5-Stage Prompt Optimization
        opt = optimize_and_analyze_prompt("Explain machine learning and give me questions.")
        assert "ROLE:" in opt["optimized_prompt"]
        assert "TASK:" in opt["optimized_prompt"]

        res1 = run_supervisor("Explain machine learning and give me questions.")
        assert res1["has_failures"] is False
        assert len(res1["response"]) > 50

        # 2. PDF Ingestion + Grounded RAG Citations
        pdf_doc = fitz.open()
        page = pdf_doc.new_page()
        page.insert_text((72, 72), "Omniscient AI Unified Architecture uses LangGraph routing and RAG citations.")
        pdf_bytes = pdf_doc.tobytes()
        pdf_doc.close()
        pdf_id = _create_temp_doc("architecture_guide.pdf", pdf_bytes, cleanup_paths, cleanup_ids)

        res2 = run_supervisor(
            "Summarize this PDF and generate 5 multiple-choice questions.",
            attached_file_ids=[pdf_id],
        )
        assert "document_rag" in res2["capabilities_used"]
        assert len(res2["citations"]) >= 1

        # 3. Image Vision Analysis
        img_temp = STORAGE_DIR / f"temp_{new_id()[:8]}.webp"
        Image.new("RGB", (320, 180), color=(15, 15, 15)).save(str(img_temp), format="WEBP")
        webp_bytes = img_temp.read_bytes()
        img_temp.unlink(missing_ok=True)
        webp_id = _create_temp_doc("test_diagram.webp", webp_bytes, cleanup_paths, cleanup_ids)

        res3 = run_supervisor("Explain this screenshot.", attached_file_ids=[webp_id])
        assert "vision_model" in res3["capabilities_used"]
        assert "320 x 180" in res3["response"] or "Vision" in res3["response"]

        # 4. Image Generation
        res4 = run_supervisor("Generate an image of a multi-agent AI supervisor pipeline.")
        assert "image_generation" in res4["capabilities_used"]
        assert len(res4["generated_images"]) >= 1

        # 5. Live Web Research
        res5 = run_supervisor("Research the latest developments in agentic AI.")
        assert "web_research" in res5["capabilities_used"]
        assert len(res5["citations"]) >= 1

        # 6. Multi-Document Spreadsheet Comparison
        csv_a = _create_temp_doc("q1.csv", b"quarter,revenue\nQ1,120000\n", cleanup_paths, cleanup_ids)
        csv_b = _create_temp_doc("q2.csv", b"quarter,revenue\nQ2,165000\n", cleanup_paths, cleanup_ids)
        res6 = run_supervisor("Compare these two CSV spreadsheets.", attached_file_ids=[csv_a, csv_b])
        assert "document_comparison" in res6["capabilities_used"]
        assert "q1.csv" in res6["response"] and "q2.csv" in res6["response"]

        # 7. Prompt Template Library & Custom Template CRUD
        lib = list_prompt_templates()
        assert len(lib["templates"]) >= 39
        custom = create_custom_template(
            title="Test Viva Template",
            category="CUSTOM",
            description="Temporary test template",
            prompt_text="ROLE:\nMentor\n\nTASK:\nExplain [Topic]",
        )
        record_template_usage(custom["id"])
        assert update_custom_template(custom["id"], title="Updated Viva Template")["title"] == "Updated Viva Template"
        delete_custom_template(custom["id"])

        # 8. Standalone Code Review & Sandbox input() Execution
        rev = review_code("def f(x, a=[]):\n    return eval(x)\n", "python")
        assert rev["issues_count"] >= 2
        assert "ast.literal_eval" in rev["corrected_code"]

        exec_in = execute_code_in_sandbox("A = int(input())\nprint(A * 3)", "python", stdin_data="14\n")
        assert exec_in["success"] is True
        assert "42" in exec_in["stdout"]

        # 9. Standalone EdTech LMS
        assert "Dynamic Programming" in explain_lesson("Dynamic Programming", "intermediate")["explanation_markdown"]
        assert len(generate_quiz("Algorithms", count=4)) == 4
        assert len(generate_flashcards("Graphs", count=3)) == 3
        assert len(generate_study_plan("Master AI", daily_minutes=45, days=5)["schedule"]) == 5
        assert "modules" in generate_course_blueprint("Deep Learning", "intermediate")
        assert evaluate_submission("## Architecture\nModular implementation.", 100.0)["suggested_score"] > 0

        # 10. Chat Persistence & History Deletion + Approved Memory
        mem = _run_coro(api_create_memory(MemoryCreateRequest(key="style", content="Concise tables", is_user_approved=True)))
        assert mem["memory"]["is_user_approved"] is True
        assert len(_run_coro(api_list_memories())["memories"]) >= 1

        chat_turn = _run_coro(api_chat(ChatRequest(prompt="Explain 1 + 1", attached_file_ids=[pdf_id])))
        assert _run_coro(api_delete_conversation(chat_turn["conversation_id"]))["deleted"] is True
        assert _run_coro(api_clear_all_conversations())["cleared"] is True

    finally:
        for p in cleanup_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        if cleanup_ids:
            conn = get_conn()
            for did in cleanup_ids:
                conn.execute("DELETE FROM documents WHERE id = ?", (did,))
            conn.commit()
            conn.close()
