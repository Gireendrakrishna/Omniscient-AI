"""
Intelligent Prompt Template Engine & Template Library (backend/general_assistant/prompt_engine.py)
Implements the 5-Stage LLM Prompt Optimization Pipeline:
- Stage 1: User Input (+ Attached File Context)
- Stage 2: LLM Prompt Analysis (Intent, Task, Topic, Format, Audience, Capabilities)
- Stage 3: LLM Prompt Template Generation (ROLE, TASK, REQUIREMENTS, OUTPUT FORMAT, DIFFICULTY)
- Stage 4 & 5: Handed off to the LangGraph Unified Execution Router.
Also manages the persistent 6-Category Prompt Template Library (Built-in + User Custom Templates).
"""

import json
import re
from typing import Any, Dict, List, Optional

from config import ask_llm
from database import get_conn, new_id, now_iso


BUILTIN_PROMPT_TEMPLATES: List[Dict[str, str]] = [
    # A. EDUCATION (9 Templates)
    {
        "id": "tpl-edu-1",
        "category": "EDUCATION",
        "title": "Explain a Concept",
        "description": "Deep intuitive explanation with real-world analogies, breakdown tables, and takeaways.",
        "prompt_text": "ROLE:\nYou are an expert educator and mentor.\n\nTASK:\nExplain the concept of [Insert Topic] in depth.\n\nREQUIREMENTS:\n1. Provide the core intuition in plain English.\n2. Give a memorable real-world analogy.\n3. Provide a step-by-step technical breakdown table.\n4. Highlight common misconceptions and how to avoid them.\n5. Conclude with a key takeaways checklist.\n\nDIFFICULTY:\nIntermediate.",
    },
    {
        "id": "tpl-edu-2",
        "category": "EDUCATION",
        "title": "Chapter Summary",
        "description": "Structured summary of a textbook chapter or lecture with key definitions and formulas.",
        "prompt_text": "ROLE:\nYou are an academic curriculum specialist.\n\nTASK:\nCreate a comprehensive chapter summary for [Insert Chapter/Topic or Attached Document].\n\nREQUIREMENTS:\n1. Executive overview of the chapter.\n2. Key definitions, theorems, or formulas in a table.\n3. Section-by-section summary.\n4. 5 revision review questions.",
    },
    {
        "id": "tpl-edu-3",
        "category": "EDUCATION",
        "title": "Generate MCQs",
        "description": "Multiple-choice questions with 4 options, answer key, and trap explanations.",
        "prompt_text": "ROLE:\nYou are an academic examiner.\n\nTASK:\nGenerate 10 multiple-choice questions (MCQs) on [Insert Topic or Attached Document].\n\nREQUIREMENTS:\n1. Provide 4 options (A, B, C, D) per question.\n2. Clearly state the Correct Answer.\n3. Explain why the correct choice is right and why the other options are distractors/traps.\n\nDIFFICULTY:\nIntermediate.",
    },
    {
        "id": "tpl-edu-4",
        "category": "EDUCATION",
        "title": "Generate Short-Answer Questions",
        "description": "Conceptual short-answer questions with model answers and grading rubrics.",
        "prompt_text": "ROLE:\nYou are a university professor.\n\nTASK:\nCreate 8 short-answer conceptual questions on [Insert Topic] along with ideal model answers and key grading points.",
    },
    {
        "id": "tpl-edu-5",
        "category": "EDUCATION",
        "title": "Create Study Notes",
        "description": "High-retention revision notes with bullet points, tables, and memory cues.",
        "prompt_text": "ROLE:\nYou are an expert study strategist.\n\nTASK:\nGenerate structured, high-retention study notes on [Insert Topic or Attached Document] with summary tables, key terms, and quick recall checklists.",
    },
    {
        "id": "tpl-edu-6",
        "category": "EDUCATION",
        "title": "Create a Study Plan",
        "description": "Day-by-day personalized study schedule with daily milestones and active recall.",
        "prompt_text": "ROLE:\nYou are an academic coach.\n\nTASK:\nCreate a 7-day personalized study plan to master [Insert Topic], allocating 60 minutes per day across theory, practice problems, and active recall review.",
    },
    {
        "id": "tpl-edu-7",
        "category": "EDUCATION",
        "title": "Explain Programming Concepts",
        "description": "Learn programming paradigms, syntax, and patterns with annotated code examples.",
        "prompt_text": "ROLE:\nYou are a senior computer science instructor.\n\nTASK:\nExplain the programming concept of [Insert Concept, e.g., Recursion / Async-Await / Pointers] with mental models, dry-run trace tables, and annotated code examples.",
    },
    {
        "id": "tpl-edu-8",
        "category": "EDUCATION",
        "title": "Generate Flashcards",
        "description": "Question-and-answer active recall flashcards for rapid memorization.",
        "prompt_text": "ROLE:\nYou are a cognitive learning specialist.\n\nTASK:\nCreate 10 high-yield Question & Answer flashcards for [Insert Topic] formatted in a clean Markdown table (`| Card # | Front (Question) | Back (Answer) |`).",
    },
    {
        "id": "tpl-edu-9",
        "category": "EDUCATION",
        "title": "Prepare for Examinations",
        "description": "Complete exam cram guide with high-probability topics, formulas, and practice test.",
        "prompt_text": "ROLE:\nYou are an exam preparation mentor.\n\nTASK:\nPrepare a complete examination readiness guide for [Insert Subject/Exam], including high-yield concepts, common exam traps, a formula/concept cheat sheet, and 5 practice questions.",
    },

    # B. PROGRAMMING (7 Templates)
    {
        "id": "tpl-prog-1",
        "category": "PROGRAMMING",
        "title": "Explain Code",
        "description": "Line-by-line walkthrough of how a code snippet works and its time/space complexity.",
        "prompt_text": "ROLE:\nYou are a principal software engineer.\n\nTASK:\nExplain the following code step-by-step, including its control flow, data structures, and Big-O time and space complexity:\n\n```\n[Paste Code Here]\n```",
    },
    {
        "id": "tpl-prog-2",
        "category": "PROGRAMMING",
        "title": "Debug Code",
        "description": "Identify logical bugs, edge-case crashes, and syntax errors with fixed code.",
        "prompt_text": "ROLE:\nYou are a senior debugging specialist.\n\nTASK:\nFind all bugs, edge-case failures, and logical errors in the following code, explain the root cause of each bug, and provide the corrected code:\n\n```\n[Paste Buggy Code Here]\n```",
    },
    {
        "id": "tpl-prog-3",
        "category": "PROGRAMMING",
        "title": "Generate Code",
        "description": "Write clean, modular, production-ready code with type hints and documentation.",
        "prompt_text": "ROLE:\nYou are a senior software architect.\n\nTASK:\nWrite clean, well-documented, production-grade code in [Language, e.g., Python] to solve: [Describe Problem]. Include error handling, complexity analysis, and example usage.",
    },
    {
        "id": "tpl-prog-4",
        "category": "PROGRAMMING",
        "title": "Optimize Code",
        "description": "Refactor slow code to improve asymptotic Big-O time and memory efficiency.",
        "prompt_text": "ROLE:\nYou are a performance engineering expert.\n\nTASK:\nOptimize the following code for better time and space complexity. Compare the before-and-after Big-O complexity in a table:\n\n```\n[Paste Code Here]\n```",
    },
    {
        "id": "tpl-prog-5",
        "category": "PROGRAMMING",
        "title": "Explain Algorithms",
        "description": "Deep-dive into data structures and algorithms with dry-run trace tables.",
        "prompt_text": "ROLE:\nYou are an algorithms professor.\n\nTASK:\nExplain the [Insert Algorithm Name] algorithm. Include its core intuition, step-by-step trace table on a sample input, Python implementation, and Best/Average/Worst time and space complexity.",
    },
    {
        "id": "tpl-prog-6",
        "category": "PROGRAMMING",
        "title": "Convert Code Between Languages",
        "description": "Translate code idiomatically from one programming language to another.",
        "prompt_text": "ROLE:\nYou are a polyglot software engineer.\n\nTASK:\nConvert the following code from [Source Language] to idiomatic [Target Language], preserving all logic and explaining key language differences:\n\n```\n[Paste Source Code Here]\n```",
    },
    {
        "id": "tpl-prog-7",
        "category": "PROGRAMMING",
        "title": "Generate Unit Tests",
        "description": "Create comprehensive unit tests covering normal, boundary, and error cases.",
        "prompt_text": "ROLE:\nYou are a QA automation architect.\n\nTASK:\nWrite a comprehensive unit test suite (covering happy paths, boundary conditions, and exception handling) for the following code:\n\n```\n[Paste Code Here]\n```",
    },

    # C. DOCUMENTS (7 Templates)
    {
        "id": "tpl-doc-1",
        "category": "DOCUMENTS",
        "title": "Summarize PDF",
        "description": "Comprehensive summary of an uploaded PDF or document with key citations.",
        "prompt_text": "Summarize the attached document in detail. Include an executive summary, key takeaways table, core concepts, and citations to specific sections.",
    },
    {
        "id": "tpl-doc-2",
        "category": "DOCUMENTS",
        "title": "Extract Important Information",
        "description": "Extract entities, dates, metrics, requirements, and action items from uploaded files.",
        "prompt_text": "Extract all key facts, metrics, definitions, and critical requirements from the attached document and organize them into a structured Markdown table.",
    },
    {
        "id": "tpl-doc-3",
        "category": "DOCUMENTS",
        "title": "Compare Documents",
        "description": "Compare two uploaded documents or spreadsheets side-by-side.",
        "prompt_text": "Compare the attached documents. Identify shared themes, key differences, data discrepancies, and unique points in a structured comparison table.",
    },
    {
        "id": "tpl-doc-4",
        "category": "DOCUMENTS",
        "title": "Generate Executive Summary",
        "description": "Concise 1-page briefing for decision-makers from long documents.",
        "prompt_text": "Generate a concise Executive Summary of the attached document, highlighting the primary objective, key findings, risks, and recommended actions.",
    },
    {
        "id": "tpl-doc-5",
        "category": "DOCUMENTS",
        "title": "Extract Tables",
        "description": "Parse and synthesize tabular data and statistics from uploaded files.",
        "prompt_text": "Extract all tabular data, metrics, and numerical summaries from the attached file and present them as clean Markdown tables with analysis.",
    },
    {
        "id": "tpl-doc-6",
        "category": "DOCUMENTS",
        "title": "Create Presentation Outline",
        "description": "Turn an uploaded document or topic into a slide-by-slide presentation deck.",
        "prompt_text": "Analyze the attached document and create a 10-slide presentation outline, including Slide Title, Bullet Points, and Speaker Notes for each slide.",
    },
    {
        "id": "tpl-doc-7",
        "category": "DOCUMENTS",
        "title": "Generate Questions from Documents",
        "description": "Create comprehension, viva, and exam questions grounded in your uploaded file.",
        "prompt_text": "Read the attached document and generate 15 multiple-choice and short-answer assessment questions with answers grounded directly in the text.",
    },

    # D. RESEARCH (6 Templates)
    {
        "id": "tpl-res-1",
        "category": "RESEARCH",
        "title": "Research a Topic",
        "description": "Search live web sources and compile a cited research briefing.",
        "prompt_text": "Research the latest developments and foundational principles of [Insert Research Topic]. Compare multiple trustworthy sources and include clickable citations.",
    },
    {
        "id": "tpl-res-2",
        "category": "RESEARCH",
        "title": "Compare Multiple Sources",
        "description": "Cross-examine competing methodologies, frameworks, or viewpoints.",
        "prompt_text": "Research and compare multiple authoritative sources on [Insert Topic]. Present a side-by-side comparison table of methodologies, pros/cons, and consensus findings.",
    },
    {
        "id": "tpl-res-3",
        "category": "RESEARCH",
        "title": "Generate Research Report",
        "description": "Formal academic/technical research report with abstract, findings, and references.",
        "prompt_text": "Conduct web research and generate a comprehensive technical research report on [Insert Topic] containing an Abstract, Background, Key Developments, Comparative Table, and Cited References.",
    },
    {
        "id": "tpl-res-4",
        "category": "RESEARCH",
        "title": "Literature Review",
        "description": "Synthesize foundational papers, concepts, and open research problems.",
        "prompt_text": "Compile a structured Literature Review on [Insert Academic Topic], summarizing foundational theories, recent advances, research gaps, and key references.",
    },
    {
        "id": "tpl-res-5",
        "category": "RESEARCH",
        "title": "Fact Checking",
        "description": "Verify claims against authoritative sources and provide evidence.",
        "prompt_text": "Verify the following claim using web research and authoritative principles: '[Insert Claim]'. Provide a clear verdict, supporting evidence, and source citations.",
    },
    {
        "id": "tpl-res-6",
        "category": "RESEARCH",
        "title": "Industry Analysis",
        "description": "Analyze market trends, key technologies, benchmarks, and strategic outlook.",
        "prompt_text": "Research and produce an Industry & Technology Analysis on [Insert Sector/Technology], covering current landscape, key benchmarks, challenges, and future outlook.",
    },

    # E. WRITING (7 Templates)
    {
        "id": "tpl-wrt-1",
        "category": "WRITING",
        "title": "Professional Email",
        "description": "Draft a clear, polished email for academic, technical, or leadership communication.",
        "prompt_text": "Write a concise, professional email regarding [Insert Purpose/Context] addressed to [Recipient Role], with a clear subject line, structured body, and call to action.",
    },
    {
        "id": "tpl-wrt-2",
        "category": "WRITING",
        "title": "Essay Writing",
        "description": "Structured analytical essay with thesis, evidence-backed body paragraphs, and conclusion.",
        "prompt_text": "Write a well-structured analytical essay on [Insert Essay Topic] with a compelling thesis statement, structured arguments, concrete examples, and a synthesis conclusion.",
    },
    {
        "id": "tpl-wrt-3",
        "category": "WRITING",
        "title": "Report Writing",
        "description": "Formal project or technical report with executive summary and recommendations.",
        "prompt_text": "Draft a formal technical project report on [Insert Project/Topic] including Objective, Architecture/Methodology, Results Table, and Recommendations.",
    },
    {
        "id": "tpl-wrt-4",
        "category": "WRITING",
        "title": "Improve Grammar",
        "description": "Proofread and polish text for clarity, grammar, and academic/professional tone.",
        "prompt_text": "Proofread and improve the grammar, clarity, and flow of the following text while preserving its core meaning. Show the polished version and list key improvements:\n\n[Paste Text Here]",
    },
    {
        "id": "tpl-wrt-5",
        "category": "WRITING",
        "title": "Rewrite Content",
        "description": "Adapt existing text for a new audience, tone, or conciseness level.",
        "prompt_text": "Rewrite the following content to be more concise, impactful, and tailored for a [Target Audience, e.g., technical executive / academic] audience:\n\n[Paste Content Here]",
    },
    {
        "id": "tpl-wrt-6",
        "category": "WRITING",
        "title": "Generate Ideas",
        "description": "Structured brainstorming for project features, research topics, or architectures.",
        "prompt_text": "Brainstorm 10 innovative, feasible ideas for [Insert Domain/Project Goal], organized in a table with Idea Name, Core Mechanism, Impact, and Implementation Complexity.",
    },
    {
        "id": "tpl-wrt-7",
        "category": "WRITING",
        "title": "Professional Communication",
        "description": "Prepare talking points, executive briefings, or project viva answers.",
        "prompt_text": "Prepare clear, persuasive talking points and anticipated Q&A responses for a presentation on [Insert Topic/Project].",
    },

    # F. IMAGE AND CREATIVE (5 Templates)
    {
        "id": "tpl-img-1",
        "category": "IMAGE AND CREATIVE",
        "title": "Generate an Image",
        "description": "Synthesize an educational diagram, technical blueprint, or visual illustration.",
        "prompt_text": "Generate an image illustrating [Describe Visual Concept or System Architecture] in a clean educational diagram style.",
    },
    {
        "id": "tpl-img-2",
        "category": "IMAGE AND CREATIVE",
        "title": "Explain an Image",
        "description": "Analyze an uploaded image and explain all visual elements and concepts.",
        "prompt_text": "Explain the attached image in detail. Describe its visual components, structure, and key takeaways.",
    },
    {
        "id": "tpl-img-3",
        "category": "IMAGE AND CREATIVE",
        "title": "Analyze a Screenshot",
        "description": "Inspect a UI, code, or error screenshot and provide a technical diagnosis.",
        "prompt_text": "Analyze the attached screenshot. Identify any code, UI elements, or error messages shown and provide a clear explanation and solution.",
    },
    {
        "id": "tpl-img-4",
        "category": "IMAGE AND CREATIVE",
        "title": "Explain a Diagram",
        "description": "Walk through a flowchart, architecture diagram, or scientific figure step-by-step.",
        "prompt_text": "Explain the attached diagram step-by-step. Walk through each node, connection, and data flow shown in the figure.",
    },
    {
        "id": "tpl-img-5",
        "category": "IMAGE AND CREATIVE",
        "title": "Extract Text from an Image",
        "description": "Perform OCR text and metadata extraction from an uploaded image or note.",
        "prompt_text": "Extract all readable text, labels, and equations from the attached image and organize the extracted content cleanly.",
    },
]


