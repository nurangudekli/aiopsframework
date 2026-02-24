import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Play,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import {
  listGoldenDatasets,
  listMigrationRuns,
  createMigrationRun,
  getMigrationRun,
  getMigrationSummary,
  exportMigrationRun,
  getParameterDiff,
  seedSampleDatasets,
} from '../api/client';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import type {
  GoldenDataset,
  MigrationRun,
  MigrationRunDetail,
  MigrationSummary,
  ParameterDiff,
} from '../types';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import {
  mockGoldenDatasets,
  mockMigrationRuns,
  mockMigrationRunDetail,
  mockMigrationSummary,
  mockParameterDiff,
} from '../mocks';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const recommendationConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  ready: { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2, label: 'Ready to Migrate' },
  needs_review: { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle, label: 'Needs Review' },
  not_ready: { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle, label: 'Not Ready' },
};

export default function MigrationPipelinePage() {
  const queryClient = useQueryClient();
  const { useMock, toggleMock } = useMockToggle('migration');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'runs' | 'diff'>('pipeline');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<MigrationRunDetail | null>(null);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);

  // Pipeline form
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [srcProvider, setSrcProvider] = useState('azure_openai');
  const [srcDeployment, setSrcDeployment] = useState('');
  const [srcDeploymentType, setSrcDeploymentType] = useState<'Standard' | 'PTU'>('Standard');
  const [tgtProvider, setTgtProvider] = useState('azure_openai');
  const [tgtDeployment, setTgtDeployment] = useState('');
  const [tgtDeploymentType, setTgtDeploymentType] = useState<'Standard' | 'PTU'>('Standard');
  const [sysMsg, setSysMsg] = useState('');
  const [threshold, setThreshold] = useState(0.7);

  // Diff form
  const [diffSrc, setDiffSrc] = useState('');
  const [diffTgt, setDiffTgt] = useState('');
  const [diffSrcProvider, setDiffSrcProvider] = useState('azure_openai');
  const [diffTgtProvider, setDiffTgtProvider] = useState('azure_openai');
  const [diffResult, setDiffResult] = useState<ParameterDiff | null>(null);

  const { data: liveDatasets = [] } = useQuery({
    queryKey: ['golden-datasets'],
    queryFn: listGoldenDatasets,
    enabled: !useMock,
  });
  const datasets = useMock ? mockGoldenDatasets : liveDatasets;

  const seedMut = useMutation({
    mutationFn: seedSampleDatasets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['golden-datasets'] });
    },
  });

  const { data: liveRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: ['migration-runs'],
    queryFn: listMigrationRuns,
    enabled: !useMock,
  });
  const runs = useMock ? mockMigrationRuns : liveRuns;

  const runMutation = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockMigrationRuns[0]);
      return createMigrationRun({
        name: pName,
        description: pDesc || undefined,
        golden_dataset_id: datasetId,
        source_model: { provider: srcProvider, deployment: srcDeployment, deployment_type: srcDeploymentType },
        target_model: { provider: tgtProvider, deployment: tgtDeployment, deployment_type: tgtDeploymentType },
        system_message: sysMsg || undefined,
        similarity_threshold: threshold,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-runs'] });
      setActiveTab('runs');
    },
  });

  const diffMutation = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockParameterDiff);
      return getParameterDiff({
        source_model: { provider: diffSrcProvider, deployment: diffSrc },
        target_model: { provider: diffTgtProvider, deployment: diffTgt },
      });
    },
    onSuccess: (data) => setDiffResult(data),
  });

  const toggleRunDetail = async (id: string) => {
    if (expandedRunId === id) {
      setExpandedRunId(null);
      setRunDetail(null);
      setSummary(null);
    } else {
      setExpandedRunId(id);
      if (useMock) {
        setRunDetail(mockMigrationRunDetail);
        setSummary(mockMigrationSummary);
      } else {
        const [d, s] = await Promise.all([getMigrationRun(id), getMigrationSummary(id)]);
        setRunDetail(d);
        setSummary(s);
      }
    }
  };

  const handleExport = async (runId: string, format: 'csv' | 'json') => {
    const data = await exportMigrationRun(runId, format);
    const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
      type: format === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_${runId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-purple-600" size={28} />
            Migration Pipeline
          </h1>
          <MockToggle enabled={useMock} onToggle={toggleMock} />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          End-to-end model migration evaluation: compare source vs target models using golden datasets
        </p>
      </div>

      <PageBanner
        title="How to use the Migration Pipeline"
        description="Run a full model migration evaluation: pick a golden dataset, configure source and target models, and get a readiness verdict with detailed per-question results."
        accentColor="purple"
        steps={[
          { label: 'Select Run Pipeline tab', detail: 'Name your run, choose a golden dataset, set source and target model configs, and set a similarity threshold.' },
          { label: 'Click Run Migration Evaluation', detail: 'The pipeline sends every test case to both models and computes similarity, latency, and cost comparisons.' },
          { label: 'Review Past Runs', detail: 'Switch to the Past Runs tab to see all runs with status, recommendation (Ready / Needs Review / Not Ready), and expand for details.' },
          { label: 'Inspect detailed results', detail: 'Expand a run to see summary cards (similarity, latency change, cost change), regression breakdown, and per-question comparison table.' },
          { label: 'Compare parameters', detail: 'On the Parameter Review tab, select two models and click Compare to see API parameter differences, compatibility notes, and a migration checklist.' },
        ]}
        tips={[
          'Export results as CSV or JSON from the Past Runs tab for offline analysis.',
          'A similarity threshold of 0.7 (70%) is a good starting point; adjust based on your quality requirements.',
          'The Parameter Review tab helps identify API changes before you run the full evaluation.',
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'pipeline' as const, label: 'Run Pipeline', icon: Play },
          { key: 'runs' as const, label: 'Past Runs', icon: BarChart3 },
          { key: 'diff' as const, label: 'Parameter Review', icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === key ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Run Pipeline ── */}
      {activeTab === 'pipeline' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">New Migration Evaluation</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run Name *</label>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Migration Test Run"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Golden Dataset *</label>
              <select
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a dataset…</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.total_cases} cases)
                  </option>
                ))}
              </select>
              {!useMock && datasets.length === 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 mb-2">
                    No golden datasets found. Create one on the{' '}
                    <a href="/evaluation?tab=datasets" className="underline font-medium">Evaluation → Golden Datasets</a> tab, or load built-in samples:
                  </p>
                  <button
                    onClick={() => seedMut.mutate()}
                    disabled={seedMut.isPending}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {seedMut.isPending ? 'Loading samples…' : 'Load Sample Datasets'}
                  </button>
                  {seedMut.isSuccess && (
                    <span className="ml-2 text-xs text-green-600 font-medium">✓ Samples loaded — select one above</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Source / Target model config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-3">Source Model (Current)</h4>
              <div className="space-y-2">
                <ProviderSelect
                  label=""
                  value={srcProvider}
                  onChange={setSrcProvider}
                  size="sm"
                />
                <DeploymentSelect
                  label=""
                  value={srcDeployment}
                  onChange={setSrcDeployment}
                  placeholder="Select or type deployment…"
                  size="sm"
                />
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Deployment Type</label>
                  <select
                    value={srcDeploymentType}
                    onChange={(e) => setSrcDeploymentType(e.target.value as 'Standard' | 'PTU')}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="Standard">Standard (Pay-as-you-go)</option>
                    <option value="PTU">PTU (Provisioned Throughput)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="text-sm font-semibold text-purple-800 mb-3">Target Model (New)</h4>
              <div className="space-y-2">
                <ProviderSelect
                  label=""
                  value={tgtProvider}
                  onChange={setTgtProvider}
                  size="sm"
                />
                <DeploymentSelect
                  label=""
                  value={tgtDeployment}
                  onChange={setTgtDeployment}
                  placeholder="Select or type deployment…"
                  size="sm"
                />
                <div>
                  <label className="block text-xs font-medium text-purple-700 mb-1">Deployment Type</label>
                  <select
                    value={tgtDeploymentType}
                    onChange={(e) => setTgtDeploymentType(e.target.value as 'Standard' | 'PTU')}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="Standard">Standard (Pay-as-you-go)</option>
                    <option value="PTU">PTU (Provisioned Throughput)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">System Message</label>
                <PromptLibraryPicker onSelect={(s) => setSysMsg(s.system_message || s.content)} />
              </div>
              <textarea
                value={sysMsg}
                onChange={(e) => setSysMsg(e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Optional system message for both models"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Similarity Threshold: {threshold}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400">
                Pass/fail threshold for reference answer comparison
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => runMutation.mutate()}
              disabled={!pName || !datasetId || runMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
            >
              <Play size={16} />
              {runMutation.isPending ? 'Running evaluation…' : 'Run Migration Evaluation'}
            </button>
            {runMutation.isError && (
              <span className="text-red-600 text-sm">{(runMutation.error as Error).message}</span>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Past Runs ── */}
      {activeTab === 'runs' && (
        <div>
          {runsLoading ? (
            <p className="text-gray-500">Loading runs…</p>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <ArrowRightLeft className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500">No migration runs yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const rec = run.recommendation ? recommendationConfig[run.recommendation] : null;
                return (
                  <div key={run.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 flex-1">
                        <ArrowRightLeft className="text-purple-500 shrink-0" size={20} />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{run.name}</h4>
                          <p className="text-xs text-gray-500">
                            {run.source_deployment}
                            {(run as any).source_deployment_type && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${(run as any).source_deployment_type === 'PTU' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {(run as any).source_deployment_type}
                              </span>
                            )}
                            {' → '}{run.target_deployment}
                            {(run as any).target_deployment_type && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${(run as any).target_deployment_type === 'PTU' || (run as any).target_deployment_type === 'ProvisionedManaged' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {(run as any).target_deployment_type === 'ProvisionedManaged' ? 'PTU' : (run as any).target_deployment_type}
                              </span>
                            )}
                            {' · '}{run.completed_cases}/{run.total_cases} cases
                            {' · '}{new Date(run.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[run.status] || ''}`}>
                          {run.status}
                        </span>
                        {rec && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${rec.color}`}>
                            <rec.icon size={12} /> {rec.label}
                          </span>
                        )}
                        <button
                          onClick={() => handleExport(run.id, 'csv')}
                          className="p-1.5 text-gray-400 hover:text-purple-600 transition"
                          title="Export CSV"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleExport(run.id, 'json')}
                          className="p-1.5 text-gray-400 hover:text-purple-600 transition"
                          title="Export JSON"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => toggleRunDetail(run.id)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 transition"
                        >
                          {expandedRunId === run.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expandedRunId === run.id && summary && (
                      <div className="border-t bg-gray-50">
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                          <SummaryCard
                            label="Avg Similarity"
                            value={summary.avg_similarity != null ? `${(summary.avg_similarity * 100).toFixed(1)}%` : '—'}
                          />
                          <SummaryCard
                            label="Latency Change"
                            value={summary.latency_change_pct != null ? `${summary.latency_change_pct > 0 ? '+' : ''}${summary.latency_change_pct}%` : '—'}
                            color={summary.latency_change_pct != null ? (summary.latency_change_pct <= 0 ? 'text-green-600' : 'text-red-600') : ''}
                          />
                          <SummaryCard
                            label="Cost Change"
                            value={summary.cost_change_pct != null ? `${summary.cost_change_pct > 0 ? '+' : ''}${summary.cost_change_pct}%` : '—'}
                            color={summary.cost_change_pct != null ? (summary.cost_change_pct <= 0 ? 'text-green-600' : 'text-red-600') : ''}
                          />
                          <SummaryCard
                            label="Quality Change"
                            value={summary.quality_change_pct != null ? `${summary.quality_change_pct > 0 ? '+' : ''}${summary.quality_change_pct}%` : '—'}
                            color={summary.quality_change_pct != null ? (summary.quality_change_pct >= 0 ? 'text-green-600' : 'text-red-600') : ''}
                          />
                        </div>

                        {/* Deployment type info */}
                        {((summary as any).source_deployment_type || (summary as any).target_deployment_type) && (
                          <div className="px-4 pb-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">Deployment:</span>
                              <span className={`px-2 py-0.5 rounded font-medium ${(summary as any).source_deployment_type === 'PTU' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                Source: {(summary as any).source_deployment_type || 'Standard'}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className={`px-2 py-0.5 rounded font-medium ${(summary as any).target_deployment_type === 'PTU' || (summary as any).target_deployment_type === 'ProvisionedManaged' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                Target: {(summary as any).target_deployment_type === 'ProvisionedManaged' ? 'PTU' : ((summary as any).target_deployment_type || 'Standard')}
                              </span>
                              {((summary as any).source_deployment_type !== (summary as any).target_deployment_type) && (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                                  ⚠ Cross-type migration
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Regression breakdown */}
                        <div className="px-4 pb-3">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600 font-medium">
                              {summary.no_regression_count} No Regression
                            </span>
                            <span className="text-amber-600 font-medium">
                              {summary.minor_regression_count} Minor
                            </span>
                            <span className="text-red-600 font-medium">
                              {summary.major_regression_count} Major
                            </span>
                          </div>
                          {summary.recommendation_reason && (
                            <p className="text-xs text-gray-500 mt-2 italic">{summary.recommendation_reason}</p>
                          )}
                        </div>

                        {/* Results table */}
                        {runDetail && runDetail.results.length > 0 && (
                          <div className="px-4 pb-4 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500 uppercase">
                                  <th className="pb-2 pr-2">#</th>
                                  <th className="pb-2 pr-2">Question</th>
                                  <th className="pb-2 pr-2">Similarity</th>
                                  <th className="pb-2 pr-2">Src Ref</th>
                                  <th className="pb-2 pr-2">Tgt Ref</th>
                                  <th className="pb-2 pr-2">Src ms</th>
                                  <th className="pb-2 pr-2">Tgt ms</th>
                                  <th className="pb-2">Regression</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runDetail.results.slice(0, 25).map((r) => (
                                  <tr key={r.id} className="border-t border-gray-100">
                                    <td className="py-1.5 pr-2 text-gray-400">{r.case_index + 1}</td>
                                    <td className="py-1.5 pr-2 max-w-[200px] truncate">{r.question}</td>
                                    <td className="py-1.5 pr-2">
                                      {r.similarity_score != null ? `${(r.similarity_score * 100).toFixed(0)}%` : '—'}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      {r.source_reference_score != null
                                        ? `${(r.source_reference_score * 100).toFixed(0)}%`
                                        : '—'}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      {r.target_reference_score != null
                                        ? `${(r.target_reference_score * 100).toFixed(0)}%`
                                        : '—'}
                                    </td>
                                    <td className="py-1.5 pr-2">{r.source_latency_ms?.toFixed(0) || '—'}</td>
                                    <td className="py-1.5 pr-2">{r.target_latency_ms?.toFixed(0) || '—'}</td>
                                    <td className="py-1.5">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          r.regression === 'none'
                                            ? 'bg-green-100 text-green-700'
                                            : r.regression === 'minor'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                      >
                                        {r.regression}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
      )}

      {/* ── TAB: Parameter Review ── */}
      {activeTab === 'diff' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Review Code Parameters</h3>
          <p className="text-sm text-gray-500 mb-4">
            Compare model capabilities and parameters to identify what needs updating before migration.
          </p>

          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 space-y-2">
              <ProviderSelect
                label="Source Provider"
                value={diffSrcProvider}
                onChange={setDiffSrcProvider}
              />
              <DeploymentSelect
                label="Source Model"
                value={diffSrc}
                onChange={setDiffSrc}
                placeholder="Select or type deployment…"
              />
            </div>
            <div className="text-lg font-bold text-gray-400 pb-2">→</div>
            <div className="flex-1 space-y-2">
              <ProviderSelect
                label="Target Provider"
                value={diffTgtProvider}
                onChange={setDiffTgtProvider}
              />
              <DeploymentSelect
                label="Target Model"
                value={diffTgt}
                onChange={setDiffTgt}
                placeholder="Select or type deployment…"
              />
            </div>
            <button
              onClick={() => diffMutation.mutate()}
              disabled={diffMutation.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              Compare
            </button>
          </div>

          {diffResult && (
            <div className="space-y-6">
              {/* Parameter differences */}
              {diffResult.parameter_differences.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Parameter Differences</h4>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Parameter</th>
                        <th className="text-left px-3 py-2">{diffResult.source_model}</th>
                        <th className="text-left px-3 py-2">{diffResult.target_model}</th>
                        <th className="text-left px-3 py-2">Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffResult.parameter_differences.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{d.parameter}</td>
                          <td className="px-3 py-2">{d.source_value}</td>
                          <td className="px-3 py-2">{d.target_value}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                d.impact === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : d.impact === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {d.impact}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Compatibility notes */}
              {diffResult.compatibility_notes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Compatibility Notes</h4>
                  <ul className="space-y-1">
                    {diffResult.compatibility_notes.map((note, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Migration checklist */}
              {diffResult.migration_checklist.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Migration Checklist</h4>
                  <ol className="space-y-1">
                    {diffResult.migration_checklist.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="bg-purple-100 text-purple-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = '',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
