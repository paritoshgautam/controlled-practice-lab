import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock,
  EyeOff,
  FileText,
  Lock,
  Maximize,
  Plus,
  RotateCcw,
  Shield,
  UserPlus,
  XCircle,
} from "lucide-react";
import { tests as physicsTests } from "./mockTests";
import { mathTests } from "./mathTests";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import "./styles.css";

const subjects = [
  {
    id: "physics",
    label: "Physics",
    subtitle: "Ch. 22-23, circuits, Coulomb force",
    tests: physicsTests.map((test) => ({
      ...test,
      subject: "Physics",
      questionCount: test.questions.length,
      timeLimitMinutes: 60,
      description: "Physics review practice covering definitions, Coulomb force, Ohm's law, circuit behavior, energy, power, graphs, and electrical safety.",
    })),
  },
  {
    id: "math",
    label: "Math",
    subtitle: "Math 3 Units 1-8",
    tests: mathTests,
  },
];

const STORAGE_KEY = "controlled-practice-lab-data-v1";
const defaultData = {
  users: [
    {
      id: "admin-default",
      name: "Parent Admin",
      username: "admin",
      password: "local-admin-only",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ],
  attempts: [],
};

const loadData = () => {
  const fallback = {
    ...defaultData,
    users: [...defaultData.users],
    attempts: [],
  };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (parsed?.users?.length) {
      return {
        users: parsed.users,
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  } catch {
    return fallback;
  }
};

const saveData = (data) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
};

const scoreWork = (answer, keywords) => {
  const normalized = String(answer || "").toLowerCase();
  const rubricWords = Array.isArray(keywords) ? keywords : [];
  const matched = rubricWords.filter((word) => normalized.includes(String(word).toLowerCase()));
  const missing = rubricWords.filter((word) => !normalized.includes(String(word).toLowerCase()));
  return {
    score: Math.min(1, matched.length / Math.max(4, rubricWords.length)),
    matched,
    missing,
  };
};

const answerOrBlank = (value) => value || "Not answered";

const formatNumericAnswer = (value, unit) => {
  if (value === undefined || value === null || value === "") return "Not answered";
  return `${value}${unit ? ` ${unit}` : ""}`;
};

const formatChoiceAnswer = (question, value) => {
  const index = Number(value);
  if (!Number.isInteger(index) || !question.options?.[index]) return "Not answered";
  return question.options[index];
};

const getCorrectAnswerLabel = (question) => {
  if (question.type === "choice") return formatChoiceAnswer(question, question.answer);
  if (question.type === "mc_work") return `${formatChoiceAnswer(question, question.answer)}. Expected work: ${question.sample}`;
  if (question.type === "numeric") return formatNumericAnswer(question.answer, question.unit);
  if (question.type === "work_upload") return question.sample || question.rubric || "Use the model response and rubric.";
  return question.sample || question.explanation || "See explanation.";
};

const getStudentAnswerLabel = (question, answer) => {
  if (question.type === "choice") return formatChoiceAnswer(question, answer);
  if (question.type === "numeric") return formatNumericAnswer(answer, question.unit);
  if (question.type === "mc_work") {
    const selected = formatChoiceAnswer(question, answer?.choice);
    const work = answer?.work ? ` Work shown: ${answer.work}` : " No work shown.";
    const file = answer?.fileName ? ` Rough work: ${answer.fileName}.` : "";
    return `${selected}.${work}${file}`;
  }
  if (question.type === "work_upload") {
    const work = answer?.work ? answer.work : "No typed work.";
    const file = answer?.fileName ? ` Rough work: ${answer.fileName}.` : "";
    return `${work}${file}`;
  }
  return answerOrBlank(answer);
};

const reviewQuestion = (question, answer) => {
  const base = {
    studentAnswerLabel: getStudentAnswerLabel(question, answer),
    correctAnswerLabel: getCorrectAnswerLabel(question),
    explanation: question.explanation || "",
    rubric: question.rubric || "",
    sample: question.sample || "",
    roughWorkFile: answer?.fileName || null,
  };

  if (question.type === "choice") {
    const earned = Number(answer) === question.answer ? 1 : 0;
    return {
      ...base,
      earned,
      correct: earned >= 0.99,
      scoreReason: earned ? "Selected the correct option." : "The selected option did not match the correct answer.",
    };
  }
  if (question.type === "mc_work") {
    const choiceScore = Number(answer?.choice) === question.answer ? 0.7 : 0;
    const work = scoreWork(answer?.work || "", question.keywords);
    const workScore = work.score * 0.3;
    const earned = choiceScore + workScore;
    return {
      ...base,
      earned,
      correct: earned >= 0.99,
      scoreReason: `Answer choice earned ${choiceScore.toFixed(1)} of 0.7. Work earned ${workScore.toFixed(1)} of 0.3. Matched steps: ${work.matched.length ? work.matched.join(", ") : "none"}. Missing: ${work.missing.length ? work.missing.join(", ") : "no major rubric terms missing"}.`,
    };
  }
  if (question.type === "work_upload") {
    const work = scoreWork(answer?.work || "", question.keywords);
    const earned = work.score > 0 ? work.score : answer?.fileName ? 0.25 : 0;
    return {
      ...base,
      earned,
      correct: earned >= 0.99,
      scoreReason: work.score > 0
        ? `Step analysis matched: ${work.matched.length ? work.matched.join(", ") : "none"}. Missing: ${work.missing.length ? work.missing.join(", ") : "no major rubric terms missing"}.`
        : answer?.fileName
          ? "Rough work was attached, but no typed steps were available for automatic step analysis."
          : "No typed steps or rough-work attachment were submitted.",
    };
  }
  if (question.type === "numeric") {
    const value = Number(answer);
    const earned = Number.isFinite(value) && Math.abs(value - question.answer) <= question.tolerance ? 1 : 0;
    return {
      ...base,
      earned,
      correct: earned >= 0.99,
      scoreReason: earned
        ? `The value is within the allowed tolerance of ${question.tolerance}${question.unit ? ` ${question.unit}` : ""}.`
        : `The submitted value is outside the allowed tolerance of ${question.tolerance}${question.unit ? ` ${question.unit}` : ""}.`,
    };
  }
  const work = scoreWork(answer || "", question.keywords);
  return {
    ...base,
    earned: work.score,
    correct: work.score >= 0.99,
    scoreReason: `Matched: ${work.matched.length ? work.matched.join(", ") : "none"}. Missing: ${work.missing.length ? work.missing.join(", ") : "no major rubric terms missing"}.`,
  };
};

const pct = (value) => `${Math.round(value * 100)}%`;

const mapSupabaseUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  createdAt: user.created_at,
});

