import axios from 'axios';
import type {
  Experiment,
  ExperimentCreate,
  ExperimentDetail,
  EvaluationRequest,
  EvaluationResult,
  PerformanceTestRequest,
  PerformanceTestResult,
  SecurityCheckResult,
  ScanRequest,
  ScanResult,
  AccountInfo,
  DeploymentInfo,
  DeploymentMetricsResult,
  TestDeploymentRequest,
  TestDeploymentResult,
  SubscriptionInfo,
  WorkspaceInfo,
  RegisteredEndpoint,
  EndpointCreate,
  EndpointTestResult,
  GoldenDataset,
  GoldenDatasetCreate,
  GoldenDatasetDetail,
  MigrationRun,
  MigrationRunCreate,
  MigrationRunDetail,
  MigrationSummary,
  ParameterDiff,
  ParameterDiffRequest,
  RAGIngestResult,
  RAGQueryResult,
  FoundryEvalResult,
  FoundryNlpResult,
  FoundryContentSafetyResult,
  FoundrySdkStatus,
  DatasetEvalResult,
  SimulationResult,
} from '../types';

const api = axios.create({ baseURL: '/api' });

// ── A/B Testing ───
export const createExperiment = (data: ExperimentCreate) =>
  api.post<Experiment>('/experiments', data).then((r) => r.data);

