import React, { useState } from 'react';
import {
  Info,
  Server,
  FlaskConical,
  MessageSquare,
  BarChart3,
  Gauge,
  Shield,
  FileText,
  DollarSign,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Key,
  Layers,
  Rocket,
  Code2,
  TestTube2,
  Terminal,
  FolderTree,
  BookOpen,
} from 'lucide-react';

/* ─── Feature data ──────────────────────────────────────────── */
const features = [
  {
    icon: Key,
    title: 'Model Endpoints',
    color: 'bg-indigo-100 text-indigo-700',
    items: [
      'Register model endpoints with URL + API key — works for Azure OpenAI, OpenAI, and any OpenAI-compatible service',
      'Test connectivity with a single click',
      'Enable / disable model endpoints without deleting them',
      'Registered model endpoints appear automatically in every deployment dropdown across the framework',
      'Persisted to data/endpoints.json (no database needed for config)',
    ],
  },
  {
    icon: FlaskConical,
    title: 'A/B Model Testing',
    color: 'bg-purple-100 text-purple-700',
    items: [
      'Upload questions from Excel (.xlsx), CSV, or JSON files',
      'Run each question against two registered model endpoints concurrently',
      'Side-by-side response comparison in the UI',
      'Automatic semantic similarity scoring (0–100%)',
      'Latency and cost comparison per question',
      'Human preference voting (Model A / Model B / Tie)',
    ],
  },
  {
    icon: MessageSquare,
    title: 'Prompt Engineering & Management',
    color: 'bg-sky-100 text-sky-700',
    items: [
      'Create, version, and tag prompts',
      'Template engine with {{variable}} interpolation',
      'Activate/deactivate prompt versions with one click',
      'Full version history with rollback',
      'Render and preview templates with test variables',
    ],
  },
  {
    icon: BarChart3,
    title: 'Evaluation Engine',
    color: 'bg-emerald-100 text-emerald-700',
    items: [
      'Semantic similarity via sentence-transformer embeddings (cosine)',
      'BLEU score (unigram precision + brevity penalty)',
      'ROUGE-L (longest common subsequence F1)',
      'Coherence heuristics (sentence structure, repetition)',
      'Batch evaluation for bulk comparison',
      'Verdict classification: similar / needs_review / divergent',
    ],
  },
  {
    icon: Gauge,
    title: 'Performance & Stress Testing',
    color: 'bg-amber-100 text-amber-700',
    items: [
      'Configurable concurrency (1–200 concurrent workers)',
      'Latency percentiles: P50, P90, P99, min, max',
      'Requests per second throughput measurement',
      'Tokens per second throughput',
      'Error rate tracking with detailed error logs',
      'Total cost estimation per test',
    ],
  },
  {
    icon: Shield,
    title: 'Security & Safety',
    color: 'bg-red-100 text-red-700',
    items: [
      'Prompt injection pattern detection (15+ patterns)',
      'Toxicity / harmful content keyword scanning',
      'PII detection & redaction (email, phone, SSN, credit card, IP)',
      'Jailbreak pattern matching',
      'Combined full security check with risk-level scoring',
    ],
  },
  {
    icon: FileText,
    title: 'RAG Pipeline',
    color: 'bg-teal-100 text-teal-700',
    items: [
      'Document ingestion with configurable chunk size and overlap',
      'In-memory vector store (numpy-based cosine search)',
      'Sentence-transformer embeddings for chunks',
      'Context-augmented generation with retrieved chunks',
      'Pluggable — extend to FAISS, Pinecone, Azure AI Search, etc.',
    ],
  },
  {
    icon: DollarSign,
    title: 'Cost Optimisation',
    color: 'bg-lime-100 text-lime-700',
    items: [
      'Automatic token usage & cost tracking per API call',
      'Daily cost breakdown and per-deployment aggregation',
      'Model cascading — cheapest model first, escalate if confidence is low',
      'Configurable confidence thresholds',
      'Cost alert thresholds',
    ],
  },
  {
    icon: Activity,
    title: 'Continuous Evaluation',
    color: 'bg-cyan-100 text-cyan-700',
    items: [
      'End-to-end evaluation pipeline inspired by Microsoft Foundry',
      'UX metrics: helpfulness, tone, completeness',
      'Safety alerts and scheduled runs',
      'Human review workflows',
      'Metric trend analysis dashboard',
    ],
  },
  {
    icon: Server,
    title: 'Azure OpenAI Monitor (optional)',
    color: 'bg-blue-100 text-blue-700',
    note: 'Requires Azure subscription-level access. Developers and testers can skip this.',
    items: [
      'Scan an Azure subscription to auto-discover all OpenAI / AI Services accounts',
      'List deployments per account with 7-day usage metrics from Azure Monitor',
      'Usage-level badges (No usage / Low / Medium / High)',
      'Test individual deployments directly from the UI',
    ],
  },
];

