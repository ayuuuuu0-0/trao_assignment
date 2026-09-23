"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, AlertCircle, RefreshCw } from "lucide-react";

export function ReauthModal({ onReauthenticated }: { onReauthenticated?: () => void }) {
  const { sessionExpired, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sessionExpired) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.ok) {
      if (onReauthenticated) onReauthenticated();
    } else {
      setError(res.error || "Authentication failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Session Expired</h3>
            <p className="text-xs text-slate-400">Sign in to save your unsaved edits without leaving.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded-lg bg-accent hover:bg-accent-hover text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Restore Session &amp; Save</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
