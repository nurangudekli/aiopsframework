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
import {
  BarChart3, AlertCircle, CheckCircle2, Info, Upload, Play, Shield,
  FlaskConical, Database, Bot, ArrowRight, ChevronRight, ChevronLeft, Loader2,
} from 'lucide-react';
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

/* ─── A/B Compare Tab — 3 step wizard ───────────────────────── */
function CompareTab({ useMock }: { useMock: boolean }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ question: '', response_a: '', response_b: '', reference_answer: '' });
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const evalMut = useMutation({
    mutationFn: () => (useMock ? Promise.resolve(mockEvaluationResult) : evaluatePair(form)),
    onSuccess: (data) => { setResult(data); },
  });

  const verdictColor = (v: string) =>
    v === 'similar' ? 'text-green-600 bg-green-50' : v === 'needs_review' ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';

  const step1Done = !!form.question.trim();
  const step2Done = !!form.response_a.trim() && !!form.response_b.trim();

  const STEPS = [
    { id: 1, title: 'Enter Question', icon: FlaskConical },
    { id: 2, title: 'Paste Responses', icon: BarChart3 },
    { id: 3, title: 'Evaluate', icon: Play },
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
          <StepBadge step={1} title="Enter Question" />
          <p className="text-xs text-gray-500 mb-3">The prompt that both model responses were generated from.</p>
          <div className="flex items-center gap-2">
            <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Question *" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, question: c.question, reference_answer: c.expected_answer || form.reference_answer })} />
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Responses</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Paste Responses & Reference" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> Question: "{form.question.slice(0, 60)}{form.question.length > 60 ? '…' : ''}"
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={5} placeholder="Response A (current model) *" value={form.response_a} onChange={(e) => setForm({ ...form, response_a: e.target.value })} />
              <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={5} placeholder="Response B (new model) *" value={form.response_b} onChange={(e) => setForm({ ...form, response_b: e.target.value })} />
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Reference answer (optional)" value={form.reference_answer} onChange={(e) => setForm({ ...form, reference_answer: e.target.value })} />
          </div>
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Evaluate</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={3} title="Evaluate" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Question</span><span className="text-gray-700 truncate block">{form.question}</span></div>
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs"><span className="text-blue-400 block mb-0.5">Response A</span><span className="text-gray-700 truncate block">{form.response_a.slice(0, 50)}…</span></div>
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-100 text-xs"><span className="text-purple-400 block mb-0.5">Response B</span><span className="text-gray-700 truncate block">{form.response_b.slice(0, 50)}…</span></div>
            </div>
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => evalMut.mutate()} disabled={evalMut.isPending || !form.response_a || !form.response_b} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {evalMut.isPending ? <><Loader2 size={16} className="animate-spin" /> Evaluating…</> : <><Play size={16} /> Evaluate</>}
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
        </div>
      )}
    </>
  );
}

