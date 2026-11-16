import React, { useEffect, useState } from "react";
import { LogOut, Sparkles, Trash2, User, UserCheck, UserPlus } from "lucide-react";
import { apiRequest } from "../api";

interface Props {
  currentUser: any;
  memories: any[];
  apiKeySettings: any;
  onUserUpdated: (user: any) => void;
  onOpenSignupModal: () => void;
  onLogout: () => void;
  onRefreshState: () => Promise<void>;
}

export const SettingsView: React.FC<Props> = ({
  currentUser,
  memories,
  apiKeySettings,
  onUserUpdated,
  onOpenSignupModal,
  onLogout,
  onRefreshState,
}) => {
  const [profName, setProfName] = useState<string>(currentUser?.full_name || "");
  const [profInstitution, setProfInstitution] = useState<string>(currentUser?.institution || "");
  const [profDepartment, setProfDepartment] = useState<string>(currentUser?.department || "");
  const [profBanner, setProfBanner] = useState<string | null>(null);

  const [activeLlmProvider, setActiveLlmProvider] = useState<string>(
    apiKeySettings?.active_llm_provider || "groq"
  );
  const [groqApiKeyInput, setGroqApiKeyInput] = useState<string>("");
  const [groqModelInput, setGroqModelInput] = useState<string>(
    apiKeySettings?.groq_model || "openai/gpt-oss-120b"
  );
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>("");
  const [geminiModelInput, setGeminiModelInput] = useState<string>(
    apiKeySettings?.gemini_model || "gemini-2.5-flash"
  );
  const [imageApiKeyInput, setImageApiKeyInput] = useState<string>("");
  const [webSearchApiKeyInput, setWebSearchApiKeyInput] = useState<string>("");
  const [showKeyText, setShowKeyText] = useState<boolean>(false);
  const [apiKeyStatusBanner, setApiKeyStatusBanner] = useState<string | null>(null);
  const [connectionTestResult, setConnectionTestResult] = useState<any | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);

  const [newMemKey, setNewMemKey] = useState<string>("");
  const [newMemContent, setNewMemContent] = useState<string>("");

  useEffect(() => {
    if (currentUser) {
      setProfName(currentUser.full_name || "");
      setProfInstitution(currentUser.institution || "Omniscient AI University");
      setProfDepartment(currentUser.department || "Computer Science & AI");
    }
  }, [currentUser]);

  useEffect(() => {
    if (apiKeySettings) {
      setActiveLlmProvider(apiKeySettings.active_llm_provider || "groq");
      setGroqModelInput(apiKeySettings.groq_model || "openai/gpt-oss-120b");
      setGeminiModelInput(apiKeySettings.gemini_model || "gemini-2.5-flash");
    }
  }, [apiKeySettings]);

  const userInitials = (currentUser?.full_name || "OM")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfBanner(null);
    try {
      const res = await apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: profName,
          institution: profInstitution,
          department: profDepartment,
        }),
      });
      onUserUpdated(res.user);
      setProfBanner("Profile updated successfully.");
    } catch (err: any) {
      setProfBanner(`Error updating profile: ${err.message}`);
    }
  };

  const handleSaveApiKeys = async () => {
    setApiKeyStatusBanner(null);
    try {
      const res = await apiRequest("/api/settings/api-keys", {
        method: "POST",
        body: JSON.stringify({
          ACTIVE_LLM_PROVIDER: activeLlmProvider,
          GROQ_API_KEY: groqApiKeyInput || undefined,
          GROQ_MODEL: groqModelInput,
          GEMINI_API_KEY: geminiApiKeyInput || undefined,
          GEMINI_MODEL: geminiModelInput,
          IMAGE_GENERATION_API_KEY: imageApiKeyInput || undefined,
          WEB_SEARCH_API_KEY: webSearchApiKeyInput || undefined,
        }),
      });
      setGroqApiKeyInput("");
      setGeminiApiKeyInput("");
      setImageApiKeyInput("");
      setWebSearchApiKeyInput("");
      setApiKeyStatusBanner(
        `Configuration saved. Active LLM: ${res.providers?.llm?.provider} (${res.providers?.llm?.model})`
      );
      await onRefreshState();
    } catch (err: any) {
      setApiKeyStatusBanner(`Failed to save API keys: ${err.message}`);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await apiRequest("/api/settings/api-keys/test", { method: "POST" });
      setConnectionTestResult(res);
    } catch (err: any) {
      setConnectionTestResult({ success: false, error: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateMemory = async () => {
    if (!newMemKey.trim() || !newMemContent.trim()) return;
    await apiRequest("/api/memory", {
      method: "POST",
      body: JSON.stringify({
        key: newMemKey,
        content: newMemContent,
        memory_type: "user_preference",
        is_user_approved: true,
      }),
    });
    setNewMemKey("");
    setNewMemContent("");
    await onRefreshState();
  };

  const handleToggleMemory = async (mem: any) => {
    await apiRequest(`/api/memory/${mem.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_user_approved: !mem.is_user_approved }),
    });
    await onRefreshState();
  };

  const handleDeleteMemory = async (memId: string) => {
    await apiRequest(`/api/memory/${memId}`, { method: "DELETE" });
    await onRefreshState();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. User Profile */}
      <div className="surface-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D4AF37]/20 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] flex items-center justify-center text-base font-bold text-[#D4AF37]">
              {userInitials}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#FFFFFF] flex items-center gap-2">
                <User className="w-4 h-4 text-[#D4AF37]" />
                {currentUser?.full_name || "User Profile"}
              </h3>
              <p className="text-xs text-[#BDBDBD]">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onOpenSignupModal} className="btn-secondary">
              <UserPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
              New Account
            </button>
            <button type="button" onClick={onLogout} className="btn-destructive">
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </div>

        {profBanner && (
          <div className="p-3 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/50 text-xs text-[#FFFFFF]">
            {profBanner}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Institution
              </label>
              <input
                type="text"
                value={profInstitution}
                onChange={(e) => setProfInstitution(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Department
              </label>
              <input
                type="text"
                value={profDepartment}
                onChange={(e) => setProfDepartment(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            <UserCheck className="w-4 h-4" />
            Save Profile
          </button>
        </form>
      </div>

      {/* 2. API Key & Provider Configuration */}
      <div className="surface-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/20 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#FFFFFF] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              AI Provider & API Key Configuration
            </h3>
            <p className="text-xs text-[#BDBDBD] mt-0.5">
              Configure LLM, Vision, Image Generation, and Web Search providers at runtime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyText((v) => !v)}
            className="btn-secondary"
          >
            {showKeyText ? "Hide Key Input" : "Show Key Input"}
          </button>
        </div>

        {apiKeyStatusBanner && (
          <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/50 text-xs text-[#FFFFFF]">
            {apiKeyStatusBanner}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1.5">
              Preferred LLM Provider
            </label>
            <select
              value={activeLlmProvider}
              onChange={(e) => setActiveLlmProvider(e.target.value)}
              className="input-field w-full font-semibold"
            >
              <option value="auto">Auto (Prefer Groq / Gemini if set)</option>
              <option value="groq">Groq Cloud LPU</option>
              <option value="gemini">Google Gemini API</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1.5">
              Groq Model
            </label>
            <select
              value={groqModelInput}
              onChange={(e) => setGroqModelInput(e.target.value)}
              className="input-field w-full"
            >
              <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Default Agent)</option>
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
              <option value="openai/gpt-oss-20b">openai/gpt-oss-20b</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1.5">
              Gemini Model
            </label>
            <select
              value={geminiModelInput}
              onChange={(e) => setGeminiModelInput(e.target.value)}
              className="input-field w-full"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase text-[#D4AF37]">
                GROQ_API_KEY
              </label>
              <span className="text-[10px] font-mono text-[#BDBDBD]">
                {apiKeySettings?.keys?.GROQ_API_KEY?.configured
                  ? `Active: ${apiKeySettings.keys.GROQ_API_KEY.masked}`
                  : "Not Set"}
              </span>
            </div>
            <input
              type={showKeyText ? "text" : "password"}
              value={groqApiKeyInput}
              onChange={(e) => setGroqApiKeyInput(e.target.value)}
              placeholder={
                apiKeySettings?.keys?.GROQ_API_KEY?.configured
                  ? `Current: ${apiKeySettings.keys.GROQ_API_KEY.masked} (Enter new key to replace)`
                  : "Enter Groq API Key (gsk_...)"
              }
              className="input-field w-full font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase text-[#BDBDBD]">
                GEMINI_API_KEY
              </label>
              <span className="text-[10px] font-mono text-[#777777]">
                {apiKeySettings?.keys?.GEMINI_API_KEY?.configured
                  ? `Active: ${apiKeySettings.keys.GEMINI_API_KEY.masked}`
                  : "Not Set"}
              </span>
            </div>
            <input
              type={showKeyText ? "text" : "password"}
              value={geminiApiKeyInput}
              onChange={(e) => setGeminiApiKeyInput(e.target.value)}
              placeholder="Enter Google Gemini API Key (AIza...)"
              className="input-field w-full font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase text-[#BDBDBD]">
                IMAGE_GENERATION_API_KEY
              </label>
              <span className="text-[10px] font-mono text-[#777777]">
                {apiKeySettings?.keys?.IMAGE_GENERATION_API_KEY?.configured
                  ? `Active: ${apiKeySettings.keys.IMAGE_GENERATION_API_KEY.masked}`
                  : "Built-In SVG Studio Active"}
              </span>
            </div>
            <input
              type={showKeyText ? "text" : "password"}
              value={imageApiKeyInput}
              onChange={(e) => setImageApiKeyInput(e.target.value)}
              placeholder="Enter Imagen 3 / DALL-E API Key..."
              className="input-field w-full font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase text-[#BDBDBD]">
                WEB_SEARCH_API_KEY
              </label>
              <span className="text-[10px] font-mono text-[#777777]">
                {apiKeySettings?.keys?.WEB_SEARCH_API_KEY?.configured
                  ? `Active: ${apiKeySettings.keys.WEB_SEARCH_API_KEY.masked}`
                  : "DuckDuckGo (ddgs) Active"}
              </span>
            </div>
            <input
              type={showKeyText ? "text" : "password"}
              value={webSearchApiKeyInput}
              onChange={(e) => setWebSearchApiKeyInput(e.target.value)}
              placeholder="Enter Tavily Web Search API Key (tvly-...)"
              className="input-field w-full font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" onClick={handleSaveApiKeys} className="btn-primary">
            Save & Activate API Keys
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="btn-secondary"
          >
            {testingConnection ? "Testing Connection..." : "Test Live LLM Connection"}
          </button>
        </div>

        {connectionTestResult && (
          <div
            className={`p-4 rounded-lg border text-xs space-y-1 ${
              connectionTestResult.success
                ? "bg-[#0A0A0A] border-[#D4AF37]/50 text-[#FFFFFF]"
                : "bg-[#0A0A0A] border-[#B22222] text-[#B22222]"
            }`}
          >
            {connectionTestResult.success ? (
              <>
                <div className="font-bold text-[#D4AF37]">
                  ✓ Live Connection Verified ({connectionTestResult.provider} •{" "}
                  {connectionTestResult.model} • {connectionTestResult.latency_ms} ms)
                </div>
                <div className="text-[#BDBDBD]">{connectionTestResult.reply}</div>
              </>
            ) : (
              <div>
                <span className="font-bold">Connection Test Failed:</span>{" "}
                {connectionTestResult.error || connectionTestResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Persistent User-Approved Memory Controls */}
      <div className="surface-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#FFFFFF]">Persistent User-Approved Memory</h3>
          <p className="text-xs text-[#BDBDBD] mt-0.5">
            Short-term conversational state is separated from persistent memory. Sensitive uploaded
            document contents are never automatically stored as permanent memory.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={newMemKey}
            onChange={(e) => setNewMemKey(e.target.value)}
            placeholder="Preference key (e.g. coding_style)..."
            className="input-field"
          />
          <input
            type="text"
            value={newMemContent}
            onChange={(e) => setNewMemContent(e.target.value)}
            placeholder="Memory content (e.g. Prefer Python with type hints)..."
            className="input-field"
          />
          <button onClick={handleCreateMemory} className="btn-primary">
            + Save Approved Memory
          </button>
        </div>

        <div className="space-y-2.5">
          {memories.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-lg border border-[#D4AF37]/25 bg-[#0A0A0A] flex items-center justify-between gap-2"
            >
              <div>
                <span className="text-xs font-mono font-bold text-[#D4AF37]">{m.key}:</span>{" "}
                <span className="text-xs text-[#FFFFFF]">{m.content}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleMemory(m)}
                  className={
                    m.is_user_approved ? "btn-primary py-1 px-2.5" : "btn-secondary py-1 px-2.5"
                  }
                >
                  {m.is_user_approved ? "Approved" : "Pending"}
                </button>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  className="btn-destructive py-1 px-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
