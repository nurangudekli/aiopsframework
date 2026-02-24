import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { securityCheck } from '../api/client';
import type { SecurityCheckResult } from '../types';
import { Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import PageBanner from '../components/PageBanner';
import { useMockToggle } from '../hooks/useMockToggle';
import MockToggle from '../components/MockToggle';
import { mockSecurityResult } from '../mocks';

export default function SecurityPage() {
  const { useMock, toggleMock } = useMockToggle('security');
  const [text, setText] = useState('');
  const [result, setResult] = useState<SecurityCheckResult | null>(null);

  const checkMut = useMutation({
    mutationFn: () => {
      if (useMock) return Promise.resolve(mockSecurityResult);
      return securityCheck(text);
    },
    onSuccess: (data) => setResult(data),
  });

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
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield size={24} /> Security & Safety
        </h1>
        <MockToggle enabled={useMock} onToggle={toggleMock} />
      </div>
      <p className="text-gray-600 text-sm mb-6">
        Check inputs for prompt injection, toxicity, PII leakage, and jailbreak patterns.
      </p>

      <PageBanner
        title="How to use the Security Scanner"
        description="Scan any user-facing text for prompt injection attacks, PII leakage, toxicity, and jailbreak patterns before sending it to a model."
        accentColor="rose"
        steps={[
          { label: 'Paste text to scan', detail: 'Enter or paste any text — user messages, system prompts, or model outputs.' },
          { label: 'Click Run Security Check', detail: 'The scanner analyses the text with multiple detectors and returns a risk level.' },
          { label: 'Review results', detail: 'See the risk level (LOW / MEDIUM / HIGH), flags raised, a details explanation, and a PII-redacted version of the text.' },
        ]}
        tips={[
          'Use this before sending user input to a model to prevent prompt injection.',
          'The redacted text shows what the input looks like with PII (emails, phones) removed.',
          'Integrate this check into your pipeline by calling the /api/security/check endpoint.',
        ]}
      />

      <div className="bg-white rounded-xl border p-6 mb-6">
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={6}
          placeholder="Paste text to check for security issues…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={() => checkMut.mutate()}
          disabled={checkMut.isPending || !text.trim()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {checkMut.isPending ? 'Checking…' : 'Run Security Check'}
        </button>
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
  );
}