const mapSupabaseAttempt = (attempt) => ({
  id: attempt.id,
  userId: attempt.user_id,
  userName: attempt.user_name,
  username: attempt.username,
  subject: attempt.subject,
  testId: attempt.test_id,
  testTitle: attempt.test_title,
  score: Number(attempt.score),
  total: attempt.total,
  percent: attempt.percent,
  answered: attempt.answered,
  warnings: attempt.warnings,
  elapsedSeconds: attempt.elapsed_seconds,
  submittedAt: attempt.submitted_at,
  details: attempt.details || [],
});

const getConcept = (question) => question.topic || question.rubric || question.type;

const findAttemptQuestion = (attempt, detail) => {
  const subject = subjects.find((item) => item.label === attempt.subject || item.id === String(attempt.subject || "").toLowerCase());
  const test = subject?.tests.find((item) => item.id === attempt.testId || item.title === attempt.testTitle);
  return test?.questions.find((question) => question.id === detail.questionId)
    || test?.questions[(detail.questionNumber || 1) - 1]
    || null;
};

const normalizeAttemptDetail = (attempt, detail) => {
  if (detail.studentAnswerLabel || detail.correctAnswerLabel || detail.scoreReason) return detail;
  const question = findAttemptQuestion(attempt, detail);
  return {
    ...detail,
    studentAnswerLabel: "Not saved for older attempt",
    correctAnswerLabel: question ? getCorrectAnswerLabel(question) : "Not available for older attempt",
    explanation: detail.explanation || question?.explanation || "This older attempt was saved before detailed review data was added.",
    rubric: detail.rubric || question?.rubric || "",
    sample: detail.sample || question?.sample || "",
    scoreReason: detail.correct ? "Marked correct." : "Legacy attempt: the student's selected answer was not saved, so only score and question data are available.",
  };
};

const getAttemptDetails = (attempt) => {
  const details = attempt.details || [];
  if (details.length > 0) return details.map((detail) => normalizeAttemptDetail(attempt, detail));

  const subject = subjects.find((item) => item.label === attempt.subject || item.id === String(attempt.subject || "").toLowerCase());
  const test = subject?.tests.find((item) => item.id === attempt.testId || item.title === attempt.testTitle);
  if (!test) return [];

  return test.questions.map((question, index) => normalizeAttemptDetail(attempt, {
    questionNumber: index + 1,
    questionId: question.id,
    concept: getConcept(question),
    type: question.type,
    prompt: question.prompt,
    earned: 0,
    correct: false,
  }));
};

