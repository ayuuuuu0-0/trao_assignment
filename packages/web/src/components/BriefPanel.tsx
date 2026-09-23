"use client";

import React, { useState } from "react";
import { Building2, Edit3, Check, Globe, RefreshCw } from "lucide-react";
import { CompanyBrief } from "@prepkit/core";

interface BriefPanelProps {
  brief: CompanyBrief;
  companyName: string;
  companyUrl: string;
  onUpdateBrief: (patch: { summary?: string; what_they_do?: string }) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

export function BriefPanel({
  brief,
  companyName,
  companyUrl,
  onUpdateBrief,
  onRegenerate,
}: BriefPanelProps) {
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(brief.summary || "");

  const [editingWhatTheyDo, setEditingWhatTheyDo] = useState(false);
  const [whatTheyDoText, setWhatTheyDoText] = useState(brief.what_they_do || "");

  const [isRegenerating, setIsRegenerating] = useState(false);

  const saveSummary = async () => {
    await onUpdateBrief({ summary: summaryText });
    setEditingSummary(false);
  };

  const saveWhatTheyDo = async () => {
    await onUpdateBrief({ what_they_do: whatTheyDoText });
    setEditingWhatTheyDo(false);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" />
            <span>{companyName}</span>
          </h2>
          <a
            href={companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-accent flex items-center gap-1 mt-0.5"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{companyUrl}</span>
          </a>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5 text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin text-accent" : ""}`} />
          <span>Regenerate Brief</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Summary */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Company Overview &amp; Mission
            </h3>
            {!editingSummary ? (
              <button
                onClick={() => setEditingSummary(true)}
                className="text-xs text-slate-400 hover:text-accent flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <button
                onClick={saveSummary}
                className="text-xs text-teal-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            )}
          </div>

          {editingSummary ? (
            <textarea
              rows={4}
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              className="w-full p-2.5 text-sm bg-background border border-accent rounded-lg text-slate-200 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              {brief.summary || "No company summary found."}
            </p>
          )}
        </div>

        {/* What They Do */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Core Offering &amp; Products
            </h3>
            {!editingWhatTheyDo ? (
              <button
                onClick={() => setEditingWhatTheyDo(true)}
                className="text-xs text-slate-400 hover:text-accent flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <button
                onClick={saveWhatTheyDo}
                className="text-xs text-teal-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            )}
          </div>

          {editingWhatTheyDo ? (
            <textarea
              rows={4}
              value={whatTheyDoText}
              onChange={(e) => setWhatTheyDoText(e.target.value)}
              className="w-full p-2.5 text-sm bg-background border border-accent rounded-lg text-slate-200 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              {brief.what_they_do || "No product information found."}
            </p>
          )}
        </div>
      </div>

      {/* Sources list */}
      {brief.sources && brief.sources.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Grounded Research Sources
          </h4>
          <ul className="space-y-1">
            {brief.sources.map((src, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent truncate hover:underline"
                >
                  {src}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
