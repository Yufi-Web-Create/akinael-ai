import { useCallback, useEffect, useState } from "react";
import "./styles/admin.css";
import { api, ApiError, TOKEN_KEY } from "./lib/api";
import type { ChatMessage, CustomerRow, Me, Overview, ProjectDetail, ProjectRow, Screen } from "./lib/types";
import AuthScreen from "./components/AuthScreen";
import Shell from "./components/Shell";
import HomeScreen from "./components/HomeScreen";
import CustomersScreen from "./components/CustomersScreen";
import CustomerDetailScreen from "./components/CustomerDetailScreen";
import ProjectsScreen from "./components/ProjectsScreen";
import ProjectDetailScreen from "./components/ProjectDetailScreen";
import ConsultationLogScreen from "./components/ConsultationLogScreen";
import ChatThreadsScreen from "./components/ChatThreadsScreen";
import ChatScreen from "./components/ChatScreen";
import WorksScreen from "./components/WorksScreen";
import BillingScreen from "./components/BillingScreen";
import SettingsScreen from "./components/SettingsScreen";

export default function Admin() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const recoveryToken = hashParams.get("access_token");
  const [recoveryMode, setRecoveryMode] = useState(new URLSearchParams(window.location.search).get("mode") === "recovery");

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [plans, setPlans] = useState<Record<string, { name: string; monthlyAmount?: number; amount?: number }>>({});

  const [screen, setScreen] = useState<Screen>("home");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [customerDetail, setCustomerDetail] = useState<{ customer: CustomerRow; projects: ProjectRow[] } | null>(null);
  const [chatProjectName, setChatProjectName] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInstruction, setChatInstruction] = useState(false);
  const [worksProjectId, setWorksProjectId] = useState<string | null>(null);
  const [worksDetail, setWorksDetail] = useState<ProjectDetail | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const who = await api.me(accessToken);
    if (who.profile?.role !== "admin") throw new ApiError("管理者権限がありません。", 403);
    setMe(who);
    const [board, customerList, pricing] = await Promise.all([api.overview(accessToken), api.customers(accessToken), api.pricing()]);
    setOverview(board);
    setCustomers(customerList);
    setPlans(pricing.plans);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
    load(saved).catch((caught) => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setError(caught instanceof ApiError ? caught.message : "読み込みに失敗しました。");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    if (token) await api.logout(token).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setOverview(null);
    setScreen("home");
  };

  const navigate = (next: Screen) => {
    setScreen(next);
    setError("");
  };

  const openProject = async (projectId: string) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const detail = await api.projectDetail(token, projectId);
      setSelectedProjectId(projectId);
      setProjectDetail(detail);
      navigate("projectDetail");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "案件を取得できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const openCustomer = async (customerId: string) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.customerDetail(token, customerId);
      setSelectedCustomerId(customerId);
      setCustomerDetail(result);
      navigate("customerDetail");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "顧客を取得できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const openChat = async (projectId: string, projectName: string, instruction = false) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const thread = await api.chatThread(token, projectId);
      setSelectedProjectId(projectId);
      setChatProjectName(projectName);
      setChatMessages(thread);
      setChatInstruction(instruction);
      navigate("chat");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "チャットを取得できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async (content: string, createRequest: boolean) => {
    if (!token || !selectedProjectId) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.sendChat(token, selectedProjectId, content, createRequest);
      setChatMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() },
        result.reply
      ]);
      if (result.createdRequest && projectDetail?.project.id === selectedProjectId) {
        const refreshed = await api.projectDetail(token, selectedProjectId);
        setProjectDetail(refreshed);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "AIとの通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async (note: string) => {
    if (!token || !selectedProjectId) return;
    await api.acknowledgeProject(token, selectedProjectId, note);
    const [detail, board] = await Promise.all([api.projectDetail(token, selectedProjectId), api.overview(token)]);
    setProjectDetail(detail);
    setOverview(board);
  };

  const notifyCustomer = async (message: string) => {
    if (!token || !selectedProjectId) return;
    await api.notifyCustomer(token, selectedProjectId, message || "制作物のご確認をお願いします。");
    const detail = await api.projectDetail(token, selectedProjectId);
    setProjectDetail(detail);
  };

  const openWorksProject = async (projectId: string) => {
    if (!token || !projectId) return;
    setBusy(true);
    try {
      const detail = await api.projectDetail(token, projectId);
      setWorksProjectId(projectId);
      setWorksDetail(detail);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "成果物を取得できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const changePlan = async (customerId: string, planId: string | null) => {
    if (!token) return;
    await api.updateCustomerPlan(token, customerId, planId);
    setCustomers(await api.customers(token));
  };

  if (!token || recoveryMode) {
    return (
      <AuthScreen
        recoveryMode={recoveryMode}
        recoveryToken={recoveryToken}
        onRequestRecoveryMode={() => setRecoveryMode(true)}
        onRecoveryDone={() => setRecoveryMode(false)}
        onPasswordUpdated={() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setMe(null);
          window.history.replaceState({}, "", "/admin/");
          setRecoveryMode(false);
        }}
        onAuthenticated={async (newToken) => {
          setToken(newToken);
          await load(newToken);
        }}
      />
    );
  }

  if (!me || !overview) {
    return (
      <main className="screen">
        <p className="muted">読み込み中…</p>
      </main>
    );
  }

  return (
    <Shell screen={screen} onNavigate={navigate} onLogout={logout} operatorName={me.profile?.displayName || "管理者"}>
      {error && (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <p className="alert">{error}</p>
        </div>
      )}
      {screen === "home" && <HomeScreen overview={overview} onOpenProject={openProject} />}
      {screen === "customers" && <CustomersScreen customers={customers} onOpen={openCustomer} />}
      {screen === "customerDetail" && customerDetail && (
        <CustomerDetailScreen
          customer={customerDetail.customer}
          projects={customerDetail.projects}
          onOpenProject={openProject}
          onOpenConsultationLog={openProject}
        />
      )}
      {screen === "projects" && <ProjectsScreen overview={overview} onOpen={openProject} />}
      {screen === "projectDetail" && projectDetail && (
        <ProjectDetailScreen
          detail={projectDetail}
          busy={busy}
          onOpenChat={(instruction) => openChat(projectDetail.project.id, projectDetail.project.name, instruction)}
          onOpenConsultationLog={() => navigate("consultationLog")}
          onAcknowledge={acknowledge}
          onNotifyCustomer={notifyCustomer}
        />
      )}
      {screen === "consultationLog" && projectDetail && (
        <ConsultationLogScreen
          projectName={projectDetail.project.name}
          log={projectDetail.consultationLog}
          onAskChat={() => openChat(projectDetail.project.id, projectDetail.project.name)}
        />
      )}
      {screen === "chatThreads" && <ChatThreadsScreen overview={overview} onOpen={(id) => { const p = overview.projects.find((x) => x.id === id); openChat(id, p?.name || "案件"); }} />}
      {screen === "chat" && <ChatScreen projectName={chatProjectName} messages={chatMessages} instruction={chatInstruction} busy={busy} onSend={sendChat} />}
      {screen === "works" && <WorksScreen overview={overview} selectedProjectId={worksProjectId} detail={worksDetail} onSelect={openWorksProject} />}
      {screen === "billing" && <BillingScreen customers={customers} plans={plans} busy={busy} onChangePlan={changePlan} />}
      {screen === "settings" && <SettingsScreen me={me} onLogout={logout} />}
    </Shell>
  );
}
