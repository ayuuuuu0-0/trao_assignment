import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Cpu, Clock, CheckCircle } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-surface-border bg-surface/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Prep<span className="text-accent">Me</span></span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-accent hover:bg-accent-hover text-black px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-8 my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Interview Preparation Driven by Verified Evidence</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight">
          Targeted Interview Kits Grounded in <span className="text-accent">Real Job Postings</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Paste any job description and company URL. PrepMe crawls company context, extracts verbatim requirements, verifies 100% coverage, and allocates an optimal study schedule.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-black font-bold text-base transition-colors flex items-center justify-center gap-2"
          >
            <span>Generate Your Prep Kit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-surface border border-surface-border hover:border-slate-600 text-slate-200 font-semibold text-base transition-colors"
          >
            Sign In to Existing Kits
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
            <ShieldCheck className="w-6 h-6 text-accent" />
            <h3 className="font-bold text-slate-100 text-sm">Verbatim Grounding</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every requirement is verified with verbatim job description evidence. Zero hallucinated skills.
            </p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
            <Cpu className="w-6 h-6 text-accent" />
            <h3 className="font-bold text-slate-100 text-sm">100% Must-Have Coverage</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated coverage loop verifies that no critical job requirement goes untested.
            </p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-2">
            <Clock className="w-6 h-6 text-accent" />
            <h3 className="font-bold text-slate-100 text-sm">Deterministic Schedule</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Algorithmic day-by-day scheduler fronts difficult material with integer study minute quotas.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-6 text-center text-xs text-slate-500">
        <p>PrepMe AI Interview Prep Kit &bull; Built with Next.js, Express, and pure TypeScript core.</p>
      </footer>
    </div>
  );
}
