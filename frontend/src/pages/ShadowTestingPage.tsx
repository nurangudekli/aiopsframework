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
import DeploymentSelect from '../components/DeploymentSelect';
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
  Cpu, GitBranch, Loader2, MessageSquare, Play, Settings2,
} from 'lucide-react';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

const WIZARD_STEPS = [
  { id: 1, title: 'Select Models', subtitle: 'Choose baseline and canary deployments', icon: Cpu },
  { id: 2, title: 'Configure Prompts', subtitle: 'Set the system message and test prompts', icon: MessageSquare },
  { id: 3, title: 'Run & Results', subtitle: 'Execute tests and compare outputs', icon: Play },
] as const;

export default function ShadowTestingPage() {
  const { useMock, toggleMock } = useMockToggle('shadow-testing');
  const [wizardStep, setWizardStep] = useState(1);
  const [testMode, setTestMode] = useState<'single' | 'batch'>('single');
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

  const step1Complete = !!baselineDeploy && !!canaryDeploy;
  const step2Complete = testMode === 'single' ? !!prompt.trim() : batchPrompts.split('\n').filter(Boolean).length > 0;
  const isRunning = testMut.isPending || batchMut.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch size={24} /> Shadow Testing & Canary Deployment
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Run prompts against baseline and candidate models, compare outputs, then gradually shift traffic.
          </p>
        </div>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>

      {/* ═══ Stepper ═══ */}
      <div className="flex items-center justify-between mb-6">
        {WIZARD_STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Complete : s.id === 2 ? step2Complete : !!(testMut.data || batchMut.data);
          const active = wizardStep === s.id;
          const Icon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setWizardStep(s.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-1 border-2 text-left
                  ${active ? 'border-emerald-500 bg-emerald-50 shadow-sm' : done ? 'border-green-200 bg-green-50 hover:border-green-300' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${active ? 'bg-emerald-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-emerald-600' : done ? 'text-green-600' : 'text-gray-400'}`}>Step {s.id}</span>
                    {done && <CheckCircle2 size={12} className="text-green-500" />}
                  </div>
                  <p className={`text-sm font-semibold truncate ${active ? 'text-gray-900' : 'text-gray-700'}`}>{s.title}</p>
                  <p className="text-[11px] text-gray-400 truncate hidden md:block">{s.subtitle}</p>
                </div>
              </button>
              {idx < WIZARD_STEPS.length - 1 && <ArrowRight size={20} className={`mx-2 flex-shrink-0 ${done ? 'text-green-400' : 'text-gray-300'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ═══ Step 1: Select Models ═══ */}
      {wizardStep === 1 && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Cpu size={18} className="text-emerald-600" /> Step 1: Select Models</h2>
          <p className="text-sm text-gray-500 mb-5">Choose the baseline (current production) and canary (candidate) deployments to compare.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Baseline (Current)</p>
              <DeploymentSelect
                label="Baseline Deployment *"
                value={baselineDeploy}
                onChange={setBaselineDeploy}
                placeholder="Select baseline deployment…"
              />
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3">Canary (Candidate)</p>
              <DeploymentSelect
                label="Canary Deployment *"
                value={canaryDeploy}
                onChange={setCanaryDeploy}
                placeholder="Select candidate deployment…"
              />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setWizardStep(2)} disabled={!step1Complete} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Prompts <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Configure Prompts ═══ */}
      {wizardStep === 2 && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><MessageSquare size={18} className="text-emerald-600" /> Step 2: Configure Prompts</h2>
          <p className="text-sm text-gray-500 mb-4">Set the system message and provide test prompts for both models.</p>

          {/* Summary of step 1 */}
          <div className="p-3 mb-4 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={14} /> <span className="font-medium">Baseline:</span> <span className="font-mono">{baselineDeploy}</span> <span className="mx-1">vs</span> <span className="font-medium">Canary:</span> <span className="font-mono">{canaryDeploy}</span>
            <button onClick={() => setWizardStep(1)} className="ml-auto text-emerald-500 hover:underline">Edit</button>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">System Message</label>
              <PromptLibraryPicker onSelect={(s) => setSystemMsg(s.system_message || s.content)} />
            </div>
            <input value={systemMsg} onChange={(e) => setSystemMsg(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          {/* Test mode toggle */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTestMode('single')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${testMode === 'single' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <MessageSquare size={14} /> Single Prompt
            </button>
            <button onClick={() => setTestMode('batch')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${testMode === 'batch' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Settings2 size={14} /> Batch Prompts
            </button>
          </div>

          {testMode === 'single' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">User Prompt *</label>
                <div className="flex items-center gap-1">
                  <PromptLibraryPicker label="From Library" onSelect={(s) => setPrompt(s.content)} />
                  <GoldenDatasetPicker label="From Dataset" onSelectCase={(c) => setPrompt(c.question)} />
                </div>
              </div>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Enter the prompt to test…" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">Prompts (one per line) *</label>
                <GoldenDatasetPicker onLoadQuestions={(qs) => setBatchPrompts(qs.join('\n'))} />
              </div>
              <textarea value={batchPrompts} onChange={(e) => setBatchPrompts(e.target.value)} rows={5} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              <p className="text-[11px] text-gray-400 mt-1">{batchPrompts.split('\n').filter(Boolean).length} prompt(s)</p>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Models</button>
            <button onClick={() => setWizardStep(3)} disabled={!step2Complete} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Run <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Run & Results ═══ */}
      {wizardStep === 3 && (
        <div className="space-y-6 mb-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Play size={18} className="text-emerald-600" /> Step 3: Run & Compare</h2>
            <p className="text-sm text-gray-500 mb-5">Review your configuration, then execute the shadow test.</p>

            {/* Config summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Baseline</p>
                <p className="font-mono text-sm truncate">{baselineDeploy}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                <p className="text-xs font-bold text-purple-600 uppercase mb-1">Canary</p>
                <p className="font-mono text-sm truncate">{canaryDeploy}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mode</p>
                <p className="font-semibold capitalize">{testMode}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Prompts</p>
                <p className="text-lg font-bold">{testMode === 'single' ? 1 : batchPrompts.split('\n').filter(Boolean).length}</p>
              </div>
            </div>

            {testError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{testError}</p>
              </div>
            )}
            {batchError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{batchError}</p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setWizardStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Prompts</button>
              <button
                onClick={() => { testMode === 'single' ? testMut.mutate() : batchMut.mutate(); }}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm"
              >
                {isRunning ? <><Loader2 size={16} className="animate-spin" /> Running…</> : <><Play size={16} /> Run {testMode === 'single' ? 'Shadow Test' : 'Batch Test'}</>}
              </button>
            </div>
          </div>

          {/* Single test results */}
          {testMut.data && (() => {
            const d = testMut.data;
            const bTokens = (d.baseline.tokens_prompt ?? 0) + (d.baseline.tokens_completion ?? 0);
            const cTokens = (d.canary.tokens_prompt ?? 0) + (d.canary.tokens_completion ?? 0);
            const simScore = d.similarity?.semantic_similarity ?? d.similarity?.jaccard ?? 0;
            const latDiff = (d.canary.latency_ms ?? 0) - (d.baseline.latency_ms ?? 0);
            const tokDiff = cTokens - bTokens;
            return (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-sm font-semibold mb-4">Shadow Test Results</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium text-blue-600 mb-1">Baseline ({d.baseline.deployment || 'N/A'})</div>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">{d.baseline.response ?? d.baseline.error}</div>
                    <div className="text-xs text-gray-500 mt-1">{d.baseline.latency_ms}ms • {bTokens} tokens</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-purple-600 mb-1">Canary ({d.canary.deployment || 'N/A'})</div>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">{d.canary.response ?? d.canary.error}</div>
                    <div className="text-xs text-gray-500 mt-1">{d.canary.latency_ms}ms • {cTokens} tokens</div>
                  </div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-emerald-800">Similarity Score: {(simScore * 100).toFixed(1)}%</div>
                  <div className="text-xs text-emerald-600 mt-1">Latency diff: {latDiff}ms • Token diff: {tokDiff}</div>
                </div>
              </div>
            );
          })()}

          {/* Batch test results */}
          {batchMut.data && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-4">Batch Test Results</h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
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
                  <details key={i} className="group bg-gray-50 rounded-lg mb-2">
                    <summary className="cursor-pointer p-3 text-sm font-medium text-gray-800 hover:text-emerald-600">
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
      )}

      {/* ═══ Traffic Configuration (always visible below wizard) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Config */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings2 size={18} className="text-gray-600" /> Traffic Configuration</h2>
          {config && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Canary Enabled</label>
                <button
                  onClick={() => updateMut.mutate({ enabled: !config.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Canary Traffic %</label>
                <input
                  type="range" min={0} max={100} step={5}
                  value={canaryPct ?? config.canary_percentage}
                  onChange={(e) => setCanaryPct(Number(e.target.value))}
                  onMouseUp={() => canaryPct !== null && updateMut.mutate({ canary_percentage: canaryPct })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0% (All Baseline)</span>
                  <span className="font-bold text-emerald-600">{canaryPct ?? config.canary_percentage}%</span>
                  <span>100% (All Candidate)</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-3">
                <DeploymentSelect label="Baseline Deployment" value={config.baseline_deployment || ''} onChange={(v) => updateMut.mutate({ baseline_deployment: v })} placeholder="Select baseline deployment…" size="sm" />
                <DeploymentSelect label="Canary Deployment" value={config.canary_deployment || ''} onChange={(v) => updateMut.mutate({ canary_deployment: v })} placeholder="Select candidate deployment…" size="sm" />
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
  );
}
