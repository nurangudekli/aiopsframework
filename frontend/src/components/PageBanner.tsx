import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Lightbulb, X } from 'lucide-react';

interface Step {
  label: string;
  detail?: string;
}

interface PageBannerProps {
  title: string;
  description: string;
  steps: Step[];
  tips?: string[];
  accentColor?: string; // tailwind color key e.g. 'blue', 'purple', 'emerald'
}

const palette: Record<string, { bg: string; border: string; icon: string; badge: string; tipBg: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    tipBg: 'bg-blue-100/60' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  icon: 'text-purple-600',  badge: 'bg-purple-100 text-purple-700',  tipBg: 'bg-purple-100/60' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', tipBg: 'bg-emerald-100/60' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',   tipBg: 'bg-amber-100/60' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    icon: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700',    tipBg: 'bg-rose-100/60' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  tipBg: 'bg-indigo-100/60' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    icon: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700',    tipBg: 'bg-cyan-100/60' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    icon: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',    tipBg: 'bg-teal-100/60' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     icon: 'text-sky-600',     badge: 'bg-sky-100 text-sky-700',     tipBg: 'bg-sky-100/60' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  icon: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700',  tipBg: 'bg-orange-100/60' },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   icon: 'text-slate-600',   badge: 'bg-slate-100 text-slate-700',   tipBg: 'bg-slate-100/60' },
};

export default function PageBanner({ title, description, steps, tips, accentColor = 'blue' }: PageBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const c = palette[accentColor] ?? palette.blue;

  if (dismissed) return null;

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl mb-6 overflow-hidden transition-all`}>
      {/* Collapsed / always-visible row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <Info size={18} className={`${c.icon} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-800">{title}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.badge}`}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded-md hover:bg-white/60 transition-colors"
            aria-label={expanded ? 'Collapse guide' : 'Expand guide'}
          >
            {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-white/60 transition-colors"
            aria-label="Dismiss guide"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/60">
          {/* Steps */}
          <div className="space-y-2 mt-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 mt-0.5 ${c.badge}`}>
                  {i + 1}
                </span>
                <div>
                  <span className="text-sm font-medium text-gray-800">{step.label}</span>
                  {step.detail && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {tips && tips.length > 0 && (
            <div className={`mt-3 ${c.tipBg} rounded-lg px-3 py-2`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb size={13} className={c.icon} />
                <span className="text-xs font-semibold text-gray-700">Tips</span>
              </div>
              <ul className="space-y-1">
                {tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-400 mt-px">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
