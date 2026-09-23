"use client";

import React, { useState } from "react";
import { Schedule, Question } from "@prepkit/core";
import { Calendar, Clock, RefreshCw, HelpCircle, CheckCircle } from "lucide-react";

interface SchedulePanelProps {
  schedule: Schedule;
  questions: Question[];
  onRegenerateSchedule: () => Promise<void>;
}

export function SchedulePanel({
  schedule,
  questions,
  onRegenerateSchedule,
}: SchedulePanelProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const totalMinutes = schedule.days.reduce((acc, d) => acc + d.minutes, 0);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerateSchedule();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            <span>Deterministic Study Schedule ({schedule.days_available} Days)</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Total Study Time: {totalMinutes} mins (~{(totalMinutes / 60).toFixed(1)} hrs)</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5 text-slate-200 disabled:opacity-50"
          title="Re-run deterministic schedule allocator over current question bank"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin text-accent" : ""}`} />
          <span>Re-allocate Schedule</span>
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedule.days.map((day) => {
          return (
            <div
              key={day.day}
              className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-accent px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20">
                    Day {day.day}
                  </span>

                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold text-slate-300">{day.minutes}m</span>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-slate-100 mb-3">{day.focus}</h4>

                {/* Question IDs in Day */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                    Scheduled Questions ({day.question_ids.length})
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {day.question_ids.map((qid) => {
                      const q = qMap.get(qid);
                      return (
                        <div
                          key={qid}
                          className="p-2 rounded bg-surface-border/40 text-xs text-slate-300 flex items-start gap-2"
                        >
                          <span className="font-mono text-[10px] text-accent font-bold mt-0.5">{qid}</span>
                          <span className="line-clamp-2">{q ? q.prompt : "Review Question"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
