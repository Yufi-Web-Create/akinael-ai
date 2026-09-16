import type { CustomerRow, ProjectRow } from "../lib/types";

export default function CustomerDetailScreen({
  customer,
  projects,
  onOpenProject,
  onOpenConsultationLog
}: {
  customer: CustomerRow;
  projects: ProjectRow[];
  onOpenProject: (id: string) => void;
  onOpenConsultationLog: (id: string) => void;
}) {
  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">CUSTOMER</span>
        <h1>{customer.name}</h1>
      </header>

      <div className="panel-grid" style={{ marginBottom: 16 }}>
        <article className="card registered">
          <h2>基本情報</h2>
          <p className="muted">顧客ID: {customer.id}</p>
        </article>
        <article className="card registered">
          <h2>契約</h2>
          <p className="muted">プラン: {customer.plan_id || "未設定"}</p>
          <p className="muted">案件数: {customer.projectCount}件</p>
        </article>
      </div>

      <h2>案件</h2>
      <div className="action-list">
        {projects.map((project) => (
          <article key={project.id} className="card registered action-card" onClick={() => onOpenProject(project.id)}>
            <div>
              <strong>{project.name}</strong>
              <p className="muted" style={{ margin: 0 }}>状態: {project.status}</p>
            </div>
          </article>
        ))}
        {projects.length === 0 && <p className="muted">案件はまだありません。</p>}
      </div>

      {projects[0] && (
        <button type="button" className="btn link" onClick={() => onOpenConsultationLog(projects[0].id)}>
          過去の相談を見る
        </button>
      )}
    </main>
  );
}
