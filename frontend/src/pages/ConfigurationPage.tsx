import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Key, MessageSquare, Database } from 'lucide-react';
import EndpointsPage from './EndpointsPage';
import PromptsPage from './PromptsPage';
import GoldenDatasetPage from './GoldenDatasetPage';

const sections = [
  { id: 'endpoints', label: 'Model Endpoints', icon: Key, description: 'Register & test AI model endpoints' },
  { id: 'prompts', label: 'Prompt Library', icon: MessageSquare, description: 'Create & version prompt templates' },
  { id: 'datasets', label: 'Golden Datasets', icon: Database, description: 'Upload test cases with expected answers' },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function ConfigurationPage() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('tab') as SectionId) || 'endpoints';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <Settings size={24} /> Configuration
        </h1>
        <p className="text-gray-500 text-sm">
          Set up everything you need before testing — register model endpoints, build your prompt library, and upload golden datasets.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'endpoints' ? {} : { tab: id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
              active === id ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {active === 'endpoints' && <EndpointsPage />}
      {active === 'prompts' && <PromptsPage />}
      {active === 'datasets' && <GoldenDatasetPage />}
    </div>
  );
}
