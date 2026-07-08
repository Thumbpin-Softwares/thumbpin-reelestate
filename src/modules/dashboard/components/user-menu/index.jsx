"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { User as UserIcon, LogOut, CreditCard, HelpCircle } from "lucide-react";

export default function UserMenu({ user, initials }) {
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
        className="h-10 w-10 rounded-full border border-black overflow-hidden cursor-pointer flex items-center justify-center"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="h-8 w-8 rounded-full bg-black text-[#c7f038] text-md flex items-center justify-center">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg py-1 z-50">
          <div className="bg-neutral-200 my-1" />
          <Link
            href="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 duration-300 cursor-pointer"
          >
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </Link>

          <Link
            href="/dashboard/credits"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing & Credits</span>
          </Link>

          <Link
            href="/dashboard/help"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Support</span>
          </Link>

          <div className="h-px bg-neutral-200 my-1" />

          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-neutral-100 cursor-pointer text-left"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
