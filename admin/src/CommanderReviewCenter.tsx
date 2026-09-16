import { useCallback, useEffect, useState } from "react";

const core = import.meta.env.VITE_CORE_API_URL || "https://akinael-ai.com";
const tokenKey = "akinael-admin-token";

type Project = {
  id: string;
  name: string;
  customer_name?: string | null;
  needs_attention?: boolean;
};

type Plan = { id?: string; name?: string; monthlyAmount?: number };
type Proposal = {
  requestId?: string;
  version?: number;
  createdAt?: string;
  proposal?: {
    overview?: string;
    approach?: string;
    assignees?: Array<{ role?: string; responsibility?: string }>;
    workItems?: Array<{ title?: string; owner?: string; description?: string; deliverable?: string }>;
    acceptanceCriteria?: string[];
    cautions?: string[];
    pricing?: {
      taxIncluded?: boolean;
      approvalRequired?: boolean;
      subscription?: {
        status?: "within_current_plan" | "upgrade_recommended" | "subscription_recommended";
        currentPlan?: Plan | null;
        recommendedPlan?: Plan | null;
        reason?: string;
      };
      oneTime?: {
        status?: string;
        name?: string;
        amount?: number | null;
        label?: string;
        reason?: string;
      } | null;
    };
  };
};

type ReviewItem = { project: Project; proposal: Proposal | null };

const panel: React.CSSProperties = {
  position: "fixed",
  top: 72,
  right: 18,
  width: "min(520px, calc(100vw - 28px))",
  maxHeight: "calc(100vh - 90px)",
  overflow: "auto",
  zIndex: 90,
  background: "var(--paper, #f6f1e8)",
  color: "var(--ink, #202b28)",
  border: "1px solid currentColor",
  boxShadow: "0 18px 50px rgba(0,0,0,.2)",
  padding: 18
};

const trigger: React.CSSProperties = {
  position: "fixed",
  top: 16,
  right: 18,
  zIndex: 91,
  border: "1px solid currentColor",
  background: "#fff8e7",
  color: "#7b3c16",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer"
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.22)",
  background: "rgba(255,255,255,.58)",
  padding: 16,
  marginTop: 14
};

const pricingCard: React.CSSProperties = {
  border: "1px solid rgba(23,63,59,.28)",
  background: "rgba(23,63,59,.06)",
  padding: 12,
  marginTop: 12
};

const button: React.CSSProperties = {
  border: "1px solid currentColor",
  background: "#173f3b",
  color: "white",
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 700
};

const secondaryButton: React.CSSProperties = {
  ...button,
  background: "transparent",
  color: "inherit"
};

