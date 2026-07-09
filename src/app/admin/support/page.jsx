"use client";

import { useState } from "react";
import { MessageCircle, Ticket } from "lucide-react";
import { AdminChats } from "@/modules/admin/components/adminChats";
import { AdminTickets } from "@/modules/admin/components/adminTickets";

export default function AdminSupportPage() {
  const [tab, setTab] = useState("chats");

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-heading">Support</h1>
        <p className="text-sm text-gray-500 mt-0.5">User chats and raised tickets.</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("chats")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "chats" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chats
        </button>
        <button
          onClick={() => setTab("tickets")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "tickets" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Ticket className="w-4 h-4" />
          Tickets
        </button>
      </div>

      {tab === "chats" ? <AdminChats /> : <AdminTickets />}
    </div>
  );
}
