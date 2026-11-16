import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn, new_id, now_iso
from edtech.agent import (
    evaluate_submission,
    explain_lesson,
    generate_course_blueprint,
    generate_flashcards,
    generate_quiz,
    generate_study_plan,
)

router = APIRouter()


class TutorRequest(BaseModel):
    concept: str
    difficulty: str = "intermediate"


class StudyPlanRequest(BaseModel):
    goal: str
    daily_minutes: int = 45
    days: int = 7
    weak_topics: List[str] = []


class FlashcardGenRequest(BaseModel):
    topic: str
    count: int = 4
    difficulty: str = "medium"
    save: bool = True


class QuizGenRequest(BaseModel):
    topic: str
    question_count: int = 5
    difficulty: str = "intermediate"
    save_to_course: bool = True


class QuizAttemptRequest(BaseModel):
    answers: Dict[str, str]


class CourseGenRequest(BaseModel):
    topic: str
    difficulty: str = "intermediate"
    module_count: int = 2
    save_draft: bool = True


class CourseUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None


class EnrollRequest(BaseModel):
    course_id: str


class SubmissionRequest(BaseModel):
    assignment_id: str
    content: str


@router.get("/api/courses")
async def api_list_courses() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM courses ORDER BY created_at DESC").fetchall()
    conn.close()
    courses = []
    for r in rows:
        courses.append({
            "id": r["id"],
            "title": r["title"],
            "code": r["code"],
            "description": r["description"],
            "difficulty": r["difficulty"],
            "is_published": bool(r["is_published"]),
            "is_enrolled": bool(r["is_enrolled"]),
            "modules": json.loads(r["modules_json"] or "[]"),
        })
    return {"courses": courses}


@router.post("/api/enrollments")
async def api_enroll(payload: EnrollRequest) -> Dict[str, Any]:
    conn = get_conn()
    conn.execute("UPDATE courses SET is_enrolled = 1 WHERE id = ?", (payload.course_id,))
    conn.commit()
    conn.close()
    return {"enrolled": True, "course_id": payload.course_id}


@router.post("/api/courses/ai-generate")
async def api_ai_generate_course(payload: CourseGenRequest) -> Dict[str, Any]:
    bp = generate_course_blueprint(payload.topic, payload.difficulty)
    cid = new_id()
    if payload.save_draft:
        conn = get_conn()
        conn.execute(
            """
            INSERT INTO courses (id, title, code, description, difficulty, is_published, is_enrolled, modules_json, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
            """,
            (cid, bp["title"], bp["code"], bp["description"], bp["difficulty"], json.dumps(bp["modules"]), now_iso()),
        )
        conn.commit()
        conn.close()
    return {"blueprint": bp, "saved_course_id": cid, "is_published": False}


@router.patch("/api/courses/{course_id}")
async def api_update_course(course_id: str, payload: CourseUpdateRequest) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Course not found")
    title = payload.title if payload.title is not None else row["title"]
    desc = payload.description if payload.description is not None else row["description"]
    pub = 1 if payload.is_published else int(row["is_published"])
    conn.execute(
        "UPDATE courses SET title = ?, description = ?, is_published = ? WHERE id = ?",
        (title, desc, pub, course_id),
    )
    conn.commit()
    conn.close()
    return {"course": {"id": course_id, "title": title, "description": desc, "is_published": bool(pub)}}


@router.get("/api/quizzes")
async def api_list_quizzes() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM quizzes ORDER BY created_at DESC").fetchall()
    conn.close()
    quizzes = []
    for r in rows:
        qs = json.loads(r["questions_json"] or "[]")
        quizzes.append({
            "id": r["id"],
            "course_id": r["course_id"],
            "title": r["title"],
            "difficulty": r["difficulty"],
            "time_limit_minutes": r["time_limit_minutes"],
            "question_count": len(qs),
            "questions": qs,
        })
    return {"quizzes": quizzes}


