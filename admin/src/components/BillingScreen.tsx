import { useState } from "react";
import type { CustomerRow } from "../lib/types";

type PlanCatalog = Record<string, { name: string; monthlyAmount?: number; amount?: number }>;

export default function BillingScreen({
  customers,
  plans,
  busy,
  onChangePlan
}: {
  customers: CustomerRow[];
  plans: PlanCatalog;
  busy: boolean;
  onChangePlan: (customerId: string, planId: string | null) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">契約・料金</span>
        <h1>契約・料金</h1>
      </header>

      <table className="data-table">
        <thead>
          <tr>
            <th>顧客</th>
            <th>契約プラン</th>
            <th>月額</th>
            <th>アクション</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const plan = customer.plan_id ? plans[customer.plan_id] : null;
            return (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>
                  {editingId === customer.id ? (
                    <select
                      defaultValue={customer.plan_id || ""}
                      onChange={async (event) => {
                        await onChangePlan(customer.id, event.target.value || null);
                        setEditingId(null);
                      }}
                    >
                      <option value="">未設定</option>
                      {Object.entries(plans).map(([id, entry]) => (
                        <option key={id} value={id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    plan?.name || "未設定"
                  )}
                </td>
                <td>{plan?.monthlyAmount ? `¥${plan.monthlyAmount.toLocaleString("ja-JP")}` : "—"}</td>
                <td>
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => setEditingId(customer.id)}>
                    料金を変更する
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 16 }}>
        ここでの変更は社内の契約プラン記録の更新です。実際のご請求金額の変更はStripeのお支払い管理と併せて確認してください。
      </p>
    </main>
  );
}
