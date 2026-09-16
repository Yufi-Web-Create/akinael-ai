import { APP_STATE_COPY } from "../lib/adapters";
import type { AppState, DeploymentGate, Screen } from "../lib/types";

const STEPS: { key: string; label: string; states: AppState[] }[] = [
  { key: "consult", label: "相談", states: ["not_started", "chatting"] },
  { key: "confirm", label: "内容確認", states: ["summary_ready"] },
  { key: "production", label: "制作", states: ["approved", "in_production", "revision"] },
  { key: "done", label: "完成", states: ["completed", "final_check"] }
];

const CTA_TARGET: Partial<Record<AppState, Screen>> = {
  not_started: "chat",
  chatting: "chat",
  summary_ready: "summary",
  completed: "works",
  final_check: "works"
};

export default function Home({
  appState,
  gate,
  onNavigate
}: {
  appState: AppState;
  gate?: DeploymentGate;
  onNavigate: (screen: Screen) => void;
}) {
  const copy = APP_STATE_COPY[appState];
  const approvedAlready = appState === "final_check" && gate?.customerApproved;

  return (
    <main className="screen">
      <header style={{ marginBottom: 24 }}>
        <span className="eyebrow">CUSTOMER PORTAL</span>
        <h1>
          相談の続きから、
          <br />
          制作の今を確認できます。
        </h1>
      </header>

      <div className="home-steps" aria-label="制作の進み方">
        {STEPS.map((step) => (
          <span key={step.key} className={step.states.includes(appState) ? "current" : ""}>
            {step.label}
          </span>
        ))}
      </div>

      <section key={appState} className="card next-action card-in">
        <h2>{copy.heading}</h2>
        <p className="muted">
          {approvedAlready ? "ご確認ありがとうございました。担当チームが公開準備を進めています。" : copy.body}
        </p>
        {copy.cta && !approvedAlready && (
          <button className="btn" onClick={() => onNavigate(CTA_TARGET[appState] || "home")}>
            {copy.cta}
          </button>
        )}
      </section>
    </main>
  );
}
