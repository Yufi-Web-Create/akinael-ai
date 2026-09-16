import { useEffect, useMemo, useState } from "react";
import type { BillingSummary, PricingCatalog } from "../lib/types";

const fmtYen = (value?: number) => (typeof value === "number" ? `¥${value.toLocaleString("ja-JP")}` : "—");
const fmtDate = (value?: string) => (value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—");

export default function PlanScreen({
  billing,
  pricing,
  busy,
  onStartCheckout,
  onChangePlan,
  onCancel
}: {
  billing: BillingSummary | null;
  pricing: PricingCatalog | null;
  busy: boolean;
  onStartCheckout: (planId: string) => Promise<void>;
  onChangePlan: (planId: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const paidPlans = useMemo(
    () => (pricing ? Object.entries(pricing.plans).filter(([id]) => id !== "trial") : []),
    [pricing]
  );

  useEffect(() => {
    if (!selectedPlanId && paidPlans.length) {
      const firstOther = paidPlans.find(([id]) => id !== billing?.currentPlan?.id);
      setSelectedPlanId(firstOther?.[0] || paidPlans[0]?.[0] || null);
    }
  }, [paidPlans, billing, selectedPlanId]);

  const selectedPlan = selectedPlanId && pricing ? pricing.plans[selectedPlanId] : null;
  const hasPaidPlan = Boolean(billing?.currentPlan && billing.currentPlan.id !== "trial");
  const samePlan = hasPaidPlan && selectedPlanId === billing?.currentPlan?.id;

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
          <strong>{hasPaidPlan ? billing?.currentPlan?.name : "お試し"}</strong>
        </div>
        <div className="plan-summary-row">
          <span className="muted">月額</span>
          <strong>{hasPaidPlan ? fmtYen(billing?.currentPlan?.monthlyAmount) : "¥0"}</strong>
        </div>
        <div className="plan-summary-row">
          <span className="muted">契約状態</span>
          <strong>{hasPaidPlan ? "契約中" : "有料プラン未契約"}</strong>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} onClick={() => setChangeDialogOpen(true)}>
            {hasPaidPlan ? "プランを変更する" : "有料プランを申し込む"}
          </button>
        </div>
      </section>

      <section className="card card-in" style={{ marginBottom: 16 }}>
        <h2>お支払い・請求履歴</h2>
        {hasPaidPlan ? (
          <p className="muted">月額料金はSquareで安全に決済されます。決済履歴は下記から確認できます。</p>
        ) : (
          <p className="muted">有料プランのお申し込み時に、Squareの安全な決済画面でカード情報を入力します。</p>
        )}
        {billing?.history && billing.history.length > 0 ? (
          <div className="history-list">
            {billing.history.map((item) => (
              <div className="history-row" key={item.id}>
                <span>{fmtDate(item.created_at)}</span>
                <span>{fmtYen(item.amount)}</span>
                <span className="muted">{item.status || "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">まだ請求履歴はありません。</p>
        )}
      </section>

      {hasPaidPlan && (
        <button type="button" className="btn link" onClick={() => setCancelDialogOpen(true)}>
          解約について
        </button>
      )}

      {changeDialogOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog card-in">
            <h2>{hasPaidPlan ? "プランを変更する" : "有料プランを申し込む"}</h2>
            {pricing && (
              <>
                <label>
                  {hasPaidPlan ? "変更後のプラン" : "申し込むプラン"}
                  <select value={selectedPlanId || ""} onChange={(event) => setSelectedPlanId(event.target.value)}>
                    {paidPlans.map(([id, plan]) => (
                      <option key={id} value={id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                {hasPaidPlan && (
                  <div className="plan-summary-row">
                    <span className="muted">現在</span>
                    <strong>{fmtYen(billing?.currentPlan?.monthlyAmount)} / 月</strong>
                  </div>
                )}
                <div className="plan-summary-row">
                  <span className="muted">{hasPaidPlan ? "変更後" : "月額"}</span>
                  <strong>{fmtYen(selectedPlan?.monthlyAmount ?? selectedPlan?.amount)} / 月</strong>
                </div>
              </>
            )}
            <p className="muted" style={{ marginTop: 12 }}>
              {hasPaidPlan
                ? "プラン変更はSquareへ反映され、次回の更新タイミングから新しいプランへ切り替わります。"
                : "申し込み内容を確認したあと、Squareの安全な決済画面でカード情報を入力して契約を確定します。"}
            </p>
            <div className="dialog-actions">
              <button className="btn secondary" disabled={busy} onClick={() => setChangeDialogOpen(false)}>
                キャンセル
              </button>
              <button
                className="btn"
                disabled={!selectedPlanId || busy || Boolean(samePlan)}
                onClick={async () => {
                  if (!selectedPlanId) return;
                  if (hasPaidPlan) await onChangePlan(selectedPlanId);
                  else await onStartCheckout(selectedPlanId);
                  setChangeDialogOpen(false);
                }}
              >
                {busy ? "処理しています…" : hasPaidPlan ? "このプランへ変更する" : "Square決済へ進む"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelDialogOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog card-in">
            <h2>解約について</h2>
            <p className="muted">解約すると現在の請求期間の終了時に自動更新が停止します。解約日までは現在のプランをご利用いただけます。</p>
            <div className="dialog-actions">
              <button className="btn secondary" disabled={busy} onClick={() => setCancelDialogOpen(false)}>
                閉じる
              </button>
              <button
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  await onCancel();
                  setCancelDialogOpen(false);
                }}
              >
                {busy ? "処理しています…" : "次回更新で解約する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
