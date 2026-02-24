export const mockAuditPatterns = [
  { name: 'temperature', severity: 'HIGH', recommendation: 'Remove temperature parameter — may not be supported in candidate model.', regex: 'temperature\\s*[=:]' },
  { name: 'top_p', severity: 'HIGH', recommendation: 'Remove top_p parameter — may not be supported in candidate model.', regex: 'top_p\\s*[=:]' },
  { name: 'frequency_penalty', severity: 'MEDIUM', recommendation: 'Remove frequency_penalty.', regex: 'frequency_penalty\\s*[=:]' },
  { name: 'presence_penalty', severity: 'MEDIUM', recommendation: 'Remove presence_penalty.', regex: 'presence_penalty\\s*[=:]' },
  { name: 'max_tokens', severity: 'MEDIUM', recommendation: 'Rename to max_completion_tokens.', regex: 'max_tokens\\s*[=:]' },
  { name: 'system_role', severity: 'HIGH', recommendation: 'Change role: "system" to role: "developer".', regex: '"role"\\s*:\\s*"system"' },
  { name: 'old_model_ref', severity: 'INFO', recommendation: 'Update model name to candidate deployment.', regex: 'model\\s*[=:]' },
  { name: 'old_api_version', severity: 'HIGH', recommendation: 'Update to api-version 2025-06-01.', regex: '2024-08-06|2024-05-01' },
  { name: 'logprobs', severity: 'MEDIUM', recommendation: 'Remove logprobs — may not be supported in candidate model.', regex: 'logprobs\\s*[=:]' },
];

export const mockAuditReport = {
  total_findings: 7,
  severity_counts: { HIGH: 3, MEDIUM: 2, INFO: 2 },
  by_type: { temperature: 1, top_p: 1, system_role: 1, max_tokens: 1, old_model_ref: 2, old_api_version: 1 },
  ready_for_migration: false,
  findings: [
    { severity: 'HIGH', issue_type: 'temperature', line_number: 12, line_content: '    temperature=0.7,', recommendation: 'Remove temperature parameter — may not be supported in candidate model.' },
    { severity: 'HIGH', issue_type: 'top_p', line_number: 13, line_content: '    top_p=0.9,', recommendation: 'Remove top_p parameter — may not be supported in candidate model.' },
    { severity: 'HIGH', issue_type: 'system_role', line_number: 8, line_content: '    {"role": "system", "content": "You are a helpful assistant."},', recommendation: 'Change role: "system" to role: "developer".' },
    { severity: 'MEDIUM', issue_type: 'max_tokens', line_number: 14, line_content: '    max_tokens=500,', recommendation: 'Rename to max_completion_tokens.' },
    { severity: 'INFO', issue_type: 'old_model_ref', line_number: 5, line_content: '    model="gpt-4o",', recommendation: 'Update model name to candidate deployment.' },
    { severity: 'INFO', issue_type: 'old_model_ref', line_number: 22, line_content: 'MODEL_NAME = "gpt-4o"', recommendation: 'Update model name to candidate deployment.' },
    { severity: 'HIGH', issue_type: 'old_api_version', line_number: 3, line_content: 'api_version="2024-08-06"', recommendation: 'Update to api-version 2025-06-01.' },
  ],
  recommended_actions: [
    { priority: 'HIGH', description: 'Remove unsupported parameters', details: 'Delete temperature, top_p from API calls.' },
    { priority: 'HIGH', description: 'Update system role', details: 'Change all "system" roles to "developer".' },
    { priority: 'MEDIUM', description: 'Rename max_tokens', details: 'Change max_tokens to max_completion_tokens.' },
    { priority: 'HIGH', description: 'Update API version', details: 'Change api_version to 2025-06-01.' },
    { priority: 'INFO', description: 'Update model references', details: 'Change old model references to candidate deployment where applicable.' },
  ],
};
