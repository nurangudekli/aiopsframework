import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ingestRAGDocuments, queryRAG, clearRAGStore, uploadRAGFile, scrapeRAGUrl, getRAGStats } from '../api/client';
import type { RAGQueryResult } from '../types';
import {
  Database, Upload, Search, Trash2, FileText, Zap, Globe, BarChart3,
  Settings, ChevronRight, ChevronLeft, CheckCircle2, Circle, Loader2,
  BookOpen, Cpu, MessageSquare, ArrowRight, Sparkles,
} from 'lucide-react';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';
import DataSourceImporter from '../components/DataSourceImporter';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockRAGIngestResult, mockRAGQueryResult, mockRAGDocuments } from '../mocks';

const CHUNK_SIZES = [128, 256, 512, 1024, 2048, 4096];
const CHUNK_OVERLAPS = [0, 16, 32, 64, 128, 256];
const TOP_K_OPTIONS = [1, 3, 5, 10, 20, 50];
const INGEST_TABS = ['text', 'file', 'url', 'environment'] as const;
type IngestTab = typeof INGEST_TABS[number];

const STEPS = [
  { id: 1, title: 'Build Knowledge Base', subtitle: 'Add documents to the vector store', icon: BookOpen, color: 'teal' },
  { id: 2, title: 'Configure Model & Retrieval', subtitle: 'Choose the AI model and tune parameters', icon: Cpu, color: 'indigo' },
  { id: 3, title: 'Ask & Analyze', subtitle: 'Query your knowledge base and review answers', icon: MessageSquare, color: 'purple' },
] as const;

