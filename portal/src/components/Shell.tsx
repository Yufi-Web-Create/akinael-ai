import { useState } from "react";
import { Home, MessageCircle, ClipboardCheck, LayoutGrid, CreditCard, Settings, MoreHorizontal, LogOut } from "lucide-react";
import type { Screen } from "../lib/types";

type NavItem = { id: Screen; label: string; icon: typeof Home };

const PRIMARY: NavItem[] = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "chat", label: "AIに相談", icon: MessageCircle },
  { id: "summary", label: "相談内容", icon: ClipboardCheck },
  { id: "works", label: "制作物", icon: LayoutGrid }
];
const SECONDARY: NavItem[] = [
  { id: "plan", label: "プラン・お支払い", icon: CreditCard },
  { id: "settings", label: "設定", icon: Settings }
];

export default function Shell({
  screen,
  onNavigate,
  summaryUnread,
  worksUnread,
  onLogout,
  children
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  summaryUnread: boolean;
  worksUnread: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = (id: Screen) => (id === "summary" && summaryUnread) || (id === "works" && worksUnread);

  const navButton = (item: NavItem, variant: "side" | "tab") => {
    const Icon = item.icon;
    const active = screen === item.id;
    return (
      <button
        key={item.id}
        type="button"
        className={variant === "side" ? `nav-item${active ? " active" : ""}` : `${active ? "active" : ""}`}
        onClick={() => {
          onNavigate(item.id);
          setMoreOpen(false);
        }}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={variant === "side" ? 18 : 20} aria-hidden />
        <span>{item.label}</span>
        {unread(item.id) && <i className="dot" aria-label="未確認あり" />}
      </button>
    );
  };

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">アキナエルAI</div>
        <nav aria-label="メインメニュー">
          {[...PRIMARY, ...SECONDARY].map((item) => navButton(item, "side"))}
        </nav>
        <button type="button" className="nav-item logout" onClick={onLogout}>
          <LogOut size={18} aria-hidden />
          <span>ログアウト</span>
        </button>
      </aside>
      <div className="main-area">{children}</div>
      <nav className="tab-bar" aria-label="メインメニュー（モバイル）">
        <div className="tab-bar-inner">
          {PRIMARY.map((item) => navButton(item, "tab"))}
          <button type="button" className={moreOpen ? "active" : ""} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
            <MoreHorizontal size={20} aria-hidden />
            <span>その他</span>
          </button>
        </div>
      </nav>
      {moreOpen && (
        <div className="more-sheet" role="menu">
          {SECONDARY.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              onClick={() => {
                onNavigate(item.id);
                setMoreOpen(false);
              }}
            >
              <item.icon size={18} aria-hidden />
              <span>{item.label}</span>
            </button>
          ))}
          <button type="button" className="nav-item" onClick={onLogout}>
            <LogOut size={18} aria-hidden />
            <span>ログアウト</span>
          </button>
        </div>
      )}
    </div>
  );
}
