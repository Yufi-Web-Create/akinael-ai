import { useMemo } from "react";
import type { Overview, Row } from "../lib/types";
import { projectListStatus, STATUS_TONE } from "../lib/adapters";

function latestWorkflowByProject(recentWorkflows: Row[]): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const workflow of recentWorkflows) {
    const projectId = workflow.project_id as string | undefined;
    if (projectId && !map.has(projectId)) map.set(projectId, workflow);
  }
  return map;
}

export default function HomeScreen({ overview, onOpenProject }: { overview: Overview; onOpenProject: (projectId: string) => void }) {
  const workflowByProject = useMemo(() => latestWorkflowByProject(overview.recentWorkflows), [overview.recentWorkflows]);
  const statuses = useMemo(
    () => overview.projects.map((project) => ({ project, ...projectListStatus(project, workflowByProject.get(project.id)) })),
    [overview.projects, workflowByProject]
  );
  const needsAdmin = statuses.filter((item) => item.status === "needs_admin");
  const tileCounts = {
    in_progress: statuses.filter((item) => item.status === "in_progress").length,
    needs_customer: statuses.filter((item) => item.status === "needs_customer").length,
    done: statuses.filter((item) => item.status === "done").length,
    new: statuses.filter((item) => item.status === "new").length
  };

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">HOME</span>
        <h1>ホーム</h1>
      </header>

      <section className="hero-card">
        <span className="eyebrow" style={{ color: "#c9d3dc" }}>対応が必要</span>
        <div className="count">{needsAdmin.length}</div>
        <p style={{ marginBottom: 0 }}>件の案件があなたの判断を待っています。</p>
      </section>

      <div className="action-list">
        {needsAdmin.length === 0 && (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>現在、判断が必要な案件はありません。</p>
          </div>
        )}
        {needsAdmin.map(({ project, label, nextAction }) => (
          <article key={project.id} className="card registered action-card" onClick={() => onOpenProject(project.id)}>
            <div>
              <span className={`tag ${STATUS_TONE.needs_admin}`}>{label}</span>
              <h3 style={{ marginTop: 8 }}>{project.name}</h3>
              <p className="muted" style={{ margin: 0 }}>{project.customer_name || "顧客未設定"} ・ {nextAction}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="stat-tiles">
        <article>
          <span>制作中</span>
          <strong>{tileCounts.in_progress}</strong>
        </article>
        <article>
          <span>お客様確認待ち</span>
          <strong>{tileCounts.needs_customer}</strong>
        </article>
        <article>
          <span>完了</span>
          <strong>{tileCounts.done}</strong>
        </article>
        <article>
          <span>新規相談</span>
          <strong>{tileCounts.new}</strong>
        </article>
      </div>
    </main>
  );
}
