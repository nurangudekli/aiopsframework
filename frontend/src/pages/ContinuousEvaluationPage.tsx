import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContinuousEvalRun,
  listContinuousEvalRuns,
  getContinuousEvalRun,
  getContinuousEvalDashboard,
  getMetricTrends,
  listEvalAlerts,
  ackEvalAlert,
  submitHumanReview,
  listHumanReviews,
  runUxEvaluation,
  createEvalSchedule,
  listEvalSchedules,
  deleteEvalSchedule,
  listGoldenDatasets,
} from '../api/client';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Database,
  Info,
  Loader2,
  MessageSquare,
  Play,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

/* ─── Reusable step badge ───────────────────────────────────── */
function StepBadge({ step, title, done }: { step: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
        {done ? <CheckCircle2 size={14} /> : step}
      </div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
    </div>
  );
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ─── Tab definitions ───────────────────────────────────────── */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'run', label: 'New Run', icon: Play },
  { id: 'history', label: 'Run History', icon: Clock },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'ux', label: 'UX Metrics', icon: Users },
  { id: 'schedule', label: 'Schedules', icon: Calendar },
  { id: 'review', label: 'Human Review', icon: MessageSquare },
] as const;
type TabId = (typeof TABS)[number]['id'];

/* ─── Main Component ────────────────────────────────────────── */
export default function ContinuousEvaluationPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
        <Activity size={24} /> Continuous Evaluation
      </h1>
      <p className="text-gray-600 text-sm mb-4">
        End-to-end evaluation pipeline inspired by{' '}
        <a
          href="https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/evaluating-generative-ai-models-using-microsoft-foundry%E2%80%99s-continuous-evaluation-/4468075"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          Microsoft Foundry's Continuous Evaluation Framework
        </a>
        .
      </p>

      <PageBanner
        title="Continuous Evaluation Framework"
        description="Continuously measure, monitor, and improve AI quality — from dataset evaluation to safety alerts, UX metrics, and human review."
        accentColor="indigo"
        steps={[
          { label: 'Run Evaluation', detail: 'Choose evaluators (quality, safety, UX) and run against a dataset.' },
          { label: 'Analyze Dashboard', detail: 'View composite quality scores, safety violation rates, and metric trends.' },
          { label: 'Set Alerts', detail: 'Configure thresholds and get alerted when quality or safety drops.' },
          { label: 'Human Review', detail: 'Flag AI responses for human review and improvement.' },
          { label: 'Automate with CI/CD', detail: 'Use GitHub Actions to evaluate on every deployment.' },
        ]}
        tips={[
          'UX metrics (helpfulness, tone, completeness) complement standard quality evaluators.',
          'Schedule evaluations to run on model deployment or on a cron interval.',
          'Export results and integrate with Azure Monitor for production alerting.',
        ]}
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'run' && <NewRunTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'alerts' && <AlertsTab />}
      {activeTab === 'ux' && <UxMetricsTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'review' && <HumanReviewTab />}
    </div>
  );
}

