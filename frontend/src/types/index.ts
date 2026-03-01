/* ─── Shared TypeScript types ─── */

export type DeploymentType = 'Standard' | 'PTU' | 'GlobalStandard' | 'ProvisionedManaged' | 'GlobalProvisionedManaged' | 'DataZone';

export interface ModelConfig {
  provider: string;
  deployment: string;
  deployment_type?: DeploymentType;
  params?: Record<string, unknown>;
}

// ── Experiment (A/B Testing) ───
export interface ExperimentCreate {
  name: string;
  description?: string;
  model_a: ModelConfig;
  model_b: ModelConfig;
  prompt_id?: string;
  system_message_override?: string;
  questions: string[];
}

export interface ExperimentResult {
  id: string;
  experiment_id: string;
  question_index: number;
  question_text: string;
  model_a_response?: string;
  model_a_latency_ms?: number;
  model_a_tokens_prompt?: number;
  model_a_tokens_completion?: number;
  model_b_response?: string;
  model_b_latency_ms?: number;
  model_b_tokens_prompt?: number;
  model_b_tokens_completion?: number;
  semantic_similarity?: number;
  bleu_score?: number;
  rouge_l_score?: number;
  model_a_cost_usd?: number;
  model_b_cost_usd?: number;
  human_preference?: string;
  human_notes?: string;
  created_at: string;
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  model_a_provider: string;
  model_a_deployment: string;
  model_b_provider: string;
  model_b_deployment: string;
  status: string;
  total_questions: number;
  completed_questions: number;
  created_at: string;
  updated_at: string;
}

export interface ExperimentDetail extends Experiment {
  results: ExperimentResult[];
  summary?: ExperimentSummary;
}

export interface ExperimentSummary {
  experiment_id: string;
  total_questions: number;
  avg_semantic_similarity?: number;
  avg_model_a_latency_ms?: number;
  avg_model_b_latency_ms?: number;
  total_model_a_cost_usd?: number;
  total_model_b_cost_usd?: number;
  model_a_wins: number;
  model_b_wins: number;
  ties: number;
  similarity_distribution?: Record<string, number>;
}

// ── Evaluation ───
export interface EvaluationRequest {
  question: string;
  response_a: string;
  response_b: string;
  reference_answer?: string;
}

export interface EvaluationResult {
  semantic_similarity: number;
  bleu_score?: number;
  rouge_l_score?: number;
  coherence_score_a?: number;
  coherence_score_b?: number;
  verdict: string;
}

// ── Performance ───
export interface PerformanceTestRequest {
  model_provider: string;
  model_deployment: string;
  model_params?: Record<string, unknown>;
  system_message?: string;
  questions: string[];
  concurrency: number;
  total_requests: number;
  timeout_seconds: number;
}

export interface PerformanceTestResult {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p90_latency_ms: number;
  p99_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  requests_per_second: number;
  avg_tokens_per_second?: number;
  total_cost_usd?: number;
  error_details?: Array<Record<string, unknown>>;
}

// ── Security ───
export interface SecurityCheckResult {
  passed: boolean;
  risk_level: string;
  flags: string[];
  redacted_text?: string;
  details?: string;
}

