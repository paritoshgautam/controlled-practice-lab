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

const scoreOpen = (answer, keywords) => {
  const normalized = answer.toLowerCase();
  const hits = keywords.filter((word) => normalized.includes(String(word).toLowerCase()));
  return Math.min(1, hits.length / Math.max(4, keywords.length));
};

const scoreQuestion = (question, answer) => {
  if (question.type === "choice") {
    return Number(answer) === question.answer ? 1 : 0;
  }
  if (question.type === "mc_work") {
    const choiceScore = Number(answer?.choice) === question.answer ? 0.7 : 0;
    const workScore = scoreOpen(answer?.work || "", question.keywords) * 0.3;
    return choiceScore + workScore;
  }
  if (question.type === "numeric") {
    const value = Number(answer);
    if (!Number.isFinite(value)) return 0;
    return Math.abs(value - question.answer) <= question.tolerance ? 1 : 0;
  }
  return scoreOpen(answer || "", question.keywords);
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
});

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
      const earned = scoreQuestion(question, answers[question.id]);
      return { index, question, earned };
    });
    const total = rows.reduce((sum, row) => sum + row.earned, 0);
    return { rows, total, percent: total / selectedTest.questions.length };
  }, [answers, selectedTest]);

  const answered = selectedTest.questions.filter((question) => {
    const answer = answers[question.id];
    if (question.type === "mc_work") {
      return answer?.choice !== undefined && String(answer?.work || "").trim() !== "";
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
  }, [answered, attemptSaved, authUser, results.percent, results.total, selectedTest, startedAt, submitted, warnings.length]);

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
        onLogout={logout}
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
                  score={submitted ? results.rows[index].earned : null}
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

function AdminConsole({ data, dataError, dataMode, onCreateUser, onLogout, onTakeTest }) {
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [message, setMessage] = useState("");
  const students = data.users.filter((user) => user.role === "student");
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
                    </div>
                    <b>{attempts.length} attempts</b>
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
              <div className="attempt-row" key={attempt.id}>
                <span>{attempt.userName}</span>
                <span>{attempt.subject} - {attempt.testTitle}</span>
                <span>{attempt.score}/{attempt.total} ({attempt.percent}%)</span>
                <span>{formatDuration(attempt.elapsedSeconds)}</span>
                <span>{attempt.warnings}</span>
                <span>{new Date(attempt.submittedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Question({ index, question, value, locked, score, onChange }) {
  const correct = score >= 0.99;
  const typeLabel = question.type === "open"
    ? "Open ended"
    : question.type === "numeric"
      ? "Calculation"
      : question.type === "mc_work"
        ? "MC + work"
        : "Multiple choice";
  const workValue = typeof value === "object" && value !== null ? value.work || "" : "";
  const choiceValue = typeof value === "object" && value !== null ? value.choice : value;
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
                onChange={() => onChange(question.type === "mc_work" ? { choice: String(optionIndex), work: workValue } : String(optionIndex))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === "mc_work" && (
        <textarea
          value={workValue}
          disabled={locked}
          onChange={(event) => onChange({ choice: choiceValue, work: event.target.value })}
          placeholder="Show your reasoning. Include the formula, rule, or restriction you used."
        />
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

      {question.type === "open" && (
        <textarea
          value={value}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write a complete explanation."
        />
      )}

      {locked && (
        <div className="feedback">
          <strong>{score.toFixed(1)} / 1 point</strong>
          {question.type === "open" || question.type === "mc_work" ? (
            <>
              <p>{question.rubric || "Reasoning credit is based on the selected answer plus relevant work."}</p>
              <p><b>Model response:</b> {question.sample}</p>
              {question.explanation && <p>{question.explanation}</p>}
            </>
          ) : (
            <p>{question.explanation}</p>
          )}
        </div>
      )}
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
