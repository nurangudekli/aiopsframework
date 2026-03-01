import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listExperiments, createExperiment, uploadExperiment } from '../api/client';
import type { ExperimentCreate } from '../types';
import {
  FlaskConical, Upload, Plus, Clock, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, ChevronLeft, Cpu, MessageSquare, Play, ArrowRight, Loader2,
} from 'lucide-react';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockExperiments } from '../mocks';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

const WIZARD_STEPS = [
  { id: 1, title: 'Name & Models', subtitle: 'Define your experiment and choose two models', icon: Cpu },
  { id: 2, title: 'Prompt & Questions', subtitle: 'Set the system message and test questions', icon: MessageSquare },
  { id: 3, title: 'Run & Results', subtitle: 'Execute the experiment and review results', icon: Play },
] as const;

export default function ABTestingPage() {
  const queryClient = useQueryClient();
  const { useMock, toggleMock } = useMockToggle('ab-testing');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual');

  // -- List experiments
  const { data: liveExperiments, isLoading } = useQuery({
    queryKey: ['experiments'],
    queryFn: listExperiments,
    enabled: !useMock,
  });
  const experiments = useMock ? mockExperiments : liveExperiments;

  // -- Create from form
  const [form, setForm] = useState({
    name: '',
    description: '',
    model_a_provider: 'azure_openai',
    model_a_deployment: '',
    model_b_provider: 'azure_openai',
    model_b_deployment: '',
    system_message: '',
    questions: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: (payload: ExperimentCreate) => createExperiment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setValidationErrors([]);
      setWizardOpen(false);
      setWizardStep(1);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Experiment failed';
      setValidationErrors([`API Error: ${msg}`]);
    },
  });

  const uploadMut = useMutation({
    mutationFn: (fd: FormData) => uploadExperiment(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setValidationErrors([]);
      setWizardOpen(false);
      setWizardStep(1);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed';
      setValidationErrors([`API Error: ${msg}`]);
    },
  });

  const handleRun = () => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Experiment name is required.');
    if (!form.model_a_deployment.trim()) errors.push('Model A deployment is required.');
    if (!form.model_b_deployment.trim()) errors.push('Model B deployment is required.');

    if (inputMode === 'upload') {
      if (!uploadFile) errors.push('Please select a file to upload.');
      if (errors.length > 0) { setValidationErrors(errors); return; }
      setValidationErrors([]);
      const fd = new FormData();
      fd.append('file', uploadFile!);
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('model_a_provider', form.model_a_provider);
      fd.append('model_a_deployment', form.model_a_deployment);
      fd.append('model_b_provider', form.model_b_provider);
      fd.append('model_b_deployment', form.model_b_deployment);
      fd.append('system_message', form.system_message);
      uploadMut.mutate(fd);
    } else {
      const questions = form.questions.split('\n').map((q) => q.trim()).filter(Boolean);
      if (questions.length === 0) errors.push('At least one question is required.');
      if (errors.length > 0) { setValidationErrors(errors); return; }
      setValidationErrors([]);
      createMut.mutate({
        name: form.name,
        description: form.description,
        model_a: { provider: form.model_a_provider, deployment: form.model_a_deployment },
        model_b: { provider: form.model_b_provider, deployment: form.model_b_deployment },
        system_message_override: form.system_message || undefined,
        questions,
      });
    }
  };

  const step1Complete = !!(form.name && form.model_a_deployment && form.model_b_deployment);
  const step2Complete = inputMode === 'upload' ? !!uploadFile : form.questions.split('\n').filter(Boolean).length > 0;
  const isRunning = createMut.isPending || uploadMut.isPending;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'running': return <Clock size={16} className="text-yellow-500 animate-spin" />;
      case 'failed': return <XCircle size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical size={24} /> A/B Model Testing
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Compare models side-by-side with semantic similarity, latency, and cost metrics.
          </p>
        </div>
        <div className="flex gap-2">
          <MockToggle enabled={useMock} onToggle={toggleMock} />
          <button
            onClick={() => { setWizardOpen(true); setWizardStep(1); setValidationErrors([]); }}
            className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            <Plus size={16} /> New Experiment
          </button>
        </div>
      </div>

      {/* ═══ Wizard ═══ */}
      {wizardOpen && (
        <div className="mb-6">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-6">
            {WIZARD_STEPS.map((s, idx) => {
              const done = s.id === 1 ? step1Complete : s.id === 2 ? step2Complete : false;
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

          {/* Step 1: Name & Models */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Cpu size={18} className="text-indigo-600" /> Step 1: Name & Models</h2>
              <p className="text-sm text-gray-500 mb-5">Give your experiment a name and select two models to compare.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Experiment Name *</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. GPT-4o vs GPT-4.1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="What are you testing?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="md:col-span-2"><p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Model A (Baseline)</p></div>
                  <ProviderSelect label="Provider" value={form.model_a_provider} onChange={(v) => setForm({ ...form, model_a_provider: v })} />
                  <DeploymentSelect label="Deployment" value={form.model_a_deployment} onChange={(v) => setForm({ ...form, model_a_deployment: v })} placeholder="Select deployment…" />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="md:col-span-2"><p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Model B (Challenger)</p></div>
                  <ProviderSelect label="Provider" value={form.model_b_provider} onChange={(v) => setForm({ ...form, model_b_provider: v })} />
                  <DeploymentSelect label="Deployment" value={form.model_b_deployment} onChange={(v) => setForm({ ...form, model_b_deployment: v })} placeholder="Select deployment…" />
                </div>
              </div>
              <div className="flex justify-between mt-6 pt-4 border-t">
                <button onClick={() => { setWizardOpen(false); setValidationErrors([]); }} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><XCircle size={16} /> Cancel</button>
                <button onClick={() => setWizardStep(2)} disabled={!step1Complete} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Questions <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step 2: Prompt & Questions */}
          {wizardStep === 2 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><MessageSquare size={18} className="text-indigo-600" /> Step 2: Prompt & Questions</h2>
              <p className="text-sm text-gray-500 mb-4">Set the system message and provide the questions both models will answer.</p>

              {/* Summary of step 1 */}
              <div className="p-3 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
                <CheckCircle2 size={14} /> <span className="font-medium">{form.name}</span>: {form.model_a_deployment} vs {form.model_b_deployment}
                <button onClick={() => setWizardStep(1)} className="ml-auto text-indigo-500 hover:underline">Edit</button>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">System Message (optional)</label>
                  <PromptLibraryPicker onSelect={(s) => setForm({ ...form, system_message: s.system_message || s.content })} />
                </div>
                <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="You are a helpful assistant..." value={form.system_message} onChange={(e) => setForm({ ...form, system_message: e.target.value })} />
              </div>

              {/* Input mode toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setInputMode('manual')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${inputMode === 'manual' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <MessageSquare size={14} /> Type Questions
                </button>
                <button onClick={() => setInputMode('upload')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${inputMode === 'upload' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <Upload size={14} /> Upload File
                </button>
              </div>

              {inputMode === 'manual' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500">Questions (one per line)</label>
                    <GoldenDatasetPicker onLoadQuestions={(qs) => setForm({ ...form, questions: qs.join('\n') })} />
                  </div>
                  <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={6} placeholder={"What is Azure AI?\nHow does RAG work?\nExplain model fine-tuning."} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
                  <p className="text-[11px] text-gray-400 mt-1">{form.questions.split('\n').filter(Boolean).length} question(s)</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Upload an Excel (.xlsx), CSV, or JSON file with a "question" column.</p>
                  <input type="file" accept=".xlsx,.csv,.json" className="text-sm" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  {uploadFile && <p className="text-xs text-green-600 mt-1">Selected: {uploadFile.name}</p>}
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t">
                <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Models</button>
                <button onClick={() => setWizardStep(3)} disabled={!step2Complete} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Run <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Run */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Play size={18} className="text-indigo-600" /> Step 3: Review & Run</h2>
              <p className="text-sm text-gray-500 mb-5">Review your configuration, then run the experiment.</p>

              {/* Config summary */}
              <div className="space-y-3 mb-5">
                <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Experiment</p>
                  <p className="font-semibold">{form.name}</p>
                  {form.description && <p className="text-gray-500 text-xs">{form.description}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Model A (Baseline)</p>
                    <p className="font-mono text-sm">{form.model_a_deployment}</p>
                    <p className="text-xs text-gray-500">{form.model_a_provider}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                    <p className="text-xs font-bold text-purple-600 uppercase mb-1">Model B (Challenger)</p>
                    <p className="font-mono text-sm">{form.model_b_deployment}</p>
                    <p className="text-xs text-gray-500">{form.model_b_provider}</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Questions</p>
                  {inputMode === 'upload' ? (
                    <p className="text-gray-700">File: {uploadFile?.name}</p>
                  ) : (
                    <p className="text-gray-700">{form.questions.split('\n').filter(Boolean).length} question(s)</p>
                  )}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700">{validationErrors.map((e, i) => <p key={i}>{e}</p>)}</div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t">
                <button onClick={() => setWizardStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Questions</button>
                <button onClick={handleRun} disabled={isRunning} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                  {isRunning ? <><Loader2 size={16} className="animate-spin" /> Running…</> : <><Play size={16} /> Run Experiment</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Experiments List ── */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Experiments</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400">Loading…</div>
        ) : !experiments?.length ? (
          <div className="p-12 text-center">
            <FlaskConical size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">No experiments yet.</p>
            <button onClick={() => { setWizardOpen(true); setWizardStep(1); }} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Create Your First Experiment
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Models</th>
                <th className="px-6 py-3 text-center">Questions</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/testing/${exp.id}`} className="text-indigo-600 font-medium hover:underline">{exp.name}</Link>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{exp.model_a_deployment} vs {exp.model_b_deployment}</td>
                  <td className="px-6 py-3 text-center">{exp.completed_questions}/{exp.total_questions}</td>
                  <td className="px-6 py-3 text-center"><span className="inline-flex items-center gap-1">{statusIcon(exp.status)} {exp.status}</span></td>
                  <td className="px-6 py-3 text-gray-500">{new Date(exp.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
