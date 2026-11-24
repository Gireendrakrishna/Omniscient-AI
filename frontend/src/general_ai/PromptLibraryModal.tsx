import React, { useEffect, useMemo, useState } from "react";
import { BookTemplate, Edit3, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { apiRequest } from "../api";
import { createDebouncedTask } from "../utils/asyncRuntime";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hasAttachedFiles: boolean;
  attachedFilenames: string[];
  onInsertTemplate: (promptText: string) => void;
}

export const PromptLibraryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  hasAttachedFiles,
  attachedFilenames,
  onInsertTemplate,
}) => {
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<any[]>([]);
  const [templateCategories, setTemplateCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [includeDocContext, setIncludeDocContext] = useState<boolean>(true);

  const [customFormOpen, setCustomFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("CUSTOM");
  const [description, setDescription] = useState<string>("");
  const [promptText, setPromptText] = useState<string>("");

  const loadTemplates = async (search = searchQuery, cat = selectedCategory) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (cat && cat !== "ALL") params.set("category", cat);
      const res = await apiRequest(`/api/prompt-templates?${params.toString()}`);
      setTemplatesList(res.templates || []);
      setRecentTemplates(res.recently_used || []);
      setTemplateCategories(["ALL", ...(res.categories || [])]);
    } catch {
      // ignore
    }
  };

  const debouncedSearch = useMemo(() => createDebouncedTask(180), []);

  useEffect(() => {
    if (isOpen) {
      debouncedSearch(() => {
        loadTemplates(searchQuery, selectedCategory);
      });
    }
  }, [isOpen, searchQuery, selectedCategory, debouncedSearch]);

  if (!isOpen) return null;

  const handleSelect = async (tpl: any) => {
    let text = tpl.prompt_text;
    if (includeDocContext && hasAttachedFiles && attachedFilenames.length > 0) {
      text += `\n\nCONTEXT FILES:\nUse the attached document(s) (${attachedFilenames.join(
        ", "
      )}) as the primary reference source.`;
    }
    onInsertTemplate(text);
    onClose();
    try {
      await apiRequest(`/api/prompt-templates/${tpl.id}/use`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptText.trim()) return;
    try {
      if (editingId) {
        await apiRequest(`/api/prompt-templates/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ title, category, description, prompt_text: promptText }),
        });
      } else {
        await apiRequest("/api/prompt-templates", {
          method: "POST",
          body: JSON.stringify({ title, category, description, prompt_text: promptText }),
        });
      }
      setTitle("");
      setDescription("");
      setPromptText("");
      setEditingId(null);
      setCustomFormOpen(false);
      await loadTemplates(searchQuery, selectedCategory);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (tplId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/api/prompt-templates/${tplId}`, { method: "DELETE" });
      await loadTemplates(searchQuery, selectedCategory);
    } catch {
      // ignore
    }
  };

  const cats =
    templateCategories.length > 0
      ? templateCategories
      : [
          "ALL",
          "EDUCATION",
          "PROGRAMMING",
          "DOCUMENTS",
          "RESEARCH",
          "WRITING",
          "IMAGE AND CREATIVE",
          "CUSTOM",
        ];

  return (
    <div className="fixed inset-0 z-50 bg-[#000000]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl border border-[#D4AF37] bg-[#0A0A0A] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-[#D4AF37]/25 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#000000] border border-[#D4AF37] flex items-center justify-center">
              <BookTemplate className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FFFFFF]">
                Intelligent Prompt Template Library
              </h2>
              <p className="text-xs text-[#BDBDBD]">
                Select a structured template across 6 categories or save your own custom templates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setDescription("");
                setPromptText(
                  "ROLE:\nYou are an expert specialist.\n\nTASK:\n[Describe Task]\n\nREQUIREMENTS:\n1. ...\n\nOUTPUT FORMAT:\nStructured Markdown."
                );
                setCustomFormOpen((v) => !v);
              }}
              className="btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              {customFormOpen ? "Back to Library" : "New Custom Template"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-2.5 py-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {customFormOpen ? (
          <form onSubmit={handleSaveCustom} className="p-6 space-y-4 overflow-y-auto">
            <h3 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider">
              {editingId ? "Edit Prompt Template" : "Create & Save Custom Prompt Template"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                  Template Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., System Architecture Critique"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="CUSTOM">CUSTOM</option>
                  <option value="EDUCATION">EDUCATION</option>
                  <option value="PROGRAMMING">PROGRAMMING</option>
                  <option value="DOCUMENTS">DOCUMENTS</option>
                  <option value="RESEARCH">RESEARCH</option>
                  <option value="WRITING">WRITING</option>
                  <option value="IMAGE AND CREATIVE">IMAGE AND CREATIVE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this template does..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#BDBDBD] mb-1">
                Structured Prompt Template Text
              </label>
              <textarea
                rows={8}
                required
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="input-field w-full font-mono"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">
                Save Persistent Template
              </button>
              <button
                type="button"
                onClick={() => setCustomFormOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-[#777777] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates by title, category, or keyword..."
                  className="input-field w-full pl-9"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#BDBDBD] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDocContext}
                  onChange={(e) => setIncludeDocContext(e.target.checked)}
                />
                <span>Include attached document context when inserting</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cats.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${
                    selectedCategory === cat
                      ? "bg-[#FFFFFF] text-[#000000] border-[#FFFFFF]"
                      : "bg-[#000000] text-[#BDBDBD] border-[#D4AF37]/30 hover:border-[#D4AF37] hover:text-[#FFFFFF]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {recentTemplates.length > 0 && selectedCategory === "ALL" && !searchQuery && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">
                  Recently Used
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentTemplates.slice(0, 4).map((rt) => (
                    <button
                      key={`recent-${rt.id}`}
                      type="button"
                      onClick={() => handleSelect(rt)}
                      className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#D4AF37]/40 hover:border-[#D4AF37] text-xs text-[#FFFFFF] flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                      <span>{rt.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
              {templatesList.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelect(tpl)}
                  className="cursor-pointer p-4 rounded-xl border border-[#D4AF37]/25 bg-[#111111] hover:border-[#D4AF37] transition-all flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#000000] border border-[#D4AF37]/30 text-[#D4AF37]">
                        {tpl.category}
                      </span>
                      {tpl.is_custom && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(tpl.id);
                              setTitle(tpl.title);
                              setCategory(tpl.category);
                              setDescription(tpl.description);
                              setPromptText(tpl.prompt_text);
                              setCustomFormOpen(true);
                            }}
                            className="p-1 text-[#BDBDBD] hover:text-[#D4AF37]"
                            title="Edit custom template"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(tpl.id, e)}
                            className="p-1 text-[#BDBDBD] hover:text-[#B22222]"
                            title="Delete custom template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#FFFFFF]">{tpl.title}</h4>
                    <p className="text-xs text-[#BDBDBD] line-clamp-2">{tpl.description}</p>
                  </div>
                  <div className="text-[11px] text-[#D4AF37] font-medium pt-1">
                    Click to insert into General AI →
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
