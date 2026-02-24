/**
 * Central mock-data module.
 *
 * Each export is keyed to its corresponding page / feature.
 * Pages import the slice they need and can swap between live API
 * and mock data via the `useMockToggle` hook.
 */

export { mockCostSummary } from './dashboard';
export { mockExperiments, mockExperimentDetail, mockEvaluationResult } from './experiments';
export { mockPerformanceResult } from './performance';
export { mockSecurityResult } from './security';
export { mockScanResult } from './azureMonitor';
export { mockGoldenDatasets, mockGoldenDatasetDetail } from './goldenDatasets';
export {
  mockMigrationRuns,
  mockMigrationRunDetail,
  mockMigrationSummary,
  mockParameterDiff,
} from './migration';
export { mockMigrationGuide, mockQualityGateResult, mockCompareResult } from './migrationGuide';
export { mockAuditReport, mockAuditPatterns } from './codebaseAudit';
export {
  mockShadowTestResult,
  mockShadowBatchResult,
  mockShadowConfig,
  mockCanaryStages,
} from './shadowTesting';
export { mockPrompts } from './prompts';
export {
  mockRAGIngestResult,
  mockRAGQueryResult,
  mockRAGDocuments,
} from './rag';
