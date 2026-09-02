import { FormEvent, useCallback, useEffect, useState } from "react";

type Project = { id: string; name: string; plan?: string };
type Production = {
  workflows?: Array<{ status?: string }>;
  tasks?: Array<{ status: string }>;
  artifacts?: Array<{ id: string; kind: string; title?: string; content_text?: string; preview_url?: string }>;
};
type Item = { id: string; title?: string; body?: string; content?: string; status?: string; author_type?: string };

const core = import.meta.env.VITE_CORE_API_URL || "https://akinael-ai.com";
const tokenKey = "customer-token";

export default function Portal() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{ onboardingRequired?: boolean } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [requests, setRequests] = useState<Item[]>([]);
  const [messages, setMessages] = useState<Item[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const headers = useCallback((value = token): Record<string, string> => value ? { authorization: `Bearer ${value}` } : {}, [token]);
  const refresh = useCallback(async (value = token) => {
    if (!value) return;
    const authHeaders = { authorization: `Bearer ${value}` };
    const meResponse = await fetch(`${core}/api/v2/auth/me`, { headers: authHeaders });
    if (!meResponse.ok) throw Error("セッションの有効期限が切れています。再度ログインしてください。");
    setMe(await meResponse.json());
    const projectResponse = await fetch(`${core}/api/v2/projects`, { headers: authHeaders });
    if (!projectResponse.ok) throw Error("案件を取得できませんでした");
    const list = await projectResponse.json();
    setProjects(list);
    if (!list[0]) return;
    const id = list[0].id;
    const [productionResponse, requestResponse, messageResponse] = await Promise.all([
      fetch(`${core}/api/v2/projects/${id}/production`, { headers: authHeaders }),
      fetch(`${core}/api/v2/projects/${id}/requests`, { headers: authHeaders }),
      fetch(`${core}/api/v2/projects/${id}/messages`, { headers: authHeaders })
    ]);
    setProduction(productionResponse.ok ? await productionResponse.json() : null);
    setRequests(requestResponse.ok ? await requestResponse.json() : []);
    setMessages(messageResponse.ok ? await messageResponse.json() : []);
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem(tokenKey);
    setToken(stored);
    if (stored) refresh(stored).catch((caught) => {
      localStorage.removeItem(tokenKey);
      setToken(null);
      setError(caught.message);
    });
  }, [refresh]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${core}/api/v2/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data?.error?.message || "認証に失敗しました");
      if (data.confirmationRequired) {
        setNotice("確認メールを開き、確認後にログインしてください。");
        return;
      }
      localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      await refresh(data.token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "認証に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const onboard = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${core}/api/v2/onboarding`, {
        method: "POST",
        headers: { ...headers(), "content-type": "application/json" },
        body: JSON.stringify({ displayName, businessName, consent })
      });
      if (!response.ok) throw Error("プロフィールを保存できませんでした");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${core}/api/v2/projects`, {
        method: "POST",
        headers: { ...headers(), "content-type": "application/json" },
        body: JSON.stringify({ name: projectName })
      });
      if (!response.ok) throw Error("案件を作成できませんでした");
      setProjectName("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "案件作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const send = async (kind: "request" | "message" | "approval") => {
    const project = projects[0];
    if (!project || !token || !draft.trim()) return;
    setBusy(true);
    try {
      const isRequest = kind === "request";
      const response = await fetch(`${core}/api/v2/projects/${project.id}/${isRequest ? "requests" : "messages"}`, {
        method: "POST",
        headers: { ...headers(), "content-type": "application/json" },
        body: JSON.stringify(isRequest
          ? { type: "general", title: draft.slice(0, 80), body: draft, priority: "normal" }
          : { content: kind === "approval" ? `承認: ${draft}` : draft, requestId: requests[0]?.id })
      });
      if (!response.ok) throw Error("送信できませんでした");
      setDraft("");
      await refresh();
      if (kind === "approval") setNotice("承認内容を記録しました。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (token) await fetch(`${core}/api/v2/auth/logout`, { method: "POST", headers: headers() }).catch(() => {});
    localStorage.removeItem(tokenKey);
    setToken(null);
    setMe(null);
    setProjects([]);
  };

  const project = projects[0];
  return <main>
    <header><div><span className="eyebrow">CUSTOMER PORTAL</span><h1>相談の続きから、<br />制作の今を確認できます。</h1></div>{token ? <button type="button" onClick={logout}>ログアウト</button> : <span className="status">お客様専用</span>}</header>
    {error && <section className="card error" role="alert"><p>{error}</p></section>}
    {notice && <section className="card notice" role="status"><p>{notice}</p></section>}
    {!token ? <section className="card auth">
      <span className="eyebrow">AUTHENTICATION</span><h2>ログイン</h2>
      <form onSubmit={authenticate}>
        <label className="fieldLabel" htmlFor="email">メールアドレス</label><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="fieldLabel" htmlFor="password">パスワード</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
        <button disabled={busy} type="submit">{busy ? "処理中…" : "ログイン"}</button>
      </form>
      <p className="muted">新規登録と相談受付は現在停止しています。</p>
    </section> : me?.onboardingRequired ? <section className="card auth">
      <span className="eyebrow">ONBOARDING</span><h2>プロフィールを登録</h2>
      <form onSubmit={onboard}>
        <label className="fieldLabel" htmlFor="display-name">お名前</label><input id="display-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        <label className="fieldLabel" htmlFor="business-name">店舗名・会社名</label><input id="business-name" autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
        <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> 現行の<a href="/legal#terms" target="_blank" rel="noreferrer">利用規約</a>と<a href="/legal#privacy" target="_blank" rel="noreferrer">プライバシーポリシー</a>に同意します</label>
        <button disabled={busy}>保存して進む</button>
      </form>
    </section> : <>
      <section className="grid"><article className="card"><span className="eyebrow">PROJECT</span>{project ? <><h2>{project.name}</h2><p className="muted">プラン：{project.plan || "ご相談受付中"}</p></> : <><h2>案件を作成</h2><form onSubmit={createProject}><label className="fieldLabel" htmlFor="project-name">案件名</label><input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} required /><button disabled={busy}>案件を作成する</button></form></>}</article><article className="card"><span className="eyebrow">PRODUCTION</span><h2>{production?.workflows?.[0]?.status || "制作状況を確認中"}</h2><p className="muted">完了タスク：{production?.tasks?.filter((task) => task.status === "completed").length || 0}件 ／ 成果物：{production?.artifacts?.length || 0}件</p></article></section>
      {project && <><section className="card"><span className="eyebrow">ARTIFACT PREVIEW</span><h2>制作物プレビュー</h2>{production?.artifacts?.length ? <div className="artifacts">{production.artifacts.map((artifact) => <article key={artifact.id}><strong>{artifact.title || artifact.kind}</strong>{artifact.preview_url ? <a href={artifact.preview_url} target="_blank" rel="noreferrer">プレビューを開く</a> : <span className="muted">プレビュー準備中</span>}</article>)}</div> : <p className="muted">制作物はまだありません。</p>}</section>
        <section className="card"><span className="eyebrow">REQUEST / MESSAGE</span><h2>相談を送る</h2><label className="fieldLabel" htmlFor="consultation-draft">相談内容</label><textarea id="consultation-draft" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} /><div><button disabled={busy || !draft.trim()} onClick={() => send("request")}>新しい依頼を送る</button><button disabled={busy || !draft.trim()} onClick={() => send("message")}>メッセージを送る</button><button disabled={busy || !draft.trim()} onClick={() => send("approval")}>この内容で承認する</button></div></section>
        <section className="grid"><article className="card"><h2>相談履歴</h2>{requests.length ? requests.map((request) => <p key={request.id}><span className="status">{request.status || "受付済み"}</span> {request.title || request.body}</p>) : <p className="muted">まだ相談はありません。</p>}</article><article className="card"><h2>メッセージ</h2>{messages.length ? messages.slice(-8).map((message) => <p key={message.id}><b>{message.author_type || "customer"}</b>：{message.content}</p>) : <p className="muted">メッセージはまだありません。</p>}</article></section></>}
    </>}
  </main>;
}
