import { CheckCircle2, FileText, Monitor, Smartphone } from "lucide-react";
import type { WorkItem, WorkItemStatus } from "../lib/types";

const STATUS_CLASS: Record<WorkItemStatus, string> = {
  制作中: "making",
  確認できます: "ready",
  修正対応中: "revision",
  完成: "done"
};

export default function WorksScreen({
  works,
  canApprove,
  approved,
  busy,
  onApprove,
  onRequestRevision
}: {
  works: WorkItem[];
  canApprove: boolean;
  approved: boolean;
  busy: boolean;
  onApprove: () => Promise<void>;
  onRequestRevision: (workTitle: string) => void;
}) {
  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">制作物</span>
        <h1>制作物</h1>
      </header>

      {works.length === 0 ? (
        <div className="empty-state">
          <p>まだ制作物はありません。相談が完了すると、ここに表示されます。</p>
        </div>
      ) : (
        <div className="works-grid">
          {works.map((work) => (
            <article key={work.id} className="card work-card card-in">
              <div className={`work-preview${work.isWebsite ? "" : " single"}`}>
                {work.isWebsite ? (
                  <>
                    <Monitor size={28} aria-hidden />
                    <Smartphone size={24} aria-hidden />
                  </>
                ) : (
                  <FileText size={28} aria-hidden />
                )}
              </div>
              <span className={`status-tag ${STATUS_CLASS[work.statusLabel]}`}>{work.statusLabel}</span>
              <h3>{work.title}</h3>
              <div className="work-actions">
                {work.isWebsite && work.previewUrl && (
                  <a className="btn secondary" href={work.previewUrl} target="_blank" rel="noreferrer">
                    プレビューを開く
                  </a>
                )}
                {!approved && (
                  <button type="button" className="btn link" onClick={() => onRequestRevision(work.title)}>
                    修正をお願いする
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {canApprove && !approved && (
        <section className="card card-in" style={{ marginTop: 20 }}>
          <h2>内容の最終確認</h2>
          <p className="muted">プレビューをご確認ください。問題がなければ承認すると、契約・お支払いのご案内へ進みます。</p>
          <button type="button" className="btn" onClick={onApprove} disabled={busy}>
            {busy ? "承認中…" : "この内容を承認する"}
          </button>
        </section>
      )}

      {approved && (
        <section className="card card-in" style={{ marginTop: 20 }}>
          <h2><CheckCircle2 size={20} aria-hidden /> 制作物を承認済みです</h2>
          <p className="muted">ご確認ありがとうございました。続いて契約・お支払いのお手続きをお願いします。</p>
        </section>
      )}
    </main>
  );
}
