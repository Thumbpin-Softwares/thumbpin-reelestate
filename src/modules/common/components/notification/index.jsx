"use client";

import { toast } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2, AlertTriangle } from "lucide-react";

// Shared black/lime-branded toast presets — same look as the editor's
// editNotify (src/modules/edit/components/notification), but for use
// anywhere in the app outside the editor. Call these instead of the raw
// `toast` import from "sonner" so notifications stay visually consistent.
//
// Usage:
//   import { appNotify } from "@/modules/common/components/notification";
//   appNotify.success("Asset deleted");
//   appNotify.error("Delete failed", { description: err.message });

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

export const appNotify = {
  success,
  error,
  info,
  warning,
  loading,
  dismiss,
};
