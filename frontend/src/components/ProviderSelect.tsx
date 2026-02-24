import React from 'react';

interface ProviderSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

const PROVIDERS = [
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom Endpoint' },
];

export default function ProviderSelect({
  label = 'Provider',
  value,
  onChange,
  className,
  size = 'md',
}: ProviderSelectProps) {
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-1.5 text-sm'
      : 'px-3 py-2 text-sm';

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      )}
      <select
        className={`w-full border rounded-lg ${sizeClasses}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
