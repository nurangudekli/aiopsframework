import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getMigrationGuide,
  checkQualityGates,
  compareScores,
} from '../api/client';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockMigrationGuide, mockQualityGateResult, mockCompareResult } from '../mocks';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';
import EvalRunPicker from '../components/EvalRunPicker';

type Tab = 'overview' | 'checklist' | 'parameters' | 'examples' | 'faq' | 'quality';

export default function MigrationGuidePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { useMock, toggleMock } = useMockToggle('migration-guide');

  // Deployment selection
  const [baselineDeploy, setBaselineDeploy] = useState('');
  const [targetDeploy, setTargetDeploy] = useState('');

  const { data: liveGuide, isLoading } = useQuery({
    queryKey: ['migration-guide', baselineDeploy, targetDeploy],
    queryFn: () => getMigrationGuide(baselineDeploy || undefined, targetDeploy || undefined),
    enabled: !useMock,
  });
  const guide = useMock ? mockMigrationGuide : liveGuide;

  // Quality gates state
  const [baselineScores, setBaselineScores] = useState('{"coherence":4.2,"fluency":4.3,"relevance":4.1,"groundedness":3.8,"similarity":3.9}');
  const [candidateScores, setCandidateScores] = useState('{"coherence":4.1,"fluency":4.2,"relevance":4.0,"groundedness":3.7,"similarity":3.7}');
  const qualityMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockQualityGateResult);
      return checkQualityGates(JSON.parse(candidateScores), JSON.parse(baselineScores));
    },
  });
  const compareMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockCompareResult);
      return compareScores(JSON.parse(baselineScores), JSON.parse(candidateScores));
    },
  });

  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const toggleCheck = (id: string) => setChecklistState((prev) => ({ ...prev, [id]: !prev[id] }));
  const [deploymentTypeFilter, setDeploymentTypeFilter] = useState<'all' | 'Standard' | 'PTU'>('all');
  const [costTab, setCostTab] = useState<'standard' | 'ptu'>('standard');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview & Timeline' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'parameters', label: 'API Changes' },
    { id: 'examples', label: 'Code Examples' },
    { id: 'faq', label: 'FAQ' },
    { id: 'quality', label: 'Quality Gates' },
  ];

  if (isLoading && !useMock) return <div className="text-center py-12 text-gray-500">Loading migration guide…</div>;
  if (!guide) return <div className="text-center py-12 text-red-500">Failed to load migration guide.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Migration Guide</h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 mb-4">
        Select your baseline and target deployments to get a tailored migration guide with model-specific parameter changes, checklist, and code examples.
      </p>

      {/* Deployment selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <DeploymentSelect
          value={baselineDeploy}
          onChange={setBaselineDeploy}
          label="Baseline Deployment (current model)"
          placeholder="Select baseline deployment…"
          size="sm"
        />
        <DeploymentSelect
          value={targetDeploy}
          onChange={setTargetDeploy}
          label="Target Deployment (migrating to)"
          placeholder="Select target deployment…"
          size="sm"
        />
      </div>

      {/* Model family badge */}
      {guide?.baseline_family_display && guide?.target_family_display && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
            Baseline: {guide.baseline_family_display}
          </span>
          <span className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">
            Target: {guide.target_family_display}
          </span>
        </div>
      )}

      <PageBanner
        title="How to use the Migration Guide"
        description="Select your baseline and target deployments above, and the guide dynamically adapts — parameter changes, checklist items, and code examples are tailored to your specific migration path."
        accentColor="teal"
        steps={[
          { label: 'Select Deployments', detail: 'Pick your baseline (current) and target (new) deployments above to get model-specific guidance.' },
          { label: 'Review Overview & Timeline', detail: 'Key dates, phased rollout plan, and the recommended migration stages customised for your models.' },
          { label: 'Work through the Checklist', detail: 'An interactive, model-aware checklist — only shows items relevant to your migration path.' },
          { label: 'Review API Changes & Code Examples', detail: 'Parameter changes and before/after code samples generated for your specific baseline → target migration.' },
          { label: 'Run Quality Gates', detail: 'Paste baseline and candidate JSON scores, then click Check or Compare to validate readiness.' },
        ]}
        tips={[
          'When no deployments are selected, the guide shows a generic migration reference.',
          'The checklist and parameter changes automatically adapt when you change baseline or target.',
          'Quality Gates enforce minimum thresholds (e.g. coherence ≥ 3.5) before you go to production.',
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview & Timeline ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Dates */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">🗓️ Key Dates</h2>
            <div className="space-y-3">
              {guide.key_dates.map((d: any, i: number) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-lg ${d.impact === 'CRITICAL' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                  <div className="w-28 font-mono text-sm font-bold">{d.date}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{d.event}</div>
                    <div className="text-xs text-gray-500">{d.deployment_type}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${d.impact === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {d.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5 Phases */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">📋 5-Phase Migration Process</h2>
            <div className="space-y-4">
              {guide.phases.map((p: any) => (
                <div key={p.phase} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full text-sm font-bold">
                      {p.phase}
                    </span>
                    <h3 className="font-semibold">{p.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{p.description}</p>
                  <ul className="space-y-1">
                    {p.tasks.map((t: string, j: number) => (
                      <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="mt-1 text-gray-400">•</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Rollout Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">🚀 Recommended Rollout Timeline</h2>
            <div className="space-y-2">
              {guide.rollout_timeline.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-20 text-sm font-bold text-gray-700">{r.week}</div>
                  <div className="flex-1 text-sm">{r.activity}</div>
                  <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded">{r.phase}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">💰 Cost Comparison</h2>

            {/* Standard vs PTU toggle */}
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
              <button onClick={() => setCostTab('standard')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${costTab === 'standard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>
                Standard (Pay-as-you-go)
              </button>
              <button onClick={() => setCostTab('ptu')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${costTab === 'ptu' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600'}`}>
                PTU (Provisioned Throughput)
              </button>
            </div>

            {costTab === 'standard' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <strong>Standard deployments</strong> are billed per token processed. Best for variable workloads, development, and testing.
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Token Type</th>
                      <th className="text-right py-2">Baseline (per 1M)</th>
                      <th className="text-right py-2">Candidate (per 1M)</th>
                      <th className="text-right py-2">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.cost_comparison.map((c: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-medium">{c.token_type}</td>
                        <td className="py-2 text-right">{c.baseline_per_1m != null ? `$${c.baseline_per_1m.toFixed(2)}` : '—'}</td>
                        <td className="py-2 text-right">{c.candidate_per_1m != null ? `$${c.candidate_per_1m.toFixed(2)}` : '—'}</td>
                        <td className={`py-2 text-right font-medium ${c.change.startsWith('-') ? 'text-green-600' : c.change === '0%' ? '' : 'text-yellow-600'}`}>
                          {c.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {costTab === 'ptu' && guide.ptu_cost_comparison && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-sm text-purple-800">
                  <strong>PTU (Provisioned Throughput Unit)</strong> deployments are billed hourly per unit regardless of usage. Best for production workloads with predictable traffic that need guaranteed throughput and latency.
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Model</th>
                      <th className="text-right py-2">$/PTU/hour</th>
                      <th className="text-right py-2">Min PTUs</th>
                      <th className="text-right py-2">Min Monthly Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.ptu_cost_comparison.map((p: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-medium">{p.model}</td>
                        <td className="py-2 text-right">${p.ptu_per_hour.toFixed(2)}</td>
                        <td className="py-2 text-right">{p.min_ptus}</td>
                        <td className="py-2 text-right font-medium">${p.monthly_min.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Key PTU considerations:</strong>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>PTU capacity must be provisioned before migration — check quota availability in your region</li>
                    <li>Old PTU reservations continue billing until explicitly deleted</li>
                    <li>Candidate model reasoning tokens count towards PTU throughput budget</li>
                    <li>Run load tests to validate PTU capacity meets your throughput requirements</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Checklist ── */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {/* Deployment Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Show items for:</span>
            {(['all', 'Standard', 'PTU'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setDeploymentTypeFilter(opt)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  deploymentTypeFilter === opt
                    ? opt === 'PTU'
                      ? 'bg-purple-600 text-white'
                      : opt === 'Standard'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt === 'all' ? 'All' : opt}
              </button>
            ))}
          </div>

          {['Discovery', 'Code Updates', 'Testing', 'Production Rollout', 'Post-Migration'].map((phase) => {
            const items = guide.checklist
              .filter((c: any) => c.phase === phase)
              .filter((c: any) => {
                if (deploymentTypeFilter === 'all') return true;
                if (!c.deployment_type) return true;  // generic items always shown
                return c.deployment_type === deploymentTypeFilter;
              });
            if (!items.length) return null;
            const checked = items.filter((c: any) => checklistState[c.id]).length;
            return (
              <div key={phase} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{phase}</h2>
                  <span className="text-sm text-gray-500">{checked}/{items.length} completed</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${items.length > 0 ? (checked / items.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {items.map((c: any) => (
                    <label key={c.id} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${checklistState[c.id] ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={!!checklistState[c.id]}
                        onChange={() => toggleCheck(c.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${checklistState[c.id] ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {c.item}
                        </div>
                        <div className="text-xs text-gray-500">{c.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.deployment_type && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            c.deployment_type === 'PTU' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {c.deployment_type}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          c.priority === 'HIGH' ? 'bg-red-50 text-red-600' :
                          c.priority === 'MEDIUM' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── API Changes / Parameters ── */}
      {activeTab === 'parameters' && (
        <div className="space-y-6">
          {/* Parameter Changes Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Parameter Changes Reference</h2>
            {guide.baseline_deployment && guide.target_deployment && (
              <p className="text-sm text-gray-500 mb-3">
                Changes required when migrating from <strong>{guide.baseline_deployment}</strong> to <strong>{guide.target_deployment}</strong>
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3">Parameter</th>
                    <th className="text-left py-2 px-3">{guide.baseline_deployment || 'Baseline'}</th>
                    <th className="text-left py-2 px-3">{guide.target_deployment || 'Candidate'}</th>
                    <th className="text-left py-2 px-3">Action</th>
                    <th className="text-left py-2 px-3">Impact</th>
                    <th className="text-left py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.parameter_changes.map((p: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 px-3 font-mono text-xs">{p.parameter}</td>
                      <td className="py-2 px-3 text-xs">{p.baseline}</td>
                      <td className="py-2 px-3 text-xs font-medium">{p.candidate}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          p.action === 'Remove' ? 'bg-red-50 text-red-600' :
                          p.action === 'Rename' ? 'bg-orange-50 text-orange-600' :
                          p.action === 'Add' ? 'bg-green-50 text-green-600' :
                          p.action === 'Keep' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>{p.action}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-medium ${p.impact === 'HIGH' ? 'text-red-600' : p.impact === 'MEDIUM' ? 'text-yellow-600' : 'text-blue-600'}`}>
                          {p.impact}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reasoning Effort Guide — only shown when target supports it */}
          {guide.reasoning_effort_guide?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">reasoning_effort Guide</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3">Value</th>
                    <th className="text-left py-2 px-3">Behavior</th>
                    <th className="text-left py-2 px-3">Best For</th>
                    <th className="text-left py-2 px-3">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.reasoning_effort_guide.map((r: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 px-3 font-mono text-sm font-bold text-indigo-600">"{r.value}"</td>
                      <td className="py-2 px-3 text-sm">{r.behavior}</td>
                      <td className="py-2 px-3 text-sm">{r.best_for}</td>
                      <td className="py-2 px-3 text-sm text-gray-500">{r.latency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Error Messages */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Common Error Messages</h2>
            <div className="space-y-3">
              {guide.error_messages.map((e: any, i: number) => (
                <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="font-mono text-xs text-red-700 mb-1">{e.error}</div>
                  <div className="text-sm"><strong>Cause:</strong> {e.cause}</div>
                  <div className="text-sm text-green-700"><strong>Fix:</strong> {e.fix}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Code Examples ── */}
      {activeTab === 'examples' && (
        <div className="space-y-6">
          {guide.code_examples.map((ex: any) => (
            <div key={ex.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-1">{ex.title}</h2>
              <p className="text-sm text-gray-600 mb-4">{ex.description}</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Before */}
                <div>
                  <div className="text-xs font-medium text-red-600 mb-1">❌ {ex.before.label}</div>
                  <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {ex.before.code}
                  </pre>
                </div>
                {/* After */}
                <div>
                  <div className="text-xs font-medium text-green-600 mb-1">✅ {ex.after.label}</div>
                  <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {ex.after.code}
                  </pre>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Changes:</div>
                <div className="flex flex-wrap gap-1">
                  {ex.changes.map((c: string, j: number) => (
                    <span key={j} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FAQ ── */}
      {activeTab === 'faq' && (
        <div className="space-y-6">
          {['General', 'Code Changes', 'Quality & Testing', 'Cost & Performance', 'Deployment', 'Language & Regional'].map((cat) => {
            const items = guide.faq.filter((f: any) => f.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">{cat}</h2>
                <div className="space-y-4">
                  {items.map((f: any, i: number) => (
                    <details key={i} className="group">
                      <summary className="cursor-pointer text-sm font-medium text-gray-900 hover:text-indigo-600">
                        {f.question}
                      </summary>
                      <p className="mt-2 text-sm text-gray-600 pl-4 border-l-2 border-indigo-200">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quality Gates ── */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Quality Gate Evaluation</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter metric scores (1-5 scale) from baseline and candidate models to check against quality gates.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Baseline Scores (JSON)</label>
                  <EvalRunPicker label="From Eval Run" onLoadScores={(s) => setBaselineScores(s)} />
                </div>
                <textarea
                  value={baselineScores}
                  onChange={(e) => setBaselineScores(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Candidate Scores (JSON)</label>
                  <EvalRunPicker label="From Eval Run" onLoadScores={(s) => setCandidateScores(s)} />
                </div>
                <textarea
                  value={candidateScores}
                  onChange={(e) => setCandidateScores(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => qualityMut.mutate()}
                disabled={qualityMut.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {qualityMut.isPending ? 'Checking…' : 'Check Quality Gates'}
              </button>
              <button
                onClick={() => compareMut.mutate()}
                disabled={compareMut.isPending}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                {compareMut.isPending ? 'Comparing…' : 'Compare Scores'}
              </button>
            </div>

            {qualityMut.isError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {qualityMut.error instanceof Error ? qualityMut.error.message : 'Failed to check quality gates'}
              </div>
            )}
            {compareMut.isError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {compareMut.error instanceof Error ? compareMut.error.message : 'Failed to compare scores'}
              </div>
            )}
          </div>

          {/* Quality Gates Result */}
          {qualityMut.data && (
            <div className={`rounded-xl border p-6 ${qualityMut.data.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="text-lg font-semibold mb-3">
                {qualityMut.data.passed ? '✅ Quality Gates PASSED' : '❌ Quality Gates FAILED'}
              </h3>
              <p className="text-sm font-medium mb-4">Recommendation: {qualityMut.data.recommendation}</p>
              <div className="space-y-2">
                {qualityMut.data.metrics.map((m: any) => (
                  <div key={m.metric} className={`p-3 rounded-lg ${m.passed ? 'bg-white' : 'bg-red-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.metric}</span>
                      <span className={`text-sm font-bold ${m.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {m.score} {m.passed ? '✅' : '❌'}
                      </span>
                    </div>
                    {m.checks.map((c: any, j: number) => (
                      <div key={j} className="text-xs text-gray-500 mt-1">
                        {c.check}: {c.actual} (threshold: {c.threshold}) {c.passed ? '✓' : '✗'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Result */}
          {compareMut.data && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-3">Score Comparison</h3>
              <p className={`text-sm font-medium mb-4 ${compareMut.data.has_regressions ? 'text-red-600' : 'text-green-600'}`}>
                {compareMut.data.recommendation}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3">Metric</th>
                    <th className="text-right py-2 px-3">Baseline</th>
                    <th className="text-right py-2 px-3">Candidate</th>
                    <th className="text-right py-2 px-3">Diff</th>
                    <th className="text-right py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {compareMut.data.comparisons.map((c: any) => (
                    <tr key={c.metric} className="border-b">
                      <td className="py-2 px-3 font-medium">{c.metric}</td>
                      <td className="py-2 px-3 text-right">{c.baseline}</td>
                      <td className="py-2 px-3 text-right">{c.candidate}</td>
                      <td className={`py-2 px-3 text-right ${c.difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {c.difference > 0 ? '+' : ''}{c.difference} ({c.difference_pct > 0 ? '+' : ''}{c.difference_pct}%)
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          c.status === 'regression' ? 'bg-red-50 text-red-600' :
                          c.status === 'improved' ? 'bg-green-50 text-green-600' :
                          'bg-gray-50 text-gray-600'
                        }`}>{c.status}</span>
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
}
