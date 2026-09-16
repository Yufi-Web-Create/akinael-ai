import { useState } from "react";
import type { Me } from "../lib/types";

export default function SettingsScreen({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [showDeveloper, setShowDeveloper] = useState(false);

  return (
    <main className="screen">
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">設定</span>
        <h1>設定</h1>
      </header>

      <article className="card registered" style={{ marginBottom: 16 }}>
        <h2>基本情報</h2>
        <p className="muted">担当者: {me.profile?.displayName || "管理者"}</p>
        <p className="muted">メールアドレス: {me.user?.email}</p>
      </article>

      <article className="card registered" style={{ marginBottom: 16 }}>
        <h2>デザイン・運用ルール</h2>
        <p className="muted">
          このツールは案件・顧客・成果物を日本語の業務状態で表示します。公開・課金・返金・データ削除はオーナーの明示承認後にのみ実行します。
        </p>
      </article>

      <article className="card registered" style={{ marginBottom: 16 }}>
        <h2>担当者・権限</h2>
        <p className="muted">現在の権限: {me.profile?.role === "admin" ? "管理者" : "—"}</p>
      </article>

      <article className="card registered">
        <button type="button" className="btn link" onClick={() => setShowDeveloper((v) => !v)}>
          開発者向け情報{showDeveloper ? "を隠す" : "を表示"}
        </button>
        {showDeveloper && (
          <p className="muted" style={{ marginTop: 8 }}>
            この画面は通常運用では使用しません。案件の内部処理状況を確認する必要がある場合は、開発担当へご相談ください。
          </p>
        )}
      </article>

      <button type="button" className="btn link" style={{ marginTop: 20 }} onClick={onLogout}>
        ログアウト
      </button>
    </main>
  );
}