const getStudentInsights = (student, attempts) => {
  const studentAttempts = attempts.filter((attempt) => attempt.userId === student.id);
  const conceptMap = new Map();
  for (const attempt of studentAttempts) {
    for (const detail of getAttemptDetails(attempt)) {
      const concept = detail.concept || "Mixed concept";
      const current = conceptMap.get(concept) || { concept, missed: 0, total: 0 };
      current.total += 1;
      if (!detail.correct) current.missed += 1;
      conceptMap.set(concept, current);
    }
  }
  return {
    attempts: studentAttempts,
    concepts: [...conceptMap.values()]
      .filter((item) => item.missed > 0)
      .sort((a, b) => b.missed - a.missed || b.total - a.total),
  };
};

function App() {
  const [appData, setAppData] = useState(loadData);
  const [authUser, setAuthUser] = useState(() => {
    try {
      const id = window.sessionStorage.getItem("controlled-practice-user-id");
      return loadData().users.find((user) => user.id === id) || null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState("tests");
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("physics");
  const [selectedId, setSelectedId] = useState(1);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [answers, setAnswers] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const selectedTest = selectedSubject.tests.find((test) => test.id === selectedId) || selectedSubject.tests[0];

  const results = useMemo(() => {
    const rows = selectedTest.questions.map((question, index) => {
      const review = reviewQuestion(question, answers[question.id]);
      return { index, question, earned: review.earned, review };
    });
    const total = rows.reduce((sum, row) => sum + row.earned, 0);
    return { rows, total, percent: total / selectedTest.questions.length };
  }, [answers, selectedTest]);

  const answered = selectedTest.questions.filter((question) => {
    const answer = answers[question.id];
    if (question.type === "mc_work") {
      return answer?.choice !== undefined && String(answer?.work || "").trim() !== "";
    }
    if (question.type === "work_upload") {
      return String(answer?.work || "").trim() !== "" || Boolean(answer?.fileName);
    }
    return answer !== undefined && String(answer).trim() !== "";
  }).length;

  useEffect(() => {
    if (!started || submitted) return;

    const warn = (kind, detail) => {
      setWarnings((items) => [
        {
          id: crypto.randomUUID(),
          kind,
          detail,
          at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
        ...items,
      ]);
    };

    const onVisibility = () => {
      if (document.hidden) warn("Screen switch", "The test tab was hidden. Stay on the test screen.");
    };
    const onBlur = () => warn("Focus lost", "The browser window lost focus during the test.");
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      if (key === "printscreen" || (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key))) {
        warn("Screenshot attempt", "Screenshots are not allowed in this controlled test.");
      }
      if ((event.ctrlKey || event.metaKey) && ["p", "s", "u"].includes(key)) {
        event.preventDefault();
        warn("Restricted shortcut", "Printing, saving, and source-view shortcuts are disabled during the test.");
      }
    };
    const onContext = (event) => event.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContext);
    };
  }, [started, submitted]);

  useEffect(() => {
    if (!started || submitted) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [started, submitted]);

  useEffect(() => {
    if (!started || submitted || !startedAt) return;
    const elapsed = Math.floor((now - startedAt) / 1000);
    if (elapsed >= (selectedTest.timeLimitMinutes || 60) * 60) {
      setSubmitted(true);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }, [now, selectedTest.timeLimitMinutes, started, startedAt, submitted]);

  useEffect(() => {
    if (!submitted || attemptSaved || !authUser || !startedAt) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const attempt = {
      id: crypto.randomUUID(),
      userId: authUser.id,
      userName: authUser.name,
      username: authUser.username,
      subject: selectedTest.subject,
      testId: selectedTest.id,
      testTitle: selectedTest.title,
      score: Number(results.total.toFixed(2)),
      total: selectedTest.questions.length,
      percent: Math.round(results.percent * 100),
      answered,
      warnings: warnings.length,
      elapsedSeconds: elapsed,
      submittedAt: new Date().toISOString(),
      details: results.rows.map((row) => ({
        questionNumber: row.index + 1,
        questionId: row.question.id,
        concept: getConcept(row.question),
        type: row.question.type,
        prompt: row.question.prompt,
        earned: Number(row.earned.toFixed(2)),
        correct: row.review.correct,
        studentAnswerLabel: row.review.studentAnswerLabel,
        correctAnswerLabel: row.review.correctAnswerLabel,
        explanation: row.review.explanation,
        rubric: row.review.rubric,
        sample: row.review.sample,
        scoreReason: row.review.scoreReason,
        roughWorkFile: row.review.roughWorkFile,
      })),
    };
    if (isSupabaseConfigured) {
      supabase.rpc("record_attempt", {
        p_user_id: attempt.userId,
        p_user_name: attempt.userName,
        p_username: attempt.username,
        p_subject: attempt.subject,
        p_test_id: attempt.testId,
        p_test_title: attempt.testTitle,
        p_score: attempt.score,
        p_total: attempt.total,
        p_percent: attempt.percent,
        p_answered: attempt.answered,
        p_warnings: attempt.warnings,
        p_elapsed_seconds: attempt.elapsedSeconds,
        p_details: attempt.details,
      }).then(({ error }) => {
        if (error) setDataError(error.message);
      });
    } else {
      setAppData((current) => {
        const next = { ...current, attempts: [attempt, ...current.attempts] };
        saveData(next);
        return next;
      });
    }
    setAttemptSaved(true);
  }, [answered, attemptSaved, authUser, results, selectedTest, startedAt, submitted, warnings.length]);

  const start = async () => {
    setAnswers({});
    setWarnings([]);
    setSubmitted(false);
    setAttemptSaved(false);
    setStarted(true);
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setWarnings([
        {
          id: crypto.randomUUID(),
          kind: "Fullscreen unavailable",
          detail: "Your browser did not allow fullscreen. Continue without leaving this tab.",
          at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
    }
  };

  const reset = () => {
    setStarted(false);
    setSubmitted(false);
    setAttemptSaved(false);
    setAnswers({});
    setWarnings([]);
    setStartedAt(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const elapsedMinutes = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remainingSeconds = Math.max(0, (selectedTest.timeLimitMinutes || 60) * 60 - elapsedSeconds);
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  const refreshAdminData = async (adminId) => {
    if (!isSupabaseConfigured) return;
    const [{ data: users, error: usersError }, { data: attempts, error: attemptsError }] = await Promise.all([
      supabase.rpc("list_app_users", { p_admin_id: adminId }),
      supabase.rpc("list_attempts", { p_admin_id: adminId }),
    ]);
    if (usersError || attemptsError) {
      setDataError(usersError?.message || attemptsError?.message || "Could not load admin data.");
      return;
    }
    setDataError("");
    setAppData({
      users: users.map(mapSupabaseUser),
      attempts: attempts.map(mapSupabaseAttempt),
    });
  };

  const login = async (username, password) => {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedPassword = password.trim();
    setAuthError("");
    let user = null;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc("login_user", {
        p_username: normalizedUsername,
        p_password: normalizedPassword,
      });
      if (error) {
        setAuthError(error.message);
        return false;
      }
      user = data?.[0] ? mapSupabaseUser(data[0]) : null;
    } else {
      user = appData.users.find(
        (item) => item.username.toLowerCase() === normalizedUsername && item.password === normalizedPassword
      );
    }
    if (!user) return false;
    setAuthUser(user);
    setView(user.role === "admin" ? "admin" : "tests");
    if (user.role === "admin") refreshAdminData(user.id);
    try {
      window.sessionStorage.setItem("controlled-practice-user-id", user.id);
    } catch {
      // Session restore is optional.
    }
    return true;
  };

  const logout = () => {
    reset();
    setAuthUser(null);
    setView("tests");
    try {
      window.sessionStorage.removeItem("controlled-practice-user-id");
    } catch {
      // Session restore is optional.
    }
  };

  const createUser = async (user) => {
    const nextName = user.name.trim();
    const nextUsername = user.username.trim().toLowerCase();
    const nextPassword = user.password.trim();
    if (!nextName || !nextUsername || !nextPassword) {
      return { ok: false, message: "Name, username, and password are required." };
    }
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc("create_student_user", {
        p_admin_id: authUser.id,
        p_name: nextName,
        p_username: nextUsername,
        p_password: nextPassword,
      });
      if (error) return { ok: false, message: error.message };
      await refreshAdminData(authUser.id);
    } else {
      const exists = appData.users.some((item) => item.username.toLowerCase() === nextUsername);
      if (exists) return { ok: false, message: "That username already exists." };
      const nextUser = {
        id: crypto.randomUUID(),
        name: nextName,
        username: nextUsername,
        password: nextPassword,
        role: "student",
        createdAt: new Date().toISOString(),
      };
      setAppData((current) => {
        const next = { ...current, users: [...current.users, nextUser] };
        saveData(next);
        return next;
      });
    }
    return { ok: true, message: "Student user created." };
  };

  const resetStudentPassword = async (studentId, password) => {
    const nextPassword = password.trim();
    if (!nextPassword) return { ok: false, message: "Enter a new password." };
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc("reset_student_password", {
        p_admin_id: authUser.id,
        p_student_id: studentId,
        p_password: nextPassword,
      });
      if (error) return { ok: false, message: error.message };
      await refreshAdminData(authUser.id);
    } else {
      setAppData((current) => {
        const next = {
          ...current,
          users: current.users.map((user) => (
            user.id === studentId && user.role === "student"
              ? { ...user, password: nextPassword }
              : user
          )),
        };
        saveData(next);
        return next;
      });
    }
    return { ok: true, message: "Password updated." };
  };

  const deleteStudent = async (studentId) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc("delete_student_user", {
        p_admin_id: authUser.id,
        p_student_id: studentId,
      });
      if (error) return { ok: false, message: error.message };
      await refreshAdminData(authUser.id);
    } else {
      setAppData((current) => {
        const next = {
          users: current.users.filter((user) => user.id !== studentId || user.role !== "student"),
          attempts: current.attempts.filter((attempt) => attempt.userId !== studentId),
        };
        saveData(next);
        return next;
      });
    }
    return { ok: true, message: "Student deleted." };
  };

  if (!authUser) {
    return <LoginPage authError={authError} dataMode={isSupabaseConfigured ? "Supabase" : "Local browser"} onLogin={login} />;
  }

  if (view === "admin" && authUser.role === "admin") {
    return (
      <AdminConsole
        data={appData}
        dataError={dataError}
        dataMode={isSupabaseConfigured ? "Supabase" : "Local browser"}
        onCreateUser={createUser}
        onDeleteStudent={deleteStudent}
        onLogout={logout}
        onResetStudentPassword={resetStudentPassword}
        onTakeTest={() => setView("tests")}
      />
    );
  }

  return (
    <main>
      <aside className="sidebar">
        <div className="brand">
          <Shield aria-hidden="true" />
          <div>
            <h1>Controlled Practice Lab</h1>
            <p>{selectedSubject.subtitle}</p>
          </div>
        </div>

        <div className="account-box">
          <strong>{authUser.name}</strong>
          <span>{authUser.role === "admin" ? "Admin" : "Student"}</span>
          {authUser.role === "admin" && (
            <button className="mini-button" onClick={() => setView("admin")} disabled={started}>Admin Console</button>
          )}
          <button className="mini-button" onClick={logout}>Sign out</button>
        </div>

        <div className="subject-tabs" aria-label="Subject">
          {subjects.map((subject) => (
            <button
              className={subject.id === selectedSubjectId ? "subject-tab active" : "subject-tab"}
              key={subject.id}
              onClick={() => {
                if (started) return;
                setSelectedSubjectId(subject.id);
                setSelectedId(1);
              }}
              disabled={started}
            >
              {subject.label}
            </button>
          ))}
        </div>

        <div className="test-list">
          {selectedSubject.tests.map((test) => (
            <button
              className={test.id === selectedId ? "test-button active" : "test-button"}
              key={test.id}
              onClick={() => {
                if (!started) setSelectedId(test.id);
              }}
              disabled={started}
            >
              <FileText size={18} />
              <span>{test.title}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{selectedTest.title}</p>
            <h2>{started ? "Controlled Test Session" : "Ready Room"}</h2>
          </div>
          <div className="status-strip">
            <span><Clock size={16} /> {started ? `${elapsedMinutes} min` : "Not started"}</span>
            <span><Clock size={16} /> {started ? `${remainingLabel} left` : `${selectedTest.timeLimitMinutes} min limit`}</span>
            <span><Calculator size={16} /> {answered}/{selectedTest.questions.length} answered</span>
            <span className={warnings.length ? "warning-pill" : ""}><AlertTriangle size={16} /> {warnings.length} warnings</span>
          </div>
        </header>

        {!started ? (
          <section className="start-panel">
            <div>
              <Lock size={34} />
              <h3>Answers stay hidden until submit.</h3>
              <p>
                {selectedTest.description} This test has {selectedTest.questions.length} questions and a {selectedTest.timeLimitMinutes}-minute target.
                Answers and explanations appear only after submission.
              </p>
            </div>
            <div className="rules">
              <span><Maximize size={18} /> Fullscreen starts when possible</span>
              <span><EyeOff size={18} /> Tab switches and focus loss are logged</span>
              <span><AlertTriangle size={18} /> Screenshot shortcuts trigger warnings where the browser exposes them</span>
            </div>
            <button className="primary" onClick={start}>Start {selectedTest.title}</button>
          </section>
        ) : (
          <>
            {warnings.length > 0 && (
              <section className="warning-log" aria-live="polite">
                <strong>Controlled environment warning</strong>
                <div>
                  {warnings.slice(0, 3).map((warning) => (
                    <span key={warning.id}>{warning.at}: {warning.kind}</span>
                  ))}
                </div>
              </section>
            )}

            <form className="questions" onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            }}>
              {selectedTest.questions.map((question, index) => (
                <Question
                  key={question.id}
                  index={index}
                  question={question}
                  value={answers[question.id] ?? ""}
                  locked={submitted}
                  review={submitted ? results.rows[index].review : null}
                  onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                />
              ))}

              <div className="submit-bar">
                {!submitted ? (
                  <button className="primary" type="submit" disabled={answered < selectedTest.questions.length}>Submit Test</button>
                ) : (
                  <button className="secondary" type="button" onClick={reset}><RotateCcw size={18} /> Choose Another Test</button>
                )}
              </div>
            </form>

            {submitted && (
              <section className="results">
                <div>
                  <p className="eyebrow">Assessment</p>
                  <h3>{pct(results.percent)} score</h3>
                  <p>{results.total.toFixed(1)} of {selectedTest.questions.length} points. Review the explanations below and redo any calculation on paper.</p>
                </div>
                <div className="meter">
                  <div style={{ width: pct(results.percent) }} />
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function LoginPage({ authError, dataMode, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Shield size={38} />
        <p className="eyebrow">Controlled Practice Lab</p>
        <h1>Sign in to start a test</h1>
        <form onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onLogin(username, password);
          setError(ok ? "" : "Username or password is incorrect.");
        }}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          {(error || authError) && <p className="form-error">{authError || error}</p>}
          <button className="primary" type="submit">Sign In</button>
        </form>
        <p className="hint">Data mode: <b>{dataMode}</b>.</p>
      </section>
    </main>
  );
}

function AdminConsole({ data, dataError, dataMode, onCreateUser, onDeleteStudent, onLogout, onResetStudentPassword, onTakeTest }) {
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [message, setMessage] = useState("");
  const [studentMessages, setStudentMessages] = useState({});
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [expandedAttemptId, setExpandedAttemptId] = useState("");
  const students = data.users.filter((user) => user.role === "student");
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0];
  const selectedInsights = selectedStudent ? getStudentInsights(selectedStudent, data.attempts) : null;
  const average = data.attempts.length
    ? Math.round(data.attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / data.attempts.length)
    : 0;

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <Shield aria-hidden="true" />
          <div>
            <h1>Admin Console</h1>
            <p>Users, attempts, and warning insight</p>
          </div>
        </div>
        <div className="admin-nav">
          <button className="test-button active" onClick={onTakeTest}><FileText size={18} /> Practice Tests <ChevronRight size={16} /></button>
          <button className="test-button" onClick={onLogout}><Lock size={18} /> Sign Out <ChevronRight size={16} /></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Student Activity</h2>
          </div>
          <div className="status-strip">
            <span><Shield size={16} /> {dataMode}</span>
            <span><UserPlus size={16} /> {students.length} students</span>
            <span><FileText size={16} /> {data.attempts.length} attempts</span>
            <span><Calculator size={16} /> {average}% average</span>
          </div>
        </header>

        {dataError && <section className="warning-log"><strong>Database warning</strong><div><span>{dataError}</span></div></section>}

        <section className="admin-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Student Dashboard</p>
              <h3>Performance by Test and Concept</h3>
            </div>
            {students.length > 0 && (
              <select
                className="student-select"
                value={selectedStudent?.id || ""}
                onChange={(event) => setSelectedStudentId(event.target.value)}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.name}</option>
                ))}
              </select>
            )}
          </div>
          {!selectedStudent || !selectedInsights ? (
            <p className="hint">Create a student and submit a test to see performance insights.</p>
          ) : (
            <div className="dashboard-grid">
              <div className="dashboard-panel">
                <h4>Tests Attempted</h4>
                {selectedInsights.attempts.length === 0 ? (
                  <p className="hint">No attempts yet.</p>
                ) : selectedInsights.attempts.map((attempt) => (
                  <div className="metric-row" key={attempt.id}>
                    <div>
                      <strong>{attempt.subject} - {attempt.testTitle}</strong>
                      <span>{new Date(attempt.submittedAt).toLocaleString()}</span>
                    </div>
                    <b>{attempt.percent}%</b>
                  </div>
                ))}
              </div>
              <div className="dashboard-panel">
                <h4>Concepts to Review</h4>
                {selectedInsights.concepts.length === 0 ? (
                  <p className="hint">No missed concepts recorded for this student.</p>
                ) : selectedInsights.concepts.slice(0, 8).map((concept) => (
                  <div className="metric-row" key={concept.concept}>
                    <div>
                      <strong>{concept.concept}</strong>
                      <span>{concept.missed} missed out of {concept.total} question(s)</span>
                    </div>
                    <b>{Math.round((concept.missed / concept.total) * 100)}%</b>
                  </div>
                ))}
              </div>
              <div className="dashboard-panel wide">
                <h4>Missed Questions</h4>
                {selectedInsights.attempts.flatMap((attempt) => (
                  getAttemptDetails(attempt)
                    .filter((detail) => !detail.correct)
                    .map((detail) => ({ ...detail, attempt }))
                )).length === 0 ? (
                  <p className="hint">No missed question detail yet. Older attempts may not have concept-level data.</p>
                ) : selectedInsights.attempts.flatMap((attempt) => (
                  getAttemptDetails(attempt)
                    .filter((detail) => !detail.correct)
                    .map((detail) => (
                      <div className="missed-row" key={`${attempt.id}-${detail.questionId}`}>
                        <strong>{attempt.testTitle} Q{detail.questionNumber}: {detail.concept}</strong>
                        <span>{detail.prompt}</span>
                        <span>{detail.scoreReason}</span>
                        {detail.roughWorkFile && <em>Rough work: {detail.roughWorkFile}</em>}
                      </div>
                    ))
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="admin-grid">
          <article className="admin-card">
            <h3>Create Student</h3>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const result = await onCreateUser(form);
              setMessage(result.message);
              if (result.ok) setForm({ name: "", username: "", password: "" });
            }}>
              <label>
                Student name
                <input value={form.name} required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Username
                <input value={form.username} required onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
              </label>
              <label>
                Temporary password
                <input value={form.password} required onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              </label>
              {message && <p className="hint">{message}</p>}
              <button className="primary" type="submit"><Plus size={18} /> Create User</button>
            </form>
          </article>

          <article className="admin-card">
            <h3>Students</h3>
            <div className="student-list">
              {students.length === 0 ? (
                <p className="hint">No student users yet.</p>
              ) : students.map((student) => {
                const attempts = data.attempts.filter((attempt) => attempt.userId === student.id);
                return (
                  <div key={student.id} className="student-row">
                    <div>
                      <strong>{student.name}</strong>
                      <span>@{student.username}</span>
                      {studentMessages[student.id] && <small>{studentMessages[student.id]}</small>}
                    </div>
                    <b>{attempts.length} attempts</b>
                    <form className="student-actions" onSubmit={async (event) => {
                      event.preventDefault();
                      const result = await onResetStudentPassword(student.id, passwordDrafts[student.id] || "");
                      setStudentMessages((current) => ({ ...current, [student.id]: result.message }));
                      if (result.ok) setPasswordDrafts((current) => ({ ...current, [student.id]: "" }));
                    }}>
                      <input
                        aria-label={`New password for ${student.name}`}
                        placeholder="New password"
                        type="password"
                        value={passwordDrafts[student.id] || ""}
                        onChange={(event) => setPasswordDrafts((current) => ({ ...current, [student.id]: event.target.value }))}
                      />
                      <button className="secondary" type="submit">Reset</button>
                      <button className="danger" type="button" onClick={async () => {
                        const confirmed = window.confirm(`Delete ${student.name}? This will also remove their attempts.`);
                        if (!confirmed) return;
                        const result = await onDeleteStudent(student.id);
                        setStudentMessages((current) => ({ ...current, [student.id]: result.message }));
                      }}>Delete</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="admin-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attempts</p>
              <h3>Test History</h3>
            </div>
          </div>
          <div className="attempt-table">
            <div className="attempt-row attempt-head">
              <span>Review</span>
              <span>Student</span>
              <span>Test</span>
              <span>Score</span>
              <span>Time</span>
              <span>Warnings</span>
              <span>Submitted</span>
            </div>
            {data.attempts.length === 0 ? (
              <p className="hint">No attempts recorded yet. Attempts are saved when a user submits or times out.</p>
            ) : data.attempts.map((attempt) => (
              <React.Fragment key={attempt.id}>
                <div
                  className={expandedAttemptId === attempt.id ? "attempt-row attempt-click expanded" : "attempt-row attempt-click"}
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedAttemptId((current) => current === attempt.id ? "" : attempt.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedAttemptId((current) => current === attempt.id ? "" : attempt.id);
                    }
                  }}
                >
                  <span className="review-toggle">
                    {expandedAttemptId === attempt.id ? "Hide" : "View"}
                  </span>
                  <span>{attempt.userName}</span>
                  <span>{attempt.subject} - {attempt.testTitle}</span>
                  <span>{attempt.score}/{attempt.total} ({attempt.percent}%)</span>
                  <span>{formatDuration(attempt.elapsedSeconds)}</span>
                  <span>{attempt.warnings}</span>
                  <span>{new Date(attempt.submittedAt).toLocaleString()}</span>
                </div>
                {expandedAttemptId === attempt.id && (
                  <AttemptReview attempt={attempt} />
                )}
              </React.Fragment>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function AttemptReview({ attempt }) {
  const details = getAttemptDetails(attempt);
  return (
    <div className="attempt-review">
      <div className="review-summary">
        <strong>{attempt.subject} - {attempt.testTitle}</strong>
        <span>{attempt.userName} submitted {details.length} question detail(s).</span>
      </div>
      {details.map((detail) => (
        <div className={detail.correct ? "review-item correct" : "review-item missed"} key={`${attempt.id}-${detail.questionId || detail.questionNumber}`}>
          <div className="review-item-head">
            <strong>Q{detail.questionNumber}: {detail.concept || "Mixed concept"}</strong>
            <b>{Number(detail.earned || 0).toFixed(1)} / 1</b>
          </div>
          <p>{detail.prompt}</p>
          <div className="answer-grid">
            <div>
              <span>Your answer</span>
              <p>{answerOrBlank(detail.studentAnswerLabel)}</p>
            </div>
            <div>
              <span>Correct answer</span>
              <p>{answerOrBlank(detail.correctAnswerLabel || detail.sample)}</p>
            </div>
          </div>
          <p><b>{detail.correct ? "Score reason" : "What went wrong"}:</b> {detail.scoreReason || (detail.correct ? "Marked correct." : "No detailed score reason was saved for this older attempt.")}</p>
          {detail.explanation && <p><b>Explanation:</b> {detail.explanation}</p>}
          {detail.rubric && <p><b>Rubric:</b> {detail.rubric}</p>}
          {detail.roughWorkFile && <p><b>Rough work:</b> {detail.roughWorkFile}</p>}
        </div>
      ))}
    </div>
  );
}

function Question({ index, question, value, locked, review, onChange }) {
  const correct = review?.correct;
  const typeLabel = question.type === "work_upload"
    ? "Show your work"
    : question.type === "numeric"
      ? "Calculation"
      : question.type === "mc_work"
        ? "MC + work"
        : "Multiple choice";
  const workValue = typeof value === "object" && value !== null ? value.work || "" : "";
  const fileName = typeof value === "object" && value !== null ? value.fileName || "" : "";
  const choiceValue = typeof value === "object" && value !== null ? value.choice : value;
  const updateWorkValue = (nextWork) => onChange({
    ...(typeof value === "object" && value !== null ? value : {}),
    choice: question.type === "mc_work" ? choiceValue : undefined,
    work: nextWork,
  });
  const updateFileValue = (file) => onChange({
    ...(typeof value === "object" && value !== null ? value : {}),
    choice: question.type === "mc_work" ? choiceValue : undefined,
    work: workValue,
    fileName: file?.name || "",
    fileType: file?.type || "",
    fileSize: file?.size || 0,
  });
  return (
    <article className={locked ? "question reviewed" : "question"}>
      <div className="question-head">
        <span>Q{index + 1}</span>
        <strong>{typeLabel}</strong>
        {question.topic && <em>{question.topic}</em>}
        {question.difficulty && <em>{question.difficulty}</em>}
        {question.estimatedMinutes && <em>{question.estimatedMinutes} min</em>}
        {locked && (correct ? <CheckCircle2 className="ok" /> : <XCircle className="bad" />)}
      </div>
      <p>{question.prompt}</p>

      {(question.type === "choice" || question.type === "mc_work") && (
        <div className="options">
          {question.options.map((option, optionIndex) => (
            <label key={option}>
              <input
                type="radio"
                name={question.id}
                value={optionIndex}
                checked={String(choiceValue) === String(optionIndex)}
                disabled={locked}
                onChange={() => onChange(question.type === "mc_work" ? { choice: String(optionIndex), work: workValue, fileName } : String(optionIndex))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}

      {(question.type === "mc_work" || question.type === "work_upload") && (
        <div className="work-box">
          <textarea
            value={workValue}
            disabled={locked}
            onChange={(event) => updateWorkValue(event.target.value)}
            placeholder="Show the steps you used. Include the formula, rule, substitution, restriction, or reasoning."
          />
          <label className="upload-line">
            Upload rough work
            <input
              accept="image/*,.pdf"
              disabled={locked}
              type="file"
              onChange={(event) => updateFileValue(event.target.files?.[0])}
            />
          </label>
          {fileName && <p className="hint">Attached: {fileName}</p>}
        </div>
      )}

      {question.type === "numeric" && (
        <div className="number-line">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            disabled={locked}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter number only"
          />
          <span>{question.unit}</span>
        </div>
      )}

      {locked && (
        <div className="feedback">
          <strong>{Number(review?.earned || 0).toFixed(1)} / 1 point</strong>
          <div className="answer-grid">
            <div>
              <span>Your answer</span>
              <p>{answerOrBlank(review?.studentAnswerLabel)}</p>
            </div>
            <div>
              <span>Correct answer</span>
              <p>{answerOrBlank(review?.correctAnswerLabel || question.sample)}</p>
            </div>
          </div>
          {!review?.correct && <p><b>What went wrong:</b> {review?.scoreReason}</p>}
          {review?.correct && <p><b>Result:</b> {review?.scoreReason}</p>}
          {review?.explanation && <p><b>Explanation:</b> {review.explanation}</p>}
          {review?.rubric && <p><b>Rubric:</b> {review.rubric}</p>}
          {fileName && <p><b>Rough work uploaded:</b> {fileName}</p>}
        </div>
      )}
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
