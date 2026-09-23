"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, Upload, FileText, AlertCircle, RefreshCw, Layers } from "lucide-react";

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKitCreated?: (kitId: string) => void;
}

export function CreateKitModal({ isOpen, onClose, onKitCreated }: CreateKitModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"single" | "bulk">("single");

  // Single kit form state
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [useFakeLlm, setUseFakeLlm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk upload form state
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd,
          company_url: companyUrl,
          days,
          useFakeLlm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to generate kit.");
        setIsSubmitting(false);
        return;
      }

      onClose();
      if (onKitCreated) {
        onKitCreated(data.kitId);
      } else {
        router.push(`/kits/${data.kitId}`);
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let cases: any[];
      try {
        cases = JSON.parse(bulkInput);
      } catch {
        setError("Invalid JSON format. Expected an array of cases.");
        setIsSubmitting(false);
        return;
      }

      if (!Array.isArray(cases) || cases.length === 0) {
        setError("Input must be a non-empty array of objects with jd and company_url.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/kits/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases, useFakeLlm }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Bulk submission failed.");
      } else {
        setBulkResults(data.results);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process bulk upload.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBulkInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Create Interview Prep Kit</h2>
              <p className="text-xs text-slate-400">Ground requirements, crawl company context, and generate a custom kit.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 pt-4 pb-2 border-b border-surface-border text-sm">
          <button
            onClick={() => setTab("single")}
            className={`pb-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === "single"
                ? "border-accent text-accent"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" /> Single Role
          </button>
          <button
            onClick={() => setTab("bulk")}
            className={`pb-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === "bulk"
                ? "border-accent text-accent"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" /> Bulk Upload (up to 10)
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Single Role */}
        {tab === "single" && (
          <form onSubmit={handleSingleSubmit} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Company Website URL <span className="text-accent">*</span>
              </label>
              <input
                type="url"
                required
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://nexusai.com or http://localhost:8099/nexusai/"
                className="w-full px-3 py-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                We crawl their about and careers pages for culture and hiring process clues.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Job Description <span className="text-accent">*</span>
              </label>
              <textarea
                required
                rows={6}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job posting text here..."
                className="w-full px-3 py-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent font-mono text-xs resize-y"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>Must-have skills are automatically extracted and verified.</span>
                <span>{jd.length} / 20,000 chars</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Preparation Days ({days} {days === 1 ? "day" : "days"})
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pb-2">
                  <input
                    type="checkbox"
                    checked={useFakeLlm}
                    onChange={(e) => setUseFakeLlm(e.target.checked)}
                    className="rounded bg-background border-surface-border text-accent focus:ring-accent"
                  />
                  <span>Fast Demo Mode (Instant Fake LLM)</span>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !jd || !companyUrl}
                className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing &amp; Generating Kit...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Prep Kit</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Bulk Upload */}
        {tab === "bulk" && (
          <form onSubmit={handleBulkSubmit} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Bulk JSON Cases (Max 10)
                </label>
                <label className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Upload .json
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                rows={8}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder='[
  {
    "id": "case-01",
    "jd": "Senior React Engineer...",
    "company_url": "https://company1.com",
    "days": 5
  }
]'
                className="w-full px-3 py-2 text-xs font-mono bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
              />
            </div>

            {bulkResults && (
              <div className="p-3 bg-surface-card border border-surface-border rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">Bulk Execution Queue</h4>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {bulkResults.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-surface-border/50">
                      <span className="font-mono text-slate-400">{r.id}</span>
                      {r.error ? (
                        <span className="text-red-400">{r.error}</span>
                      ) : (
                        <span className="text-teal-400">Queued ({r.kitId})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !bulkInput}
              className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Batch Queue...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Queue Batch Generation</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
