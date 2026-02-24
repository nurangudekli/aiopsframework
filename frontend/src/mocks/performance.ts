import type { PerformanceTestResult } from '../types';

export const mockPerformanceResult: PerformanceTestResult = {
  total_requests: 100,
  successful_requests: 97,
  failed_requests: 3,
  avg_latency_ms: 742,
  p50_latency_ms: 680,
  p90_latency_ms: 1120,
  p99_latency_ms: 1850,
  min_latency_ms: 320,
  max_latency_ms: 2400,
  requests_per_second: 12.4,
  avg_tokens_per_second: 85.6,
  total_cost_usd: 0.145,
  error_details: [
    { error: 'Rate limit exceeded (429)', latency_ms: 0 },
    { error: 'Rate limit exceeded (429)', latency_ms: 0 },
    { error: 'Timeout after 30s', latency_ms: 30000 },
  ],
};
