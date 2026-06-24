"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderOpen,
  Clock,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  CreditCard,
  HelpCircle,
  BookOpen,
  MessageCircle,
  MessageSquarePlus,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreditsBadge } from "@/components/dashboard/credits-badge";

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

  const navItems = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "Library", href: "/app/assets", icon: FolderOpen },
    { label: "History", href: "/app/history", icon: Clock },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-10 bg-[#fafbfd]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end h-16">
          {/* Right: User Profile + Mobile Trigger */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <CreditsBadge />
            </div>

            <div className="hidden sm:block">
              <InviteButton />
            </div>

            <div className="hidden sm:block">
              <HelpMenu />
            </div>

            <div className="hidden sm:block">
              <UserMenu user={user} initials={initials} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/30 bg-background animate-slide-down">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  pathname === item.href
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.beta && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-300/30">
                    BETA
                  </span>
                )}
              </Link>
            ))}
            <div className="pt-2 border-t border-border/20">
              <Link
                href="/app/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-muted-foreground text-sm font-medium"
              >
                <UserIcon className="w-4 h-4" />
                Profile Settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
                className="flex items-center gap-3 w-full px-3 py-2 text-destructive text-sm font-medium text-left"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
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

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full p-2 hover:bg-neutral-100 flex items-center cursor-pointer ring-0"
        >
          <HelpCircle size={18}/>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-2">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/app/help">
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Help Center</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="mailto:support@thumbpin.ai">
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>Chat with us</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="mailto:feedback@thumbpin.ai">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            <span>Feedback</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user, initials }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="p-0 h-10 w-10 rounded-full border border-black overflow-hidden cursor-pointer"
        >
          <Avatar className="h-8 w-8">
            {user?.image && <AvatarImage src={user.image} alt={user.name} />}
            <AvatarFallback className="text-md bg-black text-[#c7f038]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-2">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/app/profile">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/app/credits">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing & Credits</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
