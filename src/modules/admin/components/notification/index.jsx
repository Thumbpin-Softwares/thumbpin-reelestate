"use client";

import { toast } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2, AlertTriangle } from "lucide-react";

// Admin-branded toast presets — same black/lime look as the edit page's
// editNotify (client/src/modules/edit/components/notification), on top of
// sonner's global <Toaster/>. Call these instead of the raw `toast` import
// from "sonner" so every notification in the admin panel stays consistent.
//
// Usage:
//   import { adminNotify } from "@/modules/admin/components/notification";
//   adminNotify.success("User updated");
//   adminNotify.error("Failed to save", { description: err.message });
//   const id = adminNotify.loading("Deleting…");
//   adminNotify.dismiss(id);

const baseOptions = {
  classNames: {
    toast: "!bg-neutral-900 !text-white !border-neutral-800",
    description: "!text-neutral-300",
    actionButton: "!bg-[#c7f038] !text-black",
    cancelButton: "!bg-neutral-800 !text-white",
  },
};

function success(message, options = {}) {
  return toast.success(message, {
    ...baseOptions,
    icon: <CheckCircle2 className="w-4 h-4 text-[#c7f038]" />,
    ...options,
  });
}

function error(message, options = {}) {
  return toast.error(message, {
    ...baseOptions,
    icon: <XCircle className="w-4 h-4 text-destructive" />,
    ...options,
  });
}

function info(message, options = {}) {
  return toast(message, {
    ...baseOptions,
    icon: <Info className="w-4 h-4 text-[#c7f038]" />,
    ...options,
  });
}

function warning(message, options = {}) {
  return toast.warning(message, {
    ...baseOptions,
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    ...options,
  });
}

function loading(message, options = {}) {
  return toast.loading(message, {
    ...baseOptions,
    icon: <Loader2 className="w-4 h-4 animate-spin text-[#c7f038]" />,
    ...options,
  });
}

function dismiss(id) {
  toast.dismiss(id);
}

export const adminNotify = {
  success,
  error,
  info,
  warning,
  loading,
  dismiss,
};
