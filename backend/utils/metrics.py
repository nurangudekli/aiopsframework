"""Shared metric calculation helpers."""

from __future__ import annotations

from typing import List


def safe_mean(values: List[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    idx = int(len(sorted_v) * pct / 100)
    idx = min(idx, len(sorted_v) - 1)
    return round(sorted_v[idx], 2)