/* ─── AI Quality Tab — 3 step wizard ────────────────────────── */
function QualityTab() {
  const [step, setStep] = useState(1);
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

  const step1Done = !!judgeDeployment;
  const step2Done = !!form.response.trim();

  const STEPS = [
    { id: 1, title: 'Select Judge', icon: BarChart3 },
    { id: 2, title: 'Enter Content', icon: Database },
    { id: 3, title: 'Metrics & Run', icon: Play },
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
          <StepBadge step={1} title="Select Judge Model" />
          <p className="text-xs text-gray-500 mb-4">Choose the LLM deployment that will act as the evaluation judge (LLM-as-Judge).</p>
          <DeploymentSelect label="Judge Model Deployment *" value={judgeDeployment} onChange={setJudgeDeployment} placeholder="Select judge model deployment…" />
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Content</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Enter Content" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> Judge: <span className="font-mono">{judgeDeployment}</span>
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Query / prompt" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
              <PromptLibraryPicker onSelect={(s) => setForm({ ...form, query: s.content })} />
              <GoldenDatasetPicker onSelectCase={(c) => setForm({ ...form, query: c.question, ground_truth: c.expected_answer || form.ground_truth, context: c.context || form.context })} />
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Context (for groundedness / retrieval)" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Ground truth (for similarity)" value={form.ground_truth} onChange={(e) => setForm({ ...form, ground_truth: e.target.value })} />
          </div>
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Metrics</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={3} title="Select Metrics & Run" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Judge</span><span className="font-mono">{judgeDeployment}</span></div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Response</span><span className="truncate block">{form.response.slice(0, 60)}…</span></div>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Metrics (leave empty for all)</p>
              <div className="flex flex-wrap gap-2">
                {allMetrics.map((m) => (
                  <button key={m} onClick={() => toggleMetric(m)} className={`px-3 py-1 text-xs rounded-full border ${selectedMetrics.includes(m) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={14} /> {error}</p>}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Running…</> : <><Play size={16} /> Run Quality Evaluation</>}
              </button>
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
        </div>
      )}
    </>
  );
}

/* ─── NLP Metrics Tab — 2 step wizard ───────────────────────── */
function NlpTab() {
  const [step, setStep] = useState(1);
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

  const step1Done = !!form.response.trim() && !!form.ground_truth.trim();

  const STEPS = [
    { id: 1, title: 'Enter Content', icon: Database },
    { id: 2, title: 'Metrics & Run', icon: Play },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : !!result;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-blue-400 bg-blue-50 text-blue-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-blue-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
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
          <StepBadge step={1} title="Enter Response & Ground Truth" />
          <p className="text-xs text-gray-500 mb-3">Compute F1, BLEU, ROUGE, GLEU, and METEOR scores — no LLM required.</p>
          <div className="space-y-3">
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Model response *" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
            <div className="flex items-center gap-2">
              <textarea className="flex-1 px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Ground truth *" value={form.ground_truth} onChange={(e) => setForm({ ...form, ground_truth: e.target.value })} />
              <GoldenDatasetPicker className="self-start mt-1" onSelectCase={(c) => setForm({ ...form, ground_truth: c.expected_answer || '' })} />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"><span>Next: Metrics</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={2} title="Select Metrics & Run" />
            <div className="p-2 mb-4 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 flex items-center gap-2">
              <CheckCircle2 size={12} /> Response ({form.response.length} chars) vs Ground Truth ({form.ground_truth.length} chars)
              <button onClick={() => setStep(1)} className="ml-auto text-blue-500 hover:underline text-[11px]">Edit</button>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Metrics (leave empty for all)</p>
              <div className="flex flex-wrap gap-2">
                {allMetrics.map((m) => (
                  <button key={m} onClick={() => toggleMetric(m)} className={`px-3 py-1 text-xs rounded-full border ${selectedMetrics.includes(m) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {m.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={14} /> {error}</p>}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response || !form.ground_truth} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Computing…</> : <><Play size={16} /> Compute NLP Metrics</>}
              </button>
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
        </div>
      )}
    </>
  );
}

/* ─── Content Safety Tab — 2 step wizard ────────────────────── */
function SafetyTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ query: '', response: '' });
  const [includeAdvanced, setIncludeAdvanced] = useState(false);
  const [result, setResult] = useState<FoundryContentSafetyResult | null>(null);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => runFoundryContentSafety({ ...form, include_advanced: includeAdvanced }),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const step1Done = !!form.response.trim();
  const safetyColor = (score: number) => (score <= 1 ? 'text-green-700 bg-green-50' : score <= 3 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50');

  const STEPS = [
    { id: 1, title: 'Enter Content', icon: Shield },
    { id: 2, title: 'Scan & Review', icon: Play },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : !!result;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-red-400 bg-red-50 text-red-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-red-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
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
          <StepBadge step={1} title="Enter Content for Safety Evaluation" />
          <p className="text-xs text-gray-500 mb-3">Evaluate content for violence, sexual, hate/unfairness, and self-harm risks.</p>
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
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"><span>Next: Scan</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={2} title="Scan & Review Results" />
            <div className="p-2 mb-4 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 flex items-center gap-2">
              <CheckCircle2 size={12} /> Response: "{form.response.slice(0, 80)}{form.response.length > 80 ? '…' : ''}"
              <button onClick={() => setStep(1)} className="ml-auto text-red-500 hover:underline text-[11px]">Edit</button>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={14} /> {error}</p>}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.response} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Scanning…</> : <><Play size={16} /> Run Safety Check</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-3">Safety Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['violence', 'sexual', 'hate_unfairness', 'self_harm', 'indirect_attack', 'protected_material'].map((k) => {
                  const val = (result as unknown as Record<string, { score: number; method: string }>)[k];
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
        </div>
      )}
    </>
  );
}