const yen = (value?: number | null) => typeof value === "number" ? `${value.toLocaleString("ja-JP")}円` : "";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  if (!token) throw new Error("管理者ログインが必要です。");
  const response = await fetch(`${core}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "処理に失敗しました。");
  return body as T;
}

export default function CommanderReviewCenter() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      setItems([]);
      return;
    }
    try {
      const overview = await api<{ projects?: Project[] }>("/api/v2/admin/overview");
      const candidates = (overview.projects || []).filter((project) => project.needs_attention);
      const next: ReviewItem[] = [];
      for (const project of candidates) {
        try {
          const detail = await api<{ requests?: Array<{ status?: string }> }>(`/api/v2/admin/projects/${project.id}`);
          if (detail.requests?.[0]?.status !== "waiting_approval") continue;
          const proposal = await api<Proposal | null>(`/api/v2/admin/projects/${project.id}/proposal`);
          next.push({ project, proposal });
        } catch {
          next.push({ project, proposal: null });
        }
      }
      setItems(next);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "要確認案件を取得できませんでした。");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30000);
    const onStorage = () => void refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  if (!localStorage.getItem(tokenKey) && items.length === 0) return null;

  const approve = async (projectId: string) => {
    setBusyId(projectId);
    setError("");
    try {
      await api(`/api/v2/admin/projects/${projectId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ note: "司令塔AIの実装プラン・料金案を確認して承認" })
      });
      await refresh();
      window.dispatchEvent(new Event("akinael-admin-refresh"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "承認できませんでした。");
    } finally {
      setBusyId("");
    }
  };

  const revise = async (projectId: string) => {
    const instruction = (drafts[projectId] || "").trim();
    if (!instruction) return;
    setBusyId(projectId);
    setError("");
    try {
      const proposal = await api<Proposal>(`/api/v2/admin/projects/${projectId}/proposal/revise`, {
        method: "POST",
        body: JSON.stringify({ instruction })
      });
      setItems((current) => current.map((item) => item.project.id === projectId ? { ...item, proposal } : item));
      setDrafts((current) => ({ ...current, [projectId]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提案を修正できませんでした。");
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <button type="button" style={trigger} onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }} aria-expanded={open}>
        要確認 {items.length > 0 ? `(${items.length})` : ""}
      </button>
      {open && (
        <aside style={panel} aria-label="要確認">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <strong style={{ fontSize: 22 }}>要確認</strong>
              <p style={{ margin: "4px 0 0", opacity: .7 }}>司令塔AIが、相談内容に合わせて実装プランと料金・サブスク案をまとめました。</p>
            </div>
            <button type="button" style={secondaryButton} onClick={() => setOpen(false)}>閉じる</button>
          </div>
          {error && <p role="alert" style={{ border: "1px solid #a33", padding: 10 }}>{error}</p>}
          {items.length === 0 ? (
            <p style={{ padding: "24px 0", opacity: .7 }}>現在、承認待ちの実装提案はありません。</p>
          ) : items.map(({ project, proposal }) => {
            const p = proposal?.proposal;
            const pricing = p?.pricing;
            const subscription = pricing?.subscription;
            const isBusy = busyId === project.id;
            return (
              <article key={project.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                  <div>
                    <small>{project.customer_name || "顧客"}</small>
                    <h2 style={{ margin: "4px 0 10px", fontSize: 19 }}>{project.name}</h2>
                  </div>
                  {proposal?.version ? <small>提案 v{proposal.version}</small> : null}
                </div>
                {!p ? <p>司令塔AIが提案を準備しています。再読み込みすると再生成を試みます。</p> : (
                  <>
                    <h3 style={{ fontSize: 15, marginBottom: 4 }}>実装概要</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{p.overview}</p>
                    <h3 style={{ fontSize: 15, marginBottom: 4 }}>進め方</h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{p.approach}</p>
                    <h3 style={{ fontSize: 15, marginBottom: 4 }}>担当者</h3>
                    <ul>{(p.assignees || []).map((item, index) => <li key={`${item.role}-${index}`}><strong>{item.role || "AI担当"}</strong>：{item.responsibility}</li>)}</ul>
                    <h3 style={{ fontSize: 15, marginBottom: 4 }}>作業内容</h3>
                    <ol>{(p.workItems || []).map((item, index) => <li key={`${item.title}-${index}`} style={{ marginBottom: 8 }}><strong>{item.title}</strong>{item.owner ? ` ／ ${item.owner}` : ""}<br/><span style={{ opacity: .8 }}>{item.description}</span>{item.deliverable ? <><br/><small>成果物：{item.deliverable}</small></> : null}</li>)}</ol>

                    {pricing && (
                      <section style={pricingCard}>
                        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>料金・サブスク案</h3>
                        {pricing.oneTime && (
                          <div style={{ marginBottom: 10 }}>
                            <strong>{pricing.oneTime.name || "制作費"}：{pricing.oneTime.label || yen(pricing.oneTime.amount)}</strong>
                            {pricing.oneTime.reason ? <p style={{ margin: "4px 0", opacity: .8 }}>{pricing.oneTime.reason}</p> : null}
                          </div>
                        )}
                        {subscription?.status === "within_current_plan" ? (
                          <div>
                            <strong>サブスク：変更なし</strong>
                            {subscription.currentPlan?.name ? <p style={{ margin: "4px 0" }}>現在：{subscription.currentPlan.name}{subscription.currentPlan.monthlyAmount ? `（月額${yen(subscription.currentPlan.monthlyAmount)}）` : ""}</p> : null}
                            <p style={{ margin: "4px 0", opacity: .8 }}>{subscription.reason}</p>
                          </div>
                        ) : subscription?.recommendedPlan ? (
                          <div>
                            {subscription.currentPlan?.name ? <p style={{ margin: "4px 0" }}>現在：{subscription.currentPlan.name}{subscription.currentPlan.monthlyAmount ? `（月額${yen(subscription.currentPlan.monthlyAmount)}）` : ""}</p> : <p style={{ margin: "4px 0" }}>現在：月額プラン未契約</p>}
                            <strong>提案：{subscription.recommendedPlan.name}（月額{yen(subscription.recommendedPlan.monthlyAmount)}）</strong>
                            <p style={{ margin: "4px 0", opacity: .8 }}>{subscription.reason}</p>
                          </div>
                        ) : null}
                        <small style={{ opacity: .65 }}>金額は税込。プラン変更・追加料金は、お客様の明確な承認後に進めます。</small>
                      </section>
                    )}

                    {(p.acceptanceCriteria || []).length > 0 && <><h3 style={{ fontSize: 15, marginBottom: 4 }}>完了条件</h3><ul>{p.acceptanceCriteria!.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
                    {(p.cautions || []).length > 0 && <><h3 style={{ fontSize: 15, marginBottom: 4 }}>確認事項</h3><ul>{p.cautions!.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
                  </>
                )}
                <div style={{ borderTop: "1px solid rgba(0,0,0,.16)", paddingTop: 12, marginTop: 14 }}>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>司令塔AIに修正を依頼</label>
                  <textarea
                    rows={3}
                    value={drafts[project.id] || ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [project.id]: event.target.value }))}
                    placeholder="例：SEO調査を先にして。料金案は現在プランの範囲をもう一度確認して。"
                    disabled={isBusy}
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, background: "transparent", color: "inherit", border: "1px solid rgba(0,0,0,.35)" }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <button type="button" style={secondaryButton} disabled={isBusy || !(drafts[project.id] || "").trim()} onClick={() => void revise(project.id)}>{isBusy ? "処理中…" : "修正して再提案"}</button>
                    <button type="button" style={button} disabled={isBusy || !p} onClick={() => void approve(project.id)}>{isBusy ? "処理中…" : "承認して作業開始"}</button>
                  </div>
                  <p style={{ fontSize: 12, opacity: .65, marginBottom: 0 }}>承認するまで制作Workflowは開始されません。</p>
                </div>
              </article>
            );
          })}
        </aside>
      )}
    </>
  );
}
