import React from 'react';
import { Link } from 'react-router-dom';
import PageBanner from '../components/PageBanner';
import {
  FlaskConical,
  MessageSquare,
  Gauge,
  BarChart3,
  ArrowRight,
  ArrowRightLeft,
  FileText,
  Key,
} from 'lucide-react';

const features = [
  {
    title: 'Model Endpoints',
    description:
      'Register your model endpoints (URL + API key) — no Azure subscription access required. Once registered, model endpoints appear in every deployment dropdown across the framework.',
    icon: Key,
    to: '/model-endpoints',
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Testing',
    description:
      'A/B model testing and shadow/canary deployment. Compare two models side-by-side with semantic similarity, latency, and cost metrics — then gradually shift production traffic.',
    icon: FlaskConical,
    to: '/testing',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    title: 'Prompt Management',
    description:
      'Version, tag, and template your prompts. A/B test prompt variants with full history tracking and rollback capability.',
    icon: MessageSquare,
    to: '/prompts',
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Evaluation',
    description:
      'Full evaluation suite: AI quality metrics (LLM-as-Judge), NLP scoring, content safety, golden dataset management, continuous evaluation with alerts, schedules, and human review.',
    icon: BarChart3,
    to: '/evaluation',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Migration',
    description:
      'End-to-end model migration: run pipeline evaluations with golden datasets, scan codebases for deprecated patterns, and follow a complete migration guide with quality gates.',
    icon: ArrowRightLeft,
    to: '/migration',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'RAG Pipeline',
    description:
      'Build retrieval-augmented generation pipelines. Ingest documents, create vector embeddings, retrieve context chunks, and generate grounded answers.',
    icon: FileText,
    to: '/rag',
    color: 'bg-lime-100 text-lime-600',
  },
  {
    title: 'Monitoring',
    description:
      'Performance stress testing, security scanning, cost dashboard, and Azure Monitor integration. Track latency percentiles, detect threats, and optimize spend — all in one view.',
    icon: Gauge,
    to: '/monitoring',
    color: 'bg-orange-100 text-orange-600',
  },
];

export default function Home() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">GenAI Ops Framework</h1>
        <p className="mt-2 text-gray-600 max-w-2xl">
          A developer &amp; tester focused platform for managing GenAI workloads.
          Bring your model endpoint URL + API key — no Azure subscription access required.
          Test model upgrades, manage prompts, evaluate quality, monitor performance, enforce
          security, and optimise costs — all in one place.
        </p>
      </div>

      <PageBanner
        title="Getting Started — Developers & Testers"
        description="Register your model endpoint to start. Every tool in this framework uses the endpoints you register — no Azure subscription or Owner role needed."
        accentColor="slate"
        steps={[
          { label: 'Register your model endpoint', detail: 'Go to Model Endpoints → Add Model Endpoint. Provide the URL, API key, and deployment name.' },
          { label: 'Set up Golden Datasets', detail: 'Go to Evaluation → Golden Datasets tab. Upload test cases with expected answers for evaluation and migration.' },
          { label: 'Run an A/B experiment', detail: 'Go to Testing → A/B Testing tab. Compare your current model against a candidate.' },
          { label: 'Execute the Migration Pipeline', detail: 'Go to Migration → Pipeline tab. Run a full migration evaluation using your golden datasets.' },
          { label: 'Deploy with Shadow Testing', detail: 'Go to Testing → Shadow Testing tab. Gradually shift production traffic to the new model.' },
        ]}
        tips={[
          'Every page has a Test Data toggle — use it to explore features without a live connection.',
          'The Monitoring section aggregates performance, security, cost, and Azure Monitor in one place.',
          'Use the tab selectors at the top of each combined page to switch between related tools.',
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-indigo-300 transition-all"
          >
            <div className={`inline-flex p-3 rounded-lg ${f.color} mb-4`}>
              <f.icon size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{f.description}</p>
            <span className="inline-flex items-center gap-1 text-sm text-indigo-600 font-medium group-hover:gap-2 transition-all">
              Open <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
