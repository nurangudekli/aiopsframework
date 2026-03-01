import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { MockContext } from '../hooks/useMockToggle';
import {
  FlaskConical,
  MessageSquare,
  Gauge,
  BarChart3,
  Home,
  ArrowRightLeft,
  FileText,
  Brain,
  Key,
  Info,
  Settings,
  FileBarChart,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/configuration', label: 'Configuration', icon: Settings },
  { to: '/testing', label: 'Testing', icon: FlaskConical },
  { to: '/evaluation', label: 'Evaluation', icon: BarChart3 },
  { to: '/migration', label: 'Migration', icon: ArrowRightLeft },
  { to: '/rag', label: 'RAG Pipeline', icon: FileText },
  { to: '/monitoring', label: 'Monitoring', icon: Gauge },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/about', label: 'About', icon: Info },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const mockCtx = useContext(MockContext);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Brain size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">GenAI Ops</h1>
            <p className="text-xs text-gray-400 mt-0.5">Framework v0.1</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname === to || location.pathname.startsWith(to + '/');
            return (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-gray-700 text-xs text-gray-500">
          &copy; 2026 AI Ops Team
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Global mock-data banner */}
        <div className="max-w-7xl mx-auto px-6 pt-4 flex justify-end">
          <button
            onClick={() => mockCtx.setGlobalMock(!mockCtx.globalMock)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              mockCtx.globalMock
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${mockCtx.globalMock ? 'bg-amber-500' : 'bg-green-500'}`} />
            {mockCtx.globalMock ? '🧪 Global Test Data ON' : '🟢 Live API'}
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
