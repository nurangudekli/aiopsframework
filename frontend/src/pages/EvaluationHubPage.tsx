import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Database, Activity } from 'lucide-react';
import EvaluationPage from './EvaluationPage';
import GoldenDatasetPage from './GoldenDatasetPage';
import ContinuousEvaluationPage from './ContinuousEvaluationPage';

const sections = [
  { id: 'engine', label: 'Evaluation Engine', icon: BarChart3 },
  { id: 'datasets', label: 'Golden Datasets', icon: Database },
  { id: 'continuous', label: 'Continuous Eval', icon: Activity },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function EvaluationHubPage() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('tab') as SectionId) || 'engine';

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'engine' ? {} : { tab: id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
              active === id ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {active === 'engine' && <EvaluationPage />}
      {active === 'datasets' && <GoldenDatasetPage />}
      {active === 'continuous' && <ContinuousEvaluationPage />}
    </div>
  );
}
