import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  registerEndpoint,
  listEndpoints,
  deleteEndpoint,
  testEndpoint,
  updateEndpoint,
} from '../api/client';
import type { RegisteredEndpoint, EndpointTestResult } from '../types';
import {
  Key,
  Plus,
  Trash2,
  PlayCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Server,
  Edit3,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import PageBanner from '../components/PageBanner';
import ProviderSelect from '../components/ProviderSelect';

export default function EndpointsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => listEndpoints(false),
  });

  const deleteMut = useMutation({
    mutationFn: deleteEndpoint,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['endpoints'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateEndpoint(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['endpoints'] }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => testEndpoint(id),
    onSuccess: (data, id) => {
      setTestingId(id);
      setTestResult(data);
    },
    onError: (err: Error, id) => {
      setTestingId(id);
      setTestResult({ success: false, error: err.message });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key size={24} /> Model Endpoints
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> Add Model Endpoint
        </button>
      </div>
      <p className="text-gray-600 text-sm mb-4">
        Register your model endpoints here — just provide the model endpoint URL and API key.
        No Azure subscription access required.
      </p>

      <PageBanner
        title="Getting Started with Model Endpoints"
        description="Developers and testers can register model endpoints directly — no subscription-owner access needed. Once registered, model endpoints appear in every deployment dropdown across the framework."
        accentColor="green"
        steps={[
          { label: 'Click Add Model Endpoint', detail: 'Enter your model endpoint URL, API key, and deployment name.' },
          { label: 'Test the connection', detail: 'Click the Test button to verify the model endpoint is live and responding.' },
          { label: 'Use everywhere', detail: 'Your model endpoint now appears in every page: A/B Testing, Evaluation, Performance, RAG, etc.' },
        ]}
        tips={[
          'Supports Azure OpenAI, OpenAI direct, or any OpenAI-compatible model endpoint.',
          'API keys are stored locally and never leave your machine.',
          'Subscription owners can also use Azure Monitor to auto-discover deployments.',,
        ]}
      />

      {/* Registration form */}
      {showForm && (
        <RegisterForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['endpoints'] });
            queryClient.invalidateQueries({ queryKey: ['registered-deployments'] });
          }}
        />
      )}

      {/* Endpoint list */}
      {isLoading ? (
        <div className="text-gray-400 text-center py-12">Loading endpoints…</div>
      ) : endpoints.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Server className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 mb-3">No model endpoints registered yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            Register Your First Model Endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep: RegisteredEndpoint) => (
            <div
              key={ep.id}
              className={`bg-white rounded-xl border p-5 transition-opacity ${!ep.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{ep.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      ep.provider === 'azure_openai' ? 'bg-blue-100 text-blue-700' :
                      ep.provider === 'openai' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{ep.provider}</span>
                    {!ep.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>
                      <span className="text-gray-400">Deployment:</span>{' '}
                      <span className="font-mono font-medium text-gray-700">{ep.deployment_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Endpoint:</span>{' '}
                      <span className="font-mono truncate">{ep.endpoint_url}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Key:</span>{' '}
                      <span className="font-mono">{ep.api_key_hint}</span>
                      {ep.model_name && (
                        <>
                          <span className="text-gray-400 ml-3">Model:</span>{' '}
                          <span>{ep.model_name} {ep.model_version && `v${ep.model_version}`}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => testMut.mutate(ep.id)}
                    disabled={testMut.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    title="Test connectivity"
                  >
                    {testMut.isPending && testMut.variables === ep.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PlayCircle size={12} />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => toggleMut.mutate({ id: ep.id, active: !ep.is_active })}
                    className={`p-1.5 rounded-lg border ${ep.is_active ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                    title={ep.is_active ? 'Disable' : 'Enable'}
                  >
                    {ep.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete model endpoint "${ep.name}"?`)) deleteMut.mutate(ep.id); }}
                    className="p-1.5 rounded-lg border text-red-500 border-red-200 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Test result */}
              {testingId === ep.id && testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {testResult.success ? (
                      <><CheckCircle size={14} className="text-green-600" /> <span className="font-medium text-green-700">Connected</span></>
                    ) : (
                      <><XCircle size={14} className="text-red-600" /> <span className="font-medium text-red-700">Failed</span></>
                    )}
                  </div>
                  {testResult.success && testResult.response && (
                    <div className="text-xs text-gray-600 bg-white rounded border p-2 mb-1">{testResult.response}</div>
                  )}
                  {testResult.success && (
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span>Latency: {testResult.latency_ms?.toFixed(0)}ms</span>
                      <span>Tokens: {testResult.tokens_prompt}/{testResult.tokens_completion}</span>
                      {testResult.model_name && <span>Model: {testResult.model_name}</span>}
                    </div>
                  )}
                  {!testResult.success && testResult.error && (
                    <div className="text-xs text-red-600">{testResult.error}</div>
                  )}
                </div>
              )}

              <div className="mt-2 text-[10px] text-gray-400">
                ID: {ep.id} · Registered: {new Date(ep.created_at).toLocaleDateString()}
                {ep.tags && Object.keys(ep.tags).length > 0 && (
                  <span className="ml-2">
                    Tags: {Object.entries(ep.tags).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Registration Form ─────────────────────────────────────── */
function RegisterForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    provider: 'azure_openai',
    endpoint_url: '',
    api_key: '',
    deployment_name: '',
    model_name: '',
    model_version: '',
    api_version: '2024-06-01',
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => registerEndpoint(form),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const u = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Plus size={16} className="text-indigo-600" /> Register New Model Endpoint
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Display Name *</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="e.g. GPT-4o Staging"
            value={form.name}
            onChange={(e) => u('name', e.target.value)}
          />
        </div>
        <ProviderSelect
          value={form.provider}
          onChange={(v) => u('provider', v)}
          label="Provider"
        />
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Model Endpoint URL *</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
            placeholder={
              form.provider === 'azure_openai'
                ? 'https://myaccount.openai.azure.com'
                : form.provider === 'openai'
                ? 'https://api.openai.com'
                : 'https://my-api.example.com/v1'
            }
            value={form.endpoint_url}
            onChange={(e) => u('endpoint_url', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">API Key *</label>
          <input
            type="password"
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
            placeholder="sk-... or Azure API key"
            value={form.api_key}
            onChange={(e) => u('api_key', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Deployment / Model Name *</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="e.g. gpt-4o"
            value={form.deployment_name}
            onChange={(e) => u('deployment_name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Display Model Name</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="e.g. gpt-4o (optional)"
            value={form.model_name}
            onChange={(e) => u('model_name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Model Version</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="e.g. 2024-08-06"
            value={form.model_version}
            onChange={(e) => u('model_version', e.target.value)}
          />
        </div>
        {form.provider === 'azure_openai' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Version</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-white"
              value={form.api_version}
              onChange={(e) => u('api_version', e.target.value)}
            >
              <option value="2024-06-01">2024-06-01 (GA)</option>
              <option value="2024-08-01-preview">2024-08-01-preview</option>
              <option value="2024-10-01-preview">2024-10-01-preview</option>
              <option value="2024-10-21">2024-10-21 (GA)</option>
              <option value="2024-12-01-preview">2024-12-01-preview</option>
              <option value="2025-01-01-preview">2025-01-01-preview</option>
              <option value="2025-03-01-preview">2025-03-01-preview</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !form.name || !form.endpoint_url || !form.api_key || !form.deployment_name}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {mut.isPending ? 'Registering…' : 'Register Model Endpoint'}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
