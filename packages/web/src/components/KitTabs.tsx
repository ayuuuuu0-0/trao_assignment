"use client";

import React from "react";
import { Building2, FileCheck, HelpCircle, BookOpen, Calendar, Play } from "lucide-react";

export type TabKey = "brief" | "role" | "questions" | "flashcards" | "schedule" | "practice";

interface KitTabsProps {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  counts: {
    requirements: number;
    questions: number;
    flashcards: number;
    days: number;
  };
}

export function KitTabs({ activeTab, onChangeTab, counts }: KitTabsProps) {
  const tabs = [
    { key: "brief", label: "Company Brief", icon: Building2 },
    { key: "role", label: "Requirements", icon: FileCheck, count: counts.requirements },
    { key: "questions", label: "Question Bank", icon: HelpCircle, count: counts.questions },
    { key: "flashcards", label: "Flashcards", icon: BookOpen, count: counts.flashcards },
    { key: "schedule", label: "Schedule", icon: Calendar, badge: `${counts.days}d` },
    { key: "practice", label: "Practice Mode", icon: Play, highlight: true },
  ];

  return (
    <div className="border-b border-surface-border bg-surface/50 overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 sm:gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;

          return (
            <button
              key={t.key}
              onClick={() => onChangeTab(t.key as TabKey)}
              className={`py-3.5 px-3 sm:px-4 font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : t.highlight
                  ? "border-transparent text-emerald-400 hover:text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-border text-slate-400 font-mono">
                  {t.count}
                </span>
              )}
              {t.badge && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-mono">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
