"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  MessageSquarePlus,
} from "lucide-react";

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full pr-4 hover:bg-neutral-100 flex items-center cursor-pointer"
      >
        <HelpCircle size={24} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg py-1 z-50">
          <Link
            href="/dashboard/help"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Help Center</span>
          </Link>

          <Link
            href="mailto:support@thumbpin.ai"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>Chat with us</span>
          </Link>

          <div className="h-px bg-neutral-200 my-1" />

          <Link
            href="mailto:feedback@thumbpin.ai"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            <span>Feedback</span>
          </Link>
        </div>
      )}
    </div>
  );
}
