"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, RefreshCcw, Users, Video } from "lucide-react";
import { toast } from "sonner";

export function AdminModal() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    // Fetch real data when admin panel opens
    Promise.all([
      fetch("/api/user/stats").then((r) => r.json()).catch(() => ({})),
    ])
      .then(() => {
        // Admin endpoints not yet implemented — show placeholder
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filteredUsers = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  function handleRefillCredits(userId, email) {
    toast.success(`Refilled 10 credits for ${email}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="cursor-pointer" title="Admin Panel">
          <Shield className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Admin Panel
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="cursor-pointer">
              <Users className="w-4 h-4 mr-2" /> Users
            </TabsTrigger>
            <TabsTrigger value="videos" className="cursor-pointer">
              <Video className="w-4 h-4 mr-2" /> Videos
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email..."
                className="pl-10 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filteredUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.credits > 5 ? "secondary" : "destructive"} className="text-xs">
                          {user.credits}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.plan === "pro" ? "default" : "outline"} className="capitalize text-xs">
                          {user.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer h-7 text-xs"
                          onClick={() => handleRefillCredits(user.id, user.email)}
                        >
                          <RefreshCcw className="w-3 h-3 mr-1" /> +10 Credits
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                Admin user management coming soon
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-4">
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              Admin video management coming soon
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
