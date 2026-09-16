import { useMemo, useState } from "react";
import type { CustomerRow } from "../lib/types";

const fmtDate = (value?: string) => (value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—");

export default function CustomersScreen({ customers, onOpen }: { customers: CustomerRow[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => customers.filter((customer) => customer.name?.toLowerCase().includes(query.toLowerCase())),
    [customers, query]
  );

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">CUSTOMERS</span>
        <h1>顧客</h1>
      </header>

      <div className="search-row">
        <input placeholder="顧客名・店舗名で検索" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="顧客検索" />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>顧客名・店舗名</th>
            <th>契約プラン</th>
            <th>案件数</th>
            <th>最終更新</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((customer) => (
            <tr key={customer.id} onClick={() => onOpen(customer.id)} style={{ cursor: "pointer" }}>
              <td>{customer.name}</td>
              <td>{customer.plan_id || "未設定"}</td>
              <td>{customer.projectCount}</td>
              <td>{fmtDate(customer.lastActivity)}</td>
              <td>{customer.needsAttention ? <span className="tag warn">要対応</span> : <span className="tag success">順調</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card-list">
        {filtered.map((customer) => (
          <article key={customer.id} className="card" onClick={() => onOpen(customer.id)}>
            <strong>{customer.name}</strong>
            <span className="muted">プラン: {customer.plan_id || "未設定"} ・ 案件 {customer.projectCount}件</span>
            {customer.needsAttention ? <span className="tag warn">要対応</span> : <span className="tag success">順調</span>}
          </article>
        ))}
      </div>
      {filtered.length === 0 && <p className="muted">該当する顧客はいません。</p>}
    </main>
  );
}
