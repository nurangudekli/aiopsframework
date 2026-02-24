import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExperiment, submitFeedback } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockExperimentDetail } from '../mocks';

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { useMock, toggleMock } = useMockToggle('ab-testing');

  const { data: liveExperiment, isLoading } = useQuery({
    queryKey: ['experiment', id],
    queryFn: () => getExperiment(id!),
    enabled: !!id && !useMock,
  });
  const experiment = useMock ? mockExperimentDetail : liveExperiment;

  const feedbackMut = useMutation({
    mutationFn: ({ resultId, preference }: { resultId: string; preference: string }) =>
      submitFeedback(id!, resultId, preference),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiment', id] }),
  });

  if (isLoading && !useMock) return <div className="text-gray-400">Loading experiment…</div>;
  if (!experiment) return <div className="text-red-500">Experiment not found.</div>;

  const summary = experiment.summary;

  // Chart data for latency comparison
  const latencyData = experiment.results.map((r) => ({
    question: `Q${r.question_index + 1}`,
    'Model A (ms)': r.model_a_latency_ms ?? 0,
    'Model B (ms)': r.model_b_latency_ms ?? 0,
  }));

  // Chart data for similarity
  const simData = experiment.results.map((r) => ({
    question: `Q${r.question_index + 1}`,
    similarity: r.semantic_similarity ? +(r.semantic_similarity * 100).toFixed(1) : 0,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">{experiment.name}</h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-500 text-sm mb-6">
        {experiment.model_a_deployment} vs {experiment.model_b_deployment} &middot; {experiment.status}
      </p>

      <PageBanner
        title="Understanding Experiment Results"
        description="This page shows the full results of an A/B experiment — charts, per-question comparisons, and human feedback controls."
        accentColor="purple"
        steps={[
          { label: 'Review summary cards', detail: 'Average semantic similarity, per-model latency averages, and total cost are shown at the top.' },
          { label: 'Analyse charts', detail: 'Latency Comparison chart shows Model A vs B per question; Similarity chart shows how alike the responses are.' },
          { label: 'Compare responses', detail: 'Scroll down to see each question with both model answers side-by-side and a similarity badge.' },
          { label: 'Submit human feedback', detail: 'Click Model A, Model B, or Tie to record your preference — this is tracked for ranking.' },
        ]}
        tips={[
          'Green similarity badges (≥80%) mean the models agree; red (<60%) means they diverge significantly.',
          'Human feedback is saved immediately and updates the experiment record.',
        ]}
      />

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Avg Similarity" value={summary.avg_semantic_similarity != null ? `${(summary.avg_semantic_similarity * 100).toFixed(1)}%` : '—'} />
          <SummaryCard label="Avg Latency A" value={summary.avg_model_a_latency_ms != null ? `${summary.avg_model_a_latency_ms.toFixed(0)} ms` : '—'} />
          <SummaryCard label="Avg Latency B" value={summary.avg_model_b_latency_ms != null ? `${summary.avg_model_b_latency_ms.toFixed(0)} ms` : '—'} />
          <SummaryCard label="Total Cost" value={`$${((summary.total_model_a_cost_usd ?? 0) + (summary.total_model_b_cost_usd ?? 0)).toFixed(4)}`} />
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Latency Comparison (ms)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="question" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Model A (ms)" fill="#6366f1" />
              <Bar dataKey="Model B (ms)" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold mb-3">Semantic Similarity (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={simData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="question" fontSize={12} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip />
              <Bar dataKey="similarity" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Side-by-Side Results ── */}
      <h2 className="text-lg font-semibold mb-4">Side-by-Side Responses</h2>
      <div className="space-y-6">
        {experiment.results.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between">
              <div>
                <span className="font-medium">Q{r.question_index + 1}:</span>{' '}
                <span className="text-gray-700">{r.question_text}</span>
              </div>
              <div className="flex items-center gap-3">
                {r.semantic_similarity != null && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.semantic_similarity >= 0.9 ? 'bg-green-100 text-green-700' : r.semantic_similarity >= 0.7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {(r.semantic_similarity * 100).toFixed(1)}% similar
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              {/* Model A */}
              <div className="p-4">
                <div className="text-xs font-semibold text-indigo-600 mb-2">
                  Model A &middot; {r.model_a_latency_ms?.toFixed(0)} ms
                  {r.model_a_cost_usd != null && ` · $${r.model_a_cost_usd.toFixed(4)}`}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.model_a_response}</p>
              </div>
              {/* Model B */}
              <div className="p-4">
                <div className="text-xs font-semibold text-amber-600 mb-2">
                  Model B &middot; {r.model_b_latency_ms?.toFixed(0)} ms
                  {r.model_b_cost_usd != null && ` · $${r.model_b_cost_usd.toFixed(4)}`}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.model_b_response}</p>
              </div>
            </div>
            {/* Human feedback */}
            <div className="bg-gray-50 px-6 py-3 border-t flex items-center gap-3">
              <span className="text-xs text-gray-500">Preference:</span>
              {['A', 'B', 'tie'].map((p) => (
                <button
                  key={p}
                  onClick={() => feedbackMut.mutate({ resultId: r.id, preference: p })}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    r.human_preference === p
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {p === 'tie' ? 'Tie' : `Model ${p}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
