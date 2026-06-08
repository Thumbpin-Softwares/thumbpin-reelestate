"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Home,
  Video,
  PersonStanding,
  PenTool,
  ShoppingBag,
  FolderOpen,
  Clock,
  CreditCard,
  User,
  Sparkles,
  LogOut,
  MapPin,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CreditsBadge } from "./credits-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mainNav = [
  { title: "Dashboard", href: "/app", icon: Home },
  { title: "Text to Video", href: "/app/text-to-video", icon: Video },
  { title: "Real Estate", href: "/app/ai-walkthrough", icon: PersonStanding },
  { title: "UGC Script", href: "/app/ugc-creator", icon: PenTool },
  { title: "Product Video", href: "/app/product-to-video", icon: ShoppingBag },
  { title: "Site View", href: "/app/site-view", icon: MapPin },
];

const libraryNav = [
  { title: "Asset Library", href: "/app/assets", icon: FolderOpen },
  { title: "Video History", href: "/app/history", icon: Clock },
  { title: "Credits", href: "/app/credits", icon: CreditCard },
  { title: "Profile", href: "/app/profile", icon: User },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image || null;
  const initials = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold font-heading tracking-tight">Thumb AI</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium px-3">
            Create
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium px-3">
            Library
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-3 border-t border-border/50">
        <CreditsBadge />
        {/* User info */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar className="w-8 h-8">
            {userImage && <AvatarImage src={userImage} alt={userName} />}
            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