def seed_builtin_templates() -> None:
    conn = get_conn()
    cur = conn.cursor()
    for tpl in BUILTIN_PROMPT_TEMPLATES:
        existing = cur.execute("SELECT id FROM prompt_templates WHERE id = ?", (tpl["id"],)).fetchone()
        if not existing:
            cur.execute(
                """
                INSERT INTO prompt_templates (id, user_id, category, title, description, prompt_text, is_custom, use_count, last_used_at, created_at)
                VALUES (?, 'system', ?, ?, ?, ?, 0, 0, '', ?)
                """,
                (tpl["id"], tpl["category"], tpl["title"], tpl["description"], tpl["prompt_text"], now_iso()),
            )
    conn.commit()
    conn.close()


def list_prompt_templates(search: str = "", category: str = "") -> Dict[str, Any]:
    seed_builtin_templates()
    conn = get_conn()
    rows = conn.execute("SELECT * FROM prompt_templates ORDER BY is_custom DESC, category ASC, title ASC").fetchall()
    conn.close()

    all_items = [
        {
            "id": r["id"],
            "category": r["category"],
            "title": r["title"],
            "description": r["description"],
            "prompt_text": r["prompt_text"],
            "is_custom": bool(r["is_custom"]),
            "use_count": r["use_count"],
            "last_used_at": r["last_used_at"],
        }
        for r in rows
    ]

    filtered = all_items
    if category and category.upper() != "ALL":
        filtered = [t for t in filtered if t["category"].upper() == category.upper()]
    if search.strip():
        q = search.strip().lower()
        filtered = [
            t
            for t in filtered
            if q in t["title"].lower() or q in t["description"].lower() or q in t["prompt_text"].lower()
        ]

    recently_used = sorted(
        [t for t in all_items if t["last_used_at"]],
        key=lambda x: x["last_used_at"],
        reverse=True,
    )[:6]

    return {
        "templates": filtered,
        "recently_used": recently_used,
        "categories": [
            "EDUCATION",
            "PROGRAMMING",
            "DOCUMENTS",
            "RESEARCH",
            "WRITING",
            "IMAGE AND CREATIVE",
            "CUSTOM",
        ],
    }


