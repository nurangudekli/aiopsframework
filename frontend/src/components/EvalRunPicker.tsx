/**
 * EvalRunPicker — pick a continuous evaluation run to load its metric scores.
 *
 * Used in MigrationGuidePage to populate baseline/candidate score JSON
 * from actual evaluation run results instead of typing manually.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { listContinuousEvalRuns, getContinuousEvalRun } from '../api/client';

interface Props {
  /** Called with the metric scores JSON string, e.g. '{"coherence":4.2,"fluency":4.1,...}' */
  onLoadScores: (scoresJson: string) => void;
  label?: string;
  className?: string;
}

export default function EvalRunPicker({ onLoadScores, label = 'From Eval Run', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: runs = [] } = useQuery({
    queryKey: ['eval-runs-picker'],
    queryFn: () => listContinuousEvalRuns(undefined, 30),
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePick = async (runId: string) => {
    try {
      const detail = await getContinuousEvalRun(runId);
      // detail.metrics is an object like { coherence: { score, method }, ... }
      const scores: Record<string, number> = {};
      if (detail.metrics && typeof detail.metrics === 'object') {
        for (const [k, v] of Object.entries(detail.metrics)) {
          if (v && typeof v === 'object' && 'score' in (v as any)) {
            scores[k] = (v as any).score;
          } else if (typeof v === 'number') {
            scores[k] = v;
          }
        }
      }
      onLoadScores(JSON.stringify(scores, null, 2));
    } catch {
      // If fetching detail fails, just close
    }
    setOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <TrendingUp size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b bg-gray-50">
            <p className="text-xs font-medium text-gray-600">Select an Evaluation Run</p>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {runs.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center">No evaluation runs found.</p>
            ) : (
              runs.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => handlePick(r.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{r.name || r.id}</span>
                    <span className="text-[10px] text-gray-400">{r.deployment || ''}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.model_version && <span className="text-[10px] text-gray-400">v{r.model_version}</span>}
                    <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
