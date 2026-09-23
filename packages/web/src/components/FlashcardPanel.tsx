"use client";

import React, { useState } from "react";
import { Flashcard, Requirement } from "@prepkit/core";
import { BookOpen, Edit3, Check, Trash2, Pin, Plus } from "lucide-react";

interface FlashcardPanelProps {
  flashcards: Flashcard[];
  requirements: Requirement[];
  onUpdateFlashcard: (fid: string, patch: Partial<Flashcard>) => Promise<void>;
  onAddFlashcard: (data: { front: string; back: string; requirement_ids: string[] }) => Promise<void>;
  onDeleteFlashcard: (fid: string) => Promise<void>;
}

export function FlashcardPanel({
  flashcards,
  requirements,
  onUpdateFlashcard,
  onAddFlashcard,
  onDeleteFlashcard,
}: FlashcardPanelProps) {
  const [editingFid, setEditingFid] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newReqId, setNewReqId] = useState(requirements[0]?.id || "");

  const startEdit = (f: Flashcard) => {
    setEditingFid(f.id);
    setEditFront(f.front);
    setEditBack(f.back);
  };

  const saveEdit = async (fid: string) => {
    await onUpdateFlashcard(fid, { front: editFront, back: editBack });
    setEditingFid(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddFlashcard({
      front: newFront,
      back: newBack,
      requirement_ids: newReqId ? [newReqId] : [],
    });
    setNewFront("");
    setNewBack("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <span>Study Flashcards ({flashcards.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quick-recall flashcards designed for rapid active recall sessions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5 text-slate-200"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Card</span>
        </button>
      </div>

      {flashcards.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-surface-border rounded-xl">
          <p className="text-sm text-slate-400">No flashcards generated yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-xs font-semibold text-accent hover:underline"
          >
            + Add a custom flashcard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashcards.map((card) => {
            const isEditing = editingFid === card.id;

            return (
              <div
                key={card.id}
                className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                        {card.id}
                      </span>
                      {card.pinned && (
                        <span className="text-[10px] text-teal-300 bg-teal-950/60 border border-teal-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5" /> Pinned
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => onUpdateFlashcard(card.id, { pinned: !card.pinned })}
                        className={`p-1 rounded hover:bg-surface-border ${
                          card.pinned ? "text-accent" : "hover:text-white"
                        }`}
                        title={card.pinned ? "Unpin card" : "Pin card"}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      {!isEditing ? (
                        <button
                          onClick={() => startEdit(card)}
                          className="p-1 hover:text-accent rounded hover:bg-surface-border"
                          title="Edit card"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => saveEdit(card.id)}
                          className="p-1 text-teal-400 rounded hover:bg-surface-border"
                          title="Save edits"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteFlashcard(card.id)}
                        className="p-1 hover:text-red-400 rounded hover:bg-surface-border"
                        title="Delete card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Front */}
                  {isEditing ? (
                    <div className="space-y-1 mb-2">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Front (Prompt)</label>
                      <input
                        type="text"
                        maxLength={140}
                        value={editFront}
                        onChange={(e) => setEditFront(e.target.value)}
                        className="w-full p-2 text-xs bg-background border border-accent rounded-lg text-slate-200 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <h4 className="text-sm font-semibold text-slate-100 mb-2">{card.front}</h4>
                  )}

                  {/* Card Back */}
                  {isEditing ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Back (Answer)</label>
                      <textarea
                        rows={3}
                        maxLength={300}
                        value={editBack}
                        onChange={(e) => setEditBack(e.target.value)}
                        className="w-full p-2 text-xs bg-background border border-accent rounded-lg text-slate-300 focus:outline-none font-mono"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 leading-relaxed bg-surface-border/30 p-2.5 rounded-lg font-mono">
                      {card.back}
                    </p>
                  )}
                </div>

                {/* Footer Tag */}
                {card.requirement_ids && card.requirement_ids.length > 0 && (
                  <div className="pt-2 border-t border-surface-border flex items-center gap-1">
                    {card.requirement_ids.map((rid) => (
                      <span key={rid} className="font-mono text-[10px] text-slate-400 bg-surface-border px-1.5 py-0.5 rounded">
                        {rid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custom Flashcard Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Add New Flashcard</h3>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Front (Prompt)</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="e.g. Expand-Contract Pattern"
                  className="w-full p-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Back (Explanation)</label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="e.g. Zero-downtime database migration technique..."
                  className="w-full p-2 text-xs bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Requirement</label>
                <select
                  value={newReqId}
                  onChange={(e) => setNewReqId(e.target.value)}
                  className="w-full p-2 text-xs bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none font-mono"
                >
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}: {r.text.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-black text-xs font-bold"
                >
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
