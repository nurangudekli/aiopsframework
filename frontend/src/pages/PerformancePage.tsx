import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runPerformanceTest } from '../api/client';
import type { PerformanceTestResult } from '../types';
import {
  Gauge, CheckCircle2, ArrowRight, ChevronRight, ChevronLeft,
  Cpu, Settings2, Play, Loader2, AlertCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockPerformanceResult } from '../mocks';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

const WIZARD_STEPS = [
  { id: 1, title: 'Select Model', subtitle: 'Choose the provider and deployment to test', icon: Cpu },
  { id: 2, title: 'Load Parameters', subtitle: 'Configure concurrency, prompts, and limits', icon: Settings2 },
  { id: 3, title: 'Run & Results', subtitle: 'Execute the test and review metrics', icon: Play },
] as const;

export default function PerformancePage() {
  const { useMock, toggleMock } = useMockToggle('performance');
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState({
    model_provider: 'azure_openai',
    model_deployment: '',
    system_message: '',
    questions: '',
    concurrency: 5,
    total_requests: 20,
    timeout_seconds: 30,
  });
  const [result, setResult] = useState<PerformanceTestResult | null>(null);
  const [error, setError] = useState('');

  const perfMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockPerformanceResult);
      return runPerformanceTest({
        ...form,
        questions: form.questions.split('\n').filter(Boolean),
      });
    },
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const latencyBars = result
    ? [
        { label: 'Min', value: result.min_latency_ms },
        { label: 'P50', value: result.p50_latency_ms },
        { label: 'Avg', value: result.avg_latency_ms },
        { label: 'P90', value: result.p90_latency_ms },
        { label: 'P99', value: result.p99_latency_ms },
        { label: 'Max', value: result.max_latency_ms },
      ]
    : [];

  const step1Complete = !!form.model_deployment;
  const step2Complete = form.questions.split('\n').filter(Boolean).length > 0;
  const isRunning = perfMut.isPending;

  const handleRun = () => {
    const errors: string[] = [];
    if (!form.model_deployment) errors.push('Model deployment is required.');
    if (!form.questions.trim()) errors.push('At least one question is required.');
    if (errors.length > 0) { setError(errors.join(' ')); return; }
    setError('');
    perfMut.mutate();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge size={24} /> Performance & Stress Testing
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Load test your model endpoints. Measure latency percentiles, throughput, and error rates.
          </p>
        </div>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>

      {/* ═══ Stepper ═══ */}
      <div className="flex items-center justify-between mb-6">
        {WIZARD_STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Complete : s.id === 2 ? step2Complete : !!result;
          const active = wizardStep === s.id;
          const Icon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setWizardStep(s.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-1 border-2 text-left
                  ${active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : done ? 'border-green-200 bg-green-50 hover:border-green-300' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-indigo-600' : done ? 'text-green-600' : 'text-gray-400'}`}>Step {s.id}</span>
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

      {/* ═══ Step 1: Select Model ═══ */}
      {wizardStep === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Cpu size={18} className="text-indigo-600" /> Step 1: Select Model</h2>
          <p className="text-sm text-gray-500 mb-5">Choose the provider and deployment you want to stress-test.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderSelect
              label="Provider"
              value={form.model_provider}
              onChange={(v) => setForm({ ...form, model_provider: v })}
            />
            <DeploymentSelect
              label="Deployment *"
              value={form.model_deployment}
              onChange={(v) => setForm({ ...form, model_deployment: v })}
              placeholder="Select or type deployment…"
            />
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setWizardStep(2)} disabled={!step1Complete} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Load Parameters <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Load Parameters ═══ */}
      {wizardStep === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Settings2 size={18} className="text-indigo-600" /> Step 2: Load Parameters</h2>
          <p className="text-sm text-gray-500 mb-4">Configure concurrency, request count, timeout, and the prompts for the test.</p>

          {/* Summary of step 1 */}
          <div className="p-3 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={14} /> <span className="font-medium">{form.model_provider}</span> → <span className="font-mono">{form.model_deployment}</span>
            <button onClick={() => setWizardStep(1)} className="ml-auto text-indigo-500 hover:underline">Edit</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Concurrency</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.concurrency} onChange={(e) => setForm({ ...form, concurrency: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Requests</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.total_requests} onChange={(e) => setForm({ ...form, total_requests: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timeout (s)</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: +e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">System Message (optional)</label>
              <PromptLibraryPicker onSelect={(s) => setForm({ ...form, system_message: s.system_message || s.content })} />
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="You are a helpful assistant..." value={form.system_message} onChange={(e) => setForm({ ...form, system_message: e.target.value })} />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Questions (one per line) *</label>
              <GoldenDatasetPicker onLoadQuestions={(qs) => setForm({ ...form, questions: qs.join('\n') })} />
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder={"What is cloud computing?\nExplain Kubernetes.\nHow does CI/CD work?"} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">{form.questions.split('\n').filter(Boolean).length} question(s)</p>
          </div>
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Model</button>
            <button onClick={() => setWizardStep(3)} disabled={!step2Complete} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Run <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Run & Results ═══ */}
      {wizardStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Play size={18} className="text-indigo-600" /> Step 3: Run & Analyze</h2>
            <p className="text-sm text-gray-500 mb-5">Review your configuration and execute the performance test.</p>

            {/* Config summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Model</p>
                <p className="font-mono text-sm truncate">{form.model_deployment}</p>
                <p className="text-xs text-gray-500">{form.model_provider}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Concurrency</p>
                <p className="text-lg font-bold">{form.concurrency}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Requests</p>
                <p className="text-lg font-bold">{form.total_requests}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Questions</p>
                <p className="text-lg font-bold">{form.questions.split('\n').filter(Boolean).length}</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setWizardStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Parameters</button>
              <button onClick={handleRun} disabled={isRunning} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {isRunning ? <><Loader2 size={16} className="animate-spin" /> Running…</> : <><Play size={16} /> Run Performance Test</>}
              </button>
            </div>
          </div>

          {result && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card label="Req/s" value={result.requests_per_second.toFixed(2)} />
                <Card label="Success" value={`${result.successful_requests}/${result.total_requests}`} />
                <Card label="Avg Latency" value={`${result.avg_latency_ms.toFixed(0)} ms`} />
                <Card label="Total Cost" value={result.total_cost_usd != null ? `$${result.total_cost_usd.toFixed(4)}` : '—'} />
              </div>

              {/* Latency chart */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold mb-3">Latency Distribution (ms)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={latencyBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Errors */}
              {result.error_details && result.error_details.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3 text-red-600">Errors ({result.failed_requests})</h3>
                  <ul className="text-sm space-y-1">
                    {result.error_details.slice(0, 10).map((e, i) => (
                      <li key={i} className="text-gray-600">
                        <span className="text-red-500">{String(e.error)}</span> — {String(e.latency_ms)}ms
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
