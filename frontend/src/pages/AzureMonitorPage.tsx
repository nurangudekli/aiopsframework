import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { scanSubscription, testDeployment, listSubscriptions, listWorkspaces } from '../api/client';
import type { ScanRequest, ScanResult, DeploymentInfo, TestDeploymentResult, SubscriptionInfo, WorkspaceInfo } from '../types';
import { CloudCog, Search, Server, Activity, AlertTriangle, FileText, PlayCircle, X, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockScanResult } from '../mocks';
import PromptLibraryPicker from '../components/PromptLibraryPicker';

export default function AzureMonitorPage() {
  const { useMock, toggleMock } = useMockToggle('azure-monitor');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [tab, setTab] = useState<'all' | 'deployments' | 'logs'>('deployments');

  // Auto-populate subscriptions
  const subsQuery = useQuery({
    queryKey: ['azure-subscriptions'],
    queryFn: listSubscriptions,
    staleTime: 5 * 60 * 1000, // cache 5 min
    retry: 1,
  });

  // Auto-populate workspaces when subscription is selected
  const workspacesQuery = useQuery({
    queryKey: ['azure-workspaces', subscriptionId],
    queryFn: () => listWorkspaces(subscriptionId),
    enabled: !!subscriptionId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Auto-select first subscription once loaded
  useEffect(() => {
    if (subsQuery.data && subsQuery.data.length > 0 && !subscriptionId) {
      setSubscriptionId(subsQuery.data[0].subscription_id);
    }
  }, [subsQuery.data]);

  // Test deployment state
  const [testModal, setTestModal] = useState<DeploymentInfo | null>(null);
  const [testPrompt, setTestPrompt] = useState('Hello, can you confirm you\'re working correctly?');
  const [testResult, setTestResult] = useState<TestDeploymentResult | null>(null);

  const scanMut = useMutation({
    mutationFn: (req: ScanRequest) => {
      if (useMock) return Promise.resolve(mockScanResult);
      return scanSubscription(req);
    },
  });

  const testMut = useMutation({
    mutationFn: testDeployment,
    onSuccess: (data) => setTestResult(data),
    onError: (error: Error) => {
      setTestResult({
        deployment_name: testModal?.deployment || 'unknown',
        model_name: 'unknown',
        model_version: 'unknown',
        prompt: testPrompt,
        response: '',
        latency_ms: 0,
        tokens_prompt: 0,
        tokens_completion: 0,
        success: false,
        error: error.message || 'Request failed',
      });
    },
  });

  const handleTest = (deployment: DeploymentInfo) => {
    console.log('handleTest called with deployment:', deployment);
    setTestModal(deployment);
    setTestResult(null);
  };

  const runTest = () => {
    if (!testModal) return;
    console.log('runTest called with:', {
      resource_id: testModal.resource_id,
      deployment_name: testModal.deployment,
      prompt: testPrompt,
    });
    testMut.mutate({
      resource_id: testModal.resource_id,
      deployment_name: testModal.deployment,
      prompt: testPrompt,
    });
  };

  const handleScan = () => {
    if (!subscriptionId) return;
    scanMut.mutate({
      subscription_id: subscriptionId,
      log_analytics_workspace_id: workspaceId || undefined,
    });
  };

  const result: ScanResult | undefined = scanMut.data;

  const usageBadge = (calls: number) => {
    if (calls === 0) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">No usage</span>;
    if (calls <= 100) return <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Low</span>;
    if (calls <= 1000) return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Medium</span>;
    return <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">High</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CloudCog size={24} /> Azure OpenAI Deployment Monitor
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-500 font-normal">Optional</span>
        </h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 text-sm mb-6">
        <strong>For subscription owners only.</strong>{' '}
        Scan your Azure subscription to discover OpenAI accounts, list deployments, and retrieve
        7-day usage metrics from Azure Monitor.
        Developers and testers without subscription access can use the <a href="/model-endpoints" className="text-indigo-600 underline">Model Endpoints</a> page instead.
        Inspired by{' '}
        <a
          href="https://github.com/pbubacz/ai-version-manager"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline"
        >
          pbubacz/ai-version-manager
        </a>.
      </p>

      <PageBanner
        title="How to use the Azure Monitor (optional)"
        description="This page is for Azure subscription owners. It discovers all Azure OpenAI accounts and deployments in a subscription and pulls 7-day usage metrics from Azure Monitor. If you only have a model endpoint URL and API key, use the Model Endpoints page instead."
        accentColor="sky"
        steps={[
          { label: 'Select your Subscription', detail: 'Pick your Azure Subscription from the dropdown — it is auto-populated from your Azure CLI login.' },
          { label: 'Choose Log Analytics Workspace (optional)', detail: 'If you have diagnostics forwarded to a Log Analytics workspace, select it from the dropdown for detailed log queries.' },
          { label: 'Click Run Audit Scan', detail: 'All accounts and deployments are discovered automatically with 7-day usage metrics and a usage-level badge.' },
        ]}
        tips={[
          'The Deployments tab shows every deployment with 7-day call/token metrics and a Test button.',
          'Deployments with "No Diagnostics" may need diagnostic settings configured in Azure Portal.',
          'The Detailed Logs tab requires a Log Analytics Workspace ID and shows raw log entries.',
        ]}
      />

      {/* ─── Configuration form ─── */}
      <div className="bg-white rounded-xl border p-5 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Azure Subscription</label>
          {subsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 size={14} className="animate-spin" /> Loading subscriptions…
            </div>
          ) : subsQuery.isError ? (
            <div className="text-sm text-red-600 py-2">
              Failed to load subscriptions. Make sure you are logged in with <code className="bg-gray-100 px-1 rounded">az login</code>.
              <button onClick={() => subsQuery.refetch()} className="ml-2 text-indigo-600 hover:underline inline-flex items-center gap-1">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                value={subscriptionId}
                onChange={(e) => {
                  setSubscriptionId(e.target.value);
                  setWorkspaceId('');          // reset workspace when sub changes
                }}
              >
                <option value="" disabled>Select a subscription…</option>
                {(subsQuery.data || []).map((s) => (
                  <option key={s.subscription_id} value={s.subscription_id}>
                    {s.display_name} ({s.subscription_id.slice(0, 8)}…)
                  </option>
                ))}
              </select>
              <button
                onClick={() => subsQuery.refetch()}
                className="p-2 text-gray-400 hover:text-indigo-600 border rounded-lg"
                title="Refresh subscriptions"
              >
                <RefreshCw size={14} className={subsQuery.isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Log Analytics Workspace (optional)</label>
          {!subscriptionId ? (
            <div className="text-xs text-gray-400 py-2">Select a subscription first</div>
          ) : workspacesQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 size={14} className="animate-spin" /> Loading workspaces…
            </div>
          ) : workspacesQuery.isError ? (
            <div className="text-sm text-red-600 py-2">
              Failed to load workspaces.
              <button onClick={() => workspacesQuery.refetch()} className="ml-2 text-indigo-600 hover:underline inline-flex items-center gap-1">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              >
                <option value="">None — skip log queries</option>
                {(workspacesQuery.data || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.resource_group} · {w.location})
                  </option>
                ))}
              </select>
              <button
                onClick={() => workspacesQuery.refetch()}
                className="p-2 text-gray-400 hover:text-indigo-600 border rounded-lg"
                title="Refresh workspaces"
              >
                <RefreshCw size={14} className={workspacesQuery.isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        <button
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          disabled={!subscriptionId || scanMut.isPending}
          onClick={handleScan}
        >
          <Search size={16} />
          {scanMut.isPending ? 'Scanning…' : 'Run Audit Scan'}
        </button>

        {scanMut.isError && (
          <div className="text-red-600 text-sm mt-2">
            Scan failed: {(scanMut.error as Error).message}
          </div>
        )}
      </div>

      {/* ─── Results ─── */}
      {result && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card icon={<Server size={18} />} label="Accounts" value={result.accounts_found} />
            <Card icon={<Activity size={18} />} label="Total Deployments" value={result.total_deployments} />
            <Card icon={<AlertTriangle size={18} />} label="No Diagnostics" value={result.no_diagnostics.length} />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">By Type</div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                  Standard {result.all_deployments.filter((d: any) => d.sku !== 'ProvisionedManaged' && d.sku !== 'GlobalProvisionedManaged' && d.deployment_type !== 'PTU').length}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                  PTU {result.all_deployments.filter((d: any) => d.sku === 'ProvisionedManaged' || d.sku === 'GlobalProvisionedManaged' || d.deployment_type === 'PTU').length}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {(['deployments', 'all', 'logs'] as const).map((t) => (
              <button
                key={t}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setTab(t)}
              >
                {t === 'deployments'
                  ? `Deployments & Metrics (${result.targeted_deployments.length})`
                  : t === 'all'
                  ? `All Deployments (${result.all_deployments.length})`
                  : `Detailed Logs (${result.detailed_logs.length})`}
              </button>
            ))}
          </div>

          {/* Deployments with metrics */}
          {tab === 'deployments' && (
            <div className="bg-white rounded-xl border overflow-x-auto">
              {result.targeted_deployments.length === 0 ? (
                <div className="p-6 text-gray-400 text-sm">No deployments found. Run a scan to discover deployments.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Account</th>
                      <th className="px-4 py-3 text-left">RG</th>
                      <th className="px-4 py-3 text-left">Region</th>
                      <th className="px-4 py-3 text-left">Deployment</th>
                      <th className="px-4 py-3 text-left">Model</th>
                      <th className="px-4 py-3 text-left">Version</th>
                      <th className="px-4 py-3 text-center">Type</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-right">Calls (7d)</th>
                      <th className="px-4 py-3 text-right">Prompt Tokens</th>
                      <th className="px-4 py-3 text-right">Completion Tokens</th>
                      <th className="px-4 py-3 text-center">Usage</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.targeted_deployments.map((d, i) => {
                      const isPTU = (d as any).deployment_type === 'PTU' || d.sku === 'ProvisionedManaged' || d.sku === 'GlobalProvisionedManaged';
                      return (
                      <tr key={i} className={`hover:bg-gray-50 ${isPTU ? 'border-l-2 border-l-purple-400' : ''}`}>
                        <td className="px-4 py-2">{d.account}</td>
                        <td className="px-4 py-2 text-gray-500">{d.resource_group}</td>
                        <td className="px-4 py-2 text-gray-500">{d.location}</td>
                        <td className="px-4 py-2 font-medium">{d.deployment}</td>
                        <td className="px-4 py-2">{d.model_name}</td>
                        <td className="px-4 py-2">{d.model_version}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isPTU ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isPTU ? 'PTU' : 'Standard'}
                          </span>
                        </td>
                        <td className="px-4 py-2">{d.sku}</td>
                        <td className="px-4 py-2 text-right font-mono">{d.total_calls_7d.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono">{d.processed_tokens_7d.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono">{d.generated_tokens_7d.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">{usageBadge(d.total_calls_7d)}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleTest(d)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            <PlayCircle size={12} /> Test
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* All deployments */}
          {tab === 'all' && (
            <div className="bg-white rounded-xl border overflow-x-auto">
              {result.all_deployments.length === 0 ? (
                <div className="p-6 text-gray-400 text-sm">No deployments found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Account</th>
                      <th className="px-4 py-3 text-left">RG</th>
                      <th className="px-4 py-3 text-left">Region</th>
                      <th className="px-4 py-3 text-left">Deployment</th>
                      <th className="px-4 py-3 text-left">Model</th>
                      <th className="px-4 py-3 text-left">Version</th>
                      <th className="px-4 py-3 text-center">Type</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-right">Capacity</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.all_deployments.map((d, i) => {
                      const isPTU = (d as any).deployment_type === 'PTU' || d.sku === 'ProvisionedManaged' || d.sku === 'GlobalProvisionedManaged';
                      return (
                      <tr key={i} className={`hover:bg-gray-50 ${isPTU ? 'border-l-2 border-l-purple-400' : ''}`}>
                        <td className="px-4 py-2">{d.account}</td>
                        <td className="px-4 py-2 text-gray-500">{d.resource_group}</td>
                        <td className="px-4 py-2 text-gray-500">{d.location}</td>
                        <td className="px-4 py-2 font-medium">{d.deployment}</td>
                        <td className="px-4 py-2">{d.model_name}</td>
                        <td className="px-4 py-2">{d.model_version}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${isPTU ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isPTU ? 'PTU' : 'Standard'}
                          </span>
                        </td>
                        <td className="px-4 py-2">{d.sku}</td>
                        <td className="px-4 py-2 text-right font-mono">{d.capacity ?? '–'}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleTest(d)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            <PlayCircle size={12} /> Test
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Detailed logs */}
          {tab === 'logs' && (
            <div className="bg-white rounded-xl border overflow-x-auto">
              {result.detailed_logs.length === 0 ? (
                <div className="p-6 text-gray-400 text-sm flex items-center gap-2">
                  <FileText size={16} />
                  No detailed logs. Provide a Log Analytics workspace ID and ensure diagnostic settings are
                  configured.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Operation</th>
                      <th className="px-4 py-3 text-left">Caller IP</th>
                      <th className="px-4 py-3 text-left">Identity</th>
                      <th className="px-4 py-3 text-left">User Agent</th>
                      <th className="px-4 py-3 text-left">Resource ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.detailed_logs.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">{l.time_generated}</td>
                        <td className="px-4 py-2">{l.operation}</td>
                        <td className="px-4 py-2 font-mono">{l.caller_ip}</td>
                        <td className="px-4 py-2 truncate max-w-[200px]">{l.identity}</td>
                        <td className="px-4 py-2 truncate max-w-[200px]">{l.user_agent}</td>
                        <td className="px-4 py-2 truncate max-w-[300px] text-gray-500">{l.resource_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Scan metadata */}
          <div className="text-xs text-gray-400">
            Scanned at {result.scanned_at} · Subscription {result.subscription_id}
          </div>
        </div>
      )}

      {/* Test Deployment Modal */}
      {testModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Test Deployment</h3>
              <button onClick={() => setTestModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Account:</span>
                  <span className="font-medium">{testModal.account}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deployment:</span>
                  <span className="font-medium">{testModal.deployment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Model:</span>
                  <span className="font-medium">{testModal.model_name} ({testModal.model_version})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resource ID:</span>
                  <span className="font-medium text-xs truncate max-w-[280px]" title={testModal.resource_id}>
                    {testModal.resource_id ? '.../' + testModal.resource_id.split('/').slice(-4).join('/') : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Test Prompt</label>
                  <PromptLibraryPicker onSelect={(s) => setTestPrompt(s.content)} />
                </div>
                <textarea
                  className="border rounded-lg px-3 py-2 w-full text-sm h-24"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Enter a test prompt..."
                />
              </div>

              <button
                onClick={runTest}
                disabled={testMut.isPending}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <PlayCircle size={16} />
                {testMut.isPending ? 'Testing...' : 'Run Test'}
              </button>

              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle size={18} className="text-green-600" />
                    ) : (
                      <XCircle size={18} className="text-red-600" />
                    )}
                    <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.success ? 'Test Passed' : 'Test Failed'}
                    </span>
                  </div>

                  {testResult.success && (
                    <>
                      <div className="text-sm text-gray-700 bg-white p-2 rounded border mb-2">
                        {testResult.response}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-4">
                        <span>Latency: {testResult.latency_ms.toFixed(0)}ms</span>
                        <span>Tokens: {testResult.tokens_prompt} / {testResult.tokens_completion}</span>
                      </div>
                    </>
                  )}

                  {!testResult.success && testResult.error && (
                    <div className="text-sm text-red-600">{testResult.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
