import { useEffect, useState } from "react";
import type { BillingSummary, PricingCatalog } from "../lib/types";

const fmtYen = (value?: number) => (typeof value === "number" ? `¥${value.toLocaleString("ja-JP")}` : "—");
const fmtDate = (value?: string) => (value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—");

export default function PlanScreen({
  billing,
  pricing,
  busy,
  onOpenBillingPortal
}: {
  billing: BillingSummary | null;
  pricing: PricingCatalog | null;
  busy: boolean;
  onOpenBillingPortal: () => Promise<void>;
}) {
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (pricing && !selectedPlanId) {
      const firstOther = Object.keys(pricing.plans).find((id) => id !== billing?.currentPlan?.id);
      setSelectedPlanId(firstOther || null);
    }
  }, [pricing, billing, selectedPlanId]);

  const selectedPlan = selectedPlanId && pricing ? pricing.plans[selectedPlanId] : null;

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">プラン・お支払い</span>
        <h1>プラン・お支払い</h1>
      </header>

      <section className="card card-in" style={{ marginBottom: 16 }}>
        <h2>現在のプラン</h2>
        <div className="plan-summary-row">
          <span className="muted">プラン</span>
          <strong>{billing?.currentPlan?.name || "ご相談受付中（お試し）"}</strong>
        </div>
        <div className="plan-summary-row">
          <span className="muted">月額</span>
          <strong>{fmtYen(billing?.currentPlan?.monthlyAmount)}</strong>
        </div>
        <div className="plan-summary-row">
          <span className="muted">契約状態</span>
          <strong>{billing?.currentPlan ? "契約中" : "未契約"}</strong>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => setChangeDialogOpen(true)}>
            プランを変更する
          </button>
        </div>
      </section>

      <section className="card card-in" style={{ marginBottom: 16 }}>
        <h2>お支払い方法・請求履歴</h2>
        {billing?.billingPortalAvailable ? (
          <>
            <p className="muted">カード情報や請求履歴の詳細は、安全なお支払い管理ページでご確認いただけます。</p>
            <button className="btn secondary" disabled={busy} onClick={onOpenBillingPortal}>
              {busy ? "開いています…" : "お支払い管理ページを開く"}
            </button>
          </>
        ) : (
          <p className="muted">お支払い管理ページは現在準備中です。ご不明な点は担当チームへご相談ください。</p>
        )}
        {billing?.history && billing.history.length > 0 && (
          <div className="history-list">
            {billing.history.map((item) => (
              <div className="history-row" key={item.id}>
                <span>{fmtDate(item.created_at)}</span>
                <span>{fmtYen(item.amount)}</span>
                <span className="muted">{item.status || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="button" className="btn link" onClick={() => setCancelDialogOpen(true)}>
        解約について
      </button>

      {changeDialogOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog card-in">
            <h2>プランを変更する</h2>
            {pricing && (
              <>
                <label>
                  変更後のプラン
                  <select value={selectedPlanId || ""} onChange={(event) => setSelectedPlanId(event.target.value)}>
                    {Object.entries(pricing.plans).map(([id, plan]) => (
                      <option key={id} value={id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="plan-summary-row">
                  <span className="muted">現在</span>
                  <strong>{fmtYen(billing?.currentPlan?.monthlyAmount)} / 月</strong>
                </div>
                <div className="plan-summary-row">
                  <span className="muted">変更後</span>
                  <strong>{fmtYen(selectedPlan?.monthlyAmount ?? selectedPlan?.amount)} / 月</strong>
                </div>
              </>
            )}
            <p className="muted" style={{ marginTop: 12 }}>
              実際のご契約変更は、安全なお支払い管理ページで確定します。
            </p>
            <div className="dialog-actions">
              <button className="btn secondary" onClick={() => setChangeDialogOpen(false)}>
                キャンセル
              </button>
              <button
                className="btn"
                disabled={!billing?.billingPortalAvailable || busy}
                onClick={async () => {
                  await onOpenBillingPortal();
                  setChangeDialogOpen(false);
                }}
              >
                お支払い管理ページで変更する
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelDialogOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog card-in">
            <h2>解約について</h2>
            <p className="muted">解約手続きは、安全なお支払い管理ページから行えます。ご不明な点は担当チームへご相談ください。</p>
            <div className="dialog-actions">
              <button className="btn secondary" onClick={() => setCancelDialogOpen(false)}>
                閉じる
              </button>
              <button
                className="btn danger"
                disabled={!billing?.billingPortalAvailable || busy}
                onClick={async () => {
                  await onOpenBillingPortal();
                  setCancelDialogOpen(false);
                }}
              >
                お支払い管理ページを開く
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
