import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getShadowTestConfig,
  updateShadowTestConfig,
  runShadowTest,
  runShadowTestBatch,
  getCanaryStages,
} from '../api/client';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import {
  mockShadowTestResult,
  mockShadowBatchResult,
  mockShadowConfig,
  mockCanaryStages,
} from '../mocks';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';
import { AlertCircle } from 'lucide-react';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

export default function ShadowTestingPage() {
  const { useMock, toggleMock } = useMockToggle('shadow-testing');
  const [prompt, setPrompt] = useState('What are my charges for this month?');
  const [systemMsg, setSystemMsg] = useState('You are a helpful customer service assistant.');
  const [batchPrompts, setBatchPrompts] = useState('What are my charges?\nHow do I upgrade my plan?\nI need help with roaming.\nI dont know the difference between the standard deployment and ptu deployment');
  const [testError, setTestError] = useState('');
  const [batchError, setBatchError] = useState('');

  // Deployment selections for test forms (separate from traffic config)
  const [baselineDeploy, setBaselineDeploy] = useState('');
  const [canaryDeploy, setCanaryDeploy] = useState('');

  const { data: liveConfig, refetch: refetchConfig } = useQuery({ queryKey: ['shadow-config'], queryFn: getShadowTestConfig, enabled: !useMock });
  const { data: liveStages } = useQuery({ queryKey: ['canary-stages'], queryFn: getCanaryStages, enabled: !useMock });
  const config = useMock ? mockShadowConfig : liveConfig;
  const stages = useMock ? mockCanaryStages : liveStages;

  const [canaryPct, setCanaryPct] = useState<number | null>(null);
  React.useEffect(() => { if (config) setCanaryPct(config.canary_percentage); }, [config]);

  // Sync deployment selections from config when loaded
  React.useEffect(() => {
    if (config) {
      if (!baselineDeploy && config.baseline_deployment) setBaselineDeploy(config.baseline_deployment);
      if (!canaryDeploy && config.canary_deployment) setCanaryDeploy(config.canary_deployment);
    }
  }, [config]);

  const testMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockShadowTestResult);
      if (!baselineDeploy || !canaryDeploy) {
        return Promise.reject(new Error('Please select both baseline and canary deployments.'));
      }
      const messages = [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt },
      ];
      return runShadowTest({
        messages,
        baseline_deployment: baselineDeploy,
        canary_deployment: canaryDeploy,
      });
    },
    onSuccess: () => setTestError(''),
    onError: (e: Error) => setTestError(e.message),
  });

  const batchMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockShadowBatchResult);
      if (!baselineDeploy || !canaryDeploy) {
        return Promise.reject(new Error('Please select both baseline and canary deployments.'));
      }
      const prompts = batchPrompts.split('\n').filter((l) => l.trim());
      const test_cases = prompts.map((q) => ({ query: q }));
      return runShadowTestBatch({
        test_cases,
        baseline_deployment: baselineDeploy,
        canary_deployment: canaryDeploy,
        system_message: systemMsg,
      });
    },
    onSuccess: () => setBatchError(''),
    onError: (e: Error) => setBatchError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (newConfig: any) => {
      if (useMock) return Promise.resolve({ ...mockShadowConfig, ...newConfig });
      return updateShadowTestConfig(newConfig);
    },
    onSuccess: () => { if (!useMock) refetchConfig(); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Shadow Testing & Canary Deployment</h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 mb-6">
        Run prompts against baseline and candidate models, compare outputs, then gradually shift traffic.
      </p>

      <PageBanner
        title="How to use Shadow Testing & Canary"
        description="Send the same prompt to your current model and a new candidate simultaneously, compare results, then safely shift production traffic with canary stages."
        accentColor="emerald"
        steps={[
          { label: 'Run a single shadow test', detail: 'Enter a system message and prompt in the left panel. Click Test to see baseline vs candidate responses side by side with latency and similarity.' },
          { label: 'Run a batch test', detail: 'Enter multiple prompts (one per line) and click Run Batch. You get average similarity and per-test expandable results.' },
          { label: 'Configure canary traffic', detail: 'In the right panel, toggle canary mode ON and set a traffic percentage with the slider. Click Save to apply.' },
          { label: 'Follow the canary stages', detail: 'The stages panel shows the recommended progression (5% → 25% → 50% → 75% → 100%) with success criteria for each.' },
        ]}
        tips={[
          'Start canary at 5% and monitor for regressions before advancing to the next stage.',
          'Similarity ≥ 85% is a good threshold for considering responses \"equivalent\".',
          'Batch tests are useful for regression testing across a suite of representative prompts.',
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Shadow Test */}
        <div className="lg:col-span-2 space-y-6">
          {/* Single Test */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Shadow Test (Single)</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DeploymentSelect
                  label="Baseline Deployment"
                  value={baselineDeploy}
                  onChange={setBaselineDeploy}
                  placeholder="Select baseline…"
                  size="sm"
                />
                <DeploymentSelect
                  label="Canary Deployment"
                  value={canaryDeploy}
                  onChange={setCanaryDeploy}
                  placeholder="Select candidate…"
                  size="sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">System Message</label>
                  <PromptLibraryPicker onSelect={(s) => { setSystemMsg(s.system_message || s.content); }} />
                </div>
                <input
                  value={systemMsg}
                  onChange={(e) => setSystemMsg(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">User Prompt</label>
                  <div className="flex items-center gap-1">
                    <PromptLibraryPicker label="Prompt from Library" onSelect={(s) => setPrompt(s.content)} />
                    <GoldenDatasetPicker label="From Dataset" onSelectCase={(c) => setPrompt(c.question)} />
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <button
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending || !prompt.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {testMut.isPending ? 'Running…' : 'Run Shadow Test'}
              </button>
              {testError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={14} /> {testError}
                </div>
              )}
            </div>

            {testMut.data && (() => {
              const d = testMut.data;
              const bTokens = (d.baseline.tokens_prompt ?? 0) + (d.baseline.tokens_completion ?? 0);
              const cTokens = (d.canary.tokens_prompt ?? 0) + (d.canary.tokens_completion ?? 0);
              const simScore = d.similarity?.semantic_similarity ?? d.similarity?.jaccard ?? 0;
              const latDiff = (d.canary.latency_ms ?? 0) - (d.baseline.latency_ms ?? 0);
              const tokDiff = cTokens - bTokens;
              return (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-red-600 mb-1">Baseline ({d.baseline.deployment || 'N/A'})</div>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">{d.baseline.response ?? d.baseline.error}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.baseline.latency_ms}ms • {bTokens} tokens
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-600 mb-1">Canary ({d.canary.deployment || 'N/A'})</div>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">{d.canary.response ?? d.canary.error}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.canary.latency_ms}ms • {cTokens} tokens
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-800">Similarity Score: {(simScore * 100).toFixed(1)}%</div>
                  <div className="text-xs text-blue-600 mt-1">
                    Latency diff: {latDiff}ms •
                    Token diff: {tokDiff}
                  </div>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Batch Test */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Batch Shadow Test</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Prompts (one per line)</label>
                  <GoldenDatasetPicker onLoadQuestions={(qs) => setBatchPrompts(qs.join('\n'))} />
                </div>
                <textarea
                  value={batchPrompts}
                  onChange={(e) => setBatchPrompts(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>
              <button
                onClick={() => batchMut.mutate()}
                disabled={batchMut.isPending || !batchPrompts.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {batchMut.isPending ? 'Running…' : 'Run Batch Test'}
              </button>
              {batchError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={14} /> {batchError}
                </div>
              )}
            </div>

            {batchMut.data && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-purple-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Tests</div>
                    <div className="text-lg font-bold">{batchMut.data.summary.total_tests}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Avg Similarity</div>
                    <div className="text-lg font-bold">{batchMut.data.summary.avg_similarity != null ? (batchMut.data.summary.avg_similarity * 100).toFixed(1) + '%' : 'N/A'}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Avg Baseline Latency</div>
                    <div className="text-lg font-bold">{batchMut.data.summary.baseline_avg_latency_ms ?? 'N/A'}ms</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">Avg Canary Latency</div>
                    <div className="text-lg font-bold">{batchMut.data.summary.canary_avg_latency_ms ?? 'N/A'}ms</div>
                  </div>
                </div>

                {batchMut.data.results.map((r: any, i: number) => {
                  const sim = r.similarity?.semantic_similarity ?? r.similarity?.jaccard ?? 0;
                  return (
                  <details key={i} className="group bg-gray-50 rounded-lg">
                    <summary className="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:text-indigo-600">
                      Test {i + 1}: "{(r.query || '').substring(0, 60)}…" — Similarity: {(sim * 100).toFixed(1)}%
                    </summary>
                    <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                      <div className="text-sm"><strong>Baseline:</strong> {r.baseline?.response?.substring(0, 200)}…</div>
                      <div className="text-sm"><strong>Canary:</strong> {r.canary?.response?.substring(0, 200)}…</div>
                    </div>
                  </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Traffic Config */}
        <div className="space-y-6">
          {/* Config */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Traffic Configuration</h2>
            {config && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Canary Enabled</label>
                  <button
                    onClick={() => updateMut.mutate({ enabled: !config.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Canary Traffic %</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={canaryPct ?? config.canary_percentage}
                    onChange={(e) => setCanaryPct(Number(e.target.value))}
                    onMouseUp={() => canaryPct !== null && updateMut.mutate({ canary_percentage: canaryPct })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0% (All Baseline)</span>
                    <span className="font-bold text-indigo-600">{canaryPct ?? config.canary_percentage}%</span>
                    <span>100% (All Candidate)</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-3">
                  <DeploymentSelect
                    label="Baseline Deployment"
                    value={config.baseline_deployment || ''}
                    onChange={(v) => updateMut.mutate({ baseline_deployment: v })}
                    placeholder="Select baseline deployment…"
                    size="sm"
                  />
                  <DeploymentSelect
                    label="Canary Deployment"
                    value={config.canary_deployment || ''}
                    onChange={(v) => updateMut.mutate({ canary_deployment: v })}
                    placeholder="Select candidate deployment…"
                    size="sm"
                  />
                  {(config as any).baseline_deployment_type !== (config as any).canary_deployment_type &&
                    (config as any).baseline_deployment_type && (config as any).canary_deployment_type && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 text-amber-700">
                      ⚠ Cross-type canary: comparing {(config as any).baseline_deployment_type} baseline with {(config as any).canary_deployment_type} canary. Latency and cost metrics may not be directly comparable.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Canary Stages */}
          {stages && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Canary Stages</h2>
              <div className="space-y-3">
                {stages.map((s: any, i: number) => {
                  const active = config && config.canary_percentage >= s.percentage;
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{s.name || `Stage ${s.stage}`}</span>
                        <span className={`text-xs font-bold ${active ? 'text-green-600' : 'text-gray-400'}`}>{s.percentage}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{s.description}</p>
                      <div className="text-xs text-gray-500">Duration: {s.duration}</div>
                      {s.success_criteria && <div className="text-xs text-gray-500 mt-1"><span className="font-medium">Criteria:</span> {s.success_criteria}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
