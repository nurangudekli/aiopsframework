/**
 * Mock data for the Migration Guide page.
 * Mirrors the shape returned by GET /api/migration-guide/full
 * All references are generic — no hardcoded model names.
 */
export const mockMigrationGuide = {
  key_dates: [
    { date: '2026-03-09', event: 'Candidate model available in Azure AI Foundry', deployment_type: 'Standard & Global Standard', impact: 'INFO' },
    { date: '2026-03-31', event: 'Candidate model available via provisioned deployments', deployment_type: 'Provisioned-Managed / Global Provisioned-Managed', impact: 'CRITICAL' },
    { date: '2026-10-01', event: 'Baseline model retirement deadline', deployment_type: 'All deployment types', impact: 'CRITICAL' },
  ],
  phases: [
    { phase: 1, name: 'Discovery & Audit', description: 'Scan your codebase and infrastructure.', tasks: ['Run codebase audit', 'Inventory all baseline deployments', 'Identify deprecated parameter usage', 'Document current baseline metrics'] },
    { phase: 2, name: 'Code Updates', description: 'Apply required API changes.', tasks: ['Remove unsupported parameters', 'Rename changed parameters', 'Update message roles if needed', 'Add new parameters', 'Update API version'] },
    { phase: 3, name: 'Testing', description: 'Validate quality and performance.', tasks: ['Run golden dataset evaluation', 'Shadow test production traffic', 'Compare quality metrics', 'Check quality gates'] },
    { phase: 4, name: 'Production Rollout', description: 'Gradual traffic migration.', tasks: ['Canary at 5%', 'Expand to 25%', 'Expand to 50%', 'Full rollover to 100%'] },
    { phase: 5, name: 'Post-Migration', description: 'Monitor and optimise.', tasks: ['Remove old model fallback code', 'Tune new parameters per use-case', 'Update monitoring dashboards', 'Archive migration artefacts'] },
  ],
  rollout_timeline: [
    { week: 'Week 1', activity: 'Audit codebase, set up test environment', phase: 'Discovery' },
    { week: 'Week 2', activity: 'Apply code changes, run unit tests', phase: 'Code Updates' },
    { week: 'Week 3', activity: 'Golden dataset evaluation, shadow testing', phase: 'Testing' },
    { week: 'Week 4', activity: 'Canary deployment 5% → 25%', phase: 'Rollout' },
    { week: 'Week 5', activity: 'Full rollout, post-migration tuning', phase: 'Post-Migration' },
  ],
  cost_comparison: [
    { token_type: 'Input tokens', baseline_per_1m: 2.50, candidate_per_1m: 1.25, change: '-50%', deployment_type: 'Standard' },
    { token_type: 'Output tokens', baseline_per_1m: 10.00, candidate_per_1m: 10.00, change: '0%', deployment_type: 'Standard' },
    { token_type: 'Reasoning tokens', baseline_per_1m: null, candidate_per_1m: 10.00, change: 'New', deployment_type: 'Standard' },
  ],
  ptu_cost_comparison: [
    { model: 'Baseline Model', ptu_per_hour: 2.00, min_ptus: 50, monthly_min: 7200, deployment_type: 'PTU' },
    { model: 'Baseline Model (mini)', ptu_per_hour: 0.37, min_ptus: 25, monthly_min: 666, deployment_type: 'PTU' },
    { model: 'Candidate Model', ptu_per_hour: 2.00, min_ptus: 50, monthly_min: 7200, deployment_type: 'PTU' },
    { model: 'Candidate Model (mini)', ptu_per_hour: 0.37, min_ptus: 25, monthly_min: 666, deployment_type: 'PTU' },
    { model: 'Reasoning Model', ptu_per_hour: 3.68, min_ptus: 50, monthly_min: 13248, deployment_type: 'PTU' },
    { model: 'Reasoning Model (mini)', ptu_per_hour: 1.10, min_ptus: 50, monthly_min: 3960, deployment_type: 'PTU' },
  ],
  checklist: [
    { id: 'disc-1', phase: 'Discovery', item: 'Run codebase audit', description: 'Scan all source files for baseline model patterns.', priority: 'HIGH' },
    { id: 'disc-2', phase: 'Discovery', item: 'Inventory deployments', description: 'List all baseline deployments in Azure.', priority: 'HIGH' },
    { id: 'disc-3', phase: 'Discovery', item: 'Baseline metrics', description: 'Capture current latency, cost, quality scores.', priority: 'MEDIUM' },
    { id: 'code-1', phase: 'Code Updates', item: 'Remove temperature', description: 'Candidate model may not support temperature.', priority: 'HIGH' },
    { id: 'code-2', phase: 'Code Updates', item: 'Remove top_p', description: 'Candidate model may not support top_p.', priority: 'HIGH' },
    { id: 'code-3', phase: 'Code Updates', item: 'Rename max_tokens', description: 'Use max_completion_tokens instead.', priority: 'HIGH' },
    { id: 'code-4', phase: 'Code Updates', item: 'Change system → developer', description: 'Rename the system message role.', priority: 'HIGH' },
    { id: 'code-5', phase: 'Code Updates', item: 'Add reasoning_effort', description: 'Set appropriate reasoning level.', priority: 'MEDIUM' },
    { id: 'test-1', phase: 'Testing', item: 'Run golden dataset evaluation', description: 'Compare both models on golden dataset.', priority: 'HIGH' },
    { id: 'test-2', phase: 'Testing', item: 'Shadow test traffic', description: 'Run production traffic through both models.', priority: 'HIGH' },
    { id: 'test-3', phase: 'Testing', item: 'Quality gate check', description: 'Ensure all metrics pass thresholds.', priority: 'HIGH' },
    { id: 'prod-1', phase: 'Production Rollout', item: 'Canary 5%', description: 'Route 5% of traffic to candidate model.', priority: 'HIGH' },
    { id: 'prod-2', phase: 'Production Rollout', item: 'Expand to 25%', description: 'Increase canary to 25% after validation.', priority: 'MEDIUM' },
    { id: 'prod-3', phase: 'Production Rollout', item: 'Full rollout 100%', description: 'Switch all traffic to candidate model.', priority: 'HIGH' },
    { id: 'post-1', phase: 'Post-Migration', item: 'Remove old fallback', description: 'Clean up old model references.', priority: 'LOW' },
    { id: 'post-2', phase: 'Post-Migration', item: 'Tune reasoning_effort', description: 'Optimise per use-case for cost.', priority: 'MEDIUM' },
    { id: 'ptu-1', phase: 'Discovery', item: 'Identify PTU deployments', description: 'List all Provisioned Throughput Unit deployments that need migration.', priority: 'HIGH', deployment_type: 'PTU' },
    { id: 'ptu-2', phase: 'Discovery', item: 'Check PTU quota availability', description: 'Verify candidate model PTU quota is available in your region via Azure Portal.', priority: 'HIGH', deployment_type: 'PTU' },
    { id: 'ptu-3', phase: 'Production Rollout', item: 'Provision candidate PTU', description: 'Create new Provisioned-Managed deployment for candidate model with required PTU count.', priority: 'HIGH', deployment_type: 'PTU' },
    { id: 'ptu-4', phase: 'Production Rollout', item: 'Validate PTU throughput', description: 'Run load tests to ensure PTU capacity meets production traffic requirements.', priority: 'HIGH', deployment_type: 'PTU' },
    { id: 'ptu-5', phase: 'Post-Migration', item: 'Release old PTU reservation', description: 'Delete baseline model PTU deployment to stop hourly billing.', priority: 'HIGH', deployment_type: 'PTU' },
  ],
  parameter_changes: [
    { parameter: 'temperature', gpt4o: '0.0–2.0', gpt51: 'Not supported', action: 'Remove', impact: 'HIGH', notes: 'Candidate model may use internal reasoning instead.' },
    { parameter: 'top_p', gpt4o: '0.0–1.0', gpt51: 'Not supported', action: 'Remove', impact: 'HIGH', notes: 'Nucleus sampling may not be applicable.' },
    { parameter: 'max_tokens', gpt4o: 'Supported', gpt51: 'max_completion_tokens', action: 'Rename', impact: 'MEDIUM', notes: 'Same behaviour, different name.' },
    { parameter: 'frequency_penalty', gpt4o: '0.0–2.0', gpt51: 'Not supported', action: 'Remove', impact: 'MEDIUM', notes: 'May not be applicable to reasoning models.' },
    { parameter: 'presence_penalty', gpt4o: '0.0–2.0', gpt51: 'Not supported', action: 'Remove', impact: 'MEDIUM', notes: '' },
    { parameter: 'logprobs', gpt4o: 'true/false', gpt51: 'Not supported', action: 'Remove', impact: 'LOW', notes: '' },
    { parameter: 'reasoning_effort', gpt4o: 'N/A', gpt51: 'low|medium|high|max', action: 'Add', impact: 'MEDIUM', notes: 'Controls reasoning depth and cost.' },
    { parameter: 'role: system', gpt4o: '"system"', gpt51: '"developer"', action: 'Rename', impact: 'HIGH', notes: 'Same position in message array.' },
    { parameter: 'API version', gpt4o: '2024-08-06', gpt51: '2025-06-01', action: 'Update', impact: 'HIGH', notes: 'Required for candidate model features.' },
  ],
  reasoning_effort_guide: [
    { value: 'low', behavior: 'Minimal reasoning, fastest response', best_for: 'Simple classification, FAQ lookup', latency: '~200ms' },
    { value: 'medium', behavior: 'Balanced reasoning (default)', best_for: 'Customer service, general chat', latency: '~500ms' },
    { value: 'high', behavior: 'Deep reasoning, thorough analysis', best_for: 'Complex analysis, code review', latency: '~1.5s' },
    { value: 'max', behavior: 'Maximum reasoning depth', best_for: 'Mathematical proofs, legal analysis', latency: '~3s+' },
  ],
  error_messages: [
    { error: "Unsupported parameter 'temperature'", cause: 'Candidate model does not accept temperature.', fix: 'Remove the temperature parameter.' },
    { error: "Unknown role 'system'", cause: 'Candidate model renamed system → developer.', fix: "Change role to 'developer'." },
    { error: "Unsupported parameter 'max_tokens'", cause: 'Renamed in candidate model.', fix: 'Use max_completion_tokens instead.' },
    { error: '404 DeploymentNotFound', cause: 'Candidate deployment does not exist.', fix: 'Create the deployment in Azure AI Foundry portal.' },
    { error: '429 RateLimitExceeded', cause: 'Exceeding provisioned throughput.', fix: 'Increase capacity or add retry logic with exponential backoff.' },
  ],
  code_examples: [
    {
      id: 'basic-chat',
      title: 'Basic Chat Completion',
      description: 'Simple chat message with system prompt.',
      before: {
        label: 'Baseline (before)',
        code: `client.chat.completions.create(\n    model="my-baseline-deployment",\n    messages=[\n        {"role": "system", "content": "You are helpful."},\n        {"role": "user", "content": query}\n    ],\n    temperature=0.7,\n    max_tokens=500\n)`,
      },
      after: {
        label: 'Candidate (after)',
        code: `client.chat.completions.create(\n    model="my-candidate-deployment",\n    messages=[\n        {"role": "developer", "content": "You are helpful."},\n        {"role": "user", "content": query}\n    ],\n    reasoning_effort="medium",\n    max_completion_tokens=500\n)`,
      },
      changes: ['Removed temperature', 'Renamed system → developer', 'max_tokens → max_completion_tokens', 'Added reasoning_effort'],
    },
    {
      id: 'classification',
      title: 'Intent Classification',
      description: 'Classify user intent with structured output.',
      before: {
        label: 'Baseline',
        code: `client.chat.completions.create(\n    model="my-baseline-deployment",\n    messages=[{"role": "system", "content": "Classify intent."}, {"role": "user", "content": text}],\n    temperature=0,\n    top_p=0.1,\n    max_tokens=50\n)`,
      },
      after: {
        label: 'Candidate',
        code: `client.chat.completions.create(\n    model="my-candidate-deployment",\n    messages=[{"role": "developer", "content": "Classify intent."}, {"role": "user", "content": text}],\n    reasoning_effort="low",\n    max_completion_tokens=50\n)`,
      },
      changes: ['Removed temperature & top_p', 'reasoning_effort="low" for simple task'],
    },
  ],
  faq: [
    { category: 'General', question: 'When will the baseline model be retired?', answer: 'Check the Azure AI model lifecycle page for your specific model retirement dates.' },
    { category: 'General', question: 'Is the candidate model a drop-in replacement?', answer: 'Not always — you may need to update parameters and the system role. But the API structure is generally similar.' },
    { category: 'Code Changes', question: 'What happens if I send unsupported parameters?', answer: "The candidate model will return an error for unsupported parameters. Remove them before migration." },
    { category: 'Code Changes', question: 'Can I keep my existing system messages?', answer: "Yes, but some models may require changing the role from 'system' to 'developer'. The content can remain the same." },
    { category: 'Quality & Testing', question: 'How many test cases should I use?', answer: 'At least 50 for simple use-cases, 100+ for complex multi-domain scenarios.' },
    { category: 'Quality & Testing', question: 'What similarity score indicates a good migration?', answer: 'Above 0.85 is generally acceptable. Above 0.90 is excellent.' },
    { category: 'Cost & Performance', question: 'Is the candidate model cheaper?', answer: 'Pricing varies by model. Compare using the cost comparison tool to evaluate differences.' },
    { category: 'Cost & Performance', question: 'Is the candidate model faster?', answer: 'Performance varies by model. Run shadow tests to measure actual latency differences.' },
    { category: 'Deployment', question: 'Can I run both models in parallel?', answer: 'Yes — use shadow testing to run both models and compare before switching.' },
    { category: 'Language & Regional', question: 'Does the candidate model support Arabic?', answer: 'Most newer models have improved multilingual capabilities. Test with your specific language requirements.' },
    { category: 'Cost & Performance', question: 'How does PTU pricing differ from Standard?', answer: 'PTU (Provisioned Throughput Units) is billed hourly per unit regardless of usage, while Standard is pay-per-token. PTU guarantees throughput but requires upfront capacity planning.' },
    { category: 'Cost & Performance', question: 'Should I migrate PTU or Standard first?', answer: 'Migrate Standard deployments first — they are lower risk. PTU deployments require capacity planning and quota verification before migration.' },
    { category: 'Deployment', question: 'Can I keep PTU and Standard deployments for the same model?', answer: 'Yes. Many organisations use Standard for dev/test and PTU for production to guarantee throughput and predictable costs.' },
    { category: 'Deployment', question: 'What is the minimum PTU for the candidate model?', answer: 'PTU minimums vary by model. Check Azure AI pricing documentation for your specific candidate model.' },
  ],
};

