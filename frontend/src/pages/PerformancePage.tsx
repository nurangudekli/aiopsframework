import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runPerformanceTest } from '../api/client';
import type { PerformanceTestResult } from '../types';
import { Gauge } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockPerformanceResult } from '../mocks';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

export default function PerformancePage() {
  const { useMock, toggleMock } = useMockToggle('performance');
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

  const perfMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockPerformanceResult);
      return runPerformanceTest({
        ...form,
        questions: form.questions.split('\n').filter(Boolean),
      });
    },
    onSuccess: (data) => setResult(data),
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

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gauge size={24} /> Performance & Stress Testing
        </h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Load test your model endpoints. Measure latency percentiles, throughput, and error rates.
      </p>

      <PageBanner
        title="How to use Performance Testing"
        description="Stress-test any Azure OpenAI deployment with configurable concurrency and get detailed latency analysis."
        accentColor="blue"
        steps={[
          { label: 'Choose a provider & deployment', detail: 'Select Azure OpenAI, OpenAI, or a custom endpoint and enter the deployment name.' },
          { label: 'Set concurrency & request count', detail: 'Concurrency controls parallel calls; total requests is how many calls to make in total.' },
          { label: 'Add test prompts', detail: 'Enter one question per line — the tool rotates through them during the test.' },
          { label: 'Click Run Performance Test', detail: 'Results show requests/sec, success rate, latency percentiles (P50/P90/P99), and any errors.' },
        ]}
        tips={[
          'Start with low concurrency (3-5) and increase gradually to avoid throttling.',
          'P90 and P99 latency are the most important metrics for production SLAs.',
          'Errors are listed individually with status codes so you can diagnose rate limits or timeouts.',
        ]}
      />

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Configure Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProviderSelect
            label="Provider"
            value={form.model_provider}
            onChange={(v) => setForm({ ...form, model_provider: v })}
          />
          <DeploymentSelect
            label="Deployment"
            value={form.model_deployment}
            onChange={(v) => setForm({ ...form, model_deployment: v })}
            placeholder="Select or type deployment…"
          />
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
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={2}
            placeholder="You are a helpful assistant..."
            value={form.system_message}
            onChange={(e) => setForm({ ...form, system_message: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Questions (one per line)</label>
            <GoldenDatasetPicker onLoadQuestions={(qs) => setForm({ ...form, questions: qs.join('\n') })} />
          </div>
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={4}
            placeholder={"What is cloud computing?\nExplain Kubernetes.\nHow does CI/CD work?"}
            value={form.questions}
            onChange={(e) => setForm({ ...form, questions: e.target.value })}
          />
        </div>
        <button
          onClick={() => perfMut.mutate()}
          disabled={perfMut.isPending || !form.questions.trim()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {perfMut.isPending ? 'Running Test…' : 'Run Performance Test'}
        </button>
      </div>

      {result && (
        <div className="space-y-6">
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
