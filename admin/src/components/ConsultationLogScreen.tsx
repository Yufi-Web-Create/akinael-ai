import type { ChatMessage } from "../lib/types";

export default function ConsultationLogScreen({
  projectName,
  log,
  onAskChat
}: {
  projectName: string;
  log: ChatMessage[];
  onAskChat: () => void;
}) {
  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">お客様との相談ログ</span>
        <h1>{projectName}</h1>
      </header>

      <div className="chat-messages" style={{ height: "auto", maxHeight: "60vh" }}>
        {log.length === 0 && <p className="muted">まだ相談ログはありません。</p>}
        {log.map((message) => (
          <div key={message.id} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onAskChat}>
        この相談についてAIに聞く
      </button>
    </main>
  );
}
