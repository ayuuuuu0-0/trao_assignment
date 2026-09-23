"use client";

import React from "react";
import { CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-xs transition-opacity duration-300">
      {state === "saving" && (
        <span className="flex items-center gap-1.5 text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
          <span>Saving edits...</span>
        </span>
      )}
      {state === "saved" && (
        <span className="flex items-center gap-1.5 text-teal-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>All changes saved</span>
        </span>
      )}
      {state === "error" && (
        <span className="flex items-center gap-1.5 text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Save failed. Retrying...</span>
        </span>
      )}
    </div>
  );
}
