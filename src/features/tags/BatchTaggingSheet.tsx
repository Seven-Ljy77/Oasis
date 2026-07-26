import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { BatchTagConfig } from "@/stores/useAppStore";

interface BatchTaggingSheetProps {
  open: boolean;
  onClose: () => void;
}

type Phase = "configure" | "running" | "review" | "applying";

const BatchTaggingSheet: React.FC<BatchTaggingSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("configure");

  // Configure pane state
  const [scope, setScope] = useState<"time_range" | "all" | "unread">("all");
  const [skipAlreadyTagged, setSkipAlreadyTagged] = useState(true);
  const [skipAlreadyApplied, setSkipAlreadyApplied] = useState(false);
  const [concurrency, setConcurrency] = useState(3);
  const [candidateCount, setCandidateCount] = useState(50);

  // Running pane state
  const [processed, setProcessed] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [currentEntry, setCurrentEntry] = useState<string | null>(null);

  // Review pane state
  const [proposals, setProposals] = useState<{ entryId: number; title: string; tags: string[] }[]>([
    { entryId: 1, title: "Getting Started with Rust", tags: ["rust", "programming", "tutorial"] },
    { entryId: 2, title: "TypeScript 5.7 Released", tags: ["typescript", "javascript", "release"] },
    { entryId: 3, title: "Understanding RSC", tags: ["react", "frontend", "server-components"] },
  ]);

  const [applied, setApplied] = useState(0);
  const totalCandidates = 3; // placeholder

  const handleStart = () => {
    setPhase("running");
    setProcessed(0);
    setSucceeded(0);
    setFailed(0);
    // Simulate progress
    let p = 0;
    const interval = setInterval(() => {
      p++;
      setProcessed(p);
      setSucceeded(p);
      setCurrentEntry(`Processing entry #${p}...`);
      if (p >= totalCandidates) {
        clearInterval(interval);
        setPhase("review");
        setCurrentEntry(null);
      }
    }, 1000);
  };

  const handleApplyAll = () => {
    setPhase("applying");
    let a = 0;
    const interval = setInterval(() => {
      a++;
      setApplied(a);
      if (a >= totalCandidates) {
        clearInterval(interval);
        onClose();
      }
    }, 500);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.batchTagging.title} width="640px" maxWidth="95vw">
      <div className="space-y-4">
        {/* ---- Configure Pane ---- */}
        {phase === "configure" && (
          <>
            {/* Scope picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.batchTagging.scope}</label>
              <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
                {(["time_range", "all", "unread"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                      scope === s
                        ? "bg-surface text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {s === "time_range" ? "Time Range" : s === "all" ? t.sidebar.all : t.entryList.unreadOnly}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip options */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAlreadyTagged}
                  onChange={(e) => setSkipAlreadyTagged(e.target.checked)}
                  className="rounded border-slate-300 text-accent w-3.5 h-3.5"
                />
                <span className="text-sm text-slate-600">
                  {t.batchTagging.skipTagged}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAlreadyApplied}
                  onChange={(e) => setSkipAlreadyApplied(e.target.checked)}
                  className="rounded border-slate-300 text-accent w-3.5 h-3.5"
                />
                <span className="text-sm text-slate-600">
                  {t.batchTagging.skipAttempted}
                </span>
              </label>
            </div>

            {/* Concurrency slider */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.batchTagging.concurrency}: {concurrency}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
                className="w-64 h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            {/* Candidate count */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.batchTagging.scope}: {candidateCount}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={candidateCount}
                onChange={(e) => setCandidateCount(parseInt(e.target.value))}
                className="w-64 h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            {/* Large batch warning */}
            {candidateCount >= 100 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                Processing {candidateCount} candidates may take several minutes and consume
                significant LLM tokens.
              </div>
            )}
          </>
        )}

        {/* ---- Running Pane ---- */}
        {phase === "running" && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{t.batchTagging.processed}</span>
                <span>
                  {processed}/{totalCandidates}
                </span>
              </div>
              <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${(processed / totalCandidates) * 100}%` }}
                />
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="text-lg font-semibold text-slate-700">{processed}</div>
                <div className="text-xs text-slate-400">{t.batchTagging.processed}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-green-600">{succeeded}</div>
                <div className="text-xs text-slate-400">{t.batchTagging.succeeded}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-red-600">{failed}</div>
                <div className="text-xs text-slate-400">{t.batchTagging.failed}</div>
              </div>
            </div>

            {/* Current entry */}
            {currentEntry && (
              <div className="text-sm text-slate-500 animate-pulse">{currentEntry}</div>
            )}
          </div>
        )}

        {/* ---- Review Pane ---- */}
        {phase === "review" && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">
              {t.batchTagging.review} ({proposals.length})
            </h4>
            <p className="text-xs text-slate-500">
              {t.batchTagging.review}: {t.batchTagging.keep} or {t.batchTagging.discard}.
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {proposals.map((proposal) => (
                <div
                  key={proposal.entryId}
                  className="p-3 border border-border rounded-lg"
                >
                  <div className="text-sm font-medium text-slate-700 mb-1">
                    {proposal.title}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {proposal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 border border-purple-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm">{t.batchTagging.keep}</Button>
                    <Button variant="ghost" size="sm">{t.batchTagging.discard}</Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="primary" size="sm" onClick={handleApplyAll}>
                {t.batchTagging.apply}
              </Button>
              <Button variant="secondary" size="sm">{t.digest.selectAll}</Button>
              <Button variant="ghost" size="sm">{t.digest.deselectAll}</Button>
            </div>
          </div>
        )}

        {/* ---- Applying Pane ---- */}
        {phase === "applying" && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700">{t.batchTagging.apply}...</h4>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{t.batchTagging.apply}</span>
                <span>
                  {applied}/{totalCandidates}
                </span>
              </div>
              <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(applied / totalCandidates) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div className="text-xs text-slate-400">
            {phase === "configure" && totalCandidates > 0 && (
              <span>{totalCandidates} candidates available</span>
            )}
          </div>
          <div className="flex gap-2">
            {phase === "configure" && (
              <>
                <Button variant="secondary" size="md" onClick={onClose}>
                  {t.common.cancel}
                </Button>
                <Button variant="primary" size="md" onClick={handleStart}>
                  {t.batchTagging.start}
                </Button>
              </>
            )}
            {phase === "running" && (
              <Button variant="danger" size="md" onClick={() => setPhase("configure")}>
                {t.batchTagging.abort}
              </Button>
            )}
            {phase === "review" && (
              <Button variant="secondary" size="md" onClick={() => setPhase("configure")}>
                {t.batchTagging.configure}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
};

export default BatchTaggingSheet;