/* ─── Dashboard Tab (blog Step 4) ───────────────────────────── */
function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['continuous-eval-dashboard'],
    queryFn: getContinuousEvalDashboard,
    refetchInterval: 30_000,
  });

  const [trendMetric, setTrendMetric] = useState('coherence');
  const { data: trendData } = useQuery({
    queryKey: ['metric-trend', trendMetric],
    queryFn: () => getMetricTrends(trendMetric),
    enabled: !!data?.total_runs,
  });

  if (isLoading) return <div className="text-gray-400">Loading dashboard…</div>;
  if (!data || data.total_runs === 0)
    return (
      <div className="text-center py-12 bg-white rounded-xl border">
        <Activity className="mx-auto text-gray-300 mb-3" size={48} />
        <p className="text-gray-500">No evaluation runs yet. Create one from the "New Run" tab.</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Runs" value={String(data.total_runs)} />
        <SummaryCard
          label="Composite Quality"
          value={data.composite_quality?.toFixed(2) ?? '—'}
          color={data.composite_quality >= 4 ? 'text-green-600' : data.composite_quality >= 3 ? 'text-yellow-600' : 'text-red-600'}
        />
        <SummaryCard
          label="Safety Violation Rate"
          value={data.safety_violation_rate != null ? `${(data.safety_violation_rate * 100).toFixed(1)}%` : '—'}
          color={data.safety_violation_rate <= 0.01 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          label="Active Alerts"
          value={String(data.active_alerts?.length ?? 0)}
          color={data.active_alerts?.length > 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>

      {/* Metric Summary Table */}
      {data.metric_summary && Object.keys(data.metric_summary).length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Metric Summary</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-center">Latest</th>
                <th className="px-3 py-2 text-center">Average</th>
                <th className="px-3 py-2 text-center">Trend</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(data.metric_summary).map(([name, info]: [string, any]) => (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium capitalize">{name.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-center font-mono">{info.latest?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center font-mono">{info.average?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                      info.trend === 'improving' ? 'bg-green-50 text-green-700' :
                      info.trend === 'declining' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {info.trend === 'improving' ? <TrendingUp size={12} /> : null}
                      {info.trend}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {info.latest >= 4 ? <CheckCircle2 size={16} className="text-green-500 mx-auto" /> :
                     info.latest >= 3 ? <AlertTriangle size={16} className="text-yellow-500 mx-auto" /> :
                     <XCircle size={16} className="text-red-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metric Trend Chart */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Metric Trend Over Time</h3>
          <select
            className="border rounded-lg px-2 py-1 text-sm"
            value={trendMetric}
            onChange={(e) => setTrendMetric(e.target.value)}
          >
            {['coherence', 'fluency', 'relevance', 'groundedness', 'helpfulness', 'tone', 'completeness'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {trendData && trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="run_name" fontSize={11} />
              <YAxis domain={[0, 5]} fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-sm py-8 text-center">No trend data available yet. Run multiple evaluations to see trends.</p>
        )}
      </div>

      {/* Active Alerts */}
      {data.active_alerts && data.active_alerts.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
            <Bell size={14} /> Active Alerts ({data.active_alerts.length})
          </h3>
          <div className="space-y-2">
            {data.active_alerts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100 text-sm">
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                    a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{a.severity}</span>
                  {a.message}
                </div>
                <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── New Run Tab (blog Step 3) — 3-step wizard ─────────────── */
function NewRunTab() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [deployment, setDeployment] = useState('');
  const [modelVersion, setModelVersion] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [selectedEvals, setSelectedEvals] = useState<string[]>(['coherence', 'fluency', 'relevance', 'groundedness']);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const allEvaluators = [
    { group: 'Quality', items: ['coherence', 'fluency', 'relevance', 'groundedness', 'similarity', 'retrieval'] },
    { group: 'NLP', items: ['f1_score', 'bleu_score', 'rouge_score', 'gleu_score', 'meteor_score'] },
    { group: 'Safety', items: ['violence', 'sexual', 'hate_unfairness', 'self_harm'] },
    { group: 'UX', items: ['helpfulness', 'tone', 'completeness'] },
  ];

  const toggleEval = (e: string) =>
    setSelectedEvals((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const mut = useMutation({
    mutationFn: () => {
      let data: Array<Record<string, string>>;
      try {
        data = JSON.parse(jsonText);
        if (!Array.isArray(data)) throw new Error('Not an array');
      } catch {
        throw new Error('Invalid JSON — provide an array of objects');
      }
      return createContinuousEvalRun({
        name,
        deployment,
        model_version: modelVersion,
        dataset: data,
        evaluators: selectedEvals,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['continuous-eval-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['continuous-eval-runs'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const sampleData = JSON.stringify([
    { query: 'What is Azure?', response: 'Azure is Microsoft cloud platform.', ground_truth: "Azure is Microsoft's cloud computing platform." },
    { query: 'What is GPT?', response: 'GPT is a language model by OpenAI.', ground_truth: 'GPT is a generative pre-trained transformer by OpenAI.' },
  ], null, 2);

  const step1Done = !!name && !!deployment;
  const step2Done = !!jsonText.trim();

  const STEPS = [
    { id: 1, title: 'Run Details', icon: Activity },
    { id: 2, title: 'Load Dataset', icon: BarChart3 },
    { id: 3, title: 'Evaluators & Run', icon: Play },
  ];

  return (
    <>
      {/* Mini stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : s.id === 2 ? step2Done : !!result;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={12} /> : s.id}
                </div>
                {s.title}
              </button>
              {idx < STEPS.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={1} title="Run Details" />
          <p className="text-xs text-gray-500 mb-4">Name your evaluation run and select the deployment to evaluate.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Run Name *</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nightly Quality Check" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <DeploymentSelect
              label="Deployment *"
              value={deployment}
              onChange={setDeployment}
              onSelectDeployment={(info) => {
                if (info.model_version) setModelVersion(info.model_version);
              }}
              placeholder="Select deployment…"
            />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Model Version</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Auto-filled or type manually" value={modelVersion} onChange={(e) => setModelVersion(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Dataset</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Load Dataset" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> <span className="font-medium">{name}</span> → <span className="font-mono">{deployment}</span>{modelVersion ? ` (v${modelVersion})` : ''}
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-medium text-gray-500">Dataset (JSON array) *</p>
              <div className="flex items-center gap-2">
                <GoldenDatasetPicker label="From Golden Dataset" onLoadDatasetJson={(json) => setJsonText(json)} />
                <button onClick={() => setJsonText(sampleData)} className="text-xs text-indigo-600 hover:underline">Load sample</button>
              </div>
            </div>
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              rows={8}
              placeholder='[{"query": "...", "response": "...", "ground_truth": "..."}]'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
            {jsonText && (() => { try { return <p className="text-[11px] text-gray-400 mt-1">{JSON.parse(jsonText).length} rows</p>; } catch { return <p className="text-[11px] text-red-400 mt-1">Invalid JSON</p>; } })()}
          </div>
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Evaluators</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={3} title="Select Evaluators & Run" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Run</span><span className="font-medium">{name}</span></div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Deployment</span><span className="font-mono">{deployment}</span></div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Dataset</span>{(() => { try { return `${JSON.parse(jsonText).length} rows`; } catch { return 'Invalid JSON'; } })()}</div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Evaluators *</p>
              {allEvaluators.map((group) => (
                <div key={group.group} className="mb-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{group.group}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleEval(e)}
                        className={`px-3 py-1 text-xs rounded-full border ${
                          selectedEvals.includes(e) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        {e.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertTriangle size={14} /> {error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !name || !jsonText || !selectedEvals.length}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm"
              >
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Running…</> : <><Play size={16} /> Run Evaluation Pipeline</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-3">Evaluation Results — {result.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <SummaryCard label="Composite Quality" value={result.metrics?.composite_quality_score?.toFixed(2) ?? '—'} />
                <SummaryCard label="Safety Violation Rate" value={result.metrics?.safety_violation_rate != null ? `${(result.metrics.safety_violation_rate * 100).toFixed(1)}%` : '—'} />
                <SummaryCard label="Rows Evaluated" value={String(result.dataset_size)} />
                <SummaryCard label="Alerts Triggered" value={String(result.alerts_triggered)} color={result.alerts_triggered > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              {result.metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(result.metrics)
                    .filter(([k]) => k.endsWith('.mean'))
                    .map(([k, v]) => (
                      <SummaryCard key={k} label={k.replace('.mean', '').replace(/_/g, ' ')} value={(v as number).toFixed(3)} />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── History Tab ───────────────────────────────────────────── */
function HistoryTab() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['continuous-eval-runs'],
    queryFn: () => listContinuousEvalRuns(),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    const d = await getContinuousEvalRun(id);
    setDetail(d);
  };

  if (isLoading) return <div className="text-gray-400">Loading…</div>;
  if (!runs.length) return <div className="text-gray-400 text-center py-12">No evaluation runs yet.</div>;

  return (
    <div className="space-y-3">
      {runs.map((run: any) => (
        <div key={run.id} className="bg-white rounded-xl border overflow-hidden">
          <button onClick={() => toggleExpand(run.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-indigo-500" />
              <div>
                <h4 className="font-semibold text-sm">{run.name}</h4>
                <p className="text-xs text-gray-500">
                  {run.deployment} · {run.dataset_size} rows · {new Date(run.finished_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                Quality: {run.metrics?.composite_quality_score?.toFixed(2) ?? '—'}
              </span>
              {run.alerts_triggered > 0 && (
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{run.alerts_triggered} alerts</span>
              )}
              {expandedId === run.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          {expandedId === run.id && detail && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {Object.entries(detail.metrics || {})
                  .filter(([k]) => k.endsWith('.mean'))
                  .map(([k, v]) => (
                    <SummaryCard key={k} label={k.replace('.mean', '').replace(/_/g, ' ')} value={(v as number).toFixed(3)} />
                  ))}
              </div>
              {detail.rows && detail.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border rounded">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        {Object.keys(detail.rows[0]).slice(0, 8).map((col) => (
                          <th key={col} className="px-2 py-1 text-left max-w-[150px] truncate">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.slice(0, 20).map((row: any, i: number) => (
                        <tr key={i} className="border-t hover:bg-white">
                          <td className="px-2 py-1">{i + 1}</td>
                          {Object.values(row).slice(0, 8).map((v: any, j: number) => (
                            <td key={j} className="px-2 py-1 max-w-[150px] truncate">
                              {typeof v === 'number' ? v.toFixed(3) : String(v ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Alerts Tab (blog Step 5) ──────────────────────────────── */
function AlertsTab() {
  const queryClient = useQueryClient();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['eval-alerts'],
    queryFn: () => listEvalAlerts(),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => ackEvalAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eval-alerts'] }),
  });

  if (isLoading) return <div className="text-gray-400">Loading…</div>;
  if (!alerts.length) return (
    <div className="text-center py-12 bg-white rounded-xl border">
      <CheckCircle2 className="mx-auto text-green-300 mb-3" size={48} />
      <p className="text-gray-500">No evaluation alerts. All metrics within thresholds.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {alerts.map((a: any) => (
        <div key={a.id} className={`rounded-xl border p-4 ${a.status === 'active' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {a.status === 'active' ? <AlertTriangle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-gray-400" />}
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>{a.severity}</span>
              <span className="text-sm font-medium">{a.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
              {a.status === 'active' && (
                <button
                  onClick={() => ackMut.mutate(a.id)}
                  className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Run: {a.run_id} · Metric: {a.metric} · Actual: {typeof a.actual_value === 'number' ? a.actual_value.toFixed(3) : a.actual_value} · Threshold: {a.threshold}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── UX Metrics Tab (blog Step 2 — helpfulness, tone, completeness) — 2-step wizard ── */
function UxMetricsTab() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ query: '', response: '', context: '', ground_truth: '', expected_tone: 'professional' });
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['helpfulness', 'tone', 'completeness']);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const toggleMetric = (m: string) =>
    setSelectedMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const mut = useMutation({
    mutationFn: () => runUxEvaluation({ ...form, metrics: selectedMetrics }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const step1Done = !!form.response.trim();

  const STEPS = [
    { id: 1, title: 'Enter Content', icon: Users },
    { id: 2, title: 'Metrics & Run', icon: Play },
  ];

  return (
    <>
      {/* Mini stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : !!result;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={12} /> : s.id}
                </div>
                {s.title}
              </button>
              {idx < STEPS.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={1} title="Enter Content for UX Evaluation" />
          <p className="text-xs text-gray-500 mb-3">
            Evaluate helpfulness, tone, and completeness — the human-facing quality metrics missing from standard SDK evaluators.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Query / prompt" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
              <PromptLibraryPicker onSelect={(s) => setForm({ ...form, query: s.content })} />
              <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, query: c.question, ground_truth: c.expected_answer || form.ground_truth })} />
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Ground truth (for completeness)" value={form.ground_truth} onChange={(e) => setForm({ ...form, ground_truth: e.target.value })} />
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Metrics</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={2} title="Select UX Metrics & Run" />
            <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
              <CheckCircle2 size={12} /> Response ({form.response.length} chars){form.query ? ` · Query: "${form.query.slice(0, 50)}…"` : ''}
              <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500">Expected Tone</label>
                <select className="ml-2 border rounded-lg px-2 py-1 text-sm" value={form.expected_tone} onChange={(e) => setForm({ ...form, expected_tone: e.target.value })}>
                  {['professional', 'friendly', 'empathetic', 'formal', 'casual'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                {['helpfulness', 'tone', 'completeness'].map((m) => (
                  <button key={m} onClick={() => toggleMetric(m)} className={`px-3 py-1 text-xs rounded-full border ${
                    selectedMetrics.includes(m) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200'
                  }`}>{m}</button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertTriangle size={14} /> {error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Evaluating…</> : <><Play size={16} /> Run UX Evaluation</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-3">UX Evaluation Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(result).map(([name, val]: [string, any]) => (
                  <div key={name} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1 capitalize">{name}</p>
                    <p className={`text-lg font-bold ${val.score >= 4 ? 'text-green-600' : val.score >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {val.score?.toFixed(2)}/5
                    </p>
                    {val.reasoning && <p className="text-xs text-gray-500 mt-1">{val.reasoning}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">Method: {val.method}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── Schedule Tab (blog Step 5 — MLOps) — 2-step wizard ───── */
function ScheduleTab() {
  const queryClient = useQueryClient();
  const { data: schedules = [] } = useQuery({ queryKey: ['eval-schedules'], queryFn: listEvalSchedules });
  const { data: datasets = [] } = useQuery({ queryKey: ['golden-datasets'], queryFn: listGoldenDatasets });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', deployment: '', golden_dataset_id: '', trigger: 'manual', cron_expression: '',
    evaluators: ['coherence', 'fluency', 'relevance', 'groundedness'],
  });

  const createMut = useMutation({
    mutationFn: () => createEvalSchedule(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eval-schedules'] });
      setForm({ ...form, name: '' });
      setStep(1);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEvalSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eval-schedules'] }),
  });

  const step1Done = !!form.name && !!form.deployment;
  const allEvaluators = ['coherence', 'fluency', 'relevance', 'groundedness', 'similarity', 'retrieval', 'f1_score', 'bleu_score', 'rouge_score', 'violence', 'sexual', 'hate_unfairness', 'self_harm', 'helpfulness', 'tone', 'completeness'];
  const toggleEval = (e: string) => setForm(prev => ({ ...prev, evaluators: prev.evaluators.includes(e) ? prev.evaluators.filter(x => x !== e) : [...prev.evaluators, e] }));

  const STEPS = [
    { id: 1, title: 'Schedule Details', icon: Calendar },
    { id: 2, title: 'Evaluators & Create', icon: Play },
  ];

  return (
    <>
      {/* Mini stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : false;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={12} /> : s.id}
                </div>
                {s.title}
              </button>
              {idx < STEPS.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={1} title="Schedule Details" />
          <p className="text-xs text-gray-500 mb-4">Name your schedule, select the deployment and trigger type.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Schedule Name *</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nightly Quality Check" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <DeploymentSelect label="Deployment *" value={form.deployment} onChange={(v) => setForm({ ...form, deployment: v })} placeholder="Select deployment…" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Golden Dataset</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.golden_dataset_id} onChange={(e) => setForm({ ...form, golden_dataset_id: e.target.value })}>
                <option value="">Select dataset…</option>
                {datasets.map((ds: any) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trigger</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                <option value="manual">Manual</option>
                <option value="on_deployment">On Model Deployment</option>
                <option value="cron">Scheduled (Cron)</option>
              </select>
            </div>
            {form.trigger === 'cron' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Cron Expression</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder="0 */6 * * *" value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} />
              </div>
            )}
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Evaluators</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Select Evaluators & Create" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> <span className="font-medium">{form.name}</span> → <span className="font-mono">{form.deployment}</span> · Trigger: {form.trigger}
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Evaluators *</p>
            <div className="flex flex-wrap gap-2">
              {allEvaluators.map((e) => (
                <button key={e} onClick={() => toggleEval(e)} className={`px-3 py-1 text-xs rounded-full border ${form.evaluators.includes(e) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {e.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between pt-4 border-t">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || !form.deployment || createMut.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
              {createMut.isPending ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <><Play size={16} /> Create Schedule</>}
            </button>
          </div>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="bg-white rounded-xl border mt-6">
          <div className="px-6 py-3 border-b"><h3 className="font-semibold text-sm">Active Schedules</h3></div>
          <div className="divide-y">
            {schedules.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.deployment} · {s.trigger}{s.cron_expression ? ` (${s.cron_expression})` : ''} · {s.evaluators.length} evaluators</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button onClick={() => deleteMut.mutate(s.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Human Review Tab (blog Step 6) — 2-step wizard ────────── */
function HumanReviewTab() {
  const queryClient = useQueryClient();
  const { data: runs = [] } = useQuery({ queryKey: ['continuous-eval-runs'], queryFn: () => listContinuousEvalRuns() });
  const [selectedRunId, setSelectedRunId] = useState('');
  const { data: reviews = [] } = useQuery({
    queryKey: ['human-reviews', selectedRunId],
    queryFn: () => listHumanReviews(selectedRunId || undefined),
    enabled: true,
  });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ run_id: '', row_index: 0, reviewer: '', rating: 3, feedback: '', flags: [] as string[] });
  const [error, setError] = useState('');

  const allFlags = ['hallucination', 'unsafe', 'off_topic', 'incomplete', 'biased', 'wrong_tone'];
  const toggleFlag = (f: string) =>
    setForm((prev) => ({ ...prev, flags: prev.flags.includes(f) ? prev.flags.filter((x) => x !== f) : [...prev.flags, f] }));

  const submitMut = useMutation({
    mutationFn: () => submitHumanReview(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human-reviews'] });
      setForm({ ...form, feedback: '', flags: [] });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const step1Done = !!form.run_id && !!form.reviewer;

  const STEPS = [
    { id: 1, title: 'Select Run', icon: MessageSquare },
    { id: 2, title: 'Rate & Flag', icon: Play },
  ];

  return (
    <>
      {/* Mini stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : false;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-indigo-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {done && !active ? <CheckCircle2 size={12} /> : s.id}
                </div>
                {s.title}
              </button>
              {idx < STEPS.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={1} title="Select Evaluation Run & Reviewer" />
          <p className="text-xs text-gray-500 mb-4">Choose the evaluation run to review and identify yourself as the reviewer.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Evaluation Run *</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.run_id} onChange={(e) => { setForm({ ...form, run_id: e.target.value }); setSelectedRunId(e.target.value); }}>
                <option value="">Select run…</option>
                {runs.map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Row Index</label>
              <input type="number" min={0} className="w-full px-3 py-2 border rounded-lg text-sm" value={form.row_index} onChange={(e) => setForm({ ...form, row_index: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reviewer *</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Your name" value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Rate & Flag</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Rate & Flag" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> Run: <span className="font-mono">{form.run_id.slice(0, 12)}</span> · Row #{form.row_index} · Reviewer: {form.reviewer}
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Rating (1-5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, rating: n })} className={`w-10 h-10 rounded-lg border text-sm font-bold ${form.rating === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Flags</label>
            <div className="flex flex-wrap gap-2">
              {allFlags.map((f) => (
                <button key={f} onClick={() => toggleFlag(f)} className={`px-3 py-1 text-xs rounded-full border ${
                  form.flags.includes(f) ? 'bg-red-100 border-red-400 text-red-700' : 'bg-gray-50 border-gray-200'
                }`}>{f.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </div>

          <textarea className="w-full px-3 py-2 border rounded-lg text-sm mb-4" rows={3} placeholder="Feedback / notes" value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} />

          {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertTriangle size={14} /> {error}</p>}

          <div className="flex justify-between pt-4 border-t">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => submitMut.mutate()} disabled={!form.run_id || submitMut.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
              {submitMut.isPending ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Play size={16} /> Submit Review</>}
            </button>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border mt-6">
          <div className="px-6 py-3 border-b"><h3 className="font-semibold text-sm">Recent Reviews</h3></div>
          <div className="divide-y">
            {reviews.map((r: any) => (
              <div key={r.id} className="px-6 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{r.run_id}</span>
                    <span className="text-xs text-gray-500">Row #{r.row_index}</span>
                    {r.reviewer && <span className="text-xs text-gray-500">by {r.reviewer}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${r.rating >= 4 ? 'text-green-600' : r.rating >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {r.rating}/5
                    </span>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {r.flags?.length > 0 && (
                  <div className="flex gap-1 mb-1">
                    {r.flags.map((f: string) => (
                      <span key={f} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
                {r.feedback && <p className="text-xs text-gray-600">{r.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Metric Descriptions ───────────────────────────────────── */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  'composite quality': 'Weighted average of all quality metrics (coherence, fluency, relevance, groundedness). Higher is better (1–5 scale).',
  'safety violation rate': 'Percentage of responses flagged for safety issues such as violence or harmful content. Lower is better (0% = fully safe).',
  'rows evaluated': 'Total number of dataset rows processed in this evaluation run.',
  'alerts triggered': 'Number of threshold-based alerts fired during evaluation (e.g. quality drop, safety spike).',
  'coherence': 'Measures logical consistency and flow of the response. Scale: 1 (incoherent) to 5 (perfectly coherent).',
  'fluency': 'Measures grammatical correctness and natural language quality. Scale: 1 (poor) to 5 (native-level fluency).',
  'relevance': 'How well the response addresses the input query or prompt. Scale: 1 (off-topic) to 5 (directly relevant).',
  'groundedness': 'Degree to which the response is grounded in provided context/documents. Scale: 1 (hallucinated) to 5 (fully grounded).',
  'similarity': 'Semantic similarity between the model response and the expected/reference answer. Scale: 1 (unrelated) to 5 (near-identical).',
  'f1 score': 'Token-level overlap between the response and the reference answer. Range: 0.0 (no overlap) to 1.0 (perfect match).',
  'violence': 'Severity of violent content detected in the response. Scale: 0 (none) to 7 (extreme). Lower is better.',
  'helpfulness': 'How useful and actionable the response is for the user. Scale: 1 (unhelpful) to 5 (highly helpful).',
  'total runs': 'Total number of continuous evaluation runs recorded across all experiments.',
  'self harm': 'Severity of self-harm content detected. Scale: 0 (none) to 7 (extreme). Lower is better.',
  'sexual': 'Severity of sexual content detected. Scale: 0 (none) to 7 (extreme). Lower is better.',
  'hate unfairness': 'Severity of hate speech or unfairness detected. Scale: 0 (none) to 7 (extreme). Lower is better.',
};

function getMetricDescription(label: string): string | undefined {
  return METRIC_DESCRIPTIONS[label.toLowerCase()];
}

/* ─── Shared ────────────────────────────────────────────────── */
function SummaryCard({ label, value, color = '', description }: { label: string; value: string; color?: string; description?: string }) {
  const tip = description ?? getMetricDescription(label);
  return (
    <div className="bg-white rounded-xl border p-4 relative group">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tip && (
          <span className="relative">
            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-56 p-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 leading-relaxed pointer-events-none">
              {tip}
            </span>
          </span>
        )}
      </div>
      <p className={`text-xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
