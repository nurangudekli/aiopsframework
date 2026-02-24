import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  evaluatePair,
  getFoundrySdkStatus,
  runFoundryEval,
  runFoundryNlp,
  runFoundryContentSafety,
  runFoundryDatasetEval,
  runFoundrySimulation,
} from '../api/client';
import type {
  EvaluationResult,
  FoundryEvalResult,
  FoundryNlpResult,
  FoundryContentSafetyResult,
  FoundrySdkStatus,
  DatasetEvalResult,
  SimulationResult,
} from '../types';
import { BarChart3, AlertCircle, CheckCircle2, Info, Upload, Play, Shield, FlaskConical, Database, Bot } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockEvaluationResult } from '../mocks';
import DeploymentSelect from '../components/DeploymentSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

/* ─── Tab definitions ───────────────────────────────────────── */
const TABS = [
  { id: 'compare', label: 'A/B Compare', icon: FlaskConical },
  { id: 'quality', label: 'AI Quality', icon: BarChart3 },
  { id: 'nlp', label: 'NLP Metrics', icon: Database },
  { id: 'safety', label: 'Content Safety', icon: Shield },
  { id: 'dataset', label: 'Dataset Eval', icon: Upload },
  { id: 'simulator', label: 'Simulator', icon: Bot },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ─── Main Component ────────────────────────────────────────── */
export default function EvaluationPage() {
  const { useMock, toggleMock } = useMockToggle('evaluation');
  const [activeTab, setActiveTab] = useState<TabId>('compare');

  /* SDK status query */
  const sdkStatus = useQuery<FoundrySdkStatus>({
    queryKey: ['foundry-sdk-status'],
    queryFn: getFoundrySdkStatus,
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
        <BarChart3 size={24} /> Evaluation Engine
      </h1>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 text-sm">
          Full Azure AI Evaluation SDK integration — quality, NLP, safety, batch dataset & adversarial simulation.
        </p>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>

      {/* SDK status banner */}
      {sdkStatus.data && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${sdkStatus.data.sdk_available ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {sdkStatus.data.sdk_available ? <CheckCircle2 size={14} /> : <Info size={14} />}
          {sdkStatus.data.note}
        </div>
      )}

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

      {/* Tab content */}
      {activeTab === 'compare' && <CompareTab useMock={useMock} />}
      {activeTab === 'quality' && <QualityTab />}
      {activeTab === 'nlp' && <NlpTab />}
      {activeTab === 'safety' && <SafetyTab sdkStatus={sdkStatus.data} />}
      {activeTab === 'dataset' && <DatasetTab sdkStatus={sdkStatus.data} />}
      {activeTab === 'simulator' && <SimulatorTab sdkStatus={sdkStatus.data} />}
    </div>
  );
}

/* ─── A/B Compare Tab (existing) ────────────────────────────── */
function CompareTab({ useMock }: { useMock: boolean }) {
  const [form, setForm] = useState({ question: '', response_a: '', response_b: '', reference_answer: '' });
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const evalMut = useMutation({
    mutationFn: () => (useMock ? Promise.resolve(mockEvaluationResult) : evaluatePair(form)),
    onSuccess: (data) => setResult(data),
  });

  const verdictColor = (v: string) =>
    v === 'similar' ? 'text-green-600 bg-green-50' : v === 'needs_review' ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';

  return (
    <>
      <PageBanner
        title="How to use A/B Compare"
        description="Paste two model responses and an optional reference to get automated quality metrics and a verdict."
        accentColor="indigo"
        steps={[
          { label: 'Enter a question', detail: 'The prompt that both responses were generated from.' },
          { label: 'Paste Response A & B', detail: 'Current model (A) and candidate model (B) outputs.' },
          { label: 'Add reference (optional)', detail: 'Gold-standard answer for more accurate scoring.' },
          { label: 'Click Evaluate', detail: 'Returns Semantic Similarity, BLEU, ROUGE-L, Coherence and verdict.' },
        ]}
        tips={['Verdict: similar (green), needs_review (yellow), or different (red).']}
      />

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, question: c.question, reference_answer: c.expected_answer || form.reference_answer })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={5} placeholder="Response A (current model)" value={form.response_a} onChange={(e) => setForm({ ...form, response_a: e.target.value })} />
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={5} placeholder="Response B (new model)" value={form.response_b} onChange={(e) => setForm({ ...form, response_b: e.target.value })} />
          </div>
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Reference answer (optional)" value={form.reference_answer} onChange={(e) => setForm({ ...form, reference_answer: e.target.value })} />
          <button onClick={() => evalMut.mutate()} disabled={evalMut.isPending || !form.response_a || !form.response_b} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {evalMut.isPending ? 'Evaluating…' : 'Evaluate'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <MetricCard label="Semantic Similarity" value={`${(result.semantic_similarity * 100).toFixed(1)}%`} />
            <MetricCard label="BLEU Score" value={result.bleu_score?.toFixed(4) ?? '—'} />
            <MetricCard label="ROUGE-L Score" value={result.rouge_l_score?.toFixed(4) ?? '—'} />
            <MetricCard label="Coherence A" value={result.coherence_score_a?.toFixed(4) ?? '—'} />
            <MetricCard label="Coherence B" value={result.coherence_score_b?.toFixed(4) ?? '—'} />
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Verdict</p>
              <span className={`text-lg font-bold px-2 py-0.5 rounded ${verdictColor(result.verdict)}`}>{result.verdict}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── AI Quality Tab ────────────────────────────────────────── */
function QualityTab() {
  const [form, setForm] = useState({ query: '', response: '', context: '', ground_truth: '' });
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [judgeDeployment, setJudgeDeployment] = useState('');
  const [result, setResult] = useState<FoundryEvalResult | null>(null);
  const [error, setError] = useState('');

  const allMetrics = ['coherence', 'fluency', 'relevance', 'groundedness', 'similarity', 'retrieval'];

  const toggleMetric = (m: string) => setSelectedMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const mut = useMutation({
    mutationFn: () => runFoundryEval({ ...form, metrics: selectedMetrics.length ? selectedMetrics : undefined, judge_deployment: judgeDeployment || undefined }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-sm font-semibold mb-3">AI-Assisted Quality Evaluation (LLM-as-Judge)</h3>
        <div className="space-y-3">
          <DeploymentSelect
            label="Judge Model Deployment"
            value={judgeDeployment}
            onChange={setJudgeDeployment}
            placeholder="Select judge model deployment…"
          />
          <div className="flex items-center gap-2">
            <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Query / prompt" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
            <PromptLibraryPicker onSelect={(s) => setForm({ ...form, query: s.content })} />
            <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, query: c.question, ground_truth: c.expected_answer || form.ground_truth, context: c.context || form.context })} />
          </div>
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Context (for groundedness / retrieval)" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Ground truth (for similarity)" value={form.ground_truth} onChange={(e) => setForm({ ...form, ground_truth: e.target.value })} />

          <div>
            <p className="text-xs text-gray-500 mb-1">Metrics (leave empty for all)</p>
            <div className="flex flex-wrap gap-2">
              {allMetrics.map((m) => (
                <button key={m} onClick={() => toggleMetric(m)} className={`px-3 py-1 text-xs rounded-full border ${selectedMetrics.includes(m) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {mut.isPending ? 'Running…' : 'Run Quality Evaluation'}
          </button>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3">Quality Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(result).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
              const val = v as { score: number; method: string };
              return <MetricCard key={k} label={k.replace(/_/g, ' ')} value={val.score?.toFixed(3) ?? '—'} sub={val.method} />;
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">SDK available: {result._sdk_available ? 'Yes' : 'No (heuristic fallback)'}</p>
        </div>
      )}
    </>
  );
}

/* ─── NLP Metrics Tab ───────────────────────────────────────── */
function NlpTab() {
  const [form, setForm] = useState({ response: '', ground_truth: '' });
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [result, setResult] = useState<FoundryNlpResult | null>(null);
  const [error, setError] = useState('');

  const allMetrics = ['f1_score', 'bleu_score', 'rouge_score', 'gleu_score', 'meteor_score'];
  const toggleMetric = (m: string) => setSelectedMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const mut = useMutation({
    mutationFn: () => runFoundryNlp({ ...form, metrics: selectedMetrics.length ? selectedMetrics : undefined }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-sm font-semibold mb-1">NLP Metrics (No LLM Required)</h3>
        <p className="text-xs text-gray-500 mb-3">Compute F1, BLEU, ROUGE, GLEU, and METEOR scores by comparing a response against ground truth.</p>
        <div className="space-y-3">
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
          <div className="flex items-center gap-2">
            <textarea className="flex-1 px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Ground truth *" value={form.ground_truth} onChange={(e) => setForm({ ...form, ground_truth: e.target.value })} />
            <GoldenDatasetPicker className="self-start mt-1" onSelectCase={(c) => setForm({ ...form, ground_truth: c.expected_answer || '' })} />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Metrics (leave empty for all)</p>
            <div className="flex flex-wrap gap-2">
              {allMetrics.map((m) => (
                <button key={m} onClick={() => toggleMetric(m)} className={`px-3 py-1 text-xs rounded-full border ${selectedMetrics.includes(m) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response || !form.ground_truth} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mut.isPending ? 'Computing…' : 'Compute NLP Metrics'}
          </button>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3">NLP Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(result).filter(([k]) => !k.startsWith('_')).map(([k, v]) => {
              const val = v as { result: Record<string, number>; method: string };
              const primary = val.result ? Object.values(val.result)[0] : undefined;
              return (
                <div key={k} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">{k.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold text-gray-900">{primary !== undefined ? primary.toFixed(4) : '—'}</p>
                  {val.result && Object.keys(val.result).length > 1 && (
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(val.result).map(([rk, rv]) => (
                        <p key={rk} className="text-[10px] text-gray-400">{rk}: {(rv as number).toFixed(4)}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{val.method}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Content Safety Tab ────────────────────────────────────── */
function SafetyTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [form, setForm] = useState({ query: '', response: '' });
  const [includeAdvanced, setIncludeAdvanced] = useState(false);
  const [result, setResult] = useState<FoundryContentSafetyResult | null>(null);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => runFoundryContentSafety({ ...form, include_advanced: includeAdvanced }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const safetyColor = (score: number) => (score <= 1 ? 'text-green-700 bg-green-50' : score <= 3 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50');

  return (
    <>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-sm font-semibold mb-1">Content Safety Evaluation</h3>
        <p className="text-xs text-gray-500 mb-3">Evaluate content for violence, sexual, hate/unfairness, self-harm risks. Optionally include indirect attack and protected material detection.</p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Query / prompt (optional)" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
            <PromptLibraryPicker onSelect={(s) => setForm({ ...form, query: s.content })} />
            <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, query: c.question })} />
          </div>
          <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeAdvanced} onChange={() => setIncludeAdvanced(!includeAdvanced)} className="rounded border-gray-300" />
            <span className="text-gray-600">Include advanced evaluators (Indirect Attack, Protected Material)</span>
            {sdkStatus && !sdkStatus.advanced_safety && <span className="text-[10px] text-yellow-600">(fallback mode)</span>}
          </label>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
            {mut.isPending ? 'Scanning…' : 'Run Safety Check'}
          </button>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3">Safety Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['violence', 'sexual', 'hate_unfairness', 'self_harm', 'indirect_attack', 'protected_material'].map((k) => {
              const val = (result as Record<string, { score: number; method: string }>)[k];
              if (!val) return null;
              return (
                <div key={k} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">{k.replace(/_/g, ' ')}</p>
                  <p className={`text-lg font-bold px-2 py-0.5 rounded inline-block ${safetyColor(val.score)}`}>{val.score}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{val.method}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Scores: 0–1 = safe, 2–3 = low risk, 4–5 = medium, 6–7 = high risk</p>
        </div>
      )}
    </>
  );
}

/* ─── Dataset Evaluation Tab ────────────────────────────────── */
function DatasetTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [jsonText, setJsonText] = useState('');
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>([]);
  const [judgeDeployment, setJudgeDeployment] = useState('');
  const [result, setResult] = useState<DatasetEvalResult | null>(null);
  const [error, setError] = useState('');

  const allEvaluators = [
    ...(sdkStatus?.available_evaluators?.ai_quality ?? ['coherence', 'fluency', 'relevance', 'groundedness', 'similarity', 'retrieval']),
    ...(sdkStatus?.available_evaluators?.nlp ?? ['f1_score', 'bleu_score', 'rouge_score', 'gleu_score', 'meteor_score']),
    ...(sdkStatus?.available_evaluators?.safety ?? ['violence', 'sexual', 'hate_unfairness', 'self_harm']),
  ];

  const toggleEval = (e: string) => setSelectedEvaluators((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const mut = useMutation({
    mutationFn: () => {
      let data: Array<Record<string, string>>;
      try {
        data = JSON.parse(jsonText);
        if (!Array.isArray(data)) throw new Error('Not an array');
      } catch {
        throw new Error('Invalid JSON – provide an array of objects e.g. [{"query":"...", "response":"..."}]');
      }
      return runFoundryDatasetEval({ data, evaluators: selectedEvaluators, judge_deployment: judgeDeployment || undefined });
    },
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const sampleData = JSON.stringify(
    [
      { query: 'What is Azure?', response: 'Azure is Microsoft cloud platform.', ground_truth: 'Azure is Microsoft\'s cloud computing platform.' },
      { query: 'What is GPT?', response: 'GPT is a language model by OpenAI.', ground_truth: 'GPT is a generative pre-trained transformer by OpenAI.' },
    ],
    null,
    2,
  );

  return (
    <>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-sm font-semibold mb-1">Batch Dataset Evaluation</h3>
        <p className="text-xs text-gray-500 mb-3">Evaluate a dataset of query/response pairs with multiple evaluators. Uses the SDK <code>evaluate()</code> API when available.</p>
        <div className="space-y-3">
          <DeploymentSelect
            label="Judge Model Deployment"
            value={judgeDeployment}
            onChange={setJudgeDeployment}
            placeholder="Select judge model deployment…"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">Dataset (JSON array)</p>
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

          <div>
            <p className="text-xs text-gray-500 mb-1">Evaluators</p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {allEvaluators.map((e) => (
                <button key={e} onClick={() => toggleEval(e)} className={`px-3 py-1 text-xs rounded-full border ${selectedEvaluators.includes(e) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {e.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => mut.mutate()} disabled={mut.isPending || !jsonText || !selectedEvaluators.length} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {mut.isPending ? 'Evaluating dataset…' : 'Evaluate Dataset'}
          </button>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3">Dataset Results</h3>
          {result.error && <p className="text-sm text-red-600 mb-3">{result.error}</p>}

          {/* Aggregate metrics */}
          {result.metrics && Object.keys(result.metrics).length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Aggregate Metrics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.metrics).map(([k, v]) => (
                  <MetricCard key={k} label={k.replace(/_/g, ' ').replace(/\./g, ' ')} value={(v as number).toFixed(4)} />
                ))}
              </div>
            </div>
          )}

          {/* Row-level results table */}
          {result.rows && result.rows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs text-gray-500 mb-2">Row-Level Results ({result.rows.length} rows)</p>
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left">#</th>
                    {Object.keys(result.rows[0]).map((col) => (
                      <th key={col} className="border px-2 py-1 text-left max-w-[200px] truncate">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border px-2 py-1">{i + 1}</td>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="border px-2 py-1 max-w-[200px] truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-3">Method: {result.method}</p>
        </div>
      )}
    </>
  );
}

/* ─── Simulator Tab ─────────────────────────────────────────── */
function SimulatorTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [scenario, setScenario] = useState('adversarial_qa');
  const [targetDeployment, setTargetDeployment] = useState('');
  const [maxTurns, setMaxTurns] = useState(1);
  const [maxResults, setMaxResults] = useState(5);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState('');

  const scenarios = sdkStatus?.available_evaluators?.simulator ?? ['adversarial_qa', 'adversarial_conversation', 'adversarial_summarization', 'adversarial_rewrite', 'adversarial_content_gen_ungrounded'];

  const mut = useMutation({
    mutationFn: () => runFoundrySimulation({ scenario, max_conversation_turns: maxTurns, max_simulation_results: maxResults, target_endpoint: targetDeployment || undefined }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="text-sm font-semibold mb-1">Adversarial Simulator</h3>
        <p className="text-xs text-gray-500 mb-3">Generate adversarial test prompts to stress-test your model's safety. Uses the SDK AdversarialSimulator when available, otherwise synthetic fallback.</p>
        <div className="space-y-3">
          <DeploymentSelect
            label="Target Model Deployment"
            value={targetDeployment}
            onChange={setTargetDeployment}
            placeholder="Select target deployment to test…"
          />
          <div>
            <label className="text-xs text-gray-500">Scenario</label>
            <select className="w-full px-3 py-2 border rounded-lg text-sm mt-1" value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {scenarios.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Max conversation turns</label>
              <input type="number" min={1} max={10} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max simulated results</label>
              <input type="number" min={1} max={50} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
            </div>
          </div>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {mut.isPending ? 'Simulating…' : 'Run Simulation'}
          </button>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold mb-3">Simulation Results — {result.scenario.replace(/_/g, ' ')}</h3>
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
            <span>Generated: <b>{result.count}</b> conversations</span>
            <span>Method: <b>{result.method}</b></span>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {result.conversations.map((conv, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Prompt #{i + 1}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{typeof conv === 'string' ? conv : JSON.stringify(conv, null, 2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Shared Components ─────────────────────────────────────── */
function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
