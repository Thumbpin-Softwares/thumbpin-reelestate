"use client";

import { useEffect, useState } from "react";
import { Loader2, Ticket as TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appNotify } from "@/modules/common/components/notification";

const PRIORITIES = ["low", "medium", "high"];

const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_BADGE_CLASS = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-neutral-200 text-neutral-600",
};

export function RaiseTicket() {
  const [tickets, setTickets] = useState(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  async function loadTickets() {
    try {
      const res = await fetch("/api/support/tickets");
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.tickets);
    } catch (err) {
      console.error("[RaiseTicket] Failed to load tickets:", err);
      setTickets([]);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to raise ticket");

      setTickets((prev) => [data.ticket, ...(prev || [])]);
      setSubject("");
      setDescription("");
      setPriority("medium");
      appNotify.success("Ticket raised", {
        description: "Our team will get back to you soon.",
      });
    } catch (err) {
      appNotify.error("Failed to raise ticket", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border/50 bg-white p-5 space-y-4 h-fit">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's the issue about?"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail…"
            rows={5}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Priority</label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={submitting || !subject.trim() || !description.trim()}
          className="w-full gap-2 bg-black text-[#c7f038] hover:bg-black hover:opacity-90"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Raise Ticket
        </Button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your tickets</h3>
        {tickets === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 flex flex-col items-center gap-2 text-center">
            <TicketIcon className="w-6 h-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tickets raised yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{t.subject}</p>
                  <Badge className={`shrink-0 ${STATUS_BADGE_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground capitalize">{t.priority} priority</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
