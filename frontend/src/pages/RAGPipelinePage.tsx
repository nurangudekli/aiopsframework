import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ingestRAGDocuments, queryRAG, clearRAGStore } from '../api/client';
import type { RAGQueryResult } from '../types';
import { Database, Upload, Search, Trash2, FileText, Zap } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';
import ProviderSelect from '../components/ProviderSelect';
import PromptLibraryPicker from '../components/PromptLibraryPicker';
import GoldenDatasetPicker from '../components/GoldenDatasetPicker';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockRAGIngestResult, mockRAGQueryResult, mockRAGDocuments } from '../mocks';

const CHUNK_SIZES = [128, 256, 512, 1024, 2048, 4096];
const CHUNK_OVERLAPS = [0, 16, 32, 64, 128, 256];
const TOP_K_OPTIONS = [1, 3, 5, 10, 20, 50];

export default function RAGPipelinePage() {
  const { useMock, toggleMock } = useMockToggle('rag');

  // ── Ingest state ──
  const [docText, setDocText] = useState('');
  const [docId, setDocId] = useState('doc-1');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [ingestResult, setIngestResult] = useState<Record<string, unknown> | null>(null);

  // ── Query state ──
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState('azure_openai');
  const [deployment, setDeployment] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [topK, setTopK] = useState(5);
  const [queryResult, setQueryResult] = useState<RAGQueryResult | null>(null);

  const ingestMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockRAGIngestResult);
      return ingestRAGDocuments(
        [{ id: docId, text: docText }],
        chunkSize,
        chunkOverlap,
      );
    },
    onSuccess: (data) => setIngestResult(data as Record<string, unknown>),
  });

  const queryMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockRAGQueryResult);
      return queryRAG(question, provider, deployment, topK, systemMessage || undefined);
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
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database size={24} /> RAG Pipeline
        </h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Ingest documents into the vector store and query with retrieval-augmented generation.
      </p>

      <PageBanner
        title="How to use the RAG Pipeline"
        description="Upload documents to build a knowledge base, then ask questions — the pipeline retrieves relevant chunks and generates grounded answers."
        accentColor="teal"
        steps={[
          { label: 'Add documents', detail: 'Paste document text with a unique ID. The text is chunked and embedded into the vector store.' },
          { label: 'Ask a question', detail: 'Enter a natural-language question. The engine retrieves the most relevant chunks then generates an answer.' },
          { label: 'Review results', detail: 'See the generated answer, retrieved context chunks with relevance scores, token usage, and latency.' },
        ]}
        tips={[
          'Chunk size controls granularity — smaller chunks give more precise retrieval, larger chunks provide more context.',
          'The pipeline uses in-memory vector storage by default. Use Clear Store to reset.',
          'Integrate via POST /api/rag/ingest and POST /api/rag/query endpoints.',
        ]}
      />

      {/* Ingest Section */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload size={18} /> Ingest Documents
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Document ID</label>
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="doc-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Chunk Size</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
            >
              {CHUNK_SIZES.map((s) => (
                <option key={s} value={s}>{s} tokens</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Chunk Overlap</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
            >
              {CHUNK_OVERLAPS.map((o) => (
                <option key={o} value={o}>{o} tokens</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => ingestMut.mutate()}
              disabled={ingestMut.isPending || !docText.trim()}
              className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {ingestMut.isPending ? 'Ingesting…' : 'Ingest'}
            </button>
            <button
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 size={14} /> Clear Store
            </button>
          </div>
        </div>
        <div className="mb-2">
          <PromptLibraryPicker
            label="Load from Prompt Library"
            onSelect={(p) => setDocText(p.content)}
          />
        </div>
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={6}
          placeholder="Paste document text here…"
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
        />
        {useMock && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Quick-load sample documents:</p>
            <div className="flex gap-2 flex-wrap">
              {mockRAGDocuments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDocId(d.id); setDocText(d.text); }}
                  className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  {d.id}
                </button>
              ))}
            </div>
          </div>
        )}
        {ingestResult && (
          <div className="mt-4 p-3 bg-teal-50 rounded-lg border border-teal-200 text-sm">
            <p className="font-medium text-teal-700">Ingestion Complete</p>
            <p className="text-teal-600 text-xs mt-1">
              Documents: {String(ingestResult.documents_ingested)} · Chunks: {String(ingestResult.chunks_created)}
            </p>
          </div>
        )}
      </div>

      {/* Query Section */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search size={18} /> Query
        </h2>
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProviderSelect
            label="Provider"
            value={provider}
            onChange={setProvider}
          />
          <DeploymentSelect
            label="Deployment"
            value={deployment}
            onChange={setDeployment}
            placeholder="Select or type deployment…"
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Top K (chunks to retrieve)</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {TOP_K_OPTIONS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {/* System Message */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">System Message <span className="text-gray-400">(optional)</span></label>
            <PromptLibraryPicker
              label="Load from library"
              onSelect={(p) => setSystemMessage(p.system_message || p.content)}
            />
          </div>
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={2}
            placeholder="Optional system message for the RAG generation step…"
            value={systemMessage}
            onChange={(e) => setSystemMessage(e.target.value)}
          />
        </div>

        {/* Question */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Question</label>
            <GoldenDatasetPicker
              onSelectCase={(c) => setQuestion(c.question)}
            />
          </div>
          <div className="flex gap-3">
            <input
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="Ask a question…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !queryMut.isPending && question.trim() && queryMut.mutate()}
            />
            <button
              onClick={() => queryMut.mutate()}
              disabled={queryMut.isPending || !question.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Zap size={14} /> {queryMut.isPending ? 'Querying…' : 'Query'}
            </button>
          </div>
        </div>

        {queryResult && (
          <div className="space-y-4">
            {/* Answer */}
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="font-medium text-sm text-indigo-700 mb-2">Answer</p>
              <p className="text-sm text-gray-800 leading-relaxed">{queryResult.answer}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>Latency: {queryResult.latency_ms}ms</span>
                <span>Prompt: {queryResult.tokens_prompt} tokens</span>
                <span>Completion: {queryResult.tokens_completion} tokens</span>
                <span>Model: {queryResult.deployment}</span>
              </div>
            </div>

            {/* Context Chunks */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <FileText size={14} /> Retrieved Context Chunks ({queryResult.context_chunks?.length || 0})
              </h3>
              <div className="space-y-2">
                {queryResult.context_chunks?.map((chunk, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border text-sm">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-mono">{chunk.chunk_id}</span>
                      <span className="font-medium text-indigo-600">Score: {chunk.score.toFixed(3)}</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
