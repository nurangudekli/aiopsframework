import type { TrafficConfig, CanaryStage, ShadowTestResult, ShadowBatchResult } from '../types';

const mockBaseline = (response: string, latency: number, prompt: number, completion: number) => ({
  provider: 'azure_openai',
  deployment: 'baseline-prod',
  response,
  latency_ms: latency,
  tokens_prompt: prompt,
  tokens_completion: completion,
  error: null,
  reference_score: null,
});

const mockCanary = (response: string, latency: number, prompt: number, completion: number) => ({
  provider: 'azure_openai',
  deployment: 'candidate-canary',
  response,
  latency_ms: latency,
  tokens_prompt: prompt,
  tokens_completion: completion,
  error: null,
  reference_score: null,
});

export const mockShadowTestResult: ShadowTestResult = {
  baseline: mockBaseline('Your current monthly charges are $49.99 for the Premium plan. There are no additional overage fees on your account this billing period.', 820, 40, 45),
  canary: mockCanary('Based on your account details, your February charges are:\n- Premium plan: $49.99\n- Overage fees: $0.00\n- Total: $49.99\n\nYour next billing date is March 1, 2026.', 640, 40, 52),
  similarity: { semantic_similarity: 0.91, jaccard: 0.42, cosine: 0.88 },
  served_model: 'baseline-prod',
};

export const mockShadowBatchResult: ShadowBatchResult = {
  results: [
    {
      test_id: 'test_0', query: 'What are my charges for this month?',
      baseline: mockBaseline('Your current charges are $49.99 for the Premium plan.', 820, 30, 35),
      canary: mockCanary('Your February charges total $49.99 (Premium plan base fee).', 640, 30, 38),
      similarity: { semantic_similarity: 0.94, jaccard: 0.45 }, served_model: 'baseline-prod',
    },
    {
      test_id: 'test_1', query: 'How do I upgrade my plan?',
      baseline: mockBaseline('Go to Settings > Plan & Billing > Change Plan to upgrade.', 780, 25, 30),
      canary: mockCanary('To upgrade:\n1. Settings → Plan & Billing\n2. Select new plan\n3. Confirm changes', 620, 25, 37),
      similarity: { semantic_similarity: 0.91, jaccard: 0.38 }, served_model: 'baseline-prod',
    },
    {
      test_id: 'test_2', query: 'I need help with roaming.',
      baseline: mockBaseline('International roaming is available on Premium and Enterprise plans at $10/day.', 810, 22, 38),
      canary: mockCanary('Roaming is included in Premium & Enterprise plans. Daily rate: $10/day in 190+ countries. Enable in Settings → Roaming.', 650, 22, 50),
      similarity: { semantic_similarity: 0.87, jaccard: 0.35 }, served_model: 'baseline-prod',
    },
    {
      test_id: 'test_3', query: 'My internet speed is slow.',
      baseline: mockBaseline('Try restarting your router and checking for outages.', 790, 20, 28),
      canary: mockCanary('Troubleshooting steps:\n1. Restart router (30s)\n2. Check outages: status.example.com\n3. Test wired connection', 610, 20, 38),
      similarity: { semantic_similarity: 0.85, jaccard: 0.30 }, served_model: 'baseline-prod',
    },
    {
      test_id: 'test_4', query: 'Cancel my subscription.',
      baseline: mockBaseline('To cancel, go to Settings > Account > Cancel Subscription. Note: there is a 30-day notice period.', 775, 18, 37),
      canary: mockCanary('You can cancel in Settings → Account → Cancel Subscription. Please note:\n- 30-day notice required\n- Pro-rated refund available\n- Data retained for 90 days', 605, 18, 50),
      similarity: { semantic_similarity: 0.88, jaccard: 0.40 }, served_model: 'baseline-prod',
    },
  ],
  summary: {
    total_tests: 5,
    baseline_avg_latency_ms: 795,
    canary_avg_latency_ms: 625,
    avg_similarity: 0.89,
    baseline_errors: 0,
    canary_errors: 0,
  },
};

export const mockShadowConfig: TrafficConfig = {
  enabled: true,
  canary_percentage: 10,
  baseline_deployment: 'baseline-prod',
  baseline_deployment_type: 'Standard',
  canary_deployment: 'candidate-canary',
  canary_deployment_type: 'Standard',
};

export const mockCanaryStages: CanaryStage[] = [
  { name: 'Initial Canary', percentage: 5, duration: '24-48 hours', success_criteria: 'No errors, similarity > 0.85' },
  { name: 'Early Adopters', percentage: 25, duration: '3-5 days', success_criteria: 'Quality metrics stable, latency acceptable' },
  { name: 'Half Traffic', percentage: 50, duration: '1 week', success_criteria: 'All quality gates passing, no regressions' },
  { name: 'Majority', percentage: 75, duration: '3-5 days', success_criteria: 'Consistent performance at scale' },
  { name: 'Full Rollover', percentage: 100, duration: 'Permanent', success_criteria: 'Migration complete, old model decommissioned' },
];
