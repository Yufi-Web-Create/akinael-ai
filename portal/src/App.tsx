import { useCallback, useEffect, useState } from "react";
import "./styles/portal.css";
import { api, ApiError, TOKEN_KEY } from "./lib/api";
import { computeAppState, toWorkItems } from "./lib/adapters";
import type {
  BillingSummary,
  ConsultationState,
  Me,
  Production,
  PricingCatalog,
  Project,
  RequestItem,
  Screen
} from "./lib/types";
import AuthScreen from "./components/AuthScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import Shell from "./components/Shell";
import Home from "./components/Home";
import ChatScreen from "./components/ChatScreen";
import SummaryScreen from "./components/SummaryScreen";
import WorksScreen from "./components/WorksScreen";
import PlanScreen from "./components/PlanScreen";
import SettingsScreen from "./components/SettingsScreen";

const newThreadId = () => `thr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const initialScreenFromLocation = (): Screen =>
  new URLSearchParams(window.location.search).get("screen") === "plan" ? "plan" : "home";

export default function App() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const recoveryToken = hashParams.get("access_token");
  const [recoveryMode, setRecoveryMode] = useState(new URLSearchParams(window.location.search).get("mode") === "recovery");

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [consultation, setConsultation] = useState<ConsultationState | null>(null);
  const [pricing, setPricing] = useState<PricingCatalog | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);

  const [screen, setScreen] = useState<Screen>(initialScreenFromLocation);
  const [chatContext, setChatContext] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const [seenSummaryThread, setSeenSummaryThread] = useState<string | null>(null);
  const [seenWorksCount, setSeenWorksCount] = useState<number>(0);

  const loadProjectData = useCallback(async (accessToken: string, proj: Project) => {
    const [requestList, productionStatus, consultationState] = await Promise.all([
      api.listRequests(accessToken, proj.id),
      api.production(accessToken, proj.id),
      api.consultation(accessToken, proj.id)
    ]);
    setRequests(requestList);
    setProduction(productionStatus);
    setConsultation(consultationState);
  }, []);

  const bootstrap = useCallback(
    async (accessToken: string) => {
      const profile = await api.me(accessToken);
      setMe(profile);
      if (profile.onboardingRequired) return;

      let projects = await api.listProjects(accessToken);
      if (!projects.length) {
        const created = await api.createProject(
          accessToken,
          `${profile.customer?.name || profile.profile?.displayName || "お客様"}のご相談`
        );
        projects = [created];
      }
      const activeProject = projects[0];
      setProject(activeProject);
      await loadProjectData(accessToken, activeProject);

      const pricingCatalog = await api.pricing().catch(() => null);
      setPricing(pricingCatalog);
      const billingSummary = await api.billingSummary(accessToken).catch(() => null);
      setBilling(billingSummary);

      const storedThread = localStorage.getItem(`portal-seen-summary-${activeProject.id}`);
      setSeenSummaryThread(storedThread);
      const storedWorks = Number(localStorage.getItem(`portal-seen-works-${activeProject.id}`) || 0);
      setSeenWorksCount(storedWorks);
    },
    [loadProjectData]
  );

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
    bootstrap(saved).catch((caught) => {
      if (caught instanceof ApiError && caught.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setError(caught instanceof ApiError ? caught.message : "読み込みに失敗しました。");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !project) return;
    await loadProjectData(token, project);
  }, [token, project, loadProjectData]);

  const logout = async () => {
    if (token) await api.logout(token).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setProject(null);
    setRequests([]);
    setProduction(null);
    setConsultation(null);
    setScreen("home");
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
          window.history.replaceState({}, "", "/portal/");
          setRecoveryMode(false);
        }}
        onAuthenticated={async (newToken) => {
          setToken(newToken);
          await bootstrap(newToken);
        }}
      />
    );
  }

  if (!me) {
    return (
      <main className="screen">
        <p className="muted">読み込み中…</p>
      </main>
    );
  }

  if (me.onboardingRequired) {
    return (
      <OnboardingScreen
        token={token}
        onDone={async () => {
          await bootstrap(token);
        }}
      />
    );
  }

  if (!project) {
    return (
      <main className="screen">
        <p className="muted">読み込み中…</p>
      </main>
    );
  }

  const appState = computeAppState({ consultation, requests, production });
  const works = toWorkItems(production?.artifacts || [], production?.workflows?.[0]?.status);
  const summaryUnread = Boolean(consultation?.ready && !consultation.finalized && consultation.threadId !== seenSummaryThread);
  const worksUnread = works.length > seenWorksCount;
  const customerApproved = Boolean(production?.deploymentGate?.customerApproved);
  const hasPaidPlan = Boolean(billing?.currentPlan && billing.currentPlan.id !== "trial");

  const navigate = (next: Screen) => {
    setScreen(next);
    setError("");
    if (next === "summary" && consultation?.threadId) {
      localStorage.setItem(`portal-seen-summary-${project.id}`, consultation.threadId);
      setSeenSummaryThread(consultation.threadId);
    }
    if (next === "works") {
      localStorage.setItem(`portal-seen-works-${project.id}`, String(works.length));
      setSeenWorksCount(works.length);
    }
  };

  const sendChat = async (content: string) => {
    setChatBusy(true);
    setError("");
    try {
      const activeThreadId = consultation && !consultation.finalized && consultation.threadId ? consultation.threadId : newThreadId();
      const isFirstMessageOfThread = !consultation || consultation.threadId !== activeThreadId || consultation.finalized;
      const result = await api.sendConsultationMessage(token, project.id, {
        content,
        threadId: activeThreadId,
        ...(isFirstMessageOfThread && chatContext ? { chatContext } : {})
      });
      setConsultation((prev) => {
        const priorMessages = prev && prev.threadId === activeThreadId ? prev.messages : [];
        return {
          threadId: result.threadId,
          finalized: false,
          finalizedRequestId: null,
          ready: result.ready,
          summary: result.summary,
          messages: [
            ...priorMessages,
            { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() },
            result.reply
          ]
        };
      });
      setReady(result.ready);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "AIとの通信に失敗しました。");
    } finally {
      setChatBusy(false);
    }
  };

  const approveSummary = async () => {
    if (!consultation?.threadId || !consultation.summary) return;
    setBusy(true);
    setError("");
    try {
      await api.finalizeConsultation(token, project.id, consultation.threadId, consultation.summary);
      await refresh();
      setChatContext(null);
      navigate("home");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const approveDelivery = async () => {
    const requestId = requests[0]?.id;
    if (!requestId || !production?.deploymentGate?.releasePassed) return;
    setBusy(true);
    setError("");
    try {
      await api.approve(token, project.id, requestId, "制作物を確認し、内容を承認しました。");
      await refresh();
      const billingSummary = await api.billingSummary(token).catch(() => null);
      setBilling(billingSummary);
      navigate("plan");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "承認を記録できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const startCheckout = async (planId: string) => {
    setBusy(true);
    setError("");
    try {
      const session = await api.billingCheckoutSession(token, planId);
      window.location.assign(session.url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "決済画面を開けませんでした。");
      setBusy(false);
    }
  };

  const openBillingPortal = async () => {
    setBusy(true);
    setError("");
    try {
      const session = await api.billingPortalSession(token);
      window.open(session.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "お支払い管理ページを開けませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell screen={screen} onNavigate={navigate} summaryUnread={summaryUnread} worksUnread={worksUnread} onLogout={logout}>
      {error && (
        <div className="screen" style={{ paddingBottom: 0 }}>
          <div className="card error card-in">{error}</div>
        </div>
      )}
      {screen === "home" && (
        <Home
          appState={appState}
          gate={production?.deploymentGate}
          hasPaidPlan={hasPaidPlan}
          onNavigate={navigate}
        />
      )}
      {screen === "chat" && (
        <ChatScreen
          messages={consultation?.messages || []}
          chatContext={chatContext}
          busy={chatBusy}
          ready={ready && !consultation?.finalized}
          onSend={sendChat}
          onGoToSummary={() => navigate("summary")}
        />
      )}
      {screen === "summary" && (
        <SummaryScreen
          summary={consultation?.finalized ? null : consultation?.summary || null}
          busy={busy}
          onApprove={approveSummary}
          onRequestChange={() => navigate("chat")}
        />
      )}
      {screen === "works" && (
        <WorksScreen
          works={works}
          canApprove={Boolean(production?.deploymentGate?.releasePassed)}
          approved={customerApproved}
          busy={busy}
          onApprove={approveDelivery}
          onRequestRevision={(title) => {
            setChatContext(title);
            setConsultation(null);
            setReady(false);
            navigate("chat");
          }}
        />
      )}
      {screen === "plan" && (
        <PlanScreen
          billing={billing}
          pricing={pricing}
          busy={busy}
          onStartCheckout={startCheckout}
          onOpenBillingPortal={openBillingPortal}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen
          token={token}
          me={me}
          onSaved={async () => {
            const profile = await api.me(token);
            setMe(profile);
          }}
          onLogout={logout}
        />
      )}
    </Shell>
  );
}
