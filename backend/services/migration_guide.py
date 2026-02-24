"""
Migration Guide Service.

Provides migration checklist, FAQ, API changes reference,
before/after code examples, key dates/timeline, and parameter mapping.
All data sourced from the azure-openai-migration-guide repository.

When baseline and target deployments are supplied the guide is
generated *dynamically* — parameter changes, checklist items and
code examples are tailored to what actually changes between the two
model families (using the capability map from codebase_audit).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from backend.services.codebase_audit import (
    MODEL_FAMILIES,
    detect_model_family,
    get_model_capabilities,
)


# ══════════════════════════════════════════════════════════════════
# KEY DATES & TIMELINE
# ══════════════════════════════════════════════════════════════════
KEY_DATES: List[Dict[str, str]] = [
    {"date": "TBD", "event": "Standard deployments auto-upgrade to candidate model", "impact": "HIGH", "deployment_type": "Standard (PayGo)"},
    {"date": "TBD", "event": "Baseline Standard deployments retired", "impact": "CRITICAL", "deployment_type": "Standard (PayGo)"},
    {"date": "TBD", "event": "Baseline PTU deployments retired", "impact": "CRITICAL", "deployment_type": "PTU (Provisioned)"},
]

ROLLOUT_TIMELINE: List[Dict[str, str]] = [
    {"week": "Week 1-2", "activity": "Code changes + evaluation testing", "phase": "Preparation"},
    {"week": "Week 3", "activity": "Shadow testing (both models, serve only baseline)", "phase": "Testing"},
    {"week": "Week 4", "activity": "Canary deployment (5% traffic to candidate)", "phase": "Canary"},
    {"week": "Week 5", "activity": "Progressive rollout (25% → 50% → 100%)", "phase": "Rollout"},
    {"week": "Week 6+", "activity": "Monitor and optimize", "phase": "Post-Migration"},
]

# ══════════════════════════════════════════════════════════════════
# DATASET SIZE RECOMMENDATIONS (from golden-datasets.md)
# ══════════════════════════════════════════════════════════════════
DATASET_SIZE_RECOMMENDATIONS: List[Dict[str, Any]] = [
    {"application_type": "Simple (single task)", "minimum_cases": 30, "recommended_cases": 50, "notes": "Basic functionality testing"},
    {"application_type": "Medium (few tasks)", "minimum_cases": 50, "recommended_cases": 100, "notes": "Multiple use cases and scenarios"},
    {"application_type": "Complex (many tasks)", "minimum_cases": 100, "recommended_cases": 200, "notes": "Comprehensive coverage required"},
    {"application_type": "Critical/Production", "minimum_cases": 150, "recommended_cases": 300, "notes": "Include edge cases, multi-language, and adversarial inputs"},
]

TEST_CASE_CATEGORIES: List[Dict[str, str]] = [
    {"category": "by_topic", "description": "Billing, Technical Support, Plan Changes, Roaming, Complaints, General Inquiries", "importance": "HIGH"},
    {"category": "by_difficulty", "description": "Easy (clear questions), Medium (context/reasoning needed), Hard (ambiguous/emotional)", "importance": "HIGH"},
    {"category": "by_language", "description": "Primary language (en), Secondary (ar), Code-switching (mixed)", "importance": "HIGH"},
    {"category": "edge_cases", "description": "Very short inputs, very long inputs, typos, ambiguous questions, out-of-scope, sensitive topics", "importance": "CRITICAL"},
]

# ══════════════════════════════════════════════════════════════════
# ROLLBACK PROCEDURES (from migration-guide.md)
# ══════════════════════════════════════════════════════════════════
ROLLBACK_PROCEDURES: List[Dict[str, Any]] = [
    {
        "deployment_type": "Standard (PayGo)",
        "method": "Redeploy baseline model",
        "command": """az cognitiveservices account deployment create \\
  --name <resource> \\
  --resource-group <rg> \\
  --deployment-name <deployment> \\
  --model-name <baseline-model> \\
  --model-version <baseline-version>""",
        "downtime": "~5 minutes",
        "notes": "Only available before baseline model retirement date",
    },
    {
        "deployment_type": "PTU Multi-Deployment",
        "method": "Switch traffic to baseline deployment",
        "command": "Update load balancer or application code routing",
        "downtime": "None (instant failover)",
        "notes": "Keeps baseline deployment running during migration for instant rollback",
    },
    {
        "deployment_type": "PTU In-Place",
        "method": "In-place migration back to baseline model",
        "command": """az cognitiveservices account deployment update \\
  --name <resource> \\
  --resource-group <rg> \\
  --deployment-name <deployment> \\
  --model-name <baseline-model> \\
  --model-version <baseline-version>""",
        "downtime": "20-30 minutes",
        "notes": "Requires service interruption; plan maintenance window",
    },
]

# ══════════════════════════════════════════════════════════════════
# QUALITY ACCEPTANCE CRITERIA (from evaluation-guide.md)
# ══════════════════════════════════════════════════════════════════
ACCEPTANCE_CRITERIA: Dict[str, Dict[str, float]] = {
    "coherence": {"min_score": 4.0, "regression_threshold": 0.10},
    "fluency": {"min_score": 4.0, "regression_threshold": 0.10},
    "relevance": {"min_score": 4.0, "regression_threshold": 0.10},
    "groundedness": {"min_score": 3.5, "regression_threshold": 0.10},
    "similarity": {"min_score": 3.5, "regression_threshold": 0.15},
}

# ══════════════════════════════════════════════════════════════════
# CONTINUOUS MONITORING GUIDANCE
# ══════════════════════════════════════════════════════════════════
MONITORING_GUIDANCE: Dict[str, Any] = {
    "sampling_rate": 0.05,  # 5% of production traffic
    "alerts": [
        {"metric": "error_rate", "threshold": "> 5% increase", "action": "Investigate immediately"},
        {"metric": "latency_p95", "threshold": "> 20% increase", "action": "Check reasoning_effort settings"},
        {"metric": "quality_score", "threshold": "> 10% drop", "action": "Review failing test cases"},
    ],
    "evaluation_frequency": "Real-time sampling with daily aggregates",
    "retention": "30 days for detailed logs, 1 year for aggregate metrics",
}

# ══════════════════════════════════════════════════════════════════
# MIGRATION CHECKLIST
# ══════════════════════════════════════════════════════════════════
MIGRATION_CHECKLIST: List[Dict[str, Any]] = [
    # Phase 1: Discovery
    {"id": "disc-1", "phase": "Discovery", "item": "Inventory all baseline deployments", "description": "List all Azure OpenAI resources using the baseline model across subscriptions", "status": "not_started", "priority": "HIGH"},
    {"id": "disc-2", "phase": "Discovery", "item": "Understand retirement timeline", "description": "Check Azure model lifecycle for retirement dates of your baseline model", "status": "not_started", "priority": "HIGH"},
    {"id": "disc-3", "phase": "Discovery", "item": "Audit codebase for baseline model patterns", "description": "Use the codebase audit tool to scan for unsupported parameters in candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "disc-4", "phase": "Discovery", "item": "Identify affected applications", "description": "Map which apps/services use the baseline model and their criticality", "status": "not_started", "priority": "MEDIUM"},
    # Phase 2: Code Updates
    {"id": "code-1", "phase": "Code Updates", "item": "Update API version to 2025-06-01", "description": "Change api_version from 2024-xx-xx to 2025-06-01", "status": "not_started", "priority": "HIGH"},
    {"id": "code-2", "phase": "Code Updates", "item": "Update model name to candidate", "description": "Change model/deployment references from baseline to candidate", "status": "not_started", "priority": "HIGH"},
    {"id": "code-3", "phase": "Code Updates", "item": "Remove temperature parameter", "description": "Candidate model may not support temperature — use reasoning_effort instead", "status": "not_started", "priority": "HIGH"},
    {"id": "code-4", "phase": "Code Updates", "item": "Remove top_p parameter", "description": "May not be supported in candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "code-5", "phase": "Code Updates", "item": "Remove frequency_penalty parameter", "description": "May not be supported in candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "code-6", "phase": "Code Updates", "item": "Remove presence_penalty parameter", "description": "May not be supported in candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "code-7", "phase": "Code Updates", "item": "Remove logprobs/top_logprobs", "description": "May not be supported in candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "code-8", "phase": "Code Updates", "item": "Rename max_tokens → max_completion_tokens", "description": "New param includes reasoning tokens in the count", "status": "not_started", "priority": "HIGH"},
    {"id": "code-9", "phase": "Code Updates", "item": "Change system role to developer", "description": "system still works but developer is recommended for reasoning models", "status": "not_started", "priority": "MEDIUM"},
    {"id": "code-10", "phase": "Code Updates", "item": "Add reasoning_effort parameter", "description": "Options: none, low, medium, high. Default is none. Use low for most cases.", "status": "not_started", "priority": "MEDIUM"},
    # Phase 3: Testing
    {"id": "test-1", "phase": "Testing", "item": "Build golden dataset", "description": "Create 30-200+ test cases covering all use cases, edge cases, and languages", "status": "not_started", "priority": "HIGH"},
    {"id": "test-2", "phase": "Testing", "item": "Run evaluation pipeline", "description": "Use Azure AI Foundry evaluators: coherence, fluency, relevance, groundedness, similarity", "status": "not_started", "priority": "HIGH"},
    {"id": "test-3", "phase": "Testing", "item": "Compare baseline vs candidate results", "description": "Flag any metric that drops more than 10%", "status": "not_started", "priority": "HIGH"},
    {"id": "test-4", "phase": "Testing", "item": "Shadow testing", "description": "Run both models in parallel, serve only baseline, compare responses", "status": "not_started", "priority": "MEDIUM"},
    {"id": "test-5", "phase": "Testing", "item": "Set quality gates", "description": "Define acceptance criteria: coherence ≥4.0, relevance ≥4.0, similarity ≥3.5", "status": "not_started", "priority": "HIGH"},
    # Phase 4: Production Rollout
    {"id": "prod-1", "phase": "Production Rollout", "item": "Canary deployment (5%)", "description": "Route 5% of traffic to candidate, monitor quality", "status": "not_started", "priority": "HIGH"},
    {"id": "prod-2", "phase": "Production Rollout", "item": "Progressive rollout (25%→50%→100%)", "description": "Gradually increase traffic to candidate model", "status": "not_started", "priority": "HIGH"},
    {"id": "prod-3", "phase": "Production Rollout", "item": "Keep rollback plan ready", "description": "Ensure you can switch back to baseline quickly if issues arise", "status": "not_started", "priority": "HIGH"},
    # Phase 5: Post-Migration
    {"id": "post-1", "phase": "Post-Migration", "item": "Set up continuous monitoring", "description": "Sample 5% of production traffic for ongoing evaluation", "status": "not_started", "priority": "MEDIUM"},
    {"id": "post-2", "phase": "Post-Migration", "item": "Configure alerts", "description": "Alert on quality score drops, spikes in low-quality responses", "status": "not_started", "priority": "MEDIUM"},
    {"id": "post-3", "phase": "Post-Migration", "item": "Update documentation", "description": "Update internal docs, runbooks, and architecture diagrams", "status": "not_started", "priority": "LOW"},
    {"id": "post-4", "phase": "Post-Migration", "item": "Retire old baseline deployments", "description": "Clean up old deployments after successful migration", "status": "not_started", "priority": "LOW"},
]

# ══════════════════════════════════════════════════════════════════
# API CHANGES REFERENCE
# ══════════════════════════════════════════════════════════════════
PARAMETER_CHANGES: List[Dict[str, str]] = [
    {"parameter": "temperature", "baseline": "0.0–2.0", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": "Use reasoning_effort instead"},
    {"parameter": "top_p", "baseline": "0.0–1.0", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": ""},
    {"parameter": "frequency_penalty", "baseline": "-2.0–2.0", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": ""},
    {"parameter": "presence_penalty", "baseline": "-2.0–2.0", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": ""},
    {"parameter": "logprobs", "baseline": "true/false", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": ""},
    {"parameter": "top_logprobs", "baseline": "0–20", "candidate": "(removed)", "action": "Remove", "impact": "HIGH", "notes": ""},
    {"parameter": "max_tokens", "baseline": "integer", "candidate": "→ max_completion_tokens", "action": "Rename", "impact": "HIGH", "notes": "Includes reasoning tokens in count"},
    {"parameter": "role: system", "baseline": "system", "candidate": "→ developer", "action": "Change", "impact": "MEDIUM", "notes": "system still works but developer recommended"},
    {"parameter": "api_version", "baseline": "2024-10-21", "candidate": "→ 2025-06-01", "action": "Update", "impact": "MEDIUM", "notes": ""},
    {"parameter": "reasoning_effort", "baseline": "(new)", "candidate": "none/low/medium/high", "action": "Add", "impact": "MEDIUM", "notes": "Default is 'none'. Use 'low' for most cases."},
    {"parameter": "verbosity", "baseline": "(new)", "candidate": "low/medium/high", "action": "Add (optional)", "impact": "LOW", "notes": "Controls response detail level"},
]

REASONING_EFFORT_GUIDE: List[Dict[str, str]] = [
    {"value": "none", "behavior": "No reasoning, direct response", "best_for": "Simple tasks, classification, extraction", "latency": "Similar or faster than baseline"},
    {"value": "low", "behavior": "Light reasoning", "best_for": "Standard conversations, most use cases", "latency": "Similar to baseline"},
    {"value": "medium", "behavior": "Moderate reasoning", "best_for": "Complex analysis, detailed explanations", "latency": "Slower (more thinking)"},
    {"value": "high", "behavior": "Deep reasoning", "best_for": "Critical decisions, multi-step problems", "latency": "Significantly slower"},
]

ERROR_MESSAGES: List[Dict[str, str]] = [
    {"error": "InvalidParameterValue: temperature", "cause": "temperature parameter not supported", "fix": "Remove temperature parameter from API call"},
    {"error": "InvalidParameterValue: top_p", "cause": "top_p parameter not supported", "fix": "Remove top_p parameter from API call"},
    {"error": "InvalidParameterValue: frequency_penalty", "cause": "frequency_penalty not supported", "fix": "Remove frequency_penalty parameter"},
    {"error": "InvalidParameterValue: presence_penalty", "cause": "presence_penalty not supported", "fix": "Remove presence_penalty parameter"},
    {"error": "InvalidParameterValue: logprobs", "cause": "logprobs not supported", "fix": "Remove logprobs parameter"},
    {"error": "DeploymentNotFound", "cause": "Baseline deployment has been retired", "fix": "Create new candidate model deployment"},
    {"error": "InvalidApiVersion", "cause": "API version not supported for model", "fix": "Update to api_version='2025-06-01'"},
]

# ══════════════════════════════════════════════════════════════════
# BEFORE/AFTER CODE EXAMPLES
# ══════════════════════════════════════════════════════════════════
CODE_EXAMPLES: List[Dict[str, Any]] = [
    {
        "id": "basic-chat",
        "title": "Basic Chat Completion",
        "description": "Simple chat API call with system message",
        "before": {
            "label": "Baseline (Current)",
            "language": "python",
            "code": '''from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-10-21"  # Old version
)

response = client.chat.completions.create(
    model="my-baseline-deployment",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": user_input}
    ],
    temperature=0.7,
    max_tokens=500
)
print(response.choices[0].message.content)''',
        },
        "after": {
            "label": "Candidate (Migrated)",
            "language": "python",
            "code": '''from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2025-06-01"  # Updated
)

response = client.chat.completions.create(
    model="my-candidate-deployment",
    messages=[
        {"role": "developer", "content": "You are a helpful assistant."},
        {"role": "user", "content": user_input}
    ],
    # Removed: temperature, top_p
    max_completion_tokens=500,  # Renamed from max_tokens
    reasoning_effort="low"     # New parameter
)
print(response.choices[0].message.content)''',
        },
        "changes": [
            "api_version: 2024-10-21 → 2025-06-01",
            "model: baseline → candidate",
            "role: system → developer",
            "Removed: temperature=0.7",
            "max_tokens → max_completion_tokens",
            "Added: reasoning_effort='low'",
        ],
    },
    {
        "id": "classification",
        "title": "Intent Classification (JSON)",
        "description": "Using JSON mode for structured output",
        "before": {
            "label": "Baseline (Current)",
            "language": "python",
            "code": '''response = client.chat.completions.create(
    model="my-baseline-deployment",
    messages=[
        {"role": "system", "content": "Classify intent as JSON."},
        {"role": "user", "content": customer_message}
    ],
    temperature=0.1,
    top_p=0.95,
    max_tokens=100,
    response_format={"type": "json_object"}
)''',
        },
        "after": {
            "label": "Candidate (Migrated)",
            "language": "python",
            "code": '''response = client.chat.completions.create(
    model="my-candidate-deployment",
    messages=[
        {"role": "developer", "content": "Classify intent as JSON."},
        {"role": "user", "content": customer_message}
    ],
    # Removed: temperature, top_p
    max_completion_tokens=100,
    reasoning_effort="none",  # Fast mode for classification
    response_format={"type": "json_object"}
)''',
        },
        "changes": [
            "Removed: temperature=0.1, top_p=0.95",
            "max_tokens → max_completion_tokens",
            "reasoning_effort='none' for fast classification",
            "role: system → developer",
        ],
    },
    {
        "id": "complex-response",
        "title": "Complex Response Generation",
        "description": "Customer complaint handling with full context",
        "before": {
            "label": "Baseline (Current)",
            "language": "python",
            "code": '''response = client.chat.completions.create(
    model="my-baseline-deployment",
    messages=[
        {"role": "system", "content": f"You are a senior agent. Customer: {name}"},
        {"role": "user", "content": complaint_text}
    ],
    temperature=0.7,
    frequency_penalty=0.3,
    max_tokens=800
)''',
        },
        "after": {
            "label": "Candidate (Migrated)",
            "language": "python",
            "code": '''response = client.chat.completions.create(
    model="my-candidate-deployment",
    messages=[
        {"role": "developer", "content": f"You are a senior agent. Customer: {name}"},
        {"role": "user", "content": complaint_text}
    ],
    # Removed: temperature, frequency_penalty
    max_completion_tokens=800,
    reasoning_effort="medium"  # Higher reasoning for complex cases
)''',
        },
        "changes": [
            "Removed: temperature=0.7, frequency_penalty=0.3",
            "max_tokens → max_completion_tokens",
            "reasoning_effort='medium' for thoughtful responses",
        ],
    },
    {
        "id": "responses-api",
        "title": "Responses API (New Alternative)",
        "description": "OpenAI's next-generation API for reasoning models",
        "before": {
            "label": "Chat Completions (Current)",
            "language": "python",
            "code": '''# Chat Completions — more verbose
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2025-06-01"
)

response = client.chat.completions.create(
    model="my-candidate-deployment",
    messages=[
        {"role": "developer", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    max_completion_tokens=100,
    reasoning_effort="low"
)
result = response.choices[0].message.content''',
        },
        "after": {
            "label": "Responses API (New)",
            "language": "python",
            "code": '''# Responses API — cleaner, better caching
from openai import OpenAI

client = OpenAI(
    base_url=f"{endpoint.rstrip('/')}/openai/v1/",
    api_key=api_key
)

response = client.responses.create(
    model="my-candidate-deployment",
    instructions="You are a helpful assistant.",
    input="Hello!",
    reasoning={"effort": "low"}
)
result = response.output_text''',
        },
        "changes": [
            "3-5% better reasoning performance",
            "40-80% better cache utilization",
            "instructions replaces system/developer message",
            "input replaces user message",
            "output_text replaces choices[0].message.content",
            "Built-in tools: web_search, code_interpreter",
            "Automatic conversation history with previous_response_id",
        ],
    },
]

# ══════════════════════════════════════════════════════════════════
# FAQ
# ══════════════════════════════════════════════════════════════════
FAQ_ITEMS: List[Dict[str, str]] = [
    # General
    {
        "category": "General",
        "question": "Why is the baseline model being retired?",
        "answer": "Azure OpenAI evolves to bring better capabilities. Newer models offer enhanced reasoning, better instruction following, fewer hallucinations, and often lower input token costs.",
    },
    {
        "category": "General",
        "question": "What if I don't migrate?",
        "answer": "Standard (PayGo) deployments may auto-upgrade and eventually be retired. PTU (Provisioned) must be manually migrated before the retirement deadline. After retirement, API calls to the old model will return errors.",
    },
    {
        "category": "General",
        "question": "Can I stay on the baseline model longer?",
        "answer": "For Standard deployments, you can set versionUpgradeOption: 'NoAutoUpgrade' to prevent automatic upgrade, but the model is still retired on the announced date. Check Azure model lifecycle for specific dates.",
    },
    # Code Changes
    {
        "category": "Code Changes",
        "question": "Why was temperature removed?",
        "answer": "Reasoning models use reasoning_effort instead. This controls how much the model 'thinks' before responding. More deterministic outputs by design, better consistency for production applications.",
    },
    {
        "category": "Code Changes",
        "question": "What's the difference between max_tokens and max_completion_tokens?",
        "answer": "max_tokens (baseline) counts output tokens only. max_completion_tokens (candidate) counts output tokens + reasoning tokens. When reasoning_effort > 'none', reasoning tokens are billed as output but invisible in the response. Budget accordingly.",
    },
    {
        "category": "Code Changes",
        "question": "Do I have to change system to developer?",
        "answer": "While 'system' still works for backward compatibility, Microsoft recommends 'developer' because it's clearer, it's the standard going forward, and avoids potential deprecation in future versions.",
    },
    {
        "category": "Code Changes",
        "question": "What does reasoning_effort actually do?",
        "answer": "'none' = no reasoning (simple tasks). 'low' = light reasoning (standard conversations). 'medium' = moderate (complex analysis). 'high' = deep reasoning (critical decisions). Default is 'none' — if responses seem shallow, try 'low' or 'medium'.",
    },
    # Quality & Testing
    {
        "category": "Quality & Testing",
        "question": "My candidate model responses are shorter/shallower. Why?",
        "answer": "This is the #1 reported issue. reasoning_effort defaults to 'none'. Add reasoning_effort='low' or 'medium' to get more thoughtful responses.",
    },
    {
        "category": "Quality & Testing",
        "question": "The tone feels different (colder, less warm). How do I fix it?",
        "answer": "The candidate model is more precise and may feel less conversational. Solutions: 1) Add explicit personality instructions in the developer message, 2) Use reasoning_effort='low' or higher, 3) Review prompts — newer models follow instructions more precisely.",
    },
    {
        "category": "Quality & Testing",
        "question": "How do I know if quality is acceptable?",
        "answer": "Use evaluations with these thresholds: Coherence ≥4.0, Relevance ≥4.0, Groundedness ≥4.0, Similarity ≥3.5. Flag any metric that drops more than 10% vs baseline.",
    },
    {
        "category": "Quality & Testing",
        "question": "How many test cases do I need?",
        "answer": "Simple application: min 30, recommended 50. Multiple use cases: min 50, recommended 100. Complex/critical app: min 100, recommended 200+. Include edge cases, multiple languages, and difficult scenarios.",
    },
    # Cost & Performance
    {
        "category": "Cost & Performance",
        "question": "Will the candidate model cost more?",
        "answer": "Pricing varies by model. Compare input/output token costs. Note that reasoning tokens (when reasoning_effort > 'none') are billed as output tokens but invisible in the response. Start with reasoning_effort='none' or 'low'.",
    },
    {
        "category": "Cost & Performance",
        "question": "Is the candidate model faster or slower?",
        "answer": "Depends on reasoning_effort: 'none' = similar or faster, 'low' = similar, 'medium' = slower, 'high' = significantly slower. For latency-sensitive apps, use 'none' or 'low'.",
    },
    {
        "category": "Cost & Performance",
        "question": "How do I optimize costs?",
        "answer": "1) Use reasoning_effort='none' for simple tasks. 2) Leverage prompt caching (90% discount on cached tokens). 3) Monitor token usage during migration. 4) Right-size max_completion_tokens.",
    },
    # Deployment
    {
        "category": "Deployment",
        "question": "What's the recommended rollout strategy?",
        "answer": "Week 1-2: Code changes + evaluation. Week 3: Shadow testing. Week 4: Canary (5% traffic). Week 5: Progressive rollout (25%→50%→100%). Week 6+: Monitor and optimize.",
    },
    {
        "category": "Deployment",
        "question": "Can I run both models simultaneously?",
        "answer": "Yes! This is recommended. Use feature flags or traffic splitting to route a percentage of requests to the candidate model while serving the baseline for the rest.",
    },
    {
        "category": "Deployment",
        "question": "How do I rollback if something goes wrong?",
        "answer": "Standard (before retirement): update deployment to baseline model via Azure CLI. PTU (multi-deployment): switch traffic back via load balancer. PTU (in-place): requires another in-place migration (~20-30 min).",
    },
    # Language
    {
        "category": "Language & Regional",
        "question": "Does the candidate model handle Arabic well?",
        "answer": "Check documentation. Model behavior can shift between versions, code-switching (Arabic/English mix) needs testing, regional dialects may behave differently. Dedicate 30%+ of your golden dataset to Arabic test cases.",
    },
]

# ══════════════════════════════════════════════════════════════════
# COST COMPARISON
# ══════════════════════════════════════════════════════════════════
COST_COMPARISON: List[Dict[str, Any]] = [
    {"token_type": "Input", "baseline_per_1m": 2.50, "candidate_per_1m": 1.25, "change": "-50%"},
    {"token_type": "Output", "baseline_per_1m": 10.00, "candidate_per_1m": 10.00, "change": "0%"},
    {"token_type": "Reasoning (hidden)", "baseline_per_1m": None, "candidate_per_1m": 10.00, "change": "New — billed as output"},
]


# ══════════════════════════════════════════════════════════════════
# 5-PHASE MIGRATION PROCESS
# ══════════════════════════════════════════════════════════════════
MIGRATION_PHASES: List[Dict[str, Any]] = [
    {
        "phase": 1,
        "name": "Discovery",
        "description": "Assess your current baseline model usage and prepare for migration",
        "tasks": [
            "Inventory all baseline deployments across subscriptions",
            "Understand retirement timeline and key dates",
            "Audit codebase for deprecated parameters",
            "Identify affected applications and their criticality",
        ],
    },
    {
        "phase": 2,
        "name": "Code Updates",
        "description": "Update your code for candidate model compatibility",
        "tasks": [
            "Update API version to 2025-06-01",
            "Change model name to candidate deployment",
            "Remove temperature, top_p, frequency_penalty, presence_penalty, logprobs",
            "Rename max_tokens to max_completion_tokens",
            "Change system role to developer",
            "Add reasoning_effort parameter",
        ],
    },
    {
        "phase": 3,
        "name": "Testing",
        "description": "Validate quality and performance before production",
        "tasks": [
            "Build golden dataset (30-200+ test cases)",
            "Run evaluation pipeline with Azure AI Foundry metrics",
            "Compare baseline vs candidate results",
            "Perform shadow testing",
            "Set quality gates and acceptance criteria",
        ],
    },
    {
        "phase": 4,
        "name": "Production Rollout",
        "description": "Gradually migrate production traffic",
        "tasks": [
            "Canary deployment (5% traffic)",
            "Progressive rollout (25% → 50% → 100%)",
            "Monitor quality metrics in real-time",
            "Keep rollback plan ready",
        ],
    },
    {
        "phase": 5,
        "name": "Post-Migration",
        "description": "Ongoing monitoring and optimization",
        "tasks": [
            "Set up continuous monitoring (5% traffic sampling)",
            "Configure alerts for quality drops",
            "Update documentation and runbooks",
            "Retire old baseline deployments",
            "Optimize reasoning_effort for each use case",
        ],
    },
]


# ══════════════════════════════════════════════════════════════════
# DYNAMIC (MODEL-AWARE) GUIDE GENERATOR
# ══════════════════════════════════════════════════════════════════

# Map from capability key → parameter metadata used for dynamic generation
_PARAM_CAPABILITY_MAP: List[Dict[str, Any]] = [
    {"parameter": "temperature", "cap": "supports_temperature", "baseline_range": "0.0–2.0", "action_if_unsupported": "Remove", "notes_if_unsupported": "Use reasoning_effort instead", "notes_if_supported": "Supported — no change needed"},
    {"parameter": "top_p", "cap": "supports_top_p", "baseline_range": "0.0–1.0", "action_if_unsupported": "Remove", "notes_if_unsupported": "", "notes_if_supported": "Supported — no change needed"},
    {"parameter": "frequency_penalty", "cap": "supports_frequency_penalty", "baseline_range": "-2.0–2.0", "action_if_unsupported": "Remove", "notes_if_unsupported": "", "notes_if_supported": "Supported — no change needed"},
    {"parameter": "presence_penalty", "cap": "supports_presence_penalty", "baseline_range": "-2.0–2.0", "action_if_unsupported": "Remove", "notes_if_unsupported": "", "notes_if_supported": "Supported — no change needed"},
    {"parameter": "logprobs", "cap": "supports_logprobs", "baseline_range": "true/false", "action_if_unsupported": "Remove", "notes_if_unsupported": "", "notes_if_supported": "Supported — no change needed"},
    {"parameter": "top_logprobs", "cap": "supports_logprobs", "baseline_range": "0–20", "action_if_unsupported": "Remove", "notes_if_unsupported": "", "notes_if_supported": "Supported — no change needed"},
]


def _dynamic_parameter_changes(
    baseline_caps: Dict[str, Any],
    target_caps: Dict[str, Any],
    baseline_name: str,
    target_name: str,
) -> List[Dict[str, str]]:
    """Build parameter-change rows that reflect the actual capability diff."""
    rows: List[Dict[str, str]] = []

    for p in _PARAM_CAPABILITY_MAP:
        supported = target_caps.get(p["cap"], True)
        if supported:
            rows.append({
                "parameter": p["parameter"],
                "baseline": p["baseline_range"],
                "candidate": "✅ Supported",
                "action": "Keep",
                "impact": "INFO",
                "notes": p["notes_if_supported"],
            })
        else:
            rows.append({
                "parameter": p["parameter"],
                "baseline": p["baseline_range"],
                "candidate": "(removed)",
                "action": "Remove",
                "impact": "HIGH",
                "notes": p["notes_if_unsupported"],
            })

    # max_tokens → max_completion_tokens (always applies)
    if target_caps.get("uses_max_completion_tokens"):
        rows.append({
            "parameter": "max_tokens",
            "baseline": "integer",
            "candidate": "→ max_completion_tokens",
            "action": "Rename",
            "impact": "HIGH",
            "notes": "Includes reasoning tokens in count",
        })

    # system → developer
    if target_caps.get("prefers_developer_role"):
        rows.append({
            "parameter": "role: system",
            "baseline": "system",
            "candidate": "→ developer",
            "action": "Change",
            "impact": "MEDIUM",
            "notes": "system still works but developer recommended",
        })

    # api_version always
    rows.append({
        "parameter": "api_version",
        "baseline": "2024-10-21",
        "candidate": "→ 2025-06-01",
        "action": "Update",
        "impact": "MEDIUM",
        "notes": "",
    })

    # reasoning_effort — only add row if target supports it
    if target_caps.get("supports_reasoning_effort"):
        rows.append({
            "parameter": "reasoning_effort",
            "baseline": "(new)",
            "candidate": "none/low/medium/high",
            "action": "Add",
            "impact": "MEDIUM",
            "notes": "Default is 'none'. Use 'low' for most cases.",
        })

    return rows


def _dynamic_checklist(
    baseline_caps: Dict[str, Any],
    target_caps: Dict[str, Any],
    baseline_name: str,
    target_name: str,
) -> List[Dict[str, Any]]:
    """Build a checklist whose items match the real migration diff."""
    items: List[Dict[str, Any]] = []
    idx = 0

    def _add(phase: str, item: str, desc: str, priority: str = "HIGH"):
        nonlocal idx
        idx += 1
        items.append({"id": f"dyn-{idx}", "phase": phase, "item": item, "description": desc, "status": "not_started", "priority": priority})

    # Discovery
    _add("Discovery", f"Inventory all {baseline_name} deployments", "List all Azure OpenAI resources using the baseline model across subscriptions")
    _add("Discovery", "Understand retirement timeline", f"Check Azure model lifecycle for retirement dates of {baseline_name}")
    _add("Discovery", "Audit codebase for baseline patterns", f"Use the codebase audit tool to scan for parameters unsupported by {target_name}")
    _add("Discovery", "Identify affected applications", "Map which apps/services use the baseline model and their criticality", "MEDIUM")

    # Code Updates
    _add("Code Updates", "Update API version to 2025-06-01", "Change api_version from 2024-xx-xx to 2025-06-01")
    _add("Code Updates", f"Update model name to {target_name}", f"Change model/deployment references from {baseline_name} to {target_name}")

    unsupported_params = [p["parameter"] for p in _PARAM_CAPABILITY_MAP if not target_caps.get(p["cap"], True)]
    if unsupported_params:
        for param in unsupported_params:
            _add("Code Updates", f"Remove {param} parameter", f"Not supported by {target_name}")
    else:
        _add("Code Updates", "Verify sampling parameters", f"All sampling parameters are supported by {target_name} — review values", "LOW")

    if target_caps.get("uses_max_completion_tokens"):
        _add("Code Updates", "Rename max_tokens → max_completion_tokens", "New param includes reasoning tokens in the count")
    if target_caps.get("prefers_developer_role"):
        _add("Code Updates", "Change system role to developer", f"system still works but developer is recommended for {target_name}", "MEDIUM")
    if target_caps.get("supports_reasoning_effort"):
        _add("Code Updates", "Add reasoning_effort parameter", "Options: none, low, medium, high. Default is none. Use low for most cases.", "MEDIUM")

    # Testing
    _add("Testing", "Build golden dataset", "Create 30-200+ test cases covering all use cases, edge cases, and languages")
    _add("Testing", "Run evaluation pipeline", "Use Azure AI Foundry evaluators: coherence, fluency, relevance, groundedness, similarity")
    _add("Testing", f"Compare {baseline_name} vs {target_name} results", "Flag any metric that drops more than 10%")
    _add("Testing", "Shadow testing", f"Run both {baseline_name} and {target_name} in parallel, serve only baseline, compare responses", "MEDIUM")
    _add("Testing", "Set quality gates", "Define acceptance criteria: coherence ≥4.0, relevance ≥4.0, similarity ≥3.5")

    # Production Rollout
    _add("Production Rollout", f"Canary deployment (5% → {target_name})", f"Route 5% of traffic to {target_name}, monitor quality")
    _add("Production Rollout", "Progressive rollout (25%→50%→100%)", f"Gradually increase traffic to {target_name}")
    _add("Production Rollout", "Keep rollback plan ready", f"Ensure you can switch back to {baseline_name} quickly if issues arise")

    # Post-Migration
    _add("Post-Migration", "Set up continuous monitoring", "Sample 5% of production traffic for ongoing evaluation", "MEDIUM")
    _add("Post-Migration", "Configure alerts", "Alert on quality score drops, spikes in low-quality responses", "MEDIUM")
    _add("Post-Migration", "Update documentation", "Update internal docs, runbooks, and architecture diagrams", "LOW")
    _add("Post-Migration", f"Retire old {baseline_name} deployments", "Clean up old deployments after successful migration", "LOW")

    return items


def _dynamic_code_examples(
    baseline_caps: Dict[str, Any],
    target_caps: Dict[str, Any],
    baseline_name: str,
    target_name: str,
) -> List[Dict[str, Any]]:
    """Build code examples that match the actual baseline→target migration."""
    removes: List[str] = []
    for p in _PARAM_CAPABILITY_MAP:
        if not target_caps.get(p["cap"], True):
            removes.append(p["parameter"])
    unique_removes = list(dict.fromkeys(removes))  # deduplicate preserving order

    role_before = "system"
    role_after = "developer" if target_caps.get("prefers_developer_role") else "system"
    reasoning_line = '    reasoning_effort="low"     # New parameter\n' if target_caps.get("supports_reasoning_effort") else ""
    remove_comment = f"    # Removed: {', '.join(unique_removes)}\n" if unique_removes else ""

    examples: List[Dict[str, Any]] = []

    # 1) Basic Chat
    before_basic = f'''from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-10-21"
)

response = client.chat.completions.create(
    model="{baseline_name}",
    messages=[
        {{"role": "system", "content": "You are a helpful assistant."}},
        {{"role": "user", "content": user_input}}
    ],
    temperature=0.7,
    max_tokens=500
)
print(response.choices[0].message.content)'''

    after_basic = f'''from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2025-06-01"
)

response = client.chat.completions.create(
    model="{target_name}",
    messages=[
        {{"role": "{role_after}", "content": "You are a helpful assistant."}},
        {{"role": "user", "content": user_input}}
    ],
{remove_comment}    max_completion_tokens=500,
{reasoning_line})
print(response.choices[0].message.content)'''

    changes_basic = [
        "api_version: 2024-10-21 → 2025-06-01",
        f"model: {baseline_name} → {target_name}",
    ]
    if role_after == "developer":
        changes_basic.append("role: system → developer")
    if unique_removes:
        changes_basic.append(f"Removed: {', '.join(unique_removes)}")
    changes_basic.append("max_tokens → max_completion_tokens")
    if target_caps.get("supports_reasoning_effort"):
        changes_basic.append("Added: reasoning_effort='low'")

    examples.append({
        "id": "basic-chat",
        "title": "Basic Chat Completion",
        "description": f"Simple chat API call migrated from {baseline_name} to {target_name}",
        "before": {"label": f"Baseline ({baseline_name})", "language": "python", "code": before_basic},
        "after": {"label": f"Target ({target_name})", "language": "python", "code": after_basic},
        "changes": changes_basic,
    })

    # 2) Classification
    before_class = f'''response = client.chat.completions.create(
    model="{baseline_name}",
    messages=[
        {{"role": "system", "content": "Classify intent as JSON."}},
        {{"role": "user", "content": customer_message}}
    ],
    temperature=0.1,
    top_p=0.95,
    max_tokens=100,
    response_format={{"type": "json_object"}}
)'''

    reasoning_class = '    reasoning_effort="none",  # Fast mode for classification\n' if target_caps.get("supports_reasoning_effort") else ""
    after_class = f'''response = client.chat.completions.create(
    model="{target_name}",
    messages=[
        {{"role": "{role_after}", "content": "Classify intent as JSON."}},
        {{"role": "user", "content": customer_message}}
    ],
{remove_comment}    max_completion_tokens=100,
{reasoning_class}    response_format={{"type": "json_object"}}
)'''

    changes_class = []
    if unique_removes:
        changes_class.append(f"Removed: {', '.join(unique_removes)}")
    changes_class.append("max_tokens → max_completion_tokens")
    if target_caps.get("supports_reasoning_effort"):
        changes_class.append("reasoning_effort='none' for fast classification")
    if role_after == "developer":
        changes_class.append("role: system → developer")

    examples.append({
        "id": "classification",
        "title": "Intent Classification (JSON)",
        "description": "Using JSON mode for structured output",
        "before": {"label": f"Baseline ({baseline_name})", "language": "python", "code": before_class},
        "after": {"label": f"Target ({target_name})", "language": "python", "code": after_class},
        "changes": changes_class,
    })

    return examples


def _dynamic_phases(
    baseline_caps: Dict[str, Any],
    target_caps: Dict[str, Any],
    baseline_name: str,
    target_name: str,
) -> List[Dict[str, Any]]:
    """Build the 5-phase process tailored to the actual migration."""
    unsupported = [p["parameter"] for p in _PARAM_CAPABILITY_MAP if not target_caps.get(p["cap"], True)]
    unique_unsupported = list(dict.fromkeys(unsupported))

    code_tasks = ["Update API version to 2025-06-01", f"Change model name from {baseline_name} to {target_name}"]
    if unique_unsupported:
        code_tasks.append(f"Remove {', '.join(unique_unsupported)}")
    code_tasks.append("Rename max_tokens to max_completion_tokens")
    if target_caps.get("prefers_developer_role"):
        code_tasks.append("Change system role to developer")
    if target_caps.get("supports_reasoning_effort"):
        code_tasks.append("Add reasoning_effort parameter")

    return [
        {"phase": 1, "name": "Discovery", "description": f"Assess your current {baseline_name} usage and prepare for migration to {target_name}", "tasks": [
            f"Inventory all {baseline_name} deployments across subscriptions",
            "Understand retirement timeline and key dates",
            "Audit codebase for deprecated parameters",
            "Identify affected applications and their criticality",
        ]},
        {"phase": 2, "name": "Code Updates", "description": f"Update your code for {target_name} compatibility", "tasks": code_tasks},
        {"phase": 3, "name": "Testing", "description": "Validate quality and performance before production", "tasks": [
            "Build golden dataset (30-200+ test cases)",
            "Run evaluation pipeline with Azure AI Foundry metrics",
            f"Compare {baseline_name} vs {target_name} results",
            "Perform shadow testing",
            "Set quality gates and acceptance criteria",
        ]},
        {"phase": 4, "name": "Production Rollout", "description": "Gradually migrate production traffic", "tasks": [
            f"Canary deployment (5% traffic to {target_name})",
            "Progressive rollout (25% → 50% → 100%)",
            "Monitor quality metrics in real-time",
            "Keep rollback plan ready",
        ]},
        {"phase": 5, "name": "Post-Migration", "description": "Ongoing monitoring and optimization", "tasks": [
            "Set up continuous monitoring (5% traffic sampling)",
            "Configure alerts for quality drops",
            "Update documentation and runbooks",
            f"Retire old {baseline_name} deployments",
            *( ["Optimize reasoning_effort for each use case"] if target_caps.get("supports_reasoning_effort") else []),
        ]},
    ]


def get_dynamic_migration_guide(
    baseline_deployment: Optional[str] = None,
    target_deployment: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return a migration guide dynamically tailored to the selected
    baseline and target deployments.  Falls back to the static guide
    when either deployment is not provided.
    """
    if not baseline_deployment or not target_deployment:
        return get_migration_guide()

    baseline_caps = get_model_capabilities(baseline_deployment)
    target_caps = get_model_capabilities(target_deployment)
    baseline_family = detect_model_family(baseline_deployment)
    target_family = detect_model_family(target_deployment)

    return {
        "key_dates": KEY_DATES,
        "rollout_timeline": ROLLOUT_TIMELINE,
        "phases": _dynamic_phases(baseline_caps, target_caps, baseline_deployment, target_deployment),
        "checklist": _dynamic_checklist(baseline_caps, target_caps, baseline_deployment, target_deployment),
        "parameter_changes": _dynamic_parameter_changes(baseline_caps, target_caps, baseline_deployment, target_deployment),
        "reasoning_effort_guide": REASONING_EFFORT_GUIDE if target_caps.get("supports_reasoning_effort") else [],
        "error_messages": ERROR_MESSAGES,
        "code_examples": _dynamic_code_examples(baseline_caps, target_caps, baseline_deployment, target_deployment),
        "faq": FAQ_ITEMS,
        "cost_comparison": COST_COMPARISON,
        "dataset_size_recommendations": DATASET_SIZE_RECOMMENDATIONS,
        "test_case_categories": TEST_CASE_CATEGORIES,
        "rollback_procedures": ROLLBACK_PROCEDURES,
        "acceptance_criteria": ACCEPTANCE_CRITERIA,
        "monitoring_guidance": MONITORING_GUIDANCE,
        # Extra metadata
        "baseline_deployment": baseline_deployment,
        "target_deployment": target_deployment,
        "baseline_family": baseline_family,
        "baseline_family_display": MODEL_FAMILIES.get(baseline_family, {}).get("display", baseline_family),
        "target_family": target_family,
        "target_family_display": MODEL_FAMILIES.get(target_family, {}).get("display", target_family),
    }


