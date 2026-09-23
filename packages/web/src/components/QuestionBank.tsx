"use client";

import React, { useState } from "react";
import {
  Question,
  QuestionCategory,
  Requirement,
} from "@prepkit/core";
import {
  Pin,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Check,
  Plus,
  RefreshCw,
  FolderInput,
  Star,
} from "lucide-react";

interface QuestionBankProps {
  questions: Question[];
  requirements: Requirement[];
  onUpdateQuestion: (qid: string, patch: Partial<Question>) => Promise<void>;
  onAddQuestion: (data: { category: QuestionCategory; prompt: string; answer_outline: string; difficulty: number; requirement_ids: string[] }) => Promise<void>;
  onDeleteQuestion: (qid: string) => Promise<void>;
  onMoveQuestion: (qid: string, toCategory: QuestionCategory) => Promise<void>;
  onReorderQuestions: (category: QuestionCategory, orderedIds: string[]) => Promise<void>;
  onRegenerateCategory: (category: QuestionCategory) => Promise<void>;
}

const CATEGORIES: Array<{ key: QuestionCategory; label: string }> = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System Design" },
  { key: "company-fit", label: "Company Fit" },
];

export function QuestionBank({
  questions,
  requirements,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  onReorderQuestions,
  onRegenerateCategory,
}: QuestionBankProps) {
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>("technical");
  const [editingQid, setEditingQid] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editOutline, setEditOutline] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New question form state
  const [newPrompt, setNewPrompt] = useState("");
  const [newOutline, setNewOutline] = useState("");
  const [newDifficulty, setNewDifficulty] = useState(2);
  const [newReqId, setNewReqId] = useState(requirements[0]?.id || "");

  const categoryQuestions = questions.filter((q) => q.category === selectedCategory);

  const startEdit = (q: Question) => {
    setEditingQid(q.id);
    setEditPrompt(q.prompt);
    setEditOutline(q.answer_outline);
  };

  const saveEdit = async (qid: string) => {
    await onUpdateQuestion(qid, {
      prompt: editPrompt,
      answer_outline: editOutline,
    });
    setEditingQid(null);
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = categoryQuestions.map((q) => q.id);
    const temp = ids[index - 1];
    ids[index - 1] = ids[index];
    ids[index] = temp;
    await onReorderQuestions(selectedCategory, ids);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= categoryQuestions.length - 1) return;
    const ids = categoryQuestions.map((q) => q.id);
    const temp = ids[index + 1];
    ids[index + 1] = ids[index];
    ids[index] = temp;
    await onReorderQuestions(selectedCategory, ids);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerateCategory(selectedCategory);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddQuestion({
      category: selectedCategory,
      prompt: newPrompt,
      answer_outline: newOutline,
      difficulty: newDifficulty,
      requirement_ids: newReqId ? [newReqId] : [],
    });
    setNewPrompt("");
    setNewOutline("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Category Pills & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {CATEGORIES.map((cat) => {
            const count = questions.filter((q) => q.category === cat.key).length;
            const isSelected = selectedCategory === cat.key;

            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? "bg-accent text-black font-bold"
                    : "bg-surface-card border border-surface-border text-slate-300 hover:text-white"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-black/20 text-black" : "bg-surface-border text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5 text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>

          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5 text-slate-200 disabled:opacity-50"
            title="Regenerates unedited questions while keeping all hand-written and pinned questions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin text-accent" : ""}`} />
            <span>Regenerate Category</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      {categoryQuestions.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-surface-border rounded-xl">
          <p className="text-sm text-slate-400">No questions in this category yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-xs font-semibold text-accent hover:underline"
          >
            + Add a custom question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryQuestions.map((q, idx) => {
            const isEditing = editingQid === q.id;

            return (
              <div
                key={q.id}
                className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-slate-700 transition-colors space-y-3"
              >
                {/* Question Header & Controls */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                      {q.id}
                    </span>

                    {/* Difficulty Badge */}
                    <div className="flex items-center gap-0.5 text-amber-400 text-xs px-2 py-0.5 rounded bg-surface-border">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span className="font-semibold text-[11px]">Diff {q.difficulty}</span>
                    </div>

                    {/* Origin / Pin Badge */}
                    {q.pinned && (
                      <span className="text-[11px] font-semibold text-teal-300 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}

                    {q.edited && (
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider bg-surface-border px-1.5 py-0.5 rounded">
                        Edited
                      </span>
                    )}

                    {/* Covered Requirement IDs */}
                    {q.requirement_ids.map((rid) => (
                      <span
                        key={rid}
                        className="font-mono text-[10px] text-slate-400 bg-surface-border px-1.5 py-0.5 rounded"
                      >
                        {rid}
                      </span>
                    ))}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border"
                      title="Move Up"
                      aria-label="Move question up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === categoryQuestions.length - 1}
                      className="p-1 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border"
                      title="Move Down"
                      aria-label="Move question down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onUpdateQuestion(q.id, { pinned: !q.pinned })}
                      className={`p-1 rounded hover:bg-surface-border ${
                        q.pinned ? "text-accent" : "hover:text-white"
                      }`}
                      title={q.pinned ? "Unpin (allows regeneration)" : "Pin (protects from regeneration)"}
                    >
                      <Pin className="w-4 h-4" />
                    </button>

                    {/* Category Move Dropdown */}
                    <div className="relative inline-block">
                      <select
                        value={q.category}
                        onChange={(e) => onMoveQuestion(q.id, e.target.value as QuestionCategory)}
                        className="opacity-0 absolute inset-0 cursor-pointer w-full"
                        aria-label="Move to category"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="p-1 hover:text-white rounded hover:bg-surface-border"
                        title="Move to another category"
                      >
                        <FolderInput className="w-4 h-4" />
                      </button>
                    </div>

                    {!isEditing ? (
                      <button
                        onClick={() => startEdit(q)}
                        className="p-1 hover:text-accent rounded hover:bg-surface-border"
                        title="Edit question and outline"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => saveEdit(q.id)}
                        className="p-1 text-teal-400 rounded hover:bg-surface-border"
                        title="Save inline edits"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteQuestion(q.id)}
                      className="p-1 hover:text-red-400 rounded hover:bg-surface-border"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Prompt */}
                {isEditing ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Question Prompt</label>
                    <textarea
                      rows={2}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="w-full p-2 text-sm bg-background border border-accent rounded-lg text-slate-200 focus:outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-100">{q.prompt}</p>
                )}

                {/* Answer Outline */}
                {isEditing ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Answer Outline / Criteria</label>
                    <textarea
                      rows={3}
                      value={editOutline}
                      onChange={(e) => setEditOutline(e.target.value)}
                      className="w-full p-2 text-xs bg-background border border-accent rounded-lg text-slate-300 focus:outline-none font-mono"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-surface-border/40 rounded-lg text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-400 block mb-1 uppercase tracking-wider text-[10px]">
                      Expected Answer Outline:
                    </span>
                    {q.answer_outline}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custom Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Add New Question</h3>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Prompt</label>
                <textarea
                  required
                  rows={2}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Describe your technical approach..."
                  className="w-full p-2 text-sm bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Answer Outline</label>
                <textarea
                  required
                  rows={3}
                  value={newOutline}
                  onChange={(e) => setNewOutline(e.target.value)}
                  placeholder="Key criteria, expected points, trade-offs..."
                  className="w-full p-2 text-xs bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(parseInt(e.target.value, 10))}
                    className="w-full p-2 text-xs bg-background border border-surface-border rounded-lg text-slate-200 focus:outline-none"
                  >
                    <option value={1}>1 - Fundamental / Recall</option>
                    <option value={2}>2 - Practical Implementation</option>
                    <option value={3}>3 - Deep Architecture / Trade-offs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Target Requirement</label>
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
                  Create Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
