import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRegisteredDeployments, listSubscriptions, listAllAzureDeployments } from '../api/client';
import type { DeploymentInfo } from '../types';
import { ChevronDown, Loader2, RefreshCw, Server, Key } from 'lucide-react';

interface DeploymentSelectProps {
  /** Current value (deployment name string) */
  value: string;
  /** Called when the user picks or types a deployment name */
  onChange: (value: string) => void;
  /** Called with the full deployment info when a dropdown item is selected (not on manual typing) */
  onSelectDeployment?: (info: DeploymentInfo) => void;
  /** Optional label text; defaults to "Deployment" */
  label?: string;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** If true, component is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * A combo-box that loads deployments from the Model Endpoints registry first,
 * then optionally from Azure subscriptions. Users can always type a custom name.
 *
 * Priority: Registered model endpoints → Azure subscription deployments → manual input.
 */
export default function DeploymentSelect({
  value,
  onChange,
  onSelectDeployment,
  label = 'Deployment',
  className = '',
  placeholder = 'Select or type deployment…',
  disabled = false,
  size = 'md',
}: DeploymentSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 1. Fetch registered endpoints (always available — no subscription needed) ──
  const registeredQuery = useQuery({
    queryKey: ['registered-deployments'],
    queryFn: listRegisteredDeployments,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  // ── 2. Optionally fetch Azure subscription deployments (best-effort) ──
  const subsQuery = useQuery({
    queryKey: ['azure-subscriptions'],
    queryFn: listSubscriptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const firstSubId = subsQuery.data?.[0]?.subscription_id ?? '';

  const azureDeploymentsQuery = useQuery({
    queryKey: ['all-azure-deployments', firstSubId],
    queryFn: () => listAllAzureDeployments(firstSubId),
    enabled: !!firstSubId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Combine: registered first, then Azure ──
  const registered: DeploymentInfo[] = registeredQuery.data ?? [];
  const azureDeployments: DeploymentInfo[] = azureDeploymentsQuery.data ?? [];
  const allDeployments = [...registered, ...azureDeployments];
  const isLoading = registeredQuery.isLoading;

  // ── Filter deployments by typed search ──
  const filtered = allDeployments.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.deployment.toLowerCase().includes(q) ||
      d.model_name.toLowerCase().includes(q) ||
      d.account.toLowerCase().includes(q)
    );
  });

  // ── Close on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (dep: DeploymentInfo) => {
    onChange(dep.deployment);
    onSelectDeployment?.(dep);
    setSearch('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    onChange(v);
    if (!open) setOpen(true);
  };

  const handleFocus = () => {
    setSearch('');
    setOpen(true);
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className={`block font-medium text-gray-500 mb-1 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? search || value : value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full border rounded-lg ${sizeClasses} pr-8 bg-white disabled:bg-gray-50 disabled:text-gray-400`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(!open); if (!open) inputRef.current?.focus(); }}
          className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
          disabled={disabled}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" /> Loading deployments…
            </div>
          )}

          {!isLoading && subsQuery.isError && registered.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-500">
              <span className="text-amber-600">No registered model endpoints found.</span>{' '}
              Register one in the Model Endpoints page, or type a deployment name manually.
              <button
                onClick={() => { registeredQuery.refetch(); }}
                className="ml-1 text-indigo-600 hover:underline inline-flex items-center gap-0.5"
              >
                <RefreshCw size={10} /> Retry
              </button>
            </div>
          )}

          {!isLoading && allDeployments.length === 0 && !subsQuery.isError && (
            <div className="px-3 py-3 text-xs text-gray-500">
              No model endpoints registered yet. Go to <strong>Model Endpoints</strong> to add one, or type a name manually.
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <>
              {/* Show registered endpoints first */}
              {filtered.some((d) => (d as any).source === 'registered') && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b">
                  <Key size={9} className="inline mr-1" />Registered Model Endpoints ({filtered.filter((d) => (d as any).source === 'registered').length})
                </div>
              )}
              {filtered.filter((d) => (d as any).source === 'registered').map((d, i) => (
                <button
                  key={`reg-${d.deployment}-${i}`}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={`w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 ${
                    d.deployment === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-800'
                  }`}
                >
                  <Key size={12} className="text-green-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.deployment}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {d.model_name} {d.model_version ? `v${d.model_version}` : ''} · {d.account}
                    </div>
                  </div>
                </button>
              ))}

              {/* Then Azure-discovered deployments */}
              {filtered.some((d) => (d as any).source !== 'registered') && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b">
                  <Server size={9} className="inline mr-1" />Azure Deployments ({filtered.filter((d) => (d as any).source !== 'registered').length})
                </div>
              )}
              {filtered.filter((d) => (d as any).source !== 'registered').map((d, i) => (
                <button
                  key={`az-${d.account}-${d.deployment}-${i}`}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={`w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 ${
                    d.deployment === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-800'
                  }`}
                >
                  <Server size={12} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.deployment}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {d.model_name} {d.model_version ? `v${d.model_version}` : ''} · {d.account}
                      {d.deployment_type && d.deployment_type !== 'Standard' && (
                        <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-600 text-[9px] font-medium">
                          {d.deployment_type}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {!isLoading && filtered.length === 0 && allDeployments.length > 0 && (
            <div className="px-3 py-3 text-xs text-gray-500">
              No matches for "{search}". Press Enter to use as custom name.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
