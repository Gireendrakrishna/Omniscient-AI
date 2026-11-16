import React from "react";
import { History, Trash2 } from "lucide-react";

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
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
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
                <div className="text-xs text-[#BDBDBD] mt-0.5">{c.message_count} messages</div>
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
  );
};
