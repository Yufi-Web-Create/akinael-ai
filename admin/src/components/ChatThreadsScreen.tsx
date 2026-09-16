import type { Overview } from "../lib/types";

export default function ChatThreadsScreen({ overview, onOpen }: { overview: Overview; onOpen: (projectId: string) => void }) {
  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">AIチャット</span>
        <h1>司令塔AIチャット</h1>
        <p className="muted">案件を選ぶと、その案件専用のAIチャットに入れます。</p>
      </header>
      <div className="thread-list">
        {overview.projects.map((project) => (
          <article key={project.id} className="card registered action-card" onClick={() => onOpen(project.id)}>
            <div>
              <strong>{project.name}</strong>
              <p className="muted" style={{ margin: 0 }}>{project.customer_name || "顧客未設定"}</p>
            </div>
          </article>
        ))}
        {overview.projects.length === 0 && <p className="muted">案件がまだありません。</p>}
      </div>
    </main>
  );
}
