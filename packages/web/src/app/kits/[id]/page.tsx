"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { KitTabs, TabKey } from "@/components/KitTabs";
import { BriefPanel } from "@/components/BriefPanel";
import { RolePanel } from "@/components/RolePanel";
import { QuestionBank } from "@/components/QuestionBank";
import { FlashcardPanel } from "@/components/FlashcardPanel";
import { SchedulePanel } from "@/components/SchedulePanel";
import { PracticeSession } from "@/components/PracticeSession";
import { SaveIndicator, SaveState } from "@/components/SaveIndicator";
import { ReauthModal } from "@/components/ReauthModal";
import { Kit, Question, QuestionCategory, Flashcard } from "@prepkit/core";
import {
  ArrowLeft,
  Building2,
  Calendar,
  RotateCcw,
  Sparkles,
  Download,
  AlertCircle,
  RefreshCw,
  Play,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function KitDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const kitId = resolvedParams.id;

  const { user, isLoading: authLoading, setSessionExpired } = useAuth();
  const [kit, setKit] = useState<Kit | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [status, setStatus] = useState<"generating" | "ready" | "partial" | "failed">("generating");
  const [canUndo, setCanUndo] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("brief");
  const [saveStatus, setSaveStatus] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch kit data
  const fetchKit = async () => {
    try {
      const res = await fetch(`/api/kits/${kitId}`);
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!res.ok) {
        throw new Error("Interview prep kit not found.");
      }
      const data = await res.json();
      setKit(data.kit);
      setStatus(data.status);
      if (data.version) setVersion(data.version);
      setCanUndo(data.canUndo || false);
    } catch (err: any) {
      setError(err.message || "Failed to load kit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchKit();
    }
  }, [user, authLoading, kitId]);

  // Polling while status is generating
  useEffect(() => {
    if (status !== "generating") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/kits/${kitId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== "generating") {
            setKit(data.kit);
            setStatus(data.status);
            if (data.version) setVersion(data.version);
            setCanUndo(data.canUndo || false);
          }
        }
      } catch {
        // continue polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, kitId]);

  // Generic helper for builder mutation requests
  const runMutation = async (url: string, method: string, body?: any) => {
    setSaveStatus("saving");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401) {
        setSessionExpired(true);
        setSaveStatus("error");
        return null;
      }

      if (!res.ok) {
        setSaveStatus("error");
        const data = await res.json();
        alert(data.error?.message || "Operation failed.");
        return null;
      }

      const data = await res.json();
      if (data.kit) {
        setKit(data.kit);
      }
      if (data.version) {
        setVersion(data.version);
      }
      if (data.canUndo !== undefined) {
        setCanUndo(data.canUndo);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      return data;
    } catch {
      setSaveStatus("error");
      return null;
    }
  };

  // Brief update
  const handleUpdateBrief = async (patch: { summary?: string; what_they_do?: string }) => {
    await runMutation(`/api/kits/${kitId}/brief`, "PATCH", patch);
  };

  // Brief regenerate
  const handleRegenerateBrief = async () => {
    await runMutation(`/api/kits/${kitId}/regenerate`, "POST", { section: "brief" });
  };

  // Question handlers
  const handleUpdateQuestion = async (qid: string, patch: Partial<Question>) => {
    await runMutation(`/api/kits/${kitId}/questions/${qid}`, "PATCH", patch);
  };

  const handleAddQuestion = async (data: {
    category: QuestionCategory;
    prompt: string;
    answer_outline: string;
    difficulty: number;
    requirement_ids: string[];
  }) => {
    await runMutation(`/api/kits/${kitId}/questions`, "POST", data);
  };

  const handleDeleteQuestion = async (qid: string) => {
    await runMutation(`/api/kits/${kitId}/questions/${qid}`, "DELETE");
  };

  const handleMoveQuestion = async (qid: string, toCategory: QuestionCategory) => {
    await runMutation(`/api/kits/${kitId}/questions/${qid}/move`, "POST", { toCategory });
  };

  const handleReorderQuestions = async (category: QuestionCategory, orderedIds: string[]) => {
    await runMutation(`/api/kits/${kitId}/questions/reorder`, "POST", { category, orderedIds });
  };

  const handleRegenerateCategory = async (category: QuestionCategory) => {
    await runMutation(`/api/kits/${kitId}/regenerate`, "POST", { section: "questions", category });
  };

  // Flashcard handlers
  const handleUpdateFlashcard = async (fid: string, patch: Partial<Flashcard>) => {
    await runMutation(`/api/kits/${kitId}/flashcards/${fid}`, "PATCH", patch);
  };

  const handleAddFlashcard = async (data: {
    front: string;
    back: string;
    requirement_ids: string[];
  }) => {
    await runMutation(`/api/kits/${kitId}/flashcards`, "POST", data);
  };

  const handleDeleteFlashcard = async (fid: string) => {
    await runMutation(`/api/kits/${kitId}/flashcards/${fid}`, "DELETE");
  };

  // Schedule handler
  const handleRegenerateSchedule = async () => {
    await runMutation(`/api/kits/${kitId}/regenerate`, "POST", { section: "schedule" });
  };

  // Undo regeneration (D17)
  const handleUndo = async () => {
    await runMutation(`/api/kits/${kitId}/undo`, "POST");
  };

  // Export kit as JSON
  const handleExportJson = () => {
    if (!kit) return;
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prepkit-${kit.source.company.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading interview prep kit...</p>
        </div>
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-100">Unable to Load Kit</h2>
        <p className="text-xs sm:text-sm text-slate-400">{error || "Kit could not be found."}</p>
        <Link
          href="/kits"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-surface-border hover:bg-slate-700 text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Kits Dashboard</span>
        </Link>
      </div>
    );
  }

  // Generation In-Progress State
  if (status === "generating") {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mx-auto animate-pulse">
          <Sparkles className="w-8 h-8 animate-spin" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-100">Generating Your Prep Kit</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto">
            We are crawling the company website, verifying verbatim requirements, synthesizing
            tailored interview questions, and allocating your study schedule.
          </p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-6 text-left space-y-3 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <RefreshCw className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
            <span>Crawling company website and career intelligence...</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-500">2</span>
            <span>Verifying grounded requirements with exact quotes...</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-500">3</span>
            <span>Generating questions, outlines, and schedule...</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Auto-refreshing status every 2 seconds...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <ReauthModal onReauthenticated={fetchKit} />

      {/* Header bar */}
      <div className="border-b border-surface-border bg-surface/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link
                  href="/kits"
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover transition-colors"
                  title="Back to all kits"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <h1 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>{kit.source?.role || "Interview Prep Kit"}</span>
                  <span className="text-xs font-mono font-normal text-slate-400 bg-surface-card px-2.5 py-0.5 rounded-full border border-surface-border">
                    v{version}
                  </span>
                </h1>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 pl-7">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  <span>{kit.source?.company || "Company"}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>{kit.schedule?.days_available || 5}-Day Prep</span>
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <SaveIndicator state={saveStatus} />

              {canUndo && (
                <button
                  onClick={handleUndo}
                  title="Revert last regeneration"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Regeneration</span>
                </button>
              )}

              <button
                onClick={handleExportJson}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border hover:border-slate-600 bg-surface-card hover:bg-surface-hover text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export JSON</span>
              </button>

              <button
                onClick={() => setActiveTab("practice")}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Practice Mode</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <KitTabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        counts={{
          requirements: kit.role?.requirements?.length || 0,
          questions: kit.questions?.length || 0,
          flashcards: kit.flashcards?.length || 0,
          days: kit.schedule?.days_available || 5,
        }}
      />

      {/* Main Tab Panels */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === "brief" && (
          <BriefPanel
            brief={kit.company_brief}
            companyName={kit.source?.company || "Company"}
            companyUrl={kit.source?.company_url || ""}
            onUpdateBrief={handleUpdateBrief}
            onRegenerate={handleRegenerateBrief}
          />
        )}

        {activeTab === "role" && (
          <RolePanel role={kit.role} />
        )}

        {activeTab === "questions" && (
          <QuestionBank
            questions={kit.questions}
            requirements={kit.role.requirements}
            onUpdateQuestion={handleUpdateQuestion}
            onAddQuestion={handleAddQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onMoveQuestion={handleMoveQuestion}
            onReorderQuestions={handleReorderQuestions}
            onRegenerateCategory={handleRegenerateCategory}
          />
        )}

        {activeTab === "flashcards" && (
          <FlashcardPanel
            flashcards={kit.flashcards}
            requirements={kit.role.requirements}
            onUpdateFlashcard={handleUpdateFlashcard}
            onAddFlashcard={handleAddFlashcard}
            onDeleteFlashcard={handleDeleteFlashcard}
          />
        )}

        {activeTab === "schedule" && (
          <SchedulePanel
            schedule={kit.schedule}
            questions={kit.questions}
            onRegenerateSchedule={handleRegenerateSchedule}
          />
        )}

        {activeTab === "practice" && (
          <PracticeSession kitId={kitId} />
        )}
      </main>
    </div>
  );
}
