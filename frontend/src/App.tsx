import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  GraduationCap,
  History,
  LogIn,
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { apiRequest, getStoredToken, setStoredToken } from "./api";
import { CodeReviewView } from "./code_review/CodeReviewView";
import { EdTechView } from "./edtech/EdTechView";
import { GeneralAiView } from "./general_ai/GeneralAiView";
import { HistoryView } from "./history/HistoryView";
import { AuthModal } from "./settings/AuthModal";
import { SettingsView } from "./settings/SettingsView";

type NavSection = "general-ai" | "code-review" | "edtech-lms" | "history" | "settings";

export const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavSection>("general-ai");
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [telemetryOpen, setTelemetryOpen] = useState<boolean>(false);

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const [currentIntent, setCurrentIntent] = useState<string>("idle");
  const [workflowTrace, setWorkflowTrace] = useState<any[]>([]);
  const [activeCitations, setActiveCitations] = useState<any[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<any[]>([]);

  const [memories, setMemories] = useState<any[]>([]);
  const [apiKeySettings, setApiKeySettings] = useState<any | null>(null);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const refreshWorkspaceState = async () => {
    try {
      const [convRes, execRes, memRes, keyRes] = await Promise.all([
        apiRequest("/api/conversations"),
        apiRequest("/api/agents/executions"),
        apiRequest("/api/memory"),
        apiRequest("/api/settings/api-keys"),
      ]);
      setConversations(convRes.conversations || []);
      setRecentExecutions(execRes.executions || []);
      setMemories(memRes.memories || []);
      if (keyRes?.settings) setApiKeySettings(keyRes.settings);
    } catch {
      // ignore
    }
  };

  const bootstrapSession = async () => {
    try {
      const meRes = await apiRequest("/api/auth/me");
      setCurrentUser(meRes.user);
      if (!getStoredToken() && meRes.user?.id) {
        setStoredToken(`omni-token-${meRes.user.id}`);
      }
      await refreshWorkspaceState();
    } catch {
      setStoredToken(null);
      setAuthModalOpen(true);
    }
  };

  useEffect(() => {
    bootstrapSession();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setWorkflowTrace([]);
    setActiveCitations([]);
    setCurrentIntent("idle");
    setActiveNav("general-ai");
  };

  const selectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setActiveNav("general-ai");
    try {
      const res = await apiRequest(`/api/conversations/${convId}/messages`);
      const loaded = res.messages || [];
      setMessages(loaded);
      const lastMsg = loaded[loaded.length - 1];
      if (lastMsg) {
        setWorkflowTrace(lastMsg.workflow_trace || []);
        setActiveCitations(lastMsg.citations || []);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteConversation = async (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiRequest(`/api/conversations/${convId}`, { method: "DELETE" });
      if (activeConversationId === convId) startNewChat();
      await refreshWorkspaceState();
    } catch {
      // ignore
    }
  };

  const handleClearAllConversations = async () => {
    try {
      await apiRequest("/api/conversations", { method: "DELETE" });
      startNewChat();
      await refreshWorkspaceState();
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setCurrentUser(null);
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  const exportConversationMarkdown = () => {
    const md = messages
      .map(
        (m) =>
          `### ${m.sender_role.toUpperCase()} (${m.agent_name || "omniscient"})\n\n${m.content}\n`
      )
      .join("\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omniscient-ai-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const userInitials = (currentUser?.full_name || "OM")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navItems: { id: NavSection; label: string; icon: any }[] = [
    { id: "general-ai", label: "General AI", icon: Sparkles },
    { id: "code-review", label: "Code Review", icon: Code2 },
    { id: "edtech-lms", label: "EdTech LMS", icon: GraduationCap },
    { id: "history", label: "Conversation History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen h-screen flex flex-col lg:flex-row bg-[#000000] text-[#FFFFFF] overflow-hidden">
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        canDismiss={Boolean(currentUser)}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={async (user) => {
          setCurrentUser(user);
          await refreshWorkspaceState();
        }}
      />

      {/* LEFT SIDEBAR */}
      {sidebarOpen && (
        <aside className="w-full lg:w-64 shrink-0 bg-[#000000] border-b lg:border-b-0 lg:border-r border-[#D4AF37]/25 flex flex-col justify-between overflow-y-auto">
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0A0A0A] border border-[#D4AF37] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wider text-[#FFFFFF]">OMNISCIENT AI</div>
                <div className="text-[10px] font-mono text-[#777777] uppercase tracking-widest">
                  Unified Intelligence
                </div>
              </div>
            </div>

            <button onClick={startNewChat} className="w-full btn-primary py-2.5">
              <MessageSquarePlus className="w-4 h-4 text-[#000000]" />
              New Chat
            </button>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#D4AF37]/15 text-[#FFFFFF] border border-[#D4AF37]"
                        : "text-[#BDBDBD] hover:text-[#FFFFFF] hover:bg-[#D4AF37]/10 border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {conversations.length > 0 && (
              <div className="pt-4 border-t border-[#D4AF37]/20 space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777]">
                    Recent Chats ({conversations.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllConversations}
                    title="Clear all chat history"
                    className="text-[10px] text-[#B22222] hover:underline font-semibold"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {conversations.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectConversation(c.id)}
                      className={`group cursor-pointer flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors ${
                        activeConversationId === c.id
                          ? "bg-[#111111] text-[#D4AF37] border border-[#D4AF37]/40"
                          : "text-[#BDBDBD] hover:bg-[#0A0A0A] hover:text-[#FFFFFF]"
                      }`}
                    >
                      <span className="truncate flex-1">{c.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(c.id, e)}
                        title="Delete this chat"
                        className="opacity-70 group-hover:opacity-100 text-[#777777] hover:text-[#B22222] p-0.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[#D4AF37]/25 bg-[#0A0A0A]">
            <div className="flex items-center justify-between gap-2">
              <div
                onClick={() => setActiveNav("settings")}
                className="cursor-pointer flex items-center gap-2.5 truncate flex-1"
                title="Open Profile & Settings"
              >
                <div className="w-8 h-8 rounded-full bg-[#111111] border border-[#D4AF37] flex items-center justify-center text-xs font-bold text-[#D4AF37] shrink-0">
                  {userInitials}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold text-[#FFFFFF] truncate hover:text-[#D4AF37]">
                    {currentUser?.full_name || "Guest User"}
                  </div>
                  <div className="text-[10px] text-[#BDBDBD] font-mono truncate">
                    {currentUser?.email || "Omniscient AI"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthModalOpen(true);
                  }}
                  title="Login / Switch Account"
                  className="p-1.5 rounded border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#111111]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-1.5 rounded border border-[#B22222]/50 text-[#B22222] hover:bg-[#B22222]/15"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#000000] overflow-hidden">
        <header className="h-16 shrink-0 px-6 border-b border-[#D4AF37]/25 bg-[#000000] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle Navigation Sidebar"
              className="p-2 rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#111111] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#0A0A0A] border border-[#D4AF37]/60 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <span className="text-sm font-bold tracking-wider text-[#FFFFFF]">OMNISCIENT AI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && activeNav === "general-ai" && (
              <button onClick={exportConversationMarkdown} className="btn-secondary">
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthModalOpen(true);
              }}
              className="btn-secondary"
            >
              <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">Login / Signup</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("settings")}
              className="btn-secondary"
            >
              <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden md:inline">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setTelemetryOpen((v) => !v)}
              title="Toggle Execution Telemetry Panel"
              className="p-2 rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#111111] transition-colors"
            >
              {telemetryOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {activeNav === "general-ai" && (
            <GeneralAiView
              currentUser={currentUser}
              messages={messages}
              setMessages={setMessages}
              activeConversationId={activeConversationId}
              chatBottomRef={chatBottomRef}
              onConversationUpdate={async (convId, intent, trace, citations) => {
                setActiveConversationId(convId);
                setCurrentIntent(intent);
                setWorkflowTrace(trace);
                setActiveCitations(citations);
                await refreshWorkspaceState();
              }}
            />
          )}

          {activeNav === "code-review" && <CodeReviewView />}
          {activeNav === "edtech-lms" && <EdTechView currentUser={currentUser} />}

          {activeNav === "history" && (
            <HistoryView
              conversations={conversations}
              onSelectConversation={selectConversation}
              onDeleteConversation={(id) => handleDeleteConversation(id)}
              onClearAllConversations={handleClearAllConversations}
              onStartNewChat={startNewChat}
            />
          )}

          {activeNav === "settings" && (
            <SettingsView
              currentUser={currentUser}
              memories={memories}
              apiKeySettings={apiKeySettings}
              onUserUpdated={(user) => setCurrentUser(user)}
              onOpenSignupModal={() => {
                setAuthMode("signup");
                setAuthModalOpen(true);
              }}
              onLogout={handleLogout}
              onRefreshState={refreshWorkspaceState}
            />
          )}
        </div>
      </main>

      {/* RIGHT-SIDE EXECUTION TELEMETRY DRAWER */}
      {telemetryOpen && (
        <aside className="w-full lg:w-72 shrink-0 bg-[#000000] border-t lg:border-t-0 lg:border-l border-[#D4AF37]/25 p-5 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/25 pb-3.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFFFFF]">
                Execution Telemetry
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#D4AF37] uppercase">
              {currentIntent}
            </span>
          </div>

          <div className="space-y-3 border-b border-[#D4AF37]/20 pb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#D4AF37]" />
              Active Pipeline Trace ({workflowTrace.length})
            </div>
            {workflowTrace.length === 0 ? (
              <p className="text-xs text-[#777777]">
                Send a prompt in General AI to inspect the 5-stage prompt optimization and
                capability routing trace.
              </p>
            ) : (
              <div className="space-y-3">
                {workflowTrace.map((step: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[#FFFFFF]">
                        #{step.step_index} {step.agent_slug}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-mono ${
                          step.success ? "text-emerald-400" : "text-[#B22222]"
                        }`}
                      >
                        {step.success ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {step.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#BDBDBD]">{step.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 border-b border-[#D4AF37]/20 pb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
              <BookMarked className="w-3.5 h-3.5 text-[#D4AF37]" />
              Grounded Citations ({activeCitations.length})
            </div>
            {activeCitations.length === 0 ? (
              <p className="text-xs text-[#777777]">No citations attached to current step.</p>
            ) : (
              <div className="space-y-2.5">
                {activeCitations.map((cit: any, i: number) => (
                  <div key={i} className="space-y-0.5">
                    <div className="text-xs font-mono font-semibold text-[#D4AF37]">
                      [{cit.citation_id || `CIT-${i + 1}`}] {cit.document_title || cit.title}
                    </div>
                    <p className="text-[11px] text-[#BDBDBD] line-clamp-2">{cit.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFFFFF]">
              Recent Executions ({recentExecutions.length})
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {recentExecutions.slice(0, 8).map((ex: any) => (
                <div key={ex.id} className="flex items-center justify-between text-xs py-1">
                  <span className="font-mono text-[#BDBDBD] truncate max-w-[140px]">
                    {ex.agent_slug}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-emerald-400">
                    {ex.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
