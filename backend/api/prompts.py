"""
Prompt Management API routes.

CRUD + versioning for prompt templates.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.schemas.prompt import (
    PromptCreate,
    PromptListOut,
    PromptOut,
    PromptUpdate,
    PromptVersionCreate,
    PromptVersionOut,
)
from backend.services.prompt_manager import (
    add_version,
    create_prompt,
    delete_prompt,
    get_current_version,
    get_prompt,
    list_prompts,
    render_template,
    set_current_version,
    update_prompt,
)

router = APIRouter(prefix="/prompts", tags=["Prompt Management"])
logger = logging.getLogger(__name__)


# ── Sample / seed prompt data ───────────────────────────────────
SAMPLE_PROMPTS = [
    {
        "name": "Customer Support Agent",
        "description": "Professional customer service agent for handling billing, tech support, and general enquiries.",
        "system_message": "You are a helpful, professional customer support agent. Be empathetic, concise, and solution-oriented. Always verify the customer's issue before suggesting a fix.",
        "tags": {"domain": "customer_service", "tone": "professional"},
        "initial_content": "The customer ({{customer_name}}) has the following issue:\n\n{{issue_description}}\n\nAccount type: {{account_type}}\nAccount status: {{account_status}}\n\nPlease provide a helpful response addressing their concern.",
    },
    {
        "name": "Code Review Assistant",
        "description": "AI-powered code reviewer that analyses code for bugs, security issues, and best practices.",
        "system_message": "You are a senior software engineer performing a code review. Focus on correctness, security vulnerabilities, performance, and adherence to best practices. Be constructive and explain your reasoning.",
        "tags": {"domain": "engineering", "task": "code_review"},
        "initial_content": "Please review the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nFocus areas:\n- Correctness and edge cases\n- Security vulnerabilities\n- Performance considerations\n- Code style and best practices\n\nProvide specific, actionable feedback.",
    },
    {
        "name": "Text Summariser",
        "description": "Summarises long documents or articles into concise key points.",
        "system_message": "You are an expert summariser. Extract the most important information and present it clearly. Maintain factual accuracy — never add information not present in the source.",
        "tags": {"domain": "general", "task": "summarisation"},
        "initial_content": "Summarise the following {{content_type}} in {{output_format}}:\n\n{{text}}\n\nTarget length: {{target_length}}\nAudience: {{audience}}",
    },
    {
        "name": "SQL Query Generator",
        "description": "Generates SQL queries from natural language questions about a database schema.",
        "system_message": "You are a database expert. Generate correct, efficient SQL queries based on the user's question and the provided schema. Use standard SQL syntax. Always explain what the query does.",
        "tags": {"domain": "data", "task": "sql_generation"},
        "initial_content": "Database schema:\n{{schema}}\n\nQuestion: {{question}}\n\nGenerate an efficient SQL query that answers the question. Explain the query step by step.",
    },
    {
        "name": "Email Drafter",
        "description": "Drafts professional emails with configurable tone, length, and purpose.",
        "system_message": "You are a professional communication specialist. Draft clear, well-structured emails appropriate for a business setting. Match the requested tone and keep the email focused.",
        "tags": {"domain": "communication", "task": "email"},
        "initial_content": "Draft a {{tone}} email for the following purpose:\n\nRecipient: {{recipient_name}} ({{recipient_role}})\nSubject: {{subject}}\nKey points to cover:\n{{key_points}}\n\nDesired length: {{length}}\nSender name: {{sender_name}}",
    },
    {
        "name": "Data Analyst Report",
        "description": "Analyses data and generates human-readable insights and recommendations.",
        "system_message": "You are a senior data analyst. Interpret data accurately, identify trends and anomalies, and provide actionable recommendations. Use clear language that non-technical stakeholders can understand.",
        "tags": {"domain": "data", "task": "analysis"},
        "initial_content": "Analyse the following {{data_type}} data and provide insights:\n\n{{data}}\n\nContext: {{business_context}}\nTime period: {{time_period}}\n\nPlease provide:\n1. Key findings\n2. Notable trends or anomalies\n3. Actionable recommendations",
    },
    {
        "name": "API Documentation Writer",
        "description": "Generates clear API documentation from endpoint specifications.",
        "system_message": "You are a technical writer specialising in API documentation. Write clear, concise, and developer-friendly documentation. Include request/response examples and error codes.",
        "tags": {"domain": "engineering", "task": "documentation"},
        "initial_content": "Generate API documentation for the following endpoint:\n\nMethod: {{http_method}}\nPath: {{endpoint_path}}\nDescription: {{description}}\nRequest body: {{request_body}}\nResponse format: {{response_format}}\n\nInclude:\n- Overview and use case\n- Request parameters with types\n- Example request and response\n- Error codes and handling",
    },
    {
        "name": "Meeting Notes Summariser",
        "description": "Converts meeting transcripts into structured action items and summaries.",
        "system_message": "You are an expert at distilling meeting content into clear, structured notes. Focus on decisions made, action items (with owners), and key discussion points. Be concise.",
        "tags": {"domain": "productivity", "task": "summarisation"},
        "initial_content": "Meeting: {{meeting_title}}\nDate: {{date}}\nAttendees: {{attendees}}\n\nTranscript / notes:\n{{transcript}}\n\nPlease generate:\n1. Executive summary (2-3 sentences)\n2. Key decisions made\n3. Action items with owners and deadlines\n4. Open questions / follow-ups",
    },
    {
        "name": "Content Safety Checker",
        "description": "Evaluates text content for safety, bias, and appropriateness.",
        "system_message": "You are a content safety reviewer. Evaluate text for harmful content, bias, misinformation, and appropriateness. Be thorough but fair. Explain your reasoning for each finding.",
        "tags": {"domain": "safety", "task": "content_review"},
        "initial_content": "Review the following {{content_type}} for safety and appropriateness:\n\n{{content}}\n\nEvaluate for:\n- Harmful or violent content\n- Bias or discrimination\n- Misinformation\n- PII exposure\n- Appropriateness for audience: {{target_audience}}\n\nProvide a safety rating (Safe / Caution / Unsafe) with explanation.",
    },
    {
        "name": "Translation & Localisation",
        "description": "Translates and localises content between languages with cultural awareness.",
        "system_message": "You are a professional translator and localisation expert. Translate accurately while adapting cultural references, idioms, and formatting for the target locale. Preserve the original tone and intent.",
        "tags": {"domain": "language", "task": "translation"},
        "initial_content": "Translate the following text from {{source_language}} to {{target_language}}:\n\n{{text}}\n\nContext: {{context}}\nTone: {{tone}}\nTarget audience: {{audience}}\n\nProvide the translation and note any cultural adaptations made.",
    },
]


@router.post("/seed-samples", response_model=List[PromptOut], status_code=201)
async def seed_sample_prompts(db: AsyncSession = Depends(get_db)):
    """Create built-in sample prompts so users can explore the system immediately."""
    created = []
    for sample in SAMPLE_PROMPTS:
        existing = await list_prompts(db, active_only=False)
        if any(p.name == sample["name"] for p in existing):
            match = next(p for p in existing if p.name == sample["name"])
            created.append(match)
            continue
        payload = PromptCreate(
            name=sample["name"],
            description=sample["description"],
            system_message=sample["system_message"],
            tags=sample.get("tags"),
            initial_content=sample["initial_content"],
        )
        prompt = await create_prompt(db, payload)
        created.append(prompt)
        logger.info("Seeded sample prompt: %s", prompt.name)
    return created


@router.post("", response_model=PromptOut, status_code=201)
async def create(payload: PromptCreate, db: AsyncSession = Depends(get_db)):
    return await create_prompt(db, payload)


@router.get("", response_model=List[PromptOut])
async def list_all(active_only: bool = True, db: AsyncSession = Depends(get_db)):
    return await list_prompts(db, active_only=active_only)


@router.get("/{prompt_id}", response_model=PromptOut)
async def get_one(prompt_id: str, db: AsyncSession = Depends(get_db)):
    prompt = await get_prompt(db, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.patch("/{prompt_id}", response_model=PromptOut)
async def update(prompt_id: str, payload: PromptUpdate, db: AsyncSession = Depends(get_db)):
    prompt = await update_prompt(db, prompt_id, payload)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


@router.delete("/{prompt_id}", status_code=204)
async def delete(prompt_id: str, db: AsyncSession = Depends(get_db)):
    ok = await delete_prompt(db, prompt_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt not found")


@router.post("/{prompt_id}/versions", response_model=PromptVersionOut, status_code=201)
async def create_version(
    prompt_id: str,
    payload: PromptVersionCreate,
    db: AsyncSession = Depends(get_db),
):
    version = await add_version(db, prompt_id, payload)
    if not version:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return version


@router.get("/{prompt_id}/versions/current", response_model=PromptVersionOut)
async def get_current(prompt_id: str, db: AsyncSession = Depends(get_db)):
    version = await get_current_version(db, prompt_id)
    if not version:
        raise HTTPException(status_code=404, detail="No current version found")
    return version


@router.put("/{prompt_id}/versions/{version_id}/activate")
async def activate_version(
    prompt_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    ok = await set_current_version(db, prompt_id, version_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt/version not found")
    return {"status": "ok"}


@router.post("/{prompt_id}/render")
async def render(
    prompt_id: str,
    variables: dict,
    db: AsyncSession = Depends(get_db),
):
    """Render the current prompt version with provided variables."""
    version = await get_current_version(db, prompt_id)
    if not version:
        raise HTTPException(status_code=404, detail="No current version found")
    rendered = render_template(version.content, variables)
    return {"rendered": rendered, "version": version.version}
