import React, { useRef, useState } from "react";
import {
  BookTemplate,
  Cpu,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { apiRequest } from "../api";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { PromptLibraryModal } from "./PromptLibraryModal";

export interface AttachedFileItem {
  id: string;
  filename: string;
  fileType: string;
  status: "uploading" | "ready" | "error";
  sizeBytes?: number;
}

interface Props {
  currentUser: any;
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  activeConversationId: string | null;
  onConversationUpdate: (
    conversationId: string,
    intent: string,
    trace: any[],
    citations: any[]
  ) => void;
  chatBottomRef: React.RefObject<HTMLDivElement>;
}

export const GeneralAiView: React.FC<Props> = ({
  currentUser,
  messages,
  setMessages,
  activeConversationId,
  onConversationUpdate,
  chatBottomRef,
}) => {
  const [promptInput, setPromptInput] = useState<string>("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [executionStageText, setExecutionStageText] = useState<string>("");
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState<boolean>(false);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
      setAttachedFiles((prev) => [
        ...prev,
        { id: tempId, filename: file.name, fileType: ext, status: "uploading", sizeBytes: file.size },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiRequest("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        const docId = res.file?.id || res.document?.id;
        const docType = (res.document?.doc_type || ext).toUpperCase();
        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  id: docId,
                  filename: res.file?.original_filename || file.name,
                  fileType: docType,
                  status: "ready",
                  sizeBytes: file.size,
                }
              : item
          )
        );
      } catch {
        setAttachedFiles((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, status: "error" } : item))
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (idToRemove: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== idToRemove));
  };

  const handleOptimizePromptInput = async () => {
    if (!promptInput.trim() || isOptimizingPrompt) return;
    setIsOptimizingPrompt(true);
    try {
      const readyIds = attachedFiles.filter((f) => f.status === "ready").map((f) => f.id);
      const res = await apiRequest("/api/prompt-templates/optimize", {
        method: "POST",
        body: JSON.stringify({ prompt: promptInput, attached_file_ids: readyIds }),
      });
      if (res.optimized_prompt) setPromptInput(res.optimized_prompt);
    } catch {
      // ignore
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const handleSendPrompt = async () => {
    const promptToUse = promptInput.trim();
    if (!promptToUse || isStreaming) return;

    const readyAttachments = attachedFiles.filter((f) => f.status === "ready");
    const readyFileIds = readyAttachments.map((f) => f.id);

    setPromptInput("");
    setAttachedFiles([]);

    const tempUserMsg = {
      id: `user-${Date.now()}`,
      sender_role: "user",
      agent_name: "user",
      content: promptToUse,
      attachments: readyAttachments.map((a) => ({
        id: a.id,
        title: a.filename,
        doc_type: a.fileType,
      })),
    };
    const tempAssistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      tempUserMsg,
      {
        id: tempAssistantId,
        sender_role: "assistant",
        agent_name: "general-ai",
        content:
          "Stage 1-3: Analyzing intent & optimizing prompt via LLM...\nStage 4: Routing across specialized capabilities...",
      },
    ]);
    setIsStreaming(true);
    setExecutionStageText("Optimizing Prompt & Routing Capabilities...");

    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptToUse,
          conversation_id: activeConversationId,
          attached_file_ids: readyFileIds,
        }),
      });

      onConversationUpdate(
        res.conversation_id,
        res.intent || "general_ai",
        res.workflow_trace || [],
        res.citations || []
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? {
                id: res.message_id,
                sender_role: "assistant",
                agent_name:
                  res.workflow_trace?.[res.workflow_trace.length - 1]?.agent_slug || "general-ai",
                content: res.response,
                citations: res.citations || [],
                workflow_trace: res.workflow_trace || [],
                attachments: res.generated_images || [],
                optimized_prompt: res.optimized_prompt || "",
                capabilities_used: res.capabilities_used || [],
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId ? { ...m, content: `Execution Error: ${err.message}` } : m
        )
      );
    } finally {
      setIsStreaming(false);
      setExecutionStageText("");
    }
  };

  const handleVoiceInput = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setPromptInput((prev) =>
        prev ? prev : "Explain machine learning and give me 5 multiple-choice questions."
      );
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = "en-US";
    setVoiceActive(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setPromptInput((prev) => `${prev} ${transcript}`.trim());
      setVoiceActive(false);
    };
    recognition.onerror = () => setVoiceActive(false);
    recognition.onend = () => setVoiceActive(false);
    recognition.start();
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-full justify-between">
      <PromptLibraryModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        hasAttachedFiles={attachedFiles.length > 0}
        attachedFilenames={attachedFiles.map((f) => f.filename)}
        onInsertTemplate={(text) => setPromptInput(text)}
      />

      {messages.length === 0 ? (
        <div className="my-auto py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0A0A] border border-[#D4AF37]/60 flex items-center justify-center mx-auto mb-4">
            <Cpu className="w-7 h-7 text-[#D4AF37]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#FFFFFF] tracking-tight">
            Welcome to Omniscient AI
          </h1>
          <p className="text-sm sm:text-base text-[#BDBDBD] max-w-xl mx-auto leading-relaxed">
            Your intelligent workspace for reasoning, research, coding, creativity, and learning.
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-5 rounded-xl border ${
                msg.sender_role === "user"
                  ? "bg-[#0A0A0A] border-[#D4AF37]/25 ml-6 sm:ml-14"
                  : "bg-[#111111] border-[#D4AF37]/45 mr-2 sm:mr-8"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-mono">
                  {msg.sender_role === "user" ? currentUser?.full_name || "You" : "OMNISCIENT AI"}
                </span>

                {msg.workflow_trace?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {msg.workflow_trace.map((st: any, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#000000] border border-[#D4AF37]/30 text-[#D4AF37]"
                      >
                        {st.agent_slug}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.sender_role === "user" && msg.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((att: any, aIdx: number) => (
                    <span
                      key={aIdx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] border border-[#D4AF37]/40 text-xs text-[#D4AF37]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{att.title}</span>
                      <span className="text-[10px] text-[#BDBDBD] font-mono">
                        ({att.doc_type})
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {msg.sender_role === "assistant" && msg.optimized_prompt && (
                <details className="mb-3 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/20 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-[#BDBDBD] hover:text-[#D4AF37] font-medium flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>View LLM-Optimized Task Prompt</span>
                  </summary>
                  <pre className="mt-2 pt-2 border-t border-[#D4AF37]/15 text-[11px] font-mono text-[#BDBDBD] whitespace-pre-wrap">
                    {msg.optimized_prompt}
                  </pre>
                </details>
              )}

              <MarkdownRenderer content={msg.content} />

              {msg.sender_role === "assistant" && msg.attachments?.length > 0 && (
                <div className="mt-4 space-y-3">
                  {msg.attachments.map((img: any, imgIdx: number) =>
                    img.image_url ? (
                      <div
                        key={imgIdx}
                        className="p-3 rounded-xl border border-[#D4AF37]/40 bg-[#0A0A0A]"
                      >
                        <img
                          src={img.image_url}
                          alt={img.original_prompt || "Generated visual"}
                          className="rounded-lg w-full max-h-96 object-contain mx-auto"
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {msg.citations?.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-[#D4AF37]/20 flex flex-wrap gap-2">
                  {msg.citations.map((c: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-[#000000] border border-[#D4AF37]/40 text-[11px] font-mono text-[#D4AF37]"
                    >
                      [{c.citation_id || `REF-${idx + 1}`}] {c.document_title || c.title}
                      {c.page_number ? ` (p.${c.page_number})` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
      )}

      {isStreaming && executionStageText && (
        <div className="mb-2 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/40 text-xs text-[#D4AF37]">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>{executionStageText}</span>
        </div>
      )}

      <div className="sticky bottom-0 pt-3 bg-[#000000]">
        <div className="rounded-xl border border-[#D4AF37]/50 bg-[#0A0A0A] p-3.5 space-y-2.5">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2 border-b border-[#D4AF37]/20">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#000000] border border-[#D4AF37]/45 text-xs"
                >
                  {["PNG", "JPG", "JPEG", "WEBP", "IMAGE"].includes(file.fileType) ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                  )}
                  <span className="font-medium text-[#FFFFFF] max-w-[180px] truncate">
                    {file.filename}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111111] text-[10px] font-mono text-[#D4AF37]">
                    {file.fileType}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      file.status === "ready"
                        ? "text-emerald-400"
                        : file.status === "uploading"
                        ? "text-[#D4AF37]"
                        : "text-[#B22222]"
                    }`}
                  >
                    {file.status === "ready"
                      ? "Ready"
                      : file.status === "uploading"
                      ? "Processing..."
                      : "Error"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(file.id)}
                    className="text-[#777777] hover:text-[#B22222] ml-1"
                    title="Remove attached file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            rows={3}
            placeholder="Ask anything, attach PDFs/Excel/screenshots, request web research, or generate images..."
            className="w-full bg-transparent text-sm text-[#FFFFFF] placeholder-[#777777] outline-none resize-none px-2 py-1"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#D4AF37]/20">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF, DOCX, PPTX, XLSX, CSV, TXT, PNG, JPG, JPEG, or WEBP"
                className="btn-secondary px-3 py-1.5"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Attach File / Image</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                title="Open Prompt Template Library"
                className="btn-secondary px-3 py-1.5"
              >
                <BookTemplate className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Prompt Templates</span>
              </button>

              {promptInput.trim().length > 3 && (
                <button
                  type="button"
                  onClick={handleOptimizePromptInput}
                  disabled={isOptimizingPrompt}
                  title="Optimize & structure your prompt using the LLM Prompt Template Engine"
                  className="btn-secondary px-3 py-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{isOptimizingPrompt ? "Optimizing..." : "Optimize Prompt"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleVoiceInput}
                title="Voice Input"
                className={voiceActive ? "btn-destructive px-3 py-1.5" : "btn-secondary px-3 py-1.5"}
              >
                <Mic className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">{voiceActive ? "Listening..." : "Voice"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendPrompt}
              disabled={isStreaming || !promptInput.trim()}
              className="btn-primary px-5 py-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isStreaming ? "Executing..." : "Send"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
