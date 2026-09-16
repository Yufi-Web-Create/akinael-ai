// Adapter layer: translates raw backend state (Workflow/Task/Request/Artifact/Human Gate
// vocabulary) into the customer-facing appState the design spec defines. No internal system
// term is ever returned from here — only the values in the README's "状態キー" column, or
// customer-facing work/plan view models.
import type {
  AppState,
  Artifact,
  ConsultationState,
  Production,
  RequestItem,
  WorkItem,
  WorkItemStatus
} from "./types";

export function computeAppState(input: {
  consultation: ConsultationState | null;
  requests: RequestItem[];
  production: Production | null;
}): AppState {
  const { consultation, requests, production } = input;

  if (consultation && !consultation.finalized) {
    if (consultation.messages.length === 0) return "not_started";
    return consultation.ready ? "summary_ready" : "chatting";
  }

  if (!requests.length) return "not_started";

  const gate = production?.deploymentGate;
  const workflows = production?.workflows || [];
  const latestWorkflow = workflows[0];
  const tasks = production?.tasks || [];
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const artifacts = production?.artifacts || [];

  if (gate?.releasePassed) return "final_check";
  if (latestWorkflow?.status === "completed" && artifacts.length > 0) return "completed";
  if (latestWorkflow && latestWorkflow.status !== "completed") {
    // A second (or later) real request past the first delivery reads as the customer having
    // asked for a change to something already produced, not the original build.
    if (requests.length > 1 && artifacts.length > 0) return "revision";
    return completedTasks === 0 ? "approved" : "in_production";
  }
  return completedTasks === 0 ? "approved" : "in_production";
}

const WEBSITE_ARTIFACT_KINDS = new Set(["build_build", "web_build"]);

export function toWorkItems(artifacts: Artifact[], latestWorkflowStatus?: string): WorkItem[] {
  return artifacts
    .filter((artifact) => artifact.kind !== "quality_check" && artifact.kind !== "review")
    .map((artifact) => {
      const isWebsite = WEBSITE_ARTIFACT_KINDS.has(artifact.kind);
      let statusLabel: WorkItemStatus = "完成";
      if (!artifact.preview_url && isWebsite) statusLabel = "制作中";
      else if (latestWorkflowStatus === "running") statusLabel = "修正対応中";
      else if (artifact.preview_url) statusLabel = "確認できます";
      return {
        id: artifact.id,
        title: artifact.title || "制作物",
        kind: artifact.kind,
        statusLabel,
        previewUrl: artifact.preview_url || null,
        isWebsite,
        createdAt: artifact.created_at
      };
    });
}

export const APP_STATE_COPY: Record<AppState, { heading: string; body: string; cta: string | null }> = {
  not_started: {
    heading: "まずはAIに相談してみましょう",
    body: "普段の言葉で、やりたいことを話すだけで大丈夫です。",
    cta: "AIに相談する"
  },
  chatting: {
    heading: "AIと相談中です",
    body: "続きから相談を進めましょう。",
    cta: "相談を続ける"
  },
  summary_ready: {
    heading: "相談内容がまとまりました",
    body: "内容と料金をご確認ください。",
    cta: "内容を確認する"
  },
  approved: {
    heading: "制作を準備しています",
    body: "担当チームが制作の準備を進めています。",
    cta: null
  },
  in_production: {
    heading: "ただいま制作中です",
    body: "完成まで今しばらくお待ちください。",
    cta: null
  },
  revision: {
    heading: "修正内容を確認しています",
    body: "内容を確認して、担当チームが対応中です。",
    cta: null
  },
  completed: {
    heading: "制作物が完成しました",
    body: "出来上がった内容をご確認ください。",
    cta: "プレビューを見る"
  },
  final_check: {
    heading: "最終確認をお願いします",
    body: "内容をご確認のうえ、完了操作をお願いします。",
    cta: "成果物を確認する"
  }
};
