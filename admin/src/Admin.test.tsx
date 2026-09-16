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
