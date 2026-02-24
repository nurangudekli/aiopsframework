"""Tests for prompt manager service."""

from backend.services.prompt_manager import render_template, _extract_variables


def test_render_template():
    template = "You are an expert in {{domain}}. Answer: {{question}}"
    result = render_template(template, {"domain": "AI", "question": "What is GPT?"})
    assert result == "You are an expert in AI. Answer: What is GPT?"


def test_render_template_missing_var():
    template = "Hello {{name}}, welcome to {{place}}"
    result = render_template(template, {"name": "Alice"})
    assert "Alice" in result
    assert "{{place}}" in result  # unresolved


def test_extract_variables():
    template = "{{var1}} is related to {{ var2 }} and {{var1}}"
    vars = _extract_variables(template)
    assert set(vars) == {"var1", "var2"}