export default function RAGPipelinePage() {
  const { useMock, toggleMock } = useMockToggle('rag');
  const [step, setStep] = useState(1);

  // ── Ingest state ──
  const [ingestTab, setIngestTab] = useState<IngestTab>('text');
  const [docText, setDocText] = useState('');
  const [docId, setDocId] = useState('doc-1');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [ingestResult, setIngestResult] = useState<Record<string, unknown> | null>(null);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileDocId, setFileDocId] = useState('');

  // URL scraping state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [urlDocId, setUrlDocId] = useState('');

  // ── Query state ──
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState('azure_openai');
  const [deployment, setDeployment] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [topK, setTopK] = useState(5);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [queryResult, setQueryResult] = useState<RAGQueryResult | null>(null);

  // ── Store stats ──
  const statsQuery = useQuery({
    queryKey: ['rag-stats'],
    queryFn: getRAGStats,
    refetchInterval: 10_000,
    enabled: !useMock,
  });

  const ingestMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockRAGIngestResult);
      return ingestRAGDocuments(
        [{ id: docId, text: docText }],
        chunkSize,
        chunkOverlap,
      );
    },
    onSuccess: (data) => { setIngestResult(data as unknown as Record<string, unknown>); statsQuery.refetch(); },
  });

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error('No file selected');
      return uploadRAGFile(uploadFile, fileDocId || undefined, chunkSize, chunkOverlap);
    },
    onSuccess: (data) => { setIngestResult(data as unknown as Record<string, unknown>); setUploadFile(null); statsQuery.refetch(); },
  });

  const scrapeMut = useMutation({
    mutationFn: () => scrapeRAGUrl(scrapeUrl, urlDocId || undefined, chunkSize, chunkOverlap),
    onSuccess: (data) => { setIngestResult(data as Record<string, unknown>); statsQuery.refetch(); },
  });

  const queryMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockRAGQueryResult);
      return queryRAG(question, provider, deployment, topK, systemMessage || undefined, temperature, maxTokens);
    },
    onSuccess: (data) => setQueryResult(data as RAGQueryResult),
  });

  const clearMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve({ status: 'cleared' });
      return clearRAGStore();
    },
    onSuccess: () => {
      setIngestResult(null);
      setQueryResult(null);
      statsQuery.refetch();
    },
  });

  const stats = statsQuery.data as Record<string, unknown> | undefined;
  const hasKnowledge = !!(stats && Number(stats.total_chunks) > 0) || !!ingestResult;
  const hasModel = !!deployment;

  const stepComplete = (s: number) => {
    if (s === 1) return hasKnowledge;
    if (s === 2) return hasModel;
    if (s === 3) return !!queryResult;
    return false;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database size={24} /> RAG Pipeline
        </h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Build a grounded Q&A system in three steps — add knowledge, configure a model, then ask questions.
      </p>

      {/* ── Stepper ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const done = stepComplete(s.id);
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-1 border-2 text-left
                    ${active
                      ? 'border-teal-500 bg-teal-50 shadow-sm'
                      : done
                        ? 'border-green-200 bg-green-50 hover:border-green-300'
                        : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    ${active
                      ? 'bg-teal-600 text-white'
                      : done
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'}`}
                  >
                    {done && !active ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        active ? 'text-teal-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                        Step {s.id}
                      </span>
                      {done && <CheckCircle2 size={12} className="text-green-500" />}
                    </div>
                    <p className={`text-sm font-semibold truncate ${active ? 'text-gray-900' : 'text-gray-700'}`}>{s.title}</p>
                    <p className="text-[11px] text-gray-400 truncate hidden md:block">{s.subtitle}</p>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <ArrowRight size={20} className={`mx-2 flex-shrink-0 ${stepComplete(s.id) ? 'text-green-400' : 'text-gray-300'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Vector Store Stats Bar (always visible) ── */}
      {stats && (stats as Record<string, unknown>).total_chunks !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Documents', value: String(stats.total_documents), icon: FileText, color: 'text-blue-500' },
            { label: 'Chunks', value: String(stats.total_chunks), icon: Database, color: 'text-teal-500' },
            { label: 'Characters', value: Number(stats.total_characters).toLocaleString(), icon: BarChart3, color: 'text-purple-500' },
            { label: 'Chunk Size', value: `${stats.chunk_size} / ${stats.chunk_overlap}`, icon: Settings, color: 'text-gray-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-lg border p-4 flex items-center gap-3">
              <Icon size={20} className={color} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           STEP 1 — Build Knowledge Base
         ══════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="bg-white rounded-xl border p-6 mb-6 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen size={18} className="text-teal-600" /> Step 1: Build Your Knowledge Base
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Add documents that the AI will use to answer questions. You can add more at any time.
              </p>
            </div>
            <button
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 size={14} /> Clear Store
            </button>
          </div>

          {/* Ingest source picker */}
          <div className="flex gap-1 border-b mb-4 mt-4">
            {[
              { id: 'text' as IngestTab, label: 'Paste Text', icon: FileText, hint: 'Copy-paste content directly' },
              { id: 'file' as IngestTab, label: 'Upload File', icon: Upload, hint: 'PDF, DOCX, TXT, CSV…' },
              { id: 'url' as IngestTab, label: 'Scrape URL', icon: Globe, hint: 'Fetch from a webpage' },
              { id: 'environment' as IngestTab, label: 'Environment', icon: Database, hint: 'Log Analytics, Cosmos DB…' },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setIngestTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition
                  ${ingestTab === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Chunking controls */}
          {ingestTab !== 'environment' && (
            <div className="p-3 bg-gray-50 rounded-lg mb-4 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Settings size={12} /> Chunking Configuration</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chunk Size</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))}>
                    {CHUNK_SIZES.map((s) => <option key={s} value={s}>{s} tokens</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chunk Overlap</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={chunkOverlap} onChange={(e) => setChunkOverlap(Number(e.target.value))}>
                    {CHUNK_OVERLAPS.map((o) => <option key={o} value={o}>{o} tokens</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <p className="text-[11px] text-gray-400 leading-snug">
                    Smaller chunks = more precise retrieval. Larger chunks = more context per hit. Overlap prevents information from being split across chunk boundaries.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Paste Text */}
          {ingestTab === 'text' && (
            <div>
              <div className="flex gap-4 mb-3">
                <div className="w-48">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document ID</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="doc-1" />
                </div>
                <div className="flex items-end">
                  <PromptLibraryPicker label="Load from Prompt Library" onSelect={(p) => setDocText(p.content)} />
                </div>
              </div>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={6}
                placeholder="Paste document text here — this will be chunked, embedded, and stored in the vector store…"
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />
              {useMock && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Quick-load sample documents:</p>
                  <div className="flex gap-2 flex-wrap">
                    {mockRAGDocuments.map((d) => (
                      <button key={d.id} onClick={() => { setDocId(d.id); setDocText(d.text); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                        {d.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => ingestMut.mutate()}
                disabled={ingestMut.isPending || !docText.trim()}
                className="mt-3 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
              >
                {ingestMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Ingesting…</> : <><Upload size={14} /> Ingest Text</>}
              </button>
            </div>
          )}

          {/* Tab: Upload File */}
          {ingestTab === 'file' && (
            <div>
              <div className="flex gap-4 mb-3">
                <div className="w-48">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document ID <span className="text-gray-400">(optional)</span></label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" value={fileDocId} onChange={(e) => setFileDocId(e.target.value)} placeholder="auto from filename" />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Select File (PDF, DOCX, TXT, CSV, JSON, MD)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.csv,.json,.jsonl,.md"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
              <button
                onClick={() => uploadMut.mutate()}
                disabled={uploadMut.isPending || !uploadFile}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
              >
                {uploadMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload & Ingest</>}
              </button>
              {uploadMut.isError && <p className="text-sm text-red-600 mt-2">{(uploadMut.error as Error).message}</p>}
            </div>
          )}

          {/* Tab: Scrape URL */}
          {ingestTab === 'url' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL to Scrape</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="https://docs.microsoft.com/..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document ID <span className="text-gray-400">(optional)</span></label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" value={urlDocId} onChange={(e) => setUrlDocId(e.target.value)} placeholder="auto from URL" />
                </div>
              </div>
              <button
                onClick={() => scrapeMut.mutate()}
                disabled={scrapeMut.isPending || !scrapeUrl.trim()}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
              >
                {scrapeMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Scraping…</> : <><Globe size={14} /> Scrape & Ingest</>}
              </button>
              {scrapeMut.isError && <p className="text-sm text-red-600 mt-2">{(scrapeMut.error as Error).message}</p>}
            </div>
          )}

          {/* Tab: Environment Data Source */}
          {ingestTab === 'environment' && (
            <DataSourceImporter
              importTargets={['rag']}
              onRAGIngested={() => statsQuery.refetch()}
            />
          )}

          {/* Ingest result */}
          {ingestResult && (
            <div className="mt-4 p-3 bg-teal-50 rounded-lg border border-teal-200 text-sm flex items-center gap-3">
              <CheckCircle2 size={18} className="text-teal-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-teal-700">Ingestion Complete</p>
                <p className="text-teal-600 text-xs mt-0.5">
                  Documents: {String(ingestResult.documents_ingested ?? (ingestResult.document_id ? 1 : 0))} · Chunks: {String(ingestResult.chunks_created)}
                  {ingestResult.text_length ? ` · ${Number(ingestResult.text_length).toLocaleString()} chars extracted` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Step 1 navigation */}
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition"
            >
              Next: Configure Model <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           STEP 2 — Configure Model & Retrieval
         ══════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="bg-white rounded-xl border p-6 mb-6 animate-in fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <Cpu size={18} className="text-indigo-600" /> Step 2: Configure Model & Retrieval
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Select which AI model will generate answers and how many knowledge chunks to retrieve.
          </p>

          {/* Summary of Step 1 */}
          {hasKnowledge && (
            <div className="p-3 mb-5 bg-teal-50 rounded-lg border border-teal-100 flex items-center gap-3 text-sm">
              <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0" />
              <span className="text-teal-700">
                Knowledge Base ready
                {stats && Number(stats.total_chunks) > 0
                  ? ` — ${stats.total_documents} document(s), ${stats.total_chunks} chunks`
                  : ingestResult ? ` — ${ingestResult.chunks_created} chunks created` : ''}
              </span>
              <button onClick={() => setStep(1)} className="ml-auto text-xs text-teal-600 hover:underline">Edit</button>
            </div>
          )}
          {!hasKnowledge && (
            <div className="p-3 mb-5 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-3 text-sm">
              <Circle size={16} className="text-amber-500 flex-shrink-0" />
              <span className="text-amber-700">No documents ingested yet — <button onClick={() => setStep(1)} className="underline font-medium">go back to Step 1</button> to add knowledge first.</span>
            </div>
          )}

          {/* Provider & Deployment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <ProviderSelect label="Provider" value={provider} onChange={setProvider} />
            <DeploymentSelect label="Deployment" value={deployment} onChange={setDeployment} placeholder="Select or type deployment…" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Top K (chunks to retrieve)</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
                {TOP_K_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-0.5">Higher K = more context but also more noise.</p>
            </div>
          </div>

          {/* Temperature & Max Tokens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Temperature: <span className="font-semibold text-indigo-600">{temperature.toFixed(1)}</span>
              </label>
              <input
                type="range" min="0" max="2" step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Precise (0)</span><span>Balanced (1)</span><span>Creative (2)</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max Tokens: <span className="font-semibold text-indigo-600">{maxTokens}</span>
              </label>
              <input
                type="range" min="64" max="4096" step="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Short (64)</span><span>Medium (1024)</span><span>Long (4096)</span>
              </div>
            </div>
          </div>

          {/* System Message */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">System Message <span className="text-gray-400">(optional — shapes the AI's behavior)</span></label>
              <PromptLibraryPicker label="Load from library" onSelect={(p) => setSystemMessage(p.system_message || p.content)} />
            </div>
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={2}
              placeholder="e.g. You are a helpful assistant that answers based only on the provided context. If unsure, say so."
              value={systemMessage}
              onChange={(e) => setSystemMessage(e.target.value)}
            />
          </div>

          {/* Current config summary */}
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 mb-2">
            <span className="font-medium">Current config:</span>{' '}
            {provider} / {deployment || '(no deployment selected)'} · Top K={topK} · Temperature={temperature.toFixed(1)} · Max Tokens={maxTokens}
            {systemMessage ? ` · System: "${systemMessage.slice(0, 50)}${systemMessage.length > 50 ? '…' : ''}"` : ''}
          </div>

          {/* Step 2 navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              <ChevronLeft size={16} /> Back: Knowledge Base
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!hasModel}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={!hasModel ? 'Select a deployment first' : ''}
            >
              Next: Ask Questions <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           STEP 3 — Ask & Analyze
         ══════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="bg-white rounded-xl border p-6 mb-6 animate-in fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <MessageSquare size={18} className="text-purple-600" /> Step 3: Ask & Analyze
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Ask natural-language questions — the pipeline retrieves relevant chunks from your knowledge base and generates a grounded answer.
          </p>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-lg border border-teal-100 text-xs text-teal-700">
              <BookOpen size={12} />
              {hasKnowledge
                ? <span>{stats ? `${stats.total_documents} docs · ${stats.total_chunks} chunks` : 'Knowledge loaded'}</span>
                : <span className="text-amber-600">No knowledge</span>}
              <button onClick={() => setStep(1)} className="text-teal-500 hover:underline ml-1">Edit</button>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700">
              <Cpu size={12} />
              <span>{deployment || 'No model'} · K={topK} · T={temperature.toFixed(1)}</span>
              <button onClick={() => setStep(2)} className="text-indigo-500 hover:underline ml-1">Edit</button>
            </div>
          </div>

          {/* Question input */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Your Question</label>
              <GoldenDatasetPicker onSelectCase={(c) => setQuestion(c.question)} />
            </div>
            <div className="flex gap-3">
              <input
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                placeholder="Ask anything about your ingested documents…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !queryMut.isPending && question.trim() && queryMut.mutate()}
              />
              <button
                onClick={() => queryMut.mutate()}
                disabled={queryMut.isPending || !question.trim() || !deployment}
                className="px-5 py-3 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition shadow-sm"
                title={!deployment ? 'Go back and select a deployment in Step 2' : ''}
              >
                {queryMut.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Querying…</>
                ) : (
                  <><Sparkles size={16} /> Ask</>
                )}
              </button>
            </div>
            {!deployment && (
              <p className="text-xs text-amber-600 mt-1">Select a deployment in <button onClick={() => setStep(2)} className="underline font-medium">Step 2</button> before querying.</p>
            )}
          </div>

          {/* Query result */}
          {queryResult && (
            <div className="space-y-5 animate-in slide-in-from-bottom-3">
              {/* Answer card */}
              <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-purple-600" />
                  <p className="font-semibold text-sm text-purple-700">Generated Answer</p>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{queryResult.answer}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500 border-t border-purple-200 pt-3">
                  <span className="flex items-center gap-1"><Zap size={12} className="text-amber-500" /> {queryResult.latency_ms}ms</span>
                  <span>Prompt: {queryResult.tokens_prompt} tokens</span>
                  <span>Completion: {queryResult.tokens_completion} tokens</span>
                  <span>Model: <span className="font-mono text-gray-700">{queryResult.deployment}</span></span>
                </div>
              </div>

              {/* Context Chunks */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <FileText size={14} /> Retrieved Context Chunks
                  <span className="ml-1 px-2 py-0.5 bg-gray-100 rounded-full text-[11px] text-gray-500 font-normal">{queryResult.context_chunks?.length || 0}</span>
                </h3>
                <div className="space-y-2">
                  {queryResult.context_chunks?.map((chunk, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border text-sm hover:bg-gray-100 transition">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span className="font-mono">{chunk.chunk_id}</span>
                        <span className="font-medium text-indigo-600">
                          Score: {chunk.score.toFixed(3)}
                          <span className="ml-2 inline-block w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden align-middle">
                            <span className="block h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(chunk.score * 100, 100)}%` }} />
                          </span>
                        </span>
                      </div>
                      <p className="text-gray-700 text-xs leading-relaxed">{chunk.text}</p>
                      {chunk.metadata && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {Object.entries(chunk.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ask another */}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">Not the answer you expected? Try refining your question, adjusting Top K, or adding more documents.</p>
              </div>
            </div>
          )}

          {/* Step 3 navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              <ChevronLeft size={16} /> Back: Configure Model
            </button>
            <button
              onClick={() => { setStep(1); setQueryResult(null); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              <BookOpen size={14} /> Add More Documents
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
