"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sparkles,
  LayoutDashboard,
  FolderOpen,
  Clock,
  Clapperboard,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  CreditCard,
} from "lucide-react";
import { RectangleGoggles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#f7f5e8] border-b border-b-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-black flex items-center justify-center p-2 inset-shadow-sidebar-primary-foreground rounded-full">
              <RectangleGoggles className="w-4 h-4" fill="#c7f038" />
            </div>
            <span className="text-xl font-semibold">ThumbGram</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-8 text-sm transition-colors ${
                    isActive
                      ? "underline underline-offset-4"
                      : "text-black hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {item.beta && (
                    <span className="px-4 py-2 rounded-full text-[9px] font-bold bg-[#c6f036] text-black">
                      BETA
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: User Profile + Mobile Trigger */}
          <div className="flex items-center gap-3">
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
