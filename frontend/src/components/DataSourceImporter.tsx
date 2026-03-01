import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  fetchLogAnalytics,
  fetchCosmosDB,
  fetchBlobStorage,
  fetchHttpSource,
  previewFieldMapping,
  importToGolden,
  importToRAG,
} from '../api/client';
import type { DataSourceResult, FieldMappingPreview } from '../types';
import { Database, Cloud, Globe, HardDrive, Search, ArrowRight, Check, X, Loader2, FileText } from 'lucide-react';

/* ── Source type config ──────────────────────────────────────── */
const SOURCES = [
  { id: 'log_analytics', label: 'Log Analytics', icon: Search, color: 'blue', desc: 'Query Azure Log Analytics with KQL' },
  { id: 'cosmos_db', label: 'Cosmos DB', icon: Database, color: 'purple', desc: 'Query Azure Cosmos DB with SQL' },
  { id: 'blob_storage', label: 'Blob Storage', icon: HardDrive, color: 'teal', desc: 'Load JSON / JSONL / CSV from Azure Blob' },
  { id: 'http', label: 'HTTP / REST', icon: Globe, color: 'orange', desc: 'Call any REST endpoint returning JSON' },
] as const;

type SourceId = typeof SOURCES[number]['id'];
type Step = 'select' | 'configure' | 'preview' | 'import';

interface Props {
  /** Called after records are fetched, before import. Parent can use records directly. */
  onRecordsFetched?: (records: Record<string, unknown>[], sourceType: string) => void;
  /** Called after successful golden dataset import */
  onGoldenImported?: (datasetId: string, name: string, count: number) => void;
  /** Called after successful RAG ingestion */
  onRAGIngested?: (docsCount: number, chunksCount: number) => void;
  /** Restrict import targets */
  importTargets?: ('golden' | 'rag')[];
}

