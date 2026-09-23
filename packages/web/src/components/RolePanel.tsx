"use client";

import React from "react";
import { Role } from "@prepkit/core";
import { ShieldCheck, Quote, CheckCircle2 } from "lucide-react";

export function RolePanel({ role }: { role: Role }) {
  const mustCount = role.requirements.filter((r) => r.priority === "must").length;
  const niceCount = role.requirements.filter((r) => r.priority === "nice").length;

  return (
    <div className="space-y-6">
      {/* Role Header Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{role.title || "Target Role"}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              {role.seniority && (
                <span className="px-2.5 py-0.5 rounded-full bg-surface-border font-medium text-slate-300">
                  {role.seniority}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold">
              {mustCount} Must-Have
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-semibold">
              {niceCount} Nice-To-Have
            </span>
          </div>
        </div>

        {/* Responsibilities */}
        {role.responsibilities && role.responsibilities.length > 0 && (
          <div className="mt-5 pt-5 border-t border-surface-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Key Responsibilities
            </h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {role.responsibilities.map((resp, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Grounded Requirements Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Extracted &amp; Grounded Requirements ({role.requirements.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Every item is verified against verbatim job description evidence.
          </span>
        </div>

        <div className="divide-y divide-surface-border">
          {role.requirements.map((req) => (
            <div key={req.id} className="p-4 sm:p-5 hover:bg-surface-hover/50 transition-colors space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                    {req.id}
                  </span>
                  <span className="text-sm font-medium text-slate-100">{req.text}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                      req.priority === "must"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    {req.priority}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-surface-border text-slate-400">
                    {req.kind}
                  </span>
                </div>
              </div>

              {/* Verbatim Evidence Quote */}
              {req.evidence && (
                <div className="pl-3 border-l-2 border-slate-700 text-xs text-slate-400 flex items-start gap-1.5 italic">
                  <Quote className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />
                  <span>&ldquo;{req.evidence}&rdquo;</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
