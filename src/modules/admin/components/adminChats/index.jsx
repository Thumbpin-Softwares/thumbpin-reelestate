"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send } from "lucide-react";

const LIST_POLL_MS = 6000;
const THREAD_POLL_MS = 3000;

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AdminChats() {
  const [conversations, setConversations] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const lastTimestampRef = useRef(null);

  async function loadConversations() {
    try {
      const res = await fetch("/api/admin/support/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      console.error("[AdminChats] Failed to load conversations:", err);
      setConversations([]);
    }
  }

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    lastTimestampRef.current = null;
    setMessages([]);
    setThreadLoading(true);

    async function poll() {
      try {
        const since = lastTimestampRef.current;
        const url = since
          ? `/api/admin/support/conversations/${activeId}/messages?since=${encodeURIComponent(since)}`
          : `/api/admin/support/conversations/${activeId}/messages`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.messages.length > 0) {
          setMessages((prev) => (since ? [...prev, ...data.messages] : data.messages));
          lastTimestampRef.current = data.messages[data.messages.length - 1].createdAt;
        }
      } catch (err) {
        console.error("[AdminChats] Thread poll failed:", err);
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, THREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sending || !activeId) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/admin/support/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      setMessages((prev) => [...prev, data.message]);
      lastTimestampRef.current = data.message.createdAt;
      loadConversations();
    } catch (err) {
      toast.error("Reply failed", { description: err.message });
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  const active = conversations?.find((c) => c.id === activeId) || null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[70vh]">
      {/* Conversation list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Conversations
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-6">
              <MessageCircle className="w-6 h-6 text-gray-300" />
              <p className="text-sm text-gray-400">No conversations yet</p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  activeId === c.id ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {c.user?.name || c.user?.email || "Unknown user"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 h-5 min-w-5 px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.lastMessagePreview || "No messages yet"}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(c.lastMessageAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="w-6 h-6 text-gray-300" />
            <p className="text-sm text-gray-400">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{active.user?.name || "Unknown user"}</p>
              <p className="text-xs text-gray-500">{active.user?.email}</p>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        m.senderRole === "admin"
                          ? "bg-gray-900 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.senderRole === "admin" ? "text-gray-300" : "text-gray-400"}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Reply…"
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-gray-900 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
