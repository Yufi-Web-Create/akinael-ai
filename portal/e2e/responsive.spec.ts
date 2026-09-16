import { test, expect, type Page } from "@playwright/test";

// Real-browser regression coverage for the redesigned Customer Portal
// (claude-design-input/customer-portal/README.md): direct access, desktop/tablet/mobile
// responsive layout (sidebar vs. bottom tab bar), reload/session persistence, and
// console error 0.

const meResponse = {
  profile: { role: "customer", displayName: "山田" },
  user: { id: "u1", email: "customer@example.com" },
  customer: { id: "c1", name: "山田商店" },
  onboardingRequired: false,
};

const mockAuthenticatedPortal = async (page: Page) => {
  await page.addInitScript(() => localStorage.setItem("customer-token", "fake-customer-token-for-e2e"));
  await page.route("**/api/v2/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(meResponse) }));
  await page.route("**/api/v2/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "p1", name: "山田商店のご相談" }]) }));
  await page.route("**/api/v2/projects/p1/requests", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/v2/projects/p1/production", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workflows: [], tasks: [], artifacts: [] }) }));
  await page.route("**/api/v2/projects/p1/consultation", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ threadId: null, finalized: false, finalizedRequestId: null, ready: false, summary: null, messages: [] }) }));
  await page.route("**/api/v2/pricing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ currency: "JPY", taxIncluded: true, plans: {}, websiteProduction: { name: "x", startingAmount: 0 }, instagramAds: { name: "y", feeRate: 0.2, minimumMonthlyFee: 5500 } }) }));
  await page.route("**/api/v2/billing/summary", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ currentPlan: null, billingPortalAvailable: false, notifyByEmail: true, history: [] }) }));
};

test("direct access to /portal/ with no session shows the login screen, not a blank page", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  await page.goto("/portal/");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  expect(consoleErrors).toHaveLength(0);
});

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`${label} (${viewport.width}x${viewport.height}): Home renders with the correct nav pattern, no horizontal overflow, console error 0`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.setViewportSize(viewport);
    await mockAuthenticatedPortal(page);
    await page.goto("/portal/");
    await expect(page.getByText("まずはAIに相談してみましょう")).toBeVisible();

    const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    if (viewport.width <= 860) {
      await expect(page.locator(".side-nav")).toBeHidden();
      await expect(page.locator(".tab-bar")).toBeVisible();
    } else {
      await expect(page.locator(".side-nav")).toBeVisible();
      await expect(page.locator(".tab-bar")).toBeHidden();
    }

    // Reload must keep the session (Supabase-token-backed) instead of bouncing to login.
    await page.reload();
    await expect(page.getByText("まずはAIに相談してみましょう")).toBeVisible();

    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
  });
}