export default function DataSourceImporter({ onRecordsFetched, onGoldenImported, onRAGIngested, importTargets }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [source, setSource] = useState<SourceId | null>(null);

  // Source-specific form state
  const [workspaceId, setWorkspaceId] = useState('');
  const [kqlQuery, setKqlQuery] = useState('AppRequests\n| where TimeGenerated > ago(7d)\n| project TimeGenerated, Name, ResultCode, DurationMs\n| take 100');
  const [timespan, setTimespan] = useState('P7D');

  const [cosmosEndpoint, setCosmosEndpoint] = useState('');
  const [cosmosDb, setCosmosDb] = useState('');
  const [cosmosContainer, setCosmosContainer] = useState('');
  const [cosmosQuery, setCosmosQuery] = useState('SELECT * FROM c');
  const [cosmosKey, setCosmosKey] = useState('');
  const [cosmosMaxItems, setCosmosMaxItems] = useState(1000);

  const [blobAccountUrl, setBlobAccountUrl] = useState('');
  const [blobContainer, setBlobContainer] = useState('');
  const [blobName, setBlobName] = useState('');
  const [blobConnStr, setBlobConnStr] = useState('');

  const [httpUrl, setHttpUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [httpHeaders, setHttpHeaders] = useState('');
  const [httpBody, setHttpBody] = useState('');
  const [httpJmespath, setHttpJmespath] = useState('');

  // Results
  const [fetchResult, setFetchResult] = useState<DataSourceResult | null>(null);
  const [mappingPreview, setMappingPreview] = useState<FieldMappingPreview | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Import form
  const [datasetName, setDatasetName] = useState('');
  const [datasetDesc, setDatasetDesc] = useState('');
  const [importTarget, setImportTarget] = useState<'golden' | 'rag'>('golden');
  const [ragIdField, setRagIdField] = useState('id');
  const [ragTextField, setRagTextField] = useState('text');

  // Fetch mutation
  const fetchMut = useMutation({
    mutationFn: async () => {
      switch (source) {
        case 'log_analytics':
          return fetchLogAnalytics({ workspace_id: workspaceId, query: kqlQuery, timespan });
        case 'cosmos_db':
          return fetchCosmosDB({
            endpoint: cosmosEndpoint, database_name: cosmosDb,
            container_name: cosmosContainer, query: cosmosQuery,
            key: cosmosKey || undefined, max_items: cosmosMaxItems,
          });
        case 'blob_storage':
          return fetchBlobStorage({
            account_url: blobAccountUrl, container_name: blobContainer,
            blob_name: blobName, connection_string: blobConnStr || undefined,
          });
        case 'http':
          return fetchHttpSource({
            url: httpUrl, method: httpMethod,
            headers: httpHeaders ? JSON.parse(httpHeaders) : undefined,
            body: httpBody ? JSON.parse(httpBody) : undefined,
            jmespath_expr: httpJmespath || undefined,
          });
        default:
          throw new Error('Select a source');
      }
    },
    onSuccess: async (data) => {
      setFetchResult(data);
      onRecordsFetched?.(data.records as Record<string, unknown>[], data.source_type);
      // Auto-detect mapping
      if (data.records.length > 0) {
        try {
          const preview = await previewFieldMapping(data.records as Record<string, unknown>[]);
          setMappingPreview(preview);
          setFieldMapping(preview.detected_mapping);
        } catch { /* ignore */ }
      }
      setStep('preview');
    },
  });

  // Import mutations
  const goldenMut = useMutation({
    mutationFn: () => importToGolden({
      records: fetchResult!.records as Record<string, unknown>[],
      dataset_name: datasetName,
      description: datasetDesc,
      source_type: fetchResult!.source_type,
      mapping: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
    }),
    onSuccess: (data) => {
      onGoldenImported?.(data.dataset_id || '', data.dataset_name || datasetName, data.cases_imported || 0);
      setStep('select');
      setIsOpen(false);
      resetState();
    },
  });

  const ragMut = useMutation({
    mutationFn: () => importToRAG({
      records: fetchResult!.records as Record<string, unknown>[],
      id_field: ragIdField,
      text_field: ragTextField,
    }),
    onSuccess: (data) => {
      onRAGIngested?.(data.documents_ingested || 0, data.chunks_created || 0);
      setStep('select');
      setIsOpen(false);
      resetState();
    },
  });

  const resetState = () => {
    setSource(null);
    setStep('select');
    setFetchResult(null);
    setMappingPreview(null);
    setFieldMapping({});
    setDatasetName('');
    setDatasetDesc('');
  };

  const targets = importTargets || ['golden', 'rag'];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-700 shadow-sm"
      >
        <Cloud size={16} /> Import from Environment
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Cloud className="text-blue-600" size={20} />
          Import from Environment Data Source
        </h3>
        <button onClick={() => { setIsOpen(false); resetState(); }} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {(['select', 'configure', 'preview', 'import'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <span className={`px-3 py-1 rounded-full font-medium ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <ArrowRight size={12} className="text-gray-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select source */}
      {step === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSource(s.id); setStep('configure'); }}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all hover:shadow-md
                ${source === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
            >
              <s.icon size={24} className={`text-${s.color}-600 mt-0.5`} />
              <div>
                <p className="font-medium text-sm">{s.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 'configure' && source && (
        <div className="space-y-4">
          {source === 'log_analytics' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Workspace ID</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">KQL Query</label>
                <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={5}
                  value={kqlQuery} onChange={(e) => setKqlQuery(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Timespan</label>
                <select className="px-3 py-2 border rounded-lg text-sm bg-white" value={timespan} onChange={(e) => setTimespan(e.target.value)}>
                  <option value="PT1H">Last 1 hour</option>
                  <option value="PT6H">Last 6 hours</option>
                  <option value="P1D">Last 1 day</option>
                  <option value="P7D">Last 7 days</option>
                  <option value="P30D">Last 30 days</option>
                </select>
              </div>
            </>
          )}

          {source === 'cosmos_db' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Endpoint URL</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://myaccount.documents.azure.com:443/"
                    value={cosmosEndpoint} onChange={(e) => setCosmosEndpoint(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Key <span className="text-gray-400">(or use Azure CLI)</span></label>
                  <input type="password" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Leave empty for DefaultAzureCredential"
                    value={cosmosKey} onChange={(e) => setCosmosKey(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Database</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="myDatabase"
                    value={cosmosDb} onChange={(e) => setCosmosDb(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Container</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="myContainer"
                    value={cosmosContainer} onChange={(e) => setCosmosContainer(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SQL Query</label>
                <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={3}
                  value={cosmosQuery} onChange={(e) => setCosmosQuery(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Items</label>
                <select className="px-3 py-2 border rounded-lg text-sm bg-white" value={cosmosMaxItems} onChange={(e) => setCosmosMaxItems(Number(e.target.value))}>
                  {[100, 500, 1000, 5000, 10000].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </>
          )}

          {source === 'blob_storage' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account URL</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://myaccount.blob.core.windows.net"
                  value={blobAccountUrl} onChange={(e) => setBlobAccountUrl(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Container</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="my-container"
                    value={blobContainer} onChange={(e) => setBlobContainer(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blob Path</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="data/questions.jsonl"
                    value={blobName} onChange={(e) => setBlobName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Connection String <span className="text-gray-400">(or use Azure CLI)</span></label>
                <input type="password" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Leave empty for DefaultAzureCredential"
                  value={blobConnStr} onChange={(e) => setBlobConnStr(e.target.value)} />
              </div>
            </>
          )}

          {source === 'http' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={httpMethod} onChange={(e) => setHttpMethod(e.target.value)}>
                    <option>GET</option><option>POST</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://api.example.com/data"
                    value={httpUrl} onChange={(e) => setHttpUrl(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Headers (JSON) <span className="text-gray-400">(optional)</span></label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder='{"Authorization": "Bearer ..."}'
                  value={httpHeaders} onChange={(e) => setHttpHeaders(e.target.value)} />
              </div>
              {httpMethod === 'POST' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Body (JSON)</label>
                  <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={3}
                    value={httpBody} onChange={(e) => setHttpBody(e.target.value)} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">JMESPath / dot-path to array <span className="text-gray-400">(optional)</span></label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder="value  or  data.items"
                  value={httpJmespath} onChange={(e) => setHttpJmespath(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep('select')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => fetchMut.mutate()}
              disabled={fetchMut.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {fetchMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Fetching…</> : <><Search size={14} /> Fetch Records</>}
            </button>
          </div>
          {fetchMut.isError && (
            <p className="text-sm text-red-600 mt-2">Error: {(fetchMut.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && fetchResult && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
            <p className="font-medium text-blue-700">Fetched {fetchResult.record_count} records from {fetchResult.source_type.replace('_', ' ')}</p>
          </div>

          {/* Sample records table */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Sample Records (first {Math.min(5, fetchResult.records.length)})</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-50">
                    {fetchResult.records.length > 0 && Object.keys(fetchResult.records[0]).map((key) => (
                      <th key={key} className="px-2 py-1 text-left font-medium text-gray-600 border-b">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fetchResult.records.slice(0, 5).map((rec, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      {Object.values(rec).map((val, ci) => (
                        <td key={ci} className="px-2 py-1 max-w-[200px] truncate">{String(val ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field mapping (for golden dataset) */}
          {mappingPreview && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Auto-detected Field Mapping <span className="text-gray-400">(editable)</span></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {mappingPreview.golden_fields.map((gf) => (
                  <div key={gf} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-28 text-gray-700">{gf}:</span>
                    <select
                      className="flex-1 px-2 py-1 border rounded text-xs bg-white"
                      value={fieldMapping[gf] || ''}
                      onChange={(e) => setFieldMapping((prev) => {
                        const next = { ...prev };
                        if (e.target.value) next[gf] = e.target.value;
                        else delete next[gf];
                        return next;
                      })}
                    >
                      <option value="">— unmapped —</option>
                      {mappingPreview.available_fields.map((af) => (
                        <option key={af} value={af}>{af}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep('configure')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              Back
            </button>
            <button onClick={() => setStep('import')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1">
              <ArrowRight size={14} /> Continue to Import
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import */}
      {step === 'import' && fetchResult && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {targets.includes('golden') && (
              <button
                onClick={() => setImportTarget('golden')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${importTarget === 'golden' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Database size={14} className="inline mr-1" /> Import as Golden Dataset
              </button>
            )}
            {targets.includes('rag') && (
              <button
                onClick={() => setImportTarget('rag')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${importTarget === 'rag' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <FileText size={14} className="inline mr-1" /> Ingest into RAG Pipeline
              </button>
            )}
          </div>

          {importTarget === 'golden' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dataset Name</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Production Logs Q&A"
                  value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Imported from..."
                  value={datasetDesc} onChange={(e) => setDatasetDesc(e.target.value)} />
              </div>
              <button
                onClick={() => goldenMut.mutate()}
                disabled={goldenMut.isPending || !datasetName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {goldenMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : <><Check size={14} /> Create Golden Dataset ({fetchResult.record_count} records)</>}
              </button>
              {goldenMut.isError && <p className="text-sm text-red-600">Error: {(goldenMut.error as Error).message}</p>}
            </div>
          )}

          {importTarget === 'rag' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ID Field</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={ragIdField} onChange={(e) => setRagIdField(e.target.value)}>
                    {fetchResult.records.length > 0 && Object.keys(fetchResult.records[0]).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Text Field</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={ragTextField} onChange={(e) => setRagTextField(e.target.value)}>
                    {fetchResult.records.length > 0 && Object.keys(fetchResult.records[0]).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => ragMut.mutate()}
                disabled={ragMut.isPending}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {ragMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Ingesting…</> : <><Check size={14} /> Ingest {fetchResult.record_count} documents</>}
              </button>
              {ragMut.isError && <p className="text-sm text-red-600">Error: {(ragMut.error as Error).message}</p>}
            </div>
          )}

          <button onClick={() => setStep('preview')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 mt-2">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
