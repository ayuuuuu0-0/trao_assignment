"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { Sparkles, BookOpen, LogOut, Menu, X, User } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/kits" className="flex items-center gap-2 font-bold text-lg tracking-tight group">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-black transition-colors">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>Prep<span className="text-accent">Me</span></span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/kits"
            className={`text-sm font-medium transition-colors hover:text-accent flex items-center gap-2 ${
              pathname.startsWith("/kits") ? "text-accent" : "text-slate-400"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Interview Kits
          </Link>
        </nav>

        {/* User / Actions */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-surface-border/50 px-3 py-1.5 rounded-full border border-surface-border">
                <User className="w-3.5 h-3.5 text-accent" />
                <span className="font-medium text-slate-200">{user.email}</span>
              </div>
              <button
                onClick={() => logout()}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1.5 transition-colors p-1.5"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium bg-accent hover:bg-accent-hover text-black px-3.5 py-1.5 rounded-lg transition-colors font-semibold"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-400 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer (375px responsive check) */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 space-y-3 border-t border-surface-border bg-surface">
          <Link
            href="/kits"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-accent"
          >
            My Kits
          </Link>
          {user ? (
            <div className="pt-2 border-t border-surface-border/50 flex items-center justify-between">
              <span className="text-xs text-slate-400 truncate max-w-[200px]">{user.email}</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="text-xs text-red-400 hover:underline flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm font-medium text-slate-300 hover:text-white"
              >
                Log In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm font-medium bg-accent text-black rounded-lg font-semibold"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
