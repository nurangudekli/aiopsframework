export const mockCostSummary = {
  total_cost_usd: 247.83,
  total_tokens: 1_824_500,
  total_requests: 3_412,
  daily_breakdown: [
    { date: '2026-02-16', cost_usd: 32.10 },
    { date: '2026-02-17', cost_usd: 28.45 },
    { date: '2026-02-18', cost_usd: 41.20 },
    { date: '2026-02-19', cost_usd: 35.67 },
    { date: '2026-02-20', cost_usd: 38.92 },
    { date: '2026-02-21', cost_usd: 36.14 },
    { date: '2026-02-22', cost_usd: 35.35 },
  ],
  by_deployment: [
    { deployment: 'model-a-prod', deployment_type: 'Standard', cost_usd: 82.50, requests: 1_020 },
    { deployment: 'model-a-ptu', deployment_type: 'PTU', cost_usd: 60.00, requests: 800, ptu_units: 50, ptu_hourly_rate: 2.00, ptu_utilization_pct: 73 },
    { deployment: 'model-b-canary', deployment_type: 'Standard', cost_usd: 78.33, requests: 1_200 },
    { deployment: 'text-embedding-3-large', deployment_type: 'Standard', cost_usd: 27.00, requests: 392 },
  ],
};
