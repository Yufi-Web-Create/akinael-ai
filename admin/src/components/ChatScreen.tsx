import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/types";

export default function ChatScreen({
  projectName,
  messages,
  instruction,
  busy,
  onSend
}: {
  projectName: string;
  messages: ChatMessage[];
  instruction: boolean;
  busy: boolean;
  onSend: (content: string, createRequest: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, busy]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text, instruction);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <main className="screen chat-screen">
      <header style={{ marginBottom: 12 }}>
        <span className="eyebrow">AIチャット</span>
        <h1 style={{ fontSize: 26 }}>{projectName}</h1>
        {instruction && <p className="muted">この発言は制作依頼として登録されます。</p>}
      </header>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="muted">この案件についてAIに聞いてみましょう。</p>}
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea aria-label="メッセージ" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} disabled={busy} />
        <button type="submit" className="btn" disabled={busy || !draft.trim()}>送信</button>
      </form>
      <p className="muted small" style={{ marginTop: 6 }}>Enterで改行、⌘/Ctrl + Enterで送信できます。</p>
    </main>
  );
}
