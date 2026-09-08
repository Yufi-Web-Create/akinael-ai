import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import Admin from "./Admin";

const tokenKey = "akinael-admin-token";

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  }) as unknown as Promise<Response>;

const setUrl = (path: string) => {
  window.history.pushState({}, "", path);
};

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
        if (url.includes("/api/v2/admin/overview")) {
          return jsonResponse({ summary: {}, projects: [], recentWorkflows: [], recentNotifications: [] });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    render(<Admin />);

    // The stale session's background load() resolves successfully (role: admin),
    // which is exactly the condition that let it silently win over recoveryMode
    // before this fix.
    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());
    expect(screen.queryByText("運用ダッシュボード")).toBeNull();
  });

  test("no stale session still reaches the recovery-request UI as before", () => {
    setUrl("/admin/?mode=recovery");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("fetch should not be called without a stored token"); }));

    render(<Admin />);

    expect(screen.getByRole("heading", { name: "パスワード再設定" })).toBeTruthy();
  });
});

describe("password reset clears any prior session", () => {
  test("a successful reset logs out the stale session instead of falling into the dashboard", async () => {
    localStorage.setItem(tokenKey, "stale-admin-session-token");
    setUrl("/admin/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    const loggedOutUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ profile: { role: "admin", displayName: "管理者" }, user: { email: "owner@example.com" } });
        }
        if (url.includes("/api/v2/admin/overview")) {
          return jsonResponse({ summary: {}, projects: [], recentWorkflows: [], recentNotifications: [] });
        }
        if (url.includes("/api/v2/auth/password") && init?.method === "POST") {
          return jsonResponse({ passwordUpdated: true });
        }
        if (url.includes("/api/v2/auth/logout")) {
          loggedOutUrls.push(url);
          return jsonResponse({ ok: true });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    render(<Admin />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());

    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "a-new-secure-password" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "a-new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを更新" }));

    await waitFor(() => expect(screen.getByText("パスワードを更新しました。新しいパスワードでログインしてください。")).toBeTruthy());

    expect(localStorage.getItem(tokenKey)).toBeNull();
    expect(loggedOutUrls.length).toBe(1);
    expect(screen.getByRole("heading", { name: "管理者ログイン" })).toBeTruthy();
  });
});
