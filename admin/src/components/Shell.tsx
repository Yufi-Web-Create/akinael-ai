import { useState } from "react";
import { Home, Users, Briefcase, MessageSquare, LayoutGrid, CreditCard, Settings, Menu, X, LogOut } from "lucide-react";
import type { Screen } from "../lib/types";

type NavItem = { id: Screen; label: string; icon: typeof Home };

const NAV: NavItem[] = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "customers", label: "顧客", icon: Users },
  { id: "projects", label: "案件", icon: Briefcase },
  { id: "chatThreads", label: "AIチャット", icon: MessageSquare },
  { id: "works", label: "制作物", icon: LayoutGrid },
  { id: "billing", label: "契約・料金", icon: CreditCard },
  { id: "settings", label: "設定", icon: Settings }
];

const GROUP_OF: Partial<Record<Screen, Screen>> = { customerDetail: "customers", projectDetail: "projects", chat: "chatThreads", consultationLog: "projects" };

export default function Shell({
  screen,
  onNavigate,
  onLogout,
  operatorName,
  children
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  operatorName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeGroup = GROUP_OF[screen] || screen;

  const navButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeGroup === item.id;
    return (
      <button
        key={item.id}
        type="button"
        className={`nav-item${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          onNavigate(item.id);
          setMobileOpen(false);
        }}
      >
        <Icon size={18} aria-hidden />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">AKINAEL / OPS</div>
        <nav aria-label="メインメニュー">{NAV.map(navButton)}</nav>
        <div className="logout">
          <p className="muted" style={{ margin: "0 0 8px", color: "#d8d9da" }}>{operatorName}</p>
          <button type="button" className="nav-item" onClick={onLogout}>
            <LogOut size={16} aria-hidden />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      <div className="mobile-topbar">
        <span className="brand">AKINAEL / OPS</span>
        <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-expanded={mobileOpen} aria-label="メニュー">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <nav className={`mobile-nav-sheet${mobileOpen ? " open" : ""}`} aria-label="メインメニュー（モバイル）">
        {NAV.map(navButton)}
        <button type="button" className="nav-item" onClick={onLogout}>
          <LogOut size={16} aria-hidden />
          <span>ログアウト</span>
        </button>
      </nav>

      <div className="main-area">{children}</div>
    </div>
  );
}
