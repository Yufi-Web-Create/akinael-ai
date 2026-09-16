import { FormEvent, useState } from "react";
import { api, ApiError, TOKEN_KEY } from "../lib/api";

type Props = {
  recoveryMode: boolean;
  recoveryToken: string | null;
  onAuthenticated: (token: string) => Promise<void>;
  onRecoveryDone: () => void;
  onRequestRecoveryMode: () => void;
  onPasswordUpdated: () => void;
};

export default function AuthScreen({ recoveryMode, recoveryToken, onAuthenticated, onRecoveryDone, onRequestRecoveryMode, onPasswordUpdated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.login(email, password);
      const who = await api.me(result.token);
      if (who.profile?.role !== "admin") throw new ApiError("管理者権限がありません。", 403);
      localStorage.setItem(TOKEN_KEY, result.token);
      await onAuthenticated(result.token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "ログインに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const requestRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.requestPasswordRecovery(email);
      setNotice("パスワード再設定メールを送信しました。メール内のリンクを開いてください。");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "再設定メールを送信できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password !== confirmPassword) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    if (!recoveryToken) {
      setError("回復リンクが無効です。再設定メールをもう一度送信してください。");
      return;
    }
    setBusy(true);
    try {
      await api.updatePassword(recoveryToken, password);
      onPasswordUpdated();
      setPassword("");
      setConfirmPassword("");
      setNotice("パスワードを更新しました。新しいパスワードでログインしてください。");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "パスワードを更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <header style={{ textAlign: "center", marginBottom: 24 }}>
        <p className="eyebrow">AKINAEL OPERATIONS</p>
        <h1>{recoveryMode ? (recoveryToken ? "新しいパスワード" : "パスワード再設定") : "管理者ログイン"}</h1>
        <p className="muted">{recoveryMode ? (recoveryToken ? "12文字以上の新しいパスワードを設定します。" : "登録済みメールアドレスへ安全な回復リンクを送信します。") : "Supabase Authで本人確認し、管理者ロールを検証します。"}</p>
      </header>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      {recoveryMode ? (
        recoveryToken ? (
          <form onSubmit={updatePassword}>
            <label>
              新しいパスワード
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
            </label>
            <label>
              新しいパスワード（確認）
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} required />
            </label>
            <button className="btn" disabled={busy}>{busy ? "更新中…" : "パスワードを更新"}</button>
          </form>
        ) : (
          <form onSubmit={requestRecovery}>
            <label>
              メールアドレス
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button className="btn" disabled={busy}>{busy ? "送信中…" : "再設定メールを送信"}</button>
          </form>
        )
      ) : (
        <form onSubmit={login}>
          <label>
            メールアドレス
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            パスワード
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
          </label>
          <button className="btn" disabled={busy}>{busy ? "認証中…" : "管理画面へ"}</button>
        </form>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        {recoveryMode ? (
          <button type="button" className="btn link" onClick={() => { window.history.replaceState({}, "", "/admin/"); onRecoveryDone(); setError(""); setNotice(""); }}>
            ログインへ戻る
          </button>
        ) : (
          <button type="button" className="btn link" onClick={() => { window.history.replaceState({}, "", "/admin/?mode=recovery"); onRequestRecoveryMode(); setError(""); setNotice(""); }}>
            パスワードを忘れた方
          </button>
        )}
        <a href="/portal/">Customer Portalへ</a>
      </div>
    </main>
  );
}
