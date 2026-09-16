import { FormEvent, useState } from "react";
import { api, ApiError } from "../lib/api";

export default function OnboardingScreen({ token, onDone }: { token: string; onDone: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.onboard(token, displayName, businessName);
      await onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="card card-in">
        <span className="eyebrow">ONBOARDING</span>
        <h2>プロフィールを登録</h2>
        <p className="muted">はじめに、お名前と店舗名・会社名を教えてください。</p>
        {error && <p className="card error">{error}</p>}
        <form onSubmit={submit}>
          <label>
            お名前
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            店舗名・会社名
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </label>
          <button className="btn" disabled={busy} type="submit">保存して進む</button>
        </form>
      </section>
    </main>
  );
}
