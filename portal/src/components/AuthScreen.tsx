import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { api, ApiError, TOKEN_KEY } from "../lib/api";

type Props = {
  recoveryMode: boolean;
  recoveryToken: string | null;
  authError?: string;
  onAuthenticated: (token: string) => Promise<void>;
  onRecoveryDone: () => void;
  onRequestRecoveryMode: () => void;
  onPasswordUpdated: () => void;
};

export default function AuthScreen({
  recoveryMode,
  recoveryToken,
  authError = "",
  onAuthenticated,
  onRecoveryDone,
  onRequestRecoveryMode,
  onPasswordUpdated
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, result.token);
      await onAuthenticated(result.token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "認証に失敗しました。");
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
        <Sparkles size={28} color="var(--color-accent)" aria-hidden />
        <h1 style={{ fontSize: 28 }}>アキナエルAI</h1>
        <p className="muted">お客様マイページ</p>
      </header>
      {(error || authError) && <section className="card error card-in">{error || authError}</section>}
      {notice && <section className="card notice card-in">{notice}</section>}

      {recoveryMode ? (
        <section className="card card-in">
          <span className="eyebrow">PASSWORD RECOVERY</span>
          <h2>{recoveryToken ? "新しいパスワード" : "パスワード再設定"}</h2>
          <p className="muted">
            {recoveryToken ? "12文字以上の新しいパスワードを設定します。" : "登録済みメールアドレスへ安全な回復リンクを送信します。"}
          </p>
          {recoveryToken ? (
            <form onSubmit={updatePassword}>
              <label>
                新しいパスワード
                <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
              </label>
              <label>
                新しいパスワード（確認）
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} required />
              </label>
              <button className="btn" disabled={busy} type="submit">{busy ? "更新中…" : "パスワードを更新"}</button>
            </form>
          ) : (
            <form onSubmit={requestRecovery}>
              <label>
                メールアドレス
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button className="btn" disabled={busy} type="submit">{busy ? "送信中…" : "再設定メールを送信"}</button>
            </form>
          )}
          <button
            type="button"
            className="btn link"
            onClick={() => {
              window.history.replaceState({}, "", "/portal/");
              onRecoveryDone();
              setError("");
              setNotice("");
            }}
          >
            ログインへ戻る
          </button>
        </section>
      ) : (
        <section className="card card-in">
          <span className="eyebrow">AUTHENTICATION</span>
          <h2>ログイン</h2>
          <form onSubmit={submitAuth}>
            <label>
              メールアドレス
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              パスワード（12文字以上）
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
            </label>
            <button className="btn" disabled={busy} type="submit">{busy ? "処理中…" : "ログイン"}</button>
          </form>
          <div className="auth-secondary-links">
            <a className="btn link" href="/#register">新規アカウント登録はこちら</a>
            <button
              type="button"
              className="btn link"
              onClick={() => {
                window.history.replaceState({}, "", "/portal/?mode=recovery");
                setError("");
                setNotice("");
                onRequestRecoveryMode();
              }}
            >
              パスワードを忘れた方
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