# ══════════════════════════════════════════════════════════════════
# PUBLIC API FUNCTIONS
# ══════════════════════════════════════════════════════════════════
def get_migration_guide() -> Dict[str, Any]:
    """Return the complete migration guide data."""
    return {
        "key_dates": KEY_DATES,
        "rollout_timeline": ROLLOUT_TIMELINE,
        "phases": MIGRATION_PHASES,
        "checklist": MIGRATION_CHECKLIST,
        "parameter_changes": PARAMETER_CHANGES,
        "reasoning_effort_guide": REASONING_EFFORT_GUIDE,
        "error_messages": ERROR_MESSAGES,
        "code_examples": CODE_EXAMPLES,
        "faq": FAQ_ITEMS,
        "cost_comparison": COST_COMPARISON,
        "dataset_size_recommendations": DATASET_SIZE_RECOMMENDATIONS,
        "test_case_categories": TEST_CASE_CATEGORIES,
        "rollback_procedures": ROLLBACK_PROCEDURES,
        "acceptance_criteria": ACCEPTANCE_CRITERIA,
        "monitoring_guidance": MONITORING_GUIDANCE,
    }


def get_checklist() -> List[Dict[str, Any]]:
    """Return the migration checklist."""
    return MIGRATION_CHECKLIST


def get_faq(category: str | None = None) -> List[Dict[str, str]]:
    """Return FAQ items, optionally filtered by category."""
    if category:
        return [f for f in FAQ_ITEMS if f["category"].lower() == category.lower()]
    return FAQ_ITEMS


