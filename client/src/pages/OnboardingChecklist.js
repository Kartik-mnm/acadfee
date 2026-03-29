// ── Onboarding Checklist ───────────────────────────────────────────────────────────
// Shown inside Dashboard when the academy is new (no students yet)
// Guides the owner through the key first steps
import { useAcademy } from "../context/AcademyContext";

const STEPS = [
  {
    id: "branch",
    icon: "🏫",
    title: "Your branch is ready",
    desc: "A default branch was created for your academy. You can rename it or add more branches.",
    done: true, // always done after signup
    action: null,
  },
  {
    id: "batch",
    icon: "📖",
    title: "Create your first batch",
    desc: "Batches define course groups (e.g. JEE 2026, Class 10). Add fee amounts per batch.",
    done: false,
    navigate: "batches",
    cta: "Add Batch →",
  },
  {
    id: "student",
    icon: "👤",
    title: "Add your first student",
    desc: "Enroll students and assign them to a batch. Each student gets a roll number automatically.",
    done: false,
    navigate: "students",
    cta: "Add Student →",
  },
  {
    id: "fees",
    icon: "💳",
    title: "Generate fee records",
    desc: "Go to Fee Records → Generate Fees to create monthly dues for all active students.",
    done: false,
    navigate: "fees",
    cta: "Go to Fees →",
  },
  {
    id: "settings",
    icon: "🎨",
    title: "Personalise your academy",
    desc: "Upload your logo, set your brand colors, and fill in contact info.",
    done: false,
    navigate: "settings",
    cta: "Open Settings →",
  },
];

export default function OnboardingChecklist({ onNavigate, completedSteps = [] }) {
  const { academy } = useAcademy();
  const steps = STEPS.map(s => ({ ...s, done: s.done || completedSteps.includes(s.id) }));
  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: 24, marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text1)", marginBottom: 4 }}>
            🎉 Welcome to {academy?.name || "your academy"}!
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>
            Complete these steps to get your academy running.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue-400)" }}>{pct}%</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>complete</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "var(--bg3)", borderRadius: 6, height: 6, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, var(--blue-600), var(--blue-400))", borderRadius: 6, transition: "width 0.5s ease" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step) => (
          <div key={step.id} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 14px", borderRadius: 10,
            background: step.done ? "rgba(16,185,129,0.05)" : "var(--bg3)",
            border: `1px solid ${step.done ? "rgba(16,185,129,0.15)" : "var(--border)"}`,
            opacity: step.done ? 0.75 : 1,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: step.done ? "rgba(16,185,129,0.12)" : "var(--bg2)",
              border: `2px solid ${step.done ? "rgba(16,185,129,0.3)" : "var(--border2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              {step.done ? <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓</span> : step.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 2, textDecoration: step.done ? "line-through" : "none" }}>{step.title}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>{step.desc}</div>
            </div>
            {!step.done && step.navigate && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate?.(step.navigate)}
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {step.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
