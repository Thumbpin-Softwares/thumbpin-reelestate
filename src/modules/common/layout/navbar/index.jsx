"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  FolderOpen,
  Plus,
  Pencil,
  Megaphone,
  User as UserIcon,
  LogOut,
  Menu,
  BookOpen,
  MessageCircle,
  UserPlus,
  RectangleGoggles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreditsBadge } from "@/components/dashboard/credits-badge";
import UserMenu from "@/modules/dashboard/components/user-menu";
import HelpMenu from "@/modules/dashboard/components/help-menu";

const navItems = [
  { label: "Get Started", href: "/app", icon: Plus },
  { label: "Library", href: "/app/assets", icon: FolderOpen },
  { label: "Edit", href: "/app/edit", icon: Pencil },
  { label: "Help Center", href: "/app/help", icon: BookOpen },
  { label: "Chat with us", href: "mailto:support@thumbpin.ai", icon: MessageCircle },
  { label: "What's New", href: "/app/whats-new", icon: Megaphone },
];

export default function UserNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#fafbfd]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between md:justify-end h-16">
          {/* Left: Mobile hamburger trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Right: User Profile + extras */}
          <div className="flex items-center gap-2">
            <CreditsBadge />

            <div className="hidden sm:block">
              <InviteButton />
            </div>

            <div className="hidden sm:block">
              <HelpMenu />
            </div>

            <UserMenu user={user} initials={initials} />
          </div>
        </div>
      </div>

      {/* Mobile Aside Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle asChild>
              <Link
                href="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2"
              >
                <div className="bg-black flex items-center justify-center p-2 rounded-full shrink-0">
                  <RectangleGoggles className="w-4 h-4" fill="#c7f038" />
                </div>
                <span className="text-xl font-semibold">ThumbGram</span>
              </Link>
            </SheetTitle>
          </SheetHeader>

          <div className="px-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-neutral-200 text-black font-medium"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto px-3 pb-4 pt-3 border-t border-neutral-200 flex flex-col gap-1">
            <Link
              href="/app/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100"
            >
              <UserIcon className="w-4 h-4" />
              Profile Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-neutral-100 text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

function InviteButton() {
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