def get_code_examples() -> List[Dict[str, Any]]:
    """Return before/after code examples."""
    return CODE_EXAMPLES


def get_parameter_changes() -> List[Dict[str, str]]:
    """Return the parameter changes reference."""
    return PARAMETER_CHANGES


def get_dataset_recommendations() -> Dict[str, Any]:
    """Return golden dataset size recommendations and categories."""
    return {
        "size_recommendations": DATASET_SIZE_RECOMMENDATIONS,
        "test_case_categories": TEST_CASE_CATEGORIES,
        "quality_checklist": [
            "Coverage: All major use cases represented",
            "Balance: Reasonable distribution across categories",
            "Languages: All supported languages included",
            "Difficulty: Mix of easy, medium, and hard cases",
            "Edge cases: Unusual scenarios covered",
            "Ground truth quality: Responses reviewed by SMEs",
            "No PII: Personal data removed or anonymized",
            "Formatting: Valid JSONL, consistent structure",
        ],
    }


def get_rollback_procedures() -> List[Dict[str, Any]]:
    """Return rollback procedures for different deployment types."""
    return ROLLBACK_PROCEDURES


def get_acceptance_criteria() -> Dict[str, Dict[str, float]]:
    """Return quality gate acceptance criteria."""
    return ACCEPTANCE_CRITERIA


def get_monitoring_guidance() -> Dict[str, Any]:
    """Return continuous monitoring guidance."""
    return MONITORING_GUIDANCE
