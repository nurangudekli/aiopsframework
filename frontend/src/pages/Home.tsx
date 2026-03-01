import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  FlaskConical,
  BarChart3,
  FileBarChart,
  ArrowRight,
  CheckCircle2,
  Circle,
  Key,
  MessageSquare,
  Database,
  Gauge,
  Shield,
  GitCompare,
  AlertTriangle,
  Clock,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { listEndpoints, listPrompts, listGoldenDatasets, listExperiments, listPerformanceRuns, getCostSummary } from '../api/client';

/* ────────────────────────────────────────────────────────── */
/*  Pipeline — 3 grouped stages                              */
/* ────────────────────────────────────────────────────────── */
interface PipelineStage {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  route: string;
}

const stages: PipelineStage[] = [
  { id: 1, title: 'Setup', subtitle: 'Configure endpoints, prompts & golden datasets', icon: Settings, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', route: '/configuration' },
  { id: 2, title: 'Test & Evaluate', subtitle: 'Run A/B tests, benchmarks & quality evaluations', icon: FlaskConical, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300', route: '/testing' },
  { id: 3, title: 'Report', subtitle: 'View consolidated results & download reports', icon: FileBarChart, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', route: '/reports' },
];

/* ────────────────────────────────────────────────────────── */
/*  Quick Action groups                                       */
/* ────────────────────────────────────────────────────────── */
interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  to: string;
  color: string;
}

interface ActionGroup {
  heading: string;
  stageColor: string;
  actions: QuickAction[];
}

const actionGroups: ActionGroup[] = [
  {
    heading: 'Setup',
    stageColor: 'border-emerald-300',
    actions: [
      { label: 'Register Endpoint', description: 'Add a model endpoint URL + API key', icon: Key, to: '/configuration?tab=endpoints', color: 'bg-emerald-100 text-emerald-700' },
      { label: 'Manage Prompts', description: 'Create or pick prompt templates', icon: MessageSquare, to: '/configuration?tab=prompts', color: 'bg-emerald-100 text-emerald-700' },
      { label: 'Golden Datasets', description: 'Upload test cases with expected answers', icon: Database, to: '/configuration?tab=datasets', color: 'bg-emerald-100 text-emerald-700' },
    ],
  },
  {
    heading: 'Test & Evaluate',
    stageColor: 'border-indigo-300',
    actions: [
      { label: 'A/B Test', description: 'Compare two models side-by-side', icon: GitCompare, to: '/testing', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Performance Test', description: 'Stress-test latency & throughput', icon: Gauge, to: '/monitoring', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Security Scan', description: 'Check for threats & PII', icon: Shield, to: '/monitoring?tab=security', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Quality Evaluation', description: 'Run AI quality & NLP metrics', icon: BarChart3, to: '/evaluation', color: 'bg-blue-100 text-blue-700' },
    ],
  },
  {
    heading: 'Report',
    stageColor: 'border-amber-300',
    actions: [
      { label: 'View Results', description: 'See consolidated results & trends', icon: FileBarChart, to: '/reports', color: 'bg-amber-100 text-amber-700' },
      { label: 'Download Reports', description: 'Export results as CSV or JSON', icon: TrendingUp, to: '/reports', color: 'bg-amber-100 text-amber-700' },
    ],
  },
];

/* ────────────────────────────────────────────────────────── */
/*  Main Component                                            */
/* ────────────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();

  // ── Live status queries ──
  const { data: endpoints } = useQuery({ queryKey: ['endpoints-status'], queryFn: () => listEndpoints(true), retry: 1 });
  const { data: prompts } = useQuery({ queryKey: ['prompts-status'], queryFn: () => listPrompts(true), retry: 1 });
  const { data: datasets } = useQuery({ queryKey: ['datasets-status'], queryFn: () => listGoldenDatasets(), retry: 1 });
  const { data: experiments } = useQuery({ queryKey: ['experiments-status'], queryFn: () => listExperiments(), retry: 1 });
  const { data: perfRuns } = useQuery({ queryKey: ['perf-runs-status'], queryFn: () => listPerformanceRuns(5), retry: 1 });
  const { data: costData } = useQuery({ queryKey: ['cost-status'], queryFn: () => getCostSummary(30), retry: 1 });

  // ── Compute stage completion ──
  const endpointCount = endpoints?.length ?? 0;
  const promptCount = prompts?.length ?? 0;
  const datasetCount = datasets?.length ?? 0;
  const experimentCount = experiments?.length ?? 0;
  const perfRunCount = Array.isArray(perfRuns) ? perfRuns.length : 0;

  const setupDone = endpointCount > 0;
  const testsDone = experimentCount > 0 || perfRunCount > 0;
  const reportReady = testsDone;

  const stageStatus = [setupDone, testsDone, reportReady];

  // Current suggested step (0-based, max 3 = all done)
  const suggestedStage = !setupDone ? 0 : !testsDone ? 1 : 2;

  return (
    <div className="space-y-8">
      {/* ── Hero ── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to GenAI Ops Framework</h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Follow the pipeline below to <strong>set up</strong> your environment,
          <strong> test & evaluate</strong> your models, then <strong>review reports</strong>.
        </p>
      </div>

      {/* ── Pipeline (3 stages) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Your Pipeline</h2>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {stages.map((stage, idx) => {
            const done = stageStatus[idx];
            const isCurrent = idx === suggestedStage;
            return (
              <React.Fragment key={stage.id}>
                {idx > 0 && (
                  <div className="hidden md:flex items-center">
                    <div className={`w-12 h-0.5 ${stageStatus[idx - 1] ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                    <ArrowRight size={16} className={stageStatus[idx - 1] ? 'text-emerald-400' : 'text-gray-300'} />
                  </div>
                )}
                <button
                  onClick={() => navigate(stage.route)}
                  className={`flex-1 min-w-[180px] rounded-xl border-2 p-5 text-left transition-all hover:shadow-md cursor-pointer ${
                    isCurrent
                      ? `${stage.borderColor} ${stage.bgColor}`
                      : done
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${done ? 'bg-emerald-100' : stage.bgColor}`}>
                      {done ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : isCurrent ? (
                        <stage.icon size={20} className={stage.color} />
                      ) : (
                        <Circle size={20} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">STEP {stage.id}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">NEXT</span>
                        )}
                      </div>
                      <h3 className={`text-lg font-bold ${done ? 'text-emerald-700' : stage.color}`}>{stage.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{stage.subtitle}</p>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Live Status Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard icon={Key} label="Endpoints" value={endpointCount} ok={endpointCount > 0} href="/configuration?tab=endpoints" />
        <StatusCard icon={MessageSquare} label="Prompts" value={promptCount} ok={promptCount > 0} href="/configuration?tab=prompts" />
        <StatusCard icon={Database} label="Golden Datasets" value={datasetCount} ok={datasetCount > 0} href="/configuration?tab=datasets" />
        <StatusCard icon={FlaskConical} label="Experiments" value={experimentCount} ok={experimentCount > 0} href="/testing" />
      </div>

      {/* ── Suggested Next Action ── */}
      {suggestedStage < 3 && (
        <div className={`rounded-xl border-2 ${stages[suggestedStage].borderColor} ${stages[suggestedStage].bgColor} p-5`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${stages[suggestedStage].bgColor}`}>
              <Zap size={24} className={stages[suggestedStage].color} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">
                {suggestedStage === 0 && 'Get Started — Register Your First Endpoint'}
                {suggestedStage === 1 && 'Ready to Test — Run Your First Experiment'}
                {suggestedStage === 2 && 'View Reports — See Your Results'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {suggestedStage === 0 && 'Add your Azure OpenAI (or other provider) endpoint URL and API key. Every test and evaluation relies on registered endpoints.'}
                {suggestedStage === 1 && 'Your setup is ready! Compare models with A/B testing, run performance benchmarks, security scans, or quality evaluations.'}
                {suggestedStage === 2 && 'Tests are complete. View aggregated results, performance trends, cost breakdowns, and download your reports.'}
              </p>
              <Link
                to={stages[suggestedStage].route}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to {stages[suggestedStage].title} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Grouped Quick Actions ── */}
      <div className="space-y-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h2>
        {actionGroups.map((group) => (
          <div key={group.heading}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>{group.heading}</span>
              <div className={`flex-1 h-px border-t ${group.stageColor}`} />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.actions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="group flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all"
                >
                  <div className={`p-2 rounded-lg ${action.color} flex-shrink-0`}>
                    <action.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{action.label}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</h2>
          <Link to="/reports" className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
            View all reports <ArrowRight size={12} />
          </Link>
        </div>
        <RecentActivity experiments={experiments} perfRuns={perfRuns} costData={costData} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Sub-components                                            */
/* ────────────────────────────────────────────────────────── */

function StatusCard({ icon: Icon, label, value, ok, href }: { icon: React.ElementType; label: string; value: number; ok: boolean; href: string }) {
  return (
    <Link to={href} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={ok ? 'text-emerald-500' : 'text-gray-400'} />
        {ok ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Link>
  );
}

function RecentActivity({ experiments, perfRuns, costData }: { experiments?: any[]; perfRuns?: any[]; costData?: any }) {
  const items: Array<{ icon: React.ElementType; color: string; text: string; detail: string; time?: string }> = [];

  if (experiments && experiments.length > 0) {
    const latest = experiments[experiments.length - 1];
    items.push({
      icon: GitCompare, color: 'text-indigo-500',
      text: `A/B Experiment: ${latest.name}`,
      detail: `${latest.completed_questions}/${latest.total_questions} questions · ${latest.status}`,
      time: latest.created_at ? new Date(latest.created_at).toLocaleDateString() : undefined,
    });
  }

  if (perfRuns && Array.isArray(perfRuns) && perfRuns.length > 0) {
    const latest = perfRuns[0];
    items.push({
      icon: Gauge, color: 'text-orange-500',
      text: `Performance Test: ${latest.deployment || 'Load Test'}`,
      detail: `${latest.total_requests ?? '?'} requests · ${latest.avg_latency_ms ? latest.avg_latency_ms.toFixed(0) + 'ms avg' : ''}`,
      time: latest.created_at ? new Date(latest.created_at).toLocaleDateString() : undefined,
    });
  }

  if (costData && costData.total_requests > 0) {
    items.push({
      icon: TrendingUp, color: 'text-emerald-500',
      text: 'Cost Summary (30 days)',
      detail: `$${costData.total_cost_usd?.toFixed(4) ?? '0'} · ${costData.total_tokens?.toLocaleString() ?? 0} tokens · ${costData.total_requests?.toLocaleString() ?? 0} requests`,
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Clock size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet. Start by registering an endpoint and running your first test.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
          <item.icon size={18} className={item.color} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{item.text}</p>
            <p className="text-xs text-gray-500">{item.detail}</p>
          </div>
          {item.time && <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>}
        </div>
      ))}
    </div>
  );
}
