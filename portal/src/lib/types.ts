export type Screen = "home" | "chat" | "summary" | "works" | "plan" | "settings";

export type AppState =
  | "not_started"
  | "chatting"
  | "summary_ready"
  | "approved"
  | "in_production"
  | "revision"
  | "completed"
  | "final_check";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ConsultationSummary = {
  title: string;
  category: string;
  overview: string;
  scopeItems: string[];
  deliverables: string[];
  priceBand: string;
  notes: string;
};

export type ConsultationState = {
  threadId: string | null;
  finalized: boolean;
  finalizedRequestId: string | null;
  ready: boolean;
  summary: ConsultationSummary | null;
  messages: ChatMessage[];
};

export type Project = { id: string; name: string; status?: string };

export type RequestItem = {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  type?: string;
  created_at?: string;
};

export type WorkflowRun = { id: string; status?: string; current_phase?: string };
export type TaskItem = { id: string; status: string };
export type Artifact = {
  id: string;
  kind: string;
  title?: string;
  preview_url?: string | null;
  created_at?: string;
};

export type DeploymentGate = {
  deployReady?: boolean;
  humanGateRequired?: boolean;
  productionPublished?: boolean;
  releasePassed?: boolean;
  customerApproved?: boolean;
};

export type Approval = {
  id: string;
  type?: string;
  status?: string;
  payload?: { note?: string };
  created_at?: string;
};

export type NotificationItem = { id: string; type?: string; message?: string; created_at?: string };

export type Production = {
  workflows?: WorkflowRun[];
  tasks?: TaskItem[];
  artifacts?: Artifact[];
  notifications?: NotificationItem[];
  deploymentGate?: DeploymentGate;
};

export type WorkItemStatus = "制作中" | "確認できます" | "修正対応中" | "完成";

export type WorkItem = {
  id: string;
  title: string;
  kind: string;
  statusLabel: WorkItemStatus;
  previewUrl: string | null;
  isWebsite: boolean;
  createdAt?: string;
};

export type PlanCatalogEntry = {
  name: string;
  amount?: number;
  monthlyAmount?: number;
  positioning?: string;
  includes?: string[];
};

export type PricingCatalog = {
  currency: string;
  taxIncluded: boolean;
  plans: Record<string, PlanCatalogEntry>;
  websiteProduction: { name: string; startingAmount: number };
  instagramAds: { name: string; feeRate: number; minimumMonthlyFee: number };
};

export type BillingHistoryItem = {
  id: string;
  kind?: string;
  amount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
};

export type BillingSummary = {
  currentPlan: (PlanCatalogEntry & { id: string }) | null;
  billingPortalAvailable: boolean;
  notifyByEmail: boolean;
  history: BillingHistoryItem[];
};

export type Me = {
  user: { id: string; email: string | null };
  profile: { role?: string; displayName?: string | null; tenantId?: string } | null;
  customer: { id: string; name?: string } | null;
  onboardingRequired: boolean;
};
