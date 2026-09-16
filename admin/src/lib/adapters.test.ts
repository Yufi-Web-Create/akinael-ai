import { describe, expect, it } from "vitest";
import { composeStatusSummary, projectDetailStatus, projectListStatus, translateAttentionReasons } from "./adapters";
import type { ProjectDetail, ProjectRow } from "./types";

const baseProject: ProjectRow = { id: "p1", name: "テスト案件", status: "production", needs_attention: false, attention_reasons: [] };

describe("projectListStatus", () => {
  it("is needs_admin whenever needs_attention is set, regardless of workflow state", () => {
    const result = projectListStatus({ ...baseProject, needs_attention: true });
    expect(result.status).toBe("needs_admin");
    expect(result.label).toBe("あなたの判断待ち");
  });

  it("is new for an intake project with no known workflow yet", () => {
    const result = projectListStatus({ ...baseProject, status: "intake" });
    expect(result.status).toBe("new");
  });

  it("is in_progress once a workflow is known and the project is not brand new", () => {
    const result = projectListStatus(baseProject, { id: "w1", status: "running" });
    expect(result.status).toBe("in_progress");
  });
});

function detailWith(overrides: Partial<ProjectDetail>): ProjectDetail {
  return {
    project: baseProject,
    customer: { id: "c1", name: "山田商店" },
    requests: [{ id: "r1", title: "Webサイト制作" }],
    messages: [],
    workflows: [{ id: "w1", status: "running" }],
    tasks: [],
    artifacts: [],
    qualityChecks: [],
    approvals: [],
    payments: [],
    repositories: [],
    deployments: [],
    notifications: [],
    deploymentGate: { releasePassed: false, customerApproved: false, deployReady: false, humanGateRequired: true, productionPublished: false },
    auditLogs: [],
    consultationLog: [],
    ...overrides
  };
}

describe("projectDetailStatus", () => {
  it("is needs_customer once the release gate has passed but the customer has not approved yet", () => {
    const detail = detailWith({ deploymentGate: { releasePassed: true, customerApproved: false, deployReady: false, humanGateRequired: true, productionPublished: false } });
    expect(projectDetailStatus(detail).status).toBe("needs_customer");
  });

  it("is done once the customer has approved, even if production has not been published (Human Gate)", () => {
    const detail = detailWith({ deploymentGate: { releasePassed: true, customerApproved: true, deployReady: true, humanGateRequired: true, productionPublished: false } });
    expect(projectDetailStatus(detail).status).toBe("done");
  });
});

describe("translateAttentionReasons", () => {
  it("translates a known internal reason code into plain Japanese", () => {
    expect(translateAttentionReasons(["quality_check_failed"])).toEqual(["自動チェックで指摘が見つかりました"]);
  });

  it("passes through an unknown reason rather than crashing", () => {
    expect(translateAttentionReasons(["something_new"])).toEqual(["something_new"]);
  });
});

describe("composeStatusSummary", () => {
  it("never renders internal system vocabulary for a normal in_progress case", () => {
    const detail = detailWith({ tasks: [{ id: "t1", status: "completed" }, { id: "t2", status: "queued" }] });
    const summary = composeStatusSummary(detail);
    for (const forbidden of ["Workflow", "Task", "workflow_run", "deploy_ready"]) {
      expect(summary).not.toContain(forbidden);
    }
    expect(summary).toContain("1/2");
  });

  it("surfaces translated attention reasons for a needs_admin case, not a raw DB dump", () => {
    const detail = detailWith({ project: { ...baseProject, needs_attention: true, attention_reasons: ["quality_check_failed"] } });
    expect(composeStatusSummary(detail)).toContain("自動チェックで指摘");
  });
});
