import type { ChatMessage, CustomerRow, Me, Overview, ProjectDetail, ProjectRow, Row } from "./types";

const CORE = import.meta.env.VITE_CORE_API_URL || "https://akinael-ai.com";
export const TOKEN_KEY = "akinael-admin-token";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  { token, method = "GET", body }: { token?: string | null; method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${CORE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload?.error?.message || "通信に失敗しました。", response.status, payload?.error?.code);
  return payload as T;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string }>("/api/v2/auth/login", { method: "POST", body: { email, password } }),
  logout: (token: string) => request("/api/v2/auth/logout", { method: "POST", token }),
  me: (token: string) => request<Me>("/api/v2/auth/me", { token }),
  requestPasswordRecovery: (email: string) => request("/api/v2/auth/password-recovery", { method: "POST", body: { email } }),
  updatePassword: (recoveryToken: string, password: string) => request("/api/v2/auth/password", { method: "POST", token: recoveryToken, body: { password } }),
  overview: (token: string) => request<Overview>("/api/v2/admin/overview", { token }),
  projectDetail: (token: string, projectId: string) => request<ProjectDetail>(`/api/v2/admin/projects/${projectId}`, { token }),
  customers: (token: string) => request<CustomerRow[]>("/api/v2/admin/customers", { token }),
  customerDetail: (token: string, customerId: string) => request<{ customer: CustomerRow; projects: ProjectRow[] }>(`/api/v2/admin/customers/${customerId}`, { token }),
  updateCustomerPlan: (token: string, customerId: string, planId: string | null) =>
    request<CustomerRow>(`/api/v2/admin/customers/${customerId}`, { method: "PATCH", token, body: { planId } }),
  acknowledgeProject: (token: string, projectId: string, note: string) =>
    request<{ ok: true }>(`/api/v2/admin/projects/${projectId}/acknowledge`, { method: "POST", token, body: { note } }),
  notifyCustomer: (token: string, projectId: string, message: string) =>
    request<{ ok: true; notified: number }>(`/api/v2/admin/projects/${projectId}/notify-customer`, { method: "POST", token, body: { message } }),
  chatThread: (token: string, projectId: string) => request<ChatMessage[]>(`/api/v2/admin/projects/${projectId}/chat`, { token }),
  sendChat: (token: string, projectId: string, content: string, createRequest = false) =>
    request<{ reply: ChatMessage; createdRequest: Row | null }>(`/api/v2/admin/projects/${projectId}/chat/messages`, {
      method: "POST",
      token,
      body: { content, createRequest }
    }),
  pricing: () => request<{ plans: Record<string, { name: string; monthlyAmount?: number; amount?: number }> }>("/api/v2/pricing")
};
