"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CreateKitModal } from "@/components/CreateKitModal";
import { ReauthModal } from "@/components/ReauthModal";
import {
  Sparkles,
  Plus,
  Play,
  Trash2,
  ExternalLink,
  Calendar,
  HelpCircle,
  BookOpen,
  RefreshCw,
  AlertCircle,
  Building2,
  Clock,
} from "lucide-react";

interface KitSummary {
  id: string;
  status: "generating" | "ready" | "partial" | "failed";
  version: number;
  company: string;
  company_url: string;
  role: string;
  days: number;
  questionsCount: number;
  flashcardsCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function KitsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, setSessionExpired } = useAuth();
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/kits");
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load your kits.");
      }
      const data = await res.json();
      setKits(data.kits || []);
    } catch (err: any) {
      setError(err.message || "Failed to load kits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchKits();
    }
  }, [user, authLoading]);

  const handleDelete = async (e: React.MouseEvent, kitId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this kit? This action cannot be undone.")) {
      return;
    }

    setDeletingId(kitId);
    try {
      const res = await fetch(`/api/kits/${kitId}`, { method: "DELETE" });
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (res.ok) {
        setKits((prev) => prev.filter((k) => k.id !== kitId));
      } else {
        alert("Failed to delete kit.");
      }
    } catch {
      alert("Error deleting kit.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: KitSummary["status"]) => {
    switch (status) {
      case "ready":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Ready
          </span>
        );
      case "generating":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Generating</span>
          </span>
        );
      case "partial":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
            Partial
          </span>
        );
      case "failed":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  if (authLoading || (loading && kits.length === 0)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading your interview prep kits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <ReauthModal onReauthenticated={fetchKits} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
            <span>Interview Prep Kits</span>
            <span className="text-xs font-mono font-normal text-slate-400 bg-surface-card px-2.5 py-0.5 rounded-full border border-surface-border">
              {kits.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ground company intelligence, master must-have skills, and simulate realistic interviews.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Prep Kit</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {kits.length === 0 ? (
        <div className="bg-surface border border-surface-border rounded-2xl p-12 text-center max-w-xl mx-auto space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">No Prep Kits Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
              Generate your first interview preparation kit by pasting a job description and company URL.
              We&apos;ll automatically ground requirements and create a personalized study schedule.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Kit</span>
          </button>
        </div>
      ) : (
        /* Kits Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {kits.map((kit) => (
            <div
              key={kit.id}
              onClick={() => router.push(`/kits/${kit.id}`)}
              className="group bg-surface-card border border-surface-border hover:border-slate-600 rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between cursor-pointer space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {getStatusBadge(kit.status)}
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(kit.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-accent transition-colors line-clamp-1">
                    {kit.role}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{kit.company}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-border text-center">
                  <div className="bg-background/60 p-2 rounded-lg border border-surface-border/40">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Schedule</span>
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center justify-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-accent" />
                      <span>{kit.days}d</span>
                    </span>
                  </div>

                  <div className="bg-background/60 p-2 rounded-lg border border-surface-border/40">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Questions</span>
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center justify-center gap-1 mt-0.5">
                      <HelpCircle className="w-3 h-3 text-accent" />
                      <span>{kit.questionsCount}</span>
                    </span>
                  </div>

                  <div className="bg-background/60 p-2 rounded-lg border border-surface-border/40">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Cards</span>
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center justify-center gap-1 mt-0.5">
                      <BookOpen className="w-3 h-3 text-accent" />
                      <span>{kit.flashcardsCount}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-surface-border flex items-center justify-between gap-2">
                <Link
                  href={`/kits/${kit.id}/practice`}
                  onClick={(e) => e.stopPropagation()}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Practice</span>
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, kit.id)}
                    disabled={deletingId === kit.id}
                    title="Delete Kit"
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-accent font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                    Open &rarr;
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <CreateKitModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onKitCreated={(newId) => {
          setShowCreateModal(false);
          router.push(`/kits/${newId}`);
        }}
      />
    </div>
  );
}