export const uploadExperiment = (formData: FormData) =>
  api.post<Experiment>('/experiments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const listExperiments = () =>
  api.get<Experiment[]>('/experiments').then((r) => r.data);

export const getExperiment = (id: string) =>
  api.get<ExperimentDetail>(`/experiments/${id}`).then((r) => r.data);

export const submitFeedback = (experimentId: string, resultId: string, preference: string, notes?: string) =>
  api.put(`/experiments/${experimentId}/results/${resultId}/feedback`, { preference, notes });

// ── Evaluation ───
export const evaluatePair = (data: EvaluationRequest) =>
  api.post<EvaluationResult>('/evaluate', data).then((r) => r.data);

// ── Performance ───
export const runPerformanceTest = (data: PerformanceTestRequest) =>
  api.post<PerformanceTestResult>('/performance/test', data).then((r) => r.data);

// ── Security ───
export const securityCheck = (text: string) =>
  api.post<SecurityCheckResult>('/security/check', { text }).then((r) => r.data);

// ── Costs ───
export const getCostSummary = (days = 30) =>
  api.get(`/costs/summary`, { params: { days } }).then((r) => r.data);

// ── Model Endpoints (developer / tester focused) ───
export const registerEndpoint = (data: EndpointCreate) =>
  api.post<RegisteredEndpoint>('/model-endpoints', data).then((r) => r.data);

export const listEndpoints = (activeOnly = true) =>
  api.get<RegisteredEndpoint[]>('/model-endpoints', { params: { active_only: activeOnly } }).then((r) => r.data);

export const getEndpoint = (id: string) =>
  api.get<RegisteredEndpoint>(`/model-endpoints/${id}`).then((r) => r.data);

export const updateEndpoint = (id: string, data: Partial<EndpointCreate & { is_active: boolean }>) =>
  api.put<RegisteredEndpoint>(`/model-endpoints/${id}`, data).then((r) => r.data);

export const deleteEndpoint = (id: string) =>
  api.delete(`/model-endpoints/${id}`).then((r) => r.data);

export const testEndpoint = (id: string, prompt?: string) =>
  api.post<EndpointTestResult>(`/model-endpoints/${id}/test`, { prompt: prompt || 'Hello, are you working?' }).then((r) => r.data);

export const listRegisteredDeployments = () =>
  api.get<DeploymentInfo[]>('/model-endpoints/deployments').then((r) => r.data);

// ── Azure Monitor (optional — for subscription owners) ───
export const listSubscriptions = () =>
  api.get<SubscriptionInfo[]>('/azure-monitor/subscriptions').then((r) => r.data);

export const listWorkspaces = (subscriptionId: string) =>
  api.get<WorkspaceInfo[]>('/azure-monitor/workspaces', { params: { subscription_id: subscriptionId } }).then((r) => r.data);

export const scanSubscription = (data: ScanRequest) =>
  api.post<ScanResult>('/azure-monitor/scan', data).then((r) => r.data);

export const listAzureAccounts = (subscriptionId: string) =>
  api.get<AccountInfo[]>('/azure-monitor/accounts', { params: { subscription_id: subscriptionId } }).then((r) => r.data);

export const listAzureDeployments = (subscriptionId: string, resourceGroup: string, accountName: string) =>
  api.get<DeploymentInfo[]>('/azure-monitor/deployments', {
    params: { subscription_id: subscriptionId, resource_group: resourceGroup, account_name: accountName },
  }).then((r) => r.data);

export const listAllAzureDeployments = (subscriptionId: string) =>
  api.get<DeploymentInfo[]>('/azure-monitor/all-deployments', {
    params: { subscription_id: subscriptionId },
  }).then((r) => r.data);

export const getAzureDeploymentMetrics = (
  subscriptionId: string,
  resourceId: string,
  deploymentName: string,
  modelName: string,
  days = 7,
) =>
  api
    .get<DeploymentMetricsResult>('/azure-monitor/metrics', {
      params: { subscription_id: subscriptionId, resource_id: resourceId, deployment_name: deploymentName, model_name: modelName, days },
    })
    .then((r) => r.data);

export const testDeployment = (data: TestDeploymentRequest) =>
  api.post<TestDeploymentResult>('/azure-monitor/test-deployment', data).then((r) => r.data);

// ── Golden Datasets ───
export const listGoldenDatasets = () =>
  api.get<GoldenDataset[]>('/golden-datasets').then((r) => r.data);

export const createGoldenDataset = (data: GoldenDatasetCreate) =>
  api.post<GoldenDataset>('/golden-datasets', data).then((r) => r.data);

export const uploadGoldenDataset = (formData: FormData) =>
  api.post<GoldenDataset>('/golden-datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const getGoldenDataset = (id: string) =>
  api.get<GoldenDatasetDetail>(`/golden-datasets/${id}`).then((r) => r.data);

export const deleteGoldenDataset = (id: string) =>
  api.delete(`/golden-datasets/${id}`);

export const seedSampleDatasets = () =>
  api.post<GoldenDataset[]>('/golden-datasets/seed-samples').then((r) => r.data);

// ── Prompts ───
export const listPrompts = (activeOnly = true) =>
  api.get<any[]>('/prompts', { params: { active_only: activeOnly } }).then((r) => r.data);

export const createPromptApi = (data: { name: string; description?: string; system_message?: string; tags?: Record<string, any>; initial_content: string }) =>
  api.post<any>('/prompts', data).then((r) => r.data);

export const deletePromptApi = (id: string) =>
  api.delete(`/prompts/${id}`);

export const seedSamplePrompts = () =>
  api.post<any[]>('/prompts/seed-samples').then((r) => r.data);

// ── Migration Pipeline ───
export const listMigrationRuns = () =>
  api.get<MigrationRun[]>('/migration/runs').then((r) => r.data);

export const createMigrationRun = (data: MigrationRunCreate) =>
  api.post<MigrationRun>('/migration/runs', data).then((r) => r.data);

export const getMigrationRun = (id: string) =>
  api.get<MigrationRunDetail>(`/migration/runs/${id}`).then((r) => r.data);

export const getMigrationSummary = (id: string) =>
  api.get<MigrationSummary>(`/migration/runs/${id}/summary`).then((r) => r.data);

export const exportMigrationRun = (id: string, format: 'csv' | 'json' = 'csv') =>
  api.get(`/migration/runs/${id}/export`, { params: { format }, responseType: format === 'csv' ? 'text' : 'json' }).then((r) => r.data);

export const getParameterDiff = (data: ParameterDiffRequest) =>
  api.post<ParameterDiff>('/migration/parameter-diff', data).then((r) => r.data);

// ── Codebase Audit ───
export const scanCodeText = (code: string, filename?: string, targetDeployment?: string) =>
  api.post('/audit/scan-text', { code, filename, target_deployment: targetDeployment || '' }).then((r) => r.data);

export const scanUploadedFile = (formData: FormData) =>
  api.post('/audit/scan-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);

export const listAuditPatterns = () =>
  api.get('/audit/patterns').then((r) => r.data);

export const getModelFamilies = () =>
  api.get('/audit/model-families').then((r) => r.data);

// ── Migration Guide ───
export const getMigrationGuide = (baseline?: string, target?: string) =>
  api.get('/migration-guide', {
    params: {
      ...(baseline ? { baseline } : {}),
      ...(target ? { target } : {}),
    },
  }).then((r) => r.data);

export const getMigrationChecklist = () =>
  api.get('/migration-guide/checklist').then((r) => r.data);

export const getMigrationFaq = (category?: string) =>
  api.get('/migration-guide/faq', { params: category ? { category } : {} }).then((r) => r.data);

export const getCodeExamples = () =>
  api.get('/migration-guide/code-examples').then((r) => r.data);

export const getParameterChanges = () =>
  api.get('/migration-guide/parameter-changes').then((r) => r.data);

export const checkQualityGates = (candidateScores: Record<string, number>, baselineScores?: Record<string, number>) =>
  api.post('/migration-guide/quality-gates', { candidate_scores: candidateScores, baseline_scores: baselineScores }).then((r) => r.data);

export const compareScores = (baselineScores: Record<string, number>, candidateScores: Record<string, number>) =>
  api.post('/migration-guide/compare-scores', { baseline_scores: baselineScores, candidate_scores: candidateScores }).then((r) => r.data);

// ── Shadow Testing ───
export const runShadowTest = (data: {
  messages: Array<{ role: string; content: string }>;
  baseline_deployment: string;
  canary_deployment: string;
  baseline_provider?: string;
  canary_provider?: string;
  reference_answer?: string;
}) =>
  api.post('/shadow-testing/test', data).then((r) => r.data);

export const runShadowTestBatch = (data: {
  test_cases: Array<Record<string, string>>;
  baseline_deployment: string;
  canary_deployment: string;
  baseline_provider?: string;
  canary_provider?: string;
  system_message?: string;
}) =>
  api.post('/shadow-testing/test-batch', data).then((r) => r.data);

export const getShadowTestConfig = () =>
  api.get('/shadow-testing/config').then((r) => r.data);

export const updateShadowTestConfig = (data: Record<string, unknown>) =>
  api.put('/shadow-testing/config', data).then((r) => r.data);

export const getCanaryStages = () =>
  api.get('/shadow-testing/canary-stages').then((r) => r.data);

// ── RAG Pipeline ───
export const ingestRAGDocuments = (documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>, chunkSize = 512, chunkOverlap = 64) =>
  api.post<RAGIngestResult>('/rag/ingest', { documents, chunk_size: chunkSize, chunk_overlap: chunkOverlap }).then((r) => r.data);

export const queryRAG = (question: string, provider = 'azure_openai', deployment = '', topK = 5, systemMessage?: string) =>
  api.post<RAGQueryResult>('/rag/query', { question, provider, deployment, top_k: topK, system_message: systemMessage }).then((r) => r.data);

export const clearRAGStore = () =>
  api.delete('/rag/store').then((r) => r.data);

// ── Foundry Evaluation ───
export const getFoundrySdkStatus = () =>
  api.get<FoundrySdkStatus>('/foundry-eval/status').then((r) => r.data);

export const runFoundryEval = (data: { query?: string; response: string; context?: string; ground_truth?: string; metrics?: string[]; judge_deployment?: string }) =>
  api.post<FoundryEvalResult>('/foundry-eval/evaluate', data).then((r) => r.data);

export const runFoundryContentSafety = (data: { query?: string; response: string; include_advanced?: boolean }) =>
  api.post<FoundryContentSafetyResult>('/foundry-eval/content-safety', data).then((r) => r.data);

export const runFoundryNlp = (data: { response: string; ground_truth: string; metrics?: string[] }) =>
  api.post<FoundryNlpResult>('/foundry-eval/nlp', data).then((r) => r.data);

export const runFoundryDatasetEval = (data: { data: Array<Record<string, string>>; evaluators?: string[]; column_mapping?: Record<string, string>; judge_deployment?: string }) =>
  api.post<DatasetEvalResult>('/foundry-eval/dataset', data).then((r) => r.data);

export const runFoundrySimulation = (data: { scenario?: string; max_conversation_turns?: number; max_simulation_results?: number; target_endpoint?: string }) =>
  api.post<SimulationResult>('/foundry-eval/simulate', data).then((r) => r.data);

// ── Cost Alerts ───
export const getCostAlerts = (limit = 50) =>
  api.get('/costs/alerts', { params: { limit } }).then((r) => r.data);

export const clearCostAlerts = () =>
  api.post('/costs/alerts/clear').then((r) => r.data);

// ── Performance Runs ───
export const listPerformanceRuns = (limit = 20) =>
  api.get('/performance/runs', { params: { limit } }).then((r) => r.data);

// ── Auth ───
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then((r) => r.data);

export const register = (username: string, email: string, password: string) =>
  api.post('/auth/register', { username, email, password }).then((r) => r.data);

export const getMe = () =>
  api.get('/auth/me').then((r) => r.data);

// ── Continuous Evaluation ───
export const createContinuousEvalRun = (data: {
  name: string;
  description?: string;
  deployment?: string;
  model_version?: string;
  dataset: Array<Record<string, string>>;
  evaluators: string[];
  alert_thresholds?: Record<string, unknown>;
}) =>
  api.post('/continuous-eval/runs', data).then((r) => r.data);

export const listContinuousEvalRuns = (deployment?: string, limit = 50) =>
  api.get('/continuous-eval/runs', { params: { deployment, limit } }).then((r) => r.data);

export const getContinuousEvalRun = (runId: string) =>
  api.get(`/continuous-eval/runs/${runId}`).then((r) => r.data);

export const getContinuousEvalDashboard = () =>
  api.get('/continuous-eval/dashboard').then((r) => r.data);

export const getMetricTrends = (metric: string, deployment?: string, limit = 20) =>
  api.get(`/continuous-eval/trends/${metric}`, { params: { deployment, limit } }).then((r) => r.data);

export const listEvalAlerts = (status?: string, limit = 50) =>
  api.get('/continuous-eval/alerts', { params: { status, limit } }).then((r) => r.data);

export const ackEvalAlert = (alertId: string) =>
  api.put(`/continuous-eval/alerts/${alertId}/ack`).then((r) => r.data);

export const getAlertThresholds = () =>
  api.get('/continuous-eval/alert-thresholds').then((r) => r.data);

export const updateAlertThresholds = (thresholds: Record<string, unknown>) =>
  api.put('/continuous-eval/alert-thresholds', thresholds).then((r) => r.data);

export const createEvalSchedule = (data: {
  name: string;
  deployment: string;
  golden_dataset_id: string;
  evaluators: string[];
  trigger?: string;
  cron_expression?: string;
}) =>
  api.post('/continuous-eval/schedules', data).then((r) => r.data);

export const listEvalSchedules = () =>
  api.get('/continuous-eval/schedules').then((r) => r.data);

export const deleteEvalSchedule = (id: string) =>
  api.delete(`/continuous-eval/schedules/${id}`).then((r) => r.data);

export const submitHumanReview = (data: {
  run_id: string;
  row_index: number;
  reviewer?: string;
  rating?: number;
  feedback?: string;
  suggested_response?: string;
  flags?: string[];
}) =>
  api.post('/continuous-eval/reviews', data).then((r) => r.data);

export const listHumanReviews = (runId?: string, limit = 50) =>
  api.get('/continuous-eval/reviews', { params: { run_id: runId, limit } }).then((r) => r.data);

export const getReviewSummary = (runId: string) =>
  api.get(`/continuous-eval/reviews/summary/${runId}`).then((r) => r.data);

export const runUxEvaluation = (data: {
  query?: string;
  response: string;
  context?: string;
  ground_truth?: string;
  expected_tone?: string;
  metrics?: string[];
}) =>
  api.post('/continuous-eval/ux-evaluate', data).then((r) => r.data);

export default api;
