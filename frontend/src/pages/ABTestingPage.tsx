import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listExperiments, createExperiment, uploadExperiment } from '../api/client';
import type { ExperimentCreate } from '../types';
import { FlaskConical, Upload, Plus, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockExperiments } from '../mocks';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';

export default function ABTestingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'list' | 'create' | 'upload'>('list');
  const { useMock, toggleMock } = useMockToggle('ab-testing');

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

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: (payload: ExperimentCreate) => createExperiment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setValidationErrors([]);
      setTab('list');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Experiment failed';
      setValidationErrors([`API Error: ${msg}`]);
    },
  });

  const handleCreate = () => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Experiment name is required.');
    if (!form.model_a_deployment.trim()) errors.push('Model A deployment is required.');
    if (!form.model_b_deployment.trim()) errors.push('Model B deployment is required.');
    const questions = form.questions
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length === 0) errors.push('At least one question is required.');
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    createMut.mutate({
      name: form.name,
      description: form.description,
      model_a: { provider: form.model_a_provider, deployment: form.model_a_deployment },
      model_b: { provider: form.model_b_provider, deployment: form.model_b_deployment },
      system_message_override: form.system_message || undefined,
      questions,
    });
  };

  // -- Upload file
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    model_a_provider: 'azure_openai',
    model_a_deployment: '',
    model_b_provider: 'azure_openai',
    model_b_deployment: '',
    system_message: '',
  });

  const uploadMut = useMutation({
    mutationFn: (fd: FormData) => uploadExperiment(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setValidationErrors([]);
      setTab('list');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed';
      setValidationErrors([`API Error: ${msg}`]);
    },
  });

  const handleUpload = () => {
    const errors: string[] = [];
    if (!uploadForm.name.trim()) errors.push('Experiment name is required.');
    if (!uploadFile) errors.push('Please select a file to upload.');
    if (!uploadForm.model_a_deployment.trim()) errors.push('Model A deployment is required.');
    if (!uploadForm.model_b_deployment.trim()) errors.push('Model B deployment is required.');
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    const fd = new FormData();
    fd.append('file', uploadFile!);
    Object.entries(uploadForm).forEach(([k, v]) => fd.append(k, v));
    uploadMut.mutate(fd);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-green-500" />;
      case 'running':
        return <Clock size={16} className="text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
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
            onClick={() => setTab('create')}
            className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            <Plus size={16} /> New Test
          </button>
          <button
            onClick={() => setTab('upload')}
            className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
          >
            <Upload size={16} /> Upload File
          </button>
        </div>
      </div>

      {/* ── Create Form ── */}
      {tab === 'create' && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create A/B Experiment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="input-field" placeholder="Experiment Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input-field" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <ProviderSelect
              label="Model A Provider"
              value={form.model_a_provider}
              onChange={(v) => setForm({ ...form, model_a_provider: v })}
            />
            <DeploymentSelect
              label="Model A Deployment"
              value={form.model_a_deployment}
              onChange={(v) => setForm({ ...form, model_a_deployment: v })}
              placeholder="Select or type deployment…"
            />

            <ProviderSelect
              label="Model B Provider"
              value={form.model_b_provider}
              onChange={(v) => setForm({ ...form, model_b_provider: v })}
            />
            <DeploymentSelect
              label="Model B Deployment"
              value={form.model_b_deployment}
              onChange={(v) => setForm({ ...form, model_b_deployment: v })}
              placeholder="Select or type deployment…"
            />

            <div className="col-span-full">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">System Message (optional)</label>
                <PromptLibraryPicker onSelect={(s) => setForm({ ...form, system_message: s.system_message || s.content })} />
              </div>
              <textarea className="input-field" rows={2} placeholder="You are a helpful assistant..." value={form.system_message} onChange={(e) => setForm({ ...form, system_message: e.target.value })} />
            </div>

            <div className="col-span-full">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">Questions (one per line)</label>
                <GoldenDatasetPicker onLoadQuestions={(qs) => setForm({ ...form, questions: qs.join('\n') })} />
              </div>
              <textarea
                className="input-field"
                rows={6}
                placeholder={"What is Azure AI?\nHow does RAG work?\nExplain model fine-tuning."}
                value={form.questions}
                onChange={(e) => setForm({ ...form, questions: e.target.value })}
              />
            </div>
          </div>
          {validationErrors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  {validationErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={createMut.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {createMut.isPending ? 'Running…' : 'Run Experiment'}
            </button>
            <button onClick={() => { setTab('list'); setValidationErrors([]); }} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Upload Form ── */}
      {tab === 'upload' && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Upload Questions File</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload an Excel (.xlsx), CSV, or JSON file with a "question" column. Optional columns: expected_answer, context.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="input-field" placeholder="Experiment Name" value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">File</label>
              <input type="file" accept=".xlsx,.csv,.json" className="text-sm" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <ProviderSelect
              label="Model A Provider"
              value={uploadForm.model_a_provider}
              onChange={(v) => setUploadForm({ ...uploadForm, model_a_provider: v })}
            />
            <DeploymentSelect
              label="Model A Deployment"
              value={uploadForm.model_a_deployment}
              onChange={(v) => setUploadForm({ ...uploadForm, model_a_deployment: v })}
              placeholder="Select or type deployment…"
            />
            <ProviderSelect
              label="Model B Provider"
              value={uploadForm.model_b_provider}
              onChange={(v) => setUploadForm({ ...uploadForm, model_b_provider: v })}
            />
            <DeploymentSelect
              label="Model B Deployment"
              value={uploadForm.model_b_deployment}
              onChange={(v) => setUploadForm({ ...uploadForm, model_b_deployment: v })}
              placeholder="Select or type deployment…"
            />
          </div>
          {validationErrors.length > 0 && tab === 'upload' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  {validationErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={handleUpload} disabled={uploadMut.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {uploadMut.isPending ? 'Running…' : 'Upload & Run'}
            </button>
            <button onClick={() => { setTab('list'); setValidationErrors([]); }} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
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
          <div className="p-6 text-gray-400">No experiments yet. Create one above.</div>
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
                    <Link to={`/testing/${exp.id}`} className="text-indigo-600 font-medium hover:underline">
                      {exp.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {exp.model_a_deployment} vs {exp.model_b_deployment}
                  </td>
                  <td className="px-6 py-3 text-center">{exp.completed_questions}/{exp.total_questions}</td>
                  <td className="px-6 py-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      {statusIcon(exp.status)} {exp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{new Date(exp.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }
      `}</style>
    </div>
  );
}
