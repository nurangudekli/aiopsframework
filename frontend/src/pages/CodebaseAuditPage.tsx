import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { scanCodeText, scanUploadedFile, listAuditPatterns } from '../api/client';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockAuditReport, mockAuditPatterns } from '../mocks';
import PageBanner from '../components/PageBanner';
import DeploymentSelect from '../components/DeploymentSelect';

export default function CodebaseAuditPage() {
  const { useMock, toggleMock } = useMockToggle('codebase-audit');
  const [code, setCode] = useState(
    `# Example Azure OpenAI code
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-10-21"
)

response = client.chat.completions.create(
    model="my-deployment",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": user_input}
    ],
    temperature=0.7,
    top_p=0.95,
    max_tokens=500
)`
  );
  const [filename, setFilename] = useState('example.py');
  const [targetDeploy, setTargetDeploy] = useState('');

  const scanMutation = useMutation({ mutationFn: () => {
    if (useMock) return Promise.resolve(mockAuditReport);
    return scanCodeText(code, filename, targetDeploy || undefined);
  }});
  const uploadMutation = useMutation({ mutationFn: (file: File) => {
    if (useMock) return Promise.resolve(mockAuditReport);
    const fd = new FormData();
    fd.append('file', file);
    return scanUploadedFile(fd);
  }});
  const { data: livePatterns } = useQuery({ queryKey: ['audit-patterns'], queryFn: listAuditPatterns, enabled: !useMock });
  const patterns = useMock ? mockAuditPatterns : livePatterns;

  const report = scanMutation.data || uploadMutation.data;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      if (targetDeploy) fd.append('target_deployment', targetDeploy);
      uploadMutation.mutate(file);
    }
  };

  const severityColor = (sev: string) => {
    if (sev === 'HIGH') return 'text-red-600 bg-red-50';
    if (sev === 'MEDIUM') return 'text-yellow-600 bg-yellow-50';
    return 'text-blue-600 bg-blue-50';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Codebase Audit</h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 mb-6">
        Paste your current (baseline) model code and select the target model you're migrating to. The scanner identifies what needs to change.
      </p>

      <PageBanner
        title="How to use the Codebase Audit"
        description="Paste your current baseline model code (or upload a file), select the target deployment you are migrating to, and the scanner will tell you exactly what needs to change."
        accentColor="amber"
        steps={[
          { label: 'Select target model', detail: 'Choose the deployment you are migrating TO. The scanner adjusts severity and recommendations based on the target model\'s capabilities.' },
          { label: 'Paste or upload baseline code', detail: 'Paste your current baseline model code in the editor or upload a .py, .js, .ts file.' },
          { label: 'Click Scan Code', detail: 'The scanner analyses your baseline code against the target model and returns findings categorised by severity (HIGH / MEDIUM / INFO).' },
          { label: 'Review & apply fixes', detail: 'Each finding shows what needs to change for the target model, and the Fixed Code panel shows the auto-corrected version.' },
        ]}
        tips={[
          'Different target models have different capabilities — e.g. o-series does not support temperature/top_p, but GPT-4.1 does.',
          'If no target model is selected, the scanner defaults to o-series (most restrictive).',
          'The Fixed Code panel only removes parameters that are unsupported by your chosen target model.',
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Baseline Code Input</h2>

          {/* Target Model - first so user picks target before pasting code */}
          <div className="mb-4">
            <DeploymentSelect
              label="Target Deployment (model you're migrating TO)"
              value={targetDeploy}
              onChange={setTargetDeploy}
              placeholder="Select target model…"
              size="sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Findings and recommendations are tailored to this target model's capabilities. Defaults to o-series (most restrictive) if not set.
            </p>
          </div>

          {/* Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload a file</label>
            <input
              type="file"
              accept=".py,.js,.ts,.tsx,.jsx,.cs,.java,.go,.rb"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div className="relative my-4 text-center text-xs text-gray-400">
            <span className="bg-white px-2 relative z-10">or paste your baseline code below</span>
            <div className="absolute top-1/2 left-0 right-0 border-t border-gray-200" />
          </div>

          {/* Filename */}
          <label className="block text-sm font-medium text-gray-700 mb-1">Filename</label>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full mb-3 px-3 py-2 border rounded-lg text-sm"
          />

          {/* Code Editor */}
          <label className="block text-sm font-medium text-gray-700 mb-1">Baseline Code</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-gray-50"
          />

          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || !code.trim()}
            className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {scanMutation.isPending ? 'Scanning…' : 'Scan Code'}
          </button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {report && (
            <>
              {/* Summary */}
              <div className={`rounded-xl border p-6 ${report.ready_for_migration ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <h2 className="text-lg font-semibold mb-3">
                  {report.ready_for_migration ? '✅ Ready for Migration' : '⚠️ Issues Found'}
                </h2>
                {report.target_model_family && (
                  <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    🎯 Target model family: <span className="font-medium text-gray-700">{report.target_model_family}</span>
                    {report.target_deployment && <> ({report.target_deployment})</>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-red-600">{report.severity_counts.HIGH}</div>
                    <div className="text-xs text-red-600">HIGH</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-yellow-600">{report.severity_counts.MEDIUM}</div>
                    <div className="text-xs text-yellow-600">MEDIUM</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">{report.severity_counts.INFO}</div>
                    <div className="text-xs text-blue-600">INFO</div>
                  </div>
                </div>
              </div>

              {/* Findings */}
              {report.findings && report.findings.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-3">Findings ({report.total_findings})</h2>
                  <div className="space-y-3">
                    {report.findings.map((f: any, i: number) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${severityColor(f.severity)}`}>
                            {f.severity}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{f.issue_type}</span>
                          <span className="text-xs text-gray-500">Line {f.line_number}</span>
                        </div>
                        <pre className="text-xs bg-gray-50 rounded p-2 mb-2 overflow-x-auto">{f.line_content}</pre>
                        <p className="text-xs text-gray-600">💡 {f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {report.recommended_actions && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-3">Recommended Actions</h2>
                  <div className="space-y-2">
                    {report.recommended_actions.map((a: any, i: number) => (
                      <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs font-bold text-indigo-600 whitespace-nowrap">[{a.priority}]</span>
                        <div>
                          <div className="text-sm font-medium">{a.description}</div>
                          <div className="text-xs text-gray-500">{a.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Before / After Code Comparison */}
              {report.fixed_code && report.total_findings > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-1">Fixed Code for Target Model</h2>
                  <p className="text-xs text-gray-500 mb-4">
                    Side-by-side comparison of your baseline code vs the auto-corrected version tailored for the target model.
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1">❌ Baseline Code</div>
                      <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                        {code}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-1">✅ Target Model Code</div>
                      <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                        {report.fixed_code}
                      </pre>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.findings
                      .filter((f: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.issue_type === f.issue_type) === i)
                      .map((f: any) => (
                        <span key={f.issue_type} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded">
                          {f.recommendation}
                        </span>
                      ))}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(report.fixed_code); }}
                    className="mt-3 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    📋 Copy Fixed Code
                  </button>
                </div>
              )}
            </>
          )}

          {/* Patterns Reference */}
          {patterns && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-3">Patterns Checked</h2>
              <div className="space-y-2">
                {patterns.map((p: any) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${severityColor(p.severity)}`}>
                      {p.severity}
                    </span>
                    <span className="font-mono text-xs">{p.name}</span>
                    <span className="text-gray-400">—</span>
                    <span className="text-gray-600 text-xs">{p.recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
