import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Award,
  Flame,
  Sparkles,
  CheckCircle,
  ClipboardList,
  Layers,
  Calendar,
  Brain,
} from "lucide-react";
import { apiRequest } from "../api";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";

interface Props {
  currentUser?: any;
}

export const EdTechView: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<"ai-learning" | "courses" | "assessments">(
    "ai-learning"
  );

  const [courses, setCourses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [learningMetrics, setLearningMetrics] = useState<any | null>(null);

  // Interactive Quiz Attempt state
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizAttemptResult, setQuizAttemptResult] = useState<any | null>(null);

  // Assignment Submission state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submissionText, setSubmissionText] = useState<string>(
    "## Multi-Agent RAG Architecture\nOur pipeline uses a Central Supervisor to coordinate Document Extraction, chunking, and grounded citation verification."
  );
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);

  // AI Learning Tools state (Explain Lesson, Study Plan, Flashcards)
  const [tutorConcept, setTutorConcept] = useState<string>("Sorting Algorithms & Time Complexity");
  const [tutorDifficulty, setTutorDifficulty] = useState<string>("intermediate");
  const [tutorOutput, setTutorOutput] = useState<string>("");

  const [studyGoal, setStudyGoal] = useState<string>("Master Multi-Agent AI & Data Structures");
  const [studyMinutes, setStudyMinutes] = useState<number>(45);
  const [studyPlan, setStudyPlan] = useState<any | null>(null);

  const [flashcardTopic, setFlashcardTopic] = useState<string>("RAG & Multi-Agent Architecture");
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // AI Course Creator & Quiz Generator state
  const [aiCourseTopic, setAiCourseTopic] = useState<string>("Multimodal AI & Document Engineering");
  const [aiCourseDifficulty, setAiCourseDifficulty] = useState<string>("intermediate");
  const [generatedBlueprint, setGeneratedBlueprint] = useState<any | null>(null);
  const [editableTitle, setEditableTitle] = useState<string>("");
  const [editableDesc, setEditableDesc] = useState<string>("");
  const [savedDraftCourseId, setSavedDraftCourseId] = useState<string | null>(null);

  const [aiQuizTopic, setAiQuizTopic] = useState<string>("Python Data Structures & Algorithms");
  const [aiQuizCount, setAiQuizCount] = useState<number>(5);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadLMSData = async () => {
    try {
      const [cRes, qRes, aRes, fRes, metricsRes, subRes] = await Promise.all([
        apiRequest("/api/courses"),
        apiRequest("/api/quizzes"),
        apiRequest("/api/assignments"),
        apiRequest("/api/flashcards"),
        apiRequest("/api/edtech/metrics"),
        apiRequest("/api/submissions"),
      ]);
      setCourses(cRes.courses || []);
      setQuizzes(qRes.quizzes || []);
      setAssignments(aRes.assignments || []);
      setFlashcards(fRes.flashcards || []);
      setLearningMetrics(metricsRes);
      setSubmissions(subRes.submissions || []);

      if (aRes.assignments?.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(aRes.assignments[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadLMSData();
  }, []);

  const handleEnroll = async (courseId: string) => {
    setLoading(true);
    try {
      await apiRequest("/api/enrollments", {
        method: "POST",
        body: JSON.stringify({ course_id: courseId }),
      });
      setStatusBanner("Enrolled in course.");
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/api/quizzes/${selectedQuiz.id}/attempt`, {
        method: "POST",
        body: JSON.stringify({ answers: quizAnswers }),
      });
      setQuizAttemptResult(res);
      setStatusBanner(
        `Quiz completed. Score: ${res.score}/${res.max_score} (${res.percentage}% — Grade ${res.letter_grade})`
      );
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignmentId) return;
    setLoading(true);
    try {
      const res = await apiRequest("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          assignment_id: selectedAssignmentId,
          content: submissionText,
        }),
      });
      setSubmissionResult(res.submission);
      setStatusBanner(
        `Assignment evaluated by AI Rubric Agent: ${res.submission.score}/${res.submission.max_score}`
      );
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const runExplainLesson = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/analytics/tutor", {
        method: "POST",
        body: JSON.stringify({ concept: tutorConcept, difficulty: tutorDifficulty }),
      });
      setTutorOutput(res.explanation_markdown);
    } finally {
      setLoading(false);
    }
  };

  const runStudyPlanner = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/analytics/study-plan", {
        method: "POST",
        body: JSON.stringify({
          goal: studyGoal,
          daily_minutes: studyMinutes,
          days: 7,
        }),
      });
      setStudyPlan(res.study_plan);
    } finally {
      setLoading(false);
    }
  };

  const runFlashcardGenerator = async () => {
    setLoading(true);
    try {
      await apiRequest("/api/flashcards/ai-generate", {
        method: "POST",
        body: JSON.stringify({ topic: flashcardTopic, count: 4, difficulty: "medium", save: true }),
      });
      setStatusBanner(`Generated 4 flashcards for "${flashcardTopic}".`);
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const runAICourseCreator = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/courses/ai-generate", {
        method: "POST",
        body: JSON.stringify({
          topic: aiCourseTopic,
          difficulty: aiCourseDifficulty,
          module_count: 2,
          save_draft: true,
        }),
      });
      setGeneratedBlueprint(res.blueprint);
      setEditableTitle(res.blueprint.title);
      setEditableDesc(res.blueprint.description);
      setSavedDraftCourseId(res.saved_course_id);
      setStatusBanner("AI Course Draft created. Edit below and click Publish.");
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const publishEditedCourse = async () => {
    if (!savedDraftCourseId) return;
    setLoading(true);
    try {
      await apiRequest(`/api/courses/${savedDraftCourseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editableTitle,
          description: editableDesc,
          is_published: true,
        }),
      });
      setStatusBanner(`Course "${editableTitle}" published.`);
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  const runAIQuizGenerator = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/quizzes/ai-generate", {
        method: "POST",
        body: JSON.stringify({
          topic: aiQuizTopic,
          question_count: aiQuizCount,
          difficulty: "intermediate",
          save_to_course: true,
        }),
      });
      setStatusBanner(`Generated quiz "${aiQuizTopic}" with ${res.question_count} questions.`);
      await loadLMSData();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D4AF37]/25 pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#FFFFFF] flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-[#D4AF37]" />
            Omniscient AI — EdTech & LMS Studio
          </h2>
          <p className="text-xs text-[#BDBDBD] mt-1">
            AI Lesson Tutor, Study Planner, Flashcards, Courses, Quizzes, and AI Rubric Evaluation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ai-learning")}
            className={activeTab === "ai-learning" ? "btn-primary" : "btn-secondary"}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            AI Tutor & Study Tools
          </button>
          <button
            onClick={() => setActiveTab("courses")}
            className={activeTab === "courses" ? "btn-primary" : "btn-secondary"}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            Courses & Curriculum
          </button>
          <button
            onClick={() => setActiveTab("assessments")}
            className={activeTab === "assessments" ? "btn-primary" : "btn-secondary"}
          >
            <ClipboardList className="w-3.5 h-3.5 text-[#D4AF37]" />
            Quizzes & Assignments
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/50 text-xs text-[#FFFFFF] flex items-center justify-between">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="text-[#777777] hover:text-[#FFFFFF]">
            ✕
          </button>
        </div>
      )}

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-card">
          <div className="text-xs text-[#BDBDBD] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#D4AF37]" /> Active Courses
          </div>
          <div className="text-2xl font-bold text-[#FFFFFF] mt-2">
            {learningMetrics?.enrolled_courses_count ?? courses.length}
          </div>
        </div>
        <div className="surface-card">
          <div className="text-xs text-[#BDBDBD] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#D4AF37]" /> Average Score
          </div>
          <div className="text-2xl font-bold text-[#D4AF37] mt-2">
            {learningMetrics?.average_grade_percent ?? 91.5}%
          </div>
        </div>
        <div className="surface-card">
          <div className="text-xs text-[#BDBDBD] flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#D4AF37]" /> Learning Streak
          </div>
          <div className="text-2xl font-bold text-[#FFFFFF] mt-2">
            {learningMetrics?.learning_streak_days ?? 7} Days
          </div>
        </div>
        <div className="surface-card">
          <div className="text-xs text-[#BDBDBD] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4AF37]" /> Flashcards
          </div>
          <div className="text-2xl font-bold text-[#FFFFFF] mt-2">
            {flashcards.length}
          </div>
        </div>
      </div>

      {/* TAB 1: AI TUTOR, STUDY PLANNER & FLASHCARDS */}
      {activeTab === "ai-learning" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Explain the Lesson (AI Tutor) */}
            <div className="surface-card space-y-4">
              <h3 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#D4AF37]" />
                Explain the Lesson (Personalized AI Tutor)
              </h3>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={tutorConcept}
                  onChange={(e) => setTutorConcept(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Enter lesson or topic to explain..."
                />
                <select
                  value={tutorDifficulty}
                  onChange={(e) => setTutorDifficulty(e.target.value)}
                  className="input-field"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button onClick={runExplainLesson} disabled={loading} className="btn-primary">
                  Explain Lesson
                </button>
              </div>
              {tutorOutput && (
                <div className="p-4 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/25">
                  <MarkdownRenderer content={tutorOutput} />
                </div>
              )}
            </div>

            {/* Study Plan Generator */}
            <div className="surface-card space-y-4">
              <h3 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                Generate Personalized Study Plan
              </h3>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Learning goal..."
                />
                <input
                  type="number"
                  value={studyMinutes}
                  onChange={(e) => setStudyMinutes(Number(e.target.value))}
                  className="input-field w-24"
                />
                <button onClick={runStudyPlanner} disabled={loading} className="btn-secondary">
                  Generate Plan
                </button>
              </div>
              {studyPlan && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {studyPlan.schedule?.map((day: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded bg-[#0A0A0A] border border-[#D4AF37]/20 text-xs"
                    >
                      <div className="font-bold text-[#D4AF37]">
                        {day.day} ({day.duration_minutes} min) — {day.focus}
                      </div>
                      <div className="text-[#BDBDBD] text-[11px] mt-1">
                        {day.activities?.join(" • ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Flashcards */}
          <div className="surface-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#FFFFFF]">
                AI Flashcard Deck (Click any card to flip Question / Answer)
              </h3>
              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={flashcardTopic}
                  onChange={(e) => setFlashcardTopic(e.target.value)}
                  className="input-field"
                  placeholder="Topic for flashcards..."
                />
                <button onClick={runFlashcardGenerator} disabled={loading} className="btn-secondary">
                  + Generate Flashcards
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {flashcards.map((card) => {
                const isFlipped = !!flippedCards[card.id];
                return (
                  <div
                    key={card.id}
                    onClick={() =>
                      setFlippedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                    }
                    className="cursor-pointer p-4 rounded-xl border border-[#D4AF37]/30 bg-[#0A0A0A] hover:border-[#D4AF37] transition-all min-h-[130px] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#D4AF37]">
                      <span>{card.topic}</span>
                      <span>{isFlipped ? "ANSWER" : "QUESTION"}</span>
                    </div>
                    <p className="text-xs text-[#FFFFFF] font-medium my-2">
                      {isFlipped ? card.back_answer : card.front_question}
                    </p>
                    <div className="text-[10px] text-[#777777]">Click to flip card</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COURSES & AI COURSE CREATOR */}
      {activeTab === "courses" && (
        <div className="space-y-6">
          <div className="surface-card space-y-4">
            <h3 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              AI Course Creator
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <input
                type="text"
                value={aiCourseTopic}
                onChange={(e) => setAiCourseTopic(e.target.value)}
                className="input-field flex-1"
                placeholder="Enter course topic..."
              />
              <select
                value={aiCourseDifficulty}
                onChange={(e) => setAiCourseDifficulty(e.target.value)}
                className="input-field"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button onClick={runAICourseCreator} disabled={loading} className="btn-primary">
                Generate Course Draft
              </button>
            </div>

            {generatedBlueprint && (
              <div className="p-4 rounded-xl border border-[#D4AF37]/50 bg-[#0A0A0A] space-y-3">
                <input
                  type="text"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  className="input-field w-full font-semibold"
                />
                <textarea
                  value={editableDesc}
                  onChange={(e) => setEditableDesc(e.target.value)}
                  rows={2}
                  className="input-field w-full"
                />
                <button onClick={publishEditedCourse} disabled={loading} className="btn-primary">
                  Publish Course
                </button>
              </div>
            )}
          </div>

          <div className="surface-card space-y-4">
            <h3 className="text-sm font-bold text-[#FFFFFF]">Courses & Study Materials</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="p-4 rounded-xl border border-[#D4AF37]/25 bg-[#0A0A0A] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#000000] border border-[#D4AF37]/30 text-[#D4AF37]">
                        {course.code} • {course.difficulty.toUpperCase()}
                      </span>
                      <h4 className="text-sm font-bold text-[#FFFFFF] mt-1.5">{course.title}</h4>
                    </div>
                    {course.is_enrolled ? (
                      <span className="px-2.5 py-1 rounded bg-[#000000] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Enrolled
                      </span>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={loading}
                        className="btn-primary"
                      >
                        Enroll Now
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#BDBDBD]">{course.description}</p>

                  {course.modules?.map((m: any) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg bg-[#000000] border border-[#D4AF37]/20 space-y-2"
                    >
                      <div className="text-xs font-semibold text-[#D4AF37]">{m.title}</div>
                      {m.lessons?.map((l: any) => (
                        <details key={l.id} className="text-xs text-[#BDBDBD]">
                          <summary className="cursor-pointer hover:text-[#FFFFFF] font-medium">
                            {l.title} ({l.duration_minutes} min)
                          </summary>
                          <div className="mt-2 p-3 rounded bg-[#0A0A0A] border border-[#D4AF37]/20 space-y-2">
                            <MarkdownRenderer content={l.content_markdown} />
                            {l.ai_notes_markdown && (
                              <div className="p-2.5 rounded bg-[#000000] border border-[#D4AF37]/30">
                                <div className="text-[10px] font-bold uppercase text-[#D4AF37] mb-1">
                                  AI Study Notes
                                </div>
                                <MarkdownRenderer content={l.ai_notes_markdown} />
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUIZZES & ASSIGNMENTS */}
      {activeTab === "assessments" && (
        <div className="space-y-6">
          {/* Generate Quiz with AI */}
          <div className="surface-card space-y-4">
            <h3 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              Generate Quiz with AI
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <input
                type="text"
                value={aiQuizTopic}
                onChange={(e) => setAiQuizTopic(e.target.value)}
                className="input-field flex-1"
                placeholder="Enter quiz topic..."
              />
              <input
                type="number"
                value={aiQuizCount}
                onChange={(e) => setAiQuizCount(Number(e.target.value))}
                min={1}
                max={20}
                className="input-field w-20"
              />
              <button onClick={runAIQuizGenerator} disabled={loading} className="btn-primary">
                Generate Quiz
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quizzes */}
            <div className="surface-card space-y-4">
              <h3 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#D4AF37]" />
                Take a Quiz ({quizzes.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {quizzes.map((qz) => (
                  <button
                    key={qz.id}
                    onClick={() => {
                      setSelectedQuiz(qz);
                      setQuizAttemptResult(null);
                    }}
                    className={selectedQuiz?.id === qz.id ? "btn-primary" : "btn-secondary"}
                  >
                    {qz.title} ({qz.question_count} Qs)
                  </button>
                ))}
              </div>

              {selectedQuiz && (
                <div className="p-4 rounded-lg border border-[#D4AF37]/25 bg-[#0A0A0A] space-y-3">
                  {selectedQuiz.questions?.map((q: any, idx: number) => (
                    <div key={q.id} className="space-y-2 border-b border-[#D4AF37]/15 pb-3">
                      <div className="text-xs font-medium text-[#FFFFFF]">
                        {idx + 1}. {q.prompt}
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {q.options_json?.map((opt: string) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2 text-xs text-[#BDBDBD] cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt}
                              checked={quizAnswers[q.id] === opt}
                              onChange={() =>
                                setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }))
                              }
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={handleSubmitQuiz} disabled={loading} className="btn-primary">
                    Submit Quiz
                  </button>

                  {quizAttemptResult && (
                    <div className="p-3 rounded bg-[#000000] border border-[#D4AF37]/40 text-xs">
                      <span className="font-bold text-[#D4AF37]">
                        Score: {quizAttemptResult.score}/{quizAttemptResult.max_score} ({quizAttemptResult.percentage}% — Grade {quizAttemptResult.letter_grade})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assignments */}
            <div className="surface-card space-y-4">
              <h3 className="text-sm font-bold text-[#FFFFFF]">
                Submit Assignment for AI Rubric Grading
              </h3>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="input-field w-full"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (Max {a.max_score} pts)
                  </option>
                ))}
              </select>
              <textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                rows={4}
                className="input-field w-full font-mono"
              />
              <button onClick={handleSubmitAssignment} disabled={loading} className="btn-primary">
                Submit & Grade with AI
              </button>

              {submissionResult && (
                <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/30 text-xs space-y-1">
                  <div className="font-bold text-[#D4AF37]">
                    Score: {submissionResult.score} / {submissionResult.max_score}
                  </div>
                  <p className="text-[#BDBDBD]">{submissionResult.ai_evaluation?.overall_feedback}</p>
                </div>
              )}

              {submissions.length > 0 && (
                <div className="pt-3 border-t border-[#D4AF37]/20 space-y-2 max-h-48 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#D4AF37]">
                    Previous Graded Submissions ({submissions.length})
                  </div>
                  {submissions.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded bg-[#0A0A0A] border border-[#D4AF37]/20 text-xs flex items-center justify-between"
                    >
                      <span className="text-[#FFFFFF] truncate">{s.assignment_title}</span>
                      <span className="text-[#D4AF37] font-mono font-bold">Score: {s.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
