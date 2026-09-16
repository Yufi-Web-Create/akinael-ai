import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/types";

const SUGGESTIONS = ["Webサイト", "SNS", "チラシ", "集客", "何から始めればよいか"];

export default function ChatScreen({
  messages,
  chatContext,
  busy,
  ready,
  onSend,
  onGoToSummary
}: {
  messages: ChatMessage[];
  chatContext: string | null;
  busy: boolean;
  ready: boolean;
  onSend: (content: string) => void;
  onGoToSummary: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list && typeof list.scrollTo === "function") list.scrollTo({ top: list.scrollHeight });
  }, [messages.length, busy]);

  const send = (content: string) => {
    const text = content.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send(draft);
    }
  };

  return (
    <main className="screen chat-screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">AIに相談</span>
        <h1 style={{ fontSize: 26 }}>{chatContext ? `「${chatContext}」について相談する` : "アキナエルAIに相談する"}</h1>
      </header>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <>
            <div className="bubble assistant card-in">
              {chatContext
                ? `「${chatContext}」について、どこをどう変えたいか教えてください。`
                : "こんにちは。アキナエルAIです。どんなことでお困りですか？普段の言葉で大丈夫です。"}
            </div>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((item) => (
                <button key={item} type="button" className="chip" onClick={() => send(item)}>
                  {item}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role} card-in`}>
            {message.content}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant">
            <span className="typing-dots" aria-label="AIが入力中">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      {ready && (
        <section className="card notice card-in" style={{ marginBottom: 12 }}>
          <h3>相談内容がまとまりました</h3>
          <p className="muted">内容と料金をご確認ください。</p>
          <button className="btn" onClick={onGoToSummary}>
            内容を確認する
          </button>
        </section>
      )}

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <textarea
          aria-label="メッセージ"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="メッセージを入力…"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !draft.trim()}>
          送信
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 6 }}>Enterで改行、⌘/Ctrl + Enterで送信できます。</p>
    </main>
  );
}
