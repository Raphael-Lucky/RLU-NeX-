import { useEffect, useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  LogOut,
  MoreVertical,
  Pin,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Conversation } from "../lib/supabase";
import NexLogo from "./NexLogo";

interface SidebarProps {
  conversations: Conversation[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching?: boolean;
  activeConversation: Conversation | null;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void | Promise<void>;
  onRename?: (id: string, newTitle: string) => void;
  onLoad: () => void;
  firstName: string;
  onSignOut: () => void;
}

interface MenuState {
  convId: string | null;
  position: { x: number; y: number };
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Sidebar({
  conversations,
  searchQuery,
  onSearchChange,
  isSearching = false,
  activeConversation,
  onSelect,
  onNew,
  onDelete,
  onPin,
  onRename,
  onLoad,
  firstName,
  onSignOut,
}: SidebarProps) {
  // Start closed on mobile, open on desktop
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768);

  const [menu, setMenu] = useState<MenuState>({
    convId: null,
    position: { x: 0, y: 0 },
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  const isSearchActive = searchQuery.trim().length > 0;

  const pinned = isSearchActive
    ? []
    : conversations
        .filter((c) => c.is_pinned)
        .sort((a, b) => {
          const aTime = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
          const bTime = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
          return bTime - aTime;
        });

  const unpinned = isSearchActive
    ? conversations
    : conversations.filter((c) => !c.is_pinned);

  const grouped: Record<string, Conversation[]> = {};
  if (!isSearchActive) {
    unpinned.forEach((c) => {
      const label = formatDate(c.updated_at);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(c);
    });
  }

  const handleMenuClick = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setMenu({
      convId,
      position: {
        x: e.currentTarget.getBoundingClientRect().right,
        y: e.currentTarget.getBoundingClientRect().top,
      },
    });
  };

  const handleRenameStart = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
    setMenu({ convId: null, position: { x: 0, y: 0 } });
  };

