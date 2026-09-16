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
  hasPaidPlan,
  onNavigate
}: {
  appState: AppState;
  gate?: DeploymentGate;
  hasPaidPlan: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const copy = APP_STATE_COPY[appState];
  const customerApproved = Boolean(gate?.customerApproved);
  const awaitingContract = customerApproved && !hasPaidPlan && !gate?.productionPublished;
  const readyToPublish = customerApproved && hasPaidPlan && !gate?.productionPublished;

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

      <section key={`${appState}-${customerApproved}-${hasPaidPlan}`} className="card next-action card-in">
        {awaitingContract ? (
          <>
            <h2>制作物の承認が完了しました</h2>
            <p className="muted">続いて契約・お支払いのお手続きをお願いします。お支払い完了後に公開準備へ進みます。</p>
            <button className="btn" onClick={() => onNavigate("plan")}>契約・お支払いへ進む</button>
          </>
        ) : readyToPublish ? (
          <>
            <h2>契約・お支払いを確認しました</h2>
            <p className="muted">ありがとうございます。公開準備を進めています。</p>
          </>
        ) : (
          <>
            <h2>{copy.heading}</h2>
            <p className="muted">{copy.body}</p>
            {copy.cta && (
              <button className="btn" onClick={() => onNavigate(CTA_TARGET[appState] || "home")}>
                {copy.cta}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