/* ─── Dataset Evaluation Tab — 3 step wizard ────────────────── */
function DatasetTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [step, setStep] = useState(1);
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

  const step1Done = !!judgeDeployment;
  const step2Done = !!jsonText.trim();

  const STEPS = [
    { id: 1, title: 'Select Judge', icon: BarChart3 },
    { id: 2, title: 'Load Dataset', icon: Database },
    { id: 3, title: 'Evaluators & Run', icon: Play },
  ];

  return (
    <>
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
          <StepBadge step={1} title="Select Judge Model" />
          <p className="text-xs text-gray-500 mb-4">Choose the LLM deployment for AI-quality evaluators. NLP and safety evaluators don't require a judge.</p>
          <DeploymentSelect label="Judge Model Deployment" value={judgeDeployment} onChange={setJudgeDeployment} placeholder="Select judge model deployment…" />
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"><span>Next: Dataset</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border p-6">
          <StepBadge step={2} title="Load Dataset" />
          <div className="p-2 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 size={12} /> Judge: <span className="font-mono">{judgeDeployment}</span>
            <button onClick={() => setStep(1)} className="ml-auto text-indigo-500 hover:underline text-[11px]">Edit</button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Dataset (JSON array)</p>
              <div className="flex items-center gap-2">
                <GoldenDatasetPicker label="From Golden Dataset" onLoadDatasetJson={(json) => setJsonText(json)} />
                <button onClick={() => setJsonText(sampleData)} className="text-xs text-indigo-600 hover:underline">Load sample</button>
              </div>
            </div>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={8} placeholder='[{"query": "...", "response": "...", "ground_truth": "..."}]' value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
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
            <StepBadge step={3} title="Choose Evaluators & Run" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Judge</span><span className="font-mono">{judgeDeployment}</span></div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Dataset</span>{(() => { try { return `${JSON.parse(jsonText).length} rows`; } catch { return 'Invalid JSON'; } })()}</div>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Evaluators *</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {allEvaluators.map((e) => (
                  <button key={e} onClick={() => toggleEval(e)} className={`px-3 py-1 text-xs rounded-full border ${selectedEvaluators.includes(e) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {e.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={14} /> {error}</p>}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !jsonText || !selectedEvaluators.length} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Evaluating…</> : <><Play size={16} /> Evaluate Dataset</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-3">Dataset Results</h3>
              {result.error && <p className="text-sm text-red-600 mb-3">{result.error}</p>}

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
        </div>
      )}
    </>
  );
}

/* ─── Simulator Tab — 2 step wizard ─────────────────────────── */
function SimulatorTab({ sdkStatus }: { sdkStatus?: FoundrySdkStatus }) {
  const [step, setStep] = useState(1);
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

  const step1Done = !!targetDeployment;

  const STEPS = [
    { id: 1, title: 'Configure', icon: Bot },
    { id: 2, title: 'Run & Review', icon: Play },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Done : !!result;
          const active = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStep(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${active ? 'border-purple-400 bg-purple-50 text-purple-700' : done ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-purple-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
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
          <StepBadge step={1} title="Configure Adversarial Simulation" />
          <p className="text-xs text-gray-500 mb-4">Generate adversarial test prompts to stress-test your model's safety.</p>
          <div className="space-y-3">
            <DeploymentSelect label="Target Model Deployment *" value={targetDeployment} onChange={setTargetDeployment} placeholder="Select target deployment to test…" />
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
          </div>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setStep(2)} disabled={!step1Done} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"><span>Next: Run</span><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <StepBadge step={2} title="Run Simulation & Review" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Target</span><span className="font-mono">{targetDeployment}</span></div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Scenario</span>{scenario.replace(/_/g, ' ')}</div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Max Turns</span>{maxTurns}</div>
              <div className="p-2 bg-gray-50 rounded-lg border text-xs"><span className="text-gray-400 block mb-0.5">Max Results</span>{maxResults}</div>
            </div>
            {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={14} /> {error}</p>}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back</button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {mut.isPending ? <><Loader2 size={16} className="animate-spin" /> Simulating…</> : <><Play size={16} /> Run Simulation</>}
              </button>
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
