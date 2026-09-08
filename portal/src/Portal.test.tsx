import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import Portal from "./Portal";

const tokenKey = "customer-token";

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
  setUrl("/portal/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("stale-session recovery access", () => {
  test("a stale but valid session does not block the password-recovery UI", async () => {
    localStorage.setItem(tokenKey, "stale-portal-session-token");
    setUrl("/portal/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ onboardingRequired: false });
        }
        if (url.includes("/api/v2/projects")) {
          return jsonResponse([]);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    render(<Portal />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());
    expect(screen.queryByText("案件を作成")).toBeNull();
    expect(screen.queryByText("プロフィールを登録")).toBeNull();
  });

  test("recovery mode with no access_token hash shows the recovery-request form, not the update form", () => {
    setUrl("/portal/?mode=recovery");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("fetch should not be called without a stored token"); }));

    render(<Portal />);

    expect(screen.getByRole("heading", { name: "パスワード再設定" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "新しいパスワード" })).toBeNull();
  });
});

describe("password reset clears any prior session", () => {
  test("a successful reset logs out the stale session instead of falling into the dashboard", async () => {
    localStorage.setItem(tokenKey, "stale-portal-session-token");
    setUrl("/portal/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    const loggedOutUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ onboardingRequired: false });
        }
        if (url.includes("/api/v2/projects") && (!init || init.method === undefined)) {
          return jsonResponse([]);
        }
        if (url.includes("/api/v2/auth/password") && init?.method === "POST") {
          return jsonResponse({ passwordUpdated: true });
        }
        if (url.includes("/api/v2/auth/logout")) {
          loggedOutUrls.push(url);
          return jsonResponse({ ok: true });
        }
        throw new Error(`unexpected fetch: ${url} ${init?.method || "GET"}`);
      }),
    );

    render(<Portal />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());

    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "a-new-secure-password" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "a-new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを更新" }));

    await waitFor(() => expect(screen.getByText("パスワードを更新しました。新しいパスワードでログインしてください。")).toBeTruthy());

    expect(localStorage.getItem(tokenKey)).toBeNull();
    expect(loggedOutUrls.length).toBe(1);
    expect(screen.getByRole("heading", { name: "ログイン" })).toBeTruthy();
    expect(screen.queryByText("案件を作成")).toBeNull();
  });
});

describe("normal login regression", () => {
  test("logging in without any recovery context still reaches the dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/api/v2/auth/login") && init?.method === "POST") {
          return jsonResponse({ token: "fresh-login-token" });
        }
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ onboardingRequired: false });
        }
        if (url.includes("/api/v2/projects")) {
          return jsonResponse([]);
        }
        throw new Error(`unexpected fetch: ${url} ${init?.method || "GET"}`);
      }),
    );

    render(<Portal />);

    expect(screen.getByRole("heading", { name: "ログイン" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "customer@example.com" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "a-valid-password" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(localStorage.getItem(tokenKey)).toBe("fresh-login-token"));
    await waitFor(() => expect(screen.getByText("案件を作成")).toBeTruthy());
  });
});
