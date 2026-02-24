"""
File Parser Utility.

Parses uploaded Excel, CSV, and JSON files into a list of test-case dicts.
Expected columns/keys: question, expected_answer (optional), context (optional).
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger(__name__)


def parse_uploaded_file(content: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parse an uploaded file and return a list of test case dicts.

    Supports .xlsx, .xls, .csv, and .json files.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in ("xlsx", "xls"):
        return _parse_excel(content)
    elif ext == "csv":
        return _parse_csv(content)
    elif ext == "json":
        return _parse_json(content)
    else:
        raise ValueError(f"Unsupported file format: .{ext}. Use .xlsx, .csv, or .json.")


def _parse_excel(content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    return _df_to_cases(df)


def _parse_csv(content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_csv(io.BytesIO(content))
    return _df_to_cases(df)


def _parse_json(content: bytes) -> List[Dict[str, Any]]:
    data = json.loads(content.decode("utf-8"))
    if isinstance(data, list):
        return [_normalise_case(item) for item in data]
    elif isinstance(data, dict) and "questions" in data:
        return [_normalise_case(item) for item in data["questions"]]
    else:
        raise ValueError("JSON must be an array of objects or an object with a 'questions' array.")


def _df_to_cases(df: pd.DataFrame) -> List[Dict[str, Any]]:
    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    cases = []
    for _, row in df.iterrows():
        cases.append(_normalise_case(row.to_dict()))
    return cases


def _normalise_case(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map common column name variations to canonical keys."""
    case: Dict[str, Any] = {}
    for key, value in raw.items():
        k = str(key).strip().lower().replace(" ", "_")
        if k in ("question", "query", "input", "prompt", "user_message"):
            case["question"] = str(value)
        elif k in ("expected_answer", "expected", "reference", "ground_truth", "answer"):
            case["expected_answer"] = str(value) if pd.notna(value) else None
        elif k in ("context", "rag_context", "document"):
            case["context"] = str(value) if pd.notna(value) else None
        elif k in ("tags", "category", "type"):
            case.setdefault("tags", {})[k] = str(value) if pd.notna(value) else None

    if "question" not in case:
        raise ValueError(f"Row missing a 'question' column. Found keys: {list(raw.keys())}")
    return case
