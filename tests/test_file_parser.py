"""Tests for file parser utility."""

import json
import pytest

from backend.utils.file_parser import parse_uploaded_file


def test_parse_json_array():
    data = [
        {"question": "What is AI?", "expected_answer": "Artificial Intelligence"},
        {"question": "What is ML?"},
    ]
    content = json.dumps(data).encode("utf-8")
    cases = parse_uploaded_file(content, "test.json")
    assert len(cases) == 2
    assert cases[0]["question"] == "What is AI?"
    assert cases[0]["expected_answer"] == "Artificial Intelligence"
    assert cases[1].get("expected_answer") is None


def test_parse_json_with_questions_key():
    data = {"questions": [{"question": "How does RAG work?"}]}
    content = json.dumps(data).encode("utf-8")
    cases = parse_uploaded_file(content, "test.json")
    assert len(cases) == 1
    assert cases[0]["question"] == "How does RAG work?"


def test_parse_csv():
    csv_content = b"question,expected_answer\nWhat is Azure?,Cloud platform\nWhat is GCP?,Cloud platform"
    cases = parse_uploaded_file(csv_content, "test.csv")
    assert len(cases) == 2
    assert cases[0]["question"] == "What is Azure?"


def test_unsupported_format():
    with pytest.raises(ValueError, match="Unsupported"):
        parse_uploaded_file(b"data", "test.txt")
