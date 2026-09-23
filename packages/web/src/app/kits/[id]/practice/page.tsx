"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, BookOpen } from "lucide-react";
import { PracticeSession } from "@/components/PracticeSession";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PracticeModePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const kitId = resolvedParams.id;

  return (
    <div className="min-h-screen pb-16">
      {/* Top Header */}
      <div className="border-b border-surface-border bg-surface/80 backdrop-blur-sm sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/kits/${kitId}`}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover transition-colors"
              title="Exit Practice Mode"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <span>Interview Practice Mode</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Spaced repetition active recall with 60-second timer simulation.
              </p>
            </div>
          </div>

          <Link
            href={`/kits/${kitId}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border hover:border-slate-600 bg-surface-card hover:bg-surface-hover text-slate-300 transition-colors"
          >
            Exit to Kit
          </Link>
        </div>
      </div>

      {/* Main Focus Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <PracticeSession kitId={kitId} />
      </main>
    </div>
  );
}
