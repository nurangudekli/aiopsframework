import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Search, BookOpen } from 'lucide-react';
import MigrationPipelinePage from './MigrationPipelinePage';
import CodebaseAuditPage from './CodebaseAuditPage';
import MigrationGuidePage from './MigrationGuidePage';

const sections = [
  { id: 'pipeline', label: 'Pipeline', icon: ArrowRightLeft },
  { id: 'audit', label: 'Codebase Audit', icon: Search },
  { id: 'guide', label: 'Migration Guide', icon: BookOpen },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function MigrationHubPage() {
  const [params, setParams] = useSearchParams();
  const active = (params.get('tab') as SectionId) || 'pipeline';

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams(id === 'pipeline' ? {} : { tab: id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${
              active === id ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {active === 'pipeline' && <MigrationPipelinePage />}
      {active === 'audit' && <CodebaseAuditPage />}
      {active === 'guide' && <MigrationGuidePage />}
    </div>
  );
}
