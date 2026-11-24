import React, { useEffect, useState } from "react";
import { History, Pin, Plus, StickyNote, Trash2 } from "lucide-react";
import { apiRequest } from "../api";

interface Props {
  conversations: any[];
  onSelectConversation: (convId: string) => void;
  onDeleteConversation: (convId: string) => void;
  onClearAllConversations: () => void;
  onStartNewChat: () => void;
}

export const HistoryView: React.FC<Props> = ({
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onClearAllConversations,
  onStartNewChat,
}) => {
  // MongoDB NoSQL Schema-Validated Research Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [noteStorage, setNoteStorage] = useState<string>("mongo-schema-local");
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [noteContent, setNoteContent] = useState<string>("");
  const [noteCategory, setNoteCategory] = useState<string>("research");
  const [noteTags, setNoteTags] = useState<string>("ai, architecture");

  const loadNotes = async () => {
    try {
      const res = await apiRequest("/api/notes");
      setNotes(res.notes || []);
      if (res.storage) setNoteStorage(res.storage);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    await apiRequest("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        title: noteTitle,
        content: noteContent,
        category: noteCategory,
        tags: noteTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        pinned: false,
      }),
    });
    setNoteTitle("");
    setNoteContent("");
    await loadNotes();
  };

  const handleTogglePinNote = async (note: any) => {
    await apiRequest(`/api/notes/${note.id}`, {
      method: "PUT",
      body: JSON.stringify({
        pinned: !note.metadata?.pinned,
      }),
    });
    await loadNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await apiRequest(`/api/notes/${noteId}`, { method: "DELETE" });
    await loadNotes();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. SQL Conversation History */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/25 pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#FFFFFF] flex items-center gap-2.5">
              <History className="w-5 h-5 text-[#D4AF37]" />
              Conversation History ({conversations.length})
            </h2>
            <p className="text-xs text-[#BDBDBD] mt-0.5">
              Resume any saved General AI session or delete individual / all chat history.
            </p>
          </div>

          {conversations.length > 0 && (
            <button onClick={onClearAllConversations} className="btn-destructive">
              <Trash2 className="w-4 h-4" />
              Clear All Chat History
            </button>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="surface-card text-center py-12 space-y-3">
            <p className="text-sm text-[#BDBDBD]">No saved chat sessions in history.</p>
            <button onClick={onStartNewChat} className="btn-primary">
              Start a New Chat
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((c) => (
              <div
                key={c.id}
                className="surface-card flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <div className="text-sm font-bold text-[#FFFFFF]">{c.title}</div>
                  <div className="text-xs text-[#BDBDBD] mt-0.5">
                    {c.message_count} messages • {c.author_name || "Omniscient User"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onSelectConversation(c.id)} className="btn-primary">
                    Open Session
                  </button>
                  <button
                    onClick={() => onDeleteConversation(c.id)}
                    className="btn-destructive"
                    title="Delete this conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. NoSQL MongoDB Research Notes CRUD */}
      <div className="surface-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/20 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#FFFFFF] flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-[#D4AF37]" />
              Workspace Research Notes
            </h3>
            <p className="text-xs text-[#BDBDBD] mt-0.5">
              Schema-validated NoSQL document notes with embedded metadata & tag arrays ({noteStorage}).
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateNote} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note title..."
              className="input-field"
            />
            <select
              value={noteCategory}
              onChange={(e) => setNoteCategory(e.target.value)}
              className="input-field"
            >
              <option value="research">research</option>
              <option value="general">general</option>
              <option value="code">code</option>
              <option value="edtech">edtech</option>
            </select>
            <input
              type="text"
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="Tags (comma separated)..."
              className="input-field"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              required
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Capture research findings, code snippets, or key takeaways..."
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary self-end">
              <Plus className="w-4 h-4" />
              Save Note
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-xl border border-[#D4AF37]/25 bg-[#0A0A0A] space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#000000] border border-[#D4AF37]/30 text-[#D4AF37]">
                    {n.category} • {n.metadata?.word_count || 0} words
                  </span>
                  <h4 className="text-sm font-bold text-[#FFFFFF] mt-1">{n.title}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePinNote(n)}
                    className={`p-1.5 rounded border ${
                      n.metadata?.pinned
                        ? "border-[#D4AF37] text-[#D4AF37] bg-[#111111]"
                        : "border-[#D4AF37]/20 text-[#777777] hover:text-[#FFFFFF]"
                    }`}
                    title="Pin / Unpin note"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(n.id)}
                    className="p-1.5 rounded border border-[#B22222]/40 text-[#B22222] hover:bg-[#B22222]/15"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#BDBDBD] whitespace-pre-wrap">{n.content}</p>
              {n.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {n.tags.map((t: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111111] text-[#D4AF37]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
