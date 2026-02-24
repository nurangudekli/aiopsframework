/**
 * GoldenDatasetPicker — load questions / cases / JSON from a golden dataset.
 *
 * Versatile component with three callback modes:
 *  - onLoadQuestions(questions: string[])     — bulk question list
 *  - onSelectCase({ question, expected_answer, context }) — single case
 *  - onLoadDatasetJson(json: string)          — full dataset as JSON array
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, ChevronDown, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { listGoldenDatasets, getGoldenDataset } from '../api/client';
import type { GoldenDataset, GoldenTestCaseOut } from '../types';

export interface GoldenCaseSelection {
  question: string;
  expected_answer?: string;
  context?: string;
  category?: string;
}

interface Props {
  /** Fill a multi-line field with all questions from the dataset */
  onLoadQuestions?: (questions: string[]) => void;
  /** Pick a single case (returns question + expected_answer + context) */
  onSelectCase?: (c: GoldenCaseSelection) => void;
  /** Load entire dataset as JSON string (for batch eval textareas) */
  onLoadDatasetJson?: (json: string) => void;
  /** Button label */
  label?: string;
  className?: string;
}

export default function GoldenDatasetPicker({
  onLoadQuestions,
  onSelectCase,
  onLoadDatasetJson,
  label = 'From Dataset',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data: datasets = [] } = useQuery({
    queryKey: ['golden-datasets-picker'],
    queryFn: listGoldenDatasets,
    staleTime: 30_000,
  });

  const { data: detail, isFetching } = useQuery({
    queryKey: ['golden-dataset-detail', selectedId],
    queryFn: () => getGoldenDataset(selectedId!),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedId(null);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const close = () => { setOpen(false); setSelectedId(null); };

  const handleLoadQuestions = () => {
    if (!detail) return;
    onLoadQuestions?.(detail.cases.map((c) => c.question));
    close();
  };

  const handleLoadJson = () => {
    if (!detail) return;
    const arr = detail.cases.map((c) => ({
      query: c.question,
      response: c.expected_answer ?? '',   // pre-fill response with expected answer so SDK evaluators don't get empty strings
      ground_truth: c.expected_answer ?? '',
      context: c.context ?? '',
    }));
    onLoadDatasetJson?.(JSON.stringify(arr, null, 2));
    close();
  };

  const handleSelectCase = (c: GoldenTestCaseOut) => {
    onSelectCase?.({
      question: c.question,
      expected_answer: c.expected_answer,
      context: c.context,
      category: c.category,
    });
    close();
  };

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (open) setSelectedId(null); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
      >
        <Database size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
          {!selectedId ? (
            /* Step 1 — pick a dataset */
            <>
              <div className="px-3 py-2 border-b bg-gray-50">
                <p className="text-xs font-medium text-gray-600">Select a Golden Dataset</p>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y">
                {datasets.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400 text-center">No golden datasets found. Create one in the Evaluation page.</p>
                ) : (
                  datasets.map((ds: GoldenDataset) => (
                    <button
                      key={ds.id}
                      onClick={() => setSelectedId(ds.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{ds.name}</span>
                        <span className="text-[10px] text-gray-400">{ds.total_cases} cases</span>
                      </div>
                      {ds.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ds.description}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Step 2 — choose what to load */
            <>
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2">
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft size={14} />
                </button>
                <p className="text-xs font-medium text-gray-600 truncate">
                  {datasets.find((d) => d.id === selectedId)?.name}
                </p>
              </div>

              {isFetching ? (
                <div className="p-4 text-center text-xs text-gray-400">Loading cases…</div>
              ) : (
                <div className="divide-y">
                  {/* Bulk actions */}
                  {onLoadQuestions && (
                    <button
                      onClick={handleLoadQuestions}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Load all questions</p>
                        <p className="text-[10px] text-gray-400">{detail?.cases.length} questions → one per line</p>
                      </div>
                    </button>
                  )}
                  {onLoadDatasetJson && (
                    <button
                      onClick={handleLoadJson}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Load as JSON dataset</p>
                        <p className="text-[10px] text-gray-400">Full dataset with query, ground_truth, context</p>
                      </div>
                    </button>
                  )}

                  {/* Individual case list */}
                  {onSelectCase && (
                    <div className="max-h-48 overflow-y-auto">
                      <p className="px-3 pt-2 pb-1 text-[10px] text-gray-400 uppercase tracking-wider">Pick a case</p>
                      {detail?.cases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectCase(c)}
                          className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors"
                        >
                          <p className="text-xs text-gray-700 line-clamp-2">{c.question}</p>
                          {c.category && <span className="text-[10px] text-gray-400">{c.category}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
