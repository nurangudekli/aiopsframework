import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Copy, BookOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPrompts, createPromptApi, deletePromptApi, seedSamplePrompts } from '../api/client';

export default function PromptsPage() {
  const qc = useQueryClient();
  const { data: prompts = [], isLoading } = useQuery({ queryKey: ['prompts'], queryFn: () => listPrompts() });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', system_message: '', content: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createPromptApi({
      name: form.name,
      description: form.description || undefined,
      system_message: form.system_message || undefined,
      initial_content: form.content,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompts'] });
      setShowCreate(false);
      setForm({ name: '', description: '', system_message: '', content: '' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePromptApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  });

  const seedMut = useMutation({
    mutationFn: seedSamplePrompts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 text-sm">
          Version, template, and A/B test your prompts with full history tracking.
        </p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          + New Prompt
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Prompt</h2>
          <div className="space-y-4">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Prompt Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={3}
              placeholder="System Message"
              value={form.system_message}
              onChange={(e) => setForm({ ...form, system_message: e.target.value })}
            />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Prompt Template (use {'{{variable_name}}'} for variables)
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                rows={6}
                placeholder={'You are an expert in {{domain}}.\n\nAnswer the following question: {{question}}'}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <button
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={createMut.isPending || !form.name || !form.content}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Creating…' : 'Create Prompt'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Prompts Library</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400">Loading prompts…</div>
        ) : prompts.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700">No prompts yet.</h3>
            <p className="text-sm text-gray-400 mt-1 mb-6">Create one manually, or load built-in sample prompts to get started.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                + Create Prompt
              </button>
              <button
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {seedMut.isPending ? 'Loading…' : 'Load Sample Prompts'}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {prompts.map((p: any) => {
              const isExpanded = expandedId === p.id;
              const currentVersion = p.versions?.find((v: any) => v.is_current) || p.versions?.[0];
              return (
                <div key={p.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{p.name}</h3>
                        {p.versions && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                            v{p.versions.length}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                      {p.tags && (
                        <div className="flex gap-1 mt-2">
                          {Object.entries(p.tags).map(([k, v]) => (
                            <span key={k} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteMut.mutate(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete prompt"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {isExpanded && currentVersion && (
                    <div className="mt-4 space-y-3">
                      {p.system_message && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">System Message</h4>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 whitespace-pre-wrap">
                            {p.system_message}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase">Prompt Template (v{currentVersion.version})</h4>
                          <button
                            onClick={() => navigator.clipboard.writeText(currentVersion.content)}
                            className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1"
                          >
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                          {currentVersion.content}
                        </pre>
                      </div>
                      {currentVersion.variables && currentVersion.variables.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Variables</h4>
                          <div className="flex flex-wrap gap-1">
                            {currentVersion.variables.map((v: string) => (
                              <span key={v} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono">
                                {'{{' + v + '}}'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
