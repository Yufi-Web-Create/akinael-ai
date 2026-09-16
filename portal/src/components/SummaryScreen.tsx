import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { ConsultationSummary } from "../lib/types";

export default function SummaryScreen({
  summary,
  busy,
  onApprove,
  onRequestChange
}: {
  summary: ConsultationSummary | null;
  busy: boolean;
  onApprove: () => Promise<void>;
  onRequestChange: () => void;
}) {
  const [approved, setApproved] = useState(false);

  if (!summary) {
    return (
      <main className="screen">
        <header style={{ marginBottom: 16 }}>
          <span className="eyebrow">相談内容</span>
          <h1>相談内容</h1>
        </header>
        <p className="muted">まだ確定した相談内容がありません。「AIに相談」から相談を始めてください。</p>
      </main>
    );
  }

  const approve = async () => {
    await onApprove();
    setApproved(true);
  };

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">相談内容</span>
        <h1>{summary.title}</h1>
      </header>

      <section className="card card-in" style={{ display: "grid", gap: 20 }}>
        <div>
          <h3>AI要約</h3>
          <p>{summary.overview}</p>
        </div>
        {summary.scopeItems.length > 0 && (
          <div>
            <h3>含まれる作業</h3>
            <ul className="summary-list">
              {summary.scopeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.deliverables.length > 0 && (
          <div>
            <h3>納品物</h3>
            <ul className="summary-list">
              {summary.deliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.priceBand && (
          <div>
            <h3>予定金額（税込）</h3>
            <p className="price-band">{summary.priceBand}</p>
          </div>
        )}
        {summary.notes && (
          <div>
            <h3>補足事項</h3>
            <p className="muted">{summary.notes}</p>
          </div>
        )}
      </section>

      <div className="summary-actions">
        <button className="btn" disabled={busy || approved} onClick={approve}>
          {approved ? (
            <>
              <CheckCircle2 size={18} className="check-pop" aria-hidden /> お受けしました
            </>
          ) : busy ? (
            "送信中…"
          ) : (
            "この内容でお願いする"
          )}
        </button>
        {!approved && (
          <button className="btn secondary" onClick={onRequestChange} disabled={busy}>
            AIに修正を相談する
          </button>
        )}
      </div>
    </main>
  );
}
