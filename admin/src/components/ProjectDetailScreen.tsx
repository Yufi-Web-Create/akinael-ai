import { useState } from "react";
import type { ProjectDetail } from "../lib/types";
import { composeStatusSummary, projectDetailStatus, STATUS_TONE, translateAttentionReasons } from "../lib/adapters";

const fmtDate = (value?: string) => (value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—");

export default function ProjectDetailScreen({
  detail,
  busy,
  onOpenChat,
  onOpenConsultationLog,
  onAcknowledge,
  onNotifyCustomer
}: {
  detail: ProjectDetail;
  busy: boolean;
  onOpenChat: (instruction?: boolean) => void;
  onOpenConsultationLog: () => void;
  onAcknowledge: (note: string) => Promise<void>;
  onNotifyCustomer: (message: string) => Promise<void>;
}) {
  const { status, label } = projectDetailStatus(detail);
  const [confirm, setConfirm] = useState<null | "acknowledge" | "notify">(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const latestRequest = detail.requests[0];
  const approvedDelivery = detail.approvals.find((approval) => approval.type === "delivery" && approval.status === "approved");
  const completedTasks = detail.tasks.filter((task) => task.status === "completed");
  const upcomingTasks = detail.tasks.filter((task) => task.status !== "completed").slice(0, 5);
  const latestArtifact = detail.artifacts[0];
  const publishedDeployment = detail.deployments.find((deployment) => deployment.status === "published");

  const runAction = async () => {
    if (confirm === "acknowledge") {
      await onAcknowledge(note);
      setToast("承認して進めました。");
    } else if (confirm === "notify") {
      await onNotifyCustomer(note);
      setToast("お客様へ送りました。");
    }
    setConfirm(null);
    setNote("");
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className="screen">
      <div className="detail-header">
        <div>
          <span className="eyebrow">PROJECT</span>
          <h1>{detail.project.name}</h1>
          <p className="muted">
            {detail.customer?.name || "顧客未設定"} ・ 最終更新 {fmtDate(detail.project.updated_at)}
          </p>
        </div>
        <span className={`tag ${STATUS_TONE[status]}`} style={{ fontSize: 14 }}>{label}</span>
      </div>

      <div className="quick-links">
        <button type="button" className="btn secondary" onClick={onOpenConsultationLog}>お客様との相談</button>
        <button type="button" className="btn secondary" onClick={() => onOpenChat(false)}>司令塔AIに相談</button>
      </div>

      <div className="panel-grid" style={{ marginBottom: 16 }}>
        <article className="card registered">
          <h2>今の状況</h2>
          <p>{composeStatusSummary(detail)}</p>
        </article>
        <article className="card registered">
          <h2>確定した相談内容</h2>
          {latestRequest ? (
            <>
              <p>{latestRequest.title as string}</p>
              {approvedDelivery && <span className="tag success">お客様承認済み</span>}
            </>
          ) : (
            <p className="muted">まだ確定した相談内容はありません。</p>
          )}
        </article>
      </div>

      {status === "needs_admin" && (
        <article className="card registered" style={{ marginBottom: 16 }}>
          <h2>AI作業提案</h2>
          <ul className="checklist">
            {translateAttentionReasons(detail.project.attention_reasons).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="quick-links">
            <button type="button" className="btn" onClick={() => setConfirm("acknowledge")} disabled={busy}>承認して進める</button>
            <button type="button" className="btn secondary" onClick={() => onOpenChat(true)}>修正を指示</button>
          </div>
        </article>
      )}

      {status === "in_progress" && (
        <article className="card registered" style={{ marginBottom: 16 }}>
          <h2>作業状況</h2>
          <p className="muted">{completedTasks.length} / {detail.tasks.length} 工程が完了</p>
          <ul className="checklist">
            {upcomingTasks.map((task) => (
              <li key={task.id as string}>{(task.title as string) || "作業項目"}</li>
            ))}
          </ul>
        </article>
      )}

      {status === "needs_customer" && (
        <article className="card registered" style={{ marginBottom: 16 }}>
          <h2>お客様への確認</h2>
          <p className="muted">{(latestArtifact?.title as string) || "制作物"}の確認をお願いする準備ができています。</p>
          <div className="quick-links">
            <button type="button" className="btn" onClick={() => setConfirm("notify")} disabled={busy}>お客様へ送る</button>
            <button type="button" className="btn secondary" onClick={() => onOpenChat(false)}>司令塔AIに相談する</button>
          </div>
        </article>
      )}

      {status === "done" && (
        <article className="card registered" style={{ marginBottom: 16 }}>
          <h2>運用状況</h2>
          <div className="quick-links">
            {(publishedDeployment?.url as string) || latestArtifact?.preview_url ? (
              <a className="btn secondary" href={(publishedDeployment?.url as string) || (latestArtifact?.preview_url as string)} target="_blank" rel="noreferrer">
                公開サイトを見る
              </a>
            ) : null}
            <button type="button" className="btn secondary" onClick={() => onOpenChat(false)}>次回提案について相談する</button>
          </div>
          {detail.deploymentGate.humanGateRequired && !detail.deploymentGate.productionPublished && (
            <p className="gate-note">本番公開はオーナーの明示承認後にのみ行います。</p>
          )}
        </article>
      )}

      {status === "new" && (
        <article className="card registered" style={{ marginBottom: 16 }}>
          <p className="muted">相談内容がまだ確定していません。お客様の相談が完了すると、ここに表示されます。</p>
        </article>
      )}

      {detail.artifacts.length > 0 && (
        <article className="card registered">
          <h2>成果物</h2>
          <div className="works-grid">
            {detail.artifacts.slice(0, 6).map((artifact) => (
              <div key={artifact.id as string} className="card">
                <strong>{(artifact.title as string) || (artifact.kind as string)}</strong>
                {(artifact.preview_url as string) && (
                  <div>
                    <a href={artifact.preview_url as string} target="_blank" rel="noreferrer">プレビューを開く</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      )}

      {confirm && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog">
            <h2>{confirm === "acknowledge" ? "承認して進める" : "お客様へ送る"}</h2>
            <label>
              メモ（任意）
              <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn secondary" onClick={() => setConfirm(null)}>キャンセル</button>
              <button type="button" className="btn" onClick={runAction} disabled={busy}>
                {confirm === "acknowledge" ? "承認して進める" : "お客様へ送る"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