/* ─── API route table data ──────────────────────────────────── */
const apiRoutes = [
  { module: 'Model Endpoints', routes: [
    { method: 'POST', path: '/api/model-endpoints', desc: 'Register a new model endpoint' },
    { method: 'GET', path: '/api/model-endpoints', desc: 'List all registered model endpoints' },
    { method: 'GET', path: '/api/model-endpoints/deployments', desc: 'List as deployment info (for dropdowns)' },
    { method: 'POST', path: '/api/model-endpoints/{id}/test', desc: 'Test connectivity' },
  ]},
  { module: 'A/B Testing', routes: [
    { method: 'POST', path: '/api/experiments', desc: 'Create & run A/B experiment' },
    { method: 'POST', path: '/api/experiments/upload', desc: 'Upload file & run A/B test' },
    { method: 'GET', path: '/api/experiments', desc: 'List all experiments' },
    { method: 'GET', path: '/api/experiments/{id}', desc: 'Get experiment detail + results' },
  ]},
  { module: 'Prompts', routes: [
    { method: 'POST', path: '/api/prompts', desc: 'Create prompt' },
    { method: 'GET', path: '/api/prompts', desc: 'List prompts' },
    { method: 'POST', path: '/api/prompts/{id}/versions', desc: 'Create new version' },
    { method: 'POST', path: '/api/prompts/{id}/render', desc: 'Render template' },
  ]},
  { module: 'Evaluation', routes: [
    { method: 'POST', path: '/api/evaluate', desc: 'Compare two responses' },
    { method: 'POST', path: '/api/evaluate/batch', desc: 'Batch comparison' },
  ]},
  { module: 'Performance', routes: [
    { method: 'POST', path: '/api/performance/test', desc: 'Run stress/load test' },
  ]},
  { module: 'Security', routes: [
    { method: 'POST', path: '/api/security/check', desc: 'Full security scan' },
    { method: 'POST', path: '/api/security/pii', desc: 'PII detection + redaction' },
  ]},
  { module: 'RAG', routes: [
    { method: 'POST', path: '/api/rag/ingest', desc: 'Ingest documents' },
    { method: 'POST', path: '/api/rag/query', desc: 'RAG query' },
  ]},
  { module: 'Costs', routes: [
    { method: 'GET', path: '/api/costs/summary', desc: 'Cost summary (daily, by deployment)' },
    { method: 'POST', path: '/api/costs/cascade', desc: 'Run model cascade' },
  ]},
];

/* ─── Quick-start steps ─────────────────────────────────────── */
const quickStartSteps = [
  {
    icon: Terminal,
    title: 'Start the Backend',
    code: 'pip install -e ".[dev]"\nuvicorn backend.main:app --reload --port 8000',
    note: 'API docs available at http://localhost:8000/docs',
  },
  {
    icon: Rocket,
    title: 'Start the Frontend',
    code: 'cd frontend\nnpm install\nnpm run dev',
    note: 'UI available at http://localhost:5173',
  },
  {
    icon: Key,
    title: 'Register a Model Endpoint',
    code: null,
    note: 'Open Model Endpoints page → Add your endpoint URL + API key → Click Test to verify.',
  },
];

/* ─── Method colour helper ──────────────────────────────────── */
function methodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    PATCH: 'bg-orange-100 text-orange-700',
    DELETE: 'bg-red-100 text-red-700',
  };
  return colors[method] || 'bg-gray-100 text-gray-700';
}

