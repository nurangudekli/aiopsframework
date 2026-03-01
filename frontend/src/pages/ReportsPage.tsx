import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileBarChart,
  GitCompare,
  Gauge,
  Shield,
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import {
  listExperiments,
  getExperiment,
  listPerformanceRuns,
  getCostSummary,
  listContinuousEvalRuns,
  listEvalAlerts,
} from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6'];

type ReportTab = 'overview' | 'experiments' | 'performance' | 'evaluations' | 'cost';

const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: FileBarChart },
  { key: 'experiments', label: 'A/B Tests', icon: GitCompare },
  { key: 'performance', label: 'Performance', icon: Gauge },
  { key: 'evaluations', label: 'Evaluations', icon: BarChart3 },
  { key: 'cost', label: 'Cost', icon: DollarSign },
];

/* ── Download helpers ── */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, any>[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const keys = columns ?? Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r => keys.map(k => {
    const v = r[k];
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  return header + '\n' + body;
}

function exportData(data: any, filename: string, format: 'csv' | 'json') {
  if (format === 'json') {
    downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
  } else {
    const rows = Array.isArray(data) ? data : [data];
    downloadFile(toCsv(rows), `${filename}.csv`, 'text/csv');
  }
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // ── Data queries ──
  const { data: experiments, isLoading: expLoading } = useQuery({ queryKey: ['rpt-experiments'], queryFn: listExperiments, retry: 1 });
  const { data: perfRuns, isLoading: perfLoading } = useQuery({ queryKey: ['rpt-perf'], queryFn: () => listPerformanceRuns(50), retry: 1 });
  const { data: costData, isLoading: costLoading } = useQuery({ queryKey: ['rpt-cost'], queryFn: () => getCostSummary(30), retry: 1 });
  const { data: evalRuns, isLoading: evalLoading } = useQuery({ queryKey: ['rpt-eval'], queryFn: () => listContinuousEvalRuns(undefined, 50), retry: 1 });
  const { data: evalAlerts } = useQuery({ queryKey: ['rpt-alerts'], queryFn: () => listEvalAlerts(undefined, 20), retry: 1 });

  const isLoading = expLoading || perfLoading || costLoading || evalLoading;

  // Compute summary numbers
  const experimentCount = experiments?.length ?? 0;
  const completedExperiments = experiments?.filter((e: any) => e.status === 'completed')?.length ?? 0;
  const perfRunCount = Array.isArray(perfRuns) ? perfRuns.length : 0;
  const evalRunCount = Array.isArray(evalRuns) ? evalRuns.length : 0;
  const totalCost = costData?.total_cost_usd ?? 0;
  const totalTokens = costData?.total_tokens ?? 0;
  const totalRequests = costData?.total_requests ?? 0;
  const alertCount = Array.isArray(evalAlerts) ? evalAlerts.length : 0;

  // ── Export handlers ──
  const handleExport = (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (activeTab === 'overview') {
      const overviewData = {
        generated_at: new Date().toISOString(),
        experiments: experimentCount,
        completed_experiments: completedExperiments,
        performance_runs: perfRunCount,
        evaluation_runs: evalRunCount,
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
        total_requests: totalRequests,
        alerts: alertCount,
      };
      exportData(overviewData, `genai-overview-${timestamp}`, format);
    } else if (activeTab === 'experiments') {
      exportData(experiments ?? [], `genai-experiments-${timestamp}`, format);
    } else if (activeTab === 'performance') {
      exportData(perfRuns ?? [], `genai-performance-${timestamp}`, format);
    } else if (activeTab === 'evaluations') {
      exportData(evalRuns ?? [], `genai-evaluations-${timestamp}`, format);
    } else if (activeTab === 'cost') {
      exportData(costData ?? {}, `genai-cost-${timestamp}`, format);
    }
  };

  const handleExportAll = (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    const timestamp = new Date().toISOString().slice(0, 10);
    const fullReport = {
      generated_at: new Date().toISOString(),
      summary: {
        experiments: experimentCount,
        completed_experiments: completedExperiments,
        performance_runs: perfRunCount,
        evaluation_runs: evalRunCount,
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
        total_requests: totalRequests,
        alerts: alertCount,
      },
      experiments: experiments ?? [],
      performance_runs: perfRuns ?? [],
      evaluation_runs: evalRuns ?? [],
      cost_data: costData ?? {},
    };
    exportData(fullReport, `genai-full-report-${timestamp}`, format);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart size={24} /> Results & Reports
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Consolidated view of all your testing, evaluation, and monitoring results. Download reports as CSV or JSON.
          </p>
        </div>
        {/* Export button */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download size={16} /> Download Report
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-20 py-2">
                <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Current Tab ({tabs.find(t => t.key === activeTab)?.label})</p>
                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download size={14} /> Export as CSV
                </button>
                <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download size={14} /> Export as JSON
                </button>
                <div className="border-t border-gray-100 my-1" />
                <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Full Report Bundle</p>
                <button onClick={() => handleExportAll('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download size={14} /> Export All as CSV
                </button>
                <button onClick={() => handleExportAll('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Download size={14} /> Export All as JSON
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading report data…
        </div>
      )}

      {!isLoading && activeTab === 'overview' && (
        <OverviewTab
          experimentCount={experimentCount}
          completedExperiments={completedExperiments}
          perfRunCount={perfRunCount}
          evalRunCount={evalRunCount}
          totalCost={totalCost}
          totalTokens={totalTokens}
          totalRequests={totalRequests}
          alertCount={alertCount}
          experiments={experiments}
          perfRuns={perfRuns}
          costData={costData}
          onExport={handleExport}
        />
      )}

      {!isLoading && activeTab === 'experiments' && (
        <ExperimentsTab experiments={experiments} onExport={handleExport} />
      )}

      {!isLoading && activeTab === 'performance' && (
        <PerformanceTab perfRuns={perfRuns} onExport={handleExport} />
      )}

      {!isLoading && activeTab === 'evaluations' && (
        <EvaluationsTab evalRuns={evalRuns} alertCount={alertCount} onExport={handleExport} />
      )}

      {!isLoading && activeTab === 'cost' && (
        <CostTab costData={costData} onExport={handleExport} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  OVERVIEW TAB                                             */
/* ══════════════════════════════════════════════════════════ */
function OverviewTab({
  experimentCount, completedExperiments, perfRunCount, evalRunCount,
  totalCost, totalTokens, totalRequests, alertCount,
  experiments, perfRuns, costData, onExport,
}: any) {
  return (
    <div className="space-y-6">
      {/* Quick export bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-indigo-600" />
          <span className="text-sm text-indigo-800 font-medium">Download this overview as a file</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onExport('csv')} className="px-3 py-1.5 text-xs font-medium bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition">CSV</button>
          <button onClick={() => onExport('json')} className="px-3 py-1.5 text-xs font-medium bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition">JSON</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={GitCompare} label="A/B Experiments" value={experimentCount} sub={`${completedExperiments} completed`} color="text-indigo-500" />
        <SummaryCard icon={Gauge} label="Performance Tests" value={perfRunCount} sub="runs recorded" color="text-orange-500" />
        <SummaryCard icon={BarChart3} label="Evaluation Runs" value={evalRunCount} sub={alertCount > 0 ? `${alertCount} alerts` : 'no alerts'} color="text-blue-500" />
        <SummaryCard icon={DollarSign} label="Total Cost (30d)" value={`$${totalCost.toFixed(4)}`} sub={`${totalTokens.toLocaleString()} tokens`} color="text-emerald-500" />
      </div>

      {/* Scorecard: pass rates */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Test Health Scorecard</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScoreItem label="A/B Tests Completed" current={completedExperiments} total={experimentCount} />
          <ScoreItem label="Performance Runs" current={perfRunCount} total={perfRunCount} />
          <ScoreItem label="Evaluation Runs" current={evalRunCount} total={evalRunCount} />
        </div>
      </div>

      {/* Recent experiments quick view */}
      {experiments && experiments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Latest A/B Experiments</h3>
          <div className="space-y-3">
            {experiments.slice(-5).reverse().map((exp: any) => (
              <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <StatusBadge status={exp.status} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{exp.name}</p>
                    <p className="text-xs text-gray-500">
                      {exp.model_a_deployment} vs {exp.model_b_deployment} · {exp.completed_questions}/{exp.total_questions} questions
                    </p>
                  </div>
                </div>
                <Link to={`/testing/${exp.id}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  Details <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost trend chart */}
      {costData?.daily_breakdown && costData.daily_breakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Daily Cost Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={costData.daily_breakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="cost_usd" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* No data CTA */}
      {experimentCount === 0 && perfRunCount === 0 && evalRunCount === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Clock size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-700 mb-1">No results yet</h3>
          <p className="text-sm text-gray-500 mb-4">Run some tests or evaluations to see your reports here.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            Back to Home <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  EXPERIMENTS TAB                                          */
/* ══════════════════════════════════════════════════════════ */
function ExperimentsTab({ experiments, onExport }: { experiments?: any[]; onExport: (f: 'csv' | 'json') => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ['rpt-exp-detail', expandedId],
    queryFn: () => getExperiment(expandedId!),
    enabled: !!expandedId,
  });

  if (!experiments || experiments.length === 0) {
    return <EmptyState message="No A/B experiments found. Run one from the Testing page." linkTo="/testing" linkLabel="Go to Testing" />;
  }

  return (
    <div className="space-y-4">
      <TabExportBar label="A/B experiments" onExport={onExport} />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Experiment</th>
              <th className="px-4 py-3 text-left">Model A</th>
              <th className="px-4 py-3 text-left">Model B</th>
              <th className="px-4 py-3 text-center">Questions</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Date</th>
              <th className="px-4 py-3 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {experiments.map((exp: any) => (
              <React.Fragment key={exp.id}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{exp.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{exp.model_a_deployment}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{exp.model_b_deployment}</td>
                  <td className="px-4 py-3 text-center">{exp.completed_questions}/{exp.total_questions}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={exp.status} /></td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {expandedId === exp.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </td>
                </tr>
                {expandedId === exp.id && detail && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 bg-indigo-50">
                      <ExperimentDetailInline detail={detail} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExperimentDetailInline({ detail }: { detail: any }) {
  const summary = detail.summary;
  if (!summary) return <p className="text-sm text-gray-500">No summary available.</p>;

  const chartData = [
    { name: 'Model A Wins', value: summary.model_a_wins ?? 0 },
    { name: 'Model B Wins', value: summary.model_b_wins ?? 0 },
    { name: 'Ties', value: summary.ties ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Summary Metrics</h4>
        <div className="grid grid-cols-2 gap-3">
          <MiniCard label="Avg Similarity" value={summary.avg_semantic_similarity?.toFixed(3) ?? '-'} />
          <MiniCard label="Avg Latency A" value={summary.avg_model_a_latency_ms ? `${summary.avg_model_a_latency_ms.toFixed(0)}ms` : '-'} />
          <MiniCard label="Avg Latency B" value={summary.avg_model_b_latency_ms ? `${summary.avg_model_b_latency_ms.toFixed(0)}ms` : '-'} />
          <MiniCard label="Total Cost A" value={summary.total_model_a_cost_usd ? `$${summary.total_model_a_cost_usd.toFixed(4)}` : '-'} />
          <MiniCard label="Total Cost B" value={summary.total_model_b_cost_usd ? `$${summary.total_model_b_cost_usd.toFixed(4)}` : '-'} />
          <MiniCard label="Questions" value={summary.total_questions ?? 0} />
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Win Distribution</h4>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend fontSize={11} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  PERFORMANCE TAB                                          */
/* ══════════════════════════════════════════════════════════ */
function PerformanceTab({ perfRuns, onExport }: { perfRuns?: any[]; onExport: (f: 'csv' | 'json') => void }) {
  const runs = Array.isArray(perfRuns) ? perfRuns : [];

  if (runs.length === 0) {
    return <EmptyState message="No performance test runs recorded. Run one from the Monitoring page." linkTo="/monitoring" linkLabel="Go to Monitoring" />;
  }

  const chartData = runs.slice(0, 20).map((r: any, i: number) => ({
    name: r.deployment || `Run ${i + 1}`,
    avgLatency: r.avg_latency_ms ?? 0,
    p99Latency: r.p99_latency_ms ?? 0,
    rps: r.requests_per_second ?? 0,
  }));

  return (
    <div className="space-y-6">
      <TabExportBar label="performance runs" onExport={onExport} />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Latency Comparison</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} label={{ value: 'ms', position: 'insideLeft', fontSize: 10 }} />
            <Tooltip />
            <Legend fontSize={11} />
            <Bar dataKey="avgLatency" name="Avg Latency (ms)" fill="#6366f1" />
            <Bar dataKey="p99Latency" name="P99 Latency (ms)" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Deployment</th>
              <th className="px-4 py-3 text-right">Requests</th>
              <th className="px-4 py-3 text-right">Success</th>
              <th className="px-4 py-3 text-right">Avg Latency</th>
              <th className="px-4 py-3 text-right">P99</th>
              <th className="px-4 py-3 text-right">RPS</th>
              <th className="px-4 py-3 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {runs.map((r: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 text-xs">{r.deployment || `Run ${i + 1}`}</td>
                <td className="px-4 py-3 text-right font-mono">{r.total_requests ?? '-'}</td>
                <td className="px-4 py-3 text-right font-mono">{r.successful_requests ?? '-'}</td>
                <td className="px-4 py-3 text-right font-mono">{r.avg_latency_ms?.toFixed(0) ?? '-'}ms</td>
                <td className="px-4 py-3 text-right font-mono">{r.p99_latency_ms?.toFixed(0) ?? '-'}ms</td>
                <td className="px-4 py-3 text-right font-mono">{r.requests_per_second?.toFixed(1) ?? '-'}</td>
                <td className="px-4 py-3 text-right font-mono">{r.total_cost_usd != null ? `$${r.total_cost_usd.toFixed(4)}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  EVALUATIONS TAB                                          */
/* ══════════════════════════════════════════════════════════ */
function EvaluationsTab({ evalRuns, alertCount, onExport }: { evalRuns?: any[]; alertCount: number; onExport: (f: 'csv' | 'json') => void }) {
  const runs = Array.isArray(evalRuns) ? evalRuns : [];

  if (runs.length === 0) {
    return <EmptyState message="No evaluation runs found. Run evaluations from the Evaluation page." linkTo="/evaluation" linkLabel="Go to Evaluation" />;
  }

  return (
    <div className="space-y-6">
      <TabExportBar label="evaluation runs" onExport={onExport} />
      {alertCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong>{alertCount}</strong> evaluation alert{alertCount !== 1 ? 's' : ''} detected. Check the Evaluation page for details.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Run Name</th>
              <th className="px-4 py-3 text-left">Deployment</th>
              <th className="px-4 py-3 text-center">Evaluators</th>
              <th className="px-4 py-3 text-center">Rows</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {runs.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">{r.deployment || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {(r.evaluators || []).slice(0, 3).map((ev: string) => (
                      <span key={ev} className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">{ev}</span>
                    ))}
                    {(r.evaluators || []).length > 3 && <span className="text-xs text-gray-400">+{r.evaluators.length - 3}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-mono">{r.total_rows ?? '-'}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={r.status ?? 'completed'} /></td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  COST TAB                                                 */
/* ══════════════════════════════════════════════════════════ */
function CostTab({ costData, onExport }: { costData?: any; onExport: (f: 'csv' | 'json') => void }) {
  if (!costData || costData.total_requests === 0) {
    return <EmptyState message="No cost data available yet. Run some tests to generate cost data." linkTo="/" linkLabel="Back to Home" />;
  }

  return (
    <div className="space-y-6">
      <TabExportBar label="cost data" onExport={onExport} />
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon={DollarSign} label="Total Cost" value={`$${costData.total_cost_usd?.toFixed(4) ?? '0'}`} sub="last 30 days" color="text-emerald-500" />
        <SummaryCard icon={TrendingUp} label="Total Tokens" value={costData.total_tokens?.toLocaleString() ?? '0'} sub="consumed" color="text-blue-500" />
        <SummaryCard icon={Gauge} label="Total Requests" value={costData.total_requests?.toLocaleString() ?? '0'} sub="API calls" color="text-indigo-500" />
      </div>

      {costData.daily_breakdown && costData.daily_breakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Daily Cost Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={costData.daily_breakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="cost_usd" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {costData.by_deployment && costData.by_deployment.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Cost by Deployment</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={costData.by_deployment}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="deployment" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend fontSize={11} />
              <Bar dataKey="cost_usd" name="Cost (USD)" fill="#6366f1" />
              <Bar dataKey="requests" name="Requests" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  Shared sub-components                                    */
/* ══════════════════════════════════════════════════════════ */

function TabExportBar({ label, onExport }: { label: string; onExport: (f: 'csv' | 'json') => void }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
      <div className="flex items-center gap-2">
        <Download size={16} className="text-indigo-600" />
        <span className="text-sm text-indigo-800 font-medium">Download {label}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onExport('csv')} className="px-3 py-1.5 text-xs font-medium bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition">CSV</button>
        <button onClick={() => onExport('json')} className="px-3 py-1.5 text-xs font-medium bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition">JSON</button>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={color} />
        <span className="text-xs text-gray-500 uppercase font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function ScoreItem({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-sm font-bold text-gray-900">{current}/{total}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'completed' || s === 'done') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium"><CheckCircle2 size={12} /> Completed</span>;
  }
  if (s === 'running' || s === 'in_progress') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium"><RefreshCw size={12} className="animate-spin" /> Running</span>;
  }
  if (s === 'failed' || s === 'error') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium"><XCircle size={12} /> Failed</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{status}</span>;
}

function EmptyState({ message, linkTo, linkLabel }: { message: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
      <Clock size={40} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <Link to={linkTo} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
        {linkLabel} <ArrowRight size={16} />
      </Link>
    </div>
  );
}