  const handleRenameSave = async (convId: string) => {
    if (renameValue.trim() && onRename) {
      await onRename(convId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDeleteClick = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv?.is_pinned) {
      setDeleteWarning(convId);
      setMenu({ convId: null, position: { x: 0, y: 0 } });
    } else {
      setDeleteConfirmation(convId);
      setMenu({ convId: null, position: { x: 0, y: 0 } });
    }
  };

  const handleConfirmDelete = (convId: string) => {
    onDelete(convId);
    setDeleteConfirmation(null);
  };

  const handlePinClick = async (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenu({ convId: null, position: { x: 0, y: 0 } });
    if (!onPin) return;
    await onPin(convId);
  };

  const ConversationItem = ({
    conv,
    showPinState = true,
  }: {
    conv: Conversation;
    showPinState?: boolean;
  }) => {
    const isRenaming = renamingId === conv.id;
    const isPinned = showPinState && Boolean(conv.is_pinned);

    return (
      <div
        key={conv.id}
        className={`group flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-100 ${
          activeConversation?.id === conv.id
            ? "bg-white/[0.08] text-white"
            : isPinned
              ? "text-white/70 hover:text-white hover:bg-blue-500/[0.06]"
              : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
        } ${isRenaming ? "cursor-text" : "cursor-pointer"}`}
        onClick={() => !isRenaming && onSelect(conv)}
      >
        {isPinned ? (
          <Pin size={13} className="shrink-0 text-blue-400/80 fill-blue-400/30" />
        ) : (
          <MessageSquare size={13} className="shrink-0 opacity-60" />
        )}
        {isRenaming ? (
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRenameSave(conv.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSave(conv.id);
              if (e.key === "Escape") setRenamingId(null);
            }}
            className="flex-1 bg-white/[0.1] border border-cyan-500/40 rounded px-2 py-0.5 text-white text-[13px] outline-none"
          />
        ) : (
          <span className="text-[13px] truncate flex-1 leading-snug">
            {conv.title}
          </span>
        )}
        <button
          onClick={(e) => handleMenuClick(e, conv.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all p-0.5 rounded"
        >
          <MoreVertical size={12} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay — closes sidebar when tapping outside */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile toggle button — always visible, outside the sidebar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-30 md:hidden w-8 h-8 rounded-lg bg-[#1a1a1f] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-colors shadow-lg"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <aside
        className={`
          fixed md:relative z-20 md:z-auto
          flex flex-col h-full
          bg-[#0d0d0f] border-r border-white/[0.06]
          transition-all duration-300 ease-in-out
          ${isOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full md:w-16 md:translate-x-0"}
        `}
      >
        {/* Desktop toggle — pinned to right edge */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#0d0d0f] border border-white/[0.08] items-center justify-center text-white/30 hover:text-white transition-colors shadow-md"
        >
          {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Header */}
        <div className={`px-4 pt-5 pb-4 border-b border-white/[0.06] ${!isOpen ? "md:px-2" : ""}`}>
          <div className={`flex items-center gap-2.5 mb-5 ${!isOpen ? "md:justify-center" : ""}`}>
            <NexLogo size={32} className="shadow-lg shadow-cyan-500/20 shrink-0" />
            {isOpen && (
              <div>
                <span className="text-white font-semibold tracking-tight text-[15px]">
                  NeX
                </span>
                <span className="block text-[10px] text-white/30 uppercase tracking-widest">
                  AI Assistant
                </span>
              </div>
            )}
          </div>

          {isOpen ? (
            <>
              <button
                onClick={onNew}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all duration-150 text-sm font-medium group"
              >
                <Plus size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
                New conversation
              </button>

              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-8 py-2 text-[13px] text-white/80 placeholder-white/25 outline-none focus:border-cyan-500/40 focus:bg-white/[0.06] transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-white/30 hover:text-white/70 rounded transition-colors"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={onNew}
              title="New conversation"
              className="w-full flex items-center justify-center py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all duration-150"
            >
              <Plus size={15} />
            </button>
          )}
        </div>

        {/* Conversation List */}
        {isOpen ? (
          <div
            className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin"
            onClick={() => setMenu({ convId: null, position: { x: 0, y: 0 } })}
          >
            {isSearchActive && isSearching && (
              <p className="text-[11px] text-white/25 text-center py-2">Searching...</p>
            )}

            {pinned.length === 0 && unpinned.length === 0 && (
              <div className="text-center py-10 px-4">
                <MessageSquare size={24} className="text-white/10 mx-auto mb-2" />
                <p className="text-white/20 text-xs">
                  {isSearchActive ? "No conversations match your search" : "No conversations yet"}
                </p>
              </div>
            )}

            {isSearchActive && pinned.length + unpinned.length > 0 && (
              <p className="text-[10px] font-medium text-cyan-400/50 uppercase tracking-widest px-2 mb-1">
                {pinned.length + unpinned.length} result
                {pinned.length + unpinned.length === 1 ? "" : "s"}
              </p>
            )}

            {pinned.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-blue-400/70 uppercase tracking-widest px-2 mb-1.5 flex items-center gap-1">
                  <Pin size={10} className="fill-blue-400/40" /> Pinned Topics
                </p>
                {pinned.map((conv) => (
                  <ConversationItem key={conv.id} conv={conv} showPinState />
                ))}
              </div>
            )}

            {isSearchActive
              ? conversations.map((conv) => (
                  <ConversationItem key={conv.id} conv={conv} showPinState={false} />
                ))
              : Object.entries(grouped).map(([label, convs]) => (
                  <div key={label}>
                    <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest px-2 mb-1">
                      {label}
                    </p>
                    {convs.map((conv) => (
                      <ConversationItem key={conv.id} conv={conv} showPinState />
                    ))}
                  </div>
                ))}
          </div>
        ) : (
          /* Collapsed: icon-only list */
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
            {conversations.slice(0, 10).map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                title={conv.title}
                className={`w-full flex items-center justify-center py-2 rounded-lg transition-all duration-100 ${
                  activeConversation?.id === conv.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {conv.is_pinned ? (
                  <Pin size={13} className="text-blue-400/80 fill-blue-400/30" />
                ) : (
                  <MessageSquare size={13} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Context Menu */}
        {menu.convId && (
          <div
            className="fixed z-50 bg-[#1a1a1f] border border-white/[0.08] rounded-lg shadow-xl overflow-hidden"
            style={{
              top: `${menu.position.y}px`,
              left: `${menu.position.x - 160}px`,
            }}
          >
            {onPin && (
              <button
                onClick={() => handlePinClick(menu.convId!)}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/[0.08] text-[13px] transition-all duration-100"
              >
                <Pin
                  size={14}
                  className={
                    conversations.find((c) => c.id === menu.convId)?.is_pinned
                      ? "fill-blue-400/40 text-blue-400"
                      : ""
                  }
                />
                {conversations.find((c) => c.id === menu.convId)?.is_pinned
                  ? "Unpin topic"
                  : "Pin topic"}
              </button>
            )}
            {onRename && (
              <button
                onClick={() => {
                  handleRenameStart(conversations.find((c) => c.id === menu.convId)!);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/[0.08] text-[13px] transition-all duration-100 border-t border-white/[0.08]"
              >
                <span>✏️</span>
                Rename
              </button>
            )}
            <button
              onClick={() => handleDeleteClick(menu.convId!)}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-[13px] transition-all duration-100 border-t border-white/[0.08]"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}

        {/* Delete Pinned Warning */}
        {deleteWarning && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1f] border border-white/[0.08] rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-white font-semibold mb-2">Unpin first</h3>
              <p className="text-white/60 text-[13px] mb-6 leading-relaxed">
                This conversation is pinned. Please unpin it first before deleting.
              </p>
              <button
                onClick={() => setDeleteWarning(null)}
                className="w-full px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-all duration-150 font-medium text-[13px]"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmation && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1f] border border-white/[0.08] rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-white font-semibold mb-2">Delete conversation</h3>
              <p className="text-white/60 text-[13px] mb-6 leading-relaxed">
                Are you sure you want to delete "
                {conversations.find((c) => c.id === deleteConfirmation)?.title || "this conversation"}
                "? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] text-white rounded-lg transition-all duration-150"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDelete(deleteConfirmation!)}
                  className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all duration-150"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {isOpen ? (
          <div className="px-4 py-3 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-cyan-400/80 uppercase">
                    {firstName ? firstName.charAt(0) : "U"}
                  </span>
                </div>
                <span className="text-[12px] text-white/40 truncate">
                  {firstName || "User"}
                </span>
              </div>
              <button
                onClick={onSignOut}
                className="shrink-0 text-white/20 hover:text-red-400/70 transition-colors p-1 rounded"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-white/30 text-center leading-snug">
                Created by{" "}
                <span className="text-cyan-400/70 font-medium">Raphael Lucky Uke</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="px-2 py-3 border-t border-white/[0.06] flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-cyan-400/80 uppercase">
                {firstName ? firstName.charAt(0) : "U"}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="text-white/20 hover:text-red-400/70 transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