export const mockQualityGateResult = {
  passed: true,
  recommendation: 'All quality gates passed. Safe to proceed with migration.',
  metrics: [
    { metric: 'coherence', score: 4.2, passed: true, checks: [{ check: 'min_score', actual: 4.2, threshold: 4.0, passed: true }] },
    { metric: 'fluency', score: 4.3, passed: true, checks: [{ check: 'min_score', actual: 4.3, threshold: 4.0, passed: true }] },
    { metric: 'relevance', score: 4.1, passed: true, checks: [{ check: 'min_score', actual: 4.1, threshold: 4.0, passed: true }] },
    { metric: 'groundedness', score: 3.8, passed: true, checks: [{ check: 'min_score', actual: 3.8, threshold: 3.5, passed: true }] },
    { metric: 'similarity', score: 3.9, passed: true, checks: [{ check: 'min_score', actual: 3.9, threshold: 3.5, passed: true }] },
  ],
};

export const mockCompareResult = {
  has_regressions: false,
  recommendation: 'No significant regressions detected. Candidate model matches or exceeds baseline quality.',
  comparisons: [
    { metric: 'coherence', baseline: 4.2, candidate: 4.1, difference: -0.1, difference_pct: -2.4, status: 'stable' },
    { metric: 'fluency', baseline: 4.3, candidate: 4.2, difference: -0.1, difference_pct: -2.3, status: 'stable' },
    { metric: 'relevance', baseline: 4.1, candidate: 4.0, difference: -0.1, difference_pct: -2.4, status: 'stable' },
    { metric: 'groundedness', baseline: 3.8, candidate: 3.7, difference: -0.1, difference_pct: -2.6, status: 'stable' },
    { metric: 'similarity', baseline: 3.9, candidate: 3.7, difference: -0.2, difference_pct: -5.1, status: 'stable' },
  ],
};