@router.post("/api/quizzes/ai-generate")
async def api_generate_quiz(payload: QuizGenRequest) -> Dict[str, Any]:
    questions = generate_quiz(payload.topic, payload.question_count, payload.difficulty)
    qid = new_id()
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO quizzes (id, course_id, title, difficulty, time_limit_minutes, questions_json, created_at)
        VALUES (?, 'course-1', ?, ?, ?, ?, ?)
        """,
        (qid, f"AI Quiz: {payload.topic}", payload.difficulty, max(10, len(questions) * 2), json.dumps(questions), now_iso()),
    )
    conn.commit()
    conn.close()
    return {"quiz_id": qid, "question_count": len(questions), "questions": questions}


@router.post("/api/quizzes/{quiz_id}/attempt")
async def api_attempt_quiz(quiz_id: str, payload: QuizAttemptRequest) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = json.loads(row["questions_json"] or "[]")
    score = 0.0
    max_score = 0.0
    weak = []
    for q in questions:
        pts = float(q.get("points", 10.0))
        max_score += pts
        ans = (payload.answers.get(q["id"]) or "").strip()
        if ans.lower() == q["correct_answer"].strip().lower():
            score += pts
        else:
            weak.append(q.get("topic_tag", "Core Topic"))
    pct = round((score / max(1.0, max_score)) * 100.0, 1)
    grade = "A" if pct >= 90 else ("B" if pct >= 80 else ("C" if pct >= 70 else ("D" if pct >= 60 else "F")))
    return {
        "quiz_id": quiz_id,
        "score": score,
        "max_score": max_score,
        "percentage": pct,
        "letter_grade": grade,
        "weak_topics_flagged": sorted(set(weak)),
    }


@router.get("/api/assignments")
async def api_list_assignments() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM assignments ORDER BY created_at DESC").fetchall()
    conn.close()
    return {
        "assignments": [
            {
                "id": r["id"],
                "course_id": r["course_id"],
                "title": r["title"],
                "description": r["description"],
                "max_score": r["max_score"],
                "rubric_json": json.loads(r["rubric_json"] or "[]"),
            }
            for r in rows
        ]
    }


@router.get("/api/submissions")
async def api_list_submissions() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM submissions ORDER BY submitted_at DESC").fetchall()
    conn.close()
    return {
        "submissions": [
            {
                "id": r["id"],
                "assignment_id": r["assignment_id"],
                "assignment_title": r["assignment_title"],
                "content": r["content"],
                "score": r["score"],
                "ai_evaluation": json.loads(r["ai_evaluation_json"] or "{}"),
                "status": r["status"],
            }
            for r in rows
        ]
    }


@router.post("/api/submissions")
async def api_create_submission(payload: SubmissionRequest) -> Dict[str, Any]:
    conn = get_conn()
    assign = conn.execute("SELECT * FROM assignments WHERE id = ?", (payload.assignment_id,)).fetchone()
    max_s = float(assign["max_score"]) if assign else 100.0
    title = assign["title"] if assign else "Assignment"
    ev = evaluate_submission(payload.content, max_s)
    sid = new_id()
    conn.execute(
        """
        INSERT INTO submissions (id, assignment_id, assignment_title, student_id, content, score, ai_evaluation_json, status, submitted_at)
        VALUES (?, ?, ?, 'u-default', ?, ?, ?, 'evaluated', ?)
        """,
        (sid, payload.assignment_id, title, payload.content, ev["suggested_score"], json.dumps(ev), now_iso()),
    )
    conn.commit()
    conn.close()
    return {
        "submission": {
            "id": sid,
            "assignment_id": payload.assignment_id,
            "score": ev["suggested_score"],
            "max_score": max_s,
            "ai_evaluation": ev,
        }
    }


@router.get("/api/flashcards")
async def api_list_flashcards() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM flashcards ORDER BY created_at DESC").fetchall()
    conn.close()
    return {
        "flashcards": [
            {
                "id": r["id"],
                "topic": r["topic"],
                "front_question": r["front_question"],
                "back_answer": r["back_answer"],
                "difficulty": r["difficulty"],
                "mastery_level": r["mastery_level"],
            }
            for r in rows
        ]
    }


@router.post("/api/flashcards/ai-generate")
async def api_generate_flashcards(payload: FlashcardGenRequest) -> Dict[str, Any]:
    cards = generate_flashcards(payload.topic, payload.count, payload.difficulty)
    conn = get_conn()
    saved = []
    for c in cards:
        cid = new_id()
        conn.execute(
            """
            INSERT INTO flashcards (id, user_id, topic, front_question, back_answer, difficulty, mastery_level, created_at)
            VALUES (?, 'u-default', ?, ?, ?, ?, 1, ?)
            """,
            (cid, c["topic"], c["front_question"], c["back_answer"], c["difficulty"], now_iso()),
        )
        saved.append({"id": cid, **c})
    conn.commit()
    conn.close()
    return {"flashcards": saved}


@router.post("/api/analytics/tutor")
async def api_tutor(payload: TutorRequest) -> Dict[str, Any]:
    return explain_lesson(payload.concept, payload.difficulty)


@router.post("/api/analytics/study-plan")
async def api_study_plan(payload: StudyPlanRequest) -> Dict[str, Any]:
    return {"study_plan": generate_study_plan(payload.goal, payload.daily_minutes, payload.days)}


@router.get("/api/edtech/metrics")
async def api_edtech_metrics() -> Dict[str, Any]:
    conn = get_conn()
    c_count = conn.execute("SELECT COUNT(*) FROM courses WHERE is_enrolled = 1").fetchone()[0]
    f_count = conn.execute("SELECT COUNT(*) FROM flashcards").fetchone()[0]
    conn.close()
    return {
        "enrolled_courses_count": c_count,
        "average_grade_percent": 91.5,
        "learning_streak_days": 7,
        "flashcards_count": f_count,
    }
