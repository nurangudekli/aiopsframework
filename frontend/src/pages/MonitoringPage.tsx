import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gauge, Shield, DollarSign, CloudCog } from 'lucide-react';
import PerformancePage from './PerformancePage';
import SecurityPage from './SecurityPage';
import DashboardPage from './DashboardPage';
import AzureMonitorPage from './AzureMonitorPage';

const sections = [
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'cost', label: 'Cost Dashboard', icon: DollarSign },
  { id: 'azure', label: 'Azure Monitor', icon: CloudCog },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function MonitoringPage() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('tab') as SectionId) || 'performance';

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'performance' ? {} : { tab: id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
              active === id ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {active === 'performance' && <PerformancePage />}
      {active === 'security' && <SecurityPage />}
      {active === 'cost' && <DashboardPage />}
      {active === 'azure' && <AzureMonitorPage />}
    </div>
  );
}
