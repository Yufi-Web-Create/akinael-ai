import { test, expect, type Page } from "@playwright/test";

// Regression coverage for the PHASE 6 mobile QA FAIL: production Admin was reported
// showing a fixed-width desktop sidebar (~30-40% of screen width) with cut-off content
// on real mobile devices, even though admin/src/admin.css already has a
// `@media(max-width:760px)` override. Root-cause investigation (see docs/HANDOFF.md)
// found the actual admin.css/layout renders correctly at a genuine narrow CSS viewport
// in two different real browser engines against both a local build and live production —
// the most likely explanation is a QA environment that didn't apply a narrow viewport
// (a ~800-830px effective width reproduces the exact reported symptom precisely, since
// the media query simply doesn't trigger there). Separately, Vite's default CSS
// minifier had upgraded the source's `max-width:` media queries to CSS Media Queries
// Level 4 range syntax (`width<=760px`) in the built output, which has materially
// narrower real-world browser support than what the source author wrote — fixed via
// `build.cssTarget` in vite.config.ts. This test locks in the actual layout behavior
// (no horizontal overflow, sidebar not pinned as a fixed desktop column) at real mobile
// viewports so a regression here is caught locally, independent of what caused the
// original report.

const overview = {
  summary: { customers: 3, projects: 5, needsAttention: 1, runningWorkflows: 2, failedTasks: 0, pendingApprovals: 1 },
  projects: [
    { id: "project-1", name: "E2E｜月灯り珈琲 新規サイト制作プロジェクト（長い案件名のテスト用）", status: "intake", customer_name: "月灯り珈琲株式会社", needs_attention: true, attention_reasons: ["承認待ち"] },
    { id: "project-2", name: "通常案件", status: "production", customer_name: "顧客B", needs_attention: false },
  ],
  recentWorkflows: [],
  recentNotifications: [],
};

const detail = {
  project: { id: "project-1", name: "E2E｜月灯り珈琲 新規サイト制作プロジェクト（長い案件名のテスト用）", status: "intake" },
  customer: { name: "月灯り珈琲株式会社" },
  requests: [], messages: [], workflows: [{ id: "wf-1", status: "completed" }],
  tasks: Array.from({ length: 12 }, (_, i) => ({ id: `task-${i}`, status: i < 9 ? "completed" : "pending", title: `タスク${i}` })),
  artifacts: [], qualityChecks: [], approvals: [{ id: "approval-1", status: "approved" }],
  payments: [], repositories: [], deployments: [],
  notifications: [{ id: "n1", type: "delivery_approved", message: "成果物の承認を記録しました。" }],
  deploymentGate: { releasePassed: true, customerApproved: true, deployReady: true, humanGateRequired: true, productionPublished: false },
  auditLogs: [],
};

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
  await page.route("**/api/v2/admin/projects/*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(detail),
  }));
};

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }]) {
  test.describe(`mobile ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("no horizontal document overflow, and key panels fit within the viewport", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      await mockAuthenticatedDashboard(page);
      await page.goto("/admin/");
      await page.waitForSelector(".shell");

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

      // The sidebar must not remain pinned as a fixed-width desktop column (the exact
      // reported symptom: ~30-40% of the screen, content cut off on the right). On
      // mobile it should span (close to) the full viewport width, stacked above the
      // workspace rather than beside it.
      const sidebarBox = await page.locator(".sidebar").boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(sidebarBox!.width).toBeGreaterThan(viewport.width * 0.9);

      // Metrics, panel-grid (Deployment Gate etc.), and the main panel must fit inside
      // the viewport width — not spill off the right edge.
      for (const selector of [".metrics", ".panel-grid", ".panel", ".workspace"]) {
        const box = await page.locator(selector).first().boundingBox();
        expect(box, `${selector} should be present`).not.toBeNull();
        expect(box!.x + box!.width, `${selector} right edge should stay within the viewport`).toBeLessThanOrEqual(viewport.width + 1);
      }

      // The tabs row is allowed to scroll horizontally within its own container (the
      // CSS deliberately does this instead of wrapping) as long as it doesn't push the
      // whole document wider than the viewport — already covered by the scrollWidth
      // check above, asserted again here to anchor the intent for future readers.
      const tabsBox = await page.locator(".tabs").boundingBox();
      expect(tabsBox).not.toBeNull();
      expect(tabsBox!.x + tabsBox!.width).toBeLessThanOrEqual(viewport.width + 1);

      expect(consoleErrors, `unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });
  });
}

test("desktop layout is unaffected (two-column shell, fixed sidebar)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockAuthenticatedDashboard(page);
  await page.goto("/admin/");
  await page.waitForSelector(".shell");

  const shellDisplay = await page.locator(".shell").evaluate((el) => getComputedStyle(el).display);
  expect(shellDisplay).toBe("grid");

  const sidebarBox = await page.locator(".sidebar").boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.width).toBeLessThan(400);
});
