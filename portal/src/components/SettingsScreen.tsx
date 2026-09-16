import { FormEvent, useState } from "react";
import type { Me } from "../lib/types";
import { api, ApiError } from "../lib/api";

export default function SettingsScreen({
  token,
  me,
  onSaved,
  onLogout
}: {
  token: string;
  me: Me;
  onSaved: () => Promise<void>;
  onLogout: () => void;
}) {
  const [displayName, setDisplayName] = useState(me.profile?.displayName || "");
  const [businessName, setBusinessName] = useState(me.customer?.name || "");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api.updateAccount(token, { displayName, businessName, notifyByEmail });
      await onSaved();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3200);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!me.user.email) return;
    setBusy(true);
    setError("");
    try {
      await api.requestPasswordRecovery(me.user.email);
      setRecoverySent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">設定</span>
        <h1>設定</h1>
      </header>

      {error && <section className="card error card-in">{error}</section>}

      <form className="settings-form card card-in" onSubmit={save}>
        <label>
          お名前
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        <label>
          店舗名・会社名
          <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
        </label>
        <label>
          メールアドレス
          <input value={me.user.email || ""} disabled />
        </label>
        <div className="toggle-row">
          <span>メール通知</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <input
              type="checkbox"
              checked={notifyByEmail}
              onChange={(event) => setNotifyByEmail(event.target.checked)}
              style={{ width: "auto" }}
            />
            <span className="muted">{notifyByEmail ? "ON" : "OFF"}</span>
          </label>
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {saved ? "保存しました" : busy ? "保存中…" : "保存する"}
        </button>
      </form>

      <section className="card card-in" style={{ marginTop: 16 }}>
        <h2>パスワード変更</h2>
        <p className="muted">登録済みメールアドレスへパスワード再設定メールを送信します。</p>
        <button className="btn secondary" onClick={sendPasswordReset} disabled={busy}>
          {recoverySent ? "送信しました" : "再設定メールを送信"}
        </button>
      </section>

      <button type="button" className="btn link" style={{ marginTop: 20 }} onClick={onLogout}>
        ログアウト
      </button>
    </main>
  );
}