def create_custom_template(
    title: str,
    category: str,
    description: str,
    prompt_text: str,
    user_id: str = "u-default",
) -> Dict[str, Any]:
    tid = f"tpl-custom-{new_id()[:8]}"
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO prompt_templates (id, user_id, category, title, description, prompt_text, is_custom, use_count, last_used_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, '', ?)
        """,
        (tid, user_id, category.upper() or "CUSTOM", title.strip(), description.strip(), prompt_text.strip(), now_iso()),
    )
    conn.commit()
    conn.close()
    return {
        "id": tid,
        "category": category.upper() or "CUSTOM",
        "title": title.strip(),
        "description": description.strip(),
        "prompt_text": prompt_text.strip(),
        "is_custom": True,
        "use_count": 0,
        "last_used_at": "",
    }


def update_custom_template(
    template_id: str,
    title: Optional[str] = None,
    category: Optional[str] = None,
    description: Optional[str] = None,
    prompt_text: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM prompt_templates WHERE id = ?", (template_id,)).fetchone()
    if not row:
        conn.close()
        raise ValueError("Template not found")

    new_title = title.strip() if title is not None else row["title"]
    new_cat = category.strip().upper() if category is not None else row["category"]
    new_desc = description.strip() if description is not None else row["description"]
    new_prompt = prompt_text.strip() if prompt_text is not None else row["prompt_text"]

    conn.execute(
        """
        UPDATE prompt_templates
        SET title = ?, category = ?, description = ?, prompt_text = ?
        WHERE id = ?
        """,
        (new_title, new_cat, new_desc, new_prompt, template_id),
    )
    conn.commit()
    conn.close()
    return {
        "id": template_id,
        "category": new_cat,
        "title": new_title,
        "description": new_desc,
        "prompt_text": new_prompt,
        "is_custom": bool(row["is_custom"]),
    }


def delete_custom_template(template_id: str) -> bool:
    conn = get_conn()
    conn.execute("DELETE FROM prompt_templates WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return True


def record_template_usage(template_id: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE prompt_templates SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
        (now_iso(), template_id),
    )
    conn.commit()
    conn.close()


# ==============================================================================
# 5-STAGE INTELLIGENT PROMPT TEMPLATE ENGINE (LLM-Backed)
# ==============================================================================

def optimize_and_analyze_prompt(
    raw_prompt: str,
    attached_files: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Executes Stage 2 (Prompt Analysis) and Stage 3 (Prompt Template Generation)
    using the configured LLM provider.
    Produces a structured task specification and an optimized `ROLE / TASK / REQUIREMENTS / OUTPUT FORMAT / DIFFICULTY` prompt.
    """
    files_info = attached_files or []
    file_names = [f.get("title") or f.get("original_filename", "file") for f in files_info]
    file_types = [f.get("doc_type", "").lower() for f in files_info]
    has_files = len(files_info) > 0
    has_images = any(t in ("image", "png", "jpg", "jpeg", "webp") for t in file_types)
    has_multiple_docs = len(files_info) >= 2

    lower = raw_prompt.lower()

    # Determine required capabilities based on prompt + attached files
    capabilities: List[str] = []
    if has_images or any(k in lower for k in ("screenshot", "explain this image", "analyze this image", "ocr", "diagram in this image")):
        capabilities.append("vision_model")
    if (has_files and not has_images) or any(k in lower for k in ("pdf", "docx", "pptx", "xlsx", "csv", "spreadsheet", "uploaded", "document")):
        if has_multiple_docs or "compare" in lower:
            capabilities.append("document_comparison")
        else:
            capabilities.append("document_rag")
    if any(k in lower for k in ("generate an image", "create an image", "draw a diagram", "generate a diagram", "create an illustration")):
        capabilities.append("image_generation")
    if any(k in lower for k in ("research", "latest developments", "search the web", "compare sources", "fact check", "current information")):
        capabilities.append("web_research")
    if not capabilities or any(k in lower for k in ("summarize", "explain", "generate", "mcq", "question", "report", "translate", "write", "code")):
        capabilities.append("general_llm")

    # Deduplicate while preserving order
    dedup_caps: List[str] = []
    for c in capabilities:
        if c not in dedup_caps:
            dedup_caps.append(c)

    # Call the LLM to perform Stage 2 Analysis & Stage 3 Prompt Optimization
    llm_optimization_instruction = (
        "You are the OMNISCIENT AI Prompt Template & Optimization Engine.\n"
        "Analyze the user's raw input and transform it into a structured JSON object containing:\n"
        '1. "intent": primary intent string\n'
        '2. "task": concise task summary\n'
        '3. "topic": main subject or topic\n'
        '4. "output_format": desired output structure\n'
        '5. "target_audience": target audience / difficulty level\n'
        '6. "optimized_prompt": a structured prompt formatted with ROLE:, TASK:, REQUIREMENTS:, OUTPUT FORMAT:, and DIFFICULTY: sections.\n'
        "Return ONLY valid JSON without internal chain-of-thought.\n\n"
        f"Attached Files: {file_names if has_files else 'None'}\n"
        f"User Raw Input: {raw_prompt}"
    )

    llm_res = ask_llm(
        prompt=llm_optimization_instruction,
        system_prompt="You are a JSON-outputting Prompt Optimization Engine. Output strictly valid JSON.",
    )

    parsed_analysis: Optional[Dict[str, Any]] = None
    if llm_res.get("provider") == "groq":
        raw_text = llm_res.get("content", "")
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            try:
                candidate = json.loads(json_match.group(0))
                if isinstance(candidate, dict) and candidate.get("optimized_prompt"):
                    parsed_analysis = candidate
            except Exception:
                parsed_analysis = None

    if not parsed_analysis:
        # Structured synthesis when LLM returns non-JSON or when running on local engine
        role_str = "You are an expert AI educator, researcher, and systems architect."
        if "code" in lower or "program" in lower or "algorithm" in lower:
            role_str = "You are a Principal Software Engineer and Computer Science Professor."
        elif has_files:
            role_str = "You are a Senior Document Intelligence & Data Analyst."
        elif "research" in lower:
            role_str = "You are an Autonomous Research Analyst."

        reqs = [
            "1. Address the user's core request with high clarity and precision.",
            "2. Structure key concepts using clean Markdown headings and tables.",
            "3. Provide concrete examples, citations, or verification steps where applicable.",
        ]
        if "mcq" in lower or "question" in lower:
            reqs.append("4. Generate multiple-choice questions with options A-D, answers, and explanations.")
        if has_files:
            reqs.append(f"5. Ground the analysis directly in the attached file(s): {', '.join(file_names)}.")

        optimized_text = (
            f"ROLE:\n{role_str}\n\n"
            f"TASK:\n{raw_prompt.strip()}\n\n"
            f"REQUIREMENTS:\n" + "\n".join(reqs) + "\n\n"
            f"OUTPUT FORMAT:\n- Structured Markdown with clear sections, tables, and takeaways.\n\n"
            f"DIFFICULTY:\nBeginner to Intermediate."
        )
        parsed_analysis = {
            "intent": dedup_caps[0] if dedup_caps else "general_llm",
            "task": raw_prompt.strip()[:140],
            "topic": raw_prompt.strip()[:80],
            "output_format": "Structured Markdown with tables and examples",
            "target_audience": "Beginner to Intermediate",
            "optimized_prompt": optimized_text,
        }

    return {
        "original_prompt": raw_prompt,
        "intent": parsed_analysis.get("intent", dedup_caps[0]),
        "task": parsed_analysis.get("task", raw_prompt[:140]),
        "topic": parsed_analysis.get("topic", raw_prompt[:80]),
        "output_format": parsed_analysis.get("output_format", "Structured Markdown"),
        "target_audience": parsed_analysis.get("target_audience", "Intermediate"),
        "uses_uploaded_files": has_files,
        "requires_web_research": "web_research" in dedup_caps,
        "required_capabilities": dedup_caps,
        "optimized_prompt": parsed_analysis.get("optimized_prompt", raw_prompt),
        "llm_provider": llm_res.get("provider", "groq"),
    }
