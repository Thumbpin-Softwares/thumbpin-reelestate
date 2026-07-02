"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InviteButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg py-2 px-4 hover:bg-neutral-200 flex gap-2 items-center cursor-pointer ring-0"
        title="Invite"
      >
        <UserPlus size={14} />
        <span className="text-black text-sm">Invite</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Invite teammates</DialogTitle>
          </DialogHeader>
          <p className="py-6 text-sm text-muted-foreground">Coming soon</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