// ── Model Endpoints (developer / tester focused) ───
export interface RegisteredEndpoint {
  id: string;
  name: string;
  provider: string;
  endpoint_url: string;
  api_key_hint: string;
  deployment_name: string;
  model_name: string;
  model_version: string;
  api_version: string;
  is_active: boolean;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface EndpointCreate {
  name: string;
  provider: string;
  endpoint_url: string;
  api_key: string;
  deployment_name: string;
  model_name?: string;
  model_version?: string;
  api_version?: string;
  tags?: Record<string, string>;
}

export interface EndpointTestResult {
  success: boolean;
  response?: string;
  error?: string;
  latency_ms?: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  model_name?: string;
}

// ── Azure Monitor (optional — for subscription owners) ───
export interface SubscriptionInfo {
  subscription_id: string;
  display_name: string;
  state: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  resource_group: string;
  location: string;
}

export interface TargetModelInput {
  model_name: string;
  versions: string[];
}

export interface ScanRequest {
  subscription_id: string;
  target_models?: TargetModelInput[];
  log_analytics_workspace_id?: string;
}

export interface DeploymentInfo {
  account: string;
  resource_group: string;
  location: string;
  deployment: string;
  model_name: string;
  model_version: string;
  sku: string;
  deployment_type?: DeploymentType;
  capacity?: number;
  resource_id: string;
  source?: string;  // 'registered' for model endpoints, undefined for Azure Monitor
}

export interface TargetedDeployment extends DeploymentInfo {
  total_calls_7d: number;
  processed_tokens_7d: number;
  generated_tokens_7d: number;
}

export interface DetailedLog {
  workspace_id: string;
  time_generated: string;
  resource_id: string;
  operation: string;
  caller_ip: string;
  identity: string;
  user_agent: string;
  properties: string;
}

export interface ScanResult {
  subscription_id: string;
  scanned_at: string;
  accounts_found: number;
  total_deployments: number;
  all_deployments: DeploymentInfo[];
  targeted_deployments: TargetedDeployment[];
  no_diagnostics: Array<{ resource_group: string; account: string; resource_id: string }>;
  detailed_logs: DetailedLog[];
}

export interface AccountInfo {
  name: string;
  resource_group: string;
  location: string;
  resource_id: string;
}

export interface DeploymentMetricsResult {
  total_calls: number;
  processed_tokens: number;
  generated_tokens: number;
}

export interface TestDeploymentRequest {
  resource_id: string;
  deployment_name: string;
  prompt?: string;
  system_message?: string;
  max_tokens?: number;
}

export interface TestDeploymentResult {
  deployment_name: string;
  model_name: string;
  model_version: string;
  prompt: string;
  response: string;
  latency_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
  success: boolean;
  error?: string;
}

// ── Golden Dataset ───
export interface GoldenTestCaseInput {
  question: string;
  expected_answer?: string;
  context?: string;
  category?: string;
  difficulty?: string;
  language?: string;
  tags?: Record<string, unknown>;
}

export interface GoldenDatasetCreate {
  name: string;
  description?: string;
  tags?: Record<string, unknown>;
  cases: GoldenTestCaseInput[];
}

export interface GoldenDataset {
  id: string;
  name: string;
  description?: string;
  source_filename?: string;
  tags?: Record<string, unknown>;
  total_cases: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoldenTestCaseOut {
  id: string;
  dataset_id: string;
  index: number;
  question: string;
  expected_answer?: string;
  context?: string;
  category?: string;
  difficulty?: string;
  language?: string;
  tags?: Record<string, unknown>;
  created_at: string;
}

export interface GoldenDatasetDetail extends GoldenDataset {
  cases: GoldenTestCaseOut[];
}

// ── Migration Pipeline ───
export interface MigrationModelConfig {
  provider: string;
  deployment: string;
  deployment_type?: DeploymentType;
  params?: Record<string, unknown>;
}

export interface MigrationRunCreate {
  name: string;
  description?: string;
  golden_dataset_id: string;
  source_model: MigrationModelConfig;
  target_model: MigrationModelConfig;
  system_message?: string;
  prompt_id?: string;
  similarity_threshold?: number;
  deployment_type?: DeploymentType;
}

export interface MigrationResult {
  id: string;
  migration_run_id: string;
  case_index: number;
  question: string;
  expected_answer?: string;
  category?: string;
  source_response?: string;
  source_latency_ms?: number;
  source_tokens_prompt?: number;
  source_tokens_completion?: number;
  source_cost_usd?: number;
  source_error?: string;
  target_response?: string;
  target_latency_ms?: number;
  target_tokens_prompt?: number;
  target_tokens_completion?: number;
  target_cost_usd?: number;
  target_error?: string;
  similarity_score?: number;
  source_reference_score?: number;
  target_reference_score?: number;
  bleu_score?: number;
  rouge_l_score?: number;
  source_passed?: string;
  target_passed?: string;
  regression?: string;
  created_at: string;
}

export interface MigrationRun {
  id: string;
  name: string;
  description?: string;
  golden_dataset_id: string;
  source_provider: string;
  source_deployment: string;
  source_deployment_type?: DeploymentType;
  target_provider: string;
  target_deployment: string;
  target_deployment_type?: DeploymentType;
  status: string;
  total_cases: number;
  completed_cases: number;
  source_avg_latency_ms?: number;
  target_avg_latency_ms?: number;
  source_total_cost_usd?: number;
  target_total_cost_usd?: number;
  avg_similarity?: number;
  avg_source_reference_score?: number;
  avg_target_reference_score?: number;
  pass_rate_source?: number;
  pass_rate_target?: number;
  recommendation?: string;
  created_at: string;
  completed_at?: string;
}

export interface MigrationRunDetail extends MigrationRun {
  results: MigrationResult[];
}

export interface MigrationSummary {
  migration_run_id: string;
  name: string;
  source_deployment: string;
  source_deployment_type?: DeploymentType;
  target_deployment: string;
  target_deployment_type?: DeploymentType;
  total_cases: number;
  completed_cases: number;
  source_avg_latency_ms?: number;
  target_avg_latency_ms?: number;
  latency_change_pct?: number;
  source_total_cost_usd?: number;
  target_total_cost_usd?: number;
  cost_change_pct?: number;
  avg_similarity?: number;
  avg_source_reference_score?: number;
  avg_target_reference_score?: number;
  quality_change_pct?: number;
  pass_rate_source?: number;
  pass_rate_target?: number;
  no_regression_count: number;
  minor_regression_count: number;
  major_regression_count: number;
  recommendation?: string;
  recommendation_reason?: string;
}

export interface ParameterDiff {
  source_model: string;
  target_model: string;
  parameter_differences: Array<{
    parameter: string;
    source_value: string;
    target_value: string;
    impact: string;
  }>;
  compatibility_notes: string[];
  migration_checklist: string[];
}

export interface ParameterDiffRequest {
  source_model: MigrationModelConfig;
  target_model: MigrationModelConfig;
}

// ── Codebase Audit ───
export interface AuditFinding {
  pattern: string;
  severity: string;
  file?: string;
  line: number;
  column: number;
  match: string;
  recommendation: string;
}

export interface AuditReport {
  total_findings: number;
  severity_counts: Record<string, number>;
  by_type: Record<string, number>;
  recommended_actions: string[];
  ready_for_migration: boolean;
  findings: AuditFinding[];
}

export interface AuditPattern {
  name: string;
  severity: string;
  recommendation: string;
  regex: string;
}

// ── Shadow Testing ───
export interface ShadowModelResult {
  provider: string;
  deployment: string;
  response: string;
  latency_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
  error: string | null;
  reference_score: number | null;
}

export interface ShadowTestResult {
  baseline: ShadowModelResult;
  canary: ShadowModelResult;
  similarity: Record<string, number>;
  served_model: string;
}

export interface ShadowBatchResult {
  results: Array<ShadowTestResult & { test_id: string; query: string }>;
  summary: {
    total_tests: number;
    baseline_avg_latency_ms: number | null;
    canary_avg_latency_ms: number | null;
    avg_similarity: number | null;
    baseline_errors: number;
    canary_errors: number;
  };
}

export interface TrafficConfig {
  enabled: boolean;
  canary_percentage: number;
  baseline_deployment?: string;
  baseline_deployment_type?: DeploymentType;
  canary_deployment?: string;
  canary_deployment_type?: DeploymentType;
}

export interface CanaryStage {
  name: string;
  percentage: number;
  duration: string;
  success_criteria: string;
}

// ── RAG Pipeline ───
export interface RAGDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface RAGIngestResult {
  status: string;
  documents_ingested: number;
  chunks_created: number;
}

export interface RAGContextChunk {
  chunk_id: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RAGQueryResult {
  question: string;
  answer: string;
  context_chunks: RAGContextChunk[];
  provider: string;
  deployment: string;
  latency_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
}

// ── Foundry Evaluation ───
export interface FoundryEvalResult {
  [metric: string]: { score: number; method: string } | boolean;
  _sdk_available: boolean;
}

export interface FoundryNlpResult {
  [metric: string]: { result: Record<string, number>; method: string } | boolean;
  _nlp_sdk_available: boolean;
}

export interface FoundryContentSafetyResult {
  violence: { score: number; method: string };
  sexual: { score: number; method: string };
  hate_unfairness: { score: number; method: string };
  self_harm: { score: number; method: string };
  indirect_attack?: { score: number; method: string };
  protected_material?: { score: number; method: string };
  _sdk_available: boolean;
}

export interface FoundrySdkStatus {
  sdk_available: boolean;
  configured: boolean;
  fallback_mode: boolean;
  note: string;
  nlp_evaluators: boolean;
  advanced_safety: boolean;
  simulator: boolean;
  batch_evaluate: boolean;
  available_evaluators: {
    ai_quality: string[];
    nlp: string[];
    safety: string[];
    simulator: string[];
  };
}

export interface DatasetEvalResult {
  metrics: Record<string, number>;
  rows: Record<string, unknown>[];
  method: string;
  error?: string;
}

export interface SimulationResult {
  scenario: string;
  conversations: Array<string | Record<string, string>>;
  count: number;
  method: string;
}

// ── Data Sources ───
export type DataSourceType = 'log_analytics' | 'cosmos_db' | 'blob_storage' | 'http';

export interface DataSourceResult {
  source_type: DataSourceType;
  record_count: number;
  records: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

export interface FieldMappingPreview {
  detected_mapping: Record<string, string>;
  available_fields: string[];
  golden_fields: string[];
  sample_record: Record<string, unknown>;
}

export interface DataSourceImportResult {
  status: string;
  dataset_id?: string;
  dataset_name?: string;
  cases_imported?: number;
  cases_skipped?: number;
  documents_ingested?: number;
  chunks_created?: number;
}
