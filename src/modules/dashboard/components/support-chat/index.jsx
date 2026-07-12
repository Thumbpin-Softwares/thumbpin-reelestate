"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appNotify } from "@/modules/common/components/notification";

const POLL_INTERVAL_MS = 4000;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Polling-based chat (no WebSocket infra needed) — same message shape/API
// would work with a real socket later without touching this component's UI.
export function SupportChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const lastTimestampRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const since = lastTimestampRef.current;
        const url = since ? `/api/support/messages?since=${encodeURIComponent(since)}` : "/api/support/messages";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.messages.length > 0) {
          setMessages((prev) => (since ? [...prev, ...data.messages] : data.messages));
          lastTimestampRef.current = data.messages[data.messages.length - 1].createdAt;
        }
      } catch (err) {
        console.error("[SupportChat] Poll failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setMessages((prev) => [...prev, data.message]);
      lastTimestampRef.current = data.message.createdAt;
    } catch (err) {
      appNotify.error("Message not sent", { description: err.message });
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[65vh] flex-col overflow-hidden rounded-[32px] border border-[#c7f038]/20 bg-white/85 shadow-[0_20px_60px_rgba(199,240,56,0.12)] backdrop-blur-xl">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-[#f8fce8]/40 to-white p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1">
            <p className="text-sm font-medium text-muted-foreground">Say hello 👋</p>
            <p className="text-xs text-muted-foreground/70">Our team usually replies within a few hours.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.senderRole === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  m.senderRole === "user"
                    ? "bg-[#111111] text-[#c7f038] rounded-br-sm shadow-lg"
                    : "bg-white border border-neutral-100 text-neutral-900 rounded-bl-sm shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap wrap-break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.senderRole === "user" ? "text-[#c7f038]/60" : "text-muted-foreground"}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-[#c7f038]/10 bg-white/70 p-4 backdrop-blur-sm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#c7f038] focus:ring-4 focus:ring-[#c7f038]/10"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="h-11 w-11 shrink-0 rounded-2xl bg-[#c7f038] p-0 text-black shadow-sm hover:bg-[#b7df33]"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
