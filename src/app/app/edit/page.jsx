"use client";

import { useEffect, useReducer } from "react";
import { Loader2 } from "lucide-react";
import { COMPOSITION_STORAGE_KEY } from "@/lib/editable-sources";
import { Editor } from "@/modules/edit/components/editor";
import { VideoPicker } from "@/modules/edit/components/video-picker";

function reducer(state, action) {
  switch (action.type) {
    case "INIT":      return { checked: true, compositionProps: action.payload };
    case "SELECT":    return { checked: true, compositionProps: action.payload };
    case "EXIT":      return { checked: true, compositionProps: null };
    default:          return state;
  }
}

export default function EditPage() {
  const [{ checked, compositionProps }, dispatch] = useReducer(reducer, {
    checked: false,
    compositionProps: null,
  });

  useEffect(() => {
    let payload = null;
    try {
      const raw = sessionStorage.getItem(COMPOSITION_STORAGE_KEY);
      payload = raw ? JSON.parse(raw) : null;
    } catch (_) {}
    dispatch({ type: "INIT", payload });
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compositionProps) {
    return (
      <Editor
        compositionProps={compositionProps}
        onExit={() => {
          sessionStorage.removeItem(COMPOSITION_STORAGE_KEY);
          dispatch({ type: "EXIT" });
        }}
      />
    );
  }

  return (
    <VideoPicker
      onSelect={(props) => {
        sessionStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(props));
        dispatch({ type: "SELECT", payload: props });
      }}
    />
  );
}
