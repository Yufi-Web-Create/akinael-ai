// Adapter layer: translates raw backend status (project.status, needs_attention,
// workflow_runs, deployment gate, approvals...) into the Japanese business-state
// vocabulary claude-design-input/admin-console/README.md defines. No internal system
// term (Workflow/Task/Artifact/Deployment Gate/Human Gate) is meant to reach a normal
// operator screen through this layer — only 開発者向け情報 (Settings) shows raw fields.
import type { AdminProjectStatus, ProjectDetail, ProjectRow, Row } from "./types";

export const STATUS_LABEL: Record<AdminProjectStatus, string> = {
  needs_admin: "あなたの判断待ち",
  in_progress: "制作中",
  needs_customer: "お客様確認待ち",
  done: "完了",
  new: "新規相談"
};

export const STATUS_TONE: Record<AdminProjectStatus, "warn" | "accent" | "success" | "neutral"> = {
  needs_admin: "warn",
  in_progress: "accent",
  needs_customer: "warn",
  done: "success",
  new: "neutral"
};

function statusFromSignals(input: {
  needsAttention?: boolean;
  hasRequests: boolean;
  latestWorkflowStatus?: string;
  releasePassed?: boolean;
  customerApproved?: boolean;
  productionPublished?: boolean;
}): { status: AdminProjectStatus; nextAction: string } {
  if (input.needsAttention) {
    return { status: "needs_admin", nextAction: "AIからの提案を確認してください" };
  }
  if (input.productionPublished || input.customerApproved) {
    return { status: "done", nextAction: "運用状況を確認できます" };
  }
  if (input.releasePassed && !input.customerApproved) {
    return { status: "needs_customer", nextAction: "お客様の確認をお待ちしています" };
  }
  if (!input.hasRequests) {
    return { status: "new", nextAction: "相談内容の確定をお待ちしています" };
  }
  if (input.latestWorkflowStatus && input.latestWorkflowStatus !== "completed") {
    return { status: "in_progress", nextAction: "制作の進み具合を確認できます" };
  }
  return { status: "in_progress", nextAction: "制作の進み具合を確認できます" };
}

export function projectListStatus(project: ProjectRow, latestWorkflow?: Row) {
  const result = statusFromSignals({
    needsAttention: project.needs_attention,
    hasRequests: project.status !== "intake" || Boolean(latestWorkflow),
    latestWorkflowStatus: latestWorkflow?.status as string | undefined
  });
  return { ...result, label: STATUS_LABEL[result.status] };
}

export function projectDetailStatus(detail: ProjectDetail) {
  const latestWorkflow = detail.workflows[0];
  const result = statusFromSignals({
    needsAttention: detail.project.needs_attention,
    hasRequests: detail.requests.length > 0,
    latestWorkflowStatus: latestWorkflow?.status as string | undefined,
    releasePassed: detail.deploymentGate.releasePassed,
    customerApproved: detail.deploymentGate.customerApproved,
    productionPublished: detail.deploymentGate.productionPublished
  });
  return { ...result, label: STATUS_LABEL[result.status] };
}

const REASON_LABEL: Record<string, string> = {
  quality_check_failed: "自動チェックで指摘が見つかりました",
  needs_admin: "運営者の判断が必要です"
};

export function translateAttentionReasons(reasons?: string[]): string[] {
  if (!reasons?.length) return [];
  return reasons.map((reason) => REASON_LABEL[reason] || reason);
}

// Deterministic natural-language composer for the 案件詳細「今の状況」card. This avoids an
// extra synchronous AI call on every page view (latency/cost/availability risk for a card
// shown on every load) while still satisfying "自然文で要約し、DB生値を羅列しない" — the
// same structured data the AI chat already has access to is turned into a short Japanese
// paragraph here instead of a raw field dump. The project-scoped 司令塔AIチャット remains
// available for anything this summary doesn't answer.
export function composeStatusSummary(detail: ProjectDetail): string {
  const { status } = projectDetailStatus(detail);
  const completedTasks = detail.tasks.filter((task) => task.status === "completed").length;
  const totalTasks = detail.tasks.length;
  const workName = detail.artifacts[0]?.title || detail.project.name;

  switch (status) {
    case "needs_admin": {
      const reasons = translateAttentionReasons(detail.project.attention_reasons);
      return reasons.length
        ? `${reasons.join("、")}。内容を確認し、進めるか修正を指示してください。`
        : "AIからの作業提案があります。内容を確認し、進めるか修正を指示してください。";
    }
    case "new":
      return "まだ相談内容が確定していません。お客様の相談が完了すると、ここに制作内容が表示されます。";
    case "needs_customer":
      return `${workName}の準備が整い、お客様の最終確認をお待ちしています。`;
    case "done":
      return `${workName}はお客様の確認・承認が完了しています。`;
    case "in_progress":
    default:
      return totalTasks > 0
        ? `${workName}を制作中です（${completedTasks}/${totalTasks}工程が完了）。`
        : `${workName}の制作を進めています。`;
  }
}
