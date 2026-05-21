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
  RotateCcw,
  Shield,
  XCircle,
} from "lucide-react";
import { tests } from "./mockTests";
import "./styles.css";

const scoreOpen = (answer, keywords) => {
  const normalized = answer.toLowerCase();
  const hits = keywords.filter((word) => normalized.includes(String(word).toLowerCase()));
  return Math.min(1, hits.length / Math.max(4, keywords.length));
};

const scoreQuestion = (question, answer) => {
  if (question.type === "choice") {
    return Number(answer) === question.answer ? 1 : 0;
  }
  if (question.type === "numeric") {
    const value = Number(answer);
    if (!Number.isFinite(value)) return 0;
    return Math.abs(value - question.answer) <= question.tolerance ? 1 : 0;
  }
  return scoreOpen(answer || "", question.keywords);
};

const pct = (value) => `${Math.round(value * 100)}%`;

function App() {
  const [selectedId, setSelectedId] = useState(1);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const selectedTest = tests.find((test) => test.id === selectedId);

  const results = useMemo(() => {
    const rows = selectedTest.questions.map((question, index) => {
      const earned = scoreQuestion(question, answers[question.id]);
      return { index, question, earned };
    });
    const total = rows.reduce((sum, row) => sum + row.earned, 0);
    return { rows, total, percent: total / selectedTest.questions.length };
  }, [answers, selectedTest]);

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

  const start = async () => {
    setAnswers({});
    setWarnings([]);
    setSubmitted(false);
    setStarted(true);
    setStartedAt(Date.now());
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
    setAnswers({});
    setWarnings([]);
    setStartedAt(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const elapsedMinutes = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0;
  const answered = selectedTest.questions.filter((question) => {
    const answer = answers[question.id];
    return answer !== undefined && String(answer).trim() !== "";
  }).length;

  return (
    <main>
      <aside className="sidebar">
        <div className="brand">
          <Shield aria-hidden="true" />
          <div>
            <h1>Physics Mock Test Lab</h1>
            <p>Ch. 22-23, circuits, Coulomb force</p>
          </div>
        </div>

        <div className="test-list">
          {tests.map((test) => (
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
            <span><Calculator size={16} /> {answered}/20 answered</span>
            <span className={warnings.length ? "warning-pill" : ""}><AlertTriangle size={16} /> {warnings.length} warnings</span>
          </div>
        </header>

        {!started ? (
          <section className="start-panel">
            <div>
              <Lock size={34} />
              <h3>Answers stay hidden until submit.</h3>
              <p>
                Each mock test has 20 questions: multiple choice, calculation, and open-ended reasoning.
                Open-ended answers are scored by rubric keywords and then shown with a model response.
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
                  <button className="primary" type="submit" disabled={answered < 20}>Submit Test</button>
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
                  <p>{results.total.toFixed(1)} of 20 points. Review the explanations below and redo any calculation on paper.</p>
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

function Question({ index, question, value, locked, score, onChange }) {
  const correct = score === 1;
  return (
    <article className={locked ? "question reviewed" : "question"}>
      <div className="question-head">
        <span>Q{index + 1}</span>
        <strong>{question.type === "open" ? "Open ended" : question.type === "numeric" ? "Calculation" : "Multiple choice"}</strong>
        {locked && (correct ? <CheckCircle2 className="ok" /> : <XCircle className="bad" />)}
      </div>
      <p>{question.prompt}</p>

      {question.type === "choice" && (
        <div className="options">
          {question.options.map((option, optionIndex) => (
            <label key={option}>
              <input
                type="radio"
                name={question.id}
                value={optionIndex}
                checked={String(value) === String(optionIndex)}
                disabled={locked}
                onChange={() => onChange(String(optionIndex))}
              />
              <span>{option}</span>
            </label>
          ))}
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

      {question.type === "open" && (
        <textarea
          value={value}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write a complete physics explanation."
        />
      )}

      {locked && (
        <div className="feedback">
          <strong>{score.toFixed(1)} / 1 point</strong>
          {question.type === "open" ? (
            <>
              <p>{question.rubric}</p>
              <p><b>Model response:</b> {question.sample}</p>
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
