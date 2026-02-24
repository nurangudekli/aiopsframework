import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FlaskConical, GitBranch } from 'lucide-react';
import ABTestingPage from './ABTestingPage';
import ShadowTestingPage from './ShadowTestingPage';

const sections = [
  { id: 'ab', label: 'A/B Testing', icon: FlaskConical },
  { id: 'shadow', label: 'Shadow Testing', icon: GitBranch },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function TestingPage() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('tab') as SectionId) || 'ab';

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'ab' ? {} : { tab: id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
              active === id ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {active === 'ab' && <ABTestingPage />}
      {active === 'shadow' && <ShadowTestingPage />}
    </div>
  );
}
