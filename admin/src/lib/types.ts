export type Screen =
  | "home"
  | "customers"
  | "customerDetail"
  | "projects"
  | "projectDetail"
  | "chatThreads"
  | "chat"
  | "works"
  | "billing"
  | "settings"
  | "consultationLog";

export type Me = {
  profile?: { role?: string; displayName?: string };
  user?: { email?: string };
};

export type Summary = {
  customers: number;
  projects: number;
  needsAttention: number;
  runningWorkflows: number;
  failedTasks: number;
  pendingApprovals: number;
};

export type Row = Record<string, unknown> & { id: string };

export type ProjectRow = Row & {
  id: string;
  name: string;
  status: string;
  customer_name?: string | null;
  needs_attention?: boolean;
  attention_reasons?: string[];
  updated_at?: string;
};

export type Overview = {
  summary: Summary;
  projects: ProjectRow[];
  recentWorkflows: Row[];
  recentNotifications: Row[];
};

export type DeploymentGate = {
  releasePassed: boolean;
  customerApproved: boolean;
  deployReady: boolean;
  humanGateRequired: boolean;
  productionPublished: boolean;
};

export type ProjectDetail = {
  project: ProjectRow;
  customer?: { id: string; name?: string; plan_id?: string | null } | null;
  requests: Row[];
  messages: Row[];
  workflows: Row[];
  tasks: Row[];
  artifacts: Row[];
  qualityChecks: Row[];
  approvals: Row[];
  payments: Row[];
  repositories: Row[];
  deployments: Row[];
  notifications: Row[];
  deploymentGate: DeploymentGate;
  auditLogs: Row[];
  consultationLog: ChatMessage[];
};

export type CustomerRow = Row & {
  id: string;
  name: string;
  plan_id?: string | null;
  projectCount: number;
  needsAttention: boolean;
  lastActivity?: string;
};

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

export type AdminProjectStatus = "needs_admin" | "in_progress" | "needs_customer" | "done" | "new";

export type ProjectViewModel = {
  id: string;
  name: string;
  customerName: string;
  status: AdminProjectStatus;
  statusLabel: string;
  nextAction: string;
  updatedAt?: string;
};
