"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, Eye, RotateCcw, CheckCircle2, AlertCircle, Award } from "lucide-react";

interface PracticeCard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  lastConfidence?: number | null;
  seenCount?: number;
  lastAnswer?: string;
}

interface PracticeSummary {
  totalCards: number;
  practicedCardsCount: number;
  totalRequirements: number;
  practicedRequirementsCount: number;
  unpracticedMustCount: number;
  averageConfidence: number;
}

interface PracticeSessionProps {
  kitId: string;
}

export function PracticeSession({ kitId }: PracticeSessionProps) {
  const [cards, setCards] = useState<PracticeCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);

  // Load practice queue & summary
  const loadQueue = async () => {
    setLoading(true);
    try {
      const [queueRes, summaryRes] = await Promise.all([
        fetch(`/api/kits/${kitId}/practice/queue`),
        fetch(`/api/kits/${kitId}/practice/summary`),
      ]);

      if (queueRes.ok) {
        const data = await queueRes.json();
        setCards(data.cards || []);
        setCurrentIndex(0);
        setIsRevealed(false);
        setWrittenAnswer("");
        setTimeLeft(60);
        setTimerRunning(true);
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [kitId]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0 || isRevealed) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning, timeLeft, isRevealed]);

  // Keyboard shortcut listener (Space to reveal, 1-5 to rate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setIsRevealed(true);
      }
      if (isRevealed && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        submitRating(parseInt(e.key, 10));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRevealed, currentIndex, cards, writtenAnswer]);

  const currentCard = cards[currentIndex];

  const submitRating = async (confidence: number) => {
    if (!currentCard) return;

    try {
      await fetch(`/api/kits/${kitId}/practice/${currentCard.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidence,
          writtenAnswer,
        }),
      });
    } catch {
      // optimistic
    }

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsRevealed(false);
      setWrittenAnswer("");
      setTimeLeft(60);
      setTimerRunning(true);
    } else {
      // Finished session
      setCurrentIndex(cards.length);
      // Reload summary
      fetch(`/api/kits/${kitId}/practice/summary`)
        .then((r) => r.json())
        .then((d) => setSummary(d));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-400">Loading your practice session queue...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 bg-surface-card border border-surface-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-100">No Flashcards to Practice</h3>
        <p className="text-xs text-slate-400 mt-1">This kit does not have any flashcards generated yet.</p>
      </div>
    );
  }

  // Session Completed Screen
  if (currentIndex >= cards.length) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-100">Practice Batch Complete!</h2>
          <p className="text-sm text-slate-400 mt-1">
            Your confidence scores and written responses have been recorded.
          </p>
        </div>

        {summary && (
          <div className="bg-surface-card border border-surface-border rounded-xl p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Cards Practiced</span>
              <span className="text-xl font-bold text-slate-100">{summary.practicedCardsCount} / {summary.totalCards}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Avg Confidence</span>
              <span className="text-xl font-bold text-teal-400">{summary.averageConfidence} / 5.0</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Unpracticed Musts</span>
              <span className={`text-xl font-bold ${summary.unpracticedMustCount === 0 ? "text-teal-400" : "text-amber-400"}`}>
                {summary.unpracticedMustCount} left
              </span>
            </div>
          </div>
        )}

        <button
          onClick={loadQueue}
          className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Practice Next Batch</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Session Progress Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">
            Card {currentIndex + 1} of {cards.length}
          </span>
          {currentCard.seenCount && currentCard.seenCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-border">
              Seen {currentCard.seenCount} {currentCard.seenCount === 1 ? "time" : "times"}
            </span>
          )}
        </div>

        {/* Countdown Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`font-mono font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
              timeLeft <= 10
                ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                : "bg-surface-card border-surface-border text-slate-200"
            }`}
          >
            <span>{timeLeft}s</span>
          </div>
          <button
            onClick={() => setTimerRunning(!timerRunning)}
            className="p-1 text-slate-400 hover:text-white"
            title={timerRunning ? "Pause timer" : "Resume timer"}
          >
            {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Flashcard Question Prompt */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent block mb-2">
            Practice Prompt
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-100 leading-snug">
            {currentCard.front}
          </h3>
        </div>

        {/* Written Answer Simulation Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>Type Your Answer (Practice Under Time Pressure):</span>
            <span className="text-[10px] text-slate-500">Auto-saved with your rating</span>
          </label>
          <textarea
            rows={4}
            value={writtenAnswer}
            onChange={(e) => setWrittenAnswer(e.target.value)}
            placeholder="Type how you would explain this in an interview..."
            className="w-full p-3 text-sm bg-background border border-surface-border rounded-xl text-slate-200 focus:outline-none focus:border-accent font-mono text-xs resize-y"
          />
        </div>

        {/* Reveal Answer Section */}
        {!isRevealed ? (
          <button
            onClick={() => setIsRevealed(true)}
            className="w-full py-3 rounded-xl bg-surface-border hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4 text-accent" />
            <span>Reveal Reference Outline (or Press Space)</span>
          </button>
        ) : (
          <div className="space-y-4 pt-4 border-t border-surface-border">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 block mb-2">
                Reference Outline &amp; Answer
              </span>
              <div className="p-4 rounded-xl bg-background border border-surface-border text-xs sm:text-sm text-slate-300 leading-relaxed font-mono">
                {currentCard.back}
              </div>
            </div>

            {/* Confidence Rating Buttons 1..5 */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 block text-center">
                Rate your confidence (1 = Needs Review, 5 = Mastered, or press 1-5):
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { score: 1, label: "Needs Work", color: "hover:bg-red-500 hover:text-white" },
                  { score: 2, label: "Shaky", color: "hover:bg-amber-500 hover:text-black" },
                  { score: 3, label: "Decent", color: "hover:bg-yellow-500 hover:text-black" },
                  { score: 4, label: "Confident", color: "hover:bg-teal-500 hover:text-black" },
                  { score: 5, label: "Mastered", color: "hover:bg-emerald-500 hover:text-black" },
                ].map((btn) => (
                  <button
                    key={btn.score}
                    onClick={() => submitRating(btn.score)}
                    className={`py-2 px-1 text-center rounded-lg bg-surface border border-surface-border text-xs font-bold text-slate-300 transition-colors ${btn.color}`}
                  >
                    <span className="block text-sm font-extrabold">{btn.score}</span>
                    <span className="text-[10px] hidden sm:block truncate">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