/* ─── Collapsible section ───────────────────────────────────── */
function Section({ title, icon: Icon, defaultOpen = false, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-3 font-semibold text-gray-800">
          <Icon size={18} className="text-indigo-600" /> {title}
        </span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 border-t">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   About Page
   ═══════════════════════════════════════════════════════════════ */
export default function AboutPage() {
  return (
    <div className="py-8 space-y-8">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Info size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">About GenAI Ops Framework</h1>
            <p className="mt-2 text-indigo-100 max-w-3xl leading-relaxed">
              A <strong>developer & tester focused</strong> platform for managing GenAI workloads.
              Bring your <strong>model endpoint URL + API key</strong> — no Azure subscription access,
              Owner role, or ARM SDK required. Covers the full GenAI lifecycle — from model A/B testing
              and prompt management to evaluation, performance testing, security, RAG pipelines, and
              cost optimisation.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 text-sm text-indigo-200">
          <span className="px-3 py-1 bg-white/15 rounded-full">v0.1</span>
          <span className="px-3 py-1 bg-white/15 rounded-full">MIT License</span>
          <span className="px-3 py-1 bg-white/15 rounded-full">FastAPI + React</span>
        </div>
      </div>

      {/* ── Who is this for ──────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="font-semibold text-amber-800 flex items-center gap-2">
          <BookOpen size={18} /> Who is this for?
        </h2>
        <p className="mt-2 text-sm text-amber-700 leading-relaxed">
          Developers, QA engineers, and testers who have a model endpoint URL and API key for a
          large-language model (Azure OpenAI, OpenAI, or any OpenAI-compatible service) and need to
          evaluate, benchmark, and operate that model — <strong>without subscription-level Azure access</strong>.
        </p>
      </div>

      {/* ── Architecture ─────────────────────────────────────── */}
      <Section title="Architecture" icon={Layers} defaultOpen>
        <div className="mt-4 space-y-4">
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-5 text-xs leading-relaxed overflow-x-auto font-mono">
{`┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite + Tailwind)            │
│  Home ┃ Model Endpoints ┃ Testing ┃ Prompts ┃ Evaluation ┃ …   │
└────────────────────┬────────────────────────────────────────────┘
                     │ /api/*
┌────────────────────▼────────────────────────────────────────────┐
│                     FastAPI Backend                              │
│  ┌───────────────┐ ┌─────────────┐ ┌──────────────┐            │
│  │ Model         │ │ A/B Testing │ │ Prompt Mgmt  │            │
│  │ Endpoints     │ │             │ │              │            │
│  └───────────────┘ └─────────────┘ └──────────────┘            │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Evaluation  │ │  Security    │ │ Cost Track  │ │ Perf Test│ │
│  └─────────────┘ └──────────────┘ └────────────┘ └──────────┘ │
│  ┌─────────────┐ ┌──────────────────────────────────────────┐  │
│  │ RAG Pipeline│ │ Azure Monitor (optional — sub owners)     │  │
│  └─────────────┘ └──────────────────────────────────────────┘  │
│                                                                  │
│  Model Provider Layer (Azure OpenAI / OpenAI / Custom HTTP)     │
│  ↑ endpoints + keys come from Model Endpoints registry           │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  SQLite / PostgreSQL    │
        │  + data/endpoints.json  │
        └─────────────────────────┘`}
          </pre>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-800 text-sm">Key concept — Model Endpoints</h4>
            <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
              The <strong>Model Endpoints</strong> page is the primary way to configure model access.
              Register one or more model endpoints (URL + API key + deployment name), and every tool
              in the framework can use those registered endpoints via the deployment dropdown.
              Azure subscription scanning is kept as an <em>optional</em> feature — never required.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Features ─────────────────────────────────────────── */}
      <Section title="Features" icon={Layers} defaultOpen>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <span className={`p-1.5 rounded-lg ${f.color}`}>
                  <f.icon size={16} />
                </span>
                <h4 className="font-semibold text-sm text-gray-800">{f.title}</h4>
              </div>
              {f.note && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-2">{f.note}</p>
              )}
              <ul className="space-y-1">
                {f.items.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Quick Start ──────────────────────────────────────── */}
      <Section title="Quick Start" icon={Rocket}>
        <div className="mt-4 space-y-4">
          <div className="text-sm text-gray-600 mb-2">
            <strong>Prerequisites:</strong> Python 3.10+, Node.js 18+, a model endpoint URL & API key.
            <span className="text-gray-400"> (Optional: Docker, Azure CLI for Monitor scanning)</span>
          </div>
          {quickStartSteps.map((step, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <step.icon size={16} className="text-indigo-600" />
                <h4 className="font-semibold text-sm">{step.title}</h4>
              </div>
              {step.code && (
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs mt-2 overflow-x-auto font-mono">
                  {step.code}
                </pre>
              )}
              <p className="text-xs text-gray-500 mt-2">{step.note}</p>
            </div>
          ))}
          {/* Docker */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-gray-600 text-white text-xs flex items-center justify-center font-bold">
                <Layers size={12} />
              </span>
              <h4 className="font-semibold text-sm">Docker (alternative)</h4>
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs mt-2 overflow-x-auto font-mono">
{`# Development (hot-reload)
docker-compose up

# Production build
docker build -t genaiops .
docker run -p 80:80 --env-file .env genaiops`}
            </pre>
          </div>
        </div>
      </Section>

      {/* ── API Routes ───────────────────────────────────────── */}
      <Section title="API Routes" icon={Code2}>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">
            Full Swagger documentation is available at{' '}
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              http://localhost:8000/docs <ExternalLink size={12} />
            </a>
          </p>
          {apiRoutes.map((group) => (
            <div key={group.module}>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group.module}</h4>
              <div className="space-y-1">
                {group.routes.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold ${methodBadge(r.method)}`}>
                      {r.method}
                    </span>
                    <code className="text-gray-700 font-mono">{r.path}</code>
                    <span className="text-gray-400">—</span>
                    <span className="text-gray-600">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Project Structure ────────────────────────────────── */}
      <Section title="Project Structure" icon={FolderTree}>
        <pre className="mt-4 bg-gray-900 text-gray-100 rounded-lg p-5 text-xs leading-relaxed overflow-x-auto font-mono">
{`aiopsframework/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Settings from .env
│   ├── database.py             # Async SQLAlchemy setup
│   ├── models/                 # ORM models
│   ├── schemas/                # Pydantic request/response schemas
│   ├── api/                    # Route handlers
│   │   ├── endpoint_registry   # Model endpoint CRUD + test
│   │   ├── ab_testing          # A/B experiment endpoints
│   │   ├── evaluation          # Response comparison
│   │   ├── performance         # Stress testing
│   │   ├── security            # Security scans
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── model_provider      # Unified LLM abstraction
│   │   ├── evaluation          # Similarity/BLEU/ROUGE metrics
│   │   ├── rag_pipeline        # RAG with vector store
│   │   └── ...
│   └── utils/                  # Shared helpers
├── data/
│   └── endpoints.json          # Registered model endpoints
├── frontend/
│   └── src/
│       ├── App.tsx             # Route definitions
│       ├── api/client.ts       # Axios API client
│       ├── components/         # Shared components
│       └── pages/              # Page components
├── tests/                      # Pytest test suite
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml`}
        </pre>
      </Section>

      {/* ── Testing ──────────────────────────────────────────── */}
      <Section title="Running Tests" icon={TestTube2}>
        <div className="mt-4">
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono">
{`pip install -e ".[dev]"
pytest tests/ -v`}
          </pre>
        </div>
      </Section>

      {/* ── Deployment ───────────────────────────────────────── */}
      <Section title="Deployment to Customers" icon={Rocket}>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            Designed for <strong>developer & tester teams</strong> who receive model endpoint credentials
            and need to validate, benchmark, and operate those models.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Container deployment', desc: 'Single Docker image with both frontend and backend' },
              { title: 'Kubernetes / AKS', desc: 'Use the Dockerfile with a Helm chart' },
              { title: 'Azure App Service', desc: 'Deploy the Docker image directly' },
              { title: 'Environment separation', desc: 'Each team/customer gets their own .env with credentials' },
            ].map((d) => (
              <div key={d.title} className="bg-gray-50 border rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-800">{d.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{d.desc}</p>
              </div>
            ))}
          </div>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono mt-3">
{`Customer / Team Environment
├── GenAI Ops Framework  ← this solution
├── Model Endpoints (Azure OpenAI, OpenAI, etc.)
│   └── accessed via URL + API key
└── (Optional) Vector Database (Azure AI Search, etc.)`}
          </pre>
        </div>
      </Section>

      {/* ── Extending ────────────────────────────────────────── */}
      <Section title="Extending the Framework" icon={Code2}>
        <ul className="mt-4 space-y-2">
          {[
            ['Add new LLM providers', 'Implement a new _call_* function in backend/services/model_provider.py'],
            ['External vector DB', 'Replace InMemoryVectorStore with FAISS, Pinecone, Weaviate, or Azure AI Search'],
            ['Authentication', 'Add OAuth2/Azure AD middleware to backend/main.py'],
            ['External endpoint store', 'Replace data/endpoints.json with a database or secret manager'],
            ['CI/CD', 'Add GitHub Actions or Azure DevOps pipeline'],
            ['Monitoring', 'Prometheus metrics endpoint is ready (add /metrics route)'],
          ].map(([title, desc]) => (
            <li key={title} className="flex items-start gap-2 text-sm">
              <span className="text-indigo-500 font-bold mt-0.5">→</span>
              <span>
                <strong className="text-gray-800">{title}:</strong>{' '}
                <span className="text-gray-600">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="text-center text-xs text-gray-400 pt-4 border-t">
        GenAI Ops Framework v0.1 &middot; MIT License &middot; &copy; 2026 AI Ops Team
      </div>
    </div>
  );
}
