import { describe, expect, it } from "vitest";
import { computeAppState, toWorkItems } from "./adapters";

describe("computeAppState", () => {
  it("is not_started with no consultation and no requests", () => {
    expect(computeAppState({ consultation: null, requests: [], production: null })).toBe("not_started");
  });

  it("is chatting while an active thread has messages but is not ready", () => {
    expect(
      computeAppState({
        consultation: { threadId: "t1", finalized: false, finalizedRequestId: null, ready: false, summary: null, messages: [{ id: "1", role: "user", content: "hi", createdAt: "" }] },
        requests: [],
        production: null
      })
    ).toBe("chatting");
  });

  it("is summary_ready once the AI marks the active thread ready", () => {
    expect(
      computeAppState({
        consultation: { threadId: "t1", finalized: false, finalizedRequestId: null, ready: true, summary: { title: "x", category: "web_new", overview: "y", scopeItems: [], deliverables: [], priceBand: "", notes: "" }, messages: [{ id: "1", role: "assistant", content: "hi", createdAt: "" }] },
        requests: [],
        production: null
      })
    ).toBe("summary_ready");
  });

  it("is approved once a request exists but no workflow tasks are completed yet", () => {
    expect(
      computeAppState({
        consultation: { threadId: "t1", finalized: true, finalizedRequestId: "r1", ready: false, summary: null, messages: [] },
        requests: [{ id: "r1" }],
        production: { workflows: [{ id: "w1", status: "running" }], tasks: [{ id: "task1", status: "queued" }] }
      })
    ).toBe("approved");
  });

  it("is in_production once some tasks have completed on the first request", () => {
    expect(
      computeAppState({
        consultation: null,
        requests: [{ id: "r1" }],
        production: { workflows: [{ id: "w1", status: "running" }], tasks: [{ id: "t1", status: "completed" }, { id: "t2", status: "queued" }] }
      })
    ).toBe("in_production");
  });

  it("is revision when a later request's workflow is still running and earlier artifacts already exist", () => {
    expect(
      computeAppState({
        consultation: null,
        requests: [{ id: "r2" }, { id: "r1" }],
        production: {
          workflows: [{ id: "w2", status: "running" }],
          tasks: [{ id: "t1", status: "completed" }],
          artifacts: [{ id: "a1", kind: "build_build", preview_url: "https://x/preview" }]
        }
      })
    ).toBe("revision");
  });

  it("is completed once the workflow finishes and artifacts exist, before the release gate passes", () => {
    expect(
      computeAppState({
        consultation: null,
        requests: [{ id: "r1" }],
        production: {
          workflows: [{ id: "w1", status: "completed" }],
          artifacts: [{ id: "a1", kind: "build_build", preview_url: "https://x/preview" }],
          deploymentGate: { releasePassed: false }
        }
      })
    ).toBe("completed");
  });

  it("is final_check once the release gate has passed, regardless of workflow status", () => {
    expect(
      computeAppState({
        consultation: null,
        requests: [{ id: "r1" }],
        production: {
          workflows: [{ id: "w1", status: "completed" }],
          deploymentGate: { releasePassed: true, customerApproved: false }
        }
      })
    ).toBe("final_check");
  });

  it("a finalized (already-submitted) consultation thread does not block reading real production state", () => {
    expect(
      computeAppState({
        consultation: { threadId: "t1", finalized: true, finalizedRequestId: "r1", ready: false, summary: null, messages: [] },
        requests: [{ id: "r1" }],
        production: { workflows: [{ id: "w1", status: "completed" }], artifacts: [{ id: "a1", kind: "build_build", preview_url: "https://x" }] }
      })
    ).toBe("completed");
  });
});

describe("toWorkItems", () => {
  it("maps a website artifact without a preview yet to 制作中", () => {
    const [item] = toWorkItems([{ id: "a1", kind: "build_build", title: "Webサイト", preview_url: null }]);
    expect(item.statusLabel).toBe("制作中");
    expect(item.isWebsite).toBe(true);
  });

  it("maps a website artifact with a preview to 確認できます", () => {
    const [item] = toWorkItems([{ id: "a1", kind: "build_build", title: "Webサイト", preview_url: "https://x/preview" }]);
    expect(item.statusLabel).toBe("確認できます");
    expect(item.previewUrl).toBe("https://x/preview");
  });

  it("maps a ready artifact under a running workflow to 修正対応中", () => {
    const [item] = toWorkItems([{ id: "a1", kind: "build_build", preview_url: "https://x/preview" }], "running");
    expect(item.statusLabel).toBe("修正対応中");
  });

  it("excludes internal quality_check/review artifacts from the customer-facing work list", () => {
    const items = toWorkItems([
      { id: "a1", kind: "build_build", preview_url: "https://x" },
      { id: "a2", kind: "quality_check" },
      { id: "a3", kind: "review" }
    ]);
    expect(items).toHaveLength(1);
  });
});
