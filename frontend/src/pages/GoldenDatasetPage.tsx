import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, Trash2, Eye, ChevronDown, ChevronUp, Cloud, Database } from 'lucide-react';
import {
  listGoldenDatasets,
  createGoldenDataset,
  uploadGoldenDataset,
  getGoldenDataset,
  deleteGoldenDataset,
  seedSampleDatasets,
} from '../api/client';
import type { GoldenDataset, GoldenDatasetDetail } from '../types';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockGoldenDatasets, mockGoldenDatasetDetail } from '../mocks';
import DataSourceImporter from '../components/DataSourceImporter';

export default function GoldenDatasetPage() {
  const queryClient = useQueryClient();
  const { useMock, toggleMock } = useMockToggle('golden-datasets');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GoldenDatasetDetail | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [manualCases, setManualCases] = useState('');

  const { data: liveDatasets = [], isLoading } = useQuery({
    queryKey: ['golden-datasets'],
    queryFn: () => listGoldenDatasets(),
    enabled: !useMock,
  });
  const datasets = useMock ? mockGoldenDatasets : liveDatasets;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('description', description);
        return uploadGoldenDataset(formData);
      } else {
        const cases = JSON.parse(manualCases || '[]');
        return createGoldenDataset({ name, description, cases });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['golden-datasets'] });
      setShowCreate(false);
      setName('');
      setDescription('');
      setFile(null);
      setManualCases('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoldenDataset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['golden-datasets'] }),
  });

  const seedMut = useMutation({
    mutationFn: seedSampleDatasets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['golden-datasets'] }),
  });

  const toggleDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
    } else {
      setExpandedId(id);
      if (useMock) {
        setDetail(mockGoldenDatasetDetail);
      } else {
        const d = await getGoldenDataset(id);
        setDetail(d);
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Manage reusable test case datasets with expected answers for model evaluation.
        </p>
        <div className="flex gap-2">
          <MockToggle enabled={useMock} onToggle={toggleMock} />
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            <Plus size={16} /> New Dataset
          </button>
        </div>
      </div>

      {/* Import from Environment Data Source */}
      <DataSourceImporter
        importTargets={['golden']}
        onGoldenImported={() => {
          queryClient.invalidateQueries({ queryKey: ['golden-datasets'] });
        }}
      />

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create Golden Dataset</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Customer Service Regression Suite"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Test cases for evaluating model upgrade"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Upload size={14} className="inline mr-1" />
              Upload File (Excel/CSV/JSON)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            <p className="text-xs text-gray-400 mt-1">
              Columns: question, expected_answer (optional), context (optional), category (optional)
            </p>
          </div>

          {!file && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Or paste test cases as JSON array
              </label>
              <textarea
                value={manualCases}
                onChange={(e) => setManualCases(e.target.value)}
                rows={5}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder={`[{"question": "What is AI?", "expected_answer": "AI is..."}]`}
              />
            </div>
          )}

          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Dataset'}
          </button>
          {createMutation.isError && (
            <p className="text-red-600 text-sm mt-2">
              {(createMutation.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Dataset List */}
      {isLoading ? (
        <p className="text-gray-500">Loading datasets…</p>
      ) : datasets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Database className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">No golden datasets yet.</p>
          <p className="text-sm text-gray-400 mb-4">Create one manually, or load built-in sample datasets to get started.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
            >
              <Plus size={14} className="inline mr-1" /> Create Dataset
            </button>
            <button
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {seedMut.isPending ? 'Loading…' : 'Load Sample Datasets'}
            </button>
          </div>
          {seedMut.isSuccess && (
            <p className="text-sm text-green-600 mt-3 font-medium">✓ Sample datasets loaded!</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {datasets.map((ds) => (
            <div key={ds.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Database className="text-emerald-500" size={20} />
                  <div>
                    <h4 className="font-semibold text-gray-900">{ds.name}</h4>
                    <p className="text-xs text-gray-500">
                      {ds.total_cases} cases
                      {ds.source_filename && ` · from ${ds.source_filename}`}
                      {' · '}
                      {new Date(ds.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDetail(ds.id)}
                    className="p-2 text-gray-400 hover:text-emerald-600 transition"
                    title="View cases"
                  >
                    {expandedId === ds.id ? <ChevronUp size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this dataset?')) deleteMutation.mutate(ds.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === ds.id && detail && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs uppercase">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Question</th>
                        <th className="pb-2 pr-3">Expected Answer</th>
                        <th className="pb-2">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.cases.slice(0, 20).map((c) => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="py-2 pr-3 text-gray-400">{c.index + 1}</td>
                          <td className="py-2 pr-3 max-w-xs truncate">{c.question}</td>
                          <td className="py-2 pr-3 max-w-xs truncate text-gray-500">
                            {c.expected_answer || '—'}
                          </td>
                          <td className="py-2 text-gray-500">{c.category || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.cases.length > 20 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Showing 20 of {detail.cases.length} cases
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
