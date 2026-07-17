"use client";

import { useEffect, useState } from "react";
import { Loader2, PlayCircle, AlertCircle, Clock, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STATUS_META = {
  running: { label: "Generating…", icon: Clock, className: "text-amber-500" },
  done: { label: "Ready", icon: PlayCircle, className: "text-emerald-500" },
  error: { label: "Failed", icon: AlertCircle, className: "text-destructive" },
};

function GenerationRow({ job }) {
  const meta = STATUS_META[job.status] || STATUS_META.running;
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 p-3">
      <div className="w-16 h-16 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0 overflow-hidden">
        {job.status === "done" && job.resultUrl ? (
          <video src={job.resultUrl} className="w-full h-full object-cover" muted />
        ) : (
          <Icon className={`w-6 h-6 ${meta.className} ${job.status === "running" ? "animate-pulse" : ""}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.inputs?.propertyName || "Untitled property"}</p>
        <p className={`text-xs ${meta.className}`}>{meta.label}</p>
        {job.status === "error" && job.error && (
          <p className="text-[11px] text-muted-foreground truncate">{job.error}</p>
        )}
      </div>
      {job.status === "done" && job.resultUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={job.resultUrl} target="_blank" rel="noreferrer">
            View
          </a>
        </Button>
      )}
    </div>
  );
}

// Lists the user's own model-tour generations (residential-classification
// runs of this template), including ones still in progress — reading
// GET /api/model-tour/generations, which stays accurate even if the tab
// creating a job was closed or sessionStorage was cleared.
export function ModelTourGenerations({ open, onOpenChange }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/model-tour/generations")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setJobs(data.jobs || []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load your generations");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col min-h-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            My Generations
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-10">{error}</p>
          ) : jobs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No generations yet.</p>
          ) : (
            jobs.map((job) => <GenerationRow key={job._id || job.jobId} job={job} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
