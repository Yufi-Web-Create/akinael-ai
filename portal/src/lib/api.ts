import type {
  BillingSummary,
  ConsultationState,
  Me,
  PricingCatalog,
  Production,
  Project,
  RequestItem
} from "./types";

const CORE = import.meta.env.VITE_CORE_API_URL || "https://akinael-ai.com";
export const TOKEN_KEY = "customer-token";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const authHeaders = (token: string | null): Record<string, string> =>
  token ? { authorization: `Bearer ${token}` } : {};

async function request<T>(
  path: string,
  { token, method = "GET", body }: { token?: string | null; method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${CORE}${path}`, {
    method,
    headers: {
      ...authHeaders(token ?? null),
      ...(body !== undefined ? { "content-type": "application/json" } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.error?.message || "通信に失敗しました。", response.status, payload?.error?.code);
  }
  return payload as T;
}

export const api = {
  me: (token: string) => request<Me>("/api/v2/auth/me", { token }),
  register: (email: string, password: string) =>
    request<{ token?: string; confirmationRequired?: boolean }>("/api/v2/auth/register", {
      method: "POST",
      body: { email, password }
    }),
  login: (email: string, password: string) =>
    request<{ token: string }>("/api/v2/auth/login", { method: "POST", body: { email, password } }),
  logout: (token: string) => request("/api/v2/auth/logout", { method: "POST", token }),
  requestPasswordRecovery: (email: string) =>
    request("/api/v2/auth/password-recovery", { method: "POST", body: { email } }),
  updatePassword: (recoveryToken: string, password: string) =>
    request("/api/v2/auth/password", { method: "POST", token: recoveryToken, body: { password } }),
  onboard: (token: string, displayName: string, businessName: string) =>
    request<Me>("/api/v2/onboarding", { method: "POST", token, body: { displayName, businessName } }),
  listProjects: (token: string) => request<Project[]>("/api/v2/projects", { token }),
  createProject: (token: string, name: string) =>
    request<Project>("/api/v2/projects", { method: "POST", token, body: { name } }),
  listRequests: (token: string, projectId: string) =>
    request<RequestItem[]>(`/api/v2/projects/${projectId}/requests`, { token }),
  production: (token: string, projectId: string) =>
    request<Production>(`/api/v2/projects/${projectId}/production`, { token }),
  approve: (token: string, projectId: string, requestId: string | undefined, note: string) =>
    request(`/api/v2/projects/${projectId}/approvals`, { method: "POST", token, body: { note, requestId } }),
  consultation: (token: string, projectId: string) =>
    request<ConsultationState>(`/api/v2/projects/${projectId}/consultation`, { token }),
  sendConsultationMessage: (
    token: string,
    projectId: string,
    input: { content: string; threadId?: string | null; chatContext?: string }
  ) =>
    request<{ threadId: string; ready: boolean; summary: ConsultationState["summary"]; reply: { id: string; role: "assistant"; content: string; createdAt: string } }>(
      `/api/v2/projects/${projectId}/consultation/messages`,
      { method: "POST", token, body: input }
    ),
  finalizeConsultation: (token: string, projectId: string, threadId: string, summary: unknown) =>
    request<{ request: RequestItem; threadId: string }>(`/api/v2/projects/${projectId}/consultation/finalize`, {
      method: "POST",
      token,
      body: { threadId, summary }
    }),
  pricing: () => request<PricingCatalog>("/api/v2/pricing"),
  billingSummary: (token: string) => request<BillingSummary>("/api/v2/billing/summary", { token }),
  billingCheckoutSession: (token: string, planId: string) =>
    request<{ url: string; id: string }>("/api/v2/billing/checkout-session", {
      method: "POST",
      token,
      body: { planId }
    }),
  billingChangePlan: (token: string, planId: string) =>
    request<{ scheduled: boolean; effectiveDate?: string | null }>("/api/v2/billing/change-plan", {
      method: "POST",
      token,
      body: { planId }
    }),
  billingCancel: (token: string) =>
    request<{ scheduled: boolean; canceledDate?: string | null }>("/api/v2/billing/cancel", {
      method: "POST",
      token
    }),
  updateAccount: (
    token: string,
    input: { displayName?: string; businessName?: string; notifyByEmail?: boolean }
  ) => request<Me>("/api/v2/account", { method: "PATCH", token, body: input })
};
