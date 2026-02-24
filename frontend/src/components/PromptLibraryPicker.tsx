/**
 * PromptLibraryPicker — inline dropdown to pick a prompt from the library.
 *
 * Renders a small "From Library" button. Clicking it shows a dropdown
 * listing all saved prompts. Picking one calls `onSelect` with the
 * prompt's content (and optionally its system message).
 *
 * The parent decides which fields to fill.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronDown, Search } from 'lucide-react';
import { listPrompts } from '../api/client';

export interface PromptSelection {
  name: string;
  content: string;
  system_message?: string;
  variables?: string[];
}

interface Props {
  /** Called when a prompt is selected. Receives the current‐version content + system_message. */
  onSelect: (selection: PromptSelection) => void;
  /** Button label override */
  label?: string;
  /** Extra CSS classes on the wrapper */
  className?: string;
  /** Only show prompts whose tags include this value (optional filter) */
  tagFilter?: string;
}

export default function PromptLibraryPicker({ onSelect, label = 'From Library', className = '', tagFilter }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const { data: prompts = [] } = useQuery({
    queryKey: ['prompts-picker'],
    queryFn: () => listPrompts(),
    staleTime: 30_000,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = prompts.filter((p: any) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesTag =
      !tagFilter ||
      (p.tags && Object.values(p.tags).some((v: any) => String(v).toLowerCase().includes(tagFilter.toLowerCase())));
    return matchesSearch && (tagFilter ? matchesTag : true);
  });

  const handlePick = (p: any) => {
    const currentVersion = p.versions?.find((v: any) => v.is_current) || p.versions?.[0];
    onSelect({
      name: p.name,
      content: currentVersion?.content ?? '',
      system_message: p.system_message ?? undefined,
      variables: currentVersion?.variables ?? [],
    });
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <BookOpen size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={14} className="text-gray-400" />
              <input
                autoFocus
                className="flex-1 text-sm bg-transparent outline-none"
                placeholder="Search prompts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto divide-y">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                {prompts.length === 0 ? 'No prompts in library yet. Create some in the Prompts page.' : 'No prompts match your search.'}
              </div>
            ) : (
              filtered.map((p: any) => {
                const currentVer = p.versions?.find((v: any) => v.is_current) || p.versions?.[0];
                const varCount = currentVer?.variables?.length ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePick(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
                      {varCount > 0 && (
                        <span className="text-[10px] text-gray-400">{varCount} vars</span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                    )}
                    {p.tags && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(p.tags).map(([k, v]) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
