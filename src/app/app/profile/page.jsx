"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { signOut } from "next-auth/react";
import {
  Crown,
  LogOut,
} from "lucide-react";

export default function ProfilePage() {
  const { user, profile, loading } = useUser();

  const displayName =
    profile?.name || user?.name || profile?.email?.split("@")[0] || "User";
  const displayEmail = profile?.email || user?.email || "—";
  const plan = profile?.plan || "free";
  const credits = profile?.credits ?? 0;
  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const userImage = user?.image || profile?.image || null;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pt-12">
      {/* Profile Card */}
      <Card className="relative overflow-hidden rounded-3xl border-0 shadow-2xl bg-linear-to-br from-neutral-950 via-neutral-900 to-black">
        {/* Background decorations */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#c7f038]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[#c7f038]/5 blur-2xl" />

        <CardContent className="relative p-6">
          {/* Top */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                ThumbGram Card
              </p>

              <h2 className="text-xl font-bold text-white mt-2">
                {displayName}
              </h2>

              <p className="text-sm text-[#c7f038]">{displayEmail}</p>
            </div>

            <Avatar className="w-14 h-14 border border-[#c7f038]/30">
              {userImage && <AvatarImage src={userImage} alt={displayName} />}

              <AvatarFallback className="bg-black text-[#c7f038]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Bottom Row */}
          <div className="mt-10 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase text-neutral-500">
                Available Credits
              </p>

              <h1 className="text-4xl font-black text-[#c7f038]">{credits}</h1>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase text-neutral-500">
                Membership
              </p>

              <div className="mt-1 inline-flex rounded-full bg-[#c7f038] px-4 py-1">
                <span className="text-xs font-bold text-black uppercase">
                  {plan}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-neutral-500">Joined {joinDate}</span>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription 
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-4 h-4" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan === "pro" ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">Pro – ₹9,440/month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credits/month</span>
                <span>500</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to Pro for 500 credits/month and priority rendering.
              </p>
              <Button className="gradient-bg text-white cursor-pointer h-9 text-sm">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      */}
    </div>
  );
}
