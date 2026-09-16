import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import App from "./App";

const tokenKey = "customer-token";

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) }) as unknown as Promise<Response>;

const setUrl = (path: string) => window.history.pushState({}, "", path);

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
    localStorage.setItem(tokenKey, "stale-customer-session-token");
    setUrl("/portal/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ profile: { role: "customer" }, user: { email: "customer@example.com" }, customer: { id: "c1", name: "山田商店" }, onboardingRequired: false });
        }
        throw new Error(`unexpected fetch during recovery: ${url}`);
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "新しいパスワード" })).toBeTruthy());
  });

  test("a successful password reset clears the stale session and returns to the normal login form", async () => {
    localStorage.setItem(tokenKey, "stale-customer-session-token");
    setUrl("/portal/?mode=recovery#access_token=fresh-recovery-token&type=recovery");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url.includes("/api/v2/auth/password") && options?.method === "POST") {
          return jsonResponse({ passwordUpdated: true });
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "a-very-long-password-123" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: "a-very-long-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "パスワードを更新" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "ログイン" })).toBeTruthy());
    expect(localStorage.getItem(tokenKey)).toBeNull();
  });
});

describe("normal login regression", () => {
  test("a fresh login reaches the Home screen with real production/consultation state, not mock data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url.includes("/api/v2/auth/login")) return jsonResponse({ token: "real-token" });
        if (url.includes("/api/v2/auth/me")) {
          return jsonResponse({ profile: { role: "customer", displayName: "山田" }, user: { id: "u1", email: "customer@example.com" }, customer: { id: "c1", name: "山田商店" }, onboardingRequired: false });
        }
        if (url.endsWith("/api/v2/projects") && (!options?.method || options.method === "GET")) {
          return jsonResponse([{ id: "p1", name: "山田商店のご相談" }]);
        }
        if (url.endsWith("/api/v2/projects/p1/requests")) return jsonResponse([]);
        if (url.endsWith("/api/v2/projects/p1/production")) return jsonResponse({ workflows: [], tasks: [], artifacts: [] });
        if (url.endsWith("/api/v2/projects/p1/consultation")) {
          return jsonResponse({ threadId: null, finalized: false, finalizedRequestId: null, ready: false, summary: null, messages: [] });
        }
        if (url.endsWith("/api/v2/pricing")) return jsonResponse({ currency: "JPY", taxIncluded: true, plans: {}, websiteProduction: { name: "x", startingAmount: 0 }, instagramAds: { name: "y", feeRate: 0.2, minimumMonthlyFee: 5500 } });
        if (url.endsWith("/api/v2/billing/summary")) return jsonResponse({ currentPlan: null, billingPortalAvailable: false, notifyByEmail: true, history: [] });
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "customer@example.com" } });
    fireEvent.change(screen.getByLabelText("パスワード（12文字以上）"), { target: { value: "a-very-long-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(screen.getByText("まずはAIに相談してみましょう")).toBeTruthy());
    // Internal system vocabulary must never reach the rendered customer screen.
    for (const forbidden of ["Workflow", "Task", "Human Gate", "deploy_ready"]) {
      expect(document.body.textContent || "").not.toContain(forbidden);
    }
  });
});
