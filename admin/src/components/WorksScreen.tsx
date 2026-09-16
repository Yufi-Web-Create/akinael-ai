import type { Overview, ProjectDetail } from "../lib/types";

const STATE_TAG: Record<string, { label: string; tone: string }> = {
  build_build: { label: "AI確認済み", tone: "accent" }
};

export default function WorksScreen({
  overview,
  selectedProjectId,
  detail,
  onSelect
}: {
  overview: Overview;
  selectedProjectId: string | null;
  detail: ProjectDetail | null;
  onSelect: (projectId: string) => void;
}) {
  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">WORKS</span>
        <h1>制作物</h1>
      </header>

      <div className="search-row">
        <select aria-label="案件を選択" value={selectedProjectId || ""} onChange={(event) => onSelect(event.target.value)}>
          <option value="" disabled>
            案件を選択してください
          </option>
          {overview.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {detail && (
        <div className="works-grid">
          {detail.artifacts.length === 0 && <p className="muted">この案件の成果物はまだありません。</p>}
          {detail.artifacts.map((artifact) => {
            const tag = STATE_TAG[artifact.kind as string] || { label: (artifact.preview_url as string) ? "お客様確認待ち" : "制作中", tone: "neutral" };
            return (
              <article key={artifact.id as string} className="card registered">
                <div className="work-preview">{(artifact.kind as string) || "artifact"}</div>
                <span className={`tag ${tag.tone}`}>{tag.label}</span>
                <h3>{(artifact.title as string) || (artifact.kind as string)}</h3>
                {(artifact.preview_url as string) && (
                  <a className="btn secondary" href={artifact.preview_url as string} target="_blank" rel="noreferrer">
                    プレビューを開く
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
