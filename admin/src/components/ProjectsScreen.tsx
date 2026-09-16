import { useMemo, useState } from "react";
import type { AdminProjectStatus, Overview, Row } from "../lib/types";
import { projectListStatus, STATUS_TONE } from "../lib/adapters";

const FILTERS: { id: AdminProjectStatus | "all"; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "needs_admin", label: "判断待ち" },
  { id: "in_progress", label: "制作中" },
  { id: "needs_customer", label: "お客様確認待ち" },
  { id: "done", label: "完了" },
  { id: "new", label: "新規相談" }
];

function latestWorkflowByProject(recentWorkflows: Row[]): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const workflow of recentWorkflows) {
    const projectId = workflow.project_id as string | undefined;
    if (projectId && !map.has(projectId)) map.set(projectId, workflow);
  }
  return map;
}

export default function ProjectsScreen({ overview, onOpen }: { overview: Overview; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<AdminProjectStatus | "all">("all");
  const workflowByProject = useMemo(() => latestWorkflowByProject(overview.recentWorkflows), [overview.recentWorkflows]);
  const rows = useMemo(
    () => overview.projects.map((project) => ({ project, ...projectListStatus(project, workflowByProject.get(project.id)) })),
    [overview.projects, workflowByProject]
  );
  const filtered = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">PROJECTS</span>
        <h1>案件</h1>
      </header>

      <div className="search-row" role="tablist" aria-label="案件フィルタ">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" className={`filter-chip${filter === item.id ? " active" : ""}`} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>案件名</th>
            <th>顧客</th>
            <th>状態</th>
            <th>今やること</th>
            <th>最終更新</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ project, label, nextAction, status }) => (
            <tr key={project.id} onClick={() => onOpen(project.id)} style={{ cursor: "pointer" }}>
              <td>{project.name}</td>
              <td>{project.customer_name || "顧客未設定"}</td>
              <td><span className={`tag ${STATUS_TONE[status]}`}>{label}</span></td>
              <td>{nextAction}</td>
              <td>{project.updated_at ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(project.updated_at)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card-list">
        {filtered.map(({ project, label, nextAction, status }) => (
          <article key={project.id} className="card" onClick={() => onOpen(project.id)}>
            <strong>{project.name}</strong>
            <span className="muted">{project.customer_name || "顧客未設定"}</span>
            <span className={`tag ${STATUS_TONE[status]}`}>{label}</span>
            <span className="muted">{nextAction}</span>
          </article>
        ))}
      </div>
      {filtered.length === 0 && <p className="muted">該当する案件はありません。</p>}
    </main>
  );
}
