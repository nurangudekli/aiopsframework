import React from 'react';

interface Props {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
}

/**
 * Small pill toggle that sits in the top-right of a page header.
 * Shows "Using Test Data" in amber when active, "Live API" in green otherwise.
 */
export default function MockToggle({ enabled, onToggle, label }: Props) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        enabled
          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
          : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
      }`}
      title={enabled ? 'Switch to live API' : 'Switch to test mock data'}
    >
      <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-amber-500' : 'bg-green-500'}`} />
      {label ?? (enabled ? '🧪 Using Test Data' : '🟢 Live API')}
    </button>
  );
}
