import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { securityCheck } from '../api/client';
import type { SecurityCheckResult } from '../types';
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  ChevronRight, ChevronLeft, FileText, Eye, Play, Loader2,
} from 'lucide-react';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockSecurityResult } from '../mocks';

const WIZARD_STEPS = [
  { id: 1, title: 'Enter Text', subtitle: 'Paste or type the text to scan', icon: FileText },
  { id: 2, title: 'Scan & Review', subtitle: 'Run the security check and review results', icon: Eye },
] as const;

export default function SecurityPage() {
  const { useMock, toggleMock } = useMockToggle('security');
  const [wizardStep, setWizardStep] = useState(1);
  const [text, setText] = useState('');
  const [result, setResult] = useState<SecurityCheckResult | null>(null);
  const [error, setError] = useState('');

  const checkMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockSecurityResult);
      return securityCheck(text);
    },
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const step1Complete = !!text.trim();
  const isRunning = checkMut.isPending;

  const riskIcon = (level: string) => {
    switch (level) {
      case 'low':
        return <CheckCircle2 size={20} className="text-green-500" />;
      case 'medium':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'high':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={24} /> Security & Safety
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Check inputs for prompt injection, toxicity, PII leakage, and jailbreak patterns.
          </p>
        </div>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>

      {/* ═══ Stepper ═══ */}
      <div className="flex items-center justify-between mb-6">
        {WIZARD_STEPS.map((s, idx) => {
          const done = s.id === 1 ? step1Complete : !!result;
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

      {/* ═══ Step 1: Enter Text ═══ */}
      {wizardStep === 1 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><FileText size={18} className="text-indigo-600" /> Step 1: Enter Text</h2>
          <p className="text-sm text-gray-500 mb-4">Paste or type any text you want to scan — user messages, system prompts, or model outputs.</p>
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={8}
            placeholder="Paste text to check for security issues…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{text.length} characters</p>
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button onClick={() => setWizardStep(2)} disabled={!step1Complete} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Next: Scan <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Scan & Review ═══ */}
      {wizardStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1"><Eye size={18} className="text-indigo-600" /> Step 2: Scan & Review</h2>
            <p className="text-sm text-gray-500 mb-4">Run the security check and review results for prompt injection, PII, toxicity, and jailbreak patterns.</p>

            {/* Summary of step 1 */}
            <div className="p-3 mb-4 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700 flex items-center gap-2">
              <CheckCircle2 size={14} /> <span className="font-medium">{text.length} characters</span> — "{text.slice(0, 80)}{text.length > 80 ? '…' : ''}"
              <button onClick={() => setWizardStep(1)} className="ml-auto text-indigo-500 hover:underline">Edit</button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"><ChevronLeft size={16} /> Back: Text</button>
              <button onClick={() => checkMut.mutate()} disabled={isRunning || !step1Complete} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                {isRunning ? <><Loader2 size={16} className="animate-spin" /> Scanning…</> : <><Play size={16} /> Run Security Check</>}
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                {riskIcon(result.risk_level)}
                <div>
                  <p className="font-semibold text-lg">
                    {result.passed ? 'Passed' : 'Issues Detected'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Risk Level: <span className="font-medium capitalize">{result.risk_level}</span>
                  </p>
                </div>
              </div>

              {result.flags.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Flags</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.flags.map((flag) => (
                      <span key={flag} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded-full">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.details && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-1">Details</h3>
                  <p className="text-sm text-gray-600">{result.details}</p>
                </div>
              )}

              {result.redacted_text && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Redacted Text</h3>
                  <pre className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{result.redacted_text}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
