import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import Admin from "./Admin";

const tokenKey = "akinael-admin-token";

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) }) as unknown as Promise<Response>;

const setUrl = (path: string) => window.history.pushState({}, "", path);

beforeEach(() => {
  localStorage.clear();
  setUrl("/admin/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("stale-session recovery access", () => {
  test("a stale but valid session does not block the password-recovery UI", async () => {
    localStorage.setItem(tokenKey, "stale-admin-session-token");
    setUrl("/admin/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ profile: { role: "admin", displayName: "管理者" }, user: { email: "owner@example.com" } });
        }
        throw new Error(`unexpected fetch during recovery: ${url}`);
      })
    );

    render(<Admin />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());
  });

  test("a successful password reset clears the stale session and returns to the normal login form", async () => {
    localStorage.setItem(tokenKey, "stale-admin-session-token");
    setUrl("/admin/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url.includes("/api/v2/auth/password") && options?.method === "POST") return jsonResponse({ passwordUpdated: true });
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<Admin />);
    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "a-very-long-password-123" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "a-very-long-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを更新" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "管理者ログイン" })).toBeTruthy());
    expect(localStorage.getItem(tokenKey)).toBeNull();
  });
});

describe("normal login regression", () => {
  test("a fresh admin login reaches the Home screen with real overview/customer data, not mock data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/v2/auth/login")) return jsonResponse({ token: "real-token" });
        if (url.includes("/api/v2/auth/me")) return jsonResponse({ profile: { role: "admin", displayName: "管理者" }, user: { email: "owner@example.com" } });
        if (url.includes("/api/v2/admin/overview")) {
          return jsonResponse({
            summary: { customers: 1, projects: 1, needsAttention: 1, runningWorkflows: 0, failedTasks: 0, pendingApprovals: 0 },
            projects: [{ id: "p1", name: "山田商店サイト制作", status: "production", customer_name: "山田商店", needs_attention: true, attention_reasons: ["quality_check_failed"] }],
            recentWorkflows: [],
            recentNotifications: []
          });
        }
        if (url.includes("/api/v2/admin/customers")) return jsonResponse([{ id: "c1", name: "山田商店", plan_id: "mini", projectCount: 1, needsAttention: true }]);
        if (url.includes("/api/v2/pricing")) return jsonResponse({ currency: "JPY", taxIncluded: true, plans: { mini: { name: "本契約ミニ", monthlyAmount: 3980 } } });
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<Admin />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "a-very-long-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "管理画面へ" }));

    await waitFor(() => expect(screen.getByText("山田商店サイト制作")).toBeTruthy());
    expect(screen.getByText("内容を確認し、次の対応を判断してください")).toBeTruthy();
    for (const forbidden of ["needs_attention", "Human Gate", "workflow_run"]) {
      expect(document.body.textContent || "").not.toContain(forbidden);
    }
  });
});

describe("commander AI chat", () => {
  test("loads the dedicated admin chat and does not send on Enter alone", async () => {
    localStorage.setItem(tokenKey, "real-token");
    const detail = {
      project: { id: "p1", name: "山田商店サイト制作", status: "production", customer_name: "山田商店" },
      customer: { id: "c1", name: "山田商店" },
      requests: [], messages: [], workflows: [], tasks: [], artifacts: [], qualityChecks: [], approvals: [], payments: [], repositories: [], deployments: [], notifications: [], auditLogs: [],
      deploymentGate: { releasePassed: false, customerApproved: false, deployReady: false, humanGateRequired: false, productionPublished: false }
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.includes("/api/v2/auth/me")) return jsonResponse({ profile: { role: "admin", displayName: "管理者" }, user: { email: "owner@example.com" } });
      if (url.includes("/api/v2/admin/overview")) return jsonResponse({ summary: { customers: 1, projects: 1, needsAttention: 0, runningWorkflows: 0, failedTasks: 0, pendingApprovals: 0 }, projects: [detail.project], recentWorkflows: [], recentNotifications: [] });
      if (url.endsWith("/api/v2/admin/projects/p1")) return jsonResponse(detail);
      if (url.endsWith("/api/v2/admin/projects/p1/chat") && !options?.method) return jsonResponse([{ id: "m1", role: "assistant", content: "何を確認しましょうか？", createdAt: "2026-09-17T00:00:00+09:00" }]);
      if (url.endsWith("/api/v2/admin/projects/p1/chat/messages") && options?.method === "POST") return jsonResponse({ reply: { id: "m2", role: "assistant", content: "確認しました。", createdAt: "2026-09-17T00:01:00+09:00" }, createdRequest: null });
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Admin />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "ホーム" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "AIチャット" }));
    fireEvent.click(screen.getByText("山田商店サイト制作"));

    const input = await screen.findByLabelText("司令塔AIへの相談");
    await waitFor(() => expect(screen.getByText("何を確認しましょうか？")).toBeTruthy());
    fireEvent.change(input, { target: { value: "進捗を教えて" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/chat/messages") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(0);

    fireEvent.keyDown(input, { key: "Enter", code: "Enter", ctrlKey: true });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith("/chat/messages") && (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1));
  });
});
