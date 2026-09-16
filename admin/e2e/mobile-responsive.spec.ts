import { test, expect, type Page } from "@playwright/test";

// Regression coverage for the redesigned Admin console (Industry design system —
// claude-design-input/admin-console/README.md): no horizontal overflow, the desktop
// sidebar does not survive onto mobile as a pinned column, and the mobile top bar +
// nav sheet render instead. Rewritten for the new component structure (Shell.tsx /
// HomeScreen.tsx) after the full UI redesign replaced the previous single-file Admin.tsx
// this spec originally targeted (`.shell` / `.sidebar` / `.tabs` / `.panel-grid` no
// longer exist as top-level layout classes — see admin/src/styles/admin.css).

const overview = {
  summary: { customers: 3, projects: 5, needsAttention: 1, runningWorkflows: 2, failedTasks: 0, pendingApprovals: 1 },
  projects: [
    { id: "project-1", name: "E2E｜月灯り珈琲 新規サイト制作プロジェクト（長い案件名のテスト用）", status: "intake", customer_name: "月灯り珈琲株式会社", needs_attention: true, attention_reasons: ["承認待ち"] },
    { id: "project-2", name: "通常案件", status: "production", customer_name: "顧客B", needs_attention: false },
  ],
  recentWorkflows: [],
  recentNotifications: [],
};

const customers = [
  { id: "customer-1", name: "月灯り珈琲株式会社", plan_id: "mini", projectCount: 1, needsAttention: true },
];

const pricing = { currency: "JPY", taxIncluded: true, plans: { mini: { name: "本契約ミニ", monthlyAmount: 3980 } } };

const mockAuthenticatedDashboard = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("akinael-admin-token", "fake-admin-token-for-mobile-regression-test");
  });
  await page.route("**/api/v2/auth/me", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ profile: { role: "admin", displayName: "管理者" }, user: { email: "owner@example.com" } }),
  }));
  await page.route("**/api/v2/admin/overview", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(overview),
  }));
  await page.route("**/api/v2/admin/customers", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(customers),
  }));
  await page.route("**/api/v2/pricing", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(pricing),
  }));
};

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }]) {
  test.describe(`mobile ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("no horizontal document overflow, and the mobile top bar (not the desktop sidebar) renders", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      await mockAuthenticatedDashboard(page);
      await page.goto("/admin/");
      await page.waitForSelector(".app-shell");

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

      // The desktop sidebar (.side-nav) must be hidden on mobile; the mobile top bar
      // takes over navigation instead.
      await expect(page.locator(".side-nav")).toBeHidden();
      await expect(page.locator(".mobile-topbar")).toBeVisible();

      for (const selector of [".hero-card", ".stat-tiles", ".main-area"]) {
        const box = await page.locator(selector).first().boundingBox();
        expect(box, `${selector} should be present`).not.toBeNull();
        expect(box!.x + box!.width, `${selector} right edge should stay within the viewport`).toBeLessThanOrEqual(viewport.width + 1);
      }

      // Opening the mobile nav sheet must not itself introduce horizontal overflow.
      await page.getByRole("button", { name: "メニュー" }).click();
      await expect(page.locator(".mobile-nav-sheet")).toBeVisible();
      const overflowAfterOpen = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflowAfterOpen.scrollWidth).toBeLessThanOrEqual(overflowAfterOpen.clientWidth);

      expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });
  });
}

test("desktop layout is unaffected (sidebar navigation visible, mobile top bar hidden)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockAuthenticatedDashboard(page);
  await page.goto("/admin/");
  await page.waitForSelector(".app-shell");

  await expect(page.locator(".side-nav")).toBeVisible();
  await expect(page.locator(".mobile-topbar")).toBeHidden();

  const sidebarBox = await page.locator(".side-nav").boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.width).toBeLessThan(400);
});

test("direct access to /admin/ with no session shows the login screen, not a blank page", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "管理者ログイン" })).toBeVisible();
  expect(consoleErrors).toHaveLength(0);
});

test("tablet (768x1024): opening a needs_admin project and acknowledging it reflects in real Overview/detail data, reload keeps the session", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.setViewportSize({ width: 768, height: 1024 });
  await mockAuthenticatedDashboard(page);

  const detail = {
    project: { id: "project-1", name: overview.projects[0].name, status: "intake", needs_attention: true, attention_reasons: ["quality_check_failed"] },
    customer: { id: "customer-1", name: "月灯り珈琲株式会社" },
    requests: [], messages: [], workflows: [], tasks: [], artifacts: [], qualityChecks: [],
    approvals: [], payments: [], repositories: [], deployments: [], notifications: [],
    deploymentGate: { releasePassed: false, customerApproved: false, deployReady: false, humanGateRequired: true, productionPublished: false },
    auditLogs: [], consultationLog: [],
  };
  let acknowledged = false;
  await page.route("**/api/v2/admin/projects/project-1", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(acknowledged ? { ...detail, project: { ...detail.project, needs_attention: false, attention_reasons: [] } } : detail),
  }));
  await page.route("**/api/v2/admin/projects/project-1/acknowledge", (route) => {
    acknowledged = true;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/admin/");
  await page.getByText(overview.projects[0].name).click();
  await expect(page.getByRole("heading", { name: "AI作業提案" })).toBeVisible();

  await page.getByRole("button", { name: "承認して進める" }).first().click();
  await page.getByRole("button", { name: "承認して進める" }).last().click();
  await expect(page.getByText("承認して進めました。")).toBeVisible();

  // Real backend state changed (mock now reports needs_attention: false); reload must
  // reflect that, not fall back to stale cached data.
  await page.reload();
  await page.getByText(overview.projects[0].name).click();
  await expect(page.getByRole("heading", { name: "AI作業提案" })).toHaveCount(0);

  expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
});
